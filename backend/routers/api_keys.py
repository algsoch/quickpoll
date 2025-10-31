"""
API Key management endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_active_user, get_user_from_api_key_or_token
from backend.database import get_db
from backend.models import User
from backend.schemas import APIKeyCreate, APIKeyResponse, APIKeyCreateResponse
from backend.api_keys import (
    create_api_key,
    list_user_api_keys,
    revoke_api_key,
)

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.post("/", response_model=APIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_new_api_key(
    key_data: APIKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new API key for the current user
    
    ⚠️ The full API key is only shown once! Save it securely.
    """
    # Create the API key
    api_key_obj, full_key = await create_api_key(
        db=db,
        user_id=current_user.id,
        key_name=key_data.key_name,
        expires_in_days=key_data.expires_in_days
    )
    
    return APIKeyCreateResponse(
        id=api_key_obj.id,
        key_name=api_key_obj.key_name,
        api_key=full_key,  # Full key shown only on creation
        key_prefix=api_key_obj.key_prefix,
        expires_at=api_key_obj.expires_at,
        created_at=api_key_obj.created_at
    )


@router.get("/", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: Optional[User] = Depends(get_user_from_api_key_or_token),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all API keys for the current user
    Supports both JWT token and API key authentication
    """
    # Try to get user from API key header if not already authenticated
    if not current_user and x_api_key:
        from backend.api_keys import verify_api_key
        current_user = await verify_api_key(db, x_api_key)
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    keys = await list_user_api_keys(db, current_user.id)
    return keys


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key_endpoint(
    key_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke (deactivate) an API key
    """
    success = await revoke_api_key(db, key_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    return None


@router.get("/verify", response_model=dict)
async def verify_api_key_endpoint(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify an API key (for testing)
    """
    from backend.api_keys import verify_api_key
    
    user = await verify_api_key(db, x_api_key)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key"
        )
    
    return {
        "valid": True,
        "user_id": user.id,
        "username": user.username
    }
