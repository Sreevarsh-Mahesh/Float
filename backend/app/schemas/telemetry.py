from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class PingIn(BaseModel):
    lat: float
    lng: float
    h3_cell: str
    rain_mm: Optional[float] = None
    aqi: Optional[float] = None
    temp_feels_like: Optional[float] = None

class PingOut(BaseModel):
    id: int
    spoof_score: float
    pinged_at: datetime
