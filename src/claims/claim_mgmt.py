"""
Float Claims Management Engine
Zero-touch claims pipeline backend demo
"""

import math
import random
import time
from datetime import datetime
from tabulate import tabulate

# config
PAYOUT_TABLE = {
    "heavy_rain": {"rate_per_hour": 250, "daily_cap": 750},
    "severe_aqi": {"rate_per_hour": 200, "daily_cap": 600},
    "extreme_heat": {"rate_per_hour": 150, "daily_cap": 450},
    "curfew": {"rate_per_hour": 300, "daily_cap": 900},
    "bandh": {"rate_per_hour": 300, "daily_cap": 900},
}

TIER_MULTIPLIERS = {
    "Basic": 0.50,
    "Protection": 0.75,
    "Advanced Protection": 1.00,
}

FRAUD_SCORE_THRESHOLDS = {
    "auto_approve": 30,
    "flag": 70,
}

MIN_EVENT_DURATION_HOURS = 2
WEEKLY_DAY_CAP = 4

# mock db generator


def generate_workers(n=12):
    workers = []
    names = ["Arjun K.", "Ravi S.", "Murugan", "Priya",
             "Karthik", "Sneha", "Rahul", "Vijay", "Anita", "Suresh"]
    zones = ["Perambur", "Anna Nagar", "Velachery", "Adyar", "T-Nagar"]
    tiers = list(TIER_MULTIPLIERS.keys())

    for i in range(n):
        workers.append({
            "id": f"W{str(i+1).zfill(3)}",
            "name": random.choice(names),
            "platform": random.choice(["Swiggy", "Zomato", "Zepto"]),
            "city": "Chennai",
            "zone": random.choice(zones),
            "h3_cell": f"892830828{random.randint(0, 4)}fffff",
            "tier": random.choice(tiers),
            "weekly_earnings_avg": random.randint(2000, 6000),
            "daily_earnings_avg": random.randint(500, 1000),
            "active_hours_avg": random.randint(6, 12),
            "claim_count_8_weeks": random.randint(0, 3),
            "speed_mu": random.uniform(18.0, 25.0),
            "speed_sigma": random.uniform(2.0, 4.0),
            "weekly_days_claimed": random.randint(0, 3),
            "gps_lat": round(random.uniform(12.9, 13.2), 4),
            "gps_lng": round(random.uniform(80.1, 80.3), 4),
        })
    return workers


WORKERS = generate_workers()


# ─── Mock Trigger Events ───────────────────────────────────────────────────────

TRIGGER_EVENTS = [
    {
        "id": "EVT001",
        "type": "heavy_rain",
        "label": "Red Alert - Heavy Rain",
        "city": "Chennai",
        "affected_h3_cells": ["8928308280fffff", "8928308282fffff", "8928308284fffff"],
        "duration_hours": 4.5,
        "source": "IMD Weather API",
        "threshold": "Rainfall > 20mm/hr for 2+ hours",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
]


def check_zone_match(worker, event):
    return worker["h3_cell"] in event["affected_h3_cells"]


def gps_cross_check(worker):
    random.seed(int(worker["id"][1:]))
    return round(random.uniform(0.0, 0.8), 2)


def personal_anomaly_check(worker):
    avg_claims_per_week = worker["claim_count_8_weeks"] / 8
    std_dev = math.sqrt(avg_claims_per_week + 0.1)
    threshold = avg_claims_per_week + (2 * std_dev)
    current_week_claims = random.randint(0, 3)

    if current_week_claims > threshold:
        return round(min(1.0, (current_week_claims - threshold) / threshold), 2)
    return 0.0


def speed_anomaly_check(worker):
    mu = worker["speed_mu"]
    sigma = worker["speed_sigma"]
    anomaly_threshold = mu - (3 * sigma)

    random.seed(int(worker["id"][1:]) + 42)
    current_speed = round(random.uniform(anomaly_threshold - 5, mu + 2), 1)

    score = 0.0 if current_speed < anomaly_threshold else round(
        random.uniform(0.2, 0.9), 2)
    return score, current_speed, anomaly_threshold


def cohort_cross_check(workers_in_zone, event):
    total = len(workers_in_zone)
    if total == 0:
        return 0.0

    triggering = len(
        [w for w in workers_in_zone if w["h3_cell"] in event["affected_h3_cells"]])
    trigger_rate = triggering / total

    if 0.6 <= trigger_rate <= 0.9:
        return 0.0
    elif trigger_rate < 0.1 or trigger_rate > 0.95:
        return 0.6
    return 0.2


def compute_fraud_score(gps, anomaly, speed, cohort):
    weighted = (gps * 35 + anomaly * 25 + speed * 25 + cohort * 15)
    return round(min(100, weighted), 1)


def calculate_payout(worker, event):
    if event["duration_hours"] < MIN_EVENT_DURATION_HOURS:
        return 0, "Event duration below 2-hour minimum threshold"

    event_config = PAYOUT_TABLE[event["type"]]
    tier_multiplier = TIER_MULTIPLIERS[worker["tier"]]

    raw_payout = event["duration_hours"] * event_config["rate_per_hour"]
    capped_payout = min(raw_payout, event_config["daily_cap"])
    final_payout = round(capped_payout * tier_multiplier, 2)

    days_remaining = WEEKLY_DAY_CAP - worker["weekly_days_claimed"]
    if days_remaining <= 0:
        return 0, "Weekly day cap (4 days) already reached"

    return final_payout, "ok"


def run_claims_pipeline():
    print("--- Float Claims Management Engine ---")
    print("Starting process...")
    print()

    for event in TRIGGER_EVENTS:
        print(f"Trigger Detected: {event['label']} in {event['city']}")
        print(
            f"Duration: {event['duration_hours']}h | Source: {event['source']}")

        matched_workers = [w for w in WORKERS if check_zone_match(w, event)]
        print(
            f"Initial Scan: Found {len(matched_workers)} worker(s) in affected zones.")
        print()

        results = []
        for worker in matched_workers:
            print(f"Processing Claim for {worker['name']} ({worker['id']})")
            print(
                f"  Tier: {worker['tier']} | Zone: {worker['zone']} | Platform: {worker['platform']}")

            gps_score = gps_cross_check(worker)
            anomaly_score = personal_anomaly_check(
                worker) * 0.5  # reduced strictness
            speed_score, curr_speed, speed_thresh = speed_anomaly_check(worker)
            cohort_score = cohort_cross_check(WORKERS, event)

            fraud_score = compute_fraud_score(
                gps_score, anomaly_score, speed_score, cohort_score)

            print("  [Validation Diagnostics]")
            print(f"    - Layer 1 (GPS Cross-Check): {gps_score}")
            print(f"    - Layer 2 (Personal Anomaly): {anomaly_score}")
            print(
                f"    - Layer 3 (Speed Anomaly): {speed_score} (curr: {curr_speed}km/h vs cutoff: {round(speed_thresh, 1)}km/h)")
            print(f"    - Layer 4 (Cohort Benchmark): {cohort_score}")

            if fraud_score < FRAUD_SCORE_THRESHOLDS["auto_approve"]:
                routing = "AUTO_APPROVED"
            elif fraud_score < FRAUD_SCORE_THRESHOLDS["flag"]:
                routing = "APPROVED_FLAGGED"
            else:
                routing = "HELD_FOR_REVIEW"

            print(
                f"  -> Fraud Score: {fraud_score}/100 -> Decision: {routing}")

            if routing == "HELD_FOR_REVIEW":
                payout = 0
                status = "HELD"
                print("  -> Result: Payout suspended pending manual admin review.")
            else:
                payout, reason = calculate_payout(worker, event)
                if payout == 0:
                    status = f"REJECTED ({reason})"
                    print(f"  -> Result: {status}")
                else:
                    status = "PAID_FLAGGED" if routing == "APPROVED_FLAGGED" else "PAID"
                    print(f"  -> Result: Authorized {status}")
                    print(
                        f"  -> Payout details: Rs. {payout} (Tier Multiplier: {TIER_MULTIPLIERS[worker['tier']]})")

            print("-" * 50)

            results.append({
                "worker": worker["name"],
                "score": fraud_score,
                "routing": routing,
                "payout": payout,
                "status": status
            })

        print()
        print("=== Claims Summary ===")
        total_paid = sum(r["payout"] for r in results)
        print(f"Total claims evaluated: {len(results)}")

        table_data = [
            [r["worker"], r["status"], r["score"], f"Rs. {r['payout']}"]
            for r in results
        ]
        headers = ["Worker", "Status", "Final Score", "Amount"]
        print(tabulate(table_data, headers=headers, tablefmt="simple"))

        print()
        print(f"Total processed payout today: Rs. {total_paid}")
        print()


if __name__ == "__main__":
    run_claims_pipeline()
