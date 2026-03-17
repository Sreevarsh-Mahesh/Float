import h3

# Resolution 9 is roughly the size of a few city blocks (~0.1 sq km)
H3_RESOLUTION = 9


def get_driver_location_index(lat: float, lng: float) -> str:
    """Convert raw GPS coordinates into an H3 cell index."""
    return h3.latlng_to_cell(lat, lng, H3_RESOLUTION)


if __name__ == "__main__":
    driver_lat, driver_lng = 26.8467, 80.9462
    driver_hex_id = get_driver_location_index(driver_lat, driver_lng)
    print(f"Driver is currently in Hex: {driver_hex_id}")

