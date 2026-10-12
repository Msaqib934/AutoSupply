"""Supplier Management Microservice (Port 8002, DB: autosupply_supplier)."""

import os
from datetime import datetime
from enum import StrEnum

from fastapi import Depends, FastAPI, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    CheckConstraint,
    Enum,
    Integer,
    String,
    Text,
    func,
    or_,
    select,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

try:
    from .common.config import get_common_settings
    from .common.db import Base, TimestampMixin, create_db_helpers
    from .common.deps import (
        AuthUser,
        get_current_user_context,
        require_any_permission,
        require_permission,
    )
    from .common.errors import (
        ConflictError,
        NotFoundError,
        PermissionDeniedError,
        register_error_handlers,
    )
    from .common.permissions import Permission, Role
except (ImportError, ValueError):
    from common.config import get_common_settings
    from common.db import Base, TimestampMixin, create_db_helpers
    from common.deps import (
        AuthUser,
        get_current_user_context,
        require_any_permission,
        require_permission,
    )
    from common.errors import (
        ConflictError,
        NotFoundError,
        PermissionDeniedError,
        register_error_handlers,
    )
    from common.permissions import Permission, Role

# Database configuration
DATABASE_URL = os.getenv(
    "SUPPLIER_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_supplier",
    ),
)
engine, SessionLocal, get_db = create_db_helpers(DATABASE_URL)


class SupplierStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    UNDER_REVIEW = "UNDER_REVIEW"


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("lead_time_days >= 0 AND lead_time_days <= 365", name="lead_time_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    status: Mapped[SupplierStatus] = mapped_column(
        Enum(
            SupplierStatus,
            name="supplier_status",
            native_enum=False,
            create_constraint=True,
            length=20,
        ),
        default=SupplierStatus.UNDER_REVIEW,
        index=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)


# Schemas
class APIModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class SupplierRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    company_name: str


class SupplierCreate(APIModel):
    code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9-]*$")
    company_name: str = Field(min_length=2, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str = Field(min_length=2, max_length=100)
    lead_time_days: int = Field(default=14, ge=0, le=365)
    status: SupplierStatus = SupplierStatus.UNDER_REVIEW
    notes: str | None = None


class SupplierUpdate(APIModel):
    code: str | None = None
    company_name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    lead_time_days: int | None = None
    status: SupplierStatus | None = None
    notes: str | None = None


class SupplierSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    company_name: str
    contact_name: str | None
    email: str | None
    country: str
    lead_time_days: int
    status: SupplierStatus
    component_count: int = 0


class SupplierOut(SupplierSummary):
    phone: str | None
    address: str | None
    city: str | None
    notes: str | None
    components: list[dict] = []
    created_at: datetime
    updated_at: datetime


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


SUPPLIER_SELF_EDITABLE_FIELDS = frozenset(
    {"contact_name", "email", "phone", "address", "city", "country"}
)

app = FastAPI(title="AutoSupply Hub — Supplier Service", version="0.1.0")
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
    return {"status": "ok", "service": "supplier-service"}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "supplier-service"}


@app.get("/internal/suppliers/{supplier_id}", response_model=SupplierRef)
def internal_get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    sup = db.get(Supplier, supplier_id)
    if not sup:
        raise NotFoundError("Supplier not found.")
    return SupplierRef.model_validate(sup)


@app.get("/internal/metrics")
def internal_metrics(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Supplier.id))) or 0
    active = db.scalar(select(func.count(Supplier.id)).where(Supplier.status == SupplierStatus.ACTIVE)) or 0
    return {"total_suppliers": int(total), "active_suppliers": int(active)}


@app.get("/api/v1/suppliers", response_model=Page[SupplierSummary])
def list_suppliers(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    status: SupplierStatus | None = None,
    _: AuthUser = Depends(require_permission(Permission.SUPPLIERS_READ)),
):
    stmt = select(Supplier)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(Supplier.id == user.supplier_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Supplier.code.ilike(like),
                Supplier.company_name.ilike(like),
                Supplier.country.ilike(like),
            )
        )
    if status:
        stmt = stmt.where(Supplier.status == status)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    suppliers = list(
        db.scalars(
            stmt.order_by(Supplier.code).offset((page - 1) * page_size).limit(page_size)
        )
    )

    items = [SupplierSummary.model_validate(s) for s in suppliers]
    return Page[SupplierSummary](items=items, total=int(total), page=page, page_size=page_size)


@app.get("/api/v1/suppliers/{supplier_id}", response_model=SupplierOut)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    _: AuthUser = Depends(require_permission(Permission.SUPPLIERS_READ)),
):
    stmt = select(Supplier).where(Supplier.id == supplier_id)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(Supplier.id == user.supplier_id)
    supplier = db.scalar(stmt)
    if not supplier:
        raise NotFoundError("Supplier not found.")
    return SupplierOut.model_validate(supplier)


@app.post("/api/v1/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.SUPPLIERS_WRITE)),
):
    code = data.code.upper().strip()
    if db.scalar(select(Supplier.id).where(func.upper(Supplier.code) == code)):
        raise ConflictError(f"Supplier code '{data.code}' already exists.", code="DUPLICATE_CODE")

    supplier = Supplier(
        code=code,
        company_name=data.company_name,
        contact_name=data.contact_name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        city=data.city,
        country=data.country,
        lead_time_days=data.lead_time_days,
        status=data.status,
        notes=data.notes,
    )
    db.add(supplier)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f"Supplier code '{data.code}' already exists.", code="DUPLICATE_CODE") from exc
    db.refresh(supplier)
    return SupplierOut.model_validate(supplier)


@app.patch("/api/v1/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    _: AuthUser = Depends(
        require_any_permission(Permission.SUPPLIERS_WRITE, Permission.SUPPLIER_PROFILE_UPDATE_OWN)
    ),
):
    stmt = select(Supplier).where(Supplier.id == supplier_id)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(Supplier.id == user.supplier_id)
    supplier = db.scalar(stmt)
    if not supplier:
        raise NotFoundError("Supplier not found.")

    changes = data.model_dump(exclude_unset=True)
    if user.role == Role.SUPPLIER:
        forbidden = set(changes) - SUPPLIER_SELF_EDITABLE_FIELDS
        if forbidden:
            raise PermissionDeniedError("Supplier users may only edit contact and address details.")

    if "code" in changes and changes["code"]:
        new_code = changes["code"].upper().strip()
        existing = db.scalar(select(Supplier.id).where(func.upper(Supplier.code) == new_code, Supplier.id != supplier.id))
        if existing:
            raise ConflictError(f"Supplier code '{new_code}' already exists.", code="DUPLICATE_CODE")
        changes["code"] = new_code

    for k, v in changes.items():
        setattr(supplier, k, v)

    db.commit()
    db.refresh(supplier)
    return SupplierOut.model_validate(supplier)
