"""
Apply migration 009 - Add API Keys
"""
import asyncio
import sys
from sqlalchemy import text
from backend.database import engine, AsyncSessionLocal


async def apply_migration():
    """Apply migration 009"""
    print("🔄 Applying migration 009 - Add API Keys...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Create api_keys table
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    key_name VARCHAR(100) NOT NULL,
                    key_hash VARCHAR(255) NOT NULL,
                    key_prefix VARCHAR(20) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_used_at TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """))
            print("✓ Created api_keys table")
            
            # Create indexes
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_keys(key_hash)"))
            print("✓ Created idx_api_key_hash index")
            
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_keys(user_id)"))
            print("✓ Created idx_api_key_user index")
            
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_api_key_prefix ON api_keys(key_prefix)"))
            print("✓ Created idx_api_key_prefix index")
            
            await session.commit()
            print("✅ Migration 009 applied successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error applying migration: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(apply_migration())
