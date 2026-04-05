"""
Inference Router
================
Exposes the Dummy ST-GNN as an API endpoint.

POST /inference/run
    - Accepts a list of H3 cells with feature vectors
    - Returns per-cell trigger flags + payout estimates
    - Persists TriggerEvents for cells where any trigger fired
    - Enqueues ClaimProcessor as a BackgroundTask for affected zones

POST /inference/batch-simulate
    - Admin convenience: generate synthetic inputs for N random cells
      and run inference — useful for testing without a real mobile app.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.dependencies import DbDep, get_current_user
from app.core.rbac import Role, require_role
from app.models.trigger_event import TriggerEvent
from app.schemas.trigger import (
    CellFeatures,
    InferenceRequest,
    InferenceResponse,
    TriggerEventOut,
)
from app.services import st_gnn_dummy
from app.services.claim_processor import process_trigger_for_zone

router = APIRouter(prefix="/inference", tags=["ST-GNN Inference"])

# Admin-only guard
_admin_guard = Depends(require_role(Role.ADMIN))


def _persist_and_dispatch(trigger_id: int, db_factory) -> None:
    """
    Background task: reload the TriggerEvent and run claim processor.
    Called after commit so the event is visible in a new session.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        trigger = db.get(TriggerEvent, trigger_id)
        if trigger:
            process_trigger_for_zone(trigger, db)
    finally:
        db.close()


@router.post("/run", response_model=InferenceResponse, dependencies=[_admin_guard])
def run_inference(
    request: InferenceRequest,
    background_tasks: BackgroundTasks,
    db: DbDep,
):
    """
    Run the dummy ST-GNN on a list of H3 cells.
    Persists TriggerEvents for cells with any trigger fired.
    Schedules claim processing as a background task.
    """
    if not request.cells:
        raise HTTPException(status_code=422, detail="No cells provided.")

    result = st_gnn_dummy.run_inference(request.cells)

    # Persist trigger events for triggered cells
    triggered_ids: list[int] = []
    for pred, cell in zip(result.predictions, request.cells):
        if not (pred.trigger_rain or pred.trigger_aqi or pred.trigger_heat):
            continue

        # Determine dominant event type
        confs = {
            "rain": pred.trigger_rain,
            "aqi": pred.trigger_aqi,
            "heat": pred.trigger_heat,
        }
        event_type = max(
            (k for k, v in confs.items() if v),
            key=lambda k: getattr(pred, f"trigger_{k}"),
            default="rain",
        )

        trigger = TriggerEvent(
            h3_cell=pred.h3_cell,
            event_type=event_type,
            intensity=getattr(cell, f"{event_type}_mm" if event_type == "rain" else
                              ("aqi" if event_type == "aqi" else "temp_feels_like"), 0.0),
            raw_features=cell.model_dump(),
            trigger_confidence=pred.trigger_confidence,
            payout_estimate=pred.payout_estimate,
            source="stgnn",
        )
        db.add(trigger)
        db.flush()
        triggered_ids.append(trigger.id)

    db.commit()

    # Schedule claim processing in background
    for tid in triggered_ids:
        background_tasks.add_task(_persist_and_dispatch, tid, None)

    return result


@router.post(
    "/batch-simulate",
    response_model=InferenceResponse,
    dependencies=[_admin_guard],
)
def batch_simulate(
    num_cells: int = 10,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: DbDep = None,
):
    """
    Generate N synthetic cell feature vectors and run inference.
    Useful for demo/testing without a real mobile app.
    """
    if not 1 <= num_cells <= 100:
        raise HTTPException(status_code=422, detail="num_cells must be between 1 and 100.")

    # Sample H3 cells from Chennai (resolution 9) — realistic-looking hex IDs
    DEMO_CELLS = [
        "891e35b1177ffff", "891e35b1163ffff", "891e35b116bffff",
        "891e35b116fffff", "891e35b1173ffff", "891e35b117bffff",
        "891e35b109bffff", "891e35b1093ffff", "891e35b108bffff",
        "891e35b1083ffff",
    ]

    cells = []
    for i in range(num_cells):
        h3_cell = DEMO_CELLS[i % len(DEMO_CELLS)]
        rain = random.uniform(0, 60)
        aqi = random.uniform(40, 350)
        temp = random.uniform(28, 47)
        cells.append(CellFeatures(
            h3_cell=h3_cell,
            rain_mm=rain,
            aqi=aqi,
            temp_feels_like=temp,
            wind_speed=random.uniform(5, 30),
            curfew_flag=random.choice([0, 0, 0, 1]),
            road_closure_flag=random.choice([0, 0, 1]),
            order_density=random.uniform(10, 120),
            active_driver_count=random.uniform(5, 80),
            hour_of_day=random.randint(0, 23),
            day_of_week=random.randint(0, 6),
            festival_flag=random.choice([0, 0, 1]),
        ))

    return run_inference(InferenceRequest(cells=cells), background_tasks, db)


@router.get("/trigger-events", response_model=list[TriggerEventOut], dependencies=[_admin_guard])
def list_trigger_events(db: DbDep, limit: int = 50, offset: int = 0):
    """List recent trigger events (admin only)."""
    from app.models.trigger_event import TriggerEvent
    events = (
        db.query(TriggerEvent)
        .order_by(TriggerEvent.triggered_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [TriggerEventOut.model_validate(e) for e in events]


@router.get("/grid/{h3_cell}", response_model=list[TriggerEventOut])
def get_grid_context(
    h3_cell: str,
    db: DbDep,
    current_user = Depends(get_current_user), # Require auth
):
    """Fetch active and recent past disruption events in a specific H3 cell."""
    from app.models.trigger_event import TriggerEvent
    events = (
        db.query(TriggerEvent)
        .filter(TriggerEvent.h3_cell == h3_cell)
        .order_by(TriggerEvent.triggered_at.desc())
        .limit(5)
        .all()
    )
    return [TriggerEventOut.model_validate(e) for e in events]
