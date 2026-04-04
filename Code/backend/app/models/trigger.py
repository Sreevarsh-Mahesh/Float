"""
Trigger Events & Configuration
================================
Tables: trigger_events, trigger_config
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    Integer, Numeric, SmallInteger, String, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import TriggerCategoryEnum, TriggerTypeEnum


class TriggerEvent(Base):
    __tablename__ = "trigger_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    h3_index = Column(Text, ForeignKey("h3_cells.h3_index"), nullable=False, index=True)
    category = Column(Enum(TriggerCategoryEnum, name="trigger_category_enum"), nullable=False)
    trigger_type = Column(Enum(TriggerTypeEnum, name="trigger_type_enum"), nullable=False, index=True)

    event_start = Column(DateTime(timezone=True), nullable=False)
    event_end = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    raw_value = Column(Numeric(10, 4), nullable=True)
    threshold_value = Column(Numeric(10, 4), nullable=True)
    scaling_factor = Column(Numeric(5, 4), default=1.0)

    is_verified = Column(Boolean, default=False, index=True)
    verified_via = Column(ARRAY(Text), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    source_payload = Column(JSONB, nullable=True)

    affected_h3_cells = Column(ARRAY(Text), nullable=True)
    affected_worker_count = Column(Integer, nullable=True)

    model_predicted = Column(Boolean, nullable=True)
    model_confidence = Column(Numeric(5, 4), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    cell = relationship("H3Cell", back_populates="trigger_events")
    claims = relationship("Claim", back_populates="trigger_event")
    news_events = relationship("NewsPipelineEvent", back_populates="trigger_event")


class TriggerConfig(Base):
    __tablename__ = "trigger_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trigger_type = Column(Enum(TriggerTypeEnum, name="trigger_type_enum"), nullable=False, unique=True)

    threshold_value = Column(Numeric(10, 4), nullable=False)
    threshold_unit = Column(String(20), nullable=True)

    scaling_factor = Column(Numeric(5, 4), nullable=False, default=1.0)
    max_payout = Column(Float, nullable=True)    # rupees; cap per trigger per day

    # Tier thresholds (for road anomaly slow delivery count)
    tier_threshold_basic = Column(SmallInteger, nullable=True)
    tier_threshold_protection = Column(SmallInteger, nullable=True)
    tier_threshold_advanced = Column(SmallInteger, nullable=True)

    is_active = Column(Boolean, default=True)
    effective_from = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_by = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
