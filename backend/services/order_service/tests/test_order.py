from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

try:
    from services.order_service.common.db import create_db_helpers
    from services.order_service.common.permissions import Role
    from services.order_service.common.security import create_access_token
    from services.order_service.main import (
        Base,
        PurchaseOrder,
        PurchaseOrderStatus,
        app,
        calc_line_total,
        get_db,
    )
except ImportError:
    from common.db import create_db_helpers
    from common.permissions import Role
    from common.security import create_access_token
    from main import (
        Base,
        PurchaseOrder,
        PurchaseOrderStatus,
        app,
        calc_line_total,
        get_db,
    )

ORDER_TEST_URL = "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_order_test"


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    eng = create_engine(ORDER_TEST_URL)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def order_client():
    _, SessionLocal, _ = create_db_helpers(ORDER_TEST_URL)

    def override():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_order_lifecycle_and_calculations(order_client):
    procure_token = create_access_token(
        "2",
        {
            "role": Role.PROCUREMENT_MANAGER.value,
            "email": "procure@autosupply.local",
            "full_name": "Procure Manager",
        },
    )
    procure_headers = {"Authorization": f"Bearer {procure_token}"}

    # Line item calculation math test: 3 units @ 12.3456 = 37.0368 -> rounded to 37.04
    lt = calc_line_total(Decimal("3"), Decimal("12.3456"))
    assert str(lt) == "37.04"

    # Create PO in DRAFT
    create_payload = {
        "supplier_id": 1,
        "currency": "EUR",
        "requested_delivery_date": "2026-11-01",
        "notes": "Test batch order",
        "submit": False,
        "lines": [
            {"component_id": 1, "quantity": "3.000", "unit_price": "12.3456"},
            {"component_id": 2, "quantity": "10.000", "unit_price": "50.0000"},
        ],
    }
    po_res = order_client.post(
        "/api/v1/purchase-orders", json=create_payload, headers=procure_headers
    )
    assert po_res.status_code == 201
    po = po_res.json()
    assert po["status"] == "DRAFT"
    # Total: 37.04 + 500.00 = 537.04
    assert po["total_amount"] == "537.04"
    po_id = po["id"]

    # Submit action
    sub_res = order_client.post(
        f"/api/v1/purchase-orders/{po_id}/actions/submit",
        json={"note": "Ready for supplier"},
        headers=procure_headers,
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "SUBMITTED"

    # Supplier confirmation
    sup_token = create_access_token(
        "3",
        {
            "role": Role.SUPPLIER.value,
            "supplier_id": 1,
            "email": "sup@autosupply.local",
            "full_name": "Supplier Rep",
        },
    )
    sup_headers = {"Authorization": f"Bearer {sup_token}"}

    conf_res = order_client.post(
        f"/api/v1/purchase-orders/{po_id}/actions/confirm",
        json={"note": "Confirmed on schedule"},
        headers=sup_headers,
    )
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "SUPPLIER_CONFIRMED"

    # Verification: Cancellation from confirmed state requires a note
    cancel_res_no_note = order_client.post(
        f"/api/v1/purchase-orders/{po_id}/actions/cancel",
        json={"note": ""},
        headers=procure_headers,
    )
    assert cancel_res_no_note.status_code == 422 or cancel_res_no_note.status_code == 400


def test_dashboard_summary():
    client = TestClient(app)
    admin_token = create_access_token(
        "1",
        {
            "role": Role.ADMIN.value,
            "supplier_id": None,
            "email": "admin@autosupply.local",
            "full_name": "Admin User",
        },
    )
    res = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "open_pos" in data
    assert "total_spend_open" in data
    assert "recent_activity" in data
