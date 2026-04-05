"""
Audit Log
==========
Table: audit_log — immutable append-only compliance ledger
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger, Column, DateTime, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, INET

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    actor_type = Column(String(20), nullable=False)     # 'system', 'worker', 'admin'
    actor_id = Column(Text, nullable=True)
    action = Column(String(80), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Text, nullable=True)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    ip_address = Column(INET, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
