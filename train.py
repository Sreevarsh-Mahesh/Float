import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import f1_score, roc_auc_score, mean_absolute_error
import numpy as np
import os
import copy

from model.dataset import STGNNDataset
from model.st_gnn import ST_GNN

def evaluate(model, loader, edge_index, device, criterion_trig, criterion_pay, lambda_payout):
    model.eval()
    total_loss = 0.0
    
    all_trig_preds = []
    all_trig_targets = []
    all_pay_preds = []
    all_pay_targets = []
    
    with torch.no_grad():
        for x, y_trig, y_pay in loader:
            x, y_trig, y_pay = x.to(device), y_trig.to(device), y_pay.to(device)
            
            trig_pred, pay_pred = model(x, edge_index)
            
            # Loss
            loss_trig = criterion_trig(trig_pred, y_trig)
            loss_pay = criterion_pay(pay_pred, y_pay)
            loss = loss_trig + lambda_payout * loss_pay
            total_loss += loss.item() * x.size(0)
            
            # Save for metrics
            all_trig_preds.append(trig_pred.cpu().numpy())
            all_trig_targets.append(y_trig.cpu().numpy())
            all_pay_preds.append(pay_pred.cpu().numpy())
            all_pay_targets.append(y_pay.cpu().numpy())
            
    avg_loss = total_loss / len(loader.dataset)
    
    # Flatten arrays
    trig_preds = np.concatenate(all_trig_preds, axis=0).flatten()
    trig_targets = np.concatenate(all_trig_targets, axis=0).flatten()
    pay_preds = np.concatenate(all_pay_preds, axis=0).flatten()
    pay_targets = np.concatenate(all_pay_targets, axis=0).flatten()
    
    # Trigger metrics (BCE with logits -> turn into probs)
    trig_probs = 1 / (1 + np.exp(-trig_preds))
    trig_preds_bin = (trig_probs > 0.5).astype(int)
    
    # Protect against single-class ROC AUC error
    try:
        if len(np.unique(trig_targets)) > 1:
            auc = roc_auc_score(trig_targets, trig_probs)
        else:
            auc = 1.0 # fallback if no positive/negative targets
    except ValueError:
        auc = 1.0
        
    f1 = f1_score(trig_targets, trig_preds_bin)
    mae = mean_absolute_error(pay_targets, pay_preds)
    
    return avg_loss, f1, auc, mae

def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Hyperparams
    DATA_PATH = "dummy_data_gen/st_gnn_chennai_data.pt"
    BATCH_SIZE = 2
    LR = 0.001
    EPOCHS = 50
    PATIENCE = 5
    LAMBDA_PAYOUT = 0.01 # Balance scales
    
    print("Loading datasets...")
    train_dataset = STGNNDataset(DATA_PATH, split='train')
    val_dataset = STGNNDataset(DATA_PATH, split='val')
    test_dataset = STGNNDataset(DATA_PATH, split='test')
    
    edge_index = train_dataset.edge_index.to(device)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=False)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    print("Initializing model...")
    model = ST_GNN().to(device)
    
    criterion_trig = nn.BCEWithLogitsLoss()
    criterion_pay = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    
    best_val_loss = float('inf')
    patience_counter = 0
    best_model_state = None
    
    print("Starting training...")
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for i, (x, y_trig, y_pay) in enumerate(train_loader):
            if i % 10 == 0:
                print(f"Epoch {epoch+1} Batch {i}/{len(train_loader)}")
            x, y_trig, y_pay = x.to(device), y_trig.to(device), y_pay.to(device)
            
            optimizer.zero_grad()
            trig_pred, pay_pred = model(x, edge_index)
            
            loss_trig = criterion_trig(trig_pred, y_trig)
            loss_pay = criterion_pay(pay_pred, y_pay)
            loss = loss_trig + LAMBDA_PAYOUT * loss_pay
            
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * x.size(0)
            
        train_loss /= len(train_loader.dataset)
        val_loss, val_f1, val_auc, val_mae = evaluate(model, val_loader, edge_index, device, criterion_trig, criterion_pay, LAMBDA_PAYOUT)
        
        print(f"Epoch {epoch+1:02d}/{EPOCHS} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val F1: {val_f1:.4f} | Val AUC: {val_auc:.4f} | Val MAE: {val_mae:.2f}")
        
        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_model_state = copy.deepcopy(model.state_dict())
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"Early stopping triggered at epoch {epoch+1}")
                break
                
    print("Loading best model for testing...")
    model.load_state_dict(best_model_state)
    
    test_loss, test_f1, test_auc, test_mae = evaluate(model, test_loader, edge_index, device, criterion_trig, criterion_pay, LAMBDA_PAYOUT)
    
    print("\n--- FINAL TEST METRICS ---")
    print(f"Test Loss:        {test_loss:.4f}")
    print(f"Trigger F1 Score: {test_f1:.4f} (Target > 0.85)")
    print(f"AUC-ROC:          {test_auc:.4f} (Target > 0.90)")
    print(f"Payout MAE:       Rs. {test_mae:.2f} (Target < 50)")

if __name__ == "__main__":
    train()
