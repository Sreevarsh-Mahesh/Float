from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DriverPing(Base):
    """
    Represents a single GPS ping from a driver.
    Sampled every 2–15 minutes while the app is active.
    Used for fraud / GPS cross-check.
    """
    __tablename__ = "driver_pings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Location
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    h3_cell: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # resolution 9

    # Spoof / fraud score for this ping (0-1)
    spoof_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Environmental snapshot at time of ping (from ambient sensors / last API call)
    rain_mm: Mapped[Optional[float]] = mapped_column(Float)
    aqi: Mapped[Optional[float]] = mapped_column(Float)
    temp_feels_like: Mapped[Optional[float]] = mapped_column(Float)

    pinged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped[object] = relationship("User", back_populates="pings")
