"""Add API Keys

Revision ID: 009
Revises: 008
Create Date: 2025-10-29
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key_name', sa.String(100), nullable=False),
        sa.Column('key_hash', sa.String(255), nullable=False),
        sa.Column('key_prefix', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('idx_api_key_hash', 'api_keys', ['key_hash'])
    op.create_index('idx_api_key_user', 'api_keys', ['user_id'])
    op.create_index('idx_api_key_prefix', 'api_keys', ['key_prefix'])


def downgrade() -> None:
    op.drop_index('idx_api_key_prefix', 'api_keys')
    op.drop_index('idx_api_key_user', 'api_keys')
    op.drop_index('idx_api_key_hash', 'api_keys')
    op.drop_table('api_keys')
