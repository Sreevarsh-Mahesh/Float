"""
ORM Models – import order matters for FK resolution.
All models must be imported here so Alembic sees them.
"""
from app.db.base import Base  # noqa: F401
from app.models.user import User, Role, UserRole  # noqa: F401
from app.models.policy import Policy  # noqa: F401
from app.models.driver_ping import DriverPing  # noqa: F401
from app.models.trigger_event import TriggerEvent  # noqa: F401
from app.models.claim import Claim  # noqa: F401
from app.models.payout import Payout, Notification  # noqa: F401
