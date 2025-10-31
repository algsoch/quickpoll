"""Add notification details

Revision ID: 006
Revises: 005
Create Date: 2025-10-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to notifications table
    op.add_column('notifications', sa.Column('action_user_id', sa.Integer(), nullable=True))
    op.add_column('notifications', sa.Column('action_username', sa.String(100), nullable=True))
    op.add_column('notifications', sa.Column('comment_id', sa.Integer(), nullable=True))
    op.add_column('notifications', sa.Column('poll_title', sa.String(500), nullable=True))
    op.add_column('notifications', sa.Column('action_detail', sa.String(100), nullable=True))
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_notifications_action_user_id',
        'notifications', 'users',
        ['action_user_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_notifications_comment_id',
        'notifications', 'comments',
        ['comment_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint('fk_notifications_comment_id', 'notifications', type_='foreignkey')
    op.drop_constraint('fk_notifications_action_user_id', 'notifications', type_='foreignkey')
    
    # Drop columns
    op.drop_column('notifications', 'action_detail')
    op.drop_column('notifications', 'poll_title')
    op.drop_column('notifications', 'comment_id')
    op.drop_column('notifications', 'action_username')
    op.drop_column('notifications', 'action_user_id')
