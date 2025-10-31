"""Add anonymous likes support

Revision ID: 011
Revises: 010
Create Date: 2025-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    # Add allow_anonymous_likes column to polls table
    op.add_column('polls', sa.Column('allow_anonymous_likes', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    # Remove allow_anonymous_likes column from polls table
    op.drop_column('polls', 'allow_anonymous_likes')
