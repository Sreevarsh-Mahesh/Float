"""
Automated Dispatcher
====================
Cross-links driver grid histories with live disruption data
from the disruption_analyzer.

The disruption_analyzer module:
- reads news (DuckDuckGo + OpenRouter LLM)
- gets weather data (OpenWeather)
- gets AQI data (OpenWeather Air Pollution)

and produces:
    active_disruptions = {
        hex_id: {"type": disruption_type, "payout_multiplier": float},
        ...
    }
"""

from disruption_analyzer import get_active_disruptions

# Fetch live disruption data for Lucknow
active_disruptions = get_active_disruptions(
    city_name="Lucknow",
    lat=26.8467,
    lng=80.9462,
)

# Suppose a driver -> list[grid history in last 24 hours] mapping from database
driver_dummy = {
    "driver_1": ["89311b42aebffff", "89311b42aedffff"],
    "driver_2": ["89311b42aecffff"],
    "driver_3": ["89311b42aebffff", "89311b42aecffff"],
    "driver_4": ["89311b42aedffff"],
    "driver_5": ["89311b42aebffff", "89311b42aedffff", "89311b42aecffff"],
}


def checkDriver(driver_id: str):
    """Check which active disruptions affect a given driver's recent hex history."""
    driver_hexes = driver_dummy[driver_id]
    disruptions = []
    for hex_id in driver_hexes:
        if hex_id in active_disruptions:
            disruptions.append(active_disruptions[hex_id])
    return disruptions


def runForEveryDriver():
    """Run disruption check for all drivers and print results."""
    print(f"\n=== Dispatcher: {len(active_disruptions)} hexes with active disruptions ===\n")
    for driver_id in driver_dummy:
        disruptions = checkDriver(driver_id)
        if disruptions:
            print(f"Driver {driver_id} affected by: {disruptions}")
        else:
            print(f"Driver {driver_id}: no active disruptions in recent area")


if __name__ == "__main__":
    runForEveryDriver()






