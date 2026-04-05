"""
Earnings History
================
Tables: daily_earnings
Materialized view: worker_earnings_stats  (read-only, refreshed externally)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    Numeric, SmallInteger, String, ForeignKey, Date, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import PlatformEnum


class DailyEarning(Base):
    __tablename__ = "daily_earnings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)
    earning_date = Column(Date, nullable=False)

    # Financials (rupees)
    gross_earnings = Column(Float, nullable=False, default=0.0)

    # Operational
    orders_completed = Column(SmallInteger, default=0)
    hours_active = Column(Numeric(4, 2), default=0)
    total_distance_km = Column(Numeric(7, 2), default=0)

    platform = Column(Enum(PlatformEnum, name="platform_enum"), nullable=True)

    # Speed stats
    avg_speed_kmh = Column(Numeric(5, 2), nullable=True)
    std_dev_speed_kmh = Column(Numeric(5, 2), nullable=True)

    # Quality flags
    is_verified = Column(Boolean, default=False)
    is_anomaly = Column(Boolean, default=False)
    source = Column(String(30), default="platform_api")

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    worker = relationship("Worker", back_populates="daily_earnings")

    __table_args__ = (
        UniqueConstraint("worker_id", "earning_date", "platform", name="uq_earnings_worker_date_platform"),
    )


class WorkerEarningsStats(Base):
    """
    Read-only mapping to the materialized view worker_earnings_stats.
    Do NOT write to this model; it is refreshed by:
        REFRESH MATERIALIZED VIEW CONCURRENTLY worker_earnings_stats;
    """
    __tablename__ = "worker_earnings_stats"

    worker_id = Column(UUID(as_uuid=True), primary_key=True)
    total_active_days = Column(Float)

    # Rolling stats (rupees where applicable)
    daily_avg = Column(Float)
    weekly_avg = Column(Float)
    monthly_avg = Column(Float)
    weekly_variance = Column(Float)
    std_dev = Column(Float)
    anomaly_threshold = Column(Float)   # 3 * std_dev

    # Speed stats
    avg_speed_kmh = Column(Float)
    avg_speed_std_dev = Column(Float)

    earliest_record = Column(Date)
    latest_record = Column(Date)
