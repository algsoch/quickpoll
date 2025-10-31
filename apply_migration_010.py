"""Apply migration 010: Fix comment user_id to allow null for anonymous comments"""

import asyncio
import asyncpg
import os
import ssl
from dotenv import load_dotenv
from urllib.parse import urlparse, unquote

load_dotenv()

async def apply_migration():
    """Apply the migration to make user_id nullable in comments table"""
    print("Applying migration 010: Fix comment user_id nullable...")
    
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    
    # Convert SQLAlchemy URL to asyncpg format
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
    
    # Parse URL to extract SSL parameters
    parsed = urlparse(database_url)
    
    # Create SSL context for Azure PostgreSQL
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    # Build connection parameters with URL-decoded password
    conn_params = {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'user': parsed.username,
        'password': unquote(parsed.password) if parsed.password else None,
        'database': parsed.path.lstrip('/').split('?')[0],
        'ssl': ssl_context
    }
    
    # Connect to database
    conn = await asyncpg.connect(**conn_params)
    
    try:
        # Make user_id nullable in comments table
        print("Making user_id nullable in comments table...")
        await conn.execute("""
            ALTER TABLE comments 
            ALTER COLUMN user_id DROP NOT NULL;
        """)
        print("✓ user_id is now nullable")
        
        print("\n✓ Migration 010 applied successfully!")
        print("Anonymous comments are now supported!")
        
    except Exception as e:
        print(f"✗ Error applying migration: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
