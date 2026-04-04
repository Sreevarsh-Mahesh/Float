"""
Role-Based Access Control definitions for Float.

Roles
-----
driver   — Default for all registered gig workers.
reviewer — Can view flagged/held claims; cannot mutate.
admin    — Full access: user management, payout overrides, inference runs.
"""

from enum import StrEnum
from typing import Callable
from functools import wraps

from fastapi import HTTPException, status


class Role(StrEnum):
    DRIVER = "driver"
    REVIEWER = "reviewer"
    ADMIN = "admin"


# Hierarchical permissions: admin can do everything reviewer can, etc.
ROLE_HIERARCHY: dict[str, int] = {
    Role.DRIVER: 1,
    Role.REVIEWER: 2,
    Role.ADMIN: 3,
}


def has_role(user_roles: list[str], required: Role) -> bool:
    """Check if any of the user's roles meets the required level."""
    user_level = max((ROLE_HIERARCHY.get(r, 0) for r in user_roles), default=0)
    return user_level >= ROLE_HIERARCHY[required]


def require_role(role: Role) -> Callable:
    """
    FastAPI dependency factory.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role(Role.ADMIN))])
    """
    from app.core.dependencies import get_current_user  # deferred import
    from fastapi import Depends

    async def _guard(current_user=Depends(get_current_user)):
        user_roles = [r.name for r in current_user.roles]
        if not has_role(user_roles, role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{role}' role or higher.",
            )
        return current_user

    return _guard
