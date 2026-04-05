import enum


class CoverageTierEnum(str, enum.Enum):
    basic = "basic"
    protection = "protection"
    advanced = "advanced"


class PolicyStatusEnum(str, enum.Enum):
    active = "active"
    paused = "paused"
    expired = "expired"
    cancelled = "cancelled"


class TriggerCategoryEnum(str, enum.Enum):
    environmental = "environmental"
    acts_of_god = "acts_of_god"
    road_anomaly = "road_anomaly"
    market_delay = "market_delay"
    social_infrastructure = "social_infrastructure"


class TriggerTypeEnum(str, enum.Enum):
    rain = "rain"
    aqi = "aqi"
    extreme_heat = "extreme_heat"
    flood = "flood"
    landslide = "landslide"
    earthquake = "earthquake"
    cyclone = "cyclone"
    road_closure = "road_closure"
    speed_anomaly = "speed_anomaly"
    platform_downtime = "platform_downtime"
    oversupply_delay = "oversupply_delay"
    protest = "protest"
    curfew = "curfew"
    cell_tower_outage = "cell_tower_outage"


class ClaimStatusEnum(str, enum.Enum):
    pending = "pending"
    auto_approved = "auto_approved"
    flagged_review = "flagged_review"
    manual_review = "manual_review"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"


class TransportModeEnum(str, enum.Enum):
    bike = "bike"
    bicycle = "bicycle"
    foot = "foot"
    car = "car"


class PlatformEnum(str, enum.Enum):
    zomato = "zomato"
    swiggy = "swiggy"
    blinkit = "blinkit"
    zepto = "zepto"
    dunzo = "dunzo"
    other = "other"


class ModelStageEnum(str, enum.Enum):
    training = "training"
    staging = "staging"
    production = "production"
    retired = "retired"
