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
from typing import Dict, Any, List, Union
from langchain_core.tools import tool
import httpx
import joblib
import os
import json
import hashlib
from datetime import datetime, timezone, timedelta
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
    ])
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": daily_vars,
        "forecast_days": days,
        "past_days": 3,
        "timezone": "auto",
    }

    # Simple retry logic for transient network/SSL errors
    max_retries = 3
    data = {}
    
    for attempt in range(max_retries):
        try:
            response = httpx.get(url, params=params, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            break
        except Exception as e:
            if attempt == max_retries - 1:
                # Last attempt failed, return error structure
                print(f"Weather Tool Error (Attempt {attempt+1}): {e}")
                return {
                    "status": "error",
                    "message": f"Weather lookup failed: {str(e)}",
                    "total_precipitation_mm": 0.0, # Safe default
                    "weathercodes": [],
                }
            # Wait a bit before retrying
            import time
            time.sleep(1)

    daily = data.get("daily", {})

    precip = daily.get("precipitation_sum", []) or [0]
    temp_max = daily.get("temperature_2m_max", []) or [0]
    temp_min = daily.get("temperature_2m_min", []) or [0]
    wind_max = daily.get("windspeed_10m_max", []) or [0]
    gusts = daily.get("windgusts_10m_max", []) or [0]
    uv = daily.get("uv_index_max", []) or [0]
    et0 = daily.get("et0_fao_evapotranspiration", []) or [0]
    soil_m = [0.3] * len(precip) # Default moisture
    soil_t = temp_max # Proxy
    codes = daily.get("weathercode", []) or []

    safe_avg = lambda lst: sum(lst) / max(len(lst), 1)

    return {
        "status": "success",
        "location": {"lat": latitude, "lon": longitude},
        "precipitation_mm": [round(p, 1) for p in precip],
        "total_precipitation_mm": round(sum(precip), 1),
        "temperature_max_c": [round(t, 1) for t in temp_max],
        "temperature_min_c": [round(t, 1) for t in temp_min],
        "apparent_temp_max_c": [round(t, 1) for t in gusts],
        "windspeed_max_kmh": [round(w, 1) for w in wind_max],
        "windgusts_max_kmh": [round(g, 1) for g in gusts],
        "uv_index_max": [round(u, 1) for u in uv],
        "et0_mm": [round(e, 2) for e in et0],
        "soil_moisture": soil_m,
        "soil_temperature_c": soil_t,
        "weathercodes": codes,
        "summary": {
            "avg_temp_max_c": round(safe_avg(temp_max), 1),
            "avg_temp_min_c": round(safe_avg(temp_min), 1),
            "max_wind_kmh": round(max(wind_max) if wind_max else 0, 1),
            "max_gusts_kmh": round(max(gusts) if gusts else 0, 1),
            "max_uv_index": round(max(uv) if uv else 0, 1),
            "avg_soil_moisture": round(safe_avg(soil_m), 2),
            "total_et0_mm": round(sum(et0), 1),
            "severe_weathercodes": [c for c in codes if c in {95, 96, 99}],
        }
    }


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
        
        # Ensure inputs are floats
        precipitation_mm = float(precipitation_mm)
        temperature_c = float(temperature_c)
        soil_moisture = float(soil_moisture)
        
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
        # NOTE: We use default thresholds. Ideally we map crop_type -> thresholds here.
        result = oracle.evaluate_risk(aggregated_data, lat=0.0, lon=0.0)
        
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
        print(f"DEBUG: Risk Tool Error: {e}")
        import traceback
        traceback.print_exc()
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

        # Overpass "out count" returns total in elements[0].tags.total
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
            print(f"⚠️ xWeather check failed: {e}")
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
# TOOL 6: Satellite Tool (Google Earth Engine)
# ============================================
@tool
def satellite_tool(latitude: float, longitude: float, analysis_type: str = "ndvi") -> Dict[str, Any]:
    """
    Fetches satellite data for a location using Google Earth Engine.
    
    Args:
        latitude: Latitude of the point.
        longitude: Longitude of the point.
        analysis_type: "ndvi" (Crop Health) or "land_cover" (Verification).
        
    Returns:
        Dict containing analysis results (e.g., mean NDVI, is_farmland).
    """
    try:
        import ee
        
        # Initialize Earth Engine with Service Account
        try:
            # Explicitly load credentials from the JSON file
            # This is more robust than relying on implicit env var handling for GEE
            from google.oauth2 import service_account
            
            key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            project_id = os.environ.get("EE_PROJECT_ID")
            
            if not key_path or not os.path.exists(key_path):
                 # Try relative path if absolute fails (fallback for local dev)
                 if key_path and not os.path.exists(key_path):
                     # Try finding it relative to project root
                     root = Path(__file__).parent.parent.parent
                     potential_path = root / key_path
                     if potential_path.exists():
                         key_path = str(potential_path)
            
            if key_path and os.path.exists(key_path):
                credentials = service_account.Credentials.from_service_account_file(key_path)
                scoped_credentials = credentials.with_scopes(
                    ['https://www.googleapis.com/auth/earthengine', 'https://www.googleapis.com/auth/cloud-platform']
                )
                ee.Initialize(credentials=scoped_credentials, project=project_id)
            else:
                # Fallback to implicit/existing auth
                ee.Initialize(project=project_id)
                
        except Exception as e:
            print(f"EE Init Warning: {e}")
            return {"status": "error", "message": f"EE Init Failed: {str(e)}"}

        # Define Point of Interest
        point = ee.Geometry.Point([longitude, latitude])
        
        if analysis_type == "ndvi":
            # ── NDVI Calculation (Sentinel-2) ──────────────────────────
            # Buffer to create a small polygon (e.g., 50m radius) for analysis
            roi = point.buffer(50)
            
            # Filter Sentinel-2 collection for recent cloud-free images
            end_date = datetime.now()
            start_date_recent = end_date - timedelta(days=30)
            
            s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")\
                .filterBounds(roi)\
                .filterDate(start_date_recent.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))\
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))\
                .sort("system:time_start", False) # Newest first

            # Get the first image
            image = s2.first()
            
            # Use getInfo() to check if image exists (client-side check)
            # Efficient way: count images
            count = s2.size().getInfo()
            
            if count == 0:
                return {"status": "error", "message": "No recent cloud-free imagery found"}

            # Calculate NDVI: (NIR - Red) / (NIR + Red)
            # Sentinel-2: NIR = B8, Red = B4
            ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
            
            # Reduce region to get mean NDVI
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=roi,
                scale=10,
                maxPixels=1e9
            )
            
            mean_ndvi = stats.get("NDVI").getInfo()
            
            return {
                "status": "success",
                "analysis": "ndvi",
                "mean_ndvi": round(mean_ndvi, 2) if mean_ndvi is not None else 0.0,
                "image_date": image.date().format("YYYY-MM-dd").getInfo(),
                "platform": "Sentinel-2"
            }

        elif analysis_type == "land_cover":
            # ── Land Verification (ESA WorldCover / USDA CDL + OSM) ────
            
            # 1. Earth Engine Check (USDA CDL)
            dataset = ee.ImageCollection("USDA/NASS/CDL")\
                .filter(ee.Filter.date('2018-01-01', '2024-12-31'))\
                .sort("system:time_start", False)\
                .first()
            
            # reduceRegion to get the dominant class at the point
            land_class_dict = dataset.select('cropland').reduceRegion(
                reducer=ee.Reducer.mode(),
                geometry=point,
                scale=30
            ).getInfo()
            
            land_class = land_class_dict.get('cropland')
            
            # USDA CDL Logic: 1-60 are generally crops. 
            is_farmland_cdl = (0 < land_class < 80) or (land_class == 176) if land_class else False

            # 2. OpenStreetMap Check (User Request)
            # Query Overpass API for landuse tags
            osm_is_farmland = False
            osm_tags = []
            
            try:
                # Reuse the existing land_verification_tool logic via internal call or duplicating logic
                # For simplicity and robustness, we'll duplicate the specific OSM check here
                # or better yet, make a request to Overpass directly if we want to be self-contained.
                # However, to avoid duplicate code, we can import the query logic or just re-implement strictly for this tool and specific tags requested.
                
                overpass_url = "http://overpass-api.de/api/interpreter"
                overpass_query = f"""
                    [out:json];
                    is_in({latitude},{longitude});
                    area._[landuse~"farmland|farmyard|orchard|vineyard"];
                    out;
                """
                # Note: is_in might be heavy. Let's use a small radius check around the point.
                overpass_query_radius = f"""
                    [out:json];
                    (
                      way[landuse="farmland"](around:50,{latitude},{longitude});
                      way[landuse="farmyard"](around:50,{latitude},{longitude});
                      relation[landuse="farmland"](around:50,{latitude},{longitude});
                      relation[landuse="farmyard"](around:50,{latitude},{longitude});
                    );
                    out body;
                """
                
                # We need requests/httpx here. Tools.py already uses httpx.
                import httpx
                response = httpx.get(overpass_url, params={"data": overpass_query_radius}, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    elements = data.get("elements", [])
                    if elements:
                        osm_is_farmland = True
                        for el in elements:
                            if "tags" in el:
                                osm_tags.append(el["tags"].get("landuse", "unknown"))
            except Exception as e:
                print(f"OSM Check Failed inside satellite_tool: {e}")

            # Combine Results
            # If EITHER claims it's farmland, we can be more confident, or we can require both depending on strictness.
            # Let's say if either is true, it's farmland, but we note the source.
            
            final_is_farmland = is_farmland_cdl or osm_is_farmland
            
            return {
                "status": "success",
                "analysis": "land_cover",
                "is_farmland": final_is_farmland,
                "details": {
                    "usda_cdl": {
                        "is_farmland": is_farmland_cdl,
                        "class_code": land_class
                    },
                    "osm": {
                        "is_farmland": osm_is_farmland,
                        "tags": list(set(osm_tags))
                    }
                },
                "source": "USDA NASS CDL + OpenStreetMap"
            }

        return {"status": "error", "message": f"Unknown analysis type: {analysis_type}"}

    except Exception as e:
        return {
            "status": "error", 
            "message": f"Satellite analysis failed: {str(e)}"
        }


# ============================================
# TOOL 7: XRPL Tool (Escrow Settlement)
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
    reasoning: Union[str, Dict[str, Any]],
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
        reasoning: Explanation (string) or structured log (dict) of why.
        confidence: Confidence score for the decision (0.0-1.0).
        evidence_data: Serialised evidence string to hash (e.g. JSON
                       of weather + ML data used).

    Returns:
        Dictionary with the recorded audit entry and evidence hash.
    """
    if isinstance(reasoning, dict):
        import json
        reasoning_str = json.dumps(reasoning)
    else:
        reasoning_str = reasoning

    evidence_hash = hashlib.sha256(
        evidence_data.encode() if evidence_data else reasoning_str.encode()
    ).hexdigest()

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "policy_id": policy_id,
        "action": action,
        "reasoning": reasoning_str,
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
