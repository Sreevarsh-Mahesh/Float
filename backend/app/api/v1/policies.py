from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.dependencies import DbDep, get_current_user
from app.models.policy import Policy
from app.models.user import User
from app.schemas.policy import PolicyOut, PolicySubscribeRequest, PolicyTierInfo
from sqlalchemy import func

router = APIRouter(prefix="/policies", tags=["Policies"])
settings = get_settings()

_TIER_LABELS = {
    "basic": "Basic (50% coverage)",
    "protection": "Protection (75% coverage)",
    "advanced": "Advanced Protection (100% coverage)",
}


@router.get("/tiers", response_model=list[PolicyTierInfo])
def list_tiers():
    """List all available Float coverage tiers."""
    return [
        PolicyTierInfo(
            tier=tier,
            label=_TIER_LABELS[tier],
            **details,
        )
        for tier, details in settings.COVERAGE_TIERS.items()
    ]


@router.get("/me", response_model=PolicyOut | None)
def get_my_policy(db: DbDep, current_user: User = Depends(get_current_user)):
    """Return the driver's current active policy, if any."""
    policy = (
        db.query(Policy)
        .filter_by(user_id=current_user.id, is_active=True)
        .order_by(Policy.activated_at.desc())
        .first()
    )
    return policy


@router.post("/subscribe", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
def subscribe(
    payload: PolicySubscribeRequest,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    """Subscribe to a Float coverage tier. Deactivates any existing active policy."""
    if payload.tier not in settings.COVERAGE_TIERS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tier. Choose from: {list(settings.COVERAGE_TIERS.keys())}",
        )

    # Deactivate old policy
    existing = (
        db.query(Policy)
        .filter_by(user_id=current_user.id, is_active=True)
        .first()
    )
    if existing:
        existing.is_active = False

    tier_cfg = settings.COVERAGE_TIERS[payload.tier]
    policy = Policy(
        user_id=current_user.id,
        tier=payload.tier,
        coverage_pct=tier_cfg["coverage_pct"],
        weekly_premium=tier_cfg["weekly_premium"],
        is_active=True,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    # Set initial payment time to simulate first week paid
    policy.last_payment_at = policy.activated_at
    db.commit()
    db.refresh(policy)
    return policy

@router.post("/me/pay-premium", response_model=PolicyOut)
def pay_premium(db: DbDep, current_user: User = Depends(get_current_user)):
    """Simulate paying the weekly premium. Updates last_payment_at to now."""
    policy = (
        db.query(Policy)
        .filter_by(user_id=current_user.id, is_active=True)
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found to pay for.")
    
    policy.last_payment_at = func.now()
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_policy(
    policy_id: int,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    """Cancel (deactivate) a policy."""
    policy = db.get(Policy, policy_id)
    if not policy or policy.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Policy not found.")
    if not policy.is_active:
        raise HTTPException(status_code=409, detail="Policy already inactive.")
    policy.is_active = False
    db.commit()
