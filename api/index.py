import sys
import os
from pathlib import Path

# Add the project root to PYTHONPATH so we can import 'backend'
root_path = Path(__file__).resolve().parent.parent
sys.path.append(str(root_path))

from backend.main import app
