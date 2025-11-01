"""
Pydantic schemas for request/response validation
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


# ===== User Schemas =====
class UserBase(BaseModel):
    """Base user schema"""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    """User creation schema"""

    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Ensure password has minimum complexity"""
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLogin(BaseModel):
    """User login schema"""

    username: str
    password: str


class UserResponse(UserBase):
    """User response schema"""

    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data"""

    username: Optional[str] = None
    user_id: Optional[int] = None


class ForgotPasswordRequest(BaseModel):
    """Forgot password request schema"""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password request schema"""

    token: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Ensure password has minimum complexity"""
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one letter")
        return v


# ===== Poll Option Schemas =====
class PollOptionBase(BaseModel):
    """Base poll option schema"""

    text: str = Field(..., min_length=1, max_length=200)
    order: int = Field(default=0, ge=0)


class PollOptionCreate(PollOptionBase):
    """Poll option creation schema"""

    pass


class PollOptionResponse(PollOptionBase):
    """Poll option response schema"""

    id: int
    poll_id: int
    vote_count: int = 0

    model_config = {"from_attributes": True}


class PollOptionUpdate(BaseModel):
    """Poll option update schema"""
    
    id: int
    text: str = Field(..., min_length=1, max_length=200)


# ===== Poll Schemas =====
class PollBase(BaseModel):
    """Base poll schema"""

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category_id: Optional[int] = None
    tags: Optional[List[str]] = None
    allow_multiple_votes: bool = False
    allow_anonymous_votes: bool = False
    allow_anonymous_comments: bool = False
    allow_anonymous_likes: bool = False
    expires_at: Optional[datetime] = None


class PollCreate(PollBase):
    """Poll creation schema"""

    options: List[PollOptionCreate] = Field(..., min_length=2, max_length=10)

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[PollOptionCreate]) -> List[PollOptionCreate]:
        """Ensure options are unique"""
        texts = [opt.text for opt in v]
        if len(texts) != len(set(texts)):
            raise ValueError("Poll options must be unique")
        return v


class PollUpdate(BaseModel):
    """Poll update schema"""

    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category_id: Optional[int] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    options: Optional[List[PollOptionUpdate]] = None
    allow_multiple_votes: Optional[bool] = None
    allow_anonymous_votes: Optional[bool] = None
    allow_anonymous_comments: Optional[bool] = None
    allow_anonymous_likes: Optional[bool] = None


class PollResponse(PollBase):
    """Poll response schema"""

    id: int
    owner_id: int
    owner_username: Optional[str] = None
    owner_profile_picture: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    options: List[PollOptionResponse] = []
    category: Optional["CategoryResponse"] = None
    total_votes: int = 0
    like_count: int = 0
    user_has_voted: bool = False
    user_has_liked: bool = False

    model_config = {"from_attributes": True}


class PollListResponse(BaseModel):
    """Poll list response schema"""

    id: int
    title: str
    description: Optional[str]
    owner_id: int
    owner_username: Optional[str] = None
    owner_profile_picture: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: bool
    created_at: datetime
    total_votes: int = 0
    like_count: int = 0
    option_count: int = 0

    model_config = {"from_attributes": True}


# ===== Vote Schemas =====
class VoteCreate(BaseModel):
    """Vote creation schema"""

    option_id: int = Field(..., gt=0)


class VoteResponse(BaseModel):
    """Vote response schema"""

    id: int
    user_id: int
    poll_id: int
    option_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ===== Like Schemas =====
class LikeResponse(BaseModel):
    """Like response schema"""

    poll_id: int
    like_count: int
    user_has_liked: bool


# ===== Poll Results Schemas =====
class PollResultOption(BaseModel):
    """Poll result option schema"""

    id: int
    text: str
    vote_count: int
    percentage: float


class PollResults(BaseModel):
    """Poll results schema"""

    poll_id: int
    title: str
    total_votes: int
    like_count: int
    options: List[PollResultOption]
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]


# ===== Health Check Schema =====
class HealthCheck(BaseModel):
    """Health check response"""

    status: str
    database: str
    timestamp: datetime


# ===== Notification Schemas =====
class NotificationResponse(BaseModel):
    """Notification response schema"""

    id: int
    user_id: int
    poll_id: int
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    
    # Additional details
    action_user_id: Optional[int] = None
    action_username: Optional[str] = None
    comment_id: Optional[int] = None
    poll_title: Optional[str] = None
    action_detail: Optional[str] = None

    model_config = {"from_attributes": True}


class NotificationMarkRead(BaseModel):
    """Mark notification as read schema"""

    notification_ids: List[int]


# ===== Comment Schemas =====
class CommentBase(BaseModel):
    """Base comment schema"""

    content: str = Field(..., min_length=1, max_length=2000)


class CommentCreate(CommentBase):
    """Comment creation schema"""

    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    """Comment update schema"""

    content: str = Field(..., min_length=1, max_length=2000)


class CommentResponse(CommentBase):
    """Comment response schema"""

    id: int
    poll_id: int
    user_id: Optional[int]
    username: Optional[str]
    ip_address: Optional[str]
    parent_id: Optional[int]
    sentiment: Optional[str]
    sentiment_confidence: Optional[float]
    upvotes: int
    downvotes: int
    reply_count: int
    user_vote: Optional[str] = None  # 'upvote', 'downvote', or None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentVoteRequest(BaseModel):
    """Comment vote request schema"""

    vote_type: str = Field(..., pattern="^(upvote|downvote)$")


# ===== API Key Schemas =====
class APIKeyCreate(BaseModel):
    """API Key creation schema"""

    key_name: str = Field(..., min_length=1, max_length=100)
    expires_in_days: Optional[int] = Field(None, gt=0, le=365)


class APIKeyResponse(BaseModel):
    """API Key response schema"""

    id: int
    key_name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]

    model_config = {"from_attributes": True}


class APIKeyCreateResponse(BaseModel):
    """API Key creation response with full key (only shown once)"""

    id: int
    key_name: str
    api_key: str  # Full API key - only shown on creation
    key_prefix: str
    expires_at: Optional[datetime]
    created_at: datetime


# ===== Reaction Schemas =====
class ReactionBase(BaseModel):
    """Base reaction schema"""

    emoji: str = Field(..., min_length=1, max_length=10)


class ReactionCreate(ReactionBase):
    """Reaction creation schema"""

    session_id: Optional[str] = None  # For anonymous reactions


class ReactionResponse(ReactionBase):
    """Reaction response schema"""

    id: int
    poll_id: Optional[int] = None
    comment_id: Optional[int] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReactionSummary(BaseModel):
    """Reaction summary for polls/comments"""

    emoji: str
    count: int
    user_reacted: bool = False  # Whether current user has reacted with this emoji


# ===== Badge Schemas =====
class BadgeResponse(BaseModel):
    """Badge response schema"""

    id: int
    key: str
    name: str
    description: str
    icon: str
    category: str
    rarity: str
    points: int
    earned: bool = False

    model_config = {"from_attributes": True}


class UserBadgeResponse(BaseModel):
    """User badge response schema with badge details"""

    id: int
    badge_id: int
    badge: BadgeResponse
    earned_at: datetime
    progress: Optional[int] = None

    model_config = {"from_attributes": True}


class BadgeProgressResponse(BaseModel):
    """User's overall progress toward badges"""

    polls_created: int
    votes_cast: int
    likes_given: int
    comments_written: int
    max_poll_votes: int
    max_poll_likes: int
    badges_earned: int
    total_points: int


# ===== Category Schemas =====
class CategoryBase(BaseModel):
    """Base category schema"""
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(CategoryBase):
    """Category response schema"""
    id: int
    created_at: datetime
    
    model_config = {"from_attributes": True}


# ===== User Profile Schemas =====
class UserProfileUpdate(BaseModel):
    """User profile update schema"""
    bio: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    twitter_handle: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = Field(None, max_length=500)
    cover_image_url: Optional[str] = Field(None, max_length=500)
    is_public_profile: Optional[bool] = True


class UserProfileResponse(UserResponse):
    """Extended user profile response"""
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    twitter_handle: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    profile_picture: Optional[str] = None
    is_public_profile: bool
    oauth_provider: Optional[str] = None
    
    # Stats
    polls_created_count: Optional[int] = 0
    votes_cast_count: Optional[int] = 0
    badges_earned_count: Optional[int] = 0
    total_points: Optional[int] = 0
    
    model_config = {"from_attributes": True}


# Resolve forward references
PollResponse.model_rebuild()
