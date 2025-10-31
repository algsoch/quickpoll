"""Apply Migration 008: OAuth Support"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.config import settings

async def apply_migration():
    """Apply OAuth support migration"""
    
    # Create async engine
    engine = create_async_engine(
        settings.database_url,
        echo=True,
        future=True
    )
    
    # Create session maker
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        async with session.begin():
            print("\n=== Migration 008: OAuth Support ===")
            
            # 1. Make hashed_password nullable
            print("1. Making hashed_password nullable...")
            await session.execute(text("""
                ALTER TABLE users 
                ALTER COLUMN hashed_password DROP NOT NULL
            """))
            print("✓ hashed_password is now nullable")
            
            # 2. Add OAuth provider column
            print("2. Adding oauth_provider column...")
            await session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50)
            """))
            print("✓ oauth_provider column added")
            
            # 3. Add OAuth ID column
            print("3. Adding oauth_id column...")
            await session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255)
            """))
            print("✓ oauth_id column added")
            
            # 4. Add profile picture column
            print("4. Adding profile_picture column...")
            await session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)
            """))
            print("✓ profile_picture column added")
            
            # 5. Create index for OAuth lookups
            print("5. Creating index for OAuth lookups...")
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_user_oauth 
                ON users(oauth_provider, oauth_id)
            """))
            print("✓ Index created")
            
            print("\n✅ Migration 008 completed successfully!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(apply_migration())
