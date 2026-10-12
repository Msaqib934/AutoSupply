"""Password hashing and JWT access tokens shared across microservices."""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

try:
    from .config import get_common_settings
except (ImportError, ValueError):
    from common.config import get_common_settings

_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(_BCRYPT_ROUNDS)).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt(_BCRYPT_ROUNDS)).decode("ascii")


def dummy_verify() -> None:
    verify_password("not-the-password", _DUMMY_HASH)


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    settings = get_common_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
        "typ": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_common_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp", "iat"]},
    )
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload
