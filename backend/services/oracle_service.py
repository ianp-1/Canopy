import joblib
import numpy as np
import pandas as pd # used for convenient series ops if needed, or just numpy
from typing import Dict, Any, Tuple
from ..config import MODEL_PATH
from ..models import SamplePoint, StressDetails
import math

class OracleService:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            print(f"Loading model from {MODEL_PATH}...")
            self.model = joblib.load(MODEL_PATH)
            print("Model loaded successfully.")
        except Exception as e:
             print(f"FAILED to load model: {e}")
             # We don't raise here to allow app to start, but requests will fail.
             self.model = None

    def _calculate_vpd(self, temp_c: float, rh_percent: float) -> float:
        """
        Calculates Vapor Pressure Deficit (kPa) using Tetens equation.
        es = 0.6108 * exp(17.27 * T / (T + 237.3))
        vpd = es * (1 - RH/100)
        """
        if rh_percent < 0: rh_percent = 0
        if rh_percent > 100: rh_percent = 100
        
        es = 0.6108 * math.exp((17.27 * temp_c) / (temp_c + 237.3))
        vpd = es * (1 - (rh_percent / 100.0))
        return max(0.0, vpd)

    def evaluate_risk(
        self, 
        aggregated_data: Dict[str, float], 
        weekly_rain_need_mm: float = 45.0,
        heat_threshold_K: float = 308.0,
        vpd_threshold_kpa: float = 1.6,
        lat: float = 0.0, 
        lon: float = 0.0,
        bypass_safeguards: bool = False
    ) -> SamplePoint:
        if not self.model:
            raise RuntimeError("Model not loaded.")
        
        # 1. Extract Aggregates
        precip_sum = aggregated_data["precip_sum"]
        max_temp_K = aggregated_data["max_temp_K"]
        vpd_avg = aggregated_data["vpd_avg"]
        avg_temp_7d = aggregated_data.get("avg_temp_7d", 0.0)

        # 2. Guardrail Check: Growing Season
        from ..config import GROWING_SEASON_TEMP_THRESHOLD_K
        if avg_temp_7d < GROWING_SEASON_TEMP_THRESHOLD_K:
            print(f"Guardrail Active: Temp {avg_temp_7d:.2f}K < {GROWING_SEASON_TEMP_THRESHOLD_K}K. Returning 0 risk.")
            return SamplePoint(
                lat=lat,
                lon=lon,
                p_severity=0.0,
                stress=StressDetails(rain_stress=0.0, heat_stress=0.0, vpd_stress=0.0),
                weather_summary=aggregated_data,
            )

        # 3. Compute Features (Match process_and_label.py logic)
        
        from ..config import RAIN_DEFICIT_TRIGGER

        # Rain Stress: (need - actual) / need -> Thresholded
        raw_deficit = (weekly_rain_need_mm - precip_sum) / weekly_rain_need_mm
        
        # New: Thresholding rain stress
        # If deficit < TRIGGER, stress is 0
        rain_stress = (raw_deficit - RAIN_DEFICIT_TRIGGER) / (1.0 - RAIN_DEFICIT_TRIGGER)
        rain_stress = max(0.0, min(1.0, rain_stress))

        # Heat Stress: (max_temp - thresh) / 10
        heat_stress = (max_temp_K - heat_threshold_K) / 10.0
        heat_stress = max(0.0, min(1.0, heat_stress)) # Clip 0-1

        # VPD Stress: ratio clipped 0-2 (but we report 0-1 normalized in response usually? 
        # The training logic used: df["vpd_stress"] = raw_vpd_ratio.clip(lower=0.0, upper=2.0)
        
        # VPD Stress (Thresholded)
        vpd_stress = (vpd_avg - vpd_threshold_kpa) / vpd_threshold_kpa
        if vpd_stress < 0: vpd_stress = 0.0
        if vpd_stress > 1: vpd_stress = 1.0 # Cap at 1.0 matching training logic

        # 4. Inference
        # Features order: ["rain_stress", "heat_stress", "vpd_stress"]
        # Use DataFrame to avoid "X does not have valid feature names" warning
        features_df = pd.DataFrame(
            [[rain_stress, heat_stress, vpd_stress]], 
            columns=["rain_stress", "heat_stress", "vpd_stress"]
        )
        
        # Predict probability of class 1 (severity)
        p_severity = self.model.predict_proba(features_df)[0][1]

        # --- Tiered Policy Safeguards ---
        # Prevents model overconfidence on moderate stress scenarios
        # Can be bypassed for testing purposes
        if not bypass_safeguards:
            # Tier 1: Truly minimal stress -> cap at 0.15 (baseline noise)
            if rain_stress < 0.2 and heat_stress < 0.15 and vpd_stress < 0.2:
                p_severity = min(p_severity, 0.15)
            
            # Tier 1.5: Single LOW-moderate stress -> cap at 0.35
            # Rain 0.2-0.5 OR heat 0.15-0.3, but not both significantly
            elif (rain_stress < 0.5 and heat_stress < 0.3 and vpd_stress < 0.2):
                p_severity = min(p_severity, 0.35)
            
            # Tier 2: Single MODERATE stress factor -> cap at 0.5
            elif (rain_stress < 0.7 and heat_stress < 0.2 and vpd_stress < 0.2) or \
                 (rain_stress < 0.2 and heat_stress < 0.5 and vpd_stress < 0.2) or \
                 (rain_stress < 0.2 and heat_stress < 0.2 and vpd_stress < 0.5):
                p_severity = min(p_severity, 0.5)
            
            # Tier 3: Multi-moderate stress but no extreme -> cap at 0.75
            elif rain_stress < 0.8 and heat_stress < 0.5 and vpd_stress < 0.6:
                p_severity = min(p_severity, 0.75)
        else:
            print(f"  [BYPASS] Safeguards disabled. Raw severity: {p_severity:.3f}")

        # 5. Construct Response
        return SamplePoint(
            lat=lat,
            lon=lon,
            p_severity=float(p_severity),
            stress=StressDetails(
                rain_stress=float(rain_stress),
                heat_stress=float(heat_stress),
                vpd_stress=float(vpd_stress)
            ),
            weather_summary=aggregated_data
        )

    def process_weather_data(self, history: Dict[str, Any]) -> Dict[str, float]:
        """
        Aggregates output from WeatherService (Open-Meteo) into weekly metrics.
        """
        hourly = history.get("hourly", {})
        if not hourly:
            raise ValueError("No hourly data received from WeatherService")

        temps_c = hourly.get("temperature_2m", [])
        rhs = hourly.get("relative_humidity_2m", [])
        precips = hourly.get("precipitation", [])

        if not (len(temps_c) == len(rhs) == len(precips) and len(temps_c) > 0):
             raise ValueError("Incomplete weather data structure")

        # Conversions
        temps_k = [t + 273.15 for t in temps_c]
        vpds = [self._calculate_vpd(t, rh) for t, rh in zip(temps_c, rhs)]

        # Aggregation
        precip_sum = sum(precips)
        max_temp_k = max(temps_k)
        avg_temp_k = sum(temps_k) / len(temps_k) # NEW: Average Temp
        vpd_avg = sum(vpds) / len(vpds)

        return {
            "precip_sum": precip_sum,
            "max_temp_K": max_temp_k,
            "vpd_avg": vpd_avg,
            "avg_temp_7d": avg_temp_k # Return this
        }
