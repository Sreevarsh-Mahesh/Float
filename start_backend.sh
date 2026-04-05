#!/bin/bash

# Navigate to the backend directory
cd "$(dirname "$0")/backend" || exit 1

# Activate the virtual environment setup earlier
source venv/bin/activate

# Start the FastAPI server using uvicorn
echo "Starting FastAPI backend on http://localhost:8000 ..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
