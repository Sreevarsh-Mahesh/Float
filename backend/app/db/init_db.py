"""Database initializer — creates tables and seeds default roles + admin user."""
import logging
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db import all_models  # noqa: ensures all models are registered
from app.db.base import Base
from app.db.session import engine
from app.models.user import Role, User, UserRole

logger = logging.getLogger(__name__)
settings = get_settings()


def init_db(db: Session) -> None:
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Seed roles
    for role_name in ("driver", "reviewer", "admin"):
        existing = db.query(Role).filter_by(name=role_name).first()
        if not existing:
            db.add(Role(name=role_name, description=f"Float {role_name} role"))
            logger.info(f"Created role: {role_name}")

    db.flush()

    # Seed first admin user
    admin = db.query(User).filter_by(email=settings.FIRST_ADMIN_EMAIL).first()
    if not admin:
        admin_role = db.query(Role).filter_by(name="admin").one()
        admin = User(
            email=settings.FIRST_ADMIN_EMAIL,
            phone="0000000000",
            hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
            full_name="Float Admin",
            platform="internal",
            is_active=True,
        )
        db.add(admin)
        db.flush()
        db.add(UserRole(user_id=admin.id, role_id=admin_role.id))
        logger.info(f"Created admin user: {settings.FIRST_ADMIN_EMAIL}")

    db.commit()
