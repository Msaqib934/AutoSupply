"""Roles and the permission matrix shared across all microservices."""

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "ADMIN"
    PROCUREMENT_MANAGER = "PROCUREMENT_MANAGER"
    SUPPLIER = "SUPPLIER"
    WAREHOUSE_OPERATOR = "WAREHOUSE_OPERATOR"
    PRODUCTION_PLANNER = "PRODUCTION_PLANNER"
    QUALITY_INSPECTOR = "QUALITY_INSPECTOR"
    FINANCE_OFFICER = "FINANCE_OFFICER"
    VIEWER = "VIEWER"


class Permission(StrEnum):
    USERS_MANAGE = "users:manage"

    SUPPLIERS_READ = "suppliers:read"
    SUPPLIERS_WRITE = "suppliers:write"
    SUPPLIER_PROFILE_UPDATE_OWN = "suppliers:update_own_profile"

    COMPONENTS_READ = "components:read"
    COMPONENTS_WRITE = "components:write"

    PURCHASE_ORDERS_READ = "purchase_orders:read"
    PURCHASE_ORDERS_WRITE = "purchase_orders:write"
    PURCHASE_ORDERS_RESPOND = "purchase_orders:respond"


INTERNAL_ROLES: frozenset[Role] = frozenset(r for r in Role if r is not Role.SUPPLIER)

ROLE_PERMISSIONS: dict[Permission, frozenset[Role]] = {
    Permission.USERS_MANAGE: frozenset({Role.ADMIN}),
    Permission.SUPPLIERS_READ: INTERNAL_ROLES | {Role.SUPPLIER},
    Permission.SUPPLIERS_WRITE: frozenset({Role.ADMIN, Role.PROCUREMENT_MANAGER}),
    Permission.SUPPLIER_PROFILE_UPDATE_OWN: frozenset({Role.SUPPLIER}),
    Permission.COMPONENTS_READ: INTERNAL_ROLES,
    Permission.COMPONENTS_WRITE: frozenset({Role.ADMIN}),
    Permission.PURCHASE_ORDERS_READ: INTERNAL_ROLES | {Role.SUPPLIER},
    Permission.PURCHASE_ORDERS_WRITE: frozenset({Role.ADMIN, Role.PROCUREMENT_MANAGER}),
    Permission.PURCHASE_ORDERS_RESPOND: frozenset({Role.SUPPLIER}),
}


def has_permission(role: Role | str, permission: Permission) -> bool:
    return Role(role) in ROLE_PERMISSIONS[permission]


def permissions_for(role: Role | str) -> list[str]:
    r = Role(role)
    return sorted(p.value for p, roles in ROLE_PERMISSIONS.items() if r in roles)
