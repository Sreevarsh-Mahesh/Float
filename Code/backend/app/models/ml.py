"""
ML Model Versioning
====================
Table: model_versions
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    Integer, Numeric, String, Text, Date, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base
from app.enums import ModelStageEnum


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(80), nullable=False, default="st_gnn_v1")
    version_tag = Column(String(40), nullable=False)
    stage = Column(Enum(ModelStageEnum, name="model_stage_enum"), nullable=False, default=ModelStageEnum.staging, index=True)

    hyperparameters = Column(JSONB, nullable=False)

    # Training
    train_start = Column(DateTime(timezone=True), nullable=True)
    train_end = Column(DateTime(timezone=True), nullable=True)
    training_data_from = Column(Date, nullable=True)
    training_data_to = Column(Date, nullable=True)
    train_samples = Column(Integer, nullable=True)
    val_samples = Column(Integer, nullable=True)
    test_samples = Column(Integer, nullable=True)

    # Evaluation metrics
    trigger_f1_score = Column(Numeric(5, 4), nullable=True)
    payout_mae = Column(Float, nullable=True)   # rupees
    auc_roc = Column(Numeric(5, 4), nullable=True)

    # Storage
    artifact_path = Column(Text, nullable=True)
    artifact_checksum = Column(String(64), nullable=True)

    promoted_at = Column(DateTime(timezone=True), nullable=True)
    retired_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("model_name", "version_tag", name="uq_model_version"),
    )
