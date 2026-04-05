from pydantic import BaseModel

class UserStatsOut(BaseModel):
    total_payouts_inr: float
    total_claims: int
    active_policies: int
