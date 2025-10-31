import asyncio
import sqlalchemy as sa
from sqlalchemy import create_engine, text
from backend.config import settings
from urllib.parse import urlparse, urlunparse

async def run_migration():
    """Apply migration 013 - Add badges and user_badges tables"""
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
        # Create badges table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS badges (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(500) NOT NULL,
                icon VARCHAR(10) NOT NULL,
                category VARCHAR(50) NOT NULL,
                rarity VARCHAR(20) NOT NULL DEFAULT 'common',
                points INTEGER NOT NULL DEFAULT 10,
                "order" INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        
        # Create user_badges junction table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_badges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
                earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
                progress INTEGER,
                CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
            )
        """))
        
        # Create indexes
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_badge_user ON user_badges(user_id)
        """))
        
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_badge_badge ON user_badges(badge_id)
        """))
        
        connection.commit()
        
        print("✅ Badges and UserBadges tables created successfully!")
        
        # Seed initial badges
        result = connection.execute(text("SELECT COUNT(*) as count FROM badges"))
        count = result.fetchone()[0]
        
        if count == 0:
            print("📝 Seeding initial badges...")
            
            badges_data = [
                # Creation Badges
                ("first_poll", "First Steps", "Create your first poll", "🎯", "creation", "common", 10, 1),
                ("poll_creator_5", "Getting Started", "Create 5 polls", "📊", "creation", "common", 25, 2),
                ("poll_creator_10", "Poll Master", "Create 10 polls", "🏆", "creation", "rare", 50, 3),
                ("poll_creator_50", "Pollster Pro", "Create 50 polls", "👑", "creation", "epic", 200, 4),
                ("poll_creator_100", "Poll Legend", "Create 100 polls", "⭐", "creation", "legendary", 500, 5),
                
                # Voting Badges
                ("first_vote", "Voice Heard", "Cast your first vote", "🗳️", "voting", "common", 5, 10),
                ("voter_10", "Active Voter", "Cast 10 votes", "✅", "voting", "common", 20, 11),
                ("voter_100", "Democracy Champion", "Cast 100 votes", "🎖️", "voting", "rare", 100, 12),
                ("voter_500", "Super Voter", "Cast 500 votes", "💎", "voting", "epic", 300, 13),
                
                # Popularity Badges
                ("popular_poll_100", "Trending Creator", "Create a poll with 100+ votes", "🔥", "popularity", "rare", 75, 20),
                ("popular_poll_500", "Viral Pollster", "Create a poll with 500+ votes", "🚀", "popularity", "epic", 250, 21),
                ("popular_poll_1000", "Mega Influencer", "Create a poll with 1000+ votes", "🌟", "popularity", "legendary", 1000, 22),
                ("liked_poll_50", "Crowd Favorite", "Create a poll with 50+ likes", "❤️", "popularity", "rare", 60, 23),
                
                # Social Badges
                ("first_comment", "Conversation Starter", "Write your first comment", "💬", "social", "common", 10, 30),
                ("commenter_50", "Chatty", "Write 50 comments", "🗨️", "social", "rare", 75, 31),
                ("social_butterfly", "Social Butterfly", "Like 100 polls", "🦋", "social", "rare", 50, 32),
                
                # Special Badges
                ("early_adopter", "Early Adopter", "Join QuickPoll in its early days", "🎉", "special", "epic", 100, 40),
                ("night_owl", "Night Owl", "Create a poll between midnight and 5 AM", "🦉", "special", "rare", 30, 42),
            ]
            
            for badge in badges_data:
                connection.execute(text("""
                    INSERT INTO badges (key, name, description, icon, category, rarity, points, "order")
                    VALUES (:key, :name, :description, :icon, :category, :rarity, :points, :order)
                """), {
                    "key": badge[0],
                    "name": badge[1],
                    "description": badge[2],
                    "icon": badge[3],
                    "category": badge[4],
                    "rarity": badge[5],
                    "points": badge[6],
                    "order": badge[7]
                })
            
            connection.commit()
            print(f"✅ Seeded {len(badges_data)} badges successfully!")
        else:
            print(f"ℹ️ Badges already exist ({count} badges found)")
    
    print("✅ Migration 013 completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migration())
