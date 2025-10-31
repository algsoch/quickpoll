#!/bin/bash
# QuickPoll Setup and Startup Script for Linux/macOS
# This script sets up the development environment and starts the application

echo "============================================================"
echo "QuickPoll - Quick Start Setup"
echo "============================================================"
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    echo "Please install Python 3.11+ from https://www.python.org/"
    exit 1
fi

echo "[1/6] Python detected"
python3 --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo
    echo "[2/6] Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment"
        exit 1
    fi
    echo "[SUCCESS] Virtual environment created"
else
    echo
    echo "[2/6] Virtual environment already exists"
fi

# Activate virtual environment
echo
echo "[3/6] Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo
echo "[4/6] Installing dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi
echo "[SUCCESS] Dependencies installed"

# Check for .env file
if [ ! -f ".env" ]; then
    echo
    echo "[WARNING] .env file not found"
    echo "Copying .env.sample to .env..."
    cp .env.sample .env
    echo
    echo "[ACTION REQUIRED] Please edit .env file with your configuration"
    read -p "Press enter when ready..."
fi

# Run database migrations
echo
echo "[5/6] Running database migrations..."
alembic upgrade head
if [ $? -ne 0 ]; then
    echo "[WARNING] Migration failed, but continuing..."
    echo "Tables will be created automatically on first run"
fi

# Start the application
echo
echo "[6/6] Starting QuickPoll application..."
echo
echo "============================================================"
echo "Application will start in a few seconds..."
echo "API: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"
echo "============================================================"
echo
echo "Press Ctrl+C to stop the server"
echo

python startup.py
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
