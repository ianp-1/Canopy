# Canopy AI Oracle Backend

The Python backend provides high-performance risk evaluation and machine learning capabilities for the Canopy platform.

## Features

- **FastAPI-powered REST API**: Scalable and asynchronous endpoints.
- **ML Risk Evaluation**: Uses a Logistic Regression model to calculate payout severity.
- **GeoJSON Processing**: Analyzes farm risk based on precise geographic boundaries.
- **Consensus Logic**: Orchestration for multiple data sources.

## Tech Stack

- **Framework**: FastAPI / Uvicorn
- **Data Science**: Scikit-learn, Pandas, Joblib
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

### `POST /oracle/evaluate`

Evaluates policy risk for a given geometry and crop type.

**Request Body:**

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  },
  "crop_type": "corn",
  "date": "2024-02-06"
}
```

**Response:**

```json
{
  "p_severity_farm": 0.85,
  "sample_points": [...],
  "note": "Severity evaluation complete"
}
```

## Model Info

The current model (`model_logreg_2020-2022.joblib`) is trained on historical drought and rainfall data (2020-2022) to predict crop failure probability.
