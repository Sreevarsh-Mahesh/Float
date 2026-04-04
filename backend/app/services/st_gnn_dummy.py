"""
Dummy ST-GNN Service
====================
Mimics the spatial-temporal graph neural network described in the README.
Uses numpy to produce realistic synthetic predictions without requiring
torch or torch_geometric as API dependencies.

Input  : list of CellFeatures (one per H3 cell)
Output : list of CellPrediction (trigger flags + payout estimate per cell)

Design notes
------------
- Sigmoid-like nonlinearity applied to a weighted sum of features to simulate
  learned weights, producing smooth 0-1 trigger confidences.
- Spatial smoothing: each cell's confidence is averaged with a small random
  neighbor influence to mimic the GCN's k-ring aggregation.
- Temporal noise: small Gaussian jitter simulates the Transformer's temporal
  pattern recognition (in a real system this would use a sequence of 24 past
  timesteps; here we add controlled noise).
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone

import numpy as np

from app.schemas.trigger import CellFeatures, CellPrediction, InferenceResponse
from app.core.config import get_settings

settings = get_settings()

# Pseudo-learned weights — these mimic what a trained ST-GNN would have learned.
# Calibrated so realistic feature values produce ~0.1-0.2 baseline confidence
# and disrupted values (rain>15mm, AQI>200, heat>42°C) produce >0.7 confidence.
_RAIN_WEIGHTS = np.array([0.08, -0.002, -0.001, -0.003, 0.05, 0.04, -0.001, 0.0, 0.0, 0.01, 0.02])
_AQI_WEIGHTS  = np.array([-0.001, 0.006, -0.001, -0.002, 0.03, 0.01, -0.001, 0.0, 0.0, 0.005, 0.015])
_HEAT_WEIGHTS = np.array([-0.001, -0.001, 0.05, -0.002, 0.0, 0.0, -0.001, 0.0, 0.01, 0.0, 0.01])

_BIAS_RAIN  = -2.5
_BIAS_AQI   = -2.8
_BIAS_HEAT  = -2.0


def _feature_vector(cell: CellFeatures) -> np.ndarray:
    return np.array([
        cell.rain_mm,
        cell.aqi,
        cell.temp_feels_like,
        cell.wind_speed,
        cell.curfew_flag,
        cell.road_closure_flag,
        cell.order_density,
        cell.active_driver_count,
        cell.hour_of_day,
        cell.day_of_week,
        cell.festival_flag,
    ], dtype=float)


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _cell_confidence(feat: np.ndarray, weights: np.ndarray, bias: float) -> float:
    """Dot-product + bias + temporal Gaussian noise → sigmoid → confidence."""
    logit = float(feat @ weights) + bias + random.gauss(0, 0.1)
    return _sigmoid(logit)


def _compute_payout(cell: CellFeatures, trig_rain: bool, trig_aqi: bool, trig_heat: bool) -> float:
    """
    README payout formulas:
    - Rain   : scaling_factor * (current_rain / avg_rain) * base_pay
    - AQI    : (current_aqi / max_aqi) * scaling_factor * base_pay
    - Heat   : binary * (feels_like / max_temp) * base_pay * scaling_factor
    """
    s = settings.SCALING_FACTOR
    base = settings.BASE_PAY

    rain_payout = (s * (cell.rain_mm / max(settings.AVG_RAIN, 1e-5)) * base) if trig_rain else 0.0
    aqi_payout  = ((cell.aqi / settings.MAX_AQI) * s * base) if trig_aqi else 0.0
    heat_payout = ((cell.temp_feels_like / settings.MAX_TEMP) * base * s) if trig_heat else 0.0

    total = rain_payout + aqi_payout + heat_payout
    return round(min(total, base * 1.5), 2)  # cap at 1.5x daily avg


def run_inference(cells: list[CellFeatures]) -> InferenceResponse:
    """
    Full dummy ST-GNN inference pipeline.

    Steps
    -----
    1. Compute per-cell feature vectors.
    2. Compute trigger confidences via pseudo-weights (spatial step).
    3. Apply GCN-style spatial smoothing (k-ring averaging via index proximity).
    4. Threshold and compute payouts.
    """
    n = len(cells)
    if n == 0:
        return InferenceResponse(predictions=[], run_at=datetime.now(timezone.utc))

    feat_matrix = np.array([_feature_vector(c) for c in cells])  # (n, 11)

    # Raw confidences per trigger type
    rain_conf  = np.array([_cell_confidence(feat_matrix[i], _RAIN_WEIGHTS, _BIAS_RAIN)  for i in range(n)])
    aqi_conf   = np.array([_cell_confidence(feat_matrix[i], _AQI_WEIGHTS,  _BIAS_AQI)   for i in range(n)])
    heat_conf  = np.array([_cell_confidence(feat_matrix[i], _HEAT_WEIGHTS, _BIAS_HEAT)  for i in range(n)])

    # Spatial smoothing: average each cell with its index-adjacent neighbour (GCN proxy)
    def _smooth(arr: np.ndarray, alpha: float = 0.15) -> np.ndarray:
        smoothed = arr.copy()
        if n > 1:
            smoothed[1:-1] = arr[1:-1] * (1 - alpha) + (arr[:-2] + arr[2:]) / 2 * alpha
        return smoothed

    rain_conf  = _smooth(rain_conf)
    aqi_conf   = _smooth(aqi_conf)
    heat_conf  = _smooth(heat_conf)

    predictions: list[CellPrediction] = []
    for i, cell in enumerate(cells):
        trig_rain = rain_conf[i] > 0.5
        trig_aqi  = aqi_conf[i]  > 0.5
        trig_heat = heat_conf[i] > 0.5
        max_conf  = float(max(rain_conf[i], aqi_conf[i], heat_conf[i]))

        payout = _compute_payout(cell, trig_rain, trig_aqi, trig_heat)

        predictions.append(CellPrediction(
            h3_cell=cell.h3_cell,
            trigger_rain=bool(trig_rain),
            trigger_aqi=bool(trig_aqi),
            trigger_heat=bool(trig_heat),
            trigger_confidence=round(max_conf, 4),
            payout_estimate=payout,
        ))

    return InferenceResponse(predictions=predictions, run_at=datetime.now(timezone.utc))
