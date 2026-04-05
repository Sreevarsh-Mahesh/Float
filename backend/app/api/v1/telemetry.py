import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.dependencies import DbDep, get_current_user
from app.models.user import User
from app.models.driver_ping import DriverPing
from app.schemas.telemetry import PingIn, PingOut

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


def _calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Haversine formula
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.post("/ping", response_model=PingOut)
def record_ping(
    ping_data: PingIn,
    db: DbDep,
    current_user: User = Depends(get_current_user),
):
    """Record a GPS ping and calculate spoof score."""
    last_ping = (
        db.query(DriverPing)
        .filter(DriverPing.user_id == current_user.id)
        .order_by(DriverPing.pinged_at.desc())
        .first()
    )

    spoof_score = 0.0

    if last_ping:
        now = datetime.now(timezone.utc)
        dist_km = _calculate_distance_km(last_ping.lat, last_ping.lng, ping_data.lat, ping_data.lng)

        dt_hours = 2 / 60.0  # mock delta of 2 mins
        
        if last_ping.pinged_at:
             lp_time = last_ping.pinged_at.replace(tzinfo=timezone.utc) if last_ping.pinged_at.tzinfo is None else last_ping.pinged_at
             diff = now - lp_time
             if diff.total_seconds() > 0:
                 dt_hours = diff.total_seconds() / 3600.0

        if dt_hours > 0:
            speed_kmh = dist_km / dt_hours
            if speed_kmh > 80.0:
                spoof_score = min(1.0, speed_kmh / 150.0)
            if dist_km > 5.0 and last_ping.h3_cell == ping_data.h3_cell:
                spoof_score = max(spoof_score, 0.8)

    new_ping = DriverPing(
        user_id=current_user.id,
        lat=ping_data.lat,
        lng=ping_data.lng,
        h3_cell=ping_data.h3_cell,
        rain_mm=ping_data.rain_mm,
        aqi=ping_data.aqi,
        temp_feels_like=ping_data.temp_feels_like,
        spoof_score=spoof_score
    )
    db.add(new_ping)
    db.commit()
    db.refresh(new_ping)

    return PingOut(
        id=new_ping.id,
        spoof_score=new_ping.spoof_score,
        pinged_at=new_ping.pinged_at
    )
