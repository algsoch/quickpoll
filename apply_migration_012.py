import asyncio
from alembic import op
import sqlalchemy as sa
from sqlalchemy import create_engine
from backend.config import settings
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

async def run_migration():
    """Apply migration 012 asynchronously"""
    # Parse URL and remove SSL parameters for psycopg2
    url = settings.database_url.replace('+asyncpg', '')
    parsed = urlparse(url)
    
    # Remove query parameters (like ssl=require)
    clean_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        '',  # params
        '',  # query - remove all query params
        ''   # fragment
    ))
    
    engine = create_engine(clean_url)
    
    with engine.connect() as connection:
        # Create poll_reactions table
        connection.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS poll_reactions (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                emoji VARCHAR(10) NOT NULL,
                session_id VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        
        # Create indexes for poll_reactions
        connection.execute(sa.text("""
            CREATE INDEX IF NOT EXISTS idx_poll_reaction_poll ON poll_reactions(poll_id)
        """))
        connection.execute(sa.text("""
            CREATE INDEX IF NOT EXISTS idx_poll_reaction_user ON poll_reactions(user_id)
        """))
        
        # Create comment_reactions table
        connection.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS comment_reactions (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                emoji VARCHAR(10) NOT NULL,
                session_id VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        
        # Create indexes for comment_reactions
        connection.execute(sa.text("""
            CREATE INDEX IF NOT EXISTS idx_comment_reaction_comment ON comment_reactions(comment_id)
        """))
        connection.execute(sa.text("""
            CREATE INDEX IF NOT EXISTS idx_comment_reaction_user ON comment_reactions(user_id)
        """))
        
        connection.commit()
    
    print("Migration 012 applied successfully!")

if __name__ == "__main__":
    asyncio.run(run_migration())
