"""add comment votes table

Revision ID: 005
Revises: 004
Create Date: 2025-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create comment_votes table
    op.create_table(
        'comment_votes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comment_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('vote_type', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_comment_vote_user', 'comment_votes', ['comment_id', 'user_id'], unique=True)
    op.create_index(op.f('ix_comment_votes_id'), 'comment_votes', ['id'], unique=False)
    op.create_index(op.f('ix_comment_votes_comment_id'), 'comment_votes', ['comment_id'], unique=False)
    op.create_index(op.f('ix_comment_votes_user_id'), 'comment_votes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_comment_votes_user_id'), table_name='comment_votes')
    op.drop_index(op.f('ix_comment_votes_comment_id'), table_name='comment_votes')
    op.drop_index(op.f('ix_comment_votes_id'), table_name='comment_votes')
    op.drop_index('idx_comment_vote_user', table_name='comment_votes')
    op.drop_table('comment_votes')
