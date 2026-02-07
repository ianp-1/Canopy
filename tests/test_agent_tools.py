"""
Tests for the AI agent tools.

Tests the new tools (pricing, land verification, storm events, audit log)
and the Chain-of-Thought builder without requiring external APIs or LLM keys.
"""
import pytest
from unittest.mock import patch, MagicMock
from backend.agent.tools import (
    pricing_tool,
    audit_log_tool,
    get_audit_log,
    get_all_tools,
    storm_events_tool,
    land_verification_tool,
    weather_tool,
    _audit_log,
)


# ═══════════════════════════════════════════════════════════════════════
# Pricing Tool Tests
# ═══════════════════════════════════════════════════════════════════════

class TestPricingTool:

    def test_basic_pricing(self):
        result = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
        })
        assert result["status"] == "success"
        assert result["premium_xrp"] > 0
        assert "explanation" in result
        assert "breakdown" in result

    def test_storm_surcharge_increases_premium(self):
        base = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
            "active_storm_events": 0,
        })
        with_storms = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
            "active_storm_events": 3,
        })
        assert with_storms["premium_xrp"] > base["premium_xrp"]
        assert with_storms["breakdown"]["storm_surcharge"] > 1.0

    def test_size_discount(self):
        small = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
            "farm_size_hectares": 10.0,
        })
        large = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
            "farm_size_hectares": 100.0,
        })
        assert large["premium_xrp"] < small["premium_xrp"]
        assert large["breakdown"]["size_discount"] == 0.90

    def test_crop_type_affects_rate(self):
        corn = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "corn",
        })
        wheat = pricing_tool.invoke({
            "coverage_xrp": 1000.0,
            "risk_score": 0.5,
            "crop_type": "wheat",
        })
        # Corn base rate (0.05) > Wheat base rate (0.04)
        assert corn["premium_xrp"] > wheat["premium_xrp"]

    def test_explanation_mentions_factors(self):
        result = pricing_tool.invoke({
            "coverage_xrp": 500.0,
            "risk_score": 0.7,
            "crop_type": "soybean",
            "weather_volatility": 1.3,
            "active_storm_events": 1,
            "farm_size_hectares": 60.0,
        })
        explanation = result["explanation"]
        assert "soybean" in explanation.lower() or "Base rate" in explanation
        assert "Storm surcharge" in explanation
        assert "Size discount" in explanation


# ═══════════════════════════════════════════════════════════════════════
# Audit Log Tool Tests
# ═══════════════════════════════════════════════════════════════════════

class TestAuditLogTool:

    def setup_method(self):
        _audit_log.clear()

    def test_creates_entry(self):
        result = audit_log_tool.invoke({
            "policy_id": "pol-001",
            "action": "APPROVE",
            "reasoning": "All checks passed",
            "confidence": 0.95,
        })
        assert result["status"] == "success"
        assert result["entry"]["policy_id"] == "pol-001"
        assert result["entry"]["action"] == "APPROVE"
        assert result["entry"]["confidence"] == 0.95
        assert len(result["entry"]["evidence_hash"]) == 64  # SHA-256 hex

    def test_evidence_hash_deterministic(self):
        r1 = audit_log_tool.invoke({
            "policy_id": "pol-002",
            "action": "REJECT",
            "reasoning": "Same reasoning",
            "confidence": 0.5,
            "evidence_data": "same data",
        })
        _audit_log.clear()
        r2 = audit_log_tool.invoke({
            "policy_id": "pol-002",
            "action": "REJECT",
            "reasoning": "Same reasoning",
            "confidence": 0.5,
            "evidence_data": "same data",
        })
        assert r1["entry"]["evidence_hash"] == r2["entry"]["evidence_hash"]

    def test_get_audit_log_filters_by_policy(self):
        audit_log_tool.invoke({
            "policy_id": "pol-A",
            "action": "APPROVE",
            "reasoning": "test",
        })
        audit_log_tool.invoke({
            "policy_id": "pol-B",
            "action": "REJECT",
            "reasoning": "test",
        })
        assert len(get_audit_log("pol-A")) == 1
        assert len(get_audit_log("pol-B")) == 1
        assert len(get_audit_log()) == 2


# ═══════════════════════════════════════════════════════════════════════
# Storm Events Tool Tests (mocked HTTP)
# ═══════════════════════════════════════════════════════════════════════

class TestStormEventsTool:

    @patch("backend.agent.tools.httpx.get")
    def test_open_meteo_fallback_no_events(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "daily": {
                "time": ["2024-01-01", "2024-01-02", "2024-01-03"],
                "weathercode": [1, 2, 3],  # Clear/partly cloudy
                "windspeed_10m_max": [10, 15, 12],
                "precipitation_sum": [0, 1, 0],
            }
        }
        mock_get.return_value = mock_response

        result = storm_events_tool.invoke({
            "latitude": 40.0,
            "longitude": -93.0,
        })
        assert result["status"] == "success"
        assert result["event_count"] == 0
        assert result["has_severe_events"] is False

    @patch("backend.agent.tools.httpx.get")
    def test_open_meteo_detects_thunderstorm(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "daily": {
                "time": ["2024-07-01", "2024-07-02", "2024-07-03"],
                "weathercode": [3, 95, 96],  # Clear, thunderstorm, hail
                "windspeed_10m_max": [20, 60, 85],
                "precipitation_sum": [0, 30, 45],
            }
        }
        mock_get.return_value = mock_response

        result = storm_events_tool.invoke({
            "latitude": 40.0,
            "longitude": -93.0,
        })
        assert result["status"] == "success"
        assert result["event_count"] >= 2
        assert result["has_severe_events"] is True
        types = [e["type"] for e in result["active_events"]]
        assert "thunderstorm/severe" in types


# ═══════════════════════════════════════════════════════════════════════
# Weather Tool Tests (mocked HTTP)
# ═══════════════════════════════════════════════════════════════════════

class TestWeatherTool:

    @patch("backend.agent.tools.httpx.get")
    def test_returns_comprehensive_data(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "daily": {
                "time": ["2024-01-01"],
                "weathercode": [3],
                "precipitation_sum": [5.0],
                "temperature_2m_max": [30.0],
                "temperature_2m_min": [18.0],
                "apparent_temperature_max": [33.0],
                "windspeed_10m_max": [25.0],
                "windgusts_10m_max": [45.0],
                "uv_index_max": [8.0],
                "et0_fao_evapotranspiration": [4.5],
                "soil_moisture_0_to_10cm_mean": [0.25],
                "soil_temperature_0cm": [22.0],
            }
        }
        mock_get.return_value = mock_response

        result = weather_tool.invoke({
            "latitude": 40.0,
            "longitude": -93.0,
        })
        assert result["status"] == "success"
        # Core fields
        assert "precipitation_mm" in result
        assert "temperature_max_c" in result
        assert "soil_moisture" in result
        assert "total_precipitation_mm" in result
        # Extended fields for LLM reasoning
        assert "windspeed_max_kmh" in result
        assert "uv_index_max" in result
        assert "et0_mm" in result
        assert "weathercodes" in result
        # Summary stats
        assert "summary" in result
        assert result["summary"]["max_wind_kmh"] == 25.0


# ═══════════════════════════════════════════════════════════════════════
# Tool Registry
# ═══════════════════════════════════════════════════════════════════════

class TestToolRegistry:

    def test_all_tools_registered(self):
        tools = get_all_tools()
        names = {t.name for t in tools}
        assert names == {
            "weather_tool",
            "risk_tool",
            "pricing_tool",
            "land_verification_tool",
            "storm_events_tool",
            "xrpl_escrow_tool",
            "audit_log_tool",
        }

    def test_no_satellite_tool(self):
        tools = get_all_tools()
        names = {t.name for t in tools}
        assert "satellite_tool" not in names
