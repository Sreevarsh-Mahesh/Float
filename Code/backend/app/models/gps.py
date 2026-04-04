"""
GPS Trajectory & Anti-Spoofing
===============================
Tables: gps_pings (partitioned by day), worker_spoof_profiles
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Float,
    Integer, Numeric, SmallInteger, String, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class GpsPing(Base):
    """
    Raw GPS pings partitioned by day in PostgreSQL.
    The SQLAlchemy model maps to the unpartitioned base table for ORM queries.
    """
    __tablename__ = "gps_pings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)
    pinged_at = Column(DateTime(timezone=True), nullable=False)

    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    h3_index_r9 = Column(Text, nullable=True)
    h3_index_r10 = Column(Text, nullable=True)

    accuracy_m = Column(Numeric(6, 2), nullable=True)
    is_online = Column(Boolean, default=True)

    # Fraud signals (computed by validation worker)
    speed_kmh = Column(Numeric(6, 2), nullable=True)
    hop_distance = Column(SmallInteger, nullable=True)
    spoof_score = Column(Numeric(4, 3), default=0)
    is_flagged = Column(Boolean, default=False)


class WorkerSpoofProfile(Base):
    __tablename__ = "worker_spoof_profiles"

    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), primary_key=True)
    rolling_spoof_score = Column(Numeric(4, 3), default=0)      # 30-min rolling average
    spoof_score_8w_avg = Column(Numeric(4, 3), default=0)        # 8-week claim frequency average
    total_flagged_pings = Column(Integer, default=0)
    total_pings = Column(Integer, default=0)
    last_evaluated_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    worker = relationship("Worker", back_populates="spoof_profile")
