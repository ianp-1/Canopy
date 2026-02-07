#!/bin/bash
# test_agent.sh - Verify AI Agent Endpoints

# Resolve the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# If script is in backend/, parent is root. If in root, it is root.
if [[ "$SCRIPT_DIR" == *"backend"* ]]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi

cd "$PROJECT_ROOT"
echo "📂 Working from: $(pwd)"

# Activate Virtual Environment (if available)
if [ -f "backend/.venv/bin/activate" ]; then
    echo "🔌 Activating backend/.venv..."
    source backend/.venv/bin/activate
elif [ -f ".venv/bin/activate" ]; then
    echo "🔌 Activating .venv..."
    source .venv/bin/activate
fi

# Environment Setup for Testing
# export GOOGLE_APPLICATION_CREDENTIALS="backend/credentials/earth-engine-sa.json"
# export EE_PROJECT_ID="xrp-farmer-420"
# export LLM_PROVIDER="gemini"
# export GOOGLE_API_KEY="AIzaSyApKbd-DKv2RwBj6JG5syqs9UyBsrACZt4"
# export GEMINI_MODEL="gemini-pro"

# Clean up previous background process on exit
trap "kill \$PID 2> /dev/null" EXIT

echo "🚀 Starting AI Agent Server..."
# Run as a module (backend.main) so relative imports works
python3 -m uvicorn backend.main:app --port 8001 > agent_server.log 2>&1 &
PID=$!
sleep 5

if ! ps -p $PID > /dev/null; then
    echo "❌ Server failed to start. Logs:"
    cat agent_server.log
    exit 1
fi

echo "✅ Server running (PID $PID)"

# 1. Test Quote Endpoint
echo -e "\n📡 Testing /agent/quote..."
QUOTE_PAYLOAD='{
  "latitude": 41.999364,
  "longitude": -93.002391,
  "farm_size_hectares": 50,
  "crop_type": "corn",
  "coverage_xrp": 1000
}'

RESPONSE=$(curl -s -X POST http://localhost:8001/agent/quote \
  -H "Content-Type: application/json" \
  -d "$QUOTE_PAYLOAD")

# Pretty print response
echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"

# 2. Test Monitor Endpoint (Status: Safe expected in winter)
echo -e "\n\n👀 Testing /agent/monitor..."
MONITOR_PAYLOAD='{
  "policy_id": "test_monitor_policy",
  "latitude": 41.999364,
  "longitude": -93.002391,
  "crop_type": "corn",
  "coverage_xrp": 1000
}'

RESPONSE=$(curl -s -X POST http://localhost:8001/agent/monitor \
  -H "Content-Type: application/json" \
  -d "$MONITOR_PAYLOAD")

echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"

# 3. Test Deadline Enforcement: Spring Wheat (EXPECTED: Pending/Approved)
echo -e "\n\n🌾 Testing /agent/quote (Spring Wheat - Expected: OPEN)..."
SPRING_WHEAT_PAYLOAD='{
  "latitude": 41.999364,
  "longitude": -93.002391,
  "farm_size_hectares": 50,
  "crop_type": "spring_wheat",
  "coverage_xrp": 1000
}'

RESPONSE=$(curl -s -X POST http://localhost:8001/agent/quote \
  -H "Content-Type: application/json" \
  -d "$SPRING_WHEAT_PAYLOAD")

echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"

# 4. Test Deadline Enforcement: Winter Wheat (EXPECTED: Rejected - Deadline Passed)
echo -e "\n\n❄️ Testing /agent/quote (Winter Wheat - Expected: REJECTED)..."
WINTER_WHEAT_PAYLOAD='{
  "latitude": 41.999364,
  "longitude": -93.002391,
  "farm_size_hectares": 50,
  "crop_type": "winter_wheat",
  "coverage_xrp": 1000
}'

RESPONSE=$(curl -s -X POST http://localhost:8001/agent/quote \
  -H "Content-Type: application/json" \
  -d "$WINTER_WHEAT_PAYLOAD")

echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"

echo -e "\n\n✅ Tests completed."
