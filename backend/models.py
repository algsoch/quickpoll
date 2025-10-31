"""
Database models with complete foreign key and constraint coverage
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Optional for OAuth users
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # OAuth fields
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 'google', 'github', etc.
    oauth_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Provider's user ID
    profile_picture: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Profile image URL
    
    # Password reset
    reset_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reset_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Profile fields
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    twitter_handle: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_public_profile: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    polls: Mapped[List["Poll"]] = relationship("Poll", back_populates="owner", cascade="all, delete-orphan")
    votes: Mapped[List["Vote"]] = relationship("Vote", back_populates="user", cascade="all, delete-orphan")
    likes: Mapped[List["Like"]] = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", 
        back_populates="user", 
        foreign_keys="[Notification.user_id]",
        cascade="all, delete-orphan"
    )
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    api_keys: Mapped[List["APIKey"]] = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    badges: Mapped[List["UserBadge"]] = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username})>"


class Poll(Base):
    """Poll model"""

    __tablename__ = "polls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # JSON array as string
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_multiple_votes: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_anonymous_votes: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_anonymous_comments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_anonymous_likes: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="polls")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="polls")
    options: Mapped[List["PollOption"]] = relationship(
        "PollOption", back_populates="poll", cascade="all, delete-orphan"
    )
    votes: Mapped[List["Vote"]] = relationship("Vote", back_populates="poll", cascade="all, delete-orphan")
    likes: Mapped[List["Like"]] = relationship("Like", back_populates="poll", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="poll", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="poll", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (Index("idx_poll_owner_created", "owner_id", "created_at"),)

    def __repr__(self) -> str:
        return f"<Poll(id={self.id}, title={self.title})>"


class PollOption(Base):
    """Poll option model"""

    __tablename__ = "poll_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    poll: Mapped["Poll"] = relationship("Poll", back_populates="options")
    votes: Mapped[List["Vote"]] = relationship("Vote", back_populates="option", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        UniqueConstraint("poll_id", "text", name="uq_poll_option_text"),
        Index("idx_poll_option_order", "poll_id", "order"),
    )

    def __repr__(self) -> str:
        return f"<PollOption(id={self.id}, text={self.text})>"


class Vote(Base):
    """Vote model - tracks user votes on poll options"""

    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    option_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv6 max length
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="votes")
    poll: Mapped["Poll"] = relationship("Poll", back_populates="votes")
    option: Mapped["PollOption"] = relationship("PollOption", back_populates="votes")

    # Constraints - one vote per user per poll (unless multiple votes allowed)
    __table_args__ = (
        Index("idx_vote_poll_user", "poll_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Vote(id={self.id}, user_id={self.user_id}, poll_id={self.poll_id})>"


class Like(Base):
    """Like model - tracks user likes on polls"""

    __tablename__ = "likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="likes")
    poll: Mapped["Poll"] = relationship("Poll", back_populates="likes")

    # Constraints - one like per user per poll
    __table_args__ = (
        UniqueConstraint("user_id", "poll_id", name="uq_user_poll_like"),
        Index("idx_like_poll_user", "poll_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Like(id={self.id}, user_id={self.user_id}, poll_id={self.poll_id})>"


class Notification(Base):
    """Notification model for user notifications"""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'vote', 'like', 'comment', 'reply', 'comment_vote', etc.
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Additional details
    action_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )  # User who performed the action
    action_username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # For anonymous users
    comment_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )  # Related comment if applicable
    poll_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Poll title for context
    action_detail: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # 'upvote', 'downvote', option text, etc.

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    action_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[action_user_id])
    poll: Mapped["Poll"] = relationship("Poll", back_populates="notifications")
    comment: Mapped[Optional["Comment"]] = relationship("Comment", foreign_keys=[comment_id])

    # Indexes
    __table_args__ = (
        Index("idx_notification_user_read", "user_id", "is_read"),
        Index("idx_notification_created", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.notification_type})>"


class CommentVote(Base):
    """Comment vote model - tracks upvotes/downvotes on comments"""

    __tablename__ = "comment_votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'upvote' or 'downvote'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment: Mapped["Comment"] = relationship("Comment", backref="votes")
    user: Mapped["User"] = relationship("User")

    # Constraints - one vote per user per comment
    __table_args__ = (
        Index("idx_comment_vote_user", "comment_id", "user_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<CommentVote(id={self.id}, comment_id={self.comment_id}, user_id={self.user_id}, type={self.vote_type})>"


class Comment(Base):
    """Comment model for poll discussions"""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv6 max length
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # positive/negative/neutral
    sentiment_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    upvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    downvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    poll: Mapped["Poll"] = relationship("Poll", back_populates="comments")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="comments")
    parent: Mapped[Optional["Comment"]] = relationship("Comment", remote_side=[id], back_populates="replies")
    replies: Mapped[List["Comment"]] = relationship("Comment", back_populates="parent", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("idx_comment_poll_created", "poll_id", "created_at"),
        Index("idx_comment_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Comment(id={self.id}, poll_id={self.poll_id}, user_id={self.user_id})>"


class APIKey(Base):
    """API Key model for programmatic access"""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key_name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="api_keys")

    # Indexes
    __table_args__ = (
        Index("idx_api_key_hash", "key_hash"),
        Index("idx_api_key_user", "user_id"),
        Index("idx_api_key_prefix", "key_prefix"),
    )

    def __repr__(self) -> str:
        return f"<APIKey(id={self.id}, user_id={self.user_id}, name={self.key_name})>"


class PollReaction(Base):
    """Poll reaction model - emoji reactions on polls"""

    __tablename__ = "poll_reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    poll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For anonymous reactions
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    poll: Mapped["Poll"] = relationship("Poll")
    user: Mapped[Optional["User"]] = relationship("User")

    # Indexes
    __table_args__ = (
        Index("idx_poll_reaction_poll", "poll_id"),
        Index("idx_poll_reaction_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<PollReaction(id={self.id}, poll_id={self.poll_id}, emoji={self.emoji})>"


class CommentReaction(Base):
    """Comment reaction model - emoji reactions on comments"""

    __tablename__ = "comment_reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For anonymous reactions
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment: Mapped["Comment"] = relationship("Comment")
    user: Mapped[Optional["User"]] = relationship("User")

    # Indexes
    __table_args__ = (
        Index("idx_comment_reaction_comment", "comment_id"),
        Index("idx_comment_reaction_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<CommentReaction(id={self.id}, comment_id={self.comment_id}, emoji={self.emoji})>"


class Badge(Base):
    """Badge model for gamification achievements"""
    
    __tablename__ = "badges"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # Unique identifier like 'first_poll'
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Display name like 'First Poll Creator'
    description: Mapped[str] = mapped_column(String(500), nullable=False)  # Description of achievement
    icon: Mapped[str] = mapped_column(String(10), nullable=False)  # Emoji icon like '🎯'
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # 'creation', 'voting', 'social', 'special'
    rarity: Mapped[str] = mapped_column(String(20), nullable=False, default='common')  # 'common', 'rare', 'epic', 'legendary'
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=10)  # Points value
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # Display order
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user_badges: Mapped[List["UserBadge"]] = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Badge(id={self.id}, key={self.key}, name={self.name})>"


class UserBadge(Base):
    """Junction table for users and their earned badges"""
    
    __tablename__ = "user_badges"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_id: Mapped[int] = mapped_column(Integer, ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    progress: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # For tracking progress toward badge
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    badge: Mapped["Badge"] = relationship("Badge", back_populates="user_badges")
    
    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
        Index("idx_user_badge_user", "user_id"),
        Index("idx_user_badge_badge", "badge_id"),
    )
    
    def __repr__(self) -> str:
        return f"<UserBadge(id={self.id}, user_id={self.user_id}, badge_id={self.badge_id})>"


class Category(Base):
    """Category model for organizing polls"""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Emoji icon
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # Hex color code
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    polls: Mapped[List["Poll"]] = relationship("Poll", back_populates="category")

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name={self.name}, slug={self.slug})>"
