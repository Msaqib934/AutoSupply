"""Component Catalogue Microservice (Port 8003, DB: autosupply_component)."""

import os
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from fastapi import Depends, FastAPI, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum,
    Integer,
    Numeric,
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
    from .common.deps import AuthUser, require_permission
    from .common.errors import (
        ConflictError,
        NotFoundError,
        register_error_handlers,
    )
    from .common.permissions import Permission
except (ImportError, ValueError):
    from common.config import get_common_settings
    from common.db import Base, TimestampMixin, create_db_helpers
    from common.deps import AuthUser, require_permission
    from common.errors import (
        ConflictError,
        NotFoundError,
        register_error_handlers,
    )
    from common.permissions import Permission

# Database configuration
DATABASE_URL = os.getenv(
    "COMPONENT_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_component",
    ),
)
engine, SessionLocal, get_db = create_db_helpers(DATABASE_URL)


class UnitOfMeasure(StrEnum):
    EA = "EA"
    SET = "SET"
    PAIR = "PAIR"
    KG = "KG"
    M = "M"
    L = "L"


class Component(TimestampMixin, Base):
    __tablename__ = "components"
    __table_args__ = (CheckConstraint("reorder_threshold >= 0", name="reorder_threshold_nonneg"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    unit_of_measure: Mapped[UnitOfMeasure] = mapped_column(
        Enum(UnitOfMeasure, name="unit_of_measure", native_enum=False, create_constraint=True, length=8),
        default=UnitOfMeasure.EA,
        nullable=False,
    )
    reorder_threshold: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), default=Decimal("0"), nullable=False
    )
    preferred_supplier_id: Mapped[int | None] = mapped_column(Integer, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)


# Schemas
class APIModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ComponentRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    unit_of_measure: str


class ComponentCreate(APIModel):
    code: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z0-9][A-Za-z0-9-]*$")
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    category: str = Field(min_length=2, max_length=60)
    unit_of_measure: UnitOfMeasure = UnitOfMeasure.EA
    reorder_threshold: str = "0.000"
    preferred_supplier_id: int | None = None
    is_active: bool = True


class ComponentUpdate(APIModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    unit_of_measure: UnitOfMeasure | None = None
    reorder_threshold: str | None = None
    preferred_supplier_id: int | None = None
    is_active: bool | None = None


class ComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    description: str | None
    category: str
    unit_of_measure: UnitOfMeasure
    reorder_threshold: str
    preferred_supplier_id: int | None
    is_active: bool
    incoming_confirmed: str = "0.000"
    incoming_unconfirmed: str = "0.000"
    created_at: datetime
    updated_at: datetime


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


app = FastAPI(title="AutoSupply Hub — Component Service", version="0.1.0")
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
    return {"status": "ok", "service": "component-service"}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "component-service"}


@app.get("/internal/components/{component_id}", response_model=ComponentRef)
def internal_get_component(component_id: int, db: Session = Depends(get_db)):
    comp = db.get(Component, component_id)
    if not comp:
        raise NotFoundError("Component not found.")
    return ComponentRef(
        id=comp.id,
        code=comp.code,
        name=comp.name,
        unit_of_measure=comp.unit_of_measure.value,
    )


@app.get("/internal/metrics")
def internal_metrics(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Component.id)).where(Component.is_active.is_(True))) or 0
    return {"total_components": int(total)}


@app.get("/api/v1/components", response_model=Page[ComponentOut])
def list_components(
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    _: AuthUser = Depends(require_permission(Permission.COMPONENTS_READ)),
):
    stmt = select(Component)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Component.code.ilike(like), Component.name.ilike(like)))
    if category:
        stmt = stmt.where(Component.category.ilike(category.strip()))
    if is_active is not None:
        stmt = stmt.where(Component.is_active == is_active)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    components = list(
        db.scalars(
            stmt.order_by(Component.code).offset((page - 1) * page_size).limit(page_size)
        )
    )

    items = [
        ComponentOut(
            id=c.id,
            code=c.code,
            name=c.name,
            description=c.description,
            category=c.category,
            unit_of_measure=c.unit_of_measure,
            reorder_threshold=str(c.reorder_threshold),
            preferred_supplier_id=c.preferred_supplier_id,
            is_active=c.is_active,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in components
    ]
    return Page[ComponentOut](items=items, total=int(total), page=page, page_size=page_size)


@app.get("/api/v1/components/{component_id}", response_model=ComponentOut)
def get_component(
    component_id: int,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.COMPONENTS_READ)),
):
    comp = db.get(Component, component_id)
    if not comp:
        raise NotFoundError("Component not found.")
    return ComponentOut(
        id=comp.id,
        code=comp.code,
        name=comp.name,
        description=comp.description,
        category=comp.category,
        unit_of_measure=comp.unit_of_measure,
        reorder_threshold=str(comp.reorder_threshold),
        preferred_supplier_id=comp.preferred_supplier_id,
        is_active=comp.is_active,
        created_at=comp.created_at,
        updated_at=comp.updated_at,
    )


@app.post("/api/v1/components", response_model=ComponentOut, status_code=status.HTTP_201_CREATED)
def create_component(
    data: ComponentCreate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.COMPONENTS_WRITE)),
):
    code = data.code.upper().strip()
    if db.scalar(select(Component.id).where(func.upper(Component.code) == code)):
        raise ConflictError(f"Component code '{data.code}' already exists.", code="DUPLICATE_CODE")

    comp = Component(
        code=code,
        name=data.name,
        description=data.description,
        category=data.category,
        unit_of_measure=data.unit_of_measure,
        reorder_threshold=Decimal(data.reorder_threshold),
        preferred_supplier_id=data.preferred_supplier_id,
        is_active=data.is_active,
    )
    db.add(comp)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f"Component code '{data.code}' already exists.", code="DUPLICATE_CODE") from exc
    db.refresh(comp)
    return get_component(comp.id, db, _)


@app.patch("/api/v1/components/{component_id}", response_model=ComponentOut)
def update_component(
    component_id: int,
    data: ComponentUpdate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_permission(Permission.COMPONENTS_WRITE)),
):
    comp = db.get(Component, component_id)
    if not comp:
        raise NotFoundError("Component not found.")

    changes = data.model_dump(exclude_unset=True)
    if "code" in changes and changes["code"]:
        new_code = changes["code"].upper().strip()
        existing = db.scalar(select(Component.id).where(func.upper(Component.code) == new_code, Component.id != comp.id))
        if existing:
            raise ConflictError(f"Component code '{new_code}' already exists.", code="DUPLICATE_CODE")
        comp.code = new_code

    if "reorder_threshold" in changes and changes["reorder_threshold"]:
        comp.reorder_threshold = Decimal(changes["reorder_threshold"])
        del changes["reorder_threshold"]

    for k, v in changes.items():
        if k != "code":
            setattr(comp, k, v)

    db.commit()
    db.refresh(comp)
    return get_component(comp.id, db, _)
