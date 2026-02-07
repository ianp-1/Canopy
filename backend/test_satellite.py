#!/usr/bin/env python3
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Print current working directory
print(f"CWD: {os.getcwd()}")

# Add backend to sys.path
backend_path = Path(__file__).parent.resolve()
sys.path.append(str(backend_path))
print(f"Added to sys.path: {backend_path}")

# Load environment variables
env_path = backend_path.parent / ".env"
print(f"Loading .env from: {env_path}")
load_dotenv(env_path)

# Verify credentials file exists
cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
print(f"Credentials path: {cred_path}")

if cred_path:
    abs_cred_path = (backend_path.parent / cred_path).resolve()
    print(f"Absolute credentials path: {abs_cred_path}")
    if abs_cred_path.exists():
        print("✅ Credentials file found")
        # Ensure the env var is absolute path for GEE
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(abs_cred_path)
    else:
        print("❌ Credentials file NOT found at absolute path")
else:
    print("❌ GOOGLE_APPLICATION_CREDENTIALS not set in .env")

try:
    import ee
    print("✅ earthengine-api imported successfully")
except ImportError as e:
    print(f"❌ Failed to import earthengine-api: {e}")
    sys.exit(1)

try:
    from agent.tools import satellite_tool
    
    # Test Coordinates (Iowa Cornfield)
    lat = 41.999364
    lon = -93.002391
    
    print("\n📡 Testing NDVI Fetch...")
    result_ndvi = satellite_tool.invoke({"latitude": lat, "longitude": lon, "analysis_type": "ndvi"})
    print(result_ndvi)
    
    print("\n📡 Testing Land Verification...")
    result_land = satellite_tool.invoke({"latitude": lat, "longitude": lon, "analysis_type": "land_cover"})
    print(result_land)

except Exception as e:
    print(f"\n❌ Test Failed: {e}")
