from pydantic import BaseModel
from datetime import datetime


class CellFeatures(BaseModel):
    """Feature vector for one H3 cell — mirrors the README input table."""
    h3_cell: str
    rain_mm: float = 0.0
    aqi: float = 60.0
    temp_feels_like: float = 32.0
    wind_speed: float = 10.0
    curfew_flag: int = 0
    road_closure_flag: int = 0
    order_density: float = 50.0
    active_driver_count: float = 40.0
    hour_of_day: int = 12
    day_of_week: int = 1
    festival_flag: int = 0


class InferenceRequest(BaseModel):
    cells: list[CellFeatures]


class CellPrediction(BaseModel):
    h3_cell: str
    trigger_rain: bool
    trigger_aqi: bool
    trigger_heat: bool
    trigger_confidence: float   # max confidence across triggers
    payout_estimate: float      # INR


class InferenceResponse(BaseModel):
    predictions: list[CellPrediction]
    run_at: datetime


class TriggerEventOut(BaseModel):
    id: int
    h3_cell: str
    event_type: str
    intensity: float
    trigger_confidence: float
    payout_estimate: float
    source: str
    triggered_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}
