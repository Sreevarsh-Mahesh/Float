"""
H3 Spatial Grid
===============
Tables: h3_cells, h3_cell_snapshots (partitioned by week)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Float,
    Integer, Numeric, SmallInteger, String, Text, ForeignKey, JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


class H3Cell(Base):
    __tablename__ = "h3_cells"

    h3_index = Column(Text, primary_key=True)
    resolution = Column(SmallInteger, nullable=False, default=9)

    city = Column(String(80), nullable=True, index=True)
    district = Column(String(80), nullable=True)
    state = Column(String(80), nullable=True)

    centroid_lat = Column(Numeric(10, 7), nullable=False)
    centroid_lng = Column(Numeric(10, 7), nullable=False)

    # Zone-level baseline earnings (rupees)
    zone_daily_avg = Column(Float, default=0.0)

    # Risk profile
    flood_risk_score = Column(Numeric(4, 3), default=0)
    historical_aqi_avg = Column(Numeric(6, 2), nullable=True)
    historical_rain_avg_mm = Column(Numeric(6, 2), nullable=True)

    is_monitored = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    snapshots = relationship("H3CellSnapshot", back_populates="cell")
    trigger_events = relationship("TriggerEvent", back_populates="cell")


class H3CellSnapshot(Base):
    """
    Time-series feature vector per (h3_index, timestamp).
    Partitioned by week in PostgreSQL (declared via Alembic raw DDL).
    This SQLAlchemy model maps to the base (non-partitioned) table definition
    used for ORM queries; writes go through raw SQL or the base table.
    """
    __tablename__ = "h3_cell_snapshots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    h3_index = Column(Text, ForeignKey("h3_cells.h3_index"), nullable=False)
    snapshot_at = Column(DateTime(timezone=True), nullable=False)

    # Environmental
    rainfall_mm = Column(Numeric(6, 2), default=0)
    aqi = Column(Numeric(6, 2), default=0)
    feels_like_temp_c = Column(Numeric(5, 2), nullable=True)
    wind_speed_kmh = Column(Numeric(5, 2), nullable=True)

    # Civic / Social flags
    curfew_flag = Column(Boolean, default=False)
    protest_flag = Column(Boolean, default=False)
    road_closure_flag = Column(Boolean, default=False)
    cell_outage_flag = Column(Boolean, default=False)

    # Market
    order_density = Column(Numeric(8, 2), default=0)
    active_driver_count = Column(SmallInteger, default=0)
    platform_downtime_flag = Column(Boolean, default=False)

    # Temporal
    hour_of_day = Column(SmallInteger, nullable=False)
    day_of_week = Column(SmallInteger, nullable=False)
    is_festival_day = Column(Boolean, default=False)

    # ST-GNN output (written back after inference)
    predicted_risk_score = Column(Numeric(5, 4), nullable=True)
    predicted_payout = Column(Float, nullable=True)     # rupees
    trigger_flags = Column(JSONB, nullable=True)

    model_version_id = Column(UUID(as_uuid=True), nullable=True)
    inference_latency_ms = Column(Integer, nullable=True)

    data_source = Column(String(50), default="weather_api")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    cell = relationship("H3Cell", back_populates="snapshots")
