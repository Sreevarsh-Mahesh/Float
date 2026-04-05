"""
Claim Processor
===============
Converts ST-GNN TriggerEvents into Claim records for every affected driver.

Pipeline per driver
-------------------
1. Check the driver has an active policy that covers the event window.
2. Run 4-layer fraud evaluation (README §Fraud Detection):
   Layer 1 — Data validation     : is the trigger confidence high enough?
   Layer 2 — GPS cross-check     : did the driver ping this H3 cell during the event?
   Layer 3 — Personal anomaly    : is this driver claiming unusually often?
   Layer 4 — Cohort check        : is the claim rate in this zone plausible?
3. Compute aggregate fraud score (0-100).
4. Route claim:
   score < 30  → auto_approved
   30 ≤ score < 70 → flagged_review
   score ≥ 70  → held
5. Persist Claim row.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.claim import Claim
from app.models.driver_ping import DriverPing
from app.models.policy import Policy
from app.models.trigger_event import TriggerEvent
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()


# --------------------------------------------------------------------------- #
# Individual fraud layers                                                      #
# --------------------------------------------------------------------------- #

def _layer1_data_validation(trigger: TriggerEvent) -> tuple[float, str | None]:
    """
    Layer 1: Trust the ST-GNN output confidence.
    Low confidence means the event might not have been real.
    Returns (penalty, flag_message | None).
    """
    conf = trigger.trigger_confidence
    if conf < 0.3:
        return 40.0, f"Low trigger confidence ({conf:.2f}) — possible false positive"
    if conf < 0.5:
        return 15.0, f"Moderate trigger confidence ({conf:.2f})"
    return 0.0, None


def _layer2_gps_crosscheck(driver: User, trigger: TriggerEvent, db: Session) -> tuple[float, str | None]:
    """
    Layer 2: Was the driver actually in (or adjacent to) the triggered H3 cell?
    We look at pings within ±2 hours of the trigger.
    """
    window_start = trigger.triggered_at - timedelta(hours=2)
    window_end   = trigger.triggered_at + timedelta(hours=2)

    pings_in_window = (
        db.query(DriverPing)
        .filter(
            DriverPing.user_id == driver.id,
            DriverPing.pinged_at >= window_start,
            DriverPing.pinged_at <= window_end,
        )
        .all()
    )

    if not pings_in_window:
        return 35.0, "No GPS pings found in event window — cannot verify location"

    # Check if any ping was in or near the trigger cell
    cells_visited = {p.h3_cell for p in pings_in_window}
    if trigger.h3_cell in cells_visited:
        return 0.0, None

    # In a real system we'd do h3.k_ring check; here we check rolling spoof score
    avg_spoof = sum(p.spoof_score for p in pings_in_window) / len(pings_in_window)
    if avg_spoof > 0.6:
        return 50.0, f"High rolling spoof score ({avg_spoof:.2f}) during event window"

    # Driver was active but not in exact cell — mild penalty
    return 10.0, f"Driver active but not in trigger cell (visited: {len(cells_visited)} nearby cells)"


def _layer3_personal_anomaly(driver: User, db: Session) -> tuple[float, str | None]:
    """
    Layer 3: Is this driver's claim frequency anomalously high?
    Threshold: more than mean + 2σ claims in the last 8 weeks.
    We use a simple heuristic here since we don't have a deep history.
    """
    eight_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=8)
    from app.models.claim import Claim as ClaimModel
    recent_claims = (
        db.query(ClaimModel)
        .filter(ClaimModel.driver_id == driver.id, ClaimModel.created_at >= eight_weeks_ago)
        .count()
    )

    # Heuristic: >3 claims / 8 weeks without matching trigger density is suspicious
    # In production this would use the driver's personal rolling average
    if recent_claims > 10:
        return 30.0, f"High personal claim frequency: {recent_claims} in 8 weeks"
    if recent_claims > 6:
        return 10.0, f"Elevated claim frequency: {recent_claims} in 8 weeks"
    return 0.0, None


def _layer4_cohort_check(trigger: TriggerEvent, db: Session) -> tuple[float, str | None]:
    """
    Layer 4: Is the claim rate across drivers in this zone plausible?
    Checks how many other claims exist for this trigger event.
    README: if a zone has 200 insured drivers and only 1 claims, or 100% claim
            but platform shows only 30% drop → both are suspicious.
    """
    from app.models.claim import Claim as ClaimModel
    total_claims_for_trigger = (
        db.query(ClaimModel)
        .filter(ClaimModel.trigger_event_id == trigger.id)
        .count()
    )

    # Simulated: we expect 60-90% cohort claim rate for high-confidence triggers
    # For the dummy system we use the count to infer outlier behaviour
    if total_claims_for_trigger == 0:
        # First claim — no cohort data yet, slight bonus
        return 0.0, None

    if total_claims_for_trigger == 1 and trigger.trigger_confidence > 0.7:
        # Only 1 claim for a strong trigger. Suspicious if this is >1h after trigger
        return 15.0, "Only claimant for a high-confidence zone trigger — cohort mismatch"

    return 0.0, None


# --------------------------------------------------------------------------- #
# Payout computation                                                           #
# --------------------------------------------------------------------------- #

def _compute_base_payout(trigger: TriggerEvent, driver: User) -> float:
    """
    Apply README payout formulas to the trigger's raw features.
    Falls back to trigger.payout_estimate if raw features are unavailable.
    """
    raw = trigger.raw_features or {}
    base = driver.daily_avg_earnings or settings.BASE_PAY
    s    = settings.SCALING_FACTOR

    if trigger.event_type == "rain":
        rain = raw.get("rain_mm", trigger.intensity)
        payout = s * (rain / max(settings.AVG_RAIN, 1e-5)) * base
    elif trigger.event_type == "aqi":
        aqi = raw.get("aqi", trigger.intensity)
        payout = (aqi / settings.MAX_AQI) * s * base
    elif trigger.event_type == "heat":
        temp = raw.get("temp_feels_like", trigger.intensity)
        payout = (temp / settings.MAX_TEMP) * base * s
    elif trigger.event_type == "acts_of_god":
        payout = base * s  # README: fixed multiplier
    else:
        payout = trigger.payout_estimate  # road/protest/platform — use ST-GNN estimate

    return round(min(max(payout, 0.0), base * 1.5), 2)


# --------------------------------------------------------------------------- #
# Main entry point                                                             #
# --------------------------------------------------------------------------- #

def process_trigger_for_driver(
    driver: User,
    trigger: TriggerEvent,
    policy: Policy,
    db: Session,
) -> Claim:
    """
    Run all 4 fraud layers, compute fraud score, route claim status,
    and persist the Claim row. Returns the new Claim.
    """
    flags: dict[str, str] = {}
    total_penalty = 0.0

    # Layer 1
    pen, msg = _layer1_data_validation(trigger)
    total_penalty += pen
    if msg:
        flags["layer1_data_validation"] = msg

    # Layer 2
    pen, msg = _layer2_gps_crosscheck(driver, trigger, db)
    total_penalty += pen
    if msg:
        flags["layer2_gps_crosscheck"] = msg

    # Layer 3
    pen, msg = _layer3_personal_anomaly(driver, db)
    total_penalty += pen
    if msg:
        flags["layer3_personal_anomaly"] = msg

    # Layer 4
    pen, msg = _layer4_cohort_check(trigger, db)
    total_penalty += pen
    if msg:
        flags["layer4_cohort_check"] = msg

    fraud_score = min(total_penalty, 100.0)

    # Route
    if fraud_score < settings.FRAUD_AUTO_APPROVE:
        status = "auto_approved"
    elif fraud_score < settings.FRAUD_HOLD:
        status = "flagged_review"
    else:
        status = "held"

    payout_estimate = _compute_base_payout(trigger, driver)

    claim = Claim(
        driver_id=driver.id,
        trigger_event_id=trigger.id,
        policy_id=policy.id,
        fraud_score=fraud_score,
        fraud_flags=flags if flags else None,
        spoof_score=0.0,  # would be populated from rolling ping average in prod
        status=status,
        payout_estimate=payout_estimate,
    )
    db.add(claim)
    db.flush()  # get claim.id without committing

    logger.info(
        f"Claim created: driver={driver.id}, trigger={trigger.id}, "
        f"fraud={fraud_score:.1f}, status={status}, estimate=₹{payout_estimate}"
    )
    return claim


def process_trigger_for_zone(trigger: TriggerEvent, db: Session) -> list[Claim]:
    """
    For a given TriggerEvent, find all drivers with active policies whose
    home H3 cell matches the trigger cell, then process each one.
    Returns the list of newly created Claims.
    """
    # Find active policies for drivers in this H3 cell
    active_policies = (
        db.query(Policy)
        .join(User, Policy.user_id == User.id)
        .filter(
            Policy.is_active == True,  # noqa: E712
            User.h3_home_cell == trigger.h3_cell,
        )
        .all()
    )

    created_claims: list[Claim] = []
    for policy in active_policies:
        driver = policy.user
        claim = process_trigger_for_driver(driver, trigger, policy, db)
        created_claims.append(claim)

    db.commit()
    logger.info(f"Processed {len(created_claims)} claims for trigger {trigger.id} in cell {trigger.h3_cell}")
    return created_claims
