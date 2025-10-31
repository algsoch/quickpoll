"""Apply migration 006 directly"""
import asyncio
from sqlalchemy import text
from backend.database import engine

async def apply_migration():
    async with engine.begin() as conn:
        print("Adding notification detail columns...")
        
        # Add new columns
        await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_user_id INTEGER"))
        await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_username VARCHAR(100)"))
        await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id INTEGER"))
        await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS poll_title VARCHAR(500)"))
        await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_detail VARCHAR(100)"))
        
        print("✓ Columns added")
        
        # Add foreign key constraints
        print("Adding foreign key constraints...")
        
        # Check if constraints exist
        result = await conn.execute(text("""
            SELECT constraint_name FROM information_schema.table_constraints 
            WHERE table_name='notifications' AND constraint_name='fk_notifications_action_user_id'
        """))
        if not result.fetchone():
            await conn.execute(text("""
                ALTER TABLE notifications 
                ADD CONSTRAINT fk_notifications_action_user_id 
                FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE CASCADE
            """))
            print("✓ Action user foreign key added")
        else:
            print("✓ Action user foreign key already exists")
        
        result = await conn.execute(text("""
            SELECT constraint_name FROM information_schema.table_constraints 
            WHERE table_name='notifications' AND constraint_name='fk_notifications_comment_id'
        """))
        if not result.fetchone():
            await conn.execute(text("""
                ALTER TABLE notifications 
                ADD CONSTRAINT fk_notifications_comment_id 
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
            """))
            print("✓ Comment foreign key added")
        else:
            print("✓ Comment foreign key already exists")
        
        print("\n✅ Migration 006 completed successfully!")

if __name__ == "__main__":
    asyncio.run(apply_migration())
