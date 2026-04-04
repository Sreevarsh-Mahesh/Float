from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Float"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./float.db"

    # JWT
    SECRET_KEY: str = "insecure-dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Seed admin
    FIRST_ADMIN_EMAIL: str = "admin@float.in"
    FIRST_ADMIN_PASSWORD: str = "admin1234"

    # Coverage tiers
    COVERAGE_TIERS: dict = {
        "basic": {"coverage_pct": 0.50, "weekly_premium": 49.0},
        "protection": {"coverage_pct": 0.75, "weekly_premium": 79.0},
        "advanced": {"coverage_pct": 1.00, "weekly_premium": 119.0},
    }

    # Payout constants (from README)
    BASE_PAY: float = 800.0        # daily average proxy
    SCALING_FACTOR: float = 0.8
    AVG_RAIN: float = 5.0
    MAX_AQI: float = 500.0
    MAX_TEMP: float = 50.0

    # Trigger thresholds
    RAIN_THRESH: float = 15.0
    AQI_THRESH: float = 200.0
    HEAT_THRESH: float = 42.0

    # Fraud routing
    FRAUD_AUTO_APPROVE: float = 30.0
    FRAUD_HOLD: float = 70.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
