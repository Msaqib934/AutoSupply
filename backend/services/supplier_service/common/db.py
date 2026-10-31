"""Dynamic SQLAlchemy engine and session factory for service-specific databases."""

from collections.abc import Iterator
from datetime import UTC, datetime
import os
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import DateTime, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


def load_env_file(paths: list[str | Path] | None = None) -> None:
    """Load key-value pairs from .env files into os.environ without overriding existing vars."""
    if paths is None:
        paths = [".env", "../.env", "../../.env"]
    for p in paths:
        path = Path(p)
        if path.is_file():
            try:
                for line in path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
            except OSError:
                continue


def resolve_db_password(
    password_file_env: str = "DB_PASSWORD_FILE",
    default_file_path: str = "/mnt/secrets-store/db_password",
    fallback_password_env: str = "DB_PASSWORD",
    default_password: str = "autosupply",
) -> str:
    """Read password from mounted secret file if it exists, otherwise fallback to env."""
    file_path_str = os.getenv(password_file_env, default_file_path)
    if file_path_str:
        file_path = Path(file_path_str)
        if file_path.is_file():
            try:
                content = file_path.read_text(encoding="utf-8").strip()
                if content:
                    return content
            except OSError:
                pass
    return os.getenv(fallback_password_env, default_password)


def get_database_url(
    default_db_name: str,
    service_prefix: str = "",
) -> str:
    """Dynamically construct database URL.

    Checks:
    1. Service-specific explicit DATABASE_URL (e.g. COMPONENT_DATABASE_URL).
    2. Composed URL from DB_HOST, DB_USER, DB_PORT, DB_NAME, and volume-mounted/env password.
    3. Generic DATABASE_URL.
    4. Fallback localhost development URL.
    """
    load_env_file()

    # 1. Service-specific explicit URL override
    if service_prefix:
        service_url = os.getenv(f"{service_prefix}DATABASE_URL")
        if service_url:
            return service_url

    # 2. Check individual connection variables
    db_host = os.getenv(f"{service_prefix}DB_HOST", os.getenv("DB_HOST"))
    if db_host:
        db_user = os.getenv(f"{service_prefix}DB_USER", os.getenv("DB_USER", "postgres"))
        db_port = os.getenv(f"{service_prefix}DB_PORT", os.getenv("DB_PORT", "5432"))
        db_name = os.getenv(
            f"{service_prefix}DB_NAME",
            os.getenv("DB_NAME", default_db_name),
        )
        db_password = resolve_db_password()
        safe_user = quote_plus(db_user)
        safe_password = quote_plus(db_password)
        return f"postgresql+psycopg://{safe_user}:{safe_password}@{db_host}:{db_port}/{db_name}"

    # 3. Generic DATABASE_URL
    generic_url = os.getenv("DATABASE_URL")
    if generic_url:
        return generic_url

    # 4. Fallback localhost connection
    db_password = resolve_db_password()
    safe_password = quote_plus(db_password)
    return f"postgresql+psycopg://autosupply:{safe_password}@localhost:5432/{default_db_name}"


def create_db_helpers(database_url: str):
    engine = create_engine(database_url, pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def get_db() -> Iterator[Session]:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    return engine, SessionLocal, get_db
