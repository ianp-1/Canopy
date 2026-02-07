# Canopy AI Oracle Backend

The Python backend provides high-performance risk evaluation and machine learning capabilities for the Canopy platform. It hosts the "Guardian" AI Agent which orchestrates underwriting, monitoring, and policy settlement.

## Features

- **FastAPI-powered REST API**: Scalable and asynchronous endpoints.
- **AI Agent ("The Guardian")**: LangGraph-based agent for autonomous decision making.
- **ML Risk Evaluation**: Uses XGBoost/Logistic Regression to calculate payout severity.
- **GeoJSON Processing**: Analyzes farm risk based on precise geographic boundaries.
- **Real-time Tools**: Integrates with Open-Meteo, xWeather, and OSM for live data.

## Tech Stack

- **Framework**: FastAPI / Uvicorn
- **Agent**: LangChain / LangGraph
- **Data Science**: Scikit-learn, Pandas, Joblib, NumPy
- **Deployment**: Docker-ready

## Setup & Development

### 1. Create & Activate Virtual Environment

```bash
# Create venv in project root
python3 -m venv ../venv

# Activate
source ../venv/bin/activate
```

### 2. Install Requirements

```bash
pip install -r requirements.txt
```

### 3. Run Server

```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

### 🟢 System

#### `GET /health`

Returns system status and ML model load state.

### 🤖 AI Agent Endpoints

#### `POST /agent/quote`

Generates an insurance quote with dynamic pricing based on risk, weather volatility, and active storm events.

**Request:**

```json
{
  "latitude": 40.0,
  "longitude": -80.0,
  "farm_size_hectares": 50,
  "crop_type": "corn",
  "coverage_xrp": 1000
}
```

**Response:**

```json
{
  "status": "quote_pending",
  "premium_xrp": 105.5,
  "risk_score": 0.42,
  "risk_level": "MEDIUM",
  "reasoning_log": ["..."]
}
```

#### `POST /agent/monitor`

Triggers an agent monitoring cycle for an active policy. Checks weather/storms and decides if a claim should be triggered.

**Request:**

```json
{
  "policy_id": "pol_123",
  "latitude": 40.0,
  "longitude": -80.0,
  "crop_type": "corn",
  "coverage_xrp": 1000
}
```

#### `POST /agent/settle`

Agent-initiated settlement. Called when the monitor node confirms a payout condition. Delegates to the Next.js oracle layer for XRPL signature.

#### `POST /agent/chat`

Conversational interface for the Canopy Assistant. Can access tools to check land, weather, and risk during the chat.

#### `POST /agent/check-land`

Verifies if a specific lat/lon is agricultural land using OpenStreetMap data.

**Response:**

```json
{
  "is_farmland": true,
  "confidence": 0.9,
  "land_use": "agricultural",
  "note": "Farmland features detected..."
}
```

#### `GET /agent/audit-log`

Retrieves the natural-language audit trail of agent decisions.

### 🔮 Oracle Endpoints

#### `POST /oracle/evaluate`

Legacy/Direct endpoint for deterministic risk evaluation. Used by the cron job for scheduled checks.

**Request:**

```json
{
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "crop_type": "corn",
  "weekly_rain_need_mm": 45.0
}
```
