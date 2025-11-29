"""
Async database configuration with SQLAlchemy 2.0
"""

import ssl
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from backend.config import settings


# Create SSL context for Azure PostgreSQL
def get_ssl_context():
    """Create SSL context for secure database connections"""
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE  # For Azure, you may need CERT_REQUIRED with proper CA
    return ssl_context


# Create async engine
# Configure engine options based on environment
engine_options = {
    "echo": not settings.is_production,
    "pool_pre_ping": True,
}

# Only add pool settings for PostgreSQL (not for SQLite in tests)
if settings.environment == "test" or "sqlite" in settings.database_url.lower():
    engine_options["poolclass"] = NullPool
else:
    # PostgreSQL connection pool settings
    engine_options["pool_size"] = 5
    engine_options["max_overflow"] = 10
    engine_options["pool_timeout"] = 10  # 10 second timeout for getting connection from pool
    # Add SSL and connection timeout for production Azure PostgreSQL
    if settings.is_production:
        engine_options["connect_args"] = {
            "ssl": get_ssl_context(),
            "timeout": 10,  # 10 second connection timeout
            "command_timeout": 30,  # 30 second query timeout
        }

engine = create_async_engine(
    settings.database_url,
    **engine_options
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autocommit=False, autoflush=False
)


class Base(DeclarativeBase):
    """Base class for all models"""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create all tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_db_connection() -> bool:
    """Health check for database connection"""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False
