"""Add anonymous comments and IP tracking

Revision ID: 004
Revises: 003
Create Date: 2025-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add allow_anonymous_comments to polls table
    op.add_column('polls', sa.Column('allow_anonymous_comments', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add ip_address to votes table
    op.add_column('votes', sa.Column('ip_address', sa.String(45), nullable=True))
    
    # Add ip_address to comments table and make user_id nullable
    op.add_column('comments', sa.Column('ip_address', sa.String(45), nullable=True))
    op.alter_column('comments', 'user_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Remove columns
    op.drop_column('comments', 'ip_address')
    op.alter_column('comments', 'user_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('votes', 'ip_address')
    op.drop_column('polls', 'allow_anonymous_comments')
