"""
Policies & Premiums
===================
Tables: policies, premium_calculations
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, Integer,
    Numeric, SmallInteger, String, ForeignKey, Date,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import CoverageTierEnum, PolicyStatusEnum


class Policy(Base):
    __tablename__ = "policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    tier = Column(Enum(CoverageTierEnum, name="coverage_tier_enum"), nullable=False)
    status = Column(Enum(PolicyStatusEnum, name="policy_status_enum"), nullable=False, default=PolicyStatusEnum.active, index=True)

    coverage_start_date = Column(Date, nullable=False)
    coverage_end_date = Column(Date, nullable=False)
    auto_renew = Column(Boolean, default=True)

    # Premium (rupees)
    premium = Column(Float, nullable=False)

    # Earnings snapshot at policy creation (rupees)
    baseline_daily_avg = Column(Float, nullable=True)
    baseline_weekly_avg = Column(Float, nullable=True)
    baseline_std_dev = Column(Float, nullable=True)

    # Cold start
    is_cold_start = Column(Boolean, default=False)
    cold_start_multiplier = Column(Numeric(4, 2), default=1.00)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worker = relationship("Worker", back_populates="policies")
    premium_calculations = relationship("PremiumCalculation", back_populates="policy", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="policy")
    payouts = relationship("Payout", back_populates="policy")


class PremiumCalculation(Base):
    __tablename__ = "premium_calculations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True)
    calculated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Inputs (rupees)
    daily_avg = Column(Float, nullable=False)
    weekly_avg = Column(Float, nullable=False)
    weekly_variance = Column(Float, nullable=False)
    std_dev = Column(Float, nullable=False)
    anomaly_threshold = Column(Float, nullable=False)       # 3 * std_dev
    active_days_in_window = Column(SmallInteger, nullable=False)
    is_cold_start = Column(Boolean, default=False)
    cold_start_multiplier = Column(Numeric(4, 2), default=1.00)

    # Outputs (rupees)
    base_premium = Column(Float, nullable=False)
    final_premium = Column(Float, nullable=False)

    formula_version = Column(String(20), nullable=False, default="v1")

    # Relationships
    policy = relationship("Policy", back_populates="premium_calculations")
