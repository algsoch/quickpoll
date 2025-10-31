"""Add anonymous comments and IP tracking

Revision ID: 003
Revises: 002
Create Date: 2024-01-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add allow_anonymous_comments to polls table
    op.add_column('polls', sa.Column('allow_anonymous_comments', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add ip_address to comments table
    op.add_column('comments', sa.Column('ip_address', sa.String(length=45), nullable=True))
    
    # Make user_id nullable in comments table (allow anonymous comments)
    op.alter_column('comments', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Add ip_address to votes table
    op.add_column('votes', sa.Column('ip_address', sa.String(length=45), nullable=True))


def downgrade() -> None:
    # Remove ip_address from votes table
    op.drop_column('votes', 'ip_address')
    
    # Make user_id non-nullable again in comments table
    op.alter_column('comments', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    
    # Remove ip_address from comments table
    op.drop_column('comments', 'ip_address')
    
    # Remove allow_anonymous_comments from polls table
    op.drop_column('polls', 'allow_anonymous_comments')
