from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal

class OracleRequest(BaseModel):
    lat: float = Field(..., description="Latitude of the farm location", ge=-90, le=90)
    lon: float = Field(..., description="Longitude of the farm location", ge=-180, le=180)
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

class OracleResponse(BaseModel):
    p_severity: float = Field(..., description="Probability (0-1) that conditions are severe")
    stress: StressDetails
    weather_summary: Optional[dict] = Field(None, description="Raw weather aggregates for transparency")
    note: Optional[str] = Field(None, description="Additional context (e.g. guardrail activation)")
