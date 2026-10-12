import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

try:
    from services.component_service.common.db import create_db_helpers
    from services.component_service.common.permissions import Role
    from services.component_service.common.security import create_access_token
    from services.component_service.main import Base, Component, app, get_db
except ImportError:
    from common.db import create_db_helpers
    from common.permissions import Role
    from common.security import create_access_token
    from main import Base, Component, app, get_db

COMP_TEST_URL = "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_component_test"


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    eng = create_engine(COMP_TEST_URL)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def comp_client():
    _, SessionLocal, _ = create_db_helpers(COMP_TEST_URL)

    def override():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_component_crud_and_lookup(comp_client):
    admin_token = create_access_token(
        "1",
        {
            "role": Role.ADMIN.value,
            "email": "admin@autosupply.local",
            "full_name": "Admin User",
        },
    )
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create component
    res = comp_client.post(
        "/api/v1/components",
        json={
            "code": "CMP-TEST-100",
            "name": "Titanium Connecting Rod",
            "category": "Powertrain",
            "unit_of_measure": "EA",
            "reorder_threshold": "10.000",
        },
        headers=headers,
    )
    assert res.status_code == 201
    comp_id = res.json()["id"]

    # Internal lookup
    lookup = comp_client.get(f"/internal/components/{comp_id}")
    assert lookup.status_code == 200
    assert lookup.json()["code"] == "CMP-TEST-100"
