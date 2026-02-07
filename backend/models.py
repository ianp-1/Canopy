from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class OracleRequest(BaseModel):
    geometry: Dict[str, Any] = Field(..., description="GeoJSON Polygon or MultiPolygon of the farm field")
    weekly_rain_need_mm: float = Field(45.0, description="Weekly rainfall need in mm (corn=45, soy=40, wheat=30)")
    heat_threshold_K: float = Field(308.0, description="Heat stress threshold in Kelvin (corn=308, soy=305, wheat=303)")
    vpd_threshold_kpa: float = Field(1.6, description="VPD stress threshold in kPa (corn=1.6, soy=1.4, wheat=1.2)")
    date: Optional[str] = Field(None, description="Target date for evaluation (YYYY-MM-DD), defaults to today")
    bypass_safeguards: bool = Field(False, description="If true, skip tiered policy safeguards (for testing)")

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


class AgentSettleRequest(BaseModel):
    policy_id: str = Field(..., description="Database ID of the policy to settle")
    agent_confidence: float = Field(0.0, ge=0.0, le=1.0, description="Agent confidence score (0-1)")



class AgentSettleResponse(BaseModel):
    success: bool
    policy_id: str
    tx_hash: Optional[str] = None
    message: Optional[str] = None


class QuoteRequest(BaseModel):
    latitude: float = Field(..., description="Latitude of the farm")
    longitude: float = Field(..., description="Longitude of the farm")
    farm_size_hectares: float = Field(..., description="Size of the farm in hectares")
    crop_type: str = Field(..., description="Type of crop (corn, soy, spring_wheat, winter_wheat, other)")
    coverage_rlusd: Optional[float] = Field(None, description="Requested coverage amount in RLUSD")
    coverage_xrp: Optional[float] = Field(None, description="Alias for coverage_rlusd (backwards compat)")

    @property
    def coverage(self) -> float:
        """Return coverage amount, accepting either field name."""
        if self.coverage_rlusd is not None:
            return self.coverage_rlusd
        if self.coverage_xrp is not None:
            return self.coverage_xrp
        return 0.0


class QuoteResponse(BaseModel):
    status: str = Field(..., description="Final status (quote_pending or rejected)")
    premium_rlusd: Optional[float] = Field(None, description="Calculated premium in RLUSD")
    premium_xrp: Optional[float] = Field(None, description="Alias for premium_rlusd (backwards compat)")
    risk_score: Optional[float] = Field(None, description="Risk score (0-1)")
    risk_level: Optional[str] = Field(None, description="Risk level (LOW, MEDIUM, HIGH, CRITICAL)")
    weather_data: Optional[Dict[str, Any]] = Field(None, description="Weather data used for quote")
    reasoning_log: List[Dict[str, Any]] = Field(..., description="Agent reasoning chain")


class MonitorRequest(BaseModel):
    policy_id: str = Field(..., description="ID of the policy to monitor")
    latitude: float = Field(..., description="Latitude of the farm")
    longitude: float = Field(..., description="Longitude of the farm")
    crop_type: str = Field(..., description="Type of crop")
    coverage_rlusd: Optional[float] = Field(None, description="Coverage amount in RLUSD")
    coverage_xrp: Optional[float] = Field(None, description="Alias for coverage_rlusd (backwards compat)")

    @property
    def coverage(self) -> float:
        """Return coverage amount, accepting either field name."""
        if self.coverage_rlusd is not None:
            return self.coverage_rlusd
        if self.coverage_xrp is not None:
            return self.coverage_xrp
        return 0.0


class MonitorResponse(BaseModel):
    status: str = Field(..., description="Final status (active, claim_triggered, settled)")
    risk_score: Optional[float] = Field(None, description="Current risk score")
    reasoning_log: List[Dict[str, Any]] = Field(..., description="Agent reasoning chain")
    transaction_hash: Optional[str] = Field(None, description="Settlement tx hash if settled")



# ═══════════════════════════════════════════════════════════════════════
# Chatbot Models
# ═══════════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message to the chatbot")
    latitude: Optional[float] = Field(None, description="Latitude for location-specific queries")
    longitude: Optional[float] = Field(None, description="Longitude for location-specific queries")
    crop_type: Optional[str] = Field(None, description="Crop type for risk/pricing context")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Chatbot response text")
    tool_data: Optional[List[str]] = Field(None, description="Raw tool data used to generate the response")


# ═══════════════════════════════════════════════════════════════════════
# Land Verification Models
# ═══════════════════════════════════════════════════════════════════════

class LandCheckRequest(BaseModel):
    latitude: float = Field(..., description="Latitude of the location to verify")
    longitude: float = Field(..., description="Longitude of the location to verify")


class LandCheckResponse(BaseModel):
    is_farmland: Optional[bool] = Field(..., description="Whether the location is farmland")
    confidence: float = Field(..., description="Confidence score (0-1)")
    land_use: str = Field(..., description="Land-use classification")
    note: str = Field("", description="Human-readable explanation")


# ═══════════════════════════════════════════════════════════════════════
# Audit Log Models
# ═══════════════════════════════════════════════════════════════════════

class AuditLogResponse(BaseModel):
    entries: List[Dict[str, Any]] = Field(..., description="Audit log entries")
    total: int = Field(..., description="Total number of entries")
