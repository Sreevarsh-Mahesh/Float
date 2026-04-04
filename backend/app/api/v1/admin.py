"""
Admin Router
============
Full platform visibility for admins and reviewers.
All endpoints require admin or reviewer role (enforced per-endpoint).
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.dependencies import DbDep
from app.core.rbac import Role, require_role
from app.models.claim import Claim
from app.models.payout import Payout
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.claim import ClaimOut, ClaimStatusUpdate, PayoutOut
from app.services.claim_dispatcher import dispatch_all_pending

router = APIRouter(prefix="/admin", tags=["Admin"])

_admin_dep  = Depends(require_role(Role.ADMIN))
_review_dep = Depends(require_role(Role.REVIEWER))


# --------------------------------------------------------------------------- #
# Users                                                                        #
# --------------------------------------------------------------------------- #

@router.get("/users", response_model=list[UserOut], dependencies=[_admin_dep])
def list_all_users(db: DbDep, limit: int = 50, offset: int = 0):
    users = db.query(User).offset(offset).limit(limit).all()
    return [
        UserOut(
            id=u.id, email=u.email, phone=u.phone, full_name=u.full_name,
            platform=u.platform, h3_home_cell=u.h3_home_cell, is_active=u.is_active,
            roles=[r.name for r in u.roles],
        )
        for u in users
    ]


@router.patch("/users/{user_id}/deactivate", dependencies=[_admin_dep])
def deactivate_user(user_id: int, db: DbDep):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = False
    db.commit()
    return {"message": f"User {user_id} deactivated."}


@router.patch("/users/{user_id}/role", dependencies=[_admin_dep])
def assign_role(user_id: int, role_name: str, db: DbDep):
    """Assign an additional role to a user."""
    from app.models.user import Role as RoleModel, UserRole
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    role = db.query(RoleModel).filter_by(name=role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found.")
    existing = db.query(UserRole).filter_by(user_id=user_id, role_id=role.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already has this role.")
    db.add(UserRole(user_id=user_id, role_id=role.id))
    db.commit()
    return {"message": f"Role '{role_name}' assigned to user {user_id}."}


# --------------------------------------------------------------------------- #
# Claims                                                                       #
# --------------------------------------------------------------------------- #

@router.get("/claims", response_model=list[ClaimOut], dependencies=[_review_dep])
def list_all_claims(
    db: DbDep,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """List all claims across all drivers. Reviewers and admins can access."""
    q = db.query(Claim)
    if status:
        q = q.filter(Claim.status == status)
    claims = q.order_by(Claim.created_at.desc()).offset(offset).limit(limit).all()
    return [ClaimOut.model_validate(c) for c in claims]


@router.patch("/claims/{claim_id}", response_model=ClaimOut, dependencies=[_admin_dep])
def update_claim_status(
    claim_id: int,
    payload: ClaimStatusUpdate,
    background_tasks: BackgroundTasks,
    db: DbDep,
    reviewer=Depends(require_role(Role.ADMIN)),
):
    """Admin override: change claim status, optionally trigger payout dispatch."""
    valid_statuses = {"auto_approved", "flagged_review", "held", "rejected", "paid"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Choose from {valid_statuses}")

    claim = db.get(Claim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    from datetime import datetime, timezone
    claim.status = payload.status
    claim.reviewed_by = reviewer.id
    claim.review_notes = payload.review_notes
    claim.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(claim)

    # If manually approved, dispatch payout in background
    if payload.status == "auto_approved":
        background_tasks.add_task(_dispatch_single, claim.id)

    return ClaimOut.model_validate(claim)


def _dispatch_single(claim_id: int) -> None:
    from app.db.session import SessionLocal
    from app.services.claim_dispatcher import dispatch_claim
    db = SessionLocal()
    try:
        claim = db.get(Claim, claim_id)
        if claim:
            dispatch_claim(claim, db)
            db.commit()
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Payouts                                                                      #
# --------------------------------------------------------------------------- #

@router.get("/payouts", response_model=list[PayoutOut], dependencies=[_admin_dep])
def list_all_payouts(db: DbDep, limit: int = 50, offset: int = 0):
    payouts = (
        db.query(Payout)
        .order_by(Payout.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [PayoutOut.model_validate(p) for p in payouts]


@router.post("/payouts/dispatch-pending", dependencies=[_admin_dep])
def dispatch_pending_payouts(background_tasks: BackgroundTasks):
    """Manually trigger dispatch for all auto_approved claims without payouts."""
    background_tasks.add_task(_batch_dispatch)
    return {"message": "Batch payout dispatch scheduled."}


def _batch_dispatch() -> None:
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        dispatch_all_pending(db)
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Stats                                                                        #
# --------------------------------------------------------------------------- #

@router.get("/stats", dependencies=[_review_dep])
def platform_stats(db: DbDep):
    """High-level platform statistics."""
    from app.models.policy import Policy
    from sqlalchemy import func

    total_users   = db.query(func.count(User.id)).scalar()
    active_policies = db.query(func.count(Policy.id)).filter(Policy.is_active == True).scalar()  # noqa
    total_claims  = db.query(func.count(Claim.id)).scalar()
    total_paid    = db.query(func.count(Claim.id)).filter(Claim.status == "paid").scalar()
    held_claims   = db.query(func.count(Claim.id)).filter(Claim.status == "held").scalar()
    total_disbursed = db.query(func.sum(Payout.final_amount)).filter(Payout.status == "disbursed").scalar() or 0.0

    return {
        "total_users": total_users,
        "active_policies": active_policies,
        "total_claims": total_claims,
        "paid_claims": total_paid,
        "held_claims": held_claims,
        "total_disbursed_inr": round(total_disbursed, 2),
    }
