#!/usr/bin/env python
"""
Startup script for QuickPoll application
Handles database migrations and application startup
"""

import sys
import asyncio
import subprocess
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.config import settings
from backend.database import check_db_connection


async def main():
    """Main startup function"""
    print("=" * 60)
    print("QuickPoll Application Startup")
    print("=" * 60)
    
    print(f"\n📋 Environment: {settings.environment}")
    print(f"🌐 Host: {settings.host}:{settings.port}")
    
    # Check database connection
    print("\n🔍 Checking database connection...")
    db_ok = await check_db_connection()
    
    if not db_ok:
        print("❌ Database connection failed!")
        print(f"   Database URL: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'configured'}")
        print("\n💡 Troubleshooting:")
        print("   1. Check your DATABASE_URL in .env file")
        print("   2. Ensure PostgreSQL is running")
        print("   3. Verify credentials and network connectivity")
        sys.exit(1)
    
    print("✅ Database connection successful!")
    
    # Run migrations
    print("\n🔄 Running database migrations...")
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            check=True
        )
        print("✅ Migrations completed successfully!")
        if result.stdout:
            print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Migration warning: {e}")
        print("   Continuing anyway (tables may already exist)")
    except FileNotFoundError:
        print("⚠️  Alembic not found, skipping migrations")
        print("   Tables will be created automatically")
    
    print("\n" + "=" * 60)
    print("🚀 Application is ready!")
    print("=" * 60)
    print(f"\n📖 API Documentation: http://{settings.host}:{settings.port}/docs")
    print(f"❤️  Health Check: http://{settings.host}:{settings.port}/health")
    print(f"📊 Metrics: http://{settings.host}:{settings.port}/metrics")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
