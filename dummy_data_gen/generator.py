import os
import math
import torch
import h3
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from torch_geometric.data import Data
from tqdm import tqdm

"""
Dummy Data Generator for Float: ST-GNN
Generates 3 months of 1-hour resolution data over Chennai at h3 resolution 9.
Simulates environmental disruption events using Space-Time Gaussians.
"""

######################
# CONFIGURATION
######################
RES = 9
NUM_DAYS = 90
HOURS_PER_DAY = 24
NUM_TIMESTEPS = NUM_DAYS * HOURS_PER_DAY
NUM_EVENTS = 15
CITY_POLY = [(13.15, 80.10), (13.15, 80.30), (12.90, 80.30), (12.90, 80.10), (13.15, 80.10)]
START_DATE = datetime(2025, 6, 1) # Start in monsoon season

# Base values
BASE_PAY = 800  # daily average
PAY_VARIANCE = 150 # sigma
######################

def main():
    print("1. Generating H3 Grids for Chennai...")
    try:
        # H3 v4 API
        poly = h3.LatLngPoly(CITY_POLY)
        cells = list(h3.polygon_to_cells(poly, RES))
    except AttributeError:
        # H3 v3 API fallback
        geo_json_fixed = {"type": "Polygon", "coordinates": [[[lng, lat] for lat, lng in CITY_POLY]]}
        cells = list(h3.polyfill(geo_json_fixed, RES, geo_json_conformant=True))
        
    num_nodes = len(cells)
    
    # Create mapping
    cell_to_idx = {c: i for i, c in enumerate(cells)}
    idx_to_cell = {i: c for c, i in cell_to_idx.items()}
    print(f"Generated {num_nodes} spatial nodes.")

    print("2. Building Adjacency Matrix (k-ring 1)...")
    edge_src = []
    edge_dst = []
    
    try:
        k_ring_func = h3.grid_disk
    except AttributeError:
        k_ring_func = h3.k_ring
        
    for c in cells:
        neighbors = k_ring_func(c, 1)
        for n in neighbors:
            if n in cell_to_idx: # boundary check
                edge_src.append(cell_to_idx[c])
                edge_dst.append(cell_to_idx[n])
    
    edge_index = torch.tensor([edge_src, edge_dst], dtype=torch.long)
    print(f"Created {edge_index.shape[1]} edges.")
    
    print("3. Precomputing Spatial Info...")
    try:
        geo_func = h3.cell_to_latlng
    except AttributeError:
        geo_func = h3.h3_to_geo
        
    latlngs = np.array([geo_func(c) for c in cells]) # shape: (N, 2)
    
    num_features = 11
    X = np.zeros((num_nodes, NUM_TIMESTEPS, num_features), dtype=np.float32)
    
    print("4. Generating Base Features (Time, Density)...")
    for t in tqdm(range(NUM_TIMESTEPS)):
        current_time = START_DATE + timedelta(hours=t)
        hour = current_time.hour
        day = current_time.weekday()
        
        X[:, t, 8] = hour
        X[:, t, 9] = day
        # baseline wind
        X[:, t, 3] = np.random.normal(10, 2, num_nodes)
        
        # simulated order density: peaks at 1pm and 8pm
        peak_multi = np.sin((hour-13)/24 * np.pi)**2 + np.sin((hour-20)/24 * np.pi)**2
        X[:, t, 6] = np.clip(np.random.normal(50 + 50*peak_multi, 10, num_nodes), 10, 200)
        X[:, t, 7] = X[:, t, 6] * np.random.uniform(0.7, 1.0, num_nodes) # active drivers

        # festival random
        X[:, t, 10] = 1 if (t % (24*15) < 24) else 0 
        
    print("5. Spatiotemporal Events (Gaussians)...")
    np.random.seed(42)
    base_rain = 0.0
    base_aqi = 60.0
    base_heat = 32.0 
    
    X[:, :, 0] = base_rain
    X[:, :, 1] = np.random.normal(base_aqi, 10, (num_nodes, NUM_TIMESTEPS))
    X[:, :, 2] = np.random.normal(base_heat, 2, (num_nodes, NUM_TIMESTEPS)) + (np.sin((X[:, :, 8] - 6) / 24 * 2 * np.pi) * 5)
    
    latlngs_rad = np.radians(latlngs)
    
    for i in range(NUM_EVENTS):
        etype = np.random.choice([0, 1, 2])
        
        center_idx = np.random.randint(0, num_nodes)
        
        lat1, lon1 = latlngs[:, 0], latlngs[:, 1]
        clat, clon = latlngs[center_idx, 0], latlngs[center_idx, 1]
        dx = (lon1 - clon) * np.cos(np.radians((lat1 + clat) / 2))
        dy = (lat1 - clat)
        dist_km = np.sqrt(dx**2 + dy**2) * 111.0 
        
        sigma_s = np.random.uniform(2.0, 8.0) 
        spatial_gaussian = np.exp(-(dist_km**2) / (2 * sigma_s**2))
        
        t_center = np.random.randint(24, NUM_TIMESTEPS - 24)
        sigma_t = np.random.uniform(4.0, 12.0) 
        t_arr = np.arange(NUM_TIMESTEPS)
        temporal_gaussian = np.exp(-((t_arr - t_center)**2) / (2 * sigma_t**2)) 
        
        event_matrix = np.outer(spatial_gaussian, temporal_gaussian) 
        intensity = np.random.uniform(0.5, 2.0)
        
        if etype == 0: 
            peak = np.random.uniform(20.0, 100.0)
            X[:, :, 0] += event_matrix * peak * intensity
        elif etype == 1: 
            peak = np.random.uniform(150.0, 400.0)
            X[:, :, 1] += event_matrix * peak * intensity
        elif etype == 2: 
            peak = np.random.uniform(5.0, 12.0)
            X[:, :, 2] += event_matrix * peak * intensity
            
        if np.random.rand() > 0.7:
            thresh = 0.5
            closure_mask = event_matrix > thresh
            X[:, :, 5] = np.logical_or(X[:, :, 5], closure_mask).astype(np.float32)

    print("6. Calculating Payouts and Triggers...")
    Y_triggers = np.zeros((num_nodes, NUM_TIMESTEPS, 3), dtype=np.float32)
    Y_payout = np.zeros((num_nodes, NUM_TIMESTEPS), dtype=np.float32)
    
    RAIN_THRESH = 15.0 
    AQI_THRESH = 200.0
    HEAT_THRESH = 42.0
    
    Y_triggers[:, :, 0] = (X[:, :, 0] > RAIN_THRESH).astype(np.float32)
    Y_triggers[:, :, 1] = (X[:, :, 1] > AQI_THRESH).astype(np.float32)
    Y_triggers[:, :, 2] = (X[:, :, 2] > HEAT_THRESH).astype(np.float32)
    
    AVG_RAIN = 5.0
    MAX_AQI = 500.0
    MAX_TEMP = 50.0
    SCALING_FACTOR = 0.8
    
    rain_payout = Y_triggers[:, :, 0] * (SCALING_FACTOR * (np.clip(X[:, :, 0], 0, 100) / AVG_RAIN) * BASE_PAY)
    aqi_payout = Y_triggers[:, :, 1] * ((np.clip(X[:, :, 1], 0, MAX_AQI) / MAX_AQI) * SCALING_FACTOR * BASE_PAY)
    heat_payout = Y_triggers[:, :, 2] * ((np.clip(X[:, :, 2], 0, MAX_TEMP) / MAX_TEMP) * SCALING_FACTOR * BASE_PAY)
    
    Y_payout = rain_payout + aqi_payout + heat_payout
    Y_payout = np.clip(Y_payout, 0, BASE_PAY * 1.5) 
    
    print("7. Exporting to PyTorch Geometric and CSV...")
    tensor_X = torch.tensor(X, dtype=torch.float)
    tensor_y_triggers = torch.tensor(Y_triggers, dtype=torch.float)
    tensor_y_payout = torch.tensor(Y_payout, dtype=torch.float)
    
    pyg_data = Data(x=tensor_X, edge_index=edge_index, y_triggers=tensor_y_triggers, y_payout=tensor_y_payout)
    
    out_dir = os.path.dirname(os.path.abspath(__file__))
    pt_path = os.path.join(out_dir, "st_gnn_chennai_data.pt")
    torch.save(pyg_data, pt_path)
    print(f"Saved PyG Data to {pt_path}")
    
    csv_path = os.path.join(out_dir, "st_gnn_chennai_data.csv")
    print("Writing CSV in chunks... this might take a minute.")
    
    columns = [
        "timestamp", "h3_index", "node_id", 
        "rain", "aqi", "heat", "wind", "curfew", "road_closure",
        "order_density", "active_driver_count", "hour_of_day", "day_of_week", "festival",
        "trigger_rain", "trigger_aqi", "trigger_heat", "payout"
    ]
    
    chunk_size = 24 * 5 
    for t_start in tqdm(range(0, NUM_TIMESTEPS, chunk_size)):
        t_end = min(t_start + chunk_size, NUM_TIMESTEPS)
        
        chunk_records = []
        for t in range(t_start, t_end):
            curr_time = START_DATE + timedelta(hours=t)
            time_str = curr_time.strftime("%Y-%m-%d %H:%M:%S")
            
            for n in range(num_nodes):
                row = [
                    time_str, idx_to_cell[n], n,
                    X[n, t, 0], X[n, t, 1], X[n, t, 2], X[n, t, 3],
                    X[n, t, 4], X[n, t, 5], X[n, t, 6], X[n, t, 7],
                    X[n, t, 8], X[n, t, 9], X[n, t, 10],
                    Y_triggers[n, t, 0], Y_triggers[n, t, 1], Y_triggers[n, t, 2],
                    Y_payout[n, t]
                ]
                chunk_records.append(row)
        
        df = pd.DataFrame(chunk_records, columns=columns)
        mode = 'w' if t_start == 0 else 'a'
        header = True if t_start == 0 else False
        df.to_csv(csv_path, mode=mode, header=header, index=False)
        
    print(f"Saved CSV to {csv_path}")
    print("Dummy data generation complete!")

if __name__ == "__main__":
    main()
