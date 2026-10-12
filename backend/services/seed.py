"""Microservices database seeder for local development."""

import os
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

try:
    from services.auth_service.common.db import create_db_helpers
    from services.auth_service.common.permissions import Role
    from services.auth_service.common.security import hash_password
except ImportError:
    from .auth_service.common.db import create_db_helpers
    from .auth_service.common.permissions import Role
    from .auth_service.common.security import hash_password
from services.auth_service.main import Base as AuthBase
from services.auth_service.main import User
from services.component_service.main import Base as CompBase
from services.component_service.main import Component, UnitOfMeasure
from services.order_service.main import (
    Base as OrderBase,
)
from services.order_service.main import (
    Currency,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    PurchaseOrderStatusHistory,
    calc_line_total,
)
from services.supplier_service.main import Base as SupBase
from services.supplier_service.main import Supplier, SupplierStatus


def seed_all():
    print("Initializing schemas and seeding microservice databases...")

    sup_url = os.getenv("SUPPLIER_DATABASE_URL", os.getenv("DATABASE_URL", "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_supplier"))
    _, SupSession, _ = create_db_helpers(sup_url)
    sup_engine = SupSession.kw["bind"]
    SupBase.metadata.create_all(bind=sup_engine)

    with SupSession() as db:
        if not db.scalar(select(Supplier.id).limit(1)):
            print("Seeding suppliers...")
            suppliers = [
                Supplier(
                    code="SUP-APEX",
                    company_name="Apex Dynamics GmbH",
                    contact_name="Klaus Weber",
                    email="klaus.weber@apexdynamics.de",
                    phone="+49 711 555 0192",
                    address="Industriestrasse 42",
                    city="Stuttgart",
                    country="Germany",
                    lead_time_days=10,
                    status=SupplierStatus.ACTIVE,
                    notes="Primary chassis and precision components partner.",
                ),
                Supplier(
                    code="SUP-MOTO",
                    company_name="MotoPowertrain Technologies",
                    contact_name="Kenji Sato",
                    email="kenji.sato@motopowertrain.jp",
                    phone="+81 3 5550 4821",
                    address="4-12-1 Chiyoda-ku",
                    city="Tokyo",
                    country="Japan",
                    lead_time_days=18,
                    status=SupplierStatus.ACTIVE,
                    notes="High-displacement motorcycle engine specialist.",
                ),
                Supplier(
                    code="SUP-BREM",
                    company_name="BremTech Braking Systems",
                    contact_name="Matteo Rossi",
                    email="matteo.rossi@bremtech.it",
                    phone="+39 035 555 9301",
                    address="Via dell'Innovazione 15",
                    city="Bergamo",
                    country="Italy",
                    lead_time_days=12,
                    status=SupplierStatus.ACTIVE,
                    notes="OEM brake caliper and disc assemblies.",
                ),
                Supplier(
                    code="SUP-ELECT",
                    company_name="ElectroVolt Energy Solutions",
                    contact_name="Mei-Ling Chen",
                    email="mei.chen@electrovolt.tw",
                    phone="+886 2 2555 8310",
                    address="88 Hsinchu Science Park",
                    city="Hsinchu",
                    country="Taiwan",
                    lead_time_days=7,
                    status=SupplierStatus.ACTIVE,
                    notes="Lithium-ion batteries and power electronics.",
                ),
                Supplier(
                    code="SUP-RUBBER",
                    company_name="Continental Treadworks S.A.",
                    contact_name="Claire Dubois",
                    email="claire.dubois@treadworks.fr",
                    phone="+33 4 73 55 2100",
                    address="12 Rue des Pneumatiques",
                    city="Clermont-Ferrand",
                    country="France",
                    lead_time_days=14,
                    status=SupplierStatus.UNDER_REVIEW,
                    notes="Tyre manufacturer under ISO quality re-certification.",
                ),
            ]
            db.add_all(suppliers)
            db.commit()

    comp_url = os.getenv("COMPONENT_DATABASE_URL", os.getenv("DATABASE_URL", "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_component"))
    _, CompSession, _ = create_db_helpers(comp_url)
    comp_engine = CompSession.kw["bind"]
    CompBase.metadata.create_all(bind=comp_engine)

    with CompSession() as db:
        if not db.scalar(select(Component.id).limit(1)):
            print("Seeding components...")
            components = [
                Component(
                    code="ENG-001",
                    name="Motorcycle Engine Assembly (750cc Twin)",
                    description="Four-stroke liquid-cooled parallel-twin motorcycle engine with 6-speed transmission.",
                    category="Powertrain",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("15.000"),
                    preferred_supplier_id=2,
                    is_active=True,
                ),
                Component(
                    code="FRM-001",
                    name="Trellis Motorcycle Frame Assembly",
                    description="High-tensile tubular steel trellis frame with powder-coated finish.",
                    category="Chassis & Frame",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("20.000"),
                    preferred_supplier_id=1,
                    is_active=True,
                ),
                Component(
                    code="WHL-001",
                    name="Front Wheel Assembly (17-inch Alloy)",
                    description="Cast lightweight aluminum-alloy 17-inch wheel hub with sealed bearings.",
                    category="Wheels & Suspension",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("25.000"),
                    preferred_supplier_id=1,
                    is_active=True,
                ),
                Component(
                    code="TYR-001",
                    name="High-Grip Radial Tyre 120/70 ZR17",
                    description="All-weather radial road tyre with dual-compound silica tread.",
                    category="Wheels & Suspension",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("50.000"),
                    preferred_supplier_id=5,
                    is_active=True,
                ),
                Component(
                    code="BRK-001",
                    name="Dual Radial Brake Caliper & Disc Set",
                    description="Four-piston radial monobloc calipers with floating 320mm stainless steel discs.",
                    category="Brakes",
                    unit_of_measure=UnitOfMeasure.SET,
                    reorder_threshold=Decimal("30.000"),
                    preferred_supplier_id=3,
                    is_active=True,
                ),
                Component(
                    code="BAT-001",
                    name="12V 10Ah Lithium Iron Phosphate Battery",
                    description="Lightweight high-cranking motorcycle battery with integrated BMS.",
                    category="Electrical",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("25.000"),
                    preferred_supplier_id=4,
                    is_active=True,
                ),
                Component(
                    code="WIR-001",
                    name="Main Vehicle Wiring Harness",
                    description="Automotive CAN-bus wiring harness with weatherproof automotive connectors.",
                    category="Electrical",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("20.000"),
                    preferred_supplier_id=4,
                    is_active=True,
                ),
                Component(
                    code="SEA-001",
                    name="Ergonomic Dual Seat Assembly",
                    description="High-density foam saddle with waterproof non-slip textured cover.",
                    category="Body & Ergonomics",
                    unit_of_measure=UnitOfMeasure.EA,
                    reorder_threshold=Decimal("20.000"),
                    preferred_supplier_id=1,
                    is_active=True,
                ),
            ]
            db.add_all(components)
            db.commit()

    auth_url = os.getenv("AUTH_DATABASE_URL", os.getenv("DATABASE_URL", "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_auth"))
    _, AuthSession, _ = create_db_helpers(auth_url)
    auth_engine = AuthSession.kw["bind"]
    AuthBase.metadata.create_all(bind=auth_engine)

    with AuthSession() as db:
        if not db.scalar(select(User.id).limit(1)):
            print("Seeding users...")
            users = [
                User(
                    email="admin@autosupply.local",
                    full_name="Sarah Jenkins (Admin)",
                    hashed_password=hash_password("AdminPass123!"),
                    role=Role.ADMIN,
                    is_active=True,
                ),
                User(
                    email="procurement@autosupply.local",
                    full_name="Marcus Vance (Procurement)",
                    hashed_password=hash_password("ProcurePass123!"),
                    role=Role.PROCUREMENT_MANAGER,
                    is_active=True,
                ),
                User(
                    email="apex.supplier@autosupply.local",
                    full_name="Klaus Weber (Apex Rep)",
                    hashed_password=hash_password("SupplierPass123!"),
                    role=Role.SUPPLIER,
                    supplier_id=1,
                    is_active=True,
                ),
                User(
                    email="moto.supplier@autosupply.local",
                    full_name="Kenji Sato (MotoPowertrain Rep)",
                    hashed_password=hash_password("SupplierPass123!"),
                    role=Role.SUPPLIER,
                    supplier_id=2,
                    is_active=True,
                ),
                User(
                    email="planner@autosupply.local",
                    full_name="Elena Rostova (Production Planner)",
                    hashed_password=hash_password("PlannerPass123!"),
                    role=Role.PRODUCTION_PLANNER,
                    is_active=True,
                ),
                User(
                    email="warehouse@autosupply.local",
                    full_name="David Chen (Warehouse)",
                    hashed_password=hash_password("WarehousePass123!"),
                    role=Role.WAREHOUSE_OPERATOR,
                    is_active=True,
                ),
                User(
                    email="quality@autosupply.local",
                    full_name="Ingrid Bergman (Quality)",
                    hashed_password=hash_password("QualityPass123!"),
                    role=Role.QUALITY_INSPECTOR,
                    is_active=True,
                ),
                User(
                    email="finance@autosupply.local",
                    full_name="Alicia Gomez (Finance)",
                    hashed_password=hash_password("FinancePass123!"),
                    role=Role.FINANCE_OFFICER,
                    is_active=True,
                ),
                User(
                    email="auditor@autosupply.local",
                    full_name="James Wright (Auditor)",
                    hashed_password=hash_password("AuditorPass123!"),
                    role=Role.VIEWER,
                    is_active=True,
                ),
            ]
            db.add_all(users)
            db.commit()

    order_url = os.getenv("ORDER_DATABASE_URL", os.getenv("DATABASE_URL", "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_order"))
    _, OrderSession, _ = create_db_helpers(order_url)
    order_engine = OrderSession.kw["bind"]
    OrderBase.metadata.create_all(bind=order_engine)

    with OrderSession() as db:
        if not db.scalar(select(PurchaseOrder.id).limit(1)):
            print("Seeding purchase orders...")
            now = datetime.now(UTC)
            today = date.today()

            # PO 1: Apex Dynamics - Confirmed
            l1 = PurchaseOrderLine(
                line_number=1,
                component_id=2,  # FRM-001
                quantity=Decimal("50.000"),
                unit_price=Decimal("450.0000"),
                line_total=calc_line_total(Decimal("50.000"), Decimal("450.0000")),
            )
            l2 = PurchaseOrderLine(
                line_number=2,
                component_id=3,  # WHL-001
                quantity=Decimal("100.000"),
                unit_price=Decimal("125.0000"),
                line_total=calc_line_total(Decimal("100.000"), Decimal("125.0000")),
            )
            po1 = PurchaseOrder(
                po_number="PO-20261011-0001",
                supplier_id=1,
                status=PurchaseOrderStatus.SUPPLIER_CONFIRMED,
                currency=Currency.EUR,
                order_date=today - timedelta(days=5),
                requested_delivery_date=today + timedelta(days=15),
                notes="Priority production batch for Autumn 2026 build.",
                total_amount=l1.line_total + l2.line_total,
                created_by_id=2,
                created_by_name="Marcus Vance (Procurement)",
                submitted_at=now - timedelta(days=4),
                responded_at=now - timedelta(days=3),
                supplier_response_note="Delivery scheduled on time for Nov 1.",
            )
            po1.lines = [l1, l2]
            po1.status_history = [
                PurchaseOrderStatusHistory(
                    from_status=None,
                    to_status=PurchaseOrderStatus.DRAFT,
                    changed_by_id=2,
                    changed_by_name="Marcus Vance",
                    changed_at=now - timedelta(days=5),
                    note="Created draft PO.",
                ),
                PurchaseOrderStatusHistory(
                    from_status=PurchaseOrderStatus.DRAFT,
                    to_status=PurchaseOrderStatus.SUBMITTED,
                    changed_by_id=2,
                    changed_by_name="Marcus Vance",
                    changed_at=now - timedelta(days=4),
                    note="Submitted to Apex Dynamics.",
                ),
                PurchaseOrderStatusHistory(
                    from_status=PurchaseOrderStatus.SUBMITTED,
                    to_status=PurchaseOrderStatus.SUPPLIER_CONFIRMED,
                    changed_by_id=3,
                    changed_by_name="Klaus Weber",
                    changed_at=now - timedelta(days=3),
                    note="Accepted order confirmation.",
                ),
            ]
            db.add(po1)

            # PO 2: MotoPowertrain - Submitted
            l3 = PurchaseOrderLine(
                line_number=1,
                component_id=1,  # ENG-001
                quantity=Decimal("20.000"),
                unit_price=Decimal("2400.0000"),
                line_total=calc_line_total(Decimal("20.000"), Decimal("2400.0000")),
            )
            po2 = PurchaseOrder(
                po_number="PO-20261011-0002",
                supplier_id=2,
                status=PurchaseOrderStatus.SUBMITTED,
                currency=Currency.JPY,
                order_date=today - timedelta(days=2),
                requested_delivery_date=today + timedelta(days=20),
                notes="Initial twin-cylinder batch for assembly line 1.",
                total_amount=l3.line_total,
                created_by_id=2,
                created_by_name="Marcus Vance (Procurement)",
                submitted_at=now - timedelta(days=1),
            )
            po2.lines = [l3]
            po2.status_history = [
                PurchaseOrderStatusHistory(
                    from_status=None,
                    to_status=PurchaseOrderStatus.SUBMITTED,
                    changed_by_id=2,
                    changed_by_name="Marcus Vance",
                    changed_at=now - timedelta(days=1),
                    note="Created and submitted to MotoPowertrain.",
                )
            ]
            db.add(po2)

            # PO 3: BremTech - Draft
            l4 = PurchaseOrderLine(
                line_number=1,
                component_id=5,  # BRK-001
                quantity=Decimal("30.000"),
                unit_price=Decimal("340.0000"),
                line_total=calc_line_total(Decimal("30.000"), Decimal("340.0000")),
            )
            po3 = PurchaseOrder(
                po_number="PO-20261011-0003",
                supplier_id=3,
                status=PurchaseOrderStatus.DRAFT,
                currency=Currency.EUR,
                order_date=today,
                requested_delivery_date=today + timedelta(days=14),
                notes="Quarterly brake caliper replenishments.",
                total_amount=l4.line_total,
                created_by_id=2,
                created_by_name="Marcus Vance (Procurement)",
            )
            po3.lines = [l4]
            po3.status_history = [
                PurchaseOrderStatusHistory(
                    from_status=None,
                    to_status=PurchaseOrderStatus.DRAFT,
                    changed_by_id=2,
                    changed_by_name="Marcus Vance",
                    changed_at=now,
                    note="Initial draft created.",
                )
            ]
            db.add(po3)

            # PO 4: ElectroVolt - Received
            l5 = PurchaseOrderLine(
                line_number=1,
                component_id=6,  # BAT-001
                quantity=Decimal("40.000"),
                unit_price=Decimal("180.0000"),
                line_total=calc_line_total(Decimal("40.000"), Decimal("180.0000")),
            )
            l6 = PurchaseOrderLine(
                line_number=2,
                component_id=7,  # WIR-001
                quantity=Decimal("40.000"),
                unit_price=Decimal("95.0000"),
                line_total=calc_line_total(Decimal("40.000"), Decimal("95.0000")),
            )
            po4 = PurchaseOrder(
                po_number="PO-20261011-0004",
                supplier_id=4,
                status=PurchaseOrderStatus.RECEIVED,
                currency=Currency.USD,
                order_date=today - timedelta(days=20),
                requested_delivery_date=today - timedelta(days=2),
                notes="Delivered to warehouse dock 3.",
                total_amount=l5.line_total + l6.line_total,
                created_by_id=2,
                created_by_name="Marcus Vance (Procurement)",
                submitted_at=now - timedelta(days=19),
                responded_at=now - timedelta(days=18),
                supplier_response_note="Goods dispatched via air freight.",
            )
            po4.lines = [l5, l6]
            po4.status_history = [
                PurchaseOrderStatusHistory(
                    from_status=None,
                    to_status=PurchaseOrderStatus.SUBMITTED,
                    changed_by_id=2,
                    changed_by_name="Marcus Vance",
                    changed_at=now - timedelta(days=19),
                    note="Submitted.",
                ),
                PurchaseOrderStatusHistory(
                    from_status=PurchaseOrderStatus.SUBMITTED,
                    to_status=PurchaseOrderStatus.SUPPLIER_CONFIRMED,
                    changed_by_id=4,
                    changed_by_name="Mei-Ling Chen",
                    changed_at=now - timedelta(days=18),
                    note="Confirmed.",
                ),
                PurchaseOrderStatusHistory(
                    from_status=PurchaseOrderStatus.SUPPLIER_CONFIRMED,
                    to_status=PurchaseOrderStatus.RECEIVED,
                    changed_by_id=6,
                    changed_by_name="David Chen",
                    changed_at=now - timedelta(days=2),
                    note="Goods received in full.",
                ),
            ]
            db.add(po4)

            db.commit()

    print("All microservices seeded successfully!")


if __name__ == "__main__":
    seed_all()
