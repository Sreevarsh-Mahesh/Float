import torch
import torch.nn as nn
from torch_geometric.nn import GCNConv

class ST_GNN(nn.Module):
    def __init__(self, in_channels=11, spatial_hidden=32, temporal_hidden=64, num_nodes=5331, seq_len=24):
        super(ST_GNN, self).__init__()
        
        # Spatial Component: 2 GCN Layers
        self.gcn1 = GCNConv(in_channels, spatial_hidden)
        self.gcn2 = GCNConv(spatial_hidden, temporal_hidden) # Outputs to temporal size
        
        # Temporal Component: 3 Transformer Layers, 4 Attention Heads
        # We model the sequence per node. 
        # So we process (B*N, seq_len, temporal_hidden) -> (B*N, seq_len, temporal_hidden)
        # Using batch_first=True
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=temporal_hidden, 
            nhead=4, 
            dim_feedforward=temporal_hidden*2, 
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=3)
        
        # Multi-task Heads
        self.trigger_head = nn.Linear(temporal_hidden, 3) # Predicts Rain, AQI, Heat disruptions (binary)
        self.payout_head = nn.Linear(temporal_hidden, 1)  # Predicts continuous Rupees

    def forward(self, x, edge_index):
        # x shape: (B, seq_len, N, F)
        B, seq_len, N, F = x.shape
        
        # --- SPATIAL ---
        # GCNConv supports broadcasting [..., N, F] -> [..., N, hidden]
        x = self.gcn1(x, edge_index)
        x = torch.relu(x)
        x = self.gcn2(x, edge_index)
        x = torch.relu(x) # x shape: (B, seq_len, N, temporal_hidden)
        
        # --- TEMPORAL ---
        # Group B and N to process sequences per node
        # Reshape to (B, N, seq_len, temporal_hidden)
        x = x.permute(0, 2, 1, 3) 
        
        # Flatten to (B*N, seq_len, temporal_hidden)
        x = x.reshape(B * N, seq_len, -1)
        
        # Pass through Transformer
        t_out = self.transformer(x) # (B*N, seq_len, temporal_hidden)
        
        # Take the final timestep representation for each node sequence
        t_out_last = t_out[:, -1, :] # (B*N, temporal_hidden)
        
        # Reshape back to (B, N, temporal_hidden)
        out = t_out_last.reshape(B, N, -1)
        
        # --- HEADS ---
        # Predict for each node
        triggers_pred = self.trigger_head(out) # (B, N, 3)
        payout_pred = self.payout_head(out)    # (B, N, 1)
        
        return triggers_pred, payout_pred.squeeze(-1)
