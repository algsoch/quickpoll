"""Apply migration 014 - Add categories and tags"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from alembic import command
from alembic.config import Config

def apply_migration():
    """Apply the categories and tags migration"""
    alembic_cfg = Config("alembic.ini")
    
    print("Applying migration 014: Add categories and tags...")
    command.upgrade(alembic_cfg, "014")
    print("✓ Migration 014 applied successfully!")
    print("\nDefault categories created:")
    print("  📊 General")
    print("  💻 Technology")
    print("  ⚽ Sports")
    print("  🎬 Entertainment")
    print("  🍕 Food & Drink")
    print("  🏛️ Politics")
    print("  🔬 Science")
    print("  📚 Education")
    print("  🏥 Health")
    print("  💼 Business")

if __name__ == "__main__":
    apply_migration()
