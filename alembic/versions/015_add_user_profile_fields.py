"""Add user profile fields

Revision ID: 015
Revises: 014
Create Date: 2025-10-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add profile fields to users table
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('location', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('website', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('twitter_handle', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('cover_image_url', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('is_public_profile', sa.Boolean(), nullable=False, server_default='1'))


def downgrade() -> None:
    # Remove profile fields
    op.drop_column('users', 'is_public_profile')
    op.drop_column('users', 'cover_image_url')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'twitter_handle')
    op.drop_column('users', 'website')
    op.drop_column('users', 'location')
    op.drop_column('users', 'bio')
