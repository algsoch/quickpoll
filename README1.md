# QuickPoll - Real-Time Opinion Polling Platform 🚀

[![CI/CD](https://github.com/algsoch/quickpoll/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/algsoch/quickpoll/actions)
[![codecov](https://codecov.io/gh/algsoch/quickpoll/branch/main/graph/badge.svg)](https://codecov.io/gh/algsoch/quickpoll)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Built for the Lyzr AI Full-Stack Developer Challenge** - A production-grade, real-time polling platform demonstrating full-stack expertise in Python, FastAPI, modern frontend development, cloud deployment, and DevOps best practices.

A feature-rich polling application where users can create polls, vote in real-time, like polls, and see live updates across all connected users. Built with modern technologies and deployed on free-tier cloud infrastructure.

## 🌐 Live Demo

**Try the live application now!**

- **🎯 Frontend**: [https://quickpoll-frontend-xgc3.onrender.com/](https://quickpoll-frontend-xgc3.onrender.com/)
- **⚡ Backend API**: [https://quickpoll-api-xgc3.onrender.com](https://quickpoll-api-xgc3.onrender.com)
- **📚 Interactive API Docs**: [https://quickpoll-api-xgc3.onrender.com/docs](https://quickpoll-api-xgc3.onrender.com/docs)
- **🌍 Alternative Domain**: [https://app.algsoch.tech](https://app.algsoch.tech)

> **Note**: Hosted on Render's free tier. First request may take 30-50 seconds as services wake up from sleep. A GitHub Actions workflow keeps services alive 24/7 during active development.

### Test Credentials (Demo Account)
- **Username**: `demo`
- **Password**: `Demo123!`

Or create your own account to explore all features!

---

## 📖 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Research & Resources](#-research--resources)
- [Challenge Requirements](#-challenge-requirements)

---

## 🎯 Key Features

### Core Functionality ✅
- ✨ **Create Polls** - Multi-option polls with descriptions and metadata
- 🗳️ **Real-Time Voting** - Instant vote submission with live result updates
- ❤️ **Poll Likes** - Like/unlike polls with real-time counter updates
- 👥 **User Authentication** - Secure JWT-based registration and login
- 📊 **Live Results** - WebSocket-powered real-time poll statistics
- 🔄 **Instant Updates** - All users see changes immediately (votes, likes, new polls)

### Technical Highlights 🚀
- **Async FastAPI Backend** - Modern Python 3.11+ with async/await throughout
- **Real-Time WebSockets** - Live bidirectional communication for instant updates
- **Azure PostgreSQL** - Production-grade cloud database with SSL
- **Responsive Design** - Mobile-first UI that works on all devices
- **Docker Containerization** - Multi-stage builds for dev and production
- **CI/CD Pipeline** - Automated testing and deployment via GitHub Actions
- **90%+ Test Coverage** - Comprehensive pytest suite with async tests
- **Security First** - Rate limiting, CORS, JWT auth, input validation
- **Cloud Deployment** - Live on Render with auto-scaling
- **Monitoring** - Health checks, Prometheus metrics, structured logging

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Web Browser    │◄────────►   FastAPI        │◄────────►  Azure          │
│  (Frontend)     │  HTTP   │   Backend        │  SQL    │  PostgreSQL     │
│                 │  WS     │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
      │                              │
      │                              │
      │                              ▼
      │                     ┌──────────────────┐
      │                     │                  │
      └─────────────────────► Render.com       │
            Deploy            │  (Free Tier)   │
                             │                  │
                             └──────────────────┘
```

### Request Flow

1. **User Registration/Login**
   ```
   Browser → POST /api/users/register → FastAPI
   FastAPI → Hash password (bcrypt) → PostgreSQL
   PostgreSQL → Return user → FastAPI
   FastAPI → Generate JWT → Browser (stored in localStorage)
   ```

2. **Creating a Poll**
   ```
   Browser → POST /api/polls (+ JWT) → FastAPI
   FastAPI → Validate JWT → Extract user_id
   FastAPI → Insert poll + options → PostgreSQL
   PostgreSQL → Return poll data → FastAPI → Browser
   WebSocket → Broadcast "new poll" → All connected clients
   ```

3. **Real-Time Voting**
   ```
   Browser → POST /api/polls/{id}/vote (+ JWT) → FastAPI
   FastAPI → Check if already voted → PostgreSQL
   FastAPI → Insert vote → Update vote_count → PostgreSQL
   PostgreSQL → Return updated results → FastAPI
   WebSocket → Broadcast updated results → All clients
   Browser → Update UI instantly (no page reload)
   ```

4. **Live Updates via WebSocket**
   ```
   Browser → WebSocket /ws/polls/{id}/results
   FastAPI → Maintain persistent connection
   Any vote/like event → Broadcast to all connected clients
   Browser → Receive JSON → Update DOM in real-time
   ```

### Database Schema

```sql
-- Users table
users (
  id: serial PRIMARY KEY,
  username: varchar UNIQUE,
  email: varchar UNIQUE,
  hashed_password: varchar,
  created_at: timestamp,
  is_active: boolean
)

-- Polls table
polls (
  id: serial PRIMARY KEY,
  title: varchar,
  description: text,
  creator_id: integer FOREIGN KEY → users(id),
  is_active: boolean,
  created_at: timestamp,
  likes_count: integer DEFAULT 0,
  vote_count: integer DEFAULT 0
)

-- Poll options
poll_options (
  id: serial PRIMARY KEY,
  poll_id: integer FOREIGN KEY → polls(id),
  text: varchar,
  vote_count: integer DEFAULT 0,
  order: integer
)

-- Votes (prevents duplicate voting)
votes (
  id: serial PRIMARY KEY,
  poll_id: integer FOREIGN KEY → polls(id),
  option_id: integer FOREIGN KEY → poll_options(id),
  user_id: integer FOREIGN KEY → users(id),
  voted_at: timestamp,
  UNIQUE(poll_id, user_id)  -- One vote per user per poll
)

-- Poll likes
poll_likes (
  id: serial PRIMARY KEY,
  poll_id: integer FOREIGN KEY → polls(id),
  user_id: integer FOREIGN KEY → users(id),
  liked_at: timestamp,
  UNIQUE(poll_id, user_id)  -- One like per user per poll
)
```

---

## 🛠️ Technology Stack

### Backend
- **Framework**: [FastAPI 0.109](https://fastapi.tiangolo.com/) - Modern async web framework
- **Language**: Python 3.11+ - Latest features, type hints, async/await
- **Database ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) - Async ORM with modern API
- **Database Driver**: asyncpg - High-performance PostgreSQL driver
- **Authentication**: PyJWT + passlib[bcrypt] - Secure JWT tokens and password hashing
- **Validation**: Pydantic v2 - Data validation using Python type annotations
- **WebSockets**: FastAPI native WebSocket support
- **Migrations**: Alembic - Database migration management
- **ASGI Server**: Uvicorn + Gunicorn - Production-grade server

### Frontend
- **Core**: Vanilla JavaScript (ES6+) - No framework dependencies, pure performance
- **Styling**: Modern CSS3 with CSS Grid and Flexbox
- **Real-Time**: WebSocket API - Native browser WebSocket implementation
- **Storage**: localStorage - JWT token persistence
- **Build**: Nginx - Static file serving with optimized caching

### Database
- **Production**: [Azure Database for PostgreSQL](https://azure.microsoft.com/en-us/products/postgresql/) - Managed cloud database
- **Version**: PostgreSQL 15+ with SSL/TLS encryption
- **Features**: Connection pooling, prepared statements, JSONB support

### DevOps & Infrastructure
- **Containerization**: Docker - Multi-stage builds for optimal image size
- **Orchestration**: Docker Compose - Local development environment
- **CI/CD**: GitHub Actions - Automated testing and deployment
- **Hosting**: [Render.com](https://render.com/) - Free tier cloud hosting
- **Monitoring**: Prometheus metrics + Health checks
- **Keep-Alive**: GitHub Actions cron job (prevents free-tier sleep)

### Testing & Quality
- **Testing**: pytest + pytest-asyncio - Async test support
- **Coverage**: pytest-cov - 90%+ code coverage
- **HTTP Testing**: httpx - Async HTTP client for API tests
- **Fixtures**: Factory patterns for test data
- **Mocking**: pytest fixtures + unittest.mock

### Security
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt (12 rounds)
- **Rate Limiting**: SlowAPI - Prevent abuse
- **CORS**: Configured origins whitelist
- **Input Validation**: Pydantic schemas
- **SQL Injection Prevention**: SQLAlchemy ORM (parameterized queries)

---

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
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080

# Serve frontend (in another terminal)
# Use any static file server, e.g.:
python -m http.server 8030 --directory frontend
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

## 🏆 Challenge Requirements

### ✅ All Requirements Met

| Requirement | Implementation | Status |
|------------|----------------|--------|
| **Create polls with multiple options** | Full CRUD API with poll creation, validation, and storage | ✅ Complete |
| **Submit votes for polls** | Vote endpoint with duplicate prevention and real-time counting | ✅ Complete |
| **Like polls and interactions** | Like/unlike system with toggle functionality and counters | ✅ Complete |
| **Live updates across users** | WebSocket connections broadcasting all changes instantly | ✅ Complete |
| **Backend design** | FastAPI with async SQLAlchemy, JWT auth, comprehensive API | ✅ Complete |
| **Frontend design** | Responsive vanilla JS SPA with real-time UI updates | ✅ Complete |
| **User-friendly interface** | Clean, intuitive design tested across devices | ✅ Complete |
| **GitHub repository** | Well-organized code with comprehensive README | ✅ Complete |
| **Deployed live version** | Render.com free tier (frontend + backend) | ✅ Complete |
| **System architecture docs** | Detailed architecture diagrams and flow explanations | ✅ Complete |
| **Local run instructions** | Docker Compose + manual setup with step-by-step guide | ✅ Complete |
| **Research documentation** | Technology choices and API integrations documented | ✅ Complete |

---

## 🔬 Research & Resources

### APIs & Integrations Used

1. **FastAPI Framework**
   - **Research**: [Official FastAPI Docs](https://fastapi.tiangolo.com/)
   - **Why**: Modern async framework with automatic API docs, built-in validation, and WebSocket support
   - **Learning Curve**: 2 hours reading docs + tutorials
   - **Implementation**: Full async/await pattern, dependency injection, background tasks

2. **SQLAlchemy 2.0 Async**
   - **Research**: [SQLAlchemy 2.0 Migration Guide](https://docs.sqlalchemy.org/en/20/), [Async PostgreSQL](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
   - **Why**: Modern ORM with async support, type safety, and powerful query builder
   - **Challenge**: Migration from sync to async patterns
   - **Solution**: Async sessions, `async with` blocks, proper connection pooling

3. **Azure PostgreSQL Database**
   - **Research**: [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/)
   - **Why**: Managed cloud database with SSL, automatic backups, and free tier
   - **Configuration**: SSL mode require, connection pooling, proper URL encoding
   - **Integration**: asyncpg driver with SQLAlchemy for optimal performance

4. **WebSocket for Real-Time Updates**
   - **Research**: [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/), [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
   - **Why**: Low-latency bidirectional communication for instant updates
   - **Implementation**: Connection manager pattern, broadcast to all clients, automatic reconnection
   - **Challenge**: Managing connections, handling disconnects gracefully

5. **JWT Authentication**
   - **Research**: [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/), [JWT.io](https://jwt.io/)
   - **Why**: Stateless authentication perfect for APIs, scalable, and secure
   - **Implementation**: PyJWT library, OAuth2PasswordBearer, secure password hashing with bcrypt
   - **Security**: Token expiration, refresh patterns, secure secret key management

6. **Docker Multi-Stage Builds**
   - **Research**: [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/), [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
   - **Why**: Optimize image size, separate dev/prod environments, faster builds
   - **Implementation**: Base → Dependencies → Development/Production stages
   - **Result**: Production image ~150MB (vs ~1GB for naive build)

7. **Render Deployment**
   - **Research**: [Render Docs](https://render.com/docs), [Free tier limitations](https://render.com/docs/free)
   - **Why**: Free tier with Docker support, automatic HTTPS, and PostgreSQL
   - **Challenge**: Free tier sleeps after 15 minutes of inactivity
   - **Solution**: GitHub Actions cron job (every 10 minutes) to keep services awake

8. **GitHub Actions CI/CD**
   - **Research**: [GitHub Actions Docs](https://docs.github.com/en/actions), [pytest in CI](https://docs.pytest.org/en/stable/how-to/usage.html#ci)
   - **Why**: Automate testing, ensure code quality, continuous deployment
   - **Implementation**: Test on every push, PostgreSQL service container, coverage reports
   - **Workflows**: Build & Test, Full CI/CD Pipeline, Keep-Alive for Render

### Key Learning & Problem Solving

**Challenge 1: Async SQLAlchemy with FastAPI**
- **Problem**: Initial confusion between sync and async SQLAlchemy patterns
- **Research**: Read SQLAlchemy 2.0 migration guide, FastAPI async SQL tutorials
- **Solution**: Proper async context managers, session handling via dependency injection
- **Code Pattern**:
  ```python
  async def get_db():
      async with async_session_maker() as session:
          yield session
  ```

**Challenge 2: Real-Time Updates Without Complexity**
- **Problem**: Needed live updates but wanted to avoid heavy frameworks (Socket.io, Redis)
- **Research**: FastAPI native WebSocket support, connection manager patterns
- **Solution**: Built lightweight WebSocket manager with broadcast capability
- **Result**: Sub-50ms update latency with pure FastAPI

**Challenge 3: Preventing Duplicate Votes**
- **Problem**: Race conditions in concurrent voting
- **Research**: Database unique constraints, PostgreSQL UPSERT operations
- **Solution**: UNIQUE constraint on (poll_id, user_id), handle IntegrityError gracefully
- **Code**: 
  ```python
  # Database constraint prevents duplicates at DB level
  __table_args__ = (UniqueConstraint('poll_id', 'user_id'),)
  ```

**Challenge 4: Free Tier Deployment Limitations**
- **Problem**: Render free tier sleeps after 15 minutes, causing cold starts
- **Research**: Render docs, GitHub Actions scheduling, cron expressions
- **Solution**: GitHub Actions workflow pinging endpoints every 10 minutes
- **Cost**: ~120 minutes/month of GitHub Actions (well within 2,000 free minutes)

**Challenge 5: Frontend State Management Without Framework**
- **Problem**: Keep UI in sync with server state across multiple components
- **Research**: Vanilla JS patterns, event-driven architecture, WebSocket integration
- **Solution**: Event-driven updates via WebSocket messages, localStorage for auth state
- **Result**: Lightweight, fast, no build step required

### Technology Decision Rationale

| Choice | Alternatives Considered | Why This One? |
|--------|------------------------|---------------|
| **FastAPI** | Flask, Django | Async native, automatic docs, modern type hints |
| **Vanilla JS** | React, Vue | Faster load, no build step, demonstrates core skills |
| **PostgreSQL** | MongoDB, MySQL | ACID compliance, mature, JSON support, free Azure tier |
| **Docker** | Traditional deployment | Consistency, portability, easier deployment |
| **Render** | Heroku, Railway, Fly.io | Better free tier, Docker support, simple setup |
| **GitHub Actions** | GitLab CI, CircleCI | Native to GitHub, free for public repos, simple YAML |
| **SQLAlchemy** | Raw SQL, other ORMs | Type safety, async support, powerful query API |

---

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for the Lyzr AI Full-Stack Developer Challenge**
