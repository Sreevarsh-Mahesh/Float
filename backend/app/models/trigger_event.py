from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TriggerEvent(Base):
    """
    A grid-level environmental or social disruption event detected by the ST-GNN.
    One TriggerEvent can cause many Claims (one per driver in the zone).
    """
    __tablename__ = "trigger_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    h3_cell: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Event type: rain | aqi | heat | acts_of_god | road_closure | protest | platform_down
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Raw intensity values at trigger time
    intensity: Mapped[float] = mapped_column(Float, default=0.0)

    # Full feature snapshot returned by dummy ST-GNN (JSON)
    raw_features: Mapped[Optional[dict]] = mapped_column(JSON)

    # ST-GNN outputs
    trigger_confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1
    payout_estimate: Mapped[float] = mapped_column(Float, default=0.0)     # INR

    # Source: stgnn | manual | external_api
    source: Mapped[str] = mapped_column(String(50), default="stgnn")

    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    claims: Mapped[list] = relationship("Claim", back_populates="trigger_event")
