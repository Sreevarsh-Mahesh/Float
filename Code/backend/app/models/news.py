"""
News / Social Pipeline (LangGraph)
====================================
Table: news_pipeline_events
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    Numeric, String, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import TriggerTypeEnum


class NewsPipelineEvent(Base):
    __tablename__ = "news_pipeline_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_url = Column(Text, nullable=True)
    source_type = Column(String(30), nullable=True)         # 'news', 'twitter', 'govt_alert'
    raw_headline = Column(Text, nullable=True)
    extracted_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Classification
    event_type = Column(Enum(TriggerTypeEnum, name="trigger_type_enum"), nullable=True, index=True)
    confidence = Column(Numeric(5, 4), nullable=True)
    is_relevant = Column(Boolean, default=False, index=True)

    # Geo-resolution
    mentioned_location = Column(Text, nullable=True)
    resolved_h3_cells = Column(ARRAY(Text), nullable=True)

    trigger_event_id = Column(UUID(as_uuid=True), ForeignKey("trigger_events.id"), nullable=True)

    llm_model_used = Column(String(60), nullable=True)
    llm_response = Column(JSONB, nullable=True)

    trigger_event = relationship("TriggerEvent", back_populates="news_events")
