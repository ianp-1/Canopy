from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any

class OracleRequest(BaseModel):
    geometry: Dict[str, Any] = Field(..., description="GeoJSON Polygon or MultiPolygon of the farm field")
    crop_type: Optional[str] = Field("corn", description="Crop identifier (e.g., 'corn', 'wheat')")
    date: Optional[str] = Field(None, description="Target date for evaluation (YYYY-MM-DD), defaults to today")

    @field_validator('crop_type')
    @classmethod
    def validate_crop(cls, v: str) -> str:
        if not v:
            return "corn"
        return v.lower()

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
