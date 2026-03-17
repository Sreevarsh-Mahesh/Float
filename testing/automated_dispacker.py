
"""
Suppose we have a task that
- reads the news
- gets weather data
- gets aqi data
- gets government notification

and pushed this data as a
active_disruptions = {
    "89311b42aebffff": {"type": "SEVERE_WATERLOGGING", "payout_multiplier": 1.5},
    "89311b42aedffff": {"type": "SUDDEN_CURFEW", "payout_multiplier": 2.0},
    "89311b42aecffff": {"type": "HAZARDOUS_AQI", "payout_multiplier": 1.2}
}

this is a
hex id -> {
    "type": type of disruption,
    "payout mult thingy": how muc should the payout be multiplied
}
"""

# dummmy data

active_disruptions = {
    "89311b42aebffff": {"type": "SEVERE_WATERLOGGING", "payout_multiplier": 1.5},
    "89311b42aedffff": {"type": "SUDDEN_CURFEW", "payout_multiplier": 2.0},
    "89311b42aecffff": {"type": "HAZARDOUS_AQI", "payout_multiplier": 1.2}
}


#suppose a driver -> list[grid history in last 24 hour] mapping from data base

driver_dummy = {
    "driver_1": ["89311b42aebffff", "89311b42aedffff"],
    "driver_2": ["89311b42aecffff"],
    "driver_3": ["89311b42aebffff", "89311b42aecffff"],
    "driver_4": ["89311b42aedffff"],
    "driver_5": ["89311b42aebffff", "89311b42aedffff", "89311b42aecffff"]
}


# then we check and cross link by

def checkDriver(driver_hex: str):
    driver = driver_dummy[driver_hex]
    disruptions = []
    for hex_id in driver:
        disruptions.append(active_disruptions[hex_id])
    return disruptions

def runForEveryDriver():
    drivers = driver_dummy.keys()
    for driver in drivers:
        disruptions = checkDriver(driver)
        print(f"Driver {driver} has the following disruptions: {disruptions}")


if __name__ == "__main__":
    runForEveryDriver()






