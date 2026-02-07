"""
Agent Tools ("The Workers")
These are the functions that the LangGraph agent can call to interact with the world.
Each tool is decorated with @tool to make it "visible" to the LLM.
"""
from typing import Dict, Any
from langchain_core.tools import tool
import httpx
import joblib
import os
from pathlib import Path

# Load the XGBoost/LogReg model once at module level
MODEL_PATH = Path(__file__).parent.parent / "model_logreg_2020-2022.joblib"
try:
    risk_model = joblib.load(MODEL_PATH)
except FileNotFoundError:
    risk_model = None
    print(f"Warning: Model not found at {MODEL_PATH}. risk_tool will return mock data.")


# ============================================
# TOOL 1: Weather Tool (Open-Meteo)
# ============================================
@tool
def weather_tool(latitude: float, longitude: float, days: int = 7) -> Dict[str, Any]:
    """
    Fetches weather data from Open-Meteo for a given location.
    Returns precipitation, temperature, and soil moisture.
    
    Args:
        latitude: The latitude of the farm location.
        longitude: The longitude of the farm location.
        days: Number of forecast days (default 7).
    
    Returns:
        Dictionary with weather data including precipitation_sum, temperature_max, soil_moisture.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "precipitation_sum,temperature_2m_max,soil_moisture_0_to_10cm_mean",
        "forecast_days": days,
        "timezone": "auto"
    }
    
    try:
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        
        daily = data.get("daily", {})
        return {
            "status": "success",
            "location": {"lat": latitude, "lon": longitude},
            "dates": daily.get("time", []),
            "precipitation_mm": daily.get("precipitation_sum", []),
            "temperature_max_c": daily.get("temperature_2m_max", []),
            "soil_moisture": daily.get("soil_moisture_0_to_10cm_mean", []),
            "total_precipitation_mm": sum(daily.get("precipitation_sum", []) or [0]),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============================================
# TOOL 2: Risk Tool (XGBoost/ML Model)
# ============================================
@tool
def risk_tool(
    precipitation_mm: float, 
    temperature_c: float, 
    soil_moisture: float,
    crop_type: str = "corn"
) -> Dict[str, Any]:
    """
    Runs the XGBoost model to predict crop failure probability.
    Uses the standardized OracleService for feature engineering (Stress Indices).
    
    Args:
        precipitation_mm: Total precipitation over the period in millimeters.
        temperature_c: Average max temperature in Celsius.
        soil_moisture: Average soil moisture (0-1 scale).
        crop_type: Type of crop (corn, soybean, wheat).
    
    Returns:
        Dictionary with risk_score (0.0-1.0) and risk_level (LOW, MEDIUM, HIGH, CRITICAL).
    """
    try:
        # Import internally to avoid circular imports during startup if not needed
        from ..services.oracle_service import OracleService
        
        # Instantiate service (loads model singleton)
        oracle = OracleService()
        
        # 1. Mock the aggregated data structure expected by OracleService
        # NOTE: In a real scenario, we'd want more detailed hourly data, 
        # but here we approximate from the daily/weekly inputs.
        
        # Estimate VPD (Vapor Pressure Deficit) from Temp and Soil Moisture (inverse proxy for humidity)
        # Low soil moisture ~ Low RH ~ High VPD
        est_rh_percent = max(10, min(90, soil_moisture * 100)) 
        
        # reuse helper if possible, or re-implement simple version
        import math
        es = 0.6108 * math.exp((17.27 * temperature_c) / (temperature_c + 237.3))
        est_vpd = es * (1 - (est_rh_percent / 100.0))
        
        aggregated_data = {
            "precip_sum": precipitation_mm,
            "max_temp_K": temperature_c + 273.15,
            "vpd_avg": est_vpd,
            "avg_temp_7d": temperature_c + 273.15 # Approx
        }
        
        # 2. Call evaluate_risk
        # We pass 0,0 for Lat/Lon as they don't affect the model prediction itself
        result = oracle.evaluate_risk(aggregated_data, crop_type, lat=0.0, lon=0.0)
        
        score = result.p_severity
        
        # Classify risk level
        if score < 0.3:
            level = "LOW"
        elif score < 0.6:
            level = "MEDIUM"
        elif score < 0.85:
            level = "HIGH"
        else:
            level = "CRITICAL"
        
        return {
            "status": "success",
            "risk_score": round(score, 4),
            "risk_level": level,
            "inputs": {
                "precipitation_mm": precipitation_mm,
                "temperature_c": temperature_c,
                "soil_moisture": soil_moisture,
                "crop_type": crop_type
            },
            "debug": {
                "rain_stress": result.stress.rain_stress,
                "heat_stress": result.stress.heat_stress
            }
        }
        
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Risk calculation failed: {str(e)}",
            "risk_score": 0.5, # Fallback
            "risk_level": "UNKNOWN"
        }


# ============================================
# TOOL 3: Premium Pricing Tool
# ============================================
@tool
def pricing_tool(
    coverage_xrp: float,
    risk_score: float,
    weather_volatility: float = 1.0
) -> Dict[str, Any]:
    """
    Calculates the dynamic premium based on coverage and risk.
    Formula: Premium = (Coverage * BaseRate) * (1 + ModelScore) * VolatilityMultiplier
    
    Args:
        coverage_xrp: The coverage amount in XRP.
        risk_score: The ML model's risk prediction (0.0-1.0).
        weather_volatility: Multiplier for weather uncertainty (default 1.0).
    
    Returns:
        Dictionary with calculated premium_xrp and breakdown.
    """
    BASE_RATE = 0.05  # 5% base rate
    
    # Calculate premium
    base_premium = coverage_xrp * BASE_RATE
    risk_multiplier = 1 + risk_score
    volatility_multiplier = max(1.0, min(weather_volatility, 2.0))  # Cap at 2x
    
    final_premium = base_premium * risk_multiplier * volatility_multiplier
    
    return {
        "status": "success",
        "premium_xrp": round(final_premium, 2),
        "coverage_xrp": coverage_xrp,
        "breakdown": {
            "base_rate": BASE_RATE,
            "base_premium": round(base_premium, 2),
            "risk_multiplier": round(risk_multiplier, 4),
            "volatility_multiplier": round(volatility_multiplier, 2),
        }
    }


# ============================================
# TOOL 4: XRPL Tool (Escrow Settlement)
# ============================================

# The Next.js layer owns XRPL wallet credentials and escrow-finish logic.
# The AI agent delegates settlement execution to the /api/oracle/settle
# endpoint, which looks up the policy's escrow data from the database
# and calls finishEscrow() on the XRPL.
NEXTJS_BASE_URL = os.environ.get("NEXTJS_BASE_URL", "http://localhost:3000")
CRON_SECRET = os.environ.get("CRON_SECRET", "")

@tool
def xrpl_escrow_tool(
    policy_id: str,
    agent_confidence: float = 0.0,
) -> Dict[str, Any]:
    """
    Settles a policy by triggering EscrowFinish on the XRP Ledger.
    Delegates to the Next.js oracle settle endpoint which holds the
    XRPL wallet credentials and escrow data.

    The ML model and backend have already evaluated the severity index
    before this tool is called. This tool handles only the final
    execution step.

    Args:
        policy_id: The database ID of the policy to settle.
        agent_confidence: The agent's confidence score (0.0-1.0) for the payout decision.

    Returns:
        Dictionary with transaction result including txHash on success.
    """
    try:
        url = f"{NEXTJS_BASE_URL}/api/oracle/settle"
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if CRON_SECRET:
            headers["Authorization"] = f"Bearer {CRON_SECRET}"

        payload = {
            "policyId": policy_id,
            "agentConfidence": agent_confidence,
        }

        response = httpx.post(url, json=payload, headers=headers, timeout=30.0)

        if response.status_code == 200:
            data = response.json()
            return {
                "status": "success",
                "policy_id": data.get("policyId"),
                "tx_hash": data.get("txHash"),
                "settled": True,
            }
        else:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            return {
                "status": "error",
                "http_status": response.status_code,
                "message": error_data.get("error", response.text),
                "settled": False,
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Settlement request failed: {str(e)}",
            "settled": False,
        }


# ============================================
# Utility: Get all tools as a list
# ============================================
def get_all_tools():
    """Returns all agent tools for LangGraph binding."""
    return [weather_tool, risk_tool, pricing_tool, xrpl_escrow_tool]
