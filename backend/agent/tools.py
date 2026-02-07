"""
Agent Tools ("The Workers")

These are the functions that the LangGraph agent can call to interact
with the world.  Each tool is decorated with @tool so the LLM can
invoke it during its reasoning loop.

Tool inventory:
  1. weather_tool        – Open-Meteo forecast / historical weather
  2. risk_tool           – XGBoost / LogReg crop-failure probability
  3. pricing_tool        – Dynamic premium calculator
  4. land_verification_tool – Checks whether coordinates are farmland
  5. satellite_tool      – NDVI / crop-health proxy from satellite data
  6. xrpl_escrow_tool    – Triggers EscrowFinish via the Next.js layer
  7. audit_log_tool      – Records a natural-language audit entry
"""
from typing import Dict, Any, List
from langchain_core.tools import tool
import httpx
import joblib
import os
import json
import hashlib
from datetime import datetime, timezone
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
# TOOL 4: Land Verification Tool
# ============================================
@tool
def land_verification_tool(
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """
    Verifies whether the given coordinates correspond to agricultural
    farmland.  Queries OpenStreetMap land-use data to check the area
    classification around the point.

    Use this tool during underwriting to confirm a policy applicant is
    actually insuring a farm, not a parking lot or urban area.

    Args:
        latitude: Latitude of the location to verify.
        longitude: Longitude of the location to verify.

    Returns:
        Dictionary with is_farmland boolean, land_use classification,
        and confidence score.
    """
    try:
        # Query Overpass API (OpenStreetMap) for land-use around the point
        # Search within ~500m radius for agricultural land-use tags
        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:10];
        (
          way["landuse"~"farmland|farm|orchard|vineyard|meadow|allotments"](around:500,{latitude},{longitude});
          way["crop"](around:500,{latitude},{longitude});
          way["landuse"="grass"](around:500,{latitude},{longitude});
        );
        out count;
        """
        response = httpx.post(
            overpass_url,
            data={"data": query},
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

        farm_count = data.get("elements", [{}])[0].get("tags", {}).get("ways", 0) if data.get("elements") else 0
        # Overpass "out count" returns total in elements[0].tags.total or similar
        total = int(data.get("elements", [{}])[0].get("tags", {}).get("total", 0)) if data.get("elements") else 0

        is_farmland = total > 0
        confidence = min(1.0, total / 3.0) if total > 0 else 0.0

        return {
            "status": "success",
            "is_farmland": is_farmland,
            "land_use": "agricultural" if is_farmland else "unknown/non-agricultural",
            "osm_features_found": total,
            "confidence": round(confidence, 2),
            "location": {"lat": latitude, "lon": longitude},
            "note": (
                "Farmland features detected in OpenStreetMap within 500m radius."
                if is_farmland
                else "No agricultural land-use features found within 500m. "
                     "The area may not be farmland, or OSM coverage may be incomplete."
            ),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Land verification failed: {str(e)}",
            "is_farmland": None,
            "confidence": 0.0,
        }


# ============================================
# TOOL 5: Satellite / Crop Health Tool
# ============================================
@tool
def satellite_tool(
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """
    Fetches satellite-derived vegetation health data (NDVI proxy) for
    the given location.  Uses Open-Meteo soil & vegetation variables as
    a readily-available proxy for Sentinel-2 NDVI.

    During claim adjudication the agent uses this tool to cross-check
    weather-based risk scores against physical crop-health indicators.

    Args:
        latitude: Latitude of the farm.
        longitude: Longitude of the farm.

    Returns:
        Dictionary with vegetation health indicators and a crop_damage
        boolean assessment.
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": (
                "soil_moisture_0_to_10cm_mean,"
                "soil_moisture_10_to_28cm_mean,"
                "et0_fao_evapotranspiration"
            ),
            "past_days": 14,
            "forecast_days": 1,
            "timezone": "auto",
        }
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()

        daily = data.get("daily", {})
        surface_moisture = daily.get("soil_moisture_0_to_10cm_mean", [])
        deep_moisture = daily.get("soil_moisture_10_to_28cm_mean", [])
        et0 = daily.get("et0_fao_evapotranspiration", [])

        # Compute simple health score (0=dead, 1=healthy)
        avg_surface = sum(surface_moisture) / max(len(surface_moisture), 1)
        avg_deep = sum(deep_moisture) / max(len(deep_moisture), 1)
        avg_et0 = sum(et0) / max(len(et0), 1)

        # Heuristic: healthy crops → high soil moisture, moderate ET0
        # Stressed crops → low soil moisture, high ET0
        moisture_score = min(1.0, (avg_surface + avg_deep) / 0.6)
        et0_penalty = max(0.0, (avg_et0 - 5.0) / 5.0)  # Penalty if ET0 > 5mm/day
        health_score = max(0.0, min(1.0, moisture_score - et0_penalty * 0.3))

        # Trend: compare first half vs second half of the window
        mid = len(surface_moisture) // 2
        if mid > 0:
            first_half = sum(surface_moisture[:mid]) / mid
            second_half = sum(surface_moisture[mid:]) / max(len(surface_moisture[mid:]), 1)
            trend = "declining" if second_half < first_half * 0.85 else (
                "improving" if second_half > first_half * 1.15 else "stable"
            )
        else:
            trend = "insufficient_data"

        crop_damage = health_score < 0.4

        return {
            "status": "success",
            "location": {"lat": latitude, "lon": longitude},
            "health_score": round(health_score, 3),
            "crop_damage_detected": crop_damage,
            "moisture_trend": trend,
            "details": {
                "avg_surface_moisture": round(avg_surface, 4),
                "avg_deep_moisture": round(avg_deep, 4),
                "avg_et0_mm": round(avg_et0, 2),
            },
            "note": (
                "Satellite proxy indicates significant crop stress."
                if crop_damage
                else "Vegetation health appears within normal range."
            ),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Satellite data fetch failed: {str(e)}",
            "health_score": None,
            "crop_damage_detected": None,
        }


# ============================================
# TOOL 6: XRPL Tool (Escrow Settlement)
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

    Only call this tool after the agent has independently decided to
    approve the payout.  The agent's confidence score is recorded
    on-chain for the audit trail.

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
# TOOL 7: Audit Log Tool
# ============================================

# In-memory audit store (production would persist to DB / on-chain)
_audit_log: List[Dict[str, Any]] = []


@tool
def audit_log_tool(
    policy_id: str,
    action: str,
    reasoning: str,
    confidence: float = 0.0,
    evidence_data: str = "",
) -> Dict[str, Any]:
    """
    Records a natural-language audit entry for a policy decision.
    Each entry includes a SHA-256 evidence hash so the reasoning
    can be verified later.

    Call this tool after every major decision (APPROVE, REJECT,
    TRIGGER_CLAIM, SETTLE) to maintain a transparent audit trail
    that human insurers can review.

    Args:
        policy_id: The policy this decision relates to.
        action: The decision taken (APPROVE, REJECT, TRIGGER_CLAIM,
                SETTLE, MONITOR_OK).
        reasoning: Plain-English explanation of why the decision was made.
        confidence: Confidence score for the decision (0.0-1.0).
        evidence_data: Serialised evidence string to hash (e.g. JSON
                       of weather + ML data used).

    Returns:
        Dictionary with the recorded audit entry and evidence hash.
    """
    evidence_hash = hashlib.sha256(
        evidence_data.encode() if evidence_data else reasoning.encode()
    ).hexdigest()

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "policy_id": policy_id,
        "action": action,
        "reasoning": reasoning,
        "confidence": round(confidence, 4),
        "evidence_hash": evidence_hash,
    }

    _audit_log.append(entry)

    return {
        "status": "success",
        "entry": entry,
        "total_entries": len(_audit_log),
    }


def get_audit_log(policy_id: str | None = None) -> List[Dict[str, Any]]:
    """Return audit entries, optionally filtered by policy_id."""
    if policy_id:
        return [e for e in _audit_log if e["policy_id"] == policy_id]
    return list(_audit_log)


# ============================================
# Utility: Get all tools as a list
# ============================================
def get_all_tools():
    """Returns all agent tools for LangGraph binding."""
    return [
        weather_tool,
        risk_tool,
        pricing_tool,
        land_verification_tool,
        satellite_tool,
        xrpl_escrow_tool,
        audit_log_tool,
    ]
