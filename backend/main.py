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

    logger.info(f"Received evaluation request for crop: {request.crop_type}")

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
            # Pass (lat, lon) so they can be included in the SamplePoint result
            point_result = oracle_service.evaluate_risk(aggregates, request.crop_type, lat=lat, lon=lon)
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
