from fastapi import FastAPI, HTTPException, Depends
from .models import OracleRequest, OracleResponse, SamplePoint
from .services.weather_service import WeatherService
from .services.oracle_service import OracleService
import logging
import numpy as np

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="XRP Farmer Intelligence Layer",
    description="API for calculating agricultural insurance parameters and oracle logic",
    version="0.1.1"
)

# Singleton Services
weather_service = WeatherService()
oracle_service = OracleService()

def get_coordinates_from_geometry(geometry: dict) -> list[list[float]]:
    coords = []
    geom_type = geometry.get("type")
    
    if geom_type == "Polygon":
        # First ring is exterior
        # geometry["coordinates"] is [[[x, y], ...], [holes...]]
        if geometry.get("coordinates") and len(geometry["coordinates"]) > 0:
            return geometry["coordinates"][0]
            
    elif geom_type == "MultiPolygon":
        # geometry["coordinates"] is [Polygon1, Polygon2...]
        # Polygon1 is [[[x, y], ...], [holes...]]
        if geometry.get("coordinates"):
            for poly in geometry["coordinates"]:
                if poly and len(poly) > 0:
                    coords.extend(poly[0])
                    
    return coords

@app.get("/")
async def root():
    return {"message": "XRP Farmer Intelligence Layer is running", "version": "0.1.1"}

@app.get("/health")
async def health_check():
    model_status = "loaded" if oracle_service.model else "not_loaded"
    return {"status": "ok", "model": model_status}

@app.post("/oracle/evaluate", response_model=OracleResponse)
async def evaluate_risk(request: OracleRequest):
    """
    Evaluates crop risk based on farm geometry and real-time weather data.
    Aggregates severity from 5 deterministic sample points.
    """
    if not oracle_service.model:
        raise HTTPException(status_code=503, detail="ML Model is not loaded.")

    logger.info(f"Received evaluation request with thresholds: rain={request.weekly_rain_need_mm}mm, heat={request.heat_threshold_K}K, vpd={request.vpd_threshold_kpa}kPa")

    try:
        # 1. Parse Geometry & Bounding Box
        coords = get_coordinates_from_geometry(request.geometry)
        if not coords:
             raise HTTPException(status_code=400, detail="Invalid geometry: No coordinates found or unsupported type")
        
        # GeoJSON is [lon, lat]
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
        
        # 2. Generate Sample Points (Center + 4 Inset Corners)
        # Inset 10% from edges to ensure we are inside the field
        lat_range = max_lat - min_lat
        lon_range = max_lon - min_lon
        inset = 0.1
        
        # Guard against zero-area fields (single point or extremely small)
        if lat_range == 0: lat_range = 0.000001
        if lon_range == 0: lon_range = 0.000001

        # Calculate sample coordinates
        samples = [
            (min_lat + lat_range * 0.5, min_lon + lon_range * 0.5), # Center
            (min_lat + lat_range * inset, min_lon + lon_range * inset), # BL
            (min_lat + lat_range * inset, max_lon - lon_range * inset), # BR
            (max_lat - lat_range * inset, min_lon + lon_range * inset), # TL
            (max_lat - lat_range * inset, max_lon - lon_range * inset)  # TR
        ]

        # 3. Evaluate each point
        results = []
        date_obj = None
        if request.date:
            from datetime import date
            date_obj = date.fromisoformat(request.date)

        for lat, lon in samples:
            # Fetch Weather (reuse existing service)
            weather_data = await weather_service.fetch_history_7d(lat, lon, date_obj)
            
            # Process & Aggregate Features (weekly sums/avgs)
            aggregates = oracle_service.process_weather_data(weather_data)
            
            # Run Inference & Apply Safeguards
            # Pass thresholds and (lat, lon) so they can be included in the SamplePoint result
            point_result = oracle_service.evaluate_risk(
                aggregates, 
                weekly_rain_need_mm=request.weekly_rain_need_mm,
                heat_threshold_K=request.heat_threshold_K,
                vpd_threshold_kpa=request.vpd_threshold_kpa,
                lat=lat, 
                lon=lon
            )
            results.append(point_result)

        # 4. Aggregation (80th Percentile)
        # Conservative estimate: use the 80th percentile of severity to capture localized damage
        # while filtering out single-point outliers.
        severities = [r.p_severity for r in results]
        p_severity_farm = float(np.percentile(severities, 80))
        
        return OracleResponse(
            p_severity_farm=p_severity_farm,
            sample_points=results,
            note="Aggregated from 5 deterministic sample points (80th percentile rule)"
        )

    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AI AGENT ENDPOINTS (LangGraph Integration)
# ============================================
from pydantic import BaseModel
from typing import Optional

class AgentQuoteRequest(BaseModel):
    """Request model for getting an insurance quote."""
    latitude: float
    longitude: float
    crop_type: str
    coverage_xrp: float
    farm_size_hectares: float = 10.0

class AgentQuoteResponse(BaseModel):
    """Response model for insurance quote."""
    status: str
    premium_xrp: Optional[float] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    reasoning: list[str] = []

class AgentCheckRequest(BaseModel):
    """Request model for monitoring a policy."""
    policy_id: str
    latitude: float
    longitude: float
    crop_type: str
    coverage_xrp: float

class AgentCheckResponse(BaseModel):
    """Response model for policy monitoring."""
    status: str
    risk_score: Optional[float] = None
    reasoning: list[str] = []
    payout_triggered: bool = False


@app.post("/agent/quote", response_model=AgentQuoteResponse)
async def get_insurance_quote(request: AgentQuoteRequest):
    """
    AI Agent: Generate a dynamic insurance quote.
    Uses LangGraph to run the Underwriting workflow.
    """
    try:
        from backend.agent.graph import underwriting_app
        
        initial_state = {
            "policy_id": "QUOTE_PENDING",
            "status": "quote_pending",
            "location": {"lat": request.latitude, "lon": request.longitude},
            "farm_size_hectares": request.farm_size_hectares,
            "crop_type": request.crop_type,
            "coverage_xrp": request.coverage_xrp,
            "premium_xrp": None,
            "weather_data": None,
            "risk_score": None,
            "risk_level": None,
            "reasoning_log": [],
            "confidence_score": None,
            "escrow_sequence": None,
            "transaction_hash": None
        }
        
        result = underwriting_app.invoke(initial_state)
        
        return AgentQuoteResponse(
            status=result.get("status", "error"),
            premium_xrp=result.get("premium_xrp"),
            risk_level=result.get("risk_level"),
            risk_score=result.get("risk_score"),
            reasoning=result.get("reasoning_log", [])
        )
        
    except ImportError as e:
        logger.warning(f"Agent dependencies not installed: {e}")
        raise HTTPException(
            status_code=503, 
            detail="AI Agent not available. Install langgraph dependencies."
        )
    except Exception as e:
        logger.error(f"Agent quote error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/check", response_model=AgentCheckResponse)
async def check_policy_status(request: AgentCheckRequest):
    """
    AI Agent: Monitor an active policy for payout triggers.
    Uses LangGraph to run the Monitoring workflow.
    """
    try:
        from backend.agent.graph import monitoring_app
        
        initial_state = {
            "policy_id": request.policy_id,
            "status": "monitoring",
            "location": {"lat": request.latitude, "lon": request.longitude},
            "farm_size_hectares": 10.0,
            "crop_type": request.crop_type,
            "coverage_xrp": request.coverage_xrp,
            "premium_xrp": None,
            "weather_data": None,
            "risk_score": None,
            "risk_level": None,
            "reasoning_log": [],
            "confidence_score": None,
            "escrow_sequence": None,
            "transaction_hash": None
        }
        
        result = monitoring_app.invoke(initial_state)
        
        payout_triggered = result.get("status") == "settled"
        
        return AgentCheckResponse(
            status=result.get("status", "error"),
            risk_score=result.get("risk_score"),
            reasoning=result.get("reasoning_log", []),
            payout_triggered=payout_triggered
        )
        
    except ImportError as e:
        logger.warning(f"Agent dependencies not installed: {e}")
        raise HTTPException(
            status_code=503, 
            detail="AI Agent not available. Install langgraph dependencies."
        )
    except Exception as e:
        logger.error(f"Agent check error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
