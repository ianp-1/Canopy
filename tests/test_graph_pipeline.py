"""
Tests for the LangGraph Agent Pipeline.

Validates the full insurance lifecycle through the four graph nodes:
  1. underwrite_node — Land verification, risk assessment, dynamic pricing
  2. monitor_node   — Multimodal data fusion, claim triggering
  3. verify_node    — Satellite + storm cross-check, conflict resolution
  4. settle_node    — Final audit, EscrowFinish execution

Also tests:
  - Graph construction & conditional routing
  - Chain-of-Thought builder
  - State transitions across the pipeline
"""
import pytest
from unittest.mock import patch, MagicMock
from backend.agent.graph import (
    underwrite_node,
    monitor_node,
    verify_node,
    settle_node,
    build_underwriting_graph,
    build_monitoring_graph,
    _build_cot,
    AgentState,
)
from backend.agent.tools import _audit_log


# ═══════════════════════════════════════════════════════════════════════
# Shared Mock Data
# ═══════════════════════════════════════════════════════════════════════

MOCK_LOCATION = {"lat": 40.0, "lon": -93.0}

MOCK_WEATHER_SUCCESS = {
    "status": "success",
    "total_precipitation_mm": 25.0,
    "precipitation_mm": [3.0, 4.0, 5.0, 2.0, 3.0, 4.0, 4.0],
    "temperature_max_c": [28.0, 30.0, 31.0, 29.0, 27.0, 28.0, 30.0],
    "temperature_min_c": [15.0, 16.0, 17.0, 15.0, 14.0, 15.0, 16.0],
    "soil_moisture": [0.3, 0.28, 0.25, 0.27, 0.3, 0.31, 0.29],
    "windspeed_max_kmh": [20.0, 25.0, 15.0, 18.0, 22.0, 20.0, 17.0],
    "weathercodes": [1, 2, 3, 1, 2, 1, 3],
    "summary": {"max_wind_kmh": 25.0},
}

MOCK_WEATHER_ERROR = {
    "status": "error",
    "message": "Weather lookup failed",
    "total_precipitation_mm": 0.0,
    "weathercodes": [],
}

MOCK_LAND_FARMLAND = {
    "status": "success",
    "is_farmland": True,
    "source": "USDA NASS CDL + OpenStreetMap",
    "note": "Farmland confirmed via CDL and OSM.",
}

MOCK_LAND_NOT_FARMLAND = {
    "status": "success",
    "is_farmland": False,
    "source": "USDA NASS CDL + OpenStreetMap",
    "note": "No farmland detected.",
}

MOCK_STORMS_NONE = {
    "status": "success",
    "event_count": 0,
    "active_events": [],
    "has_severe_events": False,
    "source": "open-meteo",
}

MOCK_STORMS_SEVERE = {
    "status": "success",
    "event_count": 2,
    "active_events": [
        {"type": "thunderstorm/severe", "date": "2024-07-01"},
        {"type": "hail", "date": "2024-07-02"},
    ],
    "has_severe_events": True,
    "source": "open-meteo",
}

MOCK_RISK_LOW = {
    "status": "success",
    "risk_score": 0.25,
    "risk_level": "LOW",
}

MOCK_RISK_HIGH = {
    "status": "success",
    "risk_score": 0.75,
    "risk_level": "HIGH",
}

MOCK_RISK_CRITICAL = {
    "status": "success",
    "risk_score": 0.90,
    "risk_level": "CRITICAL",
}

MOCK_NDVI_HEALTHY = {
    "status": "success",
    "analysis": "ndvi",
    "mean_ndvi": 0.65,
    "image_date": "2024-07-01",
    "platform": "Sentinel-2",
}

MOCK_NDVI_STRESSED = {
    "status": "success",
    "analysis": "ndvi",
    "mean_ndvi": 0.20,
    "image_date": "2024-07-01",
    "platform": "Sentinel-2",
}

MOCK_ESCROW_SUCCESS = {
    "status": "success",
    "policy_id": "pol-001",
    "tx_hash": "ABC123DEF456",
    "settled": True,
}

MOCK_ESCROW_FAILURE = {
    "status": "error",
    "message": "Escrow finish failed",
    "settled": False,
}


def _base_state(**overrides) -> dict:
    """Create a base AgentState dict with reasonable defaults."""
    state = {
        "policy_id": "pol-001",
        "status": "active",
        "location": MOCK_LOCATION,
        "farm_size_hectares": 50.0,
        "crop_type": "corn",
        "coverage_xrp": 1000.0,
        "premium_xrp": None,
        "weather_data": None,
        "risk_score": None,
        "risk_level": None,
        "storm_data": None,
        "land_verification": None,
        "reasoning_log": [],
        "confidence_score": None,
        "llm_reasoning": None,
        "escrow_sequence": None,
        "transaction_hash": None,
    }
    state.update(overrides)
    return state


# ═══════════════════════════════════════════════════════════════════════
# Chain-of-Thought Helper Tests
# ═══════════════════════════════════════════════════════════════════════

class TestBuildCoT:

    def test_basic_structure(self):
        cot = _build_cot("Underwriting", ["step1", "step2"], "APPROVE", 0.85)
        assert cot["phase"] == "Underwriting"
        assert cot["steps"] == ["step1", "step2"]
        assert cot["decision"] == "APPROVE"
        assert cot["confidence"] == 0.85
        assert cot["formatted_confidence"] == "85.00%"
        assert "timestamp" in cot

    def test_confidence_rounding(self):
        cot = _build_cot("Test", [], "OK", 0.123456789)
        assert cot["confidence"] == 0.1235  # 4 decimal places

    def test_zero_confidence(self):
        cot = _build_cot("Test", [], "REJECT", 0.0)
        assert cot["confidence"] == 0.0
        assert cot["formatted_confidence"] == "0.00%"

    def test_full_confidence(self):
        cot = _build_cot("Test", [], "APPROVE", 1.0)
        assert cot["confidence"] == 1.0
        assert cot["formatted_confidence"] == "100.00%"


# ═══════════════════════════════════════════════════════════════════════
# Underwrite Node Tests
# ═══════════════════════════════════════════════════════════════════════

class TestUnderwriteNode:

    def setup_method(self):
        _audit_log.clear()

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.pricing_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_approve_low_risk(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_pricing, mock_audit, mock_llm
    ):
        """Low-risk farmland should be approved with a premium."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_pricing.invoke.return_value = {
            "status": "success",
            "premium_xrp": 62.5,
            "explanation": "Base rate for corn: 5%",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert result["status"] == "quote_pending"
        assert result["premium_xrp"] == 62.5
        assert result["risk_score"] == 0.25
        assert result["risk_level"] == "LOW"
        assert len(result["reasoning_log"]) == 1
        assert result["reasoning_log"][0]["phase"] == "Underwriting"
        assert "APPROVE" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_reject_not_farmland(self, mock_satellite, mock_audit, mock_llm):
        """Non-farmland locations should be rejected immediately."""
        mock_satellite.invoke.return_value = MOCK_LAND_NOT_FARMLAND
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert result["status"] == "rejected"
        assert len(result["reasoning_log"]) == 1
        assert "not farmland" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_reject_critical_risk(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_audit, mock_llm
    ):
        """CRITICAL risk level should be rejected (threshold fallback)."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_CRITICAL
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert result["status"] == "rejected"
        assert result["risk_score"] == 0.90
        assert result["risk_level"] == "CRITICAL"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_reject_weather_error(
        self, mock_satellite, mock_storms, mock_audit, mock_llm
    ):
        """Weather API failure should cause rejection."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        # Patch weather_tool directly since it's invoked in the node
        with patch("backend.agent.graph.weather_tool") as mock_weather:
            mock_weather.invoke.return_value = MOCK_WEATHER_ERROR

            state = _base_state()
            result = underwrite_node(state)

        assert result["status"] == "rejected"
        assert "data unavailable" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="REJECT: disaster in progress")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_llm_reject_overrides_low_risk(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_audit, mock_llm
    ):
        """LLM saying REJECT should override low ML risk."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert result["status"] == "rejected"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.pricing_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_reasoning_log_is_list(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_pricing, mock_audit, mock_llm
    ):
        """reasoning_log should always be a list of CoT dicts."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_pricing.invoke.return_value = {
            "status": "success",
            "premium_xrp": 50.0,
            "explanation": "Test",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert isinstance(result["reasoning_log"], list)
        assert len(result["reasoning_log"]) >= 1
        cot = result["reasoning_log"][0]
        assert "phase" in cot
        assert "steps" in cot
        assert "decision" in cot
        assert "confidence" in cot
        assert "timestamp" in cot


# ═══════════════════════════════════════════════════════════════════════
# Monitor Node Tests
# ═══════════════════════════════════════════════════════════════════════

class TestMonitorNode:

    def setup_method(self):
        _audit_log.clear()

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_safe_low_risk(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Low risk + no storms → stay in monitoring (no status change)."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        # Safe path does NOT set status (remains unchanged)
        assert "status" not in result or result.get("status") == "monitoring"
        assert result["risk_score"] == 0.25
        assert len(result["reasoning_log"]) == 1
        assert "SAFE" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_trigger_high_risk(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Very high risk (≥0.8) → trigger claim even without storms."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = {
            "status": "success",
            "risk_score": 0.85,
            "risk_level": "CRITICAL",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        assert result["status"] == "claim_triggered"
        assert result["risk_score"] == 0.85
        assert "TRIGGER" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_trigger_medium_risk_with_storms(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Medium risk (≥0.6) + severe storms → trigger claim."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_risk.invoke.return_value = {
            "status": "success",
            "risk_score": 0.65,
            "risk_level": "HIGH",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        assert result["status"] == "claim_triggered"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_no_trigger_medium_risk_no_storms(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Medium risk (<0.8) + no storms → stay in monitoring."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = {
            "status": "success",
            "risk_score": 0.65,
            "risk_level": "HIGH",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        # Should NOT trigger: risk < 0.8 and no severe storms
        assert "status" not in result or result.get("status") != "claim_triggered"

    @patch("backend.agent.graph._llm_decide", return_value="TRIGGER: severe drought detected")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_llm_trigger(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """LLM saying TRIGGER should override low ML risk."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        assert result["status"] == "claim_triggered"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_weather_error_returns_warning(
        self, mock_weather, mock_storms, mock_risk, mock_llm
    ):
        """Weather failure should return a warning reasoning log."""
        mock_weather.invoke.return_value = MOCK_WEATHER_ERROR

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        assert len(result["reasoning_log"]) >= 1


# ═══════════════════════════════════════════════════════════════════════
# Verify Node Tests
# ═══════════════════════════════════════════════════════════════════════

class TestVerifyNode:

    def setup_method(self):
        _audit_log.clear()

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_confirm_severe_storms(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """Severe storms alone should confirm the claim."""
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_satellite.invoke.return_value = MOCK_NDVI_STRESSED
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.75,
        )
        result = verify_node(state)

        # No status change means remains claim_triggered → routes to settle
        assert "status" not in result or result.get("status") != "monitoring"
        assert result["confidence_score"] is not None
        assert result["confidence_score"] > 0

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_confirm_very_high_risk(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """Risk ≥ 0.85 should confirm even without storms."""
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_satellite.invoke.return_value = MOCK_NDVI_STRESSED
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.90,
        )
        result = verify_node(state)

        assert "status" not in result or result.get("status") != "monitoring"
        assert result["confidence_score"] is not None

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_conflict_low_risk_no_storms_healthy_ndvi(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """Low risk + no storms + healthy NDVI → conflict, back to monitoring."""
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_satellite.invoke.return_value = MOCK_NDVI_HEALTHY
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.40,
        )
        result = verify_node(state)

        assert result["status"] == "monitoring"
        assert "CONFLICT" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_confirm_medium_risk_with_ndvi_stress(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """Medium risk (≥0.6) + stressed NDVI → confirm."""
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_satellite.invoke.return_value = MOCK_NDVI_STRESSED
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.65,
        )
        result = verify_node(state)

        # NDVI=0.20 < 0.35 and risk >= 0.6 → confirmed
        assert "status" not in result or result.get("status") != "monitoring"
        assert result["confidence_score"] is not None

    @patch("backend.agent.graph._llm_decide", return_value="CONFIRM with high confidence")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_llm_confirm(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """LLM saying CONFIRM should confirm the claim."""
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_satellite.invoke.return_value = MOCK_NDVI_HEALTHY
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.50,
        )
        result = verify_node(state)

        # LLM overrides fallback logic
        assert "status" not in result or result.get("status") != "monitoring"
        assert result["confidence_score"] is not None

    @patch("backend.agent.graph._llm_decide", return_value="DENY: insufficient evidence")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_llm_deny(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """LLM saying DENY (without 'confirm' keyword) → conflict."""
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_satellite.invoke.return_value = MOCK_NDVI_HEALTHY
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.80,
        )
        result = verify_node(state)

        assert result["status"] == "monitoring"


# ═══════════════════════════════════════════════════════════════════════
# Settle Node Tests
# ═══════════════════════════════════════════════════════════════════════

class TestSettleNode:

    def setup_method(self):
        _audit_log.clear()

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.xrpl_escrow_tool")
    def test_settle_success(self, mock_escrow, mock_audit, mock_llm):
        """Successful escrow finish → settled with tx_hash."""
        mock_escrow.invoke.return_value = MOCK_ESCROW_SUCCESS
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            confidence_score=0.85,
            risk_score=0.80,
        )
        result = settle_node(state)

        assert result["status"] == "settled"
        assert result["transaction_hash"] == "ABC123DEF456"
        assert len(result["reasoning_log"]) == 1
        assert "SETTLED" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.xrpl_escrow_tool")
    def test_settle_escrow_failure(self, mock_escrow, mock_audit, mock_llm):
        """Escrow failure → settled with FAILED note (will retry)."""
        mock_escrow.invoke.return_value = MOCK_ESCROW_FAILURE
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            confidence_score=0.85,
            risk_score=0.80,
        )
        result = settle_node(state)

        assert result["status"] == "settled"
        assert "FAILED" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="REJECT: data inconsistency")
    @patch("backend.agent.graph.audit_log_tool")
    def test_llm_denies_settlement(self, mock_audit, mock_llm):
        """LLM saying REJECT → deny settlement, back to monitoring."""
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            confidence_score=0.85,
            risk_score=0.80,
        )
        result = settle_node(state)

        assert result["status"] == "monitoring"
        assert "DENIED" in result["reasoning_log"][0]["decision"]

    @patch("backend.agent.graph._llm_decide", return_value="APPROVE SETTLEMENT: all checks passed")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.xrpl_escrow_tool")
    def test_llm_approves_settlement(self, mock_escrow, mock_audit, mock_llm):
        """LLM approving → proceed to escrow execution."""
        mock_escrow.invoke.return_value = MOCK_ESCROW_SUCCESS
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            confidence_score=0.90,
            risk_score=0.85,
        )
        result = settle_node(state)

        assert result["status"] == "settled"
        assert result["transaction_hash"] == "ABC123DEF456"

    @patch("backend.agent.graph._llm_decide", return_value="do not proceed with payout")
    @patch("backend.agent.graph.audit_log_tool")
    def test_llm_do_not_denies(self, mock_audit, mock_llm):
        """LLM saying 'do not' → deny settlement."""
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            confidence_score=0.70,
            risk_score=0.75,
        )
        result = settle_node(state)

        assert result["status"] == "monitoring"


# ═══════════════════════════════════════════════════════════════════════
# Graph Construction & Routing Tests
# ═══════════════════════════════════════════════════════════════════════

class TestGraphConstruction:

    def test_underwriting_graph_compiles(self):
        """The underwriting graph should compile without errors."""
        graph = build_underwriting_graph()
        assert graph is not None

    def test_monitoring_graph_compiles(self):
        """The monitoring graph should compile without errors."""
        graph = build_monitoring_graph()
        assert graph is not None

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.pricing_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_underwriting_graph_approve_flow(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_pricing, mock_audit, mock_llm
    ):
        """Full graph invoke: approve flow ends at quote_pending."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_pricing.invoke.return_value = {
            "status": "success",
            "premium_xrp": 62.5,
            "explanation": "Test premium",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        graph = build_underwriting_graph()
        state = _base_state(policy_id="quote_request", status="quote_pending")
        final = graph.invoke(state)

        assert final["status"] == "quote_pending"
        assert final["premium_xrp"] == 62.5

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_underwriting_graph_reject_flow(
        self, mock_satellite, mock_audit, mock_llm
    ):
        """Full graph invoke: reject flow ends at rejected."""
        mock_satellite.invoke.return_value = MOCK_LAND_NOT_FARMLAND
        mock_audit.invoke.return_value = {"status": "success"}

        graph = build_underwriting_graph()
        state = _base_state(policy_id="quote_request", status="quote_pending")
        final = graph.invoke(state)

        assert final["status"] == "rejected"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_monitoring_graph_safe_flow(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Monitor graph: safe conditions → END (no trigger)."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_audit.invoke.return_value = {"status": "success"}

        graph = build_monitoring_graph()
        state = _base_state(status="active")
        final = graph.invoke(state)

        # Should NOT reach claim_triggered or settled
        assert final["status"] in ("active", "monitoring")

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.xrpl_escrow_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_monitoring_graph_full_payout_flow(
        self, mock_weather, mock_storms, mock_risk, mock_satellite,
        mock_escrow, mock_audit, mock_llm
    ):
        """
        Monitor → Verify → Settle: full payout flow.
        
        High risk triggers claim, severe storms confirm verification,
        escrow finish executes successfully.
        """
        # Monitor sees high risk
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_risk.invoke.return_value = {
            "status": "success",
            "risk_score": 0.85,
            "risk_level": "CRITICAL",
        }
        # Verify sees storms + stressed NDVI
        mock_satellite.invoke.return_value = MOCK_NDVI_STRESSED
        # Settle succeeds
        mock_escrow.invoke.return_value = MOCK_ESCROW_SUCCESS
        mock_audit.invoke.return_value = {"status": "success"}

        graph = build_monitoring_graph()
        state = _base_state(status="active")
        final = graph.invoke(state)

        assert final["status"] == "settled"
        assert final["transaction_hash"] == "ABC123DEF456"

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_monitoring_graph_trigger_then_conflict(
        self, mock_weather, mock_storms, mock_risk, mock_satellite,
        mock_audit, mock_llm
    ):
        """
        Monitor → Verify conflict: trigger then back to monitoring.
        
        High risk triggers claim, but verification finds no storms
        and healthy NDVI → conflict returns to monitoring.
        """
        # Monitor sees high risk → triggers
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = {
            "status": "success",
            "risk_score": 0.85,
            "risk_level": "CRITICAL",
        }
        # First storm call (monitor) returns severe → triggers
        # Second storm call (verify) returns none → conflict
        mock_storms.invoke.side_effect = [
            MOCK_STORMS_SEVERE,  # monitor sees storms
            MOCK_STORMS_NONE,    # verify sees no storms
        ]
        # Verify satellite shows healthy crops
        mock_satellite.invoke.return_value = MOCK_NDVI_HEALTHY
        mock_audit.invoke.return_value = {"status": "success"}

        graph = build_monitoring_graph()
        state = _base_state(status="active")
        final = graph.invoke(state)

        # Verify conflicts → back to monitoring
        assert final["status"] == "monitoring"


# ═══════════════════════════════════════════════════════════════════════
# State Transition Tests
# ═══════════════════════════════════════════════════════════════════════

class TestStateTransitions:

    def setup_method(self):
        _audit_log.clear()

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.pricing_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.weather_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.satellite_tool")
    def test_underwrite_populates_weather_data(
        self, mock_satellite, mock_storms, mock_weather,
        mock_risk, mock_pricing, mock_audit, mock_llm
    ):
        """Approved quote should populate weather_data in state."""
        mock_satellite.invoke.return_value = MOCK_LAND_FARMLAND
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_pricing.invoke.return_value = {
            "status": "success",
            "premium_xrp": 50.0,
            "explanation": "test",
        }
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state()
        result = underwrite_node(state)

        assert result["weather_data"] is not None
        assert result["weather_data"]["status"] == "success"
        assert result["storm_data"] is not None
        assert result["land_verification"] is not None

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.risk_tool")
    @patch("backend.agent.graph.storm_events_tool")
    @patch("backend.agent.graph.weather_tool")
    def test_monitor_populates_risk_data(
        self, mock_weather, mock_storms, mock_risk, mock_audit, mock_llm
    ):
        """Monitor node should populate risk_score and storm_data."""
        mock_weather.invoke.return_value = MOCK_WEATHER_SUCCESS
        mock_storms.invoke.return_value = MOCK_STORMS_NONE
        mock_risk.invoke.return_value = MOCK_RISK_LOW
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(status="monitoring")
        result = monitor_node(state)

        assert result["risk_score"] == 0.25
        assert result["weather_data"] is not None
        assert result["storm_data"] is not None

    @patch("backend.agent.graph._llm_decide", return_value="")
    @patch("backend.agent.graph.audit_log_tool")
    @patch("backend.agent.graph.satellite_tool")
    @patch("backend.agent.graph.storm_events_tool")
    def test_verify_sets_confidence(
        self, mock_storms, mock_satellite, mock_audit, mock_llm
    ):
        """Confirmed verification should set confidence_score."""
        mock_storms.invoke.return_value = MOCK_STORMS_SEVERE
        mock_satellite.invoke.return_value = MOCK_NDVI_STRESSED
        mock_audit.invoke.return_value = {"status": "success"}

        state = _base_state(
            status="claim_triggered",
            risk_score=0.80,
        )
        result = verify_node(state)

        assert result["confidence_score"] is not None
        # confidence = min(risk_score + 0.1, 1.0) = min(0.9, 1.0) = 0.9
        assert result["confidence_score"] == pytest.approx(0.9, abs=0.01)
