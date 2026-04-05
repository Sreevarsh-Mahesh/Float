"""
Claims, Payouts & Fraud
========================
Tables: claims, payouts, fraud_audit_records
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    Integer, Numeric, SmallInteger, String, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import ClaimStatusEnum


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False, index=True)
    trigger_event_id = Column(UUID(as_uuid=True), ForeignKey("trigger_events.id"), nullable=False, index=True)

    status = Column(Enum(ClaimStatusEnum, name="claim_status_enum"), nullable=False, default=ClaimStatusEnum.pending, index=True)

    triggered_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Payout calculation inputs (rupees)
    daily_avg = Column(Float, nullable=False)
    coverage_pct = Column(Numeric(5, 4), nullable=False)       # 0.50, 0.75, or 1.00
    scaling_factor = Column(Numeric(5, 4), nullable=False)
    trigger_raw_value = Column(Numeric(10, 4), nullable=True)
    trigger_reference_value = Column(Numeric(10, 4), nullable=True)

    # Computed payouts (rupees)
    gross_payout = Column(Float, nullable=False, default=0.0)
    final_payout = Column(Float, nullable=False, default=0.0)

    # Fraud evaluation
    fraud_score = Column(Numeric(5, 2), default=0)             # 0–100
    fraud_score_detail = Column(JSONB, nullable=True)
    auto_decision = Column(String(30), nullable=True)
    manual_reviewer_id = Column(UUID(as_uuid=True), nullable=True)
    manual_review_note = Column(Text, nullable=True)

    # GPS confirmation
    worker_in_zone = Column(Boolean, nullable=True)
    trajectory_overlap_pct = Column(Numeric(5, 2), nullable=True)

    # Cohort check
    cohort_trigger_rate_pct = Column(Numeric(5, 2), nullable=True)
    cohort_order_drop_pct = Column(Numeric(5, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worker = relationship("Worker", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")
    trigger_event = relationship("TriggerEvent", back_populates="claims")
    payouts = relationship("Payout", back_populates="claim")
    fraud_audit = relationship("FraudAuditRecord", back_populates="claim", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="claim")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False)

    amount = Column(Float, nullable=False)      # rupees
    payment_method = Column(String(30), nullable=False, default="upi")
    payment_reference = Column(String(100), nullable=True)
    payment_gateway = Column(String(50), nullable=True)

    initiated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    failure_reason = Column(Text, nullable=True)

    status = Column(String(20), default="initiated")    # initiated/completed/failed
    retry_count = Column(SmallInteger, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    claim = relationship("Claim", back_populates="payouts")
    worker = relationship("Worker", back_populates="payouts")
    policy = relationship("Policy", back_populates="payouts")


class FraudAuditRecord(Base):
    __tablename__ = "fraud_audit_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False)
    evaluated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Layer 1: Data validation
    event_independently_confirmed = Column(Boolean, nullable=True)
    data_sources_checked = Column(Text, nullable=True)    # comma-separated source names

    # Layer 2: GPS cross-check
    worker_in_affected_zone = Column(Boolean, nullable=True)
    gps_zone_overlap_pct = Column(Numeric(5, 2), nullable=True)
    gps_pings_during_event = Column(SmallInteger, nullable=True)
    gps_check_passed = Column(Boolean, nullable=True)

    # Layer 3: Personal anomaly
    worker_claim_freq_8w = Column(Numeric(5, 2), nullable=True)
    worker_freq_zscore = Column(Numeric(6, 3), nullable=True)
    personal_anomaly_flagged = Column(Boolean, nullable=True)

    # Layer 4: Cohort check
    total_workers_in_zone = Column(Integer, nullable=True)
    workers_who_triggered = Column(Integer, nullable=True)
    cohort_trigger_rate = Column(Numeric(5, 4), nullable=True)
    expected_trigger_rate_min = Column(Numeric(5, 4), default=0.60)
    expected_trigger_rate_max = Column(Numeric(5, 4), default=0.90)
    platform_order_drop_rate = Column(Numeric(5, 4), nullable=True)
    cohort_anomaly_flagged = Column(Boolean, nullable=True)

    # Layer 5: Speed-based validation
    worker_mu_speed_kmh = Column(Numeric(6, 2), nullable=True)
    worker_sigma_speed_kmh = Column(Numeric(6, 2), nullable=True)
    observed_speed_during_event = Column(Numeric(6, 2), nullable=True)
    speed_zscore = Column(Numeric(6, 3), nullable=True)
    speed_check_passed = Column(Boolean, nullable=True)

    # Composite
    final_fraud_score = Column(Numeric(5, 2), nullable=False)   # 0–100
    decision = Column(String(30), nullable=False)                # auto_approved / flagged / held

    claim = relationship("Claim", back_populates="fraud_audit")
