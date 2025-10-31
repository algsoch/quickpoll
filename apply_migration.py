"""Apply database migration for anonymous voting support"""
import asyncio
import asyncpg
import os
import ssl
from dotenv import load_dotenv
from urllib.parse import urlparse, unquote

load_dotenv()

async def apply_migration():
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
        print("Starting migration...")
        
        # Migration 001: Anonymous voting support
        print("\n=== Migration 001: Anonymous Voting ===")
        print("1. Adding allow_anonymous_votes column to polls table...")
        await conn.execute("""
            ALTER TABLE polls 
            ADD COLUMN IF NOT EXISTS allow_anonymous_votes BOOLEAN NOT NULL DEFAULT false
        """)
        print("✓ Column added")
        
        print("2. Making user_id nullable in votes table...")
        await conn.execute("""
            ALTER TABLE votes 
            ALTER COLUMN user_id DROP NOT NULL
        """)
        print("✓ User_id is now nullable")
        
        print("3. Dropping unique constraint...")
        try:
            await conn.execute("""
                ALTER TABLE votes 
                DROP CONSTRAINT IF EXISTS uq_user_poll_option_vote
            """)
            print("✓ Constraint dropped")
        except Exception as e:
            print(f"Note: {e} (constraint may not exist)")
        
        # Migration 002: Notifications
        print("\n=== Migration 002: Notifications ===")
        print("1. Creating notifications table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                message VARCHAR(500) NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✓ Notifications table created")
        
        print("2. Creating indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notification_user_read 
            ON notifications(user_id, is_read)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notification_created 
            ON notifications(created_at)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_notifications_user_id 
            ON notifications(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_notifications_poll_id 
            ON notifications(poll_id)
        """)
        print("✓ Indexes created")
        
        # Migration 003: Comments
        print("\n=== Migration 003: Comments ===")
        print("1. Creating comments table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                sentiment VARCHAR(20),
                sentiment_confidence FLOAT,
                upvotes INTEGER NOT NULL DEFAULT 0,
                downvotes INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✓ Comments table created")
        
        print("2. Creating indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_comment_poll_created 
            ON comments(poll_id, created_at)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_comment_user 
            ON comments(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_comments_parent_id 
            ON comments(parent_id)
        """)
        print("✓ Indexes created")
        
        # Migration 004: Anonymous comments and IP tracking
        print("\n=== Migration 004: Anonymous Comments & IP Tracking ===")
        print("1. Adding allow_anonymous_comments to polls table...")
        await conn.execute("""
            ALTER TABLE polls 
            ADD COLUMN IF NOT EXISTS allow_anonymous_comments BOOLEAN NOT NULL DEFAULT false
        """)
        print("✓ Column added")
        
        print("2. Adding ip_address to votes table...")
        await conn.execute("""
            ALTER TABLE votes 
            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)
        """)
        print("✓ IP address column added to votes")
        
        print("3. Adding ip_address to comments table...")
        await conn.execute("""
            ALTER TABLE comments 
            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)
        """)
        print("✓ IP address column added to comments")
        
        # Migration 005: Comment Votes Table
        print("\n=== Migration 005: Comment Votes Tracking ===")
        
        print("1. Creating comment_votes table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS comment_votes (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                vote_type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✓ Comment votes table created")
        
        print("2. Creating indexes on comment_votes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_comment_vote_user 
            ON comment_votes(comment_id, user_id)
        """)
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_vote_unique 
            ON comment_votes(comment_id, user_id)
        """)
        print("✓ Indexes created")
        
        print("\n✅ All migrations completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
