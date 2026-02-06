import pandas as pd
import numpy as np
import os
import json
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "PA_2020-2022_weekly_raw.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "PA_2020-2022_weekly_stress_labeled.csv")
METADATA_FILE = os.path.join(BASE_DIR, "PA_2020-2022_label_metadata.json")
MODEL_FILE = os.path.join(BASE_DIR, "model_logreg_2020-2022.joblib")

# Default crop profile (Generic Row Crop)
CROP_PROFILE = {
    "weekly_rain_need_mm": 50.0,
    "heat_threshold_K": 308.0,
    "vpd_threshold_kpa": 1.5
}

# Stress weights
WEIGHTS = {
    "rain": 0.45,
    "vpd": 0.35,
    "heat": 0.20
}

# ------------------------------------------------------------------------------
# 1. Feature Engineering
# ------------------------------------------------------------------------------
def compute_stress_features(df):
    """Computes normalized stress features (0-1 range approx)."""
    print("Computing stress features...")
    
    # avoid modifying original
    df = df.copy()

    # Rain Stress: How much less rain fell than needed?
    # rain_stress = max(0, (need - actual) / need)
    # precip_sum is in kg m**-2 which is roughly mm
    df["rain_stress"] = (CROP_PROFILE["weekly_rain_need_mm"] - df["precip_sum"]) / CROP_PROFILE["weekly_rain_need_mm"]
    df["rain_stress"] = df["rain_stress"].clip(lower=0.0) # No negative stress if excess rain (for now)

    # Heat Stress: How much above threshold? Scaled by 10K
    # heat_stress = clamp((max_temp - thresh) / 10, 0, 1)
    df["heat_stress"] = (df["max_temp_K"] - CROP_PROFILE["heat_threshold_K"]) / 10.0
    df["heat_stress"] = df["heat_stress"].clip(lower=0.0, upper=1.0)

    # VPD Stress: How much above threshold?
    # vpd_stress = clamp(vpd / thresh, 0, 2) -> then simplified for 0-1 scale usually, 
    # but plan said clamp(..., 0, 2) then optionally rescale. Let's keep it simple:
    # vpd_stress = clamp(excess_vpd_ratio, 0, 1) for consistency with others 0-1.
    # Actually plan said: clamp(vpd / thresh, 0, 2). Let's stick to plan but cap at 1.0 for the score calculation.
    # We will save the raw ratio as vpd_stress but clip it for score.
    
    raw_vpd_ratio = df["vpd_avg"] / CROP_PROFILE["vpd_threshold_kpa"]
    df["vpd_stress"] = raw_vpd_ratio.clip(lower=0.0, upper=2.0) # Raw feature behavior
    
    # Combined Stress Score
    # We clip sub-features to 0-1 purely for the weighting sum to ensure score is 0-1
    vpd_term = df["vpd_stress"].clip(upper=1.0)
    
    df["stress_score"] = (
        WEIGHTS["rain"] * df["rain_stress"] +
        WEIGHTS["vpd"] * vpd_term +
        WEIGHTS["heat"] * df["heat_stress"]
    )
    
    return df

# ------------------------------------------------------------------------------
# 2. Labeling (Weak Supervision)
# ------------------------------------------------------------------------------
def generate_labels(df, quantile=0.8):
    """Generates binary severity labels based on stress score quantile."""
    print("Generating labels...")
    
    threshold = df["stress_score"].quantile(quantile)
    print(f"Stress Score Threshold ({quantile} quantile): {threshold:.4f}")
    
    df["severity"] = (df["stress_score"] >= threshold).astype(int)
    
    severity_rate = df["severity"].mean()
    print(f"Positive Label Rate: {severity_rate:.2%}")
    
    return df, threshold, severity_rate

# ------------------------------------------------------------------------------
# 3. Model Training (Sanity Check)
# ------------------------------------------------------------------------------
def train_sanity_check_model(df):
    """Trains a simple logistic regression to validate data quality."""
    print("Training baseline model...")
    
    features = ["rain_stress", "heat_stress", "vpd_stress"]
    X = df[features]
    y = df["severity"]
    
    # Simple split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = LogisticRegression()
    model.fit(X_train, y_train)
    
    # Evaluation
    preds = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, preds)
    
    print(f"Model Results:")
    print(f"  ROC-AUC: {auc:.4f}")
    print(f"  Coefficients: {dict(zip(features, model.coef_[0]))}")
    print(f"  Intercept: {model.intercept_[0]:.4f}")
    
    return model

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------
def main():
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")
        
    print(f"Loading data from {INPUT_FILE}...")
    raw = pd.read_csv(INPUT_FILE)
    
    # Compute features
    labeled = compute_stress_features(raw)
    
    # Generate labels
    labeled, threshold, rate = generate_labels(labeled)
    
    # Save dataset
    print(f"Saving labeled dataset to {OUTPUT_FILE}...")
    cols_to_save = [
        "FIPS Code", "County", "week_start", "precip_sum", "max_temp_K", 
        "avg_temp_K", "rh_avg", "vpd_avg", "rain_stress", "heat_stress", 
        "vpd_stress", "stress_score", "severity"
    ]
    labeled[cols_to_save].to_csv(OUTPUT_FILE, index=False)
    
    # Save Metadata
    metadata = {
        "crop_profile": CROP_PROFILE,
        "weights": WEIGHTS,
        "threshold_quantile": 0.8,
        "threshold_value": float(threshold),
        "positive_rate": float(rate)
    }
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata to {METADATA_FILE}")
    
    # Train and Save Model
    model = train_sanity_check_model(labeled)
    joblib.dump(model, MODEL_FILE)
    print(f"Saved model to {MODEL_FILE}")
    
    print("Done!")

if __name__ == "__main__":
    main()
