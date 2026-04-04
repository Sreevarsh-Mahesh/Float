from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    user_roles: Mapped[list[UserRole]] = relationship("UserRole", back_populates="role")


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)

    user: Mapped[User] = relationship("User", back_populates="user_roles")
    role: Mapped[Role] = relationship("Role", back_populates="user_roles")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))

    # Float-specific
    platform: Mapped[str] = mapped_column(String(50), default="zomato")  # zomato | swiggy | other
    platform_driver_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    h3_home_cell: Mapped[Optional[str]] = mapped_column(String(20))  # H3 cell at resolution 9

    # Stats (updated by claim processor)
    daily_avg_earnings: Mapped[float] = mapped_column(default=800.0)
    earnings_std_dev: Mapped[float] = mapped_column(default=150.0)
    avg_delivery_speed: Mapped[float] = mapped_column(default=25.0)  # km/h
    speed_std_dev: Mapped[float] = mapped_column(default=5.0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user_roles: Mapped[list[UserRole]] = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )
    policies: Mapped[list] = relationship("Policy", back_populates="user")
    pings: Mapped[list] = relationship("DriverPing", back_populates="user")
    claims: Mapped[list] = relationship("Claim", back_populates="driver", foreign_keys="[Claim.driver_id]")
    payouts: Mapped[list] = relationship("Payout", back_populates="driver")
    notifications: Mapped[list] = relationship("Notification", back_populates="user")

    # Convenience property
    @property
    def roles(self) -> list[Role]:
        return [ur.role for ur in self.user_roles]
