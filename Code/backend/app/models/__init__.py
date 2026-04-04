# Import all models so SQLAlchemy metadata is populated
from app.models.worker import Worker, WorkerPlatformLink
from app.models.policy import Policy, PremiumCalculation
from app.models.earnings import DailyEarning, WorkerEarningsStats
from app.models.spatial import H3Cell, H3CellSnapshot
from app.models.gps import GpsPing, WorkerSpoofProfile
from app.models.trigger import TriggerEvent, TriggerConfig
from app.models.claim import Claim, Payout, FraudAuditRecord
from app.models.ml import ModelVersion
from app.models.news import NewsPipelineEvent
from app.models.notification import Notification
from app.models.audit import AuditLog

__all__ = [
    "Worker",
    "WorkerPlatformLink",
    "Policy",
    "PremiumCalculation",
    "DailyEarning",
    "WorkerEarningsStats",
    "H3Cell",
    "H3CellSnapshot",
    "GpsPing",
    "WorkerSpoofProfile",
    "TriggerEvent",
    "TriggerConfig",
    "Claim",
    "Payout",
    "FraudAuditRecord",
    "ModelVersion",
    "NewsPipelineEvent",
    "Notification",
    "AuditLog",
]
