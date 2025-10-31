"""Add anonymous voting support

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add allow_anonymous_votes column to polls table
    op.add_column('polls', sa.Column('allow_anonymous_votes', sa.Boolean(), nullable=False, server_default='false'))
    
    # Make user_id nullable in votes table for anonymous votes
    op.alter_column('votes', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Drop the unique constraint that includes user_id since anonymous users can vote multiple times
    # if allow_multiple_votes is enabled
    op.drop_constraint('uq_user_poll_option_vote', 'votes', type_='unique')


def downgrade() -> None:
    # Re-add the unique constraint
    op.create_unique_constraint('uq_user_poll_option_vote', 'votes', ['user_id', 'poll_id', 'option_id'])
    
    # Make user_id non-nullable again
    op.alter_column('votes', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    
    # Drop allow_anonymous_votes column
    op.drop_column('polls', 'allow_anonymous_votes')
