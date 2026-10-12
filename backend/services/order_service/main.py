"""Purchase Order Microservice (Port 8004, DB: autosupply_order)."""

import os
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
    select,
    text,
)
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

try:
    from .common.config import get_common_settings
    from .common.db import Base, TimestampMixin, create_db_helpers, utcnow
    from .common.deps import (
        AuthUser,
        get_current_user_context,
        require_any_permission,
        require_permission,
    )
    from .common.errors import (
        BusinessRuleError,
        InvalidStatusTransitionError,
        NotFoundError,
        PermissionDeniedError,
        register_error_handlers,
    )
    from .common.permissions import Permission, Role
except (ImportError, ValueError):
    from common.config import get_common_settings
    from common.db import Base, TimestampMixin, create_db_helpers, utcnow
    from common.deps import (
        AuthUser,
        get_current_user_context,
        require_any_permission,
        require_permission,
    )
    from common.errors import (
        BusinessRuleError,
        InvalidStatusTransitionError,
        NotFoundError,
        PermissionDeniedError,
        register_error_handlers,
    )
    from common.permissions import Permission, Role

DATABASE_URL = os.getenv(
    "ORDER_DATABASE_URL",
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_order",
    ),
)
engine, SessionLocal, get_db = create_db_helpers(DATABASE_URL)


class PurchaseOrderStatus(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    SUPPLIER_CONFIRMED = "SUPPLIER_CONFIRMED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class Currency(StrEnum):
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    JPY = "JPY"


class PurchaseOrder(TimestampMixin, Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="total_nonneg"),
        CheckConstraint("requested_delivery_date >= order_date", name="delivery_after_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    po_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, name="po_status", native_enum=False, create_constraint=True, length=24),
        default=PurchaseOrderStatus.DRAFT,
        index=True,
        nullable=False,
    )
    currency: Mapped[Currency] = mapped_column(
        Enum(Currency, name="currency", native_enum=False, create_constraint=True, length=3),
        nullable=False,
    )
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_delivery_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=Decimal("0.00"), nullable=False)
    supplier_response_note: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(120))
    idempotency_key: Mapped[str | None] = mapped_column(String(64), index=True)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", order_by="PurchaseOrderLine.line_number", lazy="selectin"
    )
    status_history: Mapped[list["PurchaseOrderStatusHistory"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", order_by="PurchaseOrderStatusHistory.id", lazy="selectin"
    )


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_nonneg"),
        CheckConstraint("line_number > 0", name="line_number_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    component_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="lines")


class PurchaseOrderStatusHistory(Base):
    __tablename__ = "purchase_order_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    from_status: Mapped[PurchaseOrderStatus | None] = mapped_column(
        Enum(PurchaseOrderStatus, name="po_hist_from", native_enum=False, create_constraint=True, length=24)
    )
    to_status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, name="po_hist_to", native_enum=False, create_constraint=True, length=24),
        nullable=False,
    )
    changed_by_id: Mapped[int | None] = mapped_column(Integer)
    changed_by_name: Mapped[str | None] = mapped_column(String(120))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="status_history")


# Domain logic
ROUND_CENTS = Decimal("0.01")


def calc_line_total(qty: Decimal, price: Decimal) -> Decimal:
    return (qty * price).quantize(ROUND_CENTS)


# Transitions
TRANSITIONS = {
    "submit": {"from": {PurchaseOrderStatus.DRAFT}, "to": PurchaseOrderStatus.SUBMITTED, "roles": {Role.ADMIN, Role.PROCUREMENT_MANAGER}},
    "confirm": {"from": {PurchaseOrderStatus.SUBMITTED}, "to": PurchaseOrderStatus.SUPPLIER_CONFIRMED, "roles": {Role.SUPPLIER}},
    "reject": {"from": {PurchaseOrderStatus.SUBMITTED}, "to": PurchaseOrderStatus.REJECTED, "roles": {Role.SUPPLIER}, "need_note": True},
    "cancel": {"from": {PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.SUPPLIER_CONFIRMED}, "to": PurchaseOrderStatus.CANCELLED, "roles": {Role.ADMIN, Role.PROCUREMENT_MANAGER}, "need_note": True},
}


# Schemas
class APIModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class POLineIn(APIModel):
    component_id: int
    quantity: str
    unit_price: str


class POCreate(APIModel):
    supplier_id: int
    currency: Currency = Currency.EUR
    requested_delivery_date: date
    notes: str | None = None
    submit: bool = False
    lines: list[POLineIn] = Field(min_length=1)

    @field_validator("lines")
    @classmethod
    def _uniq(cls, lines):
        ids = [item.component_id for item in lines]
        if len(ids) != len(set(ids)):
            raise ValueError("Each component may appear only once per purchase order.")
        return lines


class POActionRequest(APIModel):
    note: str | None = None


class POLineOut(BaseModel):
    id: int
    line_number: int
    component: dict
    quantity: str
    unit_price: str
    line_total: str


class POStatusHistoryOut(BaseModel):
    id: int
    from_status: PurchaseOrderStatus | None
    to_status: PurchaseOrderStatus
    changed_at: datetime
    changed_by_name: str | None
    note: str | None


class POSummary(BaseModel):
    id: int
    po_number: str
    supplier: dict
    status: PurchaseOrderStatus
    currency: Currency
    order_date: date
    requested_delivery_date: date
    total_amount: str
    line_count: int


class PODetail(BaseModel):
    id: int
    po_number: str
    supplier: dict
    status: PurchaseOrderStatus
    currency: Currency
    order_date: date
    requested_delivery_date: date
    notes: str | None
    total_amount: str
    supplier_response_note: str | None
    submitted_at: datetime | None
    responded_at: datetime | None
    created_by_name: str | None
    created_at: datetime
    updated_at: datetime
    lines: list[POLineOut]
    status_history: list[POStatusHistoryOut]
    available_actions: list[str]
    can_edit: bool


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


app = FastAPI(title="AutoSupply Hub — Purchase Order Service", version="0.1.0")
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
    return {"status": "ok", "service": "order-service"}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "order-service"}


async def _enrich_supplier(supplier_id: int) -> dict:
    url = f"{get_common_settings().supplier_service_url}/internal/suppliers/{supplier_id}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
    except (httpx.HTTPError, Exception):
        # Graceful fallback when supplier service is unavailable
        return {"id": supplier_id, "code": f"SUP-{supplier_id}", "company_name": f"Supplier #{supplier_id}"}
    return {"id": supplier_id, "code": f"SUP-{supplier_id}", "company_name": f"Supplier #{supplier_id}"}


async def _enrich_component(component_id: int) -> dict:
    url = f"{get_common_settings().component_service_url}/internal/components/{component_id}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
    except (httpx.HTTPError, Exception):
        # Graceful fallback when component service is unavailable
        return {"id": component_id, "code": f"CMP-{component_id}", "name": f"Component #{component_id}", "unit_of_measure": "EA"}
    return {"id": component_id, "code": f"CMP-{component_id}", "name": f"Component #{component_id}", "unit_of_measure": "EA"}


@app.get("/internal/metrics")
def internal_metrics(supplier_id: int | None = None, db: Session = Depends(get_db)):
    open_statuses = [
        PurchaseOrderStatus.SUBMITTED,
        PurchaseOrderStatus.SUPPLIER_CONFIRMED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ]
    stmt = select(PurchaseOrder)
    if supplier_id is not None:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id, PurchaseOrder.status != PurchaseOrderStatus.DRAFT)

    open_stmt = stmt.where(PurchaseOrder.status.in_(open_statuses))
    open_pos = db.scalar(select(func.count()).select_from(open_stmt.subquery())) or 0

    awaiting_stmt = stmt.where(PurchaseOrder.status == PurchaseOrderStatus.SUBMITTED)
    orders_awaiting = db.scalar(select(func.count()).select_from(awaiting_stmt.subquery())) or 0

    spend_stmt = select(func.coalesce(func.sum(PurchaseOrder.total_amount), Decimal("0.00"))).select_from(PurchaseOrder).where(
        (PurchaseOrder.supplier_id == supplier_id) if supplier_id is not None else True,
        PurchaseOrder.status.in_(open_statuses),
    )
    total_spend = db.scalar(spend_stmt) or Decimal("0.00")

    hist_stmt = (
        select(PurchaseOrderStatusHistory)
        .join(PurchaseOrder)
        .order_by(PurchaseOrderStatusHistory.changed_at.desc())
        .limit(10)
    )
    if supplier_id is not None:
        hist_stmt = hist_stmt.where(PurchaseOrder.supplier_id == supplier_id)
    history_records = list(db.scalars(hist_stmt))

    recent_activity = [
        {
            "id": h.id,
            "action": f"PO_{h.to_status.value}",
            "entity_type": "PurchaseOrder",
            "entity_id": str(h.purchase_order_id),
            "details": {"from_status": h.from_status.value if h.from_status else None, "note": h.note},
            "created_at": h.changed_at.isoformat(),
            "actor_name": h.changed_by_name or "System",
        }
        for h in history_records
    ]

    return {
        "open_pos": int(open_pos),
        "orders_awaiting_confirmation": int(orders_awaiting),
        "total_spend_open": str(total_spend),
        "recent_activity": recent_activity,
    }


@app.get("/api/v1/dashboard/summary")
async def dashboard_summary(
    user: AuthUser = Depends(get_current_user_context),
    db: Session = Depends(get_db),
):
    if user.role == Role.SUPPLIER:
        metrics = internal_metrics(supplier_id=user.supplier_id, db=db)
        return {
            "open_pos": metrics["open_pos"],
            "orders_awaiting_confirmation": metrics["orders_awaiting_confirmation"],
            "total_suppliers": 1,
            "active_suppliers": 1,
            "total_components": 0,
            "total_spend_open": metrics["total_spend_open"],
            "recent_activity": metrics["recent_activity"],
        }

    metrics = internal_metrics(supplier_id=None, db=db)
    sup_metrics = {"total_suppliers": 0, "active_suppliers": 0}
    comp_metrics = {"total_components": 0}

    common_settings = get_common_settings()
    async with httpx.AsyncClient(timeout=4.0) as client:
        try:
            sup_res = await client.get(f"{common_settings.supplier_service_url}/internal/metrics")
            if sup_res.status_code == 200:
                sup_metrics = sup_res.json()
        except Exception:
            pass
        try:
            comp_res = await client.get(f"{common_settings.component_service_url}/internal/metrics")
            if comp_res.status_code == 200:
                comp_metrics = comp_res.json()
        except Exception:
            pass

    return {
        "open_pos": metrics["open_pos"],
        "orders_awaiting_confirmation": metrics["orders_awaiting_confirmation"],
        "total_suppliers": sup_metrics.get("total_suppliers", 0),
        "active_suppliers": sup_metrics.get("active_suppliers", 0),
        "total_components": comp_metrics.get("total_components", 0),
        "total_spend_open": metrics["total_spend_open"],
        "recent_activity": metrics["recent_activity"],
    }


@app.get("/api/v1/purchase-orders", response_model=Page[POSummary])
async def list_pos(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: PurchaseOrderStatus | None = None,
    q: str | None = None,
    _: AuthUser = Depends(require_permission(Permission.PURCHASE_ORDERS_READ)),
):
    stmt = select(PurchaseOrder)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(PurchaseOrder.supplier_id == user.supplier_id, PurchaseOrder.status != PurchaseOrderStatus.DRAFT)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    if q:
        stmt = stmt.where(PurchaseOrder.po_number.ilike(f"%{q.strip()}%"))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    orders = list(db.scalars(stmt.order_by(PurchaseOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size)))

    items = []
    for po in orders:
        sup_ref = await _enrich_supplier(po.supplier_id)
        items.append(
            POSummary(
                id=po.id,
                po_number=po.po_number,
                supplier=sup_ref,
                status=po.status,
                currency=po.currency,
                order_date=po.order_date,
                requested_delivery_date=po.requested_delivery_date,
                total_amount=str(po.total_amount),
                line_count=len(po.lines),
            )
        )
    return Page[POSummary](items=items, total=int(total), page=page, page_size=page_size)


@app.get("/api/v1/purchase-orders/{po_id}", response_model=PODetail)
async def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    _: AuthUser = Depends(require_permission(Permission.PURCHASE_ORDERS_READ)),
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(PurchaseOrder.supplier_id == user.supplier_id, PurchaseOrder.status != PurchaseOrderStatus.DRAFT)
    po = db.scalar(stmt)
    if not po:
        raise NotFoundError("Purchase order not found.")

    sup_ref = await _enrich_supplier(po.supplier_id)
    enriched_lines = []
    for line in po.lines:
        comp_ref = await _enrich_component(line.component_id)
        enriched_lines.append(
            POLineOut(
                id=line.id,
                line_number=line.line_number,
                component=comp_ref,
                quantity=str(line.quantity),
                unit_price=str(line.unit_price),
                line_total=str(line.line_total),
            )
        )

    # Available actions based on role and status
    avail = []
    for act, conf in TRANSITIONS.items():
        if po.status in conf["from"] and user.role in conf["roles"]:
            avail.append(act)

    return PODetail(
        id=po.id,
        po_number=po.po_number,
        supplier=sup_ref,
        status=po.status,
        currency=po.currency,
        order_date=po.order_date,
        requested_delivery_date=po.requested_delivery_date,
        notes=po.notes,
        total_amount=str(po.total_amount),
        supplier_response_note=po.supplier_response_note,
        submitted_at=po.submitted_at,
        responded_at=po.responded_at,
        created_by_name=po.created_by_name,
        created_at=po.created_at,
        updated_at=po.updated_at,
        lines=enriched_lines,
        status_history=[
            POStatusHistoryOut(
                id=h.id,
                from_status=h.from_status,
                to_status=h.to_status,
                changed_at=h.changed_at,
                changed_by_name=h.changed_by_name,
                note=h.note,
            )
            for h in po.status_history
        ],
        available_actions=avail,
        can_edit=po.status == PurchaseOrderStatus.DRAFT and user.role in {Role.ADMIN, Role.PROCUREMENT_MANAGER},
    )


@app.post("/api/v1/purchase-orders", response_model=PODetail, status_code=status.HTTP_201_CREATED)
async def create_po(
    data: POCreate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    _: AuthUser = Depends(require_permission(Permission.PURCHASE_ORDERS_WRITE)),
):
    if idempotency_key:
        existing = db.scalar(select(PurchaseOrder).where(PurchaseOrder.created_by_id == user.id, PurchaseOrder.idempotency_key == idempotency_key))
        if existing:
            return await get_po(existing.id, db, user, _)

    today = date.today()
    if data.requested_delivery_date < today:
        raise BusinessRuleError("Requested delivery date cannot be in the past.")

    # Calculate lines
    total = Decimal("0.00")
    db_lines = []
    for idx, item in enumerate(data.lines, start=1):
        q = Decimal(item.quantity)
        p = Decimal(item.unit_price)
        if q <= 0:
            raise BusinessRuleError("Quantity must be greater than zero.")
        if p < 0:
            raise BusinessRuleError("Unit price cannot be negative.")
        lt = calc_line_total(q, p)
        total += lt
        db_lines.append(
            PurchaseOrderLine(
                line_number=idx,
                component_id=item.component_id,
                quantity=q,
                unit_price=p,
                line_total=lt,
            )
        )

    # Generate PO number
    today_str = datetime.now(UTC).strftime("%Y%m%d")
    seq = (db.scalar(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.order_date == today)) or 0) + 1
    po_number = f"PO-{today_str}-{seq:04d}"

    st = PurchaseOrderStatus.SUBMITTED if data.submit else PurchaseOrderStatus.DRAFT
    now = datetime.now(UTC)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=data.supplier_id,
        status=st,
        currency=data.currency,
        order_date=today,
        requested_delivery_date=data.requested_delivery_date,
        notes=data.notes,
        total_amount=total,
        created_by_id=user.id,
        created_by_name=user.full_name or "Procurement",
        idempotency_key=idempotency_key,
        submitted_at=now if data.submit else None,
    )
    po.lines = db_lines
    po.status_history = [
        PurchaseOrderStatusHistory(
            from_status=None,
            to_status=st,
            changed_by_id=user.id,
            changed_by_name=user.full_name,
            changed_at=now,
            note="Created" + (" and submitted." if data.submit else " as draft."),
        )
    ]
    db.add(po)
    db.commit()
    db.refresh(po)
    return await get_po(po.id, db, user, _)


@app.post("/api/v1/purchase-orders/{po_id}/actions/{action}", response_model=PODetail)
async def execute_action(
    po_id: int,
    action: str,
    payload: POActionRequest,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user_context),
    _: AuthUser = Depends(require_any_permission(Permission.PURCHASE_ORDERS_WRITE, Permission.PURCHASE_ORDERS_RESPOND)),
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    if user.role == Role.SUPPLIER:
        stmt = stmt.where(PurchaseOrder.supplier_id == user.supplier_id)
    po = db.scalar(stmt)
    if not po:
        raise NotFoundError("Purchase order not found.")

    if action not in TRANSITIONS:
        raise BusinessRuleError(f"Unknown action '{action}'.")

    conf = TRANSITIONS[action]
    if user.role not in conf["roles"]:
        raise PermissionDeniedError(f"Your role cannot execute '{action}'.")
    if po.status not in conf["from"]:
        raise InvalidStatusTransitionError(f"Cannot execute '{action}' on PO in status {po.status.value}.")
    if conf.get("need_note") and not (payload.note and payload.note.strip()):
        raise BusinessRuleError(f"A note or reason is required to {action} a purchase order.")

    now = datetime.now(UTC)
    old_status = po.status
    new_status = conf["to"]
    po.status = new_status

    if action == "submit":
        po.submitted_at = now
    elif action in {"confirm", "reject"}:
        po.responded_at = now
        po.supplier_response_note = payload.note

    hist = PurchaseOrderStatusHistory(
        purchase_order_id=po.id,
        from_status=old_status,
        to_status=new_status,
        changed_by_id=user.id,
        changed_by_name=user.full_name or "User",
        changed_at=now,
        note=payload.note,
    )
    db.add(hist)
    db.commit()
    db.refresh(po)
    return await get_po(po.id, db, user, _)
