"""
Claim Dispatcher
================
Takes auto_approved Claims and produces Payout rows + Notification records.

Simulates real disbursement by generating a dummy UPI transaction reference.

Called as a FastAPI BackgroundTask after the claim processor runs, or can be
invoked manually via the admin endpoint for batch re-dispatch.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.claim import Claim
from app.models.payout import Notification, Payout

logger = logging.getLogger(__name__)


def _generate_upi_ref() -> str:
    """Simulated UPI transaction reference (16-char uppercase hex)."""
    return uuid.uuid4().hex[:16].upper()


def dispatch_claim(claim: Claim, db: Session) -> Payout | None:
    """
    Dispatch a single auto_approved claim → Payout + Notification.
    Returns the Payout object, or None if skipped (wrong status / already paid).
    """
    if claim.status != "auto_approved":
        logger.debug(f"Claim {claim.id} skipped (status={claim.status})")
        return None

    if claim.payout:
        logger.debug(f"Claim {claim.id} already has a payout ({claim.payout.id})")
        return claim.payout

    policy = claim.policy
    coverage_pct = policy.coverage_pct  # 0.50 | 0.75 | 1.00
    base_amount  = claim.payout_estimate
    final_amount = round(base_amount * coverage_pct, 2)

    payout = Payout(
        claim_id=claim.id,
        driver_id=claim.driver_id,
        base_amount=base_amount,
        tier_multiplier=coverage_pct,
        final_amount=final_amount,
        status="disbursed",
        transaction_ref=_generate_upi_ref(),
        disbursed_at=datetime.now(timezone.utc),
    )
    db.add(payout)
    db.flush()

    # Update claim status to 'paid'
    claim.status = "paid"
    claim.resolved_at = datetime.now(timezone.utc)

    # Create notification
    trigger = claim.trigger_event
    notif = Notification(
        user_id=claim.driver_id,
        claim_id=claim.id,
        payout_id=payout.id,
        title="Float Payout Credited 💸",
        body=(
            f"₹{final_amount:.0f} has been credited to your account for the "
            f"{trigger.event_type.replace('_', ' ').title()} event in your zone "
            f"({trigger.h3_cell}). Policy: {policy.tier.title()} ({int(coverage_pct*100)}% coverage). "
            f"Ref: {payout.transaction_ref}"
        ),
    )
    db.add(notif)
    db.flush()

    logger.info(
        f"Dispatched payout {payout.id}: driver={claim.driver_id}, "
        f"claim={claim.id}, amount=₹{final_amount}, ref={payout.transaction_ref}"
    )
    return payout


def dispatch_all_pending(db: Session) -> list[Payout]:
    """
    Batch-dispatch all auto_approved claims that don't yet have a payout.
    Used for admin batch re-run or background tasks.
    """
    pending_claims = (
        db.query(Claim)
        .filter(Claim.status == "auto_approved")
        .outerjoin(Payout, Payout.claim_id == Claim.id)
        .filter(Payout.id.is_(None))
        .all()
    )

    payouts: list[Payout] = []
    for claim in pending_claims:
        payout = dispatch_claim(claim, db)
        if payout:
            payouts.append(payout)

    if payouts:
        db.commit()
        logger.info(f"Batch dispatch complete: {len(payouts)} payouts created.")

    return payouts
