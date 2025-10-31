# QuickPoll - Architecture Diagrams

> Visual representations of the QuickPoll system architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Browser    │  │  Mobile Web  │  │  API Client  │          │
│  │  (Chrome,    │  │   (Safari,   │  │   (Postman,  │          │
│  │  Firefox)    │  │   Chrome)    │  │    curl)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                │  HTTPS / WebSocket      │
                │                         │
                └────────────┬────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────────┐
│                    FRONTEND LAYER                                  │
├────────────────────────────┼───────────────────────────────────────┤
│                            │                                        │
│  ┌──────────────────────────▼────────────────────────────┐        │
│  │              Nginx (Docker / Azure SWA)               │        │
│  │                                                        │        │
│  │  ┌──────────────────────────────────────────────┐    │        │
│  │  │         Static Files (frontend/)             │    │        │
│  │  │                                              │    │        │
│  │  │  • index.html   (Structure)                 │    │        │
│  │  │  • styles.css   (Responsive Design)         │    │        │
│  │  │  • app.js       (SPA Logic)                 │    │        │
│  │  │  • Chart.js     (Visualization)             │    │        │
│  │  └──────────────────────────────────────────────┘    │        │
│  └───────────────────────────┬───────────────────────────┘        │
│                              │                                     │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                 ┌─────────────┴──────────────┐
                 │                            │
            HTTP │                            │ WebSocket
                 │                            │
┌────────────────▼────────────────────────────▼───────────────────────┐
│                      BACKEND LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                      │   │
│  │                      (main.py)                              │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │              Middleware Layer                        │  │   │
│  │  │  • CORS          • Rate Limiting                     │  │   │
│  │  │  • Metrics       • Error Handlers                    │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │              Router Layer                            │  │   │
│  │  │                                                       │  │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │  │   │
│  │  │  │   /users     │  │   /polls     │  │ WebSocket │  │  │   │
│  │  │  │              │  │              │  │  /ws/**   │  │  │   │
│  │  │  │ • Register   │  │ • CRUD       │  │           │  │  │   │
│  │  │  │ • Login      │  │ • Vote       │  │ • Live    │  │  │   │
│  │  │  │ • Profile    │  │ • Like       │  │   Updates │  │  │   │
│  │  │  └──────────────┘  └──────────────┘  └───────────┘  │  │   │
│  │  │                                                       │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │            Business Logic Layer                      │  │   │
│  │  │                                                       │  │   │
│  │  │  • auth.py       (JWT Authentication)                │  │   │
│  │  │  • schemas.py    (Pydantic Validation)              │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │             Data Access Layer                        │  │   │
│  │  │                                                       │  │   │
│  │  │  • models.py     (SQLAlchemy ORM)                   │  │   │
│  │  │  • database.py   (Async Sessions)                   │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  └─────────────────────────┬───────────────────────────────────┘   │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             │ asyncpg
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      DATABASE LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Azure PostgreSQL / PostgreSQL                 │   │
│  │                                                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │  users   │  │  polls   │  │  votes   │  │  likes   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────┐                                          │   │
│  │  │ poll_options │                                          │   │
│  │  └──────────────┘                                          │   │
│  │                                                             │   │
│  │  • Foreign Keys  • Unique Constraints  • Indexes          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Request Flow Diagram

### Authentication Flow

```
┌─────────┐                                                    ┌─────────┐
│ Client  │                                                    │ Backend │
└────┬────┘                                                    └────┬────┘
     │                                                              │
     │ 1. POST /api/users/register                                 │
     │    {username, email, password}                              │
     ├──────────────────────────────────────────────────────────► │
     │                                                              │
     │                          2. Hash password (bcrypt)           │
     │                          3. Save to database                 │
     │                          4. Create user record               │
     │                                                              │
     │ 5. Return user object (without password)                     │
     │ ◄──────────────────────────────────────────────────────────┤
     │                                                              │
     │ 6. POST /api/users/login                                    │
     │    {username, password}                                     │
     ├──────────────────────────────────────────────────────────► │
     │                                                              │
     │                          7. Verify password                  │
     │                          8. Generate JWT token               │
     │                             (valid for ACCESS_TOKEN_EXPIRE)  │
     │                                                              │
     │ 9. Return JWT token                                          │
     │ ◄──────────────────────────────────────────────────────────┤
     │                                                              │
     │ 10. Store token in localStorage                              │
     │                                                              │
     │ 11. Subsequent requests include token                        │
     │     Authorization: Bearer <token>                            │
     ├──────────────────────────────────────────────────────────► │
     │                                                              │
     │                          12. Validate JWT                    │
     │                          13. Extract user_id                 │
     │                          14. Load user from DB               │
     │                          15. Process request                 │
     │                                                              │
```

### Poll Creation and Voting Flow

```
┌─────────┐                                              ┌─────────┐
│ Client  │                                              │ Backend │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │ 1. POST /api/polls                                    │
     │    + JWT Token                                        │
     │    {title, description, options[]}                    │
     ├────────────────────────────────────────────────────► │
     │                                                        │
     │                    2. Validate JWT                     │
     │                    3. Validate poll data (Pydantic)    │
     │                    4. Create poll record               │
     │                    5. Create option records            │
     │                    6. Commit transaction               │
     │                                                        │
     │ 7. Return poll with options                            │
     │ ◄──────────────────────────────────────────────────── │
     │                                                        │
     │ 8. Display in UI                                       │
     │                                                        │
     │ 9. User clicks on poll to view                         │
     │    GET /api/polls/{poll_id}                           │
     ├────────────────────────────────────────────────────► │
     │                                                        │
     │                    10. Fetch poll + options            │
     │                    11. Calculate vote counts           │
     │                    12. Check user's vote status        │
     │                                                        │
     │ 13. Return enriched poll data                          │
     │ ◄──────────────────────────────────────────────────── │
     │                                                        │
     │ 14. User selects option and votes                      │
     │     POST /api/polls/{poll_id}/vote                    │
     │     + JWT Token                                        │
     │     {option_id}                                       │
     ├────────────────────────────────────────────────────► │
     │                                                        │
     │                    15. Validate JWT                    │
     │                    16. Check for existing vote         │
     │                    17. Create vote record              │
     │                    18. Commit transaction              │
     │                    19. Notify WebSocket clients        │
     │                                                        │
     │ 20. Return vote confirmation                           │
     │ ◄──────────────────────────────────────────────────── │
     │                                                        │
     │ 21. Update UI (disable voting)                         │
     │                                                        │
```

### Real-time Updates Flow

```
┌──────────┐                                           ┌──────────┐
│ Client A │                                           │ Backend  │
└────┬─────┘                                           └────┬─────┘
     │                                                       │
     │ 1. Open poll detail page                             │
     │    ws://server/ws/polls/{poll_id}/results            │
     ├───────────────────────────────────────────────────► │
     │                                                       │
     │                    2. Accept WebSocket connection     │
     │                    3. Add to connection pool          │
     │                       poll_connections[poll_id].add() │
     │                                                       │
     │ 4. Connection established                             │
     │ ◄─────────────────────────────────────────────────── │
     │                                                       │
                                                             │
     ┌──────────┐                                           │
     │ Client B │                                           │
     └────┬─────┘                                           │
          │                                                 │
          │ 5. Client B also opens same poll                │
          ├─────────────────────────────────────────────► │
          │                                                 │
          │                    6. Add B to connection pool  │
          │                                                 │
          │ 7. Connection established                       │
          │ ◄───────────────────────────────────────────── │
          │                                                 │
          │                                                 │
          │                    8. Auto-send updates loop    │
          │                       (every 5 seconds)         │
          │                       - Fetch poll results      │
          │                       - Broadcast to all        │
          │                                                 │
     ┌────┼────┐                                            │
     │ ◄──┼─── │ 9. Receive results update                  │
     │    │    │    {poll_id, title, total_votes, options}  │
     │    │    │                                             │
     │    │    │ 10. Update Chart.js visualization          │
     │    │    │                                             │
     └────┼────┘                                             │
          │                                                  │
          │ 11. Client B votes on poll                      │
          │     POST /api/polls/{poll_id}/vote              │
          ├──────────────────────────────────────────────► │
          │                                                  │
          │                    12. Process vote              │
          │                    13. Trigger immediate update  │
          │                        notify_poll_update()      │
          │                                                  │
     ┌────┼────┐                                             │
     │ ◄──┼─── │ 14. Both clients get instant update        │
     │    │    │     (without waiting 5 seconds)             │
     └────┼────┘                                             │
          │                                                  │
          │ 15. Close browser tab                            │
          ├──────────────────────────────────────────────► │
          │                                                  │
          │                    16. Remove from pool          │
          │                        on_disconnect()           │
          │                                                  │
```

## Database Schema Diagram

```
┌──────────────────────────┐
│         users            │
├──────────────────────────┤
│ • id (PK)                │
│ • username (unique)      │◄──┐
│ • email (unique)         │   │
│ • hashed_password        │   │  Foreign Key
│ • is_active              │   │  Relationships
│ • is_admin               │   │
│ • created_at             │   │
└──────────────────────────┘   │
                               │
                               │
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
    │                          │                          │
┌───▼──────────────────────┐   │   ┌─────────────────┐   │
│        polls             │   │   │     votes       │   │
├──────────────────────────┤   │   ├─────────────────┤   │
│ • id (PK)                │   │   │ • id (PK)       │   │
│ • title                  │   │   │ • user_id (FK) ─┼───┘
│ • description            │   │   │ • poll_id (FK) ─┼──┐
│ • owner_id (FK) ─────────┼───┘   │ • option_id(FK) │  │
│ • is_active              │       └─────────────────┘  │
│ • allow_multiple_votes   │                            │
│ • created_at             │◄───┐                       │
│ • expires_at             │    │                       │
└──────────────────────────┘    │                       │
                                │                       │
                                │                       │
    ┌───────────────────────────┼───────────────┐       │
    │                           │               │       │
┌───▼──────────────────────┐    │   ┌───────────▼───┐   │
│     poll_options         │    │   │     likes     │   │
├──────────────────────────┤    │   ├───────────────┤   │
│ • id (PK)                │    │   │ • id (PK)     │   │
│ • poll_id (FK) ──────────┼────┘   │ • user_id(FK) │   │
│ • text                   │        │ • poll_id(FK) │   │
│ • order                  │        │ • created_at  │   │
└──────────────────────────┘        └───────────────┘   │
         ▲                                               │
         │                                               │
         └───────────────────────────────────────────────┘

Constraints:
─────────────
• polls.owner_id → users.id (CASCADE DELETE)
• poll_options.poll_id → polls.id (CASCADE DELETE)
• votes.user_id → users.id (CASCADE DELETE)
• votes.poll_id → polls.id (CASCADE DELETE)
• votes.option_id → poll_options.id (CASCADE DELETE)
• likes.user_id → users.id (CASCADE DELETE)
• likes.poll_id → polls.id (CASCADE DELETE)

Unique Constraints:
───────────────────
• votes: (user_id, poll_id, option_id)
• likes: (user_id, poll_id)
• poll_options: (poll_id, text)
```

## Deployment Architecture

### Docker Compose (Local Development)

```
┌────────────────────────────────────────────────────────┐
│              Docker Compose Network                     │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────┐ │
│  │   Frontend   │   │   Backend    │   │ Database  │ │
│  │   (Nginx)    │   │  (FastAPI)   │   │(PostgreSQL)│ │
│  │              │   │              │   │           │ │
│  │ Port: 3000   │   │ Port: 8000   │   │Port: 5432 │ │
│  │              │   │              │   │           │ │
│  │ Static Files │   │ Uvicorn      │   │ Volume:   │ │
│  │ from volume  │   │ --reload     │   │ pg_data   │ │
│  └──────────────┘   └──────────────┘   └───────────┘ │
│                                                         │
│  Volumes:                                               │
│  • ./frontend:/usr/share/nginx/html                     │
│  • ./backend:/app (development mode)                    │
│  • postgres_data:/var/lib/postgresql/data              │
│                                                         │
│  Environment:                                           │
│  • Loaded from .env file                                │
│  • Shared across services                               │
└────────────────────────────────────────────────────────┘
```

### Azure Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Cloud                              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │          Azure Static Web Apps                     │   │
│  │                                                     │   │
│  │  • Frontend (index.html, styles.css, app.js)      │   │
│  │  • CDN Distribution                                │   │
│  │  • HTTPS by default                                │   │
│  │  • Custom domain support                           │   │
│  └─────────────────┬──────────────────────────────────┘   │
│                    │                                        │
│                    │ API Proxy                              │
│                    │                                        │
│  ┌─────────────────▼──────────────────────────────────┐   │
│  │          Azure App Service                         │   │
│  │                                                     │   │
│  │  • Docker Container (FastAPI)                      │   │
│  │  • Auto-scaling                                    │   │
│  │  • Health monitoring                               │   │
│  │  • WebSocket support                               │   │
│  │  • Application Insights (optional)                 │   │
│  └─────────────────┬──────────────────────────────────┘   │
│                    │                                        │
│                    │ asyncpg                                │
│                    │                                        │
│  ┌─────────────────▼──────────────────────────────────┐   │
│  │    Azure Database for PostgreSQL                   │   │
│  │                                                     │   │
│  │  • Managed PostgreSQL                              │   │
│  │  • Automatic backups                               │   │
│  │  • SSL/TLS encryption                              │   │
│  │  • Connection pooling                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Render Deployment

```
┌──────────────────────────────────────────────────────────────┐
│                      Render Platform                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Static Site (Frontend)                    │    │
│  │                                                     │    │
│  │  • Auto-deploy from Git                            │    │
│  │  • CDN delivery                                    │    │
│  │  • HTTPS certificate                               │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│                    │ HTTPS                                   │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────┐    │
│  │          Web Service (Backend)                     │    │
│  │                                                     │    │
│  │  • Docker deployment                               │    │
│  │  • Health checks                                   │    │
│  │  • Auto-deploy from Git                            │    │
│  │  • Environment variables                           │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────┐    │
│  │          PostgreSQL Database                       │    │
│  │                                                     │    │
│  │  • Managed database                                │    │
│  │  • Automatic backups                               │    │
│  │  • Connection pooling                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## CI/CD Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Repository                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Push / Pull Request
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              GitHub Actions Workflow                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Job 1: Lint                                         │  │
│  │  • Black (code formatting)                          │  │
│  │  • Flake8 (style guide)                             │  │
│  │  • Bandit (security scan)                           │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │ Success                             │
│  ┌───────────────────▼─────────────────────────────────┐  │
│  │ Job 2: Test                                         │  │
│  │  • Setup Python 3.11                                │  │
│  │  • Install dependencies                             │  │
│  │  • Run pytest with coverage                         │  │
│  │  • Upload coverage report                           │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │ Success                             │
│  ┌───────────────────▼─────────────────────────────────┐  │
│  │ Job 3: Build                                        │  │
│  │  • Build Docker image                               │  │
│  │  • Tag with version                                 │  │
│  │  • Push to registry                                 │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │ Success                             │
│              ┌───────┴────────┐                            │
│              │                │                            │
│  ┌───────────▼──────┐  ┌─────▼─────────────────────┐     │
│  │ Job 4: Deploy    │  │ Job 5: Deploy to Render   │     │
│  │  to Azure        │  │  • Trigger deployment     │     │
│  │  • Login to Azure│  │  • Update services        │     │
│  │  • Deploy image  │  │  • Run migrations         │     │
│  │  • Run migrations│  │                           │     │
│  └──────────────────┘  └───────────────────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                         │
│                                                             │
│  Layer 1: Network Security                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ • HTTPS/TLS (SSL certificates)                      │  │
│  │ • CORS (Cross-Origin Resource Sharing)              │  │
│  │ • Rate Limiting (SlowAPI)                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 2: Application Security                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ • JWT Authentication (token-based)                   │  │
│  │ • Password Hashing (bcrypt)                          │  │
│  │ • Input Validation (Pydantic)                        │  │
│  │ • SQL Injection Prevention (ORM)                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 3: Authorization                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ • Role-Based Access Control (admin flag)            │  │
│  │ • Resource Ownership Validation                      │  │
│  │ • Dependency Injection for Auth                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 4: Data Security                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ • Database SSL/TLS connections                       │  │
│  │ • Environment variable secrets                       │  │
│  │ • .gitignore for sensitive files                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 5: Monitoring & Logging                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ • Prometheus Metrics                                 │  │
│  │ • Health Check Endpoints                             │  │
│  │ • Error Logging                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Note**: These diagrams use ASCII art for universal compatibility. For production documentation, consider using tools like Mermaid, PlantUML, or draw.io for more sophisticated diagrams.
