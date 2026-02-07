import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from backend.main import app
from unittest.mock import AsyncMock, patch
import pytest
import requests
import json

client = TestClient(app)

# Helper to create a small polygon around a center point
def create_polygon(lat, lon, size=0.01):
    half = size / 2
    # Counter-clockwise square: BL, BR, TR, TL, BL
    # GeoJSON is [lon, lat]
    return {
        "type": "Polygon",
        "coordinates": [[
            [lon - half, lat - half],
            [lon + half, lat - half],
            [lon + half, lat + half],
            [lon - half, lat + half],
            [lon - half, lat - half]
        ]]
    }

# Mock Data (Stressed Conditions)
MOCK_WEATHER_DATA = {
    "hourly": {
        "time": ["2023-01-01T00:00"] * 168,
        "temperature_2m": [35.0] * 168, # 35C -> 308.15K
        "relative_humidity_2m": [50.0] * 168,
        "precipitation": [0.0] * 168 # 0mm total
    }
}

@patch("backend.services.weather_service.WeatherService.fetch_history_7d", new_callable=AsyncMock)
def test_evaluate_endpoint_stressed_polygon(mock_fetch):
    # Setup Mock
    mock_fetch.return_value = MOCK_WEATHER_DATA
    
    # Request
    center_lat, center_lon = 40.0, -80.0
    payload = {
        "geometry": create_polygon(center_lat, center_lon),
        "weekly_rain_need_mm": 45.0,
        "heat_threshold_K": 308.0,
        "vpd_threshold_kpa": 1.6
    }
    
    response = client.post("/oracle/evaluate", json=payload)
    
    # Assertions
    assert response.status_code == 200, f"Response: {response.text}"
    data = response.json()
    
    # Check Structure
    assert "p_severity_farm" in data
    assert "sample_points" in data
    assert len(data["sample_points"]) == 5
    
    # Logic Checks
    # Since we return the same weather for all points, all should have high stress
    # Farm severity (80th percentile) should be high
    assert data["p_severity_farm"] > 0.8
    
    point1 = data["sample_points"][0]
    stress = point1["stress"]
    assert stress["rain_stress"] >= 0.99
    assert 0.6 <= stress["vpd_stress"] <= 1.0


# Mock Data (Winter/Dormant Conditions)
MOCK_WINTER_NO_GROW_WEATHER = {
    "hourly": {
        "time": ["2023-01-01T00:00"] * 168,
        "temperature_2m": [0.0] * 168, # 0C = 273.15K
        "relative_humidity_2m": [80.0] * 168,
        "precipitation": [0.0] * 168
    }
}

@patch("backend.services.weather_service.WeatherService.fetch_history_7d", new_callable=AsyncMock)
def test_evaluate_endpoint_winter_guardrail_polygon(mock_fetch):
    # Setup Mock
    mock_fetch.return_value = MOCK_WINTER_NO_GROW_WEATHER
    
    # Request
    center_lat, center_lon = 40.0, -80.0
    payload = {
        "geometry": create_polygon(center_lat, center_lon),
        "weekly_rain_need_mm": 45.0,
        "heat_threshold_K": 308.0,
        "vpd_threshold_kpa": 1.6
    }
    
    response = client.post("/oracle/evaluate", json=payload)
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    
    # Verify Guardrail
    assert data["p_severity_farm"] == 0.0, "Severity should be 0.0 during winter"
    assert "deterministic sample points" in data["note"]
    
    # Check sample points
    for point in data["sample_points"]:
        assert point["p_severity"] == 0.0

if __name__ == "__main__":
    # Local verification run
    try:
        test_evaluate_endpoint_stressed_polygon()
        test_evaluate_endpoint_winter_guardrail_polygon()
        print("Core Tests PASSED")
    except Exception as e:
        print(f"Test FAILED: {e}")
        import traceback
        traceback.print_exc()

# ==============================================================================
# SCENARIO TESTS - Real-world curl-based validation (Live Server)
# ==============================================================================

SCENARIOS = [
    # 1. Winter (Jan 10, 2023) - Expected 0.0
    {
        "name": "Winter Guardrail",
        "payload": {"geometry": create_polygon(42.0, -93.0), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2023-01-10"},
        "expected_range": (0.0, 0.0),
        "note_check": "deterministic sample points"
    },
    # 2. Spring Ideal (May 15, 2021) - Expected 0.05-0.25 (Note: slightly wider range due to sampling?)
    {
        "name": "Spring Ideal",
        "payload": {"geometry": create_polygon(41.5, -93.6), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2021-05-15"},
        "expected_range": (0.0, 0.25),
        "note_check": None
    },
    # 3. Summer Ideal (July 1, 2021) - Expected 0.0-0.1
    {
        "name": "Summer Ideal",
        "payload": {"geometry": create_polygon(42.0, -94.0), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2021-07-01"},
        "expected_range": (0.0, 0.1),
        "note_check": None
    },
    # 4. Hot/Dry Moderate (June 25, 2022) - Expected 0.3-0.6
    {
        "name": "Hot Dry Moderate",
        "payload": {"geometry": create_polygon(39.5, -96.5), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2022-06-25"},
        "expected_range": (0.3, 0.6),
        "note_check": None
    },
    # 5. Drought (July 5, 2022) - Expected 0.5-0.8
    {
        "name": "Drought Moderate",
        "payload": {"geometry": create_polygon(36.8, -97.2), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2022-07-05"},
        "expected_range": (0.5, 0.8),
        "note_check": None
    },
    # 6. Extreme Drought (July 20, 2022) - Expected >=0.9
    {
        "name": "Extreme Drought",
        "payload": {"geometry": create_polygon(38.0, -101.0), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2022-07-20"},
        "expected_range": (0.9, 1.0),
        "note_check": None
    },
    # 7. Late Season Moderate (Sep 10, 2021) - Expected 0.1-0.4
    {
        "name": "Late Season Moderate",
        "payload": {"geometry": create_polygon(41.8, -93.1), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2021-09-10"},
        "expected_range": (0.1, 0.4),
        "note_check": None
    },
    # 8. Heat Wave (Aug 1, 2021) - Expected 0.1-0.35 (Tier 1.5 cap applies)
    {
        "name": "Heat Wave Low Stress",
        "payload": {"geometry": create_polygon(37.0, -90.0), "weekly_rain_need_mm": 45.0, "heat_threshold_K": 308.0, "vpd_threshold_kpa": 1.6, "date": "2021-08-01"},
        "expected_range": (0.1, 0.35),
        "note_check": None
    },
]

def run_scenario_tests():
    """Run scenario tests against live server."""
    base_url = "http://127.0.0.1:8000/oracle/evaluate"
    results = []
    
    for scenario in SCENARIOS:
        try:
            resp = requests.post(base_url, json=scenario["payload"], timeout=20) # Increased timeout for 5x external calls
            if resp.status_code != 200:
                print(f"[FAIL] {scenario['name']}: Status {resp.status_code} - {resp.text}")
                continue
                
            data = resp.json()
            p = data["p_severity_farm"]
            lo, hi = scenario["expected_range"]
            passed = lo <= p <= hi
            
            status = "PASS" if passed else "FAIL"
            results.append({
                "name": scenario["name"],
                "status": status,
                "p_severity": p,
                "expected": f"{lo}-{hi}"
            })
            
            print(f"[{status}] {scenario['name']}: p={p:.4f} (expected {lo}-{hi})")
            if scenario["note_check"] and scenario["note_check"] not in str(data.get("note", "")):
                print(f"  WARNING: Expected note containing '{scenario['note_check']}'")
                
        except Exception as e:
            results.append({"name": scenario["name"], "status": "ERROR", "error": str(e)})
            print(f"[ERROR] {scenario['name']}: {e}")
    
    passed_count = sum(1 for r in results if r["status"] == "PASS")
    print(f"\nScenario Results: {passed_count}/{len(SCENARIOS)} passed")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--scenarios":
        run_scenario_tests()
