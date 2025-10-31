# QuickPoll - Project File Index

> Complete file reference for the QuickPoll polling application

## 📁 Project Structure Overview

```
quickpoll/
├── 📄 Configuration Files (9)
├── 📁 backend/ (10 files)
├── 📁 frontend/ (3 files)
├── 📁 tests/ (5 files)
├── 📁 alembic/ (migrations)
├── 📁 .github/workflows/ (CI/CD)
├── 📄 Documentation (7 files)
└── 📄 Scripts (4 files)
```

## 🔧 Root Configuration Files

### Essential Configuration
| File | Purpose | Key Contents |
|------|---------|--------------|
| `.env.sample` | Environment template | DATABASE_URL, SECRET_KEY, CORS settings |
| `.gitignore` | Git ignore rules | Python cache, env files, IDE files |
| `requirements.txt` | Python dependencies | 25+ production packages |
| `pyproject.toml` | Project config | Black, pytest, mypy, coverage settings |
| `alembic.ini` | Migration config | Database migration settings |

### Docker Configuration
| File | Purpose | Key Contents |
|------|---------|--------------|
| `Dockerfile` | Multi-stage build | 4 stages: base, deps, dev, prod |
| `docker-compose.yml` | Full stack setup | Backend, PostgreSQL, Frontend |
| `.dockerignore` | Docker ignore rules | Optimization for builds |
| `nginx.conf` | Frontend server | Static file serving config |

### Deployment Configuration
| File | Purpose | Platform |
|------|---------|----------|
| `render.yaml` | Blueprint config | Render.com |
| `staticwebapp.config.json` | SWA routing | Azure Static Web Apps |
| `azure-deploy.md` | Deployment guide | Azure App Service |

## 📂 Backend Directory (`backend/`)

### Core Application
| File | Lines | Purpose | Key Classes/Functions |
|------|-------|---------|----------------------|
| `main.py` | ~150 | FastAPI app entry | `app`, `lifespan()`, middleware |
| `config.py` | ~60 | Configuration | `Settings` class |
| `database.py` | ~80 | DB connection | `get_db()`, `init_db()` |
| `models.py` | ~120 | ORM models | `User`, `Poll`, `PollOption`, `Vote`, `Like` |
| `schemas.py` | ~250 | Pydantic schemas | 20+ schema classes |
| `auth.py` | ~100 | JWT auth | `create_access_token()`, `get_current_user()` |

### API Routers (`backend/routers/`)
| File | Lines | Endpoints | Key Features |
|------|-------|-----------|--------------|
| `users.py` | ~120 | 4 endpoints | Registration, login, profile |
| `polls.py` | ~350 | 10 endpoints | CRUD, voting, likes, results |
| `websocket.py` | ~80 | 1 WS endpoint | Real-time poll updates |

### File Details

#### `backend/main.py`
- **Purpose**: FastAPI application initialization
- **Key Components**:
  - Lifespan events for startup/shutdown
  - CORS middleware
  - Rate limiting
  - Prometheus metrics
  - Error handlers
- **Routes**: `/health`, `/metrics`, `/admin/stats`, `/docs`, `/redoc`

#### `backend/config.py`
- **Purpose**: Centralized configuration management
- **Key Features**:
  - Pydantic Settings with validation
  - Environment variable loading
  - Secret validation (min 32 chars)
  - CORS origins parsing
  - Production mode detection

#### `backend/database.py`
- **Purpose**: Database connection and session management
- **Key Components**:
  - Async SQLAlchemy engine
  - Session factory with expire_on_commit=False
  - Dependency injection for FastAPI
  - Health check function
  - Table initialization

#### `backend/models.py`
- **Purpose**: SQLAlchemy ORM models
- **Models**:
  1. `User` - Authentication and ownership
  2. `Poll` - Poll metadata and relationships
  3. `PollOption` - Available choices
  4. `Vote` - User votes (unique per poll/user)
  5. `Like` - Poll likes (unique per poll/user)
- **Relationships**: Complete foreign key coverage with cascade deletes

#### `backend/schemas.py`
- **Purpose**: Request/response validation
- **Schema Categories**:
  - User schemas (5): Create, Response, Login, Token, Profile
  - Poll schemas (8): Create, Update, Response, List, Enriched
  - Vote schemas (3): Create, Response, Results
  - Option schemas (2): Create, Response
- **Validators**: Password strength, unique options, email format

#### `backend/auth.py`
- **Purpose**: Authentication and authorization
- **Functions**:
  - `get_password_hash()` - Bcrypt hashing
  - `verify_password()` - Password verification
  - `create_access_token()` - JWT generation
  - `get_current_user()` - Token validation
  - `get_current_admin_user()` - Admin check

#### `backend/routers/users.py`
- **Endpoints**:
  - `POST /api/users/register` - New user registration
  - `POST /api/users/login` - JWT token generation
  - `GET /api/users/me` - Current user profile
  - `GET /api/users` - List all users (admin only)

#### `backend/routers/polls.py`
- **Endpoints**:
  - `POST /api/polls` - Create poll with options
  - `GET /api/polls` - List polls (paginated, filtered)
  - `GET /api/polls/{id}` - Get poll details
  - `PUT /api/polls/{id}` - Update poll (owner only)
  - `DELETE /api/polls/{id}` - Delete poll (owner only)
  - `POST /api/polls/{id}/vote` - Vote on poll
  - `POST /api/polls/{id}/like` - Like/unlike poll
  - `GET /api/polls/{id}/results` - Get poll results
  - Helper: `enrich_poll_response()` - Add vote counts

#### `backend/routers/websocket.py`
- **Purpose**: Real-time poll updates
- **Features**:
  - `ConnectionManager` class for tracking connections
  - Per-poll connection pools
  - Auto-update every 5 seconds
  - Graceful disconnect handling

## 🎨 Frontend Directory (`frontend/`)

| File | Lines | Purpose | Key Features |
|------|-------|---------|--------------|
| `index.html` | ~300 | App structure | Modals, poll list, detail view |
| `styles.css` | ~500 | Styling | Responsive, mobile-first, gradients |
| `app.js` | ~600 | Application logic | API integration, WebSocket, Chart.js |

### File Details

#### `frontend/index.html`
- **Sections**:
  - Header with auth buttons
  - Polls list grid
  - Poll detail view with voting
  - 3 modals: Login, Register, Create Poll
  - Chart.js canvas for visualizations
- **Features**: Semantic HTML5, accessibility attributes

#### `frontend/styles.css`
- **Styles**:
  - CSS custom properties (variables)
  - Responsive grid layout
  - Modal system with overlay
  - Button states and animations
  - Chart container styling
  - Mobile breakpoints (@media queries)
- **Design**: Modern gradient backgrounds, card-based UI

#### `frontend/app.js`
- **Modules**:
  - API client with fetch wrappers
  - Token management (localStorage)
  - Modal controllers
  - Form handlers (login, register, create poll)
  - Poll rendering and voting
  - WebSocket connection manager
  - Chart.js integration
- **Features**: Error handling, loading states, real-time updates

## 🧪 Tests Directory (`tests/`)

| File | Lines | Tests | Coverage |
|------|-------|-------|----------|
| `conftest.py` | ~100 | - | Fixtures |
| `test_users.py` | ~120 | 6 | User auth |
| `test_polls.py` | ~250 | 10 | Poll CRUD |
| `test_models.py` | ~150 | 6 | ORM models |
| `test_main.py` | ~80 | 4 | App health |

### Fixtures (conftest.py)
- `event_loop` - Async test event loop
- `db_session` - Test database session (SQLite in-memory)
- `client` - Test FastAPI client
- `test_user` - Sample user for tests
- `auth_token` - JWT token for authenticated tests
- `auth_headers` - Authorization headers

### Test Coverage
- **Total Tests**: 26
- **Target Coverage**: >90%
- **Areas Covered**:
  - User registration and authentication
  - Poll CRUD operations
  - Voting system (including duplicate prevention)
  - Like functionality
  - Model relationships
  - Health checks
  - API documentation endpoints

## 📚 Documentation Files

| File | Purpose | Audience | Length |
|------|---------|----------|--------|
| `README.md` | Main documentation | All | ~500 lines |
| `API.md` | API reference | Developers | ~300 lines |
| `QUICKSTART.md` | Quick setup guide | New users | ~200 lines |
| `PROJECT_SUMMARY.md` | Challenge summary | Evaluators | ~400 lines |
| `TESTING_CHECKLIST.md` | Testing guide | QA/Developers | ~350 lines |
| `azure-deploy.md` | Azure deployment | DevOps | ~100 lines |
| `FILE_INDEX.md` | This file | All | ~300 lines |

### Documentation Overview

#### README.md
Comprehensive project documentation including:
- Features and tech stack
- Project structure
- Quick start (Docker and local)
- Complete API documentation
- Testing instructions
- Deployment guides (Azure and Render)
- Security best practices
- Development workflow

#### API.md
Detailed API reference:
- All endpoints with examples
- Request/response schemas
- Authentication flow
- WebSocket protocol
- Error codes
- Rate limiting

#### QUICKSTART.md
Fast-track setup guide:
- Automated startup scripts
- Docker quick start
- Manual setup steps
- First steps after installation
- Common troubleshooting
- API quick reference

#### PROJECT_SUMMARY.md
Challenge completion documentation:
- Requirements checklist
- Features implemented
- Technical highlights
- Code metrics
- Learning outcomes
- Production readiness assessment

#### TESTING_CHECKLIST.md
Complete testing guide:
- Pre-testing setup
- Unit test instructions
- Integration test scenarios
- Frontend testing
- Load testing with Locust
- Security testing
- Docker testing
- Deployment verification

## 🚀 Scripts and Utilities

| File | Platform | Purpose |
|------|----------|---------|
| `startup.py` | All | Pre-flight checks and startup |
| `start.bat` | Windows | Automated setup and start |
| `start.sh` | Linux/macOS | Automated setup and start |
| `locustfile.py` | All | Load testing scenarios |

### Script Details

#### startup.py
- Checks database connectivity
- Runs Alembic migrations
- Displays startup information
- Shows access URLs

#### start.bat / start.sh
- Checks Python installation
- Creates virtual environment
- Installs dependencies
- Copies .env.sample if needed
- Runs migrations
- Starts application

#### locustfile.py
- Simulates user behavior
- Load testing scenarios:
  - List polls (weight: 3)
  - View poll (weight: 2)
  - Create poll (weight: 1)
  - Vote on poll (weight: 2)
  - Like poll (weight: 1)
  - Get results (weight: 1)

## 🔐 Security Files

| File | Purpose |
|------|---------|
| `.env.sample` | Template for secrets (not committed) |
| `.gitignore` | Prevents committing sensitive files |
| `.dockerignore` | Excludes secrets from Docker builds |

## 📦 Database Migrations (`alembic/`)

| File | Purpose |
|------|---------|
| `env.py` | Async migration environment |
| `script.py.mako` | Migration template |
| `versions/` | Migration files directory |

## 🔄 CI/CD (``.github/workflows/`)

| File | Purpose | Jobs |
|------|---------|------|
| `ci-cd.yml` | Complete pipeline | Lint, Test, Build, Deploy |

### Pipeline Stages
1. **Lint**: Black, Flake8, Bandit
2. **Test**: Pytest with coverage
3. **Build**: Docker image
4. **Deploy-Azure**: Azure App Service
5. **Deploy-Render**: Render platform

## 📊 File Statistics

### Total Files by Category
- **Configuration**: 9 files
- **Backend Code**: 10 files
- **Frontend Code**: 3 files
- **Tests**: 5 files
- **Documentation**: 7 files
- **Scripts**: 4 files
- **CI/CD**: 1 file
- **Migrations**: 3 files (+ versions)

### Code Metrics
- **Total Python Files**: 19
- **Total Lines of Code**: ~3,500 (backend + tests)
- **Frontend Lines**: ~1,400
- **Documentation Lines**: ~2,000+
- **Total Project Lines**: ~7,000+

## 🎯 Critical Files for Review

### Must Review (Core Functionality)
1. `backend/main.py` - Application entry point
2. `backend/models.py` - Database schema
3. `backend/routers/polls.py` - Main business logic
4. `frontend/app.js` - Frontend application
5. `tests/test_polls.py` - Main test coverage

### Configuration Review
1. `.env.sample` - Environment setup
2. `docker-compose.yml` - Local development
3. `requirements.txt` - Dependencies
4. `Dockerfile` - Production build

### Documentation Review
1. `README.md` - Primary documentation
2. `QUICKSTART.md` - Getting started
3. `PROJECT_SUMMARY.md` - Challenge completion

## 🔍 File Relationships

### Dependency Flow
```
main.py
  ├── config.py (settings)
  ├── database.py (DB connection)
  ├── routers/
  │   ├── users.py → auth.py → models.py
  │   ├── polls.py → auth.py → models.py
  │   └── websocket.py → polls.py
  ├── models.py (ORM)
  └── schemas.py (validation)
```

### Frontend Flow
```
index.html
  ├── styles.css (styling)
  └── app.js
      ├── API calls → backend
      └── WebSocket → backend/websocket.py
```

### Testing Flow
```
conftest.py (fixtures)
  ├── test_users.py → users.py
  ├── test_polls.py → polls.py
  ├── test_models.py → models.py
  └── test_main.py → main.py
```

## 📝 File Naming Conventions

- **Python Files**: `snake_case.py`
- **Config Files**: `lowercase.ext` or `.dotfile`
- **Documentation**: `UPPERCASE.md`
- **Scripts**: `lowercase.sh/.bat`
- **Tests**: `test_*.py`

## 🎓 Learning Path

### For New Developers
1. Start with `QUICKSTART.md`
2. Review `README.md`
3. Explore `backend/main.py`
4. Study `backend/models.py`
5. Read `API.md`
6. Run tests in `tests/`

### For Code Review
1. `PROJECT_SUMMARY.md` - Overview
2. `backend/` - Core logic
3. `tests/` - Test coverage
4. `frontend/` - UI implementation
5. `docker-compose.yml` - Deployment

### For Deployment
1. `.env.sample` - Environment setup
2. `Dockerfile` - Build process
3. `azure-deploy.md` or `render.yaml` - Platform config
4. `TESTING_CHECKLIST.md` - Verification

## 🔗 External Dependencies

### Python Packages (requirements.txt)
- **Web Framework**: FastAPI, Uvicorn
- **Database**: SQLAlchemy, asyncpg, alembic
- **Auth**: python-jose, passlib
- **Validation**: Pydantic
- **Testing**: pytest, httpx
- **Monitoring**: prometheus-client
- **Security**: slowapi

### Frontend Libraries (CDN)
- **Chart.js**: 4.4.0 (from CDN)
- **Native**: HTML5, CSS3, ES6 JavaScript

## 🎉 Summary

This QuickPoll project consists of **~40 files** organized into a clean, production-ready structure:

- ✅ **Well-documented**: 7 comprehensive documentation files
- ✅ **Well-tested**: 26 tests across 5 test files
- ✅ **Well-structured**: Clear separation of concerns
- ✅ **Well-configured**: Multiple deployment targets
- ✅ **Well-automated**: CI/CD and startup scripts

Each file serves a specific purpose and follows industry best practices for naming, organization, and documentation.

---

**Quick Navigation**: Use Ctrl+F to search for specific files or features in this index.
