"""
Workers
=======
Tables: workers, worker_platform_links
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, Integer,
    String, Text, UniqueConstraint, ForeignKey, Date,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import TransportModeEnum, PlatformEnum


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    kyc_verified = Column(Boolean, default=False)
    kyc_verified_at = Column(DateTime(timezone=True), nullable=True)

    transport_mode = Column(
        Enum(TransportModeEnum, name="transport_mode_enum"),
        nullable=False,
        default=TransportModeEnum.bike,
    )

    home_h3_cell = Column(Text, nullable=True, index=True)

    # Payment details
    upi_id = Column(String(100), nullable=True)
    bank_account_no = Column(String(30), nullable=True)
    bank_ifsc = Column(String(12), nullable=True)

    # App & device
    device_token = Column(Text, nullable=True)
    app_version = Column(String(20), nullable=True)

    # Flags
    is_active = Column(Boolean, default=True)
    security_deposit_held = Column(Float, default=0.0)  # rupees

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    platform_links = relationship("WorkerPlatformLink", back_populates="worker", cascade="all, delete-orphan")
    policies = relationship("Policy", back_populates="worker", cascade="all, delete-orphan")
    daily_earnings = relationship("DailyEarning", back_populates="worker", cascade="all, delete-orphan")
    spoof_profile = relationship("WorkerSpoofProfile", back_populates="worker", uselist=False, cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="worker")
    payouts = relationship("Payout", back_populates="worker")
    notifications = relationship("Notification", back_populates="worker", cascade="all, delete-orphan")


class WorkerPlatformLink(Base):
    __tablename__ = "worker_platform_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(Enum(PlatformEnum, name="platform_enum"), nullable=False)
    platform_worker_id = Column(String(100), nullable=False)
    verified = Column(Boolean, default=False)
    linked_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    worker = relationship("Worker", back_populates="platform_links")

    __table_args__ = (
        UniqueConstraint("platform", "platform_worker_id", name="uq_platform_worker"),
    )
