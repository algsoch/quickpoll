"""
Badge endpoints for gamification system
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth import get_current_active_user, get_optional_current_user
from backend.database import get_db
from backend.models import Badge, UserBadge, User, Poll, Vote, Like, Comment
from backend.schemas import BadgeResponse, UserBadgeResponse, BadgeProgressResponse

router = APIRouter(prefix="/api/badges", tags=["badges"])


async def check_and_award_badges(db: AsyncSession, user: User) -> List[Badge]:
    """
    Check user achievements and award appropriate badges.
    Returns list of newly earned badges.
    """
    newly_earned = []
    
    # Get all badges
    result = await db.execute(select(Badge).where(Badge.is_active == True))
    all_badges = result.scalars().all()
    
    # Get badges user already has
    user_badges_result = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user.id)
    )
    earned_badge_ids = {row[0] for row in user_badges_result}
    
    # Get user statistics
    polls_count_result = await db.execute(
        select(func.count(Poll.id)).where(Poll.owner_id == user.id)
    )
    polls_count = polls_count_result.scalar() or 0
    
    votes_count_result = await db.execute(
        select(func.count(Vote.id)).where(Vote.user_id == user.id)
    )
    votes_count = votes_count_result.scalar() or 0
    
    likes_given_result = await db.execute(
        select(func.count(Like.id)).where(Like.user_id == user.id)
    )
    likes_given = likes_given_result.scalar() or 0
    
    comments_count_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.user_id == user.id)
    )
    comments_count = comments_count_result.scalar() or 0
    
    # Check for polls with high vote counts
    popular_polls_result = await db.execute(
        select(Poll.id, func.count(Vote.id).label("vote_count"))
        .join(Vote, Vote.poll_id == Poll.id)
        .where(Poll.owner_id == user.id)
        .group_by(Poll.id)
    )
    max_poll_votes = max([row[1] for row in popular_polls_result], default=0)
    
    # Check for polls with high like counts
    liked_polls_result = await db.execute(
        select(Poll.id, func.count(Like.id).label("like_count"))
        .join(Like, Like.poll_id == Poll.id)
        .where(Poll.owner_id == user.id)
        .group_by(Poll.id)
    )
    max_poll_likes = max([row[1] for row in liked_polls_result], default=0)
    
    # Check each badge condition
    badge_conditions = {
        # Creation badges
        "first_poll": polls_count >= 1,
        "poll_creator_5": polls_count >= 5,
        "poll_creator_10": polls_count >= 10,
        "poll_creator_50": polls_count >= 50,
        "poll_creator_100": polls_count >= 100,
        
        # Voting badges
        "first_vote": votes_count >= 1,
        "voter_10": votes_count >= 10,
        "voter_100": votes_count >= 100,
        "voter_500": votes_count >= 500,
        
        # Popularity badges
        "popular_poll_100": max_poll_votes >= 100,
        "popular_poll_500": max_poll_votes >= 500,
        "popular_poll_1000": max_poll_votes >= 1000,
        "liked_poll_50": max_poll_likes >= 50,
        
        # Social badges
        "first_comment": comments_count >= 1,
        "commenter_50": comments_count >= 50,
        "social_butterfly": likes_given >= 100,
        
        # Special badges
        "early_adopter": True,  # Award to all users for now
    }
    
    # Award badges
    for badge in all_badges:
        # Skip if already earned
        if badge.id in earned_badge_ids:
            continue
        
        # Check if condition is met
        if badge.key in badge_conditions and badge_conditions[badge.key]:
            user_badge = UserBadge(
                user_id=user.id,
                badge_id=badge.id
            )
            db.add(user_badge)
            newly_earned.append(badge)
    
    if newly_earned:
        await db.commit()
    
    return newly_earned


@router.get("/", response_model=List[BadgeResponse])
async def list_all_badges(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """List all available badges"""
    result = await db.execute(
        select(Badge)
        .where(Badge.is_active == True)
        .order_by(Badge.category, Badge.order)
    )
    badges = result.scalars().all()
    
    # If user is logged in, include earned status
    if current_user:
        user_badges_result = await db.execute(
            select(UserBadge.badge_id).where(UserBadge.user_id == current_user.id)
        )
        earned_badge_ids = {row[0] for row in user_badges_result}
        
        return [
            BadgeResponse(
                id=badge.id,
                key=badge.key,
                name=badge.name,
                description=badge.description,
                icon=badge.icon,
                category=badge.category,
                rarity=badge.rarity,
                points=badge.points,
                earned=badge.id in earned_badge_ids
            )
            for badge in badges
        ]
    
    return [
        BadgeResponse(
            id=badge.id,
            key=badge.key,
            name=badge.name,
            description=badge.description,
            icon=badge.icon,
            category=badge.category,
            rarity=badge.rarity,
            points=badge.points,
            earned=False
        )
        for badge in badges
    ]


@router.get("/my-badges", response_model=List[UserBadgeResponse])
async def get_my_badges(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get badges earned by current user"""
    result = await db.execute(
        select(UserBadge)
        .options(selectinload(UserBadge.badge))
        .where(UserBadge.user_id == current_user.id)
        .order_by(UserBadge.earned_at.desc())
    )
    user_badges = result.scalars().all()
    
    return [
        UserBadgeResponse(
            id=ub.id,
            badge_id=ub.badge_id,
            badge=BadgeResponse(
                id=ub.badge.id,
                key=ub.badge.key,
                name=ub.badge.name,
                description=ub.badge.description,
                icon=ub.badge.icon,
                category=ub.badge.category,
                rarity=ub.badge.rarity,
                points=ub.badge.points,
                earned=True
            ),
            earned_at=ub.earned_at,
            progress=ub.progress
        )
        for ub in user_badges
    ]


@router.get("/user/{user_id}", response_model=List[UserBadgeResponse])
async def get_user_badges(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get badges earned by a specific user"""
    result = await db.execute(
        select(UserBadge)
        .options(selectinload(UserBadge.badge))
        .where(UserBadge.user_id == user_id)
        .order_by(UserBadge.earned_at.desc())
    )
    user_badges = result.scalars().all()
    
    return [
        UserBadgeResponse(
            id=ub.id,
            badge_id=ub.badge_id,
            badge=BadgeResponse(
                id=ub.badge.id,
                key=ub.badge.key,
                name=ub.badge.name,
                description=ub.badge.description,
                icon=ub.badge.icon,
                category=ub.badge.category,
                rarity=ub.badge.rarity,
                points=ub.badge.points,
                earned=True
            ),
            earned_at=ub.earned_at,
            progress=ub.progress
        )
        for ub in user_badges
    ]


@router.post("/check", response_model=List[BadgeResponse])
async def check_badges(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check for new badges based on current user achievements.
    Returns list of newly earned badges.
    """
    newly_earned = await check_and_award_badges(db, current_user)
    
    return [
        BadgeResponse(
            id=badge.id,
            key=badge.key,
            name=badge.name,
            description=badge.description,
            icon=badge.icon,
            category=badge.category,
            rarity=badge.rarity,
            points=badge.points,
            earned=True
        )
        for badge in newly_earned
    ]


@router.get("/progress", response_model=BadgeProgressResponse)
async def get_badge_progress(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's progress toward earning badges"""
    
    # Get user statistics
    polls_count_result = await db.execute(
        select(func.count(Poll.id)).where(Poll.owner_id == current_user.id)
    )
    polls_created = polls_count_result.scalar() or 0
    
    votes_count_result = await db.execute(
        select(func.count(Vote.id)).where(Vote.user_id == current_user.id)
    )
    votes_cast = votes_count_result.scalar() or 0
    
    likes_given_result = await db.execute(
        select(func.count(Like.id)).where(Like.user_id == current_user.id)
    )
    likes_given = likes_given_result.scalar() or 0
    
    comments_count_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.user_id == current_user.id)
    )
    comments_written = comments_count_result.scalar() or 0
    
    # Get max votes on user's polls (using subquery to avoid nested aggregates)
    vote_counts_subquery = (
        select(Poll.id, func.count(Vote.id).label('vote_count'))
        .select_from(Poll)
        .join(Vote, Vote.poll_id == Poll.id, isouter=True)
        .where(Poll.owner_id == current_user.id)
        .group_by(Poll.id)
        .subquery()
    )
    popular_polls_result = await db.execute(
        select(func.max(vote_counts_subquery.c.vote_count))
    )
    max_poll_votes = popular_polls_result.scalar() or 0
    
    # Get max likes on user's polls (using subquery to avoid nested aggregates)
    like_counts_subquery = (
        select(Poll.id, func.count(Like.id).label('like_count'))
        .select_from(Poll)
        .join(Like, Like.poll_id == Poll.id, isouter=True)
        .where(Poll.owner_id == current_user.id)
        .group_by(Poll.id)
        .subquery()
    )
    liked_polls_result = await db.execute(
        select(func.max(like_counts_subquery.c.like_count))
    )
    max_poll_likes = liked_polls_result.scalar() or 0
    
    # Get total badges earned
    badges_earned_result = await db.execute(
        select(func.count(UserBadge.id)).where(UserBadge.user_id == current_user.id)
    )
    badges_earned = badges_earned_result.scalar() or 0
    
    # Get total points
    points_result = await db.execute(
        select(func.sum(Badge.points))
        .join(UserBadge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == current_user.id)
    )
    total_points = points_result.scalar() or 0
    
    return BadgeProgressResponse(
        polls_created=polls_created,
        votes_cast=votes_cast,
        likes_given=likes_given,
        comments_written=comments_written,
        max_poll_votes=max_poll_votes,
        max_poll_likes=max_poll_likes,
        badges_earned=badges_earned,
        total_points=total_points
    )
