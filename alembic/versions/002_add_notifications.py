"""Add notifications table

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('poll_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.String(500), nullable=False),
        sa.Column('notification_type', sa.String(50), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['poll_id'], ['polls.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('idx_notification_user_read', 'notifications', ['user_id', 'is_read'])
    op.create_index('idx_notification_created', 'notifications', ['created_at'])
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'])
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'])
    op.create_index(op.f('ix_notifications_poll_id'), 'notifications', ['poll_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_notifications_poll_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_index('idx_notification_created', table_name='notifications')
    op.drop_index('idx_notification_user_read', table_name='notifications')
    
    # Drop table
    op.drop_table('notifications')
