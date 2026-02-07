# Backend Setup

Run these commands from the `backend/` directory.

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
uvicorn main:app --reload
```
