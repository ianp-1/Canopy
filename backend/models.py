from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class OracleRequest(BaseModel):
    geometry: Dict[str, Any] = Field(..., description="GeoJSON Polygon or MultiPolygon of the farm field")
    weekly_rain_need_mm: float = Field(45.0, description="Weekly rainfall need in mm (corn=45, soy=40, wheat=30)")
    heat_threshold_K: float = Field(308.0, description="Heat stress threshold in Kelvin (corn=308, soy=305, wheat=303)")
    vpd_threshold_kpa: float = Field(1.6, description="VPD stress threshold in kPa (corn=1.6, soy=1.4, wheat=1.2)")
    date: Optional[str] = Field(None, description="Target date for evaluation (YYYY-MM-DD), defaults to today")

class StressDetails(BaseModel):
    rain_stress: float = Field(..., description="Normalized rain stress (0-1+)")
    heat_stress: float = Field(..., description="Normalized heat stress (0-1)")
    vpd_stress: float = Field(..., description="Normalized VPD stress (0-1)")

class SamplePoint(BaseModel):
    lat: float
    lon: float
    p_severity: float
    stress: Optional[StressDetails] = None
    weather_summary: Optional[Dict[str, Any]] = None

class OracleResponse(BaseModel):
    p_severity_farm: float = Field(..., description="Aggregated farm-level severity (80th percentile)")
    sample_points: List[SamplePoint] = Field(..., description="Individual evaluation points used for aggregation")
    note: Optional[str] = Field(None, description="Additional context")
