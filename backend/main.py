from dotenv import load_dotenv
from pathlib import Path
import os

# Load env from project root (before other imports)
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(env_path)

from fastapi import FastAPI, HTTPException, Depends
from .models import (
    OracleRequest, OracleResponse, SamplePoint,
    AgentSettleRequest, AgentSettleResponse,
    ChatRequest, ChatResponse,
    LandCheckRequest, LandCheckResponse,
    AuditLogResponse,
    QuoteRequest, QuoteResponse,
    MonitorRequest, MonitorResponse,
)
from .services.weather_service import WeatherService
from .services.oracle_service import OracleService
from .agent.tools import (
    xrpl_escrow_tool,
    land_verification_tool,
    weather_tool,
    risk_tool,
    storm_events_tool,
    get_audit_log,
)
from .agent.graph import _llm_decide, build_underwriting_graph, build_monitoring_graph
from .agent.prompts import CHAT_SYSTEM_PROMPT
import logging
import json
import numpy as np
import os
from dotenv import load_dotenv
from pathlib import Path

# Load env from project root
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(env_path)

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RLUSD Farmer Intelligence Layer",
    description="API for calculating agricultural insurance parameters and oracle logic",
    version="0.2.0"
)

# Singleton Services
weather_service = WeatherService()
oracle_service = OracleService()

# Build Agent Graphs
underwriting_graph = build_underwriting_graph()
monitoring_graph = build_monitoring_graph()

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
    return {"message": "RLUSD Farmer Intelligence Layer is running", "version": "0.2.0"}

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
                lon=lon,
                bypass_safeguards=request.bypass_safeguards
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


@app.post("/agent/settle", response_model=AgentSettleResponse)
async def agent_settle(request: AgentSettleRequest):
    """
    Agent-initiated policy settlement.

    Called after the AI agent's monitor and verify nodes have confirmed
    that the ML severity index warrants a payout.  Delegates the actual
    EscrowFinish execution to the Next.js oracle settle endpoint, which
    holds the XRPL wallet credentials and escrow data.
    """
    logger.info(
        f"Agent settle request for policy {request.policy_id} "
        f"(confidence={request.agent_confidence})"
    )

    result = xrpl_escrow_tool.invoke({
        "policy_id": request.policy_id,
        "agent_confidence": request.agent_confidence,
    })

    if result.get("status") == "success":
        return AgentSettleResponse(
            success=True,
            policy_id=result.get("policy_id", request.policy_id),
            tx_hash=result.get("tx_hash"),
            message="Escrow settled successfully",
        )

    raise HTTPException(
        status_code=502,
        detail=result.get("message", "Settlement failed"),
    )


# ═══════════════════════════════════════════════════════════════════════
# Agent Workflow Endpoints
# ═══════════════════════════════════════════════════════════════════════

@app.post("/agent/quote", response_model=QuoteResponse)
async def agent_quote(request: QuoteRequest):
    """
    Generates an insurance quote using the AI Agent's Underwriting Graph.
    
    1. Verifies land use (OSM) and checks for active storms.
    2. Fetches 7-day weather forecast.
    3. Runs ML risk model.
    4. Calculates dynamic premium based on risk, volatility, and storm data.
    """
    logger.info(f"Agent Quote Request: {request.crop_type} at ({request.latitude}, {request.longitude})")
    
    # Initialize Agent State
    initial_state = {
        "policy_id": "quote_request",  # Temporary ID for quoting
        "status": "quote_pending",
        "location": {"lat": request.latitude, "lon": request.longitude},
        "farm_size_hectares": request.farm_size_hectares,
        "crop_type": request.crop_type,
        "coverage_rlusd": request.coverage_rlusd,
        "reasoning_log": [],
        # Initialize optional fields
        "premium_rlusd": None,
        "weather_data": None,
        "risk_score": None,
        "risk_level": None,
        "storm_data": None,
        "land_verification": None,
    }

    try:
        # Run the Underwriting Graph
        final_state = await underwriting_graph.ainvoke(initial_state)
        
        return QuoteResponse(
            status=final_state["status"],
            premium_rlusd=final_state.get("premium_rlusd"),
            risk_score=final_state.get("risk_score"),
            risk_level=final_state.get("risk_level"),
            weather_data=final_state.get("weather_data"),
            reasoning_log=final_state.get("reasoning_log", [])
        )
    except Exception as e:
        logger.error(f"Agent Quote Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")


@app.post("/agent/monitor", response_model=MonitorResponse)
async def agent_monitor(request: MonitorRequest):
    """
    Triggers an agent monitoring cycle for a specific policy.
    
    1. Checks current weather and storm events.
    2. Runs ML risk model.
    3. LLM decides whether to trigger verification (satellite/storm check).
    4. If verified, executes settlement (via proper tool).
    """
    logger.info(f"Agent Monitor Request: Policy {request.policy_id}")
    
    initial_state = {
        "policy_id": request.policy_id,
        "status": "active",
        "location": {"lat": request.latitude, "lon": request.longitude},
        "crop_type": request.crop_type,
        "coverage_rlusd": request.coverage_rlusd,
        "reasoning_log": [],
        # Optional fields init
        "weather_data": None,
        "storm_data": None,
        "risk_score": None,
        "land_verification": None,
    }

    try:
        # Run the Monitoring Graph
        final_state = await monitoring_graph.ainvoke(initial_state)
        
        return MonitorResponse(
            status=final_state["status"],
            risk_score=final_state.get("risk_score"),
            reasoning_log=final_state.get("reasoning_log", []),
            transaction_hash=final_state.get("transaction_hash")
        )
    except Exception as e:
        logger.error(f"Agent Monitor Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════
# Chatbot Endpoint
# ═══════════════════════════════════════════════════════════════════════

@app.post("/agent/chat", response_model=ChatResponse)
async def agent_chat(request: ChatRequest):
    """
    User-facing chatbot for the Canopy Insurance Assistant.

    Helps farmers find the right policy, check if an area is farmland,
    understand risk for their location, and learn about policy mechanics.
    """
    logger.info(f"Chat request: {request.message[:80]}...")

    # Gather contextual tool data when coordinates are provided
    tool_context_parts: list[str] = []

    if request.latitude is not None and request.longitude is not None:
        lat, lon = request.latitude, request.longitude

        land = land_verification_tool.invoke({"latitude": lat, "longitude": lon})
        tool_context_parts.append(
            f"Land verification for ({lat}, {lon}): "
            + json.dumps(land, default=str)
        )

        weather = weather_tool.invoke({"latitude": lat, "longitude": lon, "days": 7})
        if weather.get("status") == "success":
            tool_context_parts.append(
                f"Weather 7-day for ({lat}, {lon}): "
                + json.dumps({
                    "total_precipitation_mm": weather.get("total_precipitation_mm"),
                    "temperature_max_c": weather.get("temperature_max_c"),
                    "soil_moisture": weather.get("soil_moisture"),
                    "summary": weather.get("summary"),
                }, default=str)
            )

            temp_list = weather.get("temperature_max_c") or [25]
            moisture_list = weather.get("soil_moisture") or [0.3]
            avg_temp = sum(temp_list) / max(len(temp_list), 1)
            avg_moisture = sum(moisture_list) / max(len(moisture_list), 1)
            crop = request.crop_type or "corn"
            risk = risk_tool.invoke({
                "precipitation_mm": weather["total_precipitation_mm"],
                "temperature_c": avg_temp,
                "soil_moisture": avg_moisture,
                "crop_type": crop,
            })
            tool_context_parts.append(
                f"Risk assessment ({crop}): " + json.dumps(risk, default=str)
            )

        storms = storm_events_tool.invoke({"latitude": lat, "longitude": lon})
        tool_context_parts.append(
            f"Storm events for ({lat}, {lon}): " + json.dumps(storms, default=str)
        )

    tool_context = "\n\n".join(tool_context_parts) if tool_context_parts else ""

    user_content = request.message
    if tool_context:
        user_content += "\n\n--- Tool Data ---\n" + tool_context

    response_text = _llm_decide(CHAT_SYSTEM_PROMPT, user_content)

    if not response_text:
        # Fallback when LLM is not configured
        if tool_context_parts:
            response_text = (
                "I gathered the following data for your location:\n\n"
                + "\n\n".join(tool_context_parts)
                + "\n\n(LLM not configured — showing raw tool output.)"
            )
        else:
            response_text = (
                "I'm the Canopy Insurance Assistant. I can help you find "
                "the right policy, check if an area is farmland, or "
                "assess risk for your location. Please provide coordinates "
                "(latitude/longitude) for location-specific help."
            )

    return ChatResponse(response=response_text, tool_data=tool_context_parts or None)


# ═══════════════════════════════════════════════════════════════════════
# Land Check Endpoint (standalone)
# ═══════════════════════════════════════════════════════════════════════

@app.post("/agent/check-land", response_model=LandCheckResponse)
async def check_land(request: LandCheckRequest):
    """
    Checks whether the given coordinates correspond to farmland.
    Users can call this when selecting an area on the map to verify
    it is agricultural land before purchasing a policy.
    """
    logger.info(f"Land check request for ({request.latitude}, {request.longitude})")

    result = land_verification_tool.invoke({
        "latitude": request.latitude,
        "longitude": request.longitude,
    })

    return LandCheckResponse(
        is_farmland=result.get("is_farmland"),
        confidence=result.get("confidence", 0.0),
        land_use=result.get("land_use", "unknown"),
        note=result.get("note", ""),
    )


# ═══════════════════════════════════════════════════════════════════════
# Audit Log Endpoint
# ═══════════════════════════════════════════════════════════════════════

@app.get("/agent/audit-log", response_model=AuditLogResponse)
async def audit_log(policy_id: str | None = None):
    """
    Returns the natural-language audit trail for agent decisions.
    Optionally filtered by policy_id.
    """
    entries = get_audit_log(policy_id)
    return AuditLogResponse(entries=entries, total=len(entries))
