"""
Main FastAPI application with startup checks, middleware, and health endpoints
"""

import sys
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from backend.config import settings
from backend.database import check_db_connection, init_db
from backend.routers import users, polls, websocket, notifications, comments, api_keys, reactions, badges
from backend.schemas import HealthCheck

# Prometheus metrics
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Visitor tracking (in-memory for simplicity - use Redis in production)
visitor_ips = set()
total_visitors = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("Starting QuickPoll application...")
    print(f"Environment: {settings.environment}")
    print(f"Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'configured'}")

    # Check database connection with retries for cloud deployment
    print("Checking database connection...")
    max_retries = 3
    retry_delay = 2
    db_ok = False
    
    for attempt in range(max_retries):
        try:
            db_ok = await check_db_connection()
            if db_ok:
                print(f"Database connection successful! (attempt {attempt + 1}/{max_retries})")
                break
            else:
                print(f"Database connection failed (attempt {attempt + 1}/{max_retries})")
        except Exception as e:
            print(f"Database connection error (attempt {attempt + 1}/{max_retries}): {e}")
        
        if attempt < max_retries - 1:
            print(f"Retrying in {retry_delay} seconds...")
            import asyncio
            await asyncio.sleep(retry_delay)
    
    if not db_ok:
        print("WARNING: Database connection failed after retries!")
        print("Application will start but database operations may fail")
        print("Please check:")
        print("1. DATABASE_URL is correct")
        print("2. Azure PostgreSQL firewall allows Render IPs")
        print("3. Database server is running")
        # Don't exit - let the app start anyway for debugging
    else:
        # Initialize database (create tables if needed)
        print("Initializing database schema...")
        try:
            await init_db()
            print("Database schema initialized successfully!")
        except Exception as e:
            print(f"WARNING: Failed to initialize database schema: {e}")
            print("Application will start but some features may not work")

    print("Application started successfully!")
    print(f"Health Check: /health")

    yield

    # Shutdown
    print("Shutting down QuickPoll application...")


# Create FastAPI app
app = FastAPI(
    title="QuickPoll API",
    description="Production-grade polling application built with FastAPI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add session middleware for OAuth (MUST be before CORS)
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request metrics middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track request metrics and visitors"""
    import time
    
    # Track unique visitors
    global visitor_ips, total_visitors
    client_ip = request.client.host if request.client else "unknown"
    if client_ip not in visitor_ips and client_ip != "unknown":
        visitor_ips.add(client_ip)
        total_visitors += 1

    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time
    REQUEST_COUNT.labels(
        method=request.method, endpoint=request.url.path, status=response.status_code
    ).inc()
    REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(duration)

    return response


# Include routers
app.include_router(users.router)
app.include_router(polls.router)
app.include_router(websocket.router)
app.include_router(notifications.router)
app.include_router(comments.router)
app.include_router(api_keys.router)
app.include_router(reactions.router)
app.include_router(badges.router)

# Import and include activity and categories routers
try:
    from backend.routers import activity, categories
    app.include_router(activity.router)
    app.include_router(categories.router)
except Exception as e:
    print(f"Error loading activity/categories routers: {e}")
    import traceback
    traceback.print_exc()


# Health check endpoint
@app.get("/health", response_model=HealthCheck, tags=["health"])
async def health_check():
    """Health check endpoint"""
    try:
        db_status = "healthy" if await check_db_connection() else "unhealthy"
    except Exception as e:
        print(f"Health check DB error: {e}")
        db_status = "unhealthy"

    return HealthCheck(status="healthy", database=db_status, timestamp=datetime.utcnow())


# Simple ping endpoint (no DB required - for Render health checks)
@app.get("/ping", tags=["health"])
async def ping():
    """Simple ping endpoint without database check"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# Visitor statistics endpoint
@app.get("/api/stats/visitors", tags=["statistics"])
async def get_visitor_stats():
    """Get visitor statistics"""
    return {
        "total_visitors": total_visitors,
        "unique_visitors": len(visitor_ips),
        "timestamp": datetime.utcnow().isoformat()
    }


# Poll statistics endpoint
@app.get("/api/stats/polls", tags=["statistics"])
async def get_poll_stats():
    """Get poll statistics"""
    from backend.database import get_db
    from backend.models import Poll
    from sqlalchemy import select, func
    
    async for db in get_db():
        total_polls = (await db.execute(select(func.count(Poll.id)))).scalar()
        active_polls = (await db.execute(select(func.count(Poll.id)).where(Poll.is_active == True))).scalar()
        closed_polls = (await db.execute(select(func.count(Poll.id)).where(Poll.is_active == False))).scalar()
        
        return {
            "total_polls": total_polls,
            "active_polls": active_polls,
            "closed_polls": closed_polls,
            "timestamp": datetime.utcnow().isoformat()
        }


# Prometheus metrics endpoint
@app.get("/metrics", tags=["monitoring"])
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "message": "QuickPoll API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "environment": settings.environment,
    }


# Admin endpoint (protected)
@app.get("/admin/stats", tags=["admin"])
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def admin_stats(request: Request):
    """Admin statistics endpoint (requires admin credentials)"""
    from backend.auth import verify_admin_credentials

    # Basic auth check (simplified - in production use proper auth)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing credentials"},
            headers={"WWW-Authenticate": "Basic"},
        )

    try:
        import base64

        credentials = base64.b64decode(auth.split(" ")[1]).decode("utf-8")
        username, password = credentials.split(":", 1)
        if not verify_admin_credentials(username, password):
            raise ValueError("Invalid credentials")
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid credentials"},
            headers={"WWW-Authenticate": "Basic"},
        )

    # Return stats
    from backend.database import get_db
    from backend.models import User, Poll, Vote, Like
    from sqlalchemy import select, func

    async for db in get_db():
        user_count = (await db.execute(select(func.count(User.id)))).scalar()
        poll_count = (await db.execute(select(func.count(Poll.id)))).scalar()
        vote_count = (await db.execute(select(func.count(Vote.id)))).scalar()
        like_count = (await db.execute(select(func.count(Like.id)))).scalar()

        return {
            "users": user_count,
            "polls": poll_count,
            "votes": vote_count,
            "likes": like_count,
            "timestamp": datetime.utcnow(),
        }


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Any):
    """Custom 404 handler"""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Resource not found", "path": str(request.url.path)},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Any):
    """Custom 500 handler"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
