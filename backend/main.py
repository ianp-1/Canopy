from fastapi import FastAPI, HTTPException, Depends
from .models import OracleRequest, OracleResponse
from .services.weather_service import WeatherService
from .services.oracle_service import OracleService
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="XRP Farmer Intelligence Layer",
    description="API for calculating agricultural insurance parameters and oracle logic",
    version="0.1.0"
)

# Singleton Services
weather_service = WeatherService()
oracle_service = OracleService()

@app.get("/")
async def root():
    return {"message": "XRP Farmer Intelligence Layer is running"}

@app.get("/health")
async def health_check():
    model_status = "loaded" if oracle_service.model else "not_loaded"
    return {"status": "ok", "model": model_status}

@app.post("/oracle/evaluate", response_model=OracleResponse)
async def evaluate_risk(request: OracleRequest):
    """
    Evaluates crop risk based on real-time weather data (last 7 days).
    """
    if not oracle_service.model:
        raise HTTPException(status_code=503, detail="ML Model is not loaded.")

    logger.info(f"Received evaluation request: {request}")

    try:
        # 1. Fetch Weather Data
        date_obj = None
        if request.date:
            from datetime import date
            date_obj = date.fromisoformat(request.date)
            
        weather_data = await weather_service.fetch_history_7d(request.lat, request.lon, date_obj)
        
        # 2. Process & Aggregate
        aggregates = oracle_service.process_weather_data(weather_data)
        
        # 3. Evaluate Risk
        result = oracle_service.evaluate_risk(aggregates, request.crop_type)
        
        return result

    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
