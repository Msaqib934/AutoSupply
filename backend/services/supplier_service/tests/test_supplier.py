import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

try:
    from services.supplier_service.common.db import create_db_helpers
    from services.supplier_service.common.permissions import Role
    from services.supplier_service.common.security import create_access_token
    from services.supplier_service.main import Base, Supplier, app, get_db
except ImportError:
    from common.db import create_db_helpers
    from common.permissions import Role
    from common.security import create_access_token
    from main import Base, Supplier, app, get_db

SUP_TEST_URL = "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_supplier_test"


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    eng = create_engine(SUP_TEST_URL)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def sup_client():
    _, SessionLocal, _ = create_db_helpers(SUP_TEST_URL)

    def override():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_supplier_crud_and_isolation(sup_client):
    admin_token = create_access_token(
        "1", {"role": Role.ADMIN.value, "email": "admin@autosupply.local", "full_name": "Admin"}
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create Supplier A
    res_a = sup_client.post(
        "/api/v1/suppliers",
        json={
            "code": "SUP-TESTA",
            "company_name": "Supplier Alpha",
            "country": "Germany",
            "lead_time_days": 10,
        },
        headers=admin_headers,
    )
    assert res_a.status_code == 201
    sup_a = res_a.json()

    # Create Supplier B
    res_b = sup_client.post(
        "/api/v1/suppliers",
        json={
            "code": "SUP-TESTB",
            "company_name": "Supplier Beta",
            "country": "Italy",
            "lead_time_days": 15,
        },
        headers=admin_headers,
    )
    assert res_b.status_code == 201
    sup_b = res_b.json()

    # Duplicate code should return 409
    res_dup = sup_client.post(
        "/api/v1/suppliers",
        json={
            "code": "SUP-TESTA",
            "company_name": "Duplicate Alpha",
            "country": "Germany",
        },
        headers=admin_headers,
    )
    assert res_dup.status_code == 409

    # Supplier isolation test: Supplier Alpha user querying suppliers list
    alpha_token = create_access_token(
        "10",
        {
            "role": Role.SUPPLIER.value,
            "supplier_id": sup_a["id"],
            "email": "alpha@sup.com",
            "full_name": "Alpha User",
        },
    )
    alpha_headers = {"Authorization": f"Bearer {alpha_token}"}

    list_res = sup_client.get("/api/v1/suppliers", headers=alpha_headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == sup_a["id"]

    # Alpha user trying to get Beta profile directly must get 404 (not 403) to prevent enumeration
    res_cross = sup_client.get(f"/api/v1/suppliers/{sup_b['id']}", headers=alpha_headers)
    assert res_cross.status_code == 404
