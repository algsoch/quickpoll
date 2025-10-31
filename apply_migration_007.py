"""
Apply migration 007: Add password reset fields
"""
import asyncio
from sqlalchemy import text
from backend.database import engine, Base
from backend.models import User  # Import to ensure table is registered


async def apply_migration():
    """Apply migration 007 manually"""
    async with engine.begin() as conn:
        # Add reset_token column
        await conn.execute(text("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
        """))
        
        # Add reset_token_expires column
        await conn.execute(text("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
        """))
        
        print("✅ Migration 007 applied successfully!")
        print("   - Added reset_token column to users table")
        print("   - Added reset_token_expires column to users table")


if __name__ == "__main__":
    asyncio.run(apply_migration())
