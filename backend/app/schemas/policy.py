from datetime import datetime
from pydantic import BaseModel


class PolicyTierInfo(BaseModel):
    tier: str
    coverage_pct: float
    weekly_premium: float
    label: str


class PolicySubscribeRequest(BaseModel):
    tier: str  # basic | protection | advanced


class PolicyOut(BaseModel):
    id: int
    tier: str
    coverage_pct: float
    weekly_premium: float
    is_active: bool
    activated_at: datetime
    expires_at: datetime | None
    last_payment_at: datetime | None = None

    model_config = {"from_attributes": True}
