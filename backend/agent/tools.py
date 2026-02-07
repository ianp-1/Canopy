"""
Agent Tools ("The Workers")

These are the functions that the LangGraph agent can call to interact
with the world.  Each tool is decorated with @tool so the LLM can
invoke it during its reasoning loop.

Tool inventory:
  1. weather_tool           – Open-Meteo forecast / historical weather
  2. risk_tool              – XGBoost / LogReg crop-failure probability
  3. pricing_tool           – Dynamic premium calculator with storm/regional factors
  4. land_verification_tool – Checks whether coordinates are farmland
  5. storm_events_tool      – xWeather severe weather events (tornado, hail, flood)
  6. xrpl_escrow_tool       – Triggers EscrowFinish via the Next.js layer
  7. audit_log_tool         – Records a natural-language audit entry
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
# TOOL 1: Weather Tool (Open-Meteo — Comprehensive)
# ============================================
@tool
def weather_tool(latitude: float, longitude: float, days: int = 7) -> Dict[str, Any]:
    """
    Fetches comprehensive weather data from Open-Meteo for a given
    location.  Returns far more variables than the ML model needs so
    the LLM agent can reason over the full weather picture.

    Variables fetched:
      - precipitation_sum (mm)
      - temperature_2m_max / min (°C)
      - apparent_temperature_max (°C) — "feels like" heat stress
      - windspeed_10m_max (km/h)
      - windgusts_10m_max (km/h)
      - uv_index_max
      - et0_fao_evapotranspiration (mm) — crop water demand
      - soil_moisture_0_to_10cm_mean (m³/m³)
      - soil_temperature_0_to_18cm_mean (°C)
      - weathercode (WMO codes for storm identification)

    The ML model only uses precipitation, temperature, and VPD.
    Everything else is for the agent's Chain-of-Thought reasoning.

    Args:
        latitude: The latitude of the farm location.
        longitude: The longitude of the farm location.
        days: Number of forecast days (default 7).

    Returns:
        Dictionary with comprehensive weather data and summary stats.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    daily_vars = ",".join([
        "weathercode",
        "precipitation_sum",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "windspeed_10m_max",
        "windgusts_10m_max",
        "uv_index_max",
        "et0_fao_evapotranspiration",
        "soil_moisture_0_to_10cm_mean",
        "soil_temperature_0cm",
    ])
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": daily_vars,
        "forecast_days": days,
        "past_days": 3,
        "timezone": "auto",
    }

    try:
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()

        daily = data.get("daily", {})

        precip = daily.get("precipitation_sum", []) or [0]
        temp_max = daily.get("temperature_2m_max", []) or [0]
        temp_min = daily.get("temperature_2m_min", []) or [0]
        wind_max = daily.get("windspeed_10m_max", []) or [0]
        gusts = daily.get("windgusts_10m_max", []) or [0]
        uv = daily.get("uv_index_max", []) or [0]
        et0 = daily.get("et0_fao_evapotranspiration", []) or [0]
        soil_m = daily.get("soil_moisture_0_to_10cm_mean", []) or [0]
        soil_t = daily.get("soil_temperature_0cm", []) or [0]
        codes = daily.get("weathercode", []) or []

        safe_avg = lambda lst: sum(lst) / max(len(lst), 1)

        return {
            "status": "success",
            "location": {"lat": latitude, "lon": longitude},
            "dates": daily.get("time", []),
            # Core (used by ML model)
            "precipitation_mm": precip,
            "temperature_max_c": temp_max,
            "soil_moisture": soil_m,
            "total_precipitation_mm": sum(precip),
            # Extended (used by LLM agent for reasoning)
            "temperature_min_c": temp_min,
            "apparent_temp_max_c": daily.get("apparent_temperature_max", []),
            "windspeed_max_kmh": wind_max,
            "windgusts_max_kmh": gusts,
            "uv_index_max": uv,
            "et0_mm": et0,
            "soil_temperature_c": soil_t,
            "weathercodes": codes,
            # Summary stats for quick LLM consumption
            "summary": {
                "avg_temp_max_c": round(safe_avg(temp_max), 1),
                "avg_temp_min_c": round(safe_avg(temp_min), 1),
                "max_wind_kmh": round(max(wind_max), 1) if wind_max else 0,
                "max_gusts_kmh": round(max(gusts), 1) if gusts else 0,
                "max_uv_index": round(max(uv), 1) if uv else 0,
                "avg_soil_moisture": round(safe_avg(soil_m), 4),
                "total_et0_mm": round(sum(et0), 1),
                "severe_weathercodes": [c for c in codes if c and c >= 95],
            },
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
# TOOL 3: Dynamic Premium Pricing Tool
# ============================================

# Crop-specific base rates reflecting historical loss ratios
CROP_BASE_RATES: Dict[str, float] = {
    "corn": 0.05,
    "soybean": 0.045,
    "soy": 0.045,
    "wheat": 0.04,
    "cotton": 0.06,
    "rice": 0.055,
}

@tool
def pricing_tool(
    coverage_xrp: float,
    risk_score: float,
    crop_type: str = "corn",
    weather_volatility: float = 1.0,
    active_storm_events: int = 0,
    farm_size_hectares: float = 10.0,
) -> Dict[str, Any]:
    """
    Calculates the dynamic premium based on coverage, ML risk score,
    crop profile, weather volatility, and active severe-weather events.

    The pricing formula layers five factors so the agent can explain
    EXACTLY why a premium is what it is:

      Premium = Coverage × BaseRate × RiskMultiplier × VolatilityMultiplier
                × StormSurcharge × SizeDiscount

    Args:
        coverage_xrp: The coverage amount in XRP.
        risk_score: The ML model's risk prediction (0.0-1.0).
        crop_type: Type of crop (corn, soybean, wheat, cotton, rice).
        weather_volatility: Multiplier for weather uncertainty (default 1.0).
        active_storm_events: Number of active severe-weather events in the
                             region (from storm_events_tool).
        farm_size_hectares: Farm size; larger farms get a small discount.

    Returns:
        Dictionary with calculated premium_xrp, a full factor breakdown,
        and a human-readable explanation for the audit trail.
    """
    base_rate = CROP_BASE_RATES.get(crop_type.lower(), 0.05)

    # Factor 1: ML risk (higher risk → higher premium)
    risk_multiplier = 1 + risk_score

    # Factor 2: Weather volatility (precipitation variance)
    volatility_multiplier = max(1.0, min(weather_volatility, 2.0))

    # Factor 3: Storm surcharge — each active event adds 15%, capped at 2×
    storm_surcharge = min(2.0, 1.0 + active_storm_events * 0.15)

    # Factor 4: Size discount — larger farms spread risk, up to 10% off
    if farm_size_hectares >= 100:
        size_discount = 0.90
    elif farm_size_hectares >= 50:
        size_discount = 0.95
    else:
        size_discount = 1.0

    base_premium = coverage_xrp * base_rate
    final_premium = (
        base_premium
        * risk_multiplier
        * volatility_multiplier
        * storm_surcharge
        * size_discount
    )

    # Build plain-English explanation
    explanation_parts = [
        f"Base rate for {crop_type}: {base_rate:.1%} of {coverage_xrp} XRP = {base_premium:.2f} XRP.",
        f"ML risk multiplier: ×{risk_multiplier:.2f} (score {risk_score:.2%}).",
    ]
    if volatility_multiplier > 1.0:
        explanation_parts.append(
            f"Weather volatility surcharge: ×{volatility_multiplier:.2f}."
        )
    if active_storm_events > 0:
        explanation_parts.append(
            f"Storm surcharge: ×{storm_surcharge:.2f} "
            f"({active_storm_events} active event(s) in region)."
        )
    if size_discount < 1.0:
        explanation_parts.append(
            f"Size discount: ×{size_discount:.2f} "
            f"(farm ≥ {farm_size_hectares:.0f} ha)."
        )
    explanation_parts.append(f"Final premium: {final_premium:.2f} XRP.")

    return {
        "status": "success",
        "premium_xrp": round(final_premium, 2),
        "coverage_xrp": coverage_xrp,
        "breakdown": {
            "base_rate": base_rate,
            "base_premium": round(base_premium, 2),
            "risk_multiplier": round(risk_multiplier, 4),
            "volatility_multiplier": round(volatility_multiplier, 2),
            "storm_surcharge": round(storm_surcharge, 2),
            "size_discount": round(size_discount, 2),
            "crop_type": crop_type,
        },
        "explanation": " ".join(explanation_parts),
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
# TOOL 5: Storm Events Tool (xWeather / Open-Meteo)
# ============================================

XWEATHER_CLIENT_ID = os.environ.get("XWEATHER_CLIENT_ID", "")
XWEATHER_CLIENT_SECRET = os.environ.get("XWEATHER_CLIENT_SECRET", "")

@tool
def storm_events_tool(
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """
    Checks for severe weather events (tornado, hail, flood, hurricane,
    severe thunderstorm) near the given coordinates.

    Uses the xWeather (Vaisala) API when credentials are configured,
    with an Open-Meteo weathercode fallback otherwise.

    The agent uses this data to:
    - Block underwriting during active disasters.
    - Add a storm surcharge to dynamic pricing.
    - Provide additional evidence during claim adjudication.

    Args:
        latitude: Latitude of the farm.
        longitude: Longitude of the farm.

    Returns:
        Dictionary with active_events list, event_count, and a
        has_severe_events boolean.
    """
    # ── Try xWeather API first ─────────────────────────────────────
    if XWEATHER_CLIENT_ID and XWEATHER_CLIENT_SECRET:
        try:
            url = (
                f"https://api.aerisapi.com/alerts/"
                f"{latitude},{longitude}"
            )
            params = {
                "client_id": XWEATHER_CLIENT_ID,
                "client_secret": XWEATHER_CLIENT_SECRET,
                "limit": 10,
            }
            response = httpx.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            events: List[Dict[str, Any]] = []
            if data.get("success") and data.get("response"):
                for alert in data["response"]:
                    details = alert.get("details", {})
                    events.append({
                        "type": details.get("type", "unknown"),
                        "name": details.get("name", ""),
                        "body": details.get("body", "")[:200],
                    })

            return {
                "status": "success",
                "source": "xweather",
                "location": {"lat": latitude, "lon": longitude},
                "active_events": events,
                "event_count": len(events),
                "has_severe_events": len(events) > 0,
            }
        except Exception as e:
            # Fall through to Open-Meteo fallback
            pass

    # ── Open-Meteo fallback (weather codes) ────────────────────────
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "weathercode,precipitation_sum,windspeed_10m_max",
            "forecast_days": 3,
            "past_days": 3,
            "timezone": "auto",
        }
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()

        daily = data.get("daily", {})
        codes = daily.get("weathercode", [])
        wind_max = daily.get("windspeed_10m_max", [])
        precip = daily.get("precipitation_sum", [])
        dates = daily.get("time", [])

        # WMO weather-code mapping for severe events
        # 95/96/99 = thunderstorm; 85/86 = heavy snow; 67/77 = freezing rain/ice
        SEVERE_CODES = {95, 96, 99}
        MODERATE_CODES = {65, 67, 75, 77, 82, 85, 86}

        events = []
        for i, code in enumerate(codes):
            date = dates[i] if i < len(dates) else "?"
            w = wind_max[i] if i < len(wind_max) else 0
            p = precip[i] if i < len(precip) else 0

            if code in SEVERE_CODES:
                events.append({
                    "type": "thunderstorm/severe",
                    "name": f"WMO code {code} on {date}",
                    "body": f"Wind {w} km/h, precip {p}mm",
                })
            elif code in MODERATE_CODES:
                events.append({
                    "type": "heavy_precipitation",
                    "name": f"WMO code {code} on {date}",
                    "body": f"Wind {w} km/h, precip {p}mm",
                })
            elif w and w > 80:
                events.append({
                    "type": "high_wind",
                    "name": f"Wind event on {date}",
                    "body": f"Max wind {w} km/h",
                })

        return {
            "status": "success",
            "source": "open-meteo-weathercode",
            "location": {"lat": latitude, "lon": longitude},
            "active_events": events,
            "event_count": len(events),
            "has_severe_events": len(events) > 0,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Storm events check failed: {str(e)}",
            "active_events": [],
            "event_count": 0,
            "has_severe_events": None,
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
        storm_events_tool,
        xrpl_escrow_tool,
        audit_log_tool,
    ]
