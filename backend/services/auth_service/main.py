"""Auth & Identity Microservice (Port 8001, DB: autosupply_auth)."""

import os
from datetime import datetime

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, CheckConstraint, Enum, Integer, String, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

try:
    from .common.config import get_common_settings
    from .common.db import Base, TimestampMixin, create_db_helpers
    from .common.deps import AuthUser, get_current_user_context, require_permission
    from .common.errors import AuthenticationError, ConflictError, register_error_handlers
    from .common.permissions import Permission, Role, permissions_for
    from .common.security import create_access_token, dummy_verify, hash_password, verify_password
except (ImportError, ValueError):
    from common.config import get_common_settings
    from common.db import Base, TimestampMixin, create_db_helpers
    from common.deps import AuthUser, get_current_user_context, require_permission
    from common.errors import AuthenticationError, ConflictError, register_error_handlers
    from common.permissions import Permission, Role, permissions_for
    from common.security import create_access_token, dummy_verify, hash_password, verify_password

# Database configuration
DATABASE_URL = os.getenv(
    "AUTH_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_auth",
    ),
)
engine, SessionLocal, get_db = create_db_helpers(DATABASE_URL)


# ORM Model
class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "(role = 'SUPPLIER' AND supplier_id IS NOT NULL) OR "
            "(role <> 'SUPPLIER' AND supplier_id IS NULL)",
            name="supplier_link_matches_role",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", native_enum=False, create_constraint=True, length=32),
        nullable=False,
    )
    supplier_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# Schemas
class APIModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class LoginRequest(APIModel):
    email: str = Field(pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Role
    supplier_id: int | None
    is_active: bool
    created_at: datetime


class CurrentUserOut(UserOut):
    permissions: list[str]


class UserCreate(APIModel):
    email: str = Field(pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=72)
    role: Role
    supplier_id: int | None = None


# App
app = FastAPI(title="AutoSupply Hub — Auth Service", version="0.1.0")
register_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_common_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "auth-service"}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "auth-service"}


@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login(creds: LoginRequest, response: Response, db: Session = Depends(get_db)):
    stmt = select(User).where(User.email == creds.email.lower().strip())
    user = db.scalar(stmt)
    if user is None:
        dummy_verify()
        raise AuthenticationError("Incorrect email or password.")
    if not verify_password(creds.password, user.hashed_password):
        raise AuthenticationError("Incorrect email or password.")
    if not user.is_active:
        raise AuthenticationError("Account is inactive.")

    token = create_access_token(
        str(user.id),
        {
            "role": user.role.value,
            "supplier_id": user.supplier_id,
            "email": user.email,
            "full_name": user.full_name,
        },
    )

    settings = get_common_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )
    return TokenResponse(access_token=token)


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(key=get_common_settings().session_cookie_name, httponly=True, samesite="lax")


@app.get("/api/v1/auth/me", response_model=CurrentUserOut)
def get_me(current: AuthUser = Depends(get_current_user_context), db: Session = Depends(get_db)):
    user = db.get(User, current.id)
    if not user or not user.is_active:
        raise AuthenticationError("User not found.")
    perms = permissions_for(user.role)
    data = UserOut.model_validate(user).model_dump()
    data["permissions"] = perms
    return CurrentUserOut.model_validate(data)


@app.get("/api/v1/auth/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.USERS_MANAGE)),
):
    users = list(db.scalars(select(User).order_by(User.id)))
    return [UserOut.model_validate(u) for u in users]


@app.post("/api/v1/auth/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.USERS_MANAGE)),
):
    email = data.email.lower().strip()
    if db.scalar(select(User.id).where(User.email == email)):
        raise ConflictError(f"User with email '{data.email}' already exists.")
    user = User(
        email=email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
        supplier_id=data.supplier_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
