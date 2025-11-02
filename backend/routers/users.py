"""
User authentication endpoints
"""

from datetime import timedelta, datetime, timezone
from typing import List, Optional
import secrets
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header, UploadFile, File
from fastapi.responses import RedirectResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from authlib.integrations.starlette_client import OAuth

from backend.auth import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    get_password_hash,
    get_user_by_email,
    get_user_by_username,
    get_user_from_api_key_or_token,
)
from backend.config import settings
from backend.database import get_db
from backend.models import User
from backend.schemas import Token, UserCreate, UserLogin, UserResponse, ForgotPasswordRequest, ResetPasswordRequest, UserProfileResponse, UserProfileUpdate, PollListResponse

router = APIRouter(prefix="/api/users", tags=["users"])

# Initialize OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)


@router.get("/check-username/{username}")
async def check_username_availability(username: str, db: AsyncSession = Depends(get_db)):
    """Check if username is available"""
    existing_user = await get_user_by_username(db, username)
    return {
        "username": username,
        "available": existing_user is None
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if username exists
        existing_user = await get_user_by_username(db, user_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered"
            )

        # Check if email exists
        existing_email = await get_user_by_email(db, user_data.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
            )

        # Create new user
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            username=user_data.username, email=user_data.email, hashed_password=hashed_password
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        return new_user
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ REGISTRATION ERROR for {user_data.username}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration error: {type(e).__name__}",
        )


@router.post("/login", response_model=Token)
async def login_user(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT token"""
    try:
        user = await authenticate_user(db, user_data.username, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
        )

        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ LOGIN ERROR for {user_data.username}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login error: {type(e).__name__}",
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Optional[User] = Depends(get_user_from_api_key_or_token),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user information
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
    
    return current_user


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)"""
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users


@router.get("/stats/public")
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    """Get public statistics - total users, active users, and visitors"""
    # Total registered users
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar()
    
    # Active users in last 30 days (based on created_at)
    # Use utcnow() to match database datetime (no timezone)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    )
    active_users = active_users_result.scalar()
    
    # Online users in last hour (proxy for online status)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    online_users_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= one_hour_ago)
    )
    online_users = online_users_result.scalar()
    
    return {
        "total_registered_users": total_users,
        "active_users_last_30_days": active_users,
        "online_users_estimate": online_users,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request password reset - generates reset token"""
    # Find user by email
    user = await get_user_by_email(db, request.email)
    
    # Always return success message even if email doesn't exist (security best practice)
    # This prevents email enumeration attacks
    if not user:
        return {
            "message": "If an account exists with this email, a password reset link has been sent."
        }
    
    # Generate secure reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Set token expiration (1 hour from now)
    token_expires = datetime.utcnow() + timedelta(hours=1)
    
    # Store token in database
    user.reset_token = reset_token
    user.reset_token_expires = token_expires
    await db.commit()
    
    # TODO: In production, send email with reset link
    # For now, we'll just return the token (for development/testing)
    # Email would contain link like: https://yourapp.com/reset-password?token={reset_token}
    
    print(f"Password reset token for {user.email}: {reset_token}")
    print(f"Reset link: http://localhost:3000/reset-password?token={reset_token}")
    
    return {
        "message": "If an account exists with this email, a password reset link has been sent.",
        "dev_token": reset_token  # Remove this in production!
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using valid reset token"""
    # Find user with matching reset token
    result = await db.execute(
        select(User).where(User.reset_token == request.token)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Check if token has expired
    if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )
    
    # Hash new password
    user.hashed_password = get_password_hash(request.new_password)
    
    # Clear reset token
    user.reset_token = None
    user.reset_token_expires = None
    
    await db.commit()
    
    return {
        "message": "Password has been successfully reset. You can now login with your new password."
    }


@router.get("/auth/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback"""
    # Determine frontend URL
    cors_origins = settings.cors_origins
    frontend_url = cors_origins[0] if cors_origins else "http://localhost:3000"
    
    try:
        # Get user info from Google
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Google"
            )
        
        email = user_info.get('email')
        google_id = user_info.get('sub')
        name = user_info.get('name', '')
        picture = user_info.get('picture', '')
        
        if not email or not google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or user ID not provided by Google"
            )
        
        # Check if user exists with this OAuth provider
        result = await db.execute(
            select(User).where(
                User.oauth_provider == 'google',
                User.oauth_id == google_id
            )
        )
        user = result.scalar_one_or_none()
        
        # If user doesn't exist with OAuth, check by email
        if not user:
            existing_user = await get_user_by_email(db, email)
            if existing_user:
                # Link Google account to existing user
                if existing_user.oauth_provider is None:
                    existing_user.oauth_provider = 'google'
                    existing_user.oauth_id = google_id
                    existing_user.profile_picture = picture
                    await db.commit()
                    user = existing_user
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Email already linked to {existing_user.oauth_provider} account"
                    )
            else:
                # Create new user
                # Generate username from email or name
                username = email.split('@')[0]
                base_username = username
                counter = 1
                
                # Ensure username is unique
                while await get_user_by_username(db, username):
                    username = f"{base_username}{counter}"
                    counter += 1
                
                user = User(
                    username=username,
                    email=email,
                    oauth_provider='google',
                    oauth_id=google_id,
                    profile_picture=picture,
                    hashed_password=None,  # OAuth users don't have password
                    is_active=True
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
        )
        
        # Redirect to frontend with token
        redirect_url = f"{frontend_url}?token={access_token}&oauth=success"
        
        return RedirectResponse(url=redirect_url)
    
    except Exception as e:
        # Log error and redirect to frontend with error
        import traceback
        print(f"OAuth Error: {e}")
        print(traceback.format_exc())
        
        error_msg = str(e) if not isinstance(e, HTTPException) else e.detail
        redirect_url = f"{frontend_url}?error={error_msg}"
        return RedirectResponse(url=redirect_url)


async def get_user_by_oauth(db: AsyncSession, provider: str, oauth_id: str) -> Optional[User]:
    """Get user by OAuth provider and ID"""
    result = await db.execute(
        select(User).where(
            User.oauth_provider == provider,
            User.oauth_id == oauth_id
        )
    )
    return result.scalar_one_or_none()


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_user_from_api_key_or_token)
):
    """Get a user's public profile"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if profile is public or if it's the user's own profile
    if not user.is_public_profile and (not current_user or current_user.id != user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This profile is private"
        )
    
    # Get user stats
    from backend.models import Poll, Vote, UserBadge, Badge
    
    polls_created_result = await db.execute(
        select(func.count(Poll.id)).where(Poll.owner_id == user.id)
    )
    polls_created_count = polls_created_result.scalar() or 0
    
    votes_cast_result = await db.execute(
        select(func.count(Vote.id)).where(Vote.user_id == user.id)
    )
    votes_cast_count = votes_cast_result.scalar() or 0
    
    # Get badges info
    user_badges_result = await db.execute(
        select(UserBadge).where(UserBadge.user_id == user.id)
    )
    user_badges = user_badges_result.scalars().all()
    badges_earned_count = len(user_badges)
    
    # Calculate total points
    total_points = 0
    if user_badges:
        badge_ids = [ub.badge_id for ub in user_badges]
        points_result = await db.execute(
            select(func.sum(Badge.points)).where(Badge.id.in_(badge_ids))
        )
        total_points = points_result.scalar() or 0
    
    # Build response
    response = UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        bio=user.bio,
        location=user.location,
        website=user.website,
        twitter_handle=user.twitter_handle,
        avatar_url=user.avatar_url or user.profile_picture,
        cover_image_url=user.cover_image_url,
        profile_picture=user.profile_picture,
        is_public_profile=user.is_public_profile,
        oauth_provider=user.oauth_provider,
        polls_created_count=polls_created_count,
        votes_cast_count=votes_cast_count,
        badges_earned_count=badges_earned_count,
        total_points=total_points
    )
    
    return response


@router.post("/upload-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a profile or cover image and return the URL"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
        )
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5MB limit."
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("frontend/public/uploads/profiles")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Return URL (relative to frontend public directory)
    file_url = f"/uploads/profiles/{unique_filename}"
    
    return {
        "url": file_url,
        "filename": unique_filename,
        "message": "Image uploaded successfully"
    }


@router.patch("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    profile_data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update the current user's profile"""
    from backend.models import Poll, Vote, UserBadge, Badge
    
    # Update profile fields
    update_data = profile_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    # Get stats
    polls_created_result = await db.execute(
        select(func.count(Poll.id)).where(Poll.owner_id == current_user.id)
    )
    polls_created_count = polls_created_result.scalar() or 0
    
    votes_cast_result = await db.execute(
        select(func.count(Vote.id)).where(Vote.user_id == current_user.id)
    )
    votes_cast_count = votes_cast_result.scalar() or 0
    
    user_badges_result = await db.execute(
        select(UserBadge).where(UserBadge.user_id == current_user.id)
    )
    user_badges = user_badges_result.scalars().all()
    badges_earned_count = len(user_badges)
    
    total_points = 0
    if user_badges:
        badge_ids = [ub.badge_id for ub in user_badges]
        points_result = await db.execute(
            select(func.sum(Badge.points)).where(Badge.id.in_(badge_ids))
        )
        total_points = points_result.scalar() or 0
    
    response = UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
        bio=current_user.bio,
        location=current_user.location,
        website=current_user.website,
        twitter_handle=current_user.twitter_handle,
        avatar_url=current_user.avatar_url or current_user.profile_picture,
        cover_image_url=current_user.cover_image_url,
        profile_picture=current_user.profile_picture,
        is_public_profile=current_user.is_public_profile,
        oauth_provider=current_user.oauth_provider,
        polls_created_count=polls_created_count,
        votes_cast_count=votes_cast_count,
        badges_earned_count=badges_earned_count,
        total_points=total_points
    )
    
    return response
