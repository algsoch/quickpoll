"""Add categories and tags

Revision ID: 014
Revises: 013
Create Date: 2025-10-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(10), nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('slug')
    )
    op.create_index('idx_category_slug', 'categories', ['slug'])
    
    # Add category and tags to polls
    op.add_column('polls', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('polls', sa.Column('tags', sa.String(500), nullable=True))  # JSON array as string
    
    # Create foreign key
    op.create_foreign_key(
        'fk_poll_category',
        'polls',
        'categories',
        ['category_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('idx_poll_category', 'polls', ['category_id'])
    
    # Insert default categories
    op.execute("""
        INSERT INTO categories (name, slug, description, icon, color) VALUES
        ('General', 'general', 'General polls and surveys', '📊', '#6366f1'),
        ('Technology', 'technology', 'Tech-related polls', '💻', '#3b82f6'),
        ('Sports', 'sports', 'Sports and fitness polls', '⚽', '#10b981'),
        ('Entertainment', 'entertainment', 'Movies, music, and entertainment', '🎬', '#f59e0b'),
        ('Food & Drink', 'food-drink', 'Food and beverage polls', '🍕', '#ef4444'),
        ('Politics', 'politics', 'Political surveys and opinions', '🏛️', '#8b5cf6'),
        ('Science', 'science', 'Science and research polls', '🔬', '#06b6d4'),
        ('Education', 'education', 'Education and learning', '📚', '#14b8a6'),
        ('Health', 'health', 'Health and wellness', '🏥', '#ec4899'),
        ('Business', 'business', 'Business and finance', '💼', '#f97316')
    """)


def downgrade() -> None:
    # Drop foreign key and indexes
    op.drop_constraint('fk_poll_category', 'polls', type_='foreignkey')
    op.drop_index('idx_poll_category', 'polls')
    
    # Drop columns from polls
    op.drop_column('polls', 'tags')
    op.drop_column('polls', 'category_id')
    
    # Drop categories table
    op.drop_index('idx_category_slug', 'categories')
    op.drop_table('categories')
