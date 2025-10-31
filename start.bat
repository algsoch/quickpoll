@echo off
REM QuickPoll Setup and Startup Script for Windows
REM This script sets up the development environment and starts the application

echo ============================================================
echo QuickPoll - Quick Start Setup
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/
    exit /b 1
)

echo [1/6] Python detected
python --version

REM Create virtual environment if it doesn't exist
if not exist "venv\" (
    echo.
    echo [2/6] Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        exit /b 1
    )
    echo [SUCCESS] Virtual environment created
) else (
    echo.
    echo [2/6] Virtual environment already exists
)

REM Activate virtual environment
echo.
echo [3/6] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo [4/6] Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [SUCCESS] Dependencies installed

REM Check for .env file
if not exist ".env" (
    echo.
    echo [WARNING] .env file not found
    echo Copying .env.sample to .env...
    copy .env.sample .env
    echo.
    echo [ACTION REQUIRED] Please edit .env file with your configuration
    echo Press any key when ready...
    pause >nul
)

REM Run database migrations
echo.
echo [5/6] Running database migrations...
alembic upgrade head
if %errorlevel% neq 0 (
    echo [WARNING] Migration failed, but continuing...
    echo Tables will be created automatically on first run
)

REM Start the application
echo.
echo [6/6] Starting QuickPoll application...
echo.
echo ============================================================
echo Application will start in a few seconds...
echo API: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo ============================================================
echo.
echo Press Ctrl+C to stop the server
echo.

python startup.py
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
