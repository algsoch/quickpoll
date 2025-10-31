"""
Notification endpoints for real-time user notifications
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.models import Notification, User
from backend.schemas import NotificationResponse, NotificationMarkRead
from backend.auth import get_current_active_user, get_user_from_api_key_or_token

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=List[NotificationResponse])
@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: Optional[User] = Depends(get_user_from_api_key_or_token),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user's notifications
    Supports both JWT token and API key authentication
    - limit: Maximum number of notifications to return (default: 50)
    - unread_only: If true, only return unread notifications
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
    
    query = select(Notification).where(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return notifications


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    current_user: Optional[User] = Depends(get_user_from_api_key_or_token),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get count of unread notifications
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
    
    from sqlalchemy import func
    
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read == False)
    )
    count = result.scalar() or 0
    
    return {"unread_count": count}


@router.post("/mark-read")
async def mark_notifications_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark notifications as read"""
    if not data.notification_ids:
        return {"marked": 0}
    
    # Verify all notifications belong to current user
    result = await db.execute(
        select(Notification).where(
            Notification.id.in_(data.notification_ids),
            Notification.user_id == current_user.id
        )
    )
    notifications = result.scalars().all()
    
    if len(notifications) != len(data.notification_ids):
        raise HTTPException(
            status_code=403,
            detail="Some notifications do not belong to you"
        )
    
    # Mark as read
    await db.execute(
        update(Notification)
        .where(Notification.id.in_(data.notification_ids))
        .values(is_read=True)
    )
    await db.commit()
    
    return {"marked": len(data.notification_ids)}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for current user"""
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    
    return {"marked": result.rowcount}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification"""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    return {"deleted": True}
