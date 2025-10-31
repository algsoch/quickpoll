"""add oauth support

Revision ID: 008
Revises: 007
Create Date: 2025-10-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make hashed_password nullable for OAuth users
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(255),
                    nullable=True)
    
    # Add OAuth fields
    op.add_column('users', sa.Column('oauth_provider', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('oauth_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('profile_picture', sa.String(500), nullable=True))
    
    # Add index for oauth lookups
    op.create_index('idx_user_oauth', 'users', ['oauth_provider', 'oauth_id'])


def downgrade() -> None:
    # Remove index
    op.drop_index('idx_user_oauth', table_name='users')
    
    # Remove OAuth columns
    op.drop_column('users', 'profile_picture')
    op.drop_column('users', 'oauth_id')
    op.drop_column('users', 'oauth_provider')
    
    # Make hashed_password non-nullable again
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(255),
                    nullable=False)
