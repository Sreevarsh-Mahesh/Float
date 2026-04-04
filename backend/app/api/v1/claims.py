from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import DbDep, get_current_user
from app.models.claim import Claim
from app.models.payout import Payout
from app.models.user import User
from app.schemas.claim import ClaimOut, PayoutOut

router = APIRouter(prefix="/claims", tags=["Claims"])


@router.get("/me", response_model=list[ClaimOut])
def get_my_claims(
    db: DbDep,
    current_user: User = Depends(get_current_user),
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    """List all claims for the authenticated driver, optionally filtered by status."""
    q = db.query(Claim).filter(Claim.driver_id == current_user.id)
    if status:
        q = q.filter(Claim.status == status)
    claims = q.order_by(Claim.created_at.desc()).offset(offset).limit(limit).all()
    return [ClaimOut.model_validate(c) for c in claims]


@router.get("/me/{claim_id}", response_model=ClaimOut)
def get_my_claim(
    claim_id: int,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific claim belonging to this driver."""
    claim = db.get(Claim, claim_id)
    if not claim or claim.driver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return ClaimOut.model_validate(claim)


@router.get("/me/payouts", response_model=list[PayoutOut])
def get_my_payouts(
    db: DbDep,
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    """List all payouts for the authenticated driver."""
    payouts = (
        db.query(Payout)
        .filter(Payout.driver_id == current_user.id)
        .order_by(Payout.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [PayoutOut.model_validate(p) for p in payouts]
