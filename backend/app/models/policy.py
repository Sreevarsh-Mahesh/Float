from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Tier: basic | protection | advanced
    tier: Mapped[str] = mapped_column(String(30), nullable=False)
    coverage_pct: Mapped[float] = mapped_column(Float, nullable=False)  # 0.50 | 0.75 | 1.00
    weekly_premium: Mapped[float] = mapped_column(Float, nullable=False)  # INR

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_payment_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped[object] = relationship("User", back_populates="policies")
    claims: Mapped[list] = relationship("Claim", back_populates="policy")
