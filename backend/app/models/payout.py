from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Payout(Base):
    """
    Final payout row — created by ClaimDispatcher for auto_approved claims.
    Represents a real (simulated) UPI/bank disbursement.
    """
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), unique=True, nullable=False, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Amounts
    base_amount: Mapped[float] = mapped_column(Float, nullable=False)      # from payout formula
    tier_multiplier: Mapped[float] = mapped_column(Float, nullable=False)  # coverage_pct
    final_amount: Mapped[float] = mapped_column(Float, nullable=False)     # base * tier_multiplier

    # Disbursement
    # Status: pending | disbursed | failed
    status: Mapped[str] = mapped_column(String(30), default="pending")
    transaction_ref: Mapped[Optional[str]] = mapped_column(String(100))    # simulated UPI ref
    disbursed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    claim: Mapped[object] = relationship("Claim", back_populates="payout")
    driver: Mapped[object] = relationship("User", back_populates="payouts")


class Notification(Base):
    """Push notification record sent to driver after payout or status change."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    # Optional link to related objects
    claim_id: Mapped[Optional[int]] = mapped_column(ForeignKey("claims.id"))
    payout_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payouts.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped[object] = relationship("User", back_populates="notifications")
