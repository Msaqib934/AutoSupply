"""Common authentication and request scoping dependencies for microservices."""


import jwt
from fastapi import Depends, Request
from pydantic import BaseModel

try:
    from .config import get_common_settings
    from .errors import AuthenticationError, PermissionDeniedError
    from .permissions import Permission, Role, has_permission
    from .security import decode_access_token
except (ImportError, ValueError):
    from common.config import get_common_settings
    from common.errors import AuthenticationError, PermissionDeniedError
    from common.permissions import Permission, Role, has_permission
    from common.security import decode_access_token

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
CSRF_HEADER = "X-Requested-With"


class AuthUser(BaseModel):
    id: int
    role: Role
    supplier_id: int | None = None
    email: str = ""
    full_name: str = ""


def _extract_token(request: Request) -> tuple[str | None, bool]:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip(), False
    cookie = request.cookies.get(get_common_settings().session_cookie_name)
    return (cookie, True) if cookie else (None, False)


def get_current_user_context(request: Request) -> AuthUser:
    token, from_cookie = _extract_token(request)
    if not token:
        raise AuthenticationError("Authentication required.")

    if from_cookie and request.method not in _SAFE_METHODS and not request.headers.get(CSRF_HEADER):
        raise PermissionDeniedError("Missing CSRF header.", code="CSRF_CHECK_FAILED")

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        role = Role(payload.get("role", "VIEWER"))
        supplier_id = payload.get("supplier_id")
        email = payload.get("email", "")
        full_name = payload.get("full_name", "")
        return AuthUser(
            id=user_id,
            role=role,
            supplier_id=supplier_id,
            email=email,
            full_name=full_name,
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AuthenticationError("Invalid or expired session.") from exc


def require_permission(permission: Permission):
    def _checker(user: AuthUser = Depends(get_current_user_context)) -> AuthUser:
        if not has_permission(user.role, permission):
            raise PermissionDeniedError("You do not have permission to perform this action.")
        return user

    return _checker


def require_any_permission(*permissions: Permission):
    def _checker(user: AuthUser = Depends(get_current_user_context)) -> AuthUser:
        if not any(has_permission(user.role, p) for p in permissions):
            raise PermissionDeniedError("You do not have permission to perform this action.")
        return user

    return _checker
