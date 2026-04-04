from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Claim(Base):
    """
    A claim links a single driver to a TriggerEvent via their active Policy.
    Created by the ClaimProcessor after fraud evaluation.
    """
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_event_id: Mapped[int] = mapped_column(ForeignKey("trigger_events.id"), nullable=False, index=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("policies.id"), nullable=False)

    # Fraud evaluation
    fraud_score: Mapped[float] = mapped_column(Float, default=0.0)    # 0-100
    fraud_flags: Mapped[Optional[dict]] = mapped_column(JSON)          # which checks fired
    spoof_score: Mapped[float] = mapped_column(Float, default=0.0)    # rolling GPS spoof score

    # Status: pending | auto_approved | flagged_review | held | rejected | paid
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)

    # Payout estimate before tier adjustment (INR)
    payout_estimate: Mapped[float] = mapped_column(Float, default=0.0)

    # Admin review
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    review_notes: Mapped[Optional[str]] = mapped_column(String(1000))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    driver: Mapped[object] = relationship("User", foreign_keys=[driver_id], back_populates="claims")
    trigger_event: Mapped[object] = relationship("TriggerEvent", back_populates="claims")
    policy: Mapped[object] = relationship("Policy", back_populates="claims")
    payout: Mapped[Optional[object]] = relationship("Payout", back_populates="claim", uselist=False)
    reviewer: Mapped[Optional[object]] = relationship("User", foreign_keys=[reviewed_by])
