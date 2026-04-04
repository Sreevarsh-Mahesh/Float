#!/usr/bin/env python3
"""
Chennai ST-GNN Data Visualization
Loads dummy data, computes per-grid statistics, and renders H3 hexagons on an interactive map.
"""

import pandas as pd
import numpy as np
import torch
import h3
import folium
from folium.plugins import HeatMap
import matplotlib.pyplot as plt
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "dummy_data_gen"
OUTPUT_DIR = Path(__file__).parent
CSV_FILE = DATA_DIR / "st_gnn_chennai_data.csv"
PT_FILE = DATA_DIR / "st_gnn_chennai_data.pt"

# Chennai center coordinates
CHENNAI_CENTER = [13.02, 80.20]

def load_data(sample_size=None):
    """Load CSV data, optionally sampling for performance."""
    print("Loading CSV data...")
    if sample_size:
        # Read header first, then sample
        df = pd.read_csv(CSV_FILE, nrows=sample_size)
    else:
        df = pd.read_csv(CSV_FILE)
    print(f"  Loaded {len(df):,} rows")
    return df

def load_pt_data():
    """Load PyTorch Geometric data."""
    print("Loading PT data...")
    data = torch.load(PT_FILE, map_location='cpu', weights_only=False)
    print(f"  x shape: {data.x.shape}")
    print(f"  edge_index shape: {data.edge_index.shape}")
    return data

def compute_grid_stats(df):
    """Compute statistics per H3 grid cell."""
    print("\nComputing per-grid statistics...")
    
    feature_cols = ['rain', 'aqi', 'heat', 'wind', 'order_density', 'active_driver_count']
    trigger_cols = ['trigger_rain', 'trigger_aqi', 'trigger_heat']
    
    # Aggregate stats per h3_index
    agg_funcs = {col: ['min', 'max', 'mean', 'std', 'count'] for col in feature_cols}
    agg_funcs['payout'] = ['sum', 'mean', 'max', 'count']
    for col in trigger_cols:
        agg_funcs[col] = ['sum', 'mean']
    
    stats = df.groupby('h3_index').agg(agg_funcs)
    stats.columns = ['_'.join(col).strip() for col in stats.columns.values]
    stats = stats.reset_index()
    
    print(f"  Computed stats for {len(stats):,} unique H3 cells")
    return stats

def print_summary_stats(stats):
    """Print summary statistics table."""
    print("\n" + "="*80)
    print("GRID STATISTICS SUMMARY")
    print("="*80)
    
    summary_cols = [
        ('rain_mean', 'Rain (mm)', 'mean'),
        ('aqi_mean', 'AQI', 'mean'),
        ('heat_mean', 'Heat (°C)', 'mean'),
        ('wind_mean', 'Wind (km/h)', 'mean'),
        ('order_density_mean', 'Order Density', 'mean'),
        ('active_driver_count_mean', 'Active Drivers', 'mean'),
        ('payout_sum', 'Total Payout (₹)', 'sum'),
        ('trigger_rain_mean', 'Rain Trigger %', 'mean'),
        ('trigger_aqi_mean', 'AQI Trigger %', 'mean'),
        ('trigger_heat_mean', 'Heat Trigger %', 'mean'),
    ]
    
    print(f"\n{'Metric':<25} {'Min':>12} {'Max':>12} {'Mean':>12} {'Std':>12}")
    print("-"*80)
    
    for col, label, _ in summary_cols:
        if col in stats.columns:
            vals = stats[col]
            print(f"{label:<25} {vals.min():>12.2f} {vals.max():>12.2f} {vals.mean():>12.2f} {vals.std():>12.2f}")
    
    print("\n" + "="*80)
    print(f"Total unique H3 cells: {len(stats):,}")
    print(f"Total payout across all cells: ₹{stats['payout_sum'].sum():,.2f}")
    print("="*80)

def get_h3_polygon(h3_index):
    """Convert H3 index to GeoJSON polygon coordinates."""
    boundary = h3.cell_to_boundary(h3_index)
    # h3 returns (lat, lng), folium needs [lat, lng]
    return [[lat, lng] for lat, lng in boundary]

def create_map(stats, metric='rain_mean'):
    """Create interactive Folium map with H3 hexagon overlays."""
    print(f"\nCreating map with metric: {metric}...")
    
    # Create base map
    m = folium.Map(location=CHENNAI_CENTER, zoom_start=11, tiles='OpenStreetMap')
    
    # Normalize values for coloring
    values = stats[metric].values
    vmin, vmax = values.min(), values.max()
    
    def get_color(value):
        """Map value to color gradient."""
        if vmax == vmin:
            norm = 0.5
        else:
            norm = (value - vmin) / (vmax - vmin)
        # Yellow to Red gradient
        r = 255
        g = int(255 * (1 - norm))
        b = 0
        return f'#{r:02x}{g:02x}{b:02x}'
    
    # Add H3 hexagons
    for _, row in stats.iterrows():
        h3_idx = row['h3_index']
        try:
            polygon = get_h3_polygon(h3_idx)
            value = row[metric]
            color = get_color(value)
            
            # Create popup with stats
            popup_html = f"""
            <b>H3 Index:</b> {h3_idx}<br>
            <b>Rain (mean):</b> {row.get('rain_mean', 0):.2f} mm<br>
            <b>AQI (mean):</b> {row.get('aqi_mean', 0):.2f}<br>
            <b>Heat (mean):</b> {row.get('heat_mean', 0):.2f} °C<br>
            <b>Order Density:</b> {row.get('order_density_mean', 0):.2f}<br>
            <b>Active Drivers:</b> {row.get('active_driver_count_mean', 0):.2f}<br>
            <b>Total Payout:</b> ₹{row.get('payout_sum', 0):,.2f}<br>
            <b>Rain Triggers:</b> {row.get('trigger_rain_mean', 0)*100:.1f}%<br>
            """
            
            folium.Polygon(
                locations=polygon,
                color='#333333',
                weight=1,
                fill=True,
                fill_color=color,
                fill_opacity=0.6,
                popup=folium.Popup(popup_html, max_width=300)
            ).add_to(m)
        except Exception as e:
            print(f"  Warning: Could not render {h3_idx}: {e}")
    
    # Add title
    title_html = f'''
    <div style="position: fixed; top: 10px; left: 50px; z-index: 1000; 
                background-color: white; padding: 10px; border-radius: 5px;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);">
        <h4 style="margin: 0;">Chennai ST-GNN Data: {metric.replace('_', ' ').title()}</h4>
        <p style="margin: 5px 0 0 0; font-size: 12px;">Click hexagons for details</p>
    </div>
    '''
    m.get_root().html.add_child(folium.Element(title_html))
    
    # Add color legend
    legend_html = f'''
    <div style="position: fixed; bottom: 50px; right: 50px; z-index: 1000;
                background-color: white; padding: 10px; border-radius: 5px;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);">
        <p style="margin: 0 0 5px 0;"><b>Legend</b></p>
        <div style="background: linear-gradient(to right, #ffff00, #ff0000); 
                    width: 100px; height: 20px;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span>{vmin:.1f}</span>
            <span>{vmax:.1f}</span>
        </div>
    </div>
    '''
    m.get_root().html.add_child(folium.Element(legend_html))
    
    return m

def create_multi_layer_map(stats):
    """Create map with multiple switchable layers."""
    print("\nCreating multi-layer map...")
    
    m = folium.Map(location=CHENNAI_CENTER, zoom_start=11, tiles='OpenStreetMap')
    
    metrics = {
        'rain_mean': ('Rainfall (mm)', 'Blues'),
        'aqi_mean': ('Air Quality Index', 'Oranges'),
        'heat_mean': ('Temperature (°C)', 'Reds'),
        'order_density_mean': ('Order Density', 'Greens'),
        'payout_sum': ('Total Payout (₹)', 'Purples'),
    }
    
    # Color palettes
    color_scales = {
        'Blues': lambda n: f'#{0:02x}{int(100 + 155*n):02x}{255:02x}',
        'Oranges': lambda n: f'#{255:02x}{int(200 - 150*n):02x}{int(100 - 100*n):02x}',
        'Reds': lambda n: f'#{255:02x}{int(255 - 200*n):02x}{int(255 - 200*n):02x}',
        'Greens': lambda n: f'#{int(100 - 100*n):02x}{int(150 + 105*n):02x}{int(100 - 100*n):02x}',
        'Purples': lambda n: f'#{int(150 + 105*n):02x}{int(100 - 50*n):02x}{255:02x}',
    }
    
    for metric, (label, palette) in metrics.items():
        fg = folium.FeatureGroup(name=label, show=(metric == 'rain_mean'))
        
        values = stats[metric].values
        vmin, vmax = values.min(), values.max()
        
        for _, row in stats.iterrows():
            h3_idx = row['h3_index']
            try:
                polygon = get_h3_polygon(h3_idx)
                value = row[metric]
                norm = (value - vmin) / (vmax - vmin) if vmax != vmin else 0.5
                color = color_scales[palette](norm)
                
                popup_html = f"""
                <b>H3:</b> {h3_idx[:12]}...<br>
                <b>{label}:</b> {value:,.2f}<br>
                <b>Rain:</b> {row.get('rain_mean', 0):.2f} mm<br>
                <b>AQI:</b> {row.get('aqi_mean', 0):.2f}<br>
                <b>Heat:</b> {row.get('heat_mean', 0):.2f}°C<br>
                <b>Payout:</b> ₹{row.get('payout_sum', 0):,.0f}
                """
                
                folium.Polygon(
                    locations=polygon,
                    color='#333',
                    weight=0.5,
                    fill=True,
                    fill_color=color,
                    fill_opacity=0.7,
                    popup=folium.Popup(popup_html, max_width=250)
                ).add_to(fg)
            except:
                pass
        
        fg.add_to(m)
    
    folium.LayerControl().add_to(m)
    
    # Add title
    title_html = '''
    <div style="position: fixed; top: 10px; left: 50px; z-index: 1000;
                background-color: white; padding: 10px; border-radius: 5px;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);">
        <h4 style="margin: 0;">Chennai ST-GNN Dummy Data Visualization</h4>
        <p style="margin: 5px 0 0 0; font-size: 12px;">Use layer control (top-right) to switch metrics</p>
    </div>
    '''
    m.get_root().html.add_child(folium.Element(title_html))
    
    return m

def create_charts(stats):
    """Generate static matplotlib charts."""
    print("\nGenerating charts...")
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Chennai ST-GNN Data Statistics', fontsize=14, fontweight='bold')
    
    # 1. Top 10 cells by total payout
    ax1 = axes[0, 0]
    top_payout = stats.nlargest(10, 'payout_sum')
    ax1.barh(range(10), top_payout['payout_sum'], color='purple', alpha=0.7)
    ax1.set_yticks(range(10))
    ax1.set_yticklabels([f"{h[:10]}..." for h in top_payout['h3_index']])
    ax1.set_xlabel('Total Payout (₹)')
    ax1.set_title('Top 10 Cells by Total Payout')
    ax1.invert_yaxis()
    
    # 2. Trigger distribution
    ax2 = axes[0, 1]
    trigger_totals = [
        stats['trigger_rain_mean'].mean() * 100,
        stats['trigger_aqi_mean'].mean() * 100,
        stats['trigger_heat_mean'].mean() * 100,
    ]
    bars = ax2.bar(['Rain', 'AQI', 'Heat'], trigger_totals, 
                   color=['blue', 'orange', 'red'], alpha=0.7)
    ax2.set_ylabel('Average Trigger Rate (%)')
    ax2.set_title('Trigger Event Distribution')
    for bar, val in zip(bars, trigger_totals):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1, 
                 f'{val:.1f}%', ha='center', va='bottom')
    
    # 3. Feature distributions (box plot)
    ax3 = axes[1, 0]
    feature_data = [
        stats['rain_mean'].values,
        stats['aqi_mean'].values / 10,  # Scale for visibility
        stats['heat_mean'].values,
    ]
    bp = ax3.boxplot(feature_data, labels=['Rain (mm)', 'AQI/10', 'Heat (°C)'], patch_artist=True)
    colors = ['blue', 'orange', 'red']
    for patch, color in zip(bp['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.5)
    ax3.set_title('Feature Distribution Across Cells')
    ax3.set_ylabel('Value')
    
    # 4. Order density vs Active drivers scatter
    ax4 = axes[1, 1]
    scatter = ax4.scatter(stats['order_density_mean'], stats['active_driver_count_mean'],
                         c=stats['payout_sum'], cmap='viridis', alpha=0.5, s=10)
    ax4.set_xlabel('Order Density (mean)')
    ax4.set_ylabel('Active Drivers (mean)')
    ax4.set_title('Order Density vs Active Drivers (colored by Payout)')
    plt.colorbar(scatter, ax=ax4, label='Total Payout (₹)')
    
    plt.tight_layout()
    chart_path = OUTPUT_DIR / 'stats_charts.png'
    plt.savefig(chart_path, dpi=150, bbox_inches='tight')
    print(f"  Saved charts to {chart_path}")
    plt.close()

def main():
    print("="*80)
    print("Chennai ST-GNN Data Visualization")
    print("="*80)
    
    # Load data (sample for performance during development)
    df = load_data(sample_size=500000)  # 500k sample for faster processing
    
    # Load PT data for reference
    pt_data = load_pt_data()
    
    # Compute grid statistics
    stats = compute_grid_stats(df)
    
    # Print summary
    print_summary_stats(stats)
    
    # Create multi-layer interactive map
    m = create_multi_layer_map(stats)
    map_path = OUTPUT_DIR / 'chennai_map.html'
    m.save(str(map_path))
    print(f"\nSaved interactive map to {map_path}")
    
    # Generate static charts
    create_charts(stats)
    
    print("\n" + "="*80)
    print("DONE! Open visualization/chennai_map.html in a browser to view the map.")
    print("="*80)

if __name__ == "__main__":
    main()
