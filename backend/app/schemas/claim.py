from datetime import datetime
from pydantic import BaseModel


class ClaimOut(BaseModel):
    id: int
    driver_id: int
    trigger_event_id: int
    policy_id: int
    fraud_score: float
    fraud_flags: dict | None
    spoof_score: float
    status: str
    payout_estimate: float
    review_notes: str | None
    resolved_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClaimStatusUpdate(BaseModel):
    """Admin override for claim status."""
    status: str       # auto_approved | flagged_review | held | rejected
    review_notes: str | None = None


class PayoutOut(BaseModel):
    id: int
    claim_id: int
    driver_id: int
    base_amount: float
    tier_multiplier: float
    final_amount: float
    status: str
    transaction_ref: str | None
    disbursed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    is_read: bool
    claim_id: int | None
    payout_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
