"""Fix comment user_id to allow null for anonymous comments

Revision ID: 010
Revises: 009
Create Date: 2025-10-29
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    """Make user_id nullable in comments table for anonymous comments"""
    op.alter_column('comments', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade():
    """Revert user_id to non-nullable (note: will fail if null values exist)"""
    op.alter_column('comments', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
