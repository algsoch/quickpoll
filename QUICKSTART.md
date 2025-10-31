# QuickPoll - Quick Start Guide

## Prerequisites

- Python 3.11 or higher
- PostgreSQL database (or use Docker)
- Git (optional)

## Quick Start (Automated)

### Windows

1. Open PowerShell or Command Prompt
2. Navigate to project directory
3. Run the startup script:

```cmd
start.bat
```

### Linux/macOS

1. Open Terminal
2. Navigate to project directory
3. Make the script executable and run:

```bash
chmod +x start.sh
./start.sh
```

The script will:
- ✅ Check Python installation
- ✅ Create virtual environment
- ✅ Install dependencies
- ✅ Copy .env.sample to .env (if needed)
- ✅ Run database migrations
- ✅ Start the application

## Quick Start (Docker)

If you prefer Docker, it's even simpler:

```bash
# Start all services (backend, database, frontend)
docker-compose up

# Or run in detached mode
docker-compose up -d
```

Access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Manual Setup

If you prefer to set up manually:

### 1. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy sample environment file
cp .env.sample .env

# Edit .env with your database credentials
# For Azure PostgreSQL, update DATABASE_URL
```

### 4. Run Migrations

```bash
# Generate initial migration (first time only)
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head
```

### 5. Start Application

```bash
# Development server with auto-reload
uvicorn backend.main:app --reload

# Or use the startup script
python startup.py && uvicorn backend.main:app --reload
```

## First Steps After Starting

1. **Open API Documentation**: http://localhost:8000/docs
2. **Register a User**: Use the `/api/users/register` endpoint
3. **Login**: Use the `/api/users/login` endpoint to get a JWT token
4. **Create a Poll**: Use the `/api/polls` endpoint with your token
5. **Open Frontend**: Navigate to `frontend/index.html` in a browser

## Testing the Application

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_polls.py

# Run load tests (requires Locust)
pip install locust
locust -f locustfile.py
```

## Common Issues

### Issue: "alembic: command not found"

**Solution**: Make sure your virtual environment is activated and dependencies are installed.

```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install alembic
```

### Issue: "Database connection failed"

**Solution**: Check your DATABASE_URL in `.env` file:

```env
# For local PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost/quickpoll

# For Azure PostgreSQL (example from your .env)
DATABASE_URL=postgresql+asyncpg://quickpoll_admin:your-password@quickpoll-server.postgres.database.azure.com/quickpolldb?sslmode=require
```

### Issue: "Port 8000 already in use"

**Solution**: Either stop the other service or use a different port:

```bash
uvicorn backend.main:app --port 8001 --reload
```

### Issue: "Module not found"

**Solution**: Ensure you're in the project root directory and virtual environment is activated.

## API Quick Reference

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/users/register` | POST | No | Register new user |
| `/api/users/login` | POST | No | Login and get JWT token |
| `/api/users/me` | GET | Yes | Get current user info |
| `/api/polls` | GET | No | List all polls |
| `/api/polls` | POST | Yes | Create a new poll |
| `/api/polls/{id}` | GET | No | Get poll details |
| `/api/polls/{id}/vote` | POST | Yes | Vote on a poll |
| `/api/polls/{id}/like` | POST | Yes | Like/unlike a poll |
| `/api/polls/{id}/results` | GET | No | Get poll results |
| `/ws/polls/{id}/results` | WS | No | Real-time results |
| `/health` | GET | No | Health check |

## Next Steps

- 📖 Read the full [README.md](README.md) for comprehensive documentation
- 📚 Check [API.md](API.md) for detailed API documentation
- 🧪 Review `tests/` directory for test examples
- 🚀 See [azure-deploy.md](azure-deploy.md) for cloud deployment
- 🐳 Use Docker Compose for production-like environment

## Need Help?

- Check the [README.md](README.md) for detailed documentation
- Review the API documentation at http://localhost:8000/docs
- Check the test files in `tests/` for usage examples
- Open an issue on GitHub (if applicable)

---

**Happy Polling! 🎉**
