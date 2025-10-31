"""
API Key utilities for generation and verification
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import APIKey, User


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key
    Returns: (full_key, key_hash, key_prefix)
    
    Format: qp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    """
    # Generate random 32-character key
    random_part = secrets.token_urlsafe(24)[:32]
    
    # Create full key with prefix
    full_key = f"qp_live_{random_part}"
    
    # Hash the key for storage
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    
    # Store first 12 characters for identification
    key_prefix = full_key[:12]
    
    return full_key, key_hash, key_prefix


async def verify_api_key(db: AsyncSession, api_key: str) -> Optional[User]:
    """
    Verify an API key and return the associated user
    Returns None if key is invalid or expired
    """
    # Hash the provided key
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Find the API key
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        )
    )
    api_key_obj = result.scalar_one_or_none()
    
    if not api_key_obj:
        return None
    
    # Check expiration
    if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
        return None
    
    # Update last_used_at
    api_key_obj.last_used_at = datetime.utcnow()
    await db.commit()
    
    # Get the user
    result = await db.execute(
        select(User).where(User.id == api_key_obj.user_id)
    )
    user = result.scalar_one_or_none()
    
    return user


async def create_api_key(
    db: AsyncSession,
    user_id: int,
    key_name: str,
    expires_in_days: Optional[int] = None
) -> tuple[APIKey, str]:
    """
    Create a new API key for a user
    Returns: (APIKey object, full_api_key_string)
    """
    full_key, key_hash, key_prefix = generate_api_key()
    
    # Calculate expiration date
    expires_at = None
    if expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    
    # Create API key record
    api_key = APIKey(
        user_id=user_id,
        key_name=key_name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        expires_at=expires_at
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return api_key, full_key


async def revoke_api_key(db: AsyncSession, key_id: int, user_id: int) -> bool:
    """
    Revoke (deactivate) an API key
    Returns True if successful, False if key not found
    """
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == user_id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        return False
    
    api_key.is_active = False
    await db.commit()
    
    return True


async def list_user_api_keys(db: AsyncSession, user_id: int) -> list[APIKey]:
    """
    List all API keys for a user
    """
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user_id).order_by(APIKey.created_at.desc())
    )
    return list(result.scalars().all())
