"""Add emoji reactions support

Revision ID: 012
Revises: 011
Create Date: 2025-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    # Create reactions table for poll reactions
    op.create_table(
        'poll_reactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('poll_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),  # Nullable for anonymous reactions
        sa.Column('emoji', sa.String(10), nullable=False),
        sa.Column('session_id', sa.String(255), nullable=True),  # For anonymous users
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['poll_id'], ['polls.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_poll_reaction_poll', 'poll_reactions', ['poll_id'])
    op.create_index('idx_poll_reaction_user', 'poll_reactions', ['user_id'])
    
    # Create reactions table for comment reactions
    op.create_table(
        'comment_reactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comment_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),  # Nullable for anonymous reactions
        sa.Column('emoji', sa.String(10), nullable=False),
        sa.Column('session_id', sa.String(255), nullable=True),  # For anonymous users
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comment_reaction_comment', 'comment_reactions', ['comment_id'])
    op.create_index('idx_comment_reaction_user', 'comment_reactions', ['user_id'])


def downgrade():
    op.drop_table('comment_reactions')
    op.drop_table('poll_reactions')
