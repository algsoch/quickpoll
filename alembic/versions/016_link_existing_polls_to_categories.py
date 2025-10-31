"""Link existing polls to categories based on keywords

Revision ID: 016
Revises: 015
Create Date: 2025-10-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    """
    Automatically link existing polls to appropriate categories based on keywords
    """
    
    # Category keyword mappings
    category_keywords = {
        'technology': ['tech', 'computer', 'software', 'coding', 'programming', 'app', 'digital', 'internet', 'ai', 'machine learning'],
        'sports': ['sport', 'football', 'basketball', 'soccer', 'game', 'team', 'player', 'match', 'fitness', 'exercise'],
        'entertainment': ['movie', 'film', 'music', 'show', 'series', 'actor', 'song', 'artist', 'concert', 'entertainment'],
        'food-drink': ['food', 'drink', 'restaurant', 'recipe', 'cooking', 'meal', 'dinner', 'lunch', 'breakfast', 'coffee', 'pizza', 'burger'],
        'politics': ['politic', 'election', 'government', 'vote', 'president', 'minister', 'party', 'policy', 'law'],
        'science': ['science', 'research', 'study', 'experiment', 'theory', 'discovery', 'lab', 'physics', 'chemistry', 'biology'],
        'education': ['education', 'school', 'university', 'student', 'teacher', 'class', 'learning', 'course', 'study', 'exam'],
        'health': ['health', 'medical', 'doctor', 'hospital', 'medicine', 'disease', 'wellness', 'fitness', 'mental health'],
        'business': ['business', 'company', 'work', 'job', 'career', 'office', 'startup', 'entrepreneur', 'finance', 'money', 'salary'],
    }
    
    # Build the SQL CASE statement for category assignment
    case_conditions = []
    
    for slug, keywords in category_keywords.items():
        # Create OR conditions for each keyword
        keyword_conditions = ' OR '.join([
            f"LOWER(polls.title) LIKE '%{keyword.lower()}%' OR LOWER(polls.description) LIKE '%{keyword.lower()}%'"
            for keyword in keywords
        ])
        
        # Add to case conditions
        case_conditions.append(f"""
            WHEN ({keyword_conditions}) THEN (SELECT id FROM categories WHERE slug = '{slug}')
        """)
    
    # Add default case for "general"
    case_conditions.append("""
            ELSE (SELECT id FROM categories WHERE slug = 'general')
    """)
    
    # Build the complete UPDATE statement
    case_statement = 'CASE ' + ' '.join(case_conditions) + ' END'
    
    update_sql = f"""
        UPDATE polls
        SET category_id = {case_statement}
        WHERE category_id IS NULL
    """
    
    # Execute the update
    op.execute(update_sql)
    
    print("✅ Successfully linked existing polls to categories based on keywords")


def downgrade():
    """
    Remove category links from polls
    """
    op.execute("""
        UPDATE polls
        SET category_id = NULL
    """)
    
    print("⬇️ Removed category links from polls")
