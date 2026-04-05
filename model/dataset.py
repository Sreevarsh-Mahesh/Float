import torch
from torch.utils.data import Dataset
from torch_geometric.data import Data

class STGNNDataset(Dataset):
    def __init__(self, pt_path, split='train', seq_len=12, train_ratio=0.7, val_ratio=0.15):
        # Load data
        data = torch.load(pt_path, weights_only=False)
        self.edge_index = data.edge_index
        
        X = data.x  # Shape: (N, T, F)
        y_triggers = data.y_triggers  # Shape: (N, T, 3)
        y_payout = data.y_payout  # Shape: (N, T)
        
        # Transpose X to (T, N, F) to make window slicing easier
        X = X.permute(1, 0, 2)
        y_triggers = y_triggers.permute(1, 0, 2)
        y_payout = y_payout.permute(1, 0)
        
        T = X.shape[0]
        
        # Chronological Split
        train_end = int(T * train_ratio)
        val_end = int(T * (train_ratio + val_ratio))
        
        if split == 'train':
            start_idx, end_idx = 0, train_end
        elif split == 'val':
            start_idx, end_idx = train_end, val_end
        else: # test
            start_idx, end_idx = val_end, T
            
        # We need seq_len steps of context to predict the *next* step.
        # So we adjust start and end indices. We need our own slice.
        # But we also need previous data for the first step of val/test.
        # Let's slice the exact data we need for each split.
        
        if split == 'train':
            self.X = X[start_idx:end_idx]
            self.y_triggers = y_triggers[start_idx:end_idx]
            self.y_payout = y_payout[start_idx:end_idx]
        elif split == 'val':
            # Need seq_len preceding steps to predict the first val step
            start_slice = start_idx - seq_len
            self.X = X[start_slice:end_idx]
            self.y_triggers = y_triggers[start_slice:end_idx]
            self.y_payout = y_payout[start_slice:end_idx]
        else: # test
            start_slice = start_idx - seq_len
            self.X = X[start_slice:end_idx]
            self.y_triggers = y_triggers[start_slice:end_idx]
            self.y_payout = y_payout[start_slice:end_idx]
            
        self.seq_len = seq_len
        self.num_samples = self.X.shape[0] - self.seq_len
        
        # Identify continuous features for normalization (skip hour, day, flags etc if any)
        # 0: rain, 1: aqi, 2: heat, 3: wind, 6: order_density, 7: active_driver_count
        continuous_indices = [0, 1, 2, 3, 6, 7]
        
        # Calculate stats from TRAIN set explicitly to avoid data leakage
        train_X = X[0:train_end]
        self.mean = torch.zeros(X.shape[2])
        self.std = torch.ones(X.shape[2])
        
        for i in continuous_indices:
            self.mean[i] = train_X[:, :, i].mean()
            self.std[i] = train_X[:, :, i].std() + 1e-6
            
        # Normalize
        self.X = (self.X - self.mean) / self.std

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        # x_seq: (seq_len, N, F)
        x_seq = self.X[idx : idx + self.seq_len]
        
        # Target is the value at t + seq_len
        target_idx = idx + self.seq_len
        
        y_trig = self.y_triggers[target_idx] # (N, 3)
        y_pay = self.y_payout[target_idx]    # (N)
        
        return x_seq, y_trig, y_pay
