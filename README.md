# QuickPoll - Production-Grade Real-Time Polling Application

[![CI/CD](https://github.com/algsoch/quickpoll/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/algsoch/quickpoll/actions)
[![codecov](https://codecov.io/gh/algsoch/quickpoll/branch/main/graph/badge.svg)](https://codecov.io/gh/algsoch/quickpoll)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, production-ready polling application built for the **Lyzr AI Full-Stack Developer Challenge**. Features real-time WebSocket updates, JWT authentication, Azure PostgreSQL integration, and comprehensive CI/CD pipeline.

## 🌐 Live Demo

- **Frontend**: [https://quickpoll-frontend-xgc3.onrender.com/](https://quickpoll-frontend-xgc3.onrender.com/)
- **Backend API**: [https://quickpoll-api-xgc3.onrender.com](https://quickpoll-api-xgc3.onrender.com)
- **API Docs**: [https://quickpoll-api-xgc3.onrender.com/docs](https://quickpoll-api-xgc3.onrender.com/docs)
- **Alternative Domain**: [https://app.algsoch.tech](https://app.algsoch.tech) (via Cloudflare Tunnel)

> **Note**: Free tier services may take 30-50 seconds to wake up from sleep on first request.

## 🎯 Key Features

- **FastAPI Backend** - Fully async, modern Python 3.11+ with SQLAlchemy 2.0
- **Real-Time Updates** - WebSocket support for live poll results
- **JWT Authentication** - Secure user authentication and authorization
- **Azure PostgreSQL** - Production database with SSL support
- **Responsive Frontend** - Clean, mobile-first design with vanilla JavaScript
- **Docker Support** - Multi-stage builds for dev and production
- **Comprehensive Testing** - 90%+ test coverage with pytest
- **CI/CD Pipeline** - GitHub Actions with automated deployment
- **Cloud Ready** - Deploy to Azure App Service or Render
- **Security First** - Rate limiting, CORS, input validation, security headers
- **Monitoring** - Prometheus metrics and health checks

## 📁 Project Structure

```
quickpoll/
├── backend/                # FastAPI backend
│   ├── __init__.py
│   ├── main.py            # Application entry point
│   ├── config.py          # Pydantic settings
│   ├── database.py        # Async SQLAlchemy setup
│   ├── models.py          # Database models
│   ├── schemas.py         # Pydantic schemas
│   ├── auth.py            # JWT authentication
│   └── routers/           # API endpoints
│       ├── users.py       # User auth endpoints
│       ├── polls.py       # Poll CRUD endpoints
│       └── websocket.py   # WebSocket endpoints
├── frontend/              # Static frontend
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/                 # Comprehensive test suite
│   ├── conftest.py
│   ├── test_users.py
│   ├── test_polls.py
│   ├── test_models.py
│   └── test_main.py
├── alembic/              # Database migrations
├── .github/
│   └── workflows/
│       └── ci-cd.yml     # CI/CD pipeline
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # Local development setup
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Project config & tools
├── .env.sample           # Environment template
└── README.md            # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose (optional)
- PostgreSQL 15+ (or use Azure PostgreSQL)
- Git

### Local Development

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/quickpoll.git
cd quickpoll
```

2. **Create and configure .env file**

```bash
cp .env.sample .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
SECRET_KEY=your-super-secret-key-minimum-32-characters-long
ADMIN_PASSWORD=your-secure-admin-password
```

3. **Option A: Run with Docker (Recommended)**

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application:
- Frontend: http://localhost:8000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

4. **Option B: Run locally without Docker**

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Serve frontend (in another terminal)
# Use any static file server, e.g.:
python -m http.server 8000 --directory frontend
```

## 📝 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/users/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Login
```http
POST /api/users/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "SecurePass123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /api/users/me
Authorization: Bearer <token>
```

### Poll Endpoints

#### Create Poll
```http
POST /api/polls
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "What's your favorite programming language?",
  "description": "Choose wisely!",
  "options": [
    {"text": "Python", "order": 0},
    {"text": "JavaScript", "order": 1},
    {"text": "Go", "order": 2}
  ]
}
```

#### List Polls
```http
GET /api/polls?skip=0&limit=50&active_only=true
```

#### Get Poll Details
```http
GET /api/polls/{poll_id}
Authorization: Bearer <token>  # Optional
```

#### Vote on Poll
```http
POST /api/polls/{poll_id}/vote
Authorization: Bearer <token>
Content-Type: application/json

{
  "option_id": 1
}
```

#### Like/Unlike Poll
```http
POST /api/polls/{poll_id}/like
Authorization: Bearer <token>
```

#### Get Poll Results
```http
GET /api/polls/{poll_id}/results
```

#### WebSocket - Live Poll Results
```javascript
const ws = new WebSocket('wss://quickpoll-api-xgc3.onrender.com/ws/polls/{poll_id}/results');
// For local development: ws://localhost:8080/ws/polls/{poll_id}/results
ws.onmessage = (event) => {
  const results = JSON.parse(event.data);
  console.log(results);
};
```

### Health & Monitoring

```http
GET /health              # Health check
GET /metrics             # Prometheus metrics
GET /admin/stats         # Admin statistics (Basic Auth)
```

Full interactive API documentation available at `/docs` when running the application.

## 🧪 Testing

```bash
# Run all tests with coverage
pytest --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_polls.py -v

# Run with coverage report
pytest --cov=backend --cov-report=term-missing

# View HTML coverage report
open htmlcov/index.html
```

Test coverage goals: **>90%**

## � Deployment

### Pre-Deployment Checklist

Run the deployment preparation script:

```bash
# On Linux/Mac
bash deploy-prep.sh

# On Windows
.\deploy-prep.ps1
```

This will check:
- ✅ Environment variables are configured
- ✅ No sensitive data in code
- ✅ Database migrations are up to date
- ✅ Docker is installed
- ✅ Git repository is clean

### Quick Deployment

**For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

#### Docker
```bash
docker-compose up --build
```

#### Render
1. Push to GitHub
2. Connect repository in Render dashboard
3. Set environment variables
4. Deploy automatically

#### Azure
```bash
az acr build --registry yourregistry --image quickpoll:latest .
az webapp create --name yourapp --deployment-container-image-name yourregistry.azurecr.io/quickpoll:latest
```

### Tag Sharing Feature ✨

**Version 64** includes interactive tag input with visual chips:
- ✅ Add tags with Enter/comma/space
- ✅ Visual chip display with remove buttons
- ✅ Tags persist in database as JSON
- ✅ Share URLs include tags
- ✅ Works on all deployment platforms (Docker/Azure/Render)

**Test tag sharing:**
1. Create poll with tags using visual input
2. Share poll URL (includes tags in query params)
3. Tags display as chips in shared view
4. Search by tags works across all platforms

## �🐳 Docker Deployment

### Build Production Image

```bash
# Build production image
docker build -t quickpoll:latest --target production .

# Run production container
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  --name quickpoll \
  quickpoll:latest
```

### Multi-Stage Build Targets

- `base` - Base Python image with system dependencies
- `dependencies` - Python packages installed
- `development` - Development mode with hot reload
- `production` - Optimized production build with Gunicorn

## ☁️ Cloud Deployment

### Azure App Service

1. **Create Azure Resources**

```bash
# Login to Azure
az login

# Create resource group
az group create --name quickpoll-rg --location eastus

# Create Azure Container Registry
az acr create --resource-group quickpoll-rg --name quickpollacr --sku Basic

# Build and push image
az acr build --registry quickpollacr --image quickpoll:latest .

# Create App Service Plan
az appservice plan create \
  --name quickpoll-plan \
  --resource-group quickpoll-rg \
  --is-linux --sku B1

# Create Web App
az webapp create \
  --resource-group quickpoll-rg \
  --plan quickpoll-plan \
  --name quickpoll-api \
  --deployment-container-image-name quickpollacr.azurecr.io/quickpoll:latest
```

2. **Configure Environment Variables**

```bash
az webapp config appsettings set \
  --name quickpoll-api \
  --resource-group quickpoll-rg \
  --settings \
    DATABASE_URL="your-azure-postgres-url" \
    SECRET_KEY="your-secret-key" \
    ENVIRONMENT="production" \
    ALLOWED_ORIGINS="https://yourfrontend.azurestaticapps.net"
```

3. **Deploy Frontend to Azure Static Web Apps**

See `staticwebapp.config.json` for configuration.

### Render (Currently Deployed ✅)

**Live URLs:**
- Frontend: https://quickpoll-frontend-xgc3.onrender.com/
- Backend API: https://quickpoll-api-xgc3.onrender.com
- API Docs: https://quickpoll-api-xgc3.onrender.com/docs

#### Quick Deployment Steps

1. **Backend Deployment**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - New + → Web Service
   - Connect GitHub repository: `algsoch/quickpoll`
   - Configure:
     - Name: `quickpoll-api-xgc3`
     - Runtime: Docker
     - Dockerfile Path: `./Dockerfile.backend`
     - Branch: `main`
   - Add Environment Variables:
     ```
     DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db?ssl=require
     SECRET_KEY=your-secret-key-32-chars-minimum
     GEMINI_API_KEY=your-gemini-api-key
     ADMIN_USERNAME=admin
     ADMIN_PASSWORD=your-admin-password
     ENVIRONMENT=production
     ALLOWED_ORIGINS=https://quickpoll-frontend-xgc3.onrender.com,http://localhost:8000,https://app.algsoch.tech
     ```
   - Click **Create Web Service**

2. **Frontend Deployment**
   - New + → Web Service
   - Same repository: `algsoch/quickpoll`
   - Configure:
     - Name: `quickpoll-frontend-xgc3`
     - Runtime: Docker
     - Dockerfile Path: `./Dockerfile.frontend`
     - Branch: `main`
   - Click **Create Web Service**

3. **Verify Deployment**
   - Backend health check: https://quickpoll-api-xgc3.onrender.com/health
   - Frontend: https://quickpoll-frontend-xgc3.onrender.com/
   - Test signup, login, create poll, vote

#### Blueprint Deployment (Alternative)

Use `render.yaml` for one-click deployment:
- Render Dashboard → New + → Blueprint
- Select repository and branch
- Enter required secrets when prompted
- Both services deploy automatically

## 🔒 Security Best Practices

### Implemented Security Features

✅ **Authentication & Authorization**
- JWT token-based authentication
- Secure password hashing with bcrypt
- Token expiration and validation

✅ **Input Validation**
- Pydantic schemas for all requests
- SQL injection prevention via ORM
- XSS protection through proper escaping

✅ **Rate Limiting**
- SlowAPI integration
- Configurable per-endpoint limits
- Protection against brute force attacks

✅ **CORS Configuration**
- Configurable allowed origins
- Credentials support
- Proper headers handling

✅ **Database Security**
- SSL/TLS for PostgreSQL connections
- Connection pooling
- Prepared statements

✅ **Security Headers**
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block

✅ **Production Hardening**
- Non-root Docker user
- Minimal base images
- Environment variable validation
- Secret management

### Environment Variables

**Never commit sensitive data to Git!**

Required environment variables (see `.env.sample`):
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT signing key (min 32 chars)
- `ADMIN_PASSWORD` - Admin endpoint password

## 📊 Monitoring & Observability

### Health Checks

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "database": "healthy",
  "timestamp": "2025-10-27T12:00:00"
}
```

### Prometheus Metrics

Access metrics at `/metrics`:

```
http_requests_total{method="GET",endpoint="/api/polls",status="200"} 42
http_request_duration_seconds{method="GET",endpoint="/api/polls"} 0.025
```

### Application Logs

```bash
# Docker logs
docker-compose logs -f backend

# Azure logs
az webapp log tail --name quickpoll-api --resource-group quickpoll-rg
```

## 🛠️ Development

### Code Quality Tools

```bash
# Format code with Black
black backend/ tests/

# Lint with Flake8
flake8 backend/ tests/ --max-line-length=100

# Type checking with MyPy
mypy backend/

# Security scan with Bandit
bandit -r backend/
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 Challenge Completion Checklist

- [x] FastAPI backend with async SQLAlchemy v2
- [x] Azure PostgreSQL integration with .env secrets
- [x] JWT authentication
- [x] Complete REST API (users, polls, votes, likes)
- [x] WebSocket for real-time poll results
- [x] Production-ready responsive frontend
- [x] Multi-stage Dockerfile
- [x] Docker Compose for full stack
- [x] Comprehensive test suite (>90% coverage)
- [x] CI/CD with GitHub Actions
- [x] Azure deployment configuration
- [x] Render deployment configuration
- [x] Rate limiting & security features
- [x] Health checks & monitoring
- [x] Complete documentation

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for the Lyzr AI Full-Stack Developer Challenge**
