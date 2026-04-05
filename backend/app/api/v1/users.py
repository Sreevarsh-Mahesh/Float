from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import DbDep, get_current_user
from app.core.rbac import Role, require_role
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/users", tags=["Users"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        platform=user.platform,
        h3_home_cell=user.h3_home_cell,
        is_active=user.is_active,
        roles=[r.name for r in user.roles],
    )


@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Return the authenticated driver's profile."""
    return _user_out(current_user)


@router.patch("/me/cell")
def update_home_cell(
    h3_cell: str,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    """Update the driver's home H3 cell (location zone)."""
    current_user.h3_home_cell = h3_cell
    db.commit()
    return {"message": "Home cell updated.", "h3_cell": h3_cell}


@router.get("/notifications")
def get_notifications(
    db: DbDep,
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
):
    """List push notifications for the current user."""
    from app.models.payout import Notification
    from app.schemas.claim import NotificationOut

    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa
    notifs = q.order_by(Notification.created_at.desc()).limit(50).all()
    return [NotificationOut.model_validate(n) for n in notifs]


@router.patch("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    from app.models.payout import Notification
    n = db.get(Notification, notif_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    db.commit()
    return {"message": "Marked as read."}
