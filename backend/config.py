from pathlib import Path
import os

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model_logreg_2020-2022.joblib"

# Growing Season Guardrail
# If average 7-day temp is below this (Kelvin), we assume crops are dormant.
GROWING_SEASON_TEMP_THRESHOLD_K = 283.15 # ~10°C (Up from 5°C)

# Stress Thresholds
RAIN_DEFICIT_TRIGGER = 0.35 # 35% deficit required to trigger stress (Down from 40%) # ~5°C

# Crop Profiles (for normalization)
# WARNING: These values must NOT change without retraining the model if the model relies on them implicitly? 
# Actually, the model learns weights on normalized features. 
# Use these to compute the inputs for the model.
CROP_PROFILES = {
  "corn": {
    "weekly_rain_need_mm": 45.0,
    "heat_threshold_K": 305.0, # ~32°C (Down from 35°C)
    "vpd_threshold_kpa": 1.6
  },
  "soy": {
    "weekly_rain_need_mm": 40.0,
    "heat_threshold_K": 305.0,
    "vpd_threshold_kpa": 1.4
  },
  "wheat": {
    "weekly_rain_need_mm": 30.0,
    "heat_threshold_K": 303.0,
    "vpd_threshold_kpa": 1.2
  }
}


DEFAULT_CROP = "corn"
