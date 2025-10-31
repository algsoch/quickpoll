"""Apply migration 015 - Add user profile fields"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from alembic import command
from alembic.config import Config

def apply_migration():
    """Apply the user profile fields migration"""
    alembic_cfg = Config("alembic.ini")
    
    print("Applying migration 015: Add user profile fields...")
    command.upgrade(alembic_cfg, "015")
    print("✓ Migration 015 applied successfully!")
    print("\nNew user profile fields added:")
    print("  • bio")
    print("  • location")
    print("  • website")
    print("  • twitter_handle")
    print("  • avatar_url")
    print("  • cover_image_url")
    print("  • is_public_profile")

if __name__ == "__main__":
    apply_migration()
