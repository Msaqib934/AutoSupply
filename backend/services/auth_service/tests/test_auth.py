import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

try:
    from services.auth_service.common.db import create_db_helpers
    from services.auth_service.common.permissions import Role
    from services.auth_service.common.security import hash_password
    from services.auth_service.main import Base, User, app, get_db
except ImportError:
    from common.db import create_db_helpers
    from common.permissions import Role
    from common.security import hash_password
    from main import Base, User, app, get_db

AUTH_TEST_URL = "postgresql+psycopg://autosupply:autosupply@localhost:5432/autosupply_auth_test"


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    eng = create_engine(AUTH_TEST_URL)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def auth_client():
    _, SessionLocal, _ = create_db_helpers(AUTH_TEST_URL)

    def override():
        with SessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_auth_login_and_me(auth_client):
    _, SessionLocal, _ = create_db_helpers(AUTH_TEST_URL)
    with SessionLocal() as db:
        user = User(
            email="test.procure@autosupply.local",
            full_name="Test Officer",
            hashed_password=hash_password("SecurePassword123!"),
            role=Role.PROCUREMENT_MANAGER,
        )
        db.add(user)
        db.commit()

    res_bad = auth_client.post(
        "/api/v1/auth/login",
        json={"email": "test.procure@autosupply.local", "password": "WrongPassword!"},
    )
    assert res_bad.status_code == 401

    res_ok = auth_client.post(
        "/api/v1/auth/login",
        json={"email": "test.procure@autosupply.local", "password": "SecurePassword123!"},
    )
    assert res_ok.status_code == 200
    token = res_ok.json()["access_token"]
    assert token

    me_res = auth_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    body = me_res.json()
    assert body["email"] == "test.procure@autosupply.local"
    assert body["role"] == "PROCUREMENT_MANAGER"
    assert "purchase_orders:write" in body["permissions"]
