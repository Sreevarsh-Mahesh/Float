"""
Notifications
==============
Table: notifications
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, String, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=True)
    trigger_event_id = Column(UUID(as_uuid=True), ForeignKey("trigger_events.id"), nullable=True)

    notification_type = Column(String(50), nullable=False)      # 'trigger_fired', 'payout_credited', 'policy_renewed'
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)

    # Push delivery
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    delivery_status = Column(String(20), default="pending")     # pending/sent/delivered/failed

    payload = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    worker = relationship("Worker", back_populates="notifications")
    claim = relationship("Claim", back_populates="notifications")
