"""
Apply migration 011: Add anonymous likes support
"""
import sys
from pathlib import Path
import asyncio

# Add parent directory to path to import backend modules
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from backend.database import engine

async def apply_migration():
    """Apply migration 011"""
    print("Applying migration 011: Add anonymous likes support...")
    
    try:
        async with engine.begin() as conn:
            # Check if column already exists
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='polls' AND column_name='allow_anonymous_likes'
            """))
            
            if result.fetchone():
                print("✓ Column 'allow_anonymous_likes' already exists. Skipping migration.")
                return
            
            # Add allow_anonymous_likes column
            await conn.execute(text("""
                ALTER TABLE polls 
                ADD COLUMN allow_anonymous_likes BOOLEAN NOT NULL DEFAULT FALSE
            """))
            
            print("✓ Migration 011 applied successfully!")
            print("✓ Added 'allow_anonymous_likes' column to polls table")
            
    except Exception as e:
        print(f"✗ Error applying migration: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(apply_migration())
