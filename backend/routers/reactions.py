"""
Reaction endpoints for emoji reactions on polls and comments
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from backend.database import get_db
from backend.models import User, Poll, Comment, PollReaction, CommentReaction
from backend.schemas import ReactionCreate, ReactionSummary
from backend.auth import get_current_user, get_optional_current_user
import uuid

router = APIRouter(prefix="/api/reactions", tags=["reactions"])

# Allowed emojis for reactions
ALLOWED_EMOJIS = ["👍", "👎", "😂", "❤️", "🎉", "🤔"]


@router.post("/polls/{poll_id}", response_model=ReactionSummary)
async def add_poll_reaction(
    poll_id: int,
    reaction: ReactionCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add or toggle reaction to a poll"""
    
    # Validate emoji
    if reaction.emoji not in ALLOWED_EMOJIS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid emoji. Allowed: {', '.join(ALLOWED_EMOJIS)}"
        )
    
    # Check if poll exists
    result = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = result.scalar_one_or_none()
    
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    # For authenticated users, use user_id
    # For anonymous, use session_id from request
    user_id = current_user.id if current_user else None
    session_id = reaction.session_id if not current_user else None
    
    # Check if user/session already reacted with this emoji
    query = select(PollReaction).where(
        PollReaction.poll_id == poll_id,
        PollReaction.emoji == reaction.emoji
    )
    
    if user_id:
        query = query.where(PollReaction.user_id == user_id)
    elif session_id:
        query = query.where(PollReaction.session_id == session_id)
    else:
        # Generate a new session ID for anonymous users without one
        session_id = str(uuid.uuid4())
        query = query.where(PollReaction.session_id == session_id)
    
    result = await db.execute(query)
    existing_reaction = result.scalar_one_or_none()
    
    if existing_reaction:
        # Remove reaction (toggle off)
        await db.delete(existing_reaction)
        await db.commit()
        user_reacted = False
    else:
        # Add new reaction
        new_reaction = PollReaction(
            poll_id=poll_id,
            user_id=user_id,
            session_id=session_id,
            emoji=reaction.emoji
        )
        db.add(new_reaction)
        await db.commit()
        user_reacted = True
    
    # Get updated count for this emoji
    count_result = await db.execute(
        select(func.count(PollReaction.id))
        .where(
            PollReaction.poll_id == poll_id,
            PollReaction.emoji == reaction.emoji
        )
    )
    count = count_result.scalar() or 0
    
    return ReactionSummary(
        emoji=reaction.emoji,
        count=count,
        user_reacted=user_reacted
    )


@router.get("/polls/{poll_id}", response_model=List[ReactionSummary])
async def get_poll_reactions(
    poll_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all reactions for a poll with counts"""
    
    # Check if poll exists
    result = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = result.scalar_one_or_none()
    
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )
    
    # Get reaction counts grouped by emoji
    count_query = (
        select(
            PollReaction.emoji,
            func.count(PollReaction.id).label('count')
        )
        .where(PollReaction.poll_id == poll_id)
        .group_by(PollReaction.emoji)
    )
    
    result = await db.execute(count_query)
    reaction_counts = {row[0]: row[1] for row in result.all()}
    
    # Check which emojis the current user has reacted with
    user_reactions = set()
    if current_user:
        user_query = select(PollReaction.emoji).where(
            PollReaction.poll_id == poll_id,
            PollReaction.user_id == current_user.id
        )
        result = await db.execute(user_query)
        user_reactions = {row[0] for row in result.all()}
    elif session_id:
        session_query = select(PollReaction.emoji).where(
            PollReaction.poll_id == poll_id,
            PollReaction.session_id == session_id
        )
        result = await db.execute(session_query)
        user_reactions = {row[0] for row in result.all()}
    
    # Return summary for all allowed emojis
    summaries = []
    for emoji in ALLOWED_EMOJIS:
        summaries.append(ReactionSummary(
            emoji=emoji,
            count=reaction_counts.get(emoji, 0),
            user_reacted=emoji in user_reactions
        ))
    
    return summaries


@router.post("/comments/{comment_id}", response_model=ReactionSummary)
async def add_comment_reaction(
    comment_id: int,
    reaction: ReactionCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add or toggle reaction to a comment"""
    
    # Validate emoji
    if reaction.emoji not in ALLOWED_EMOJIS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid emoji. Allowed: {', '.join(ALLOWED_EMOJIS)}"
        )
    
    # Check if comment exists
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # For authenticated users, use user_id
    # For anonymous, use session_id from request
    user_id = current_user.id if current_user else None
    session_id = reaction.session_id if not current_user else None
    
    # Check if user/session already reacted with this emoji
    query = select(CommentReaction).where(
        CommentReaction.comment_id == comment_id,
        CommentReaction.emoji == reaction.emoji
    )
    
    if user_id:
        query = query.where(CommentReaction.user_id == user_id)
    elif session_id:
        query = query.where(CommentReaction.session_id == session_id)
    else:
        # Generate a new session ID for anonymous users without one
        session_id = str(uuid.uuid4())
        query = query.where(CommentReaction.session_id == session_id)
    
    result = await db.execute(query)
    existing_reaction = result.scalar_one_or_none()
    
    if existing_reaction:
        # Remove reaction (toggle off)
        await db.delete(existing_reaction)
        await db.commit()
        user_reacted = False
    else:
        # Add new reaction
        new_reaction = CommentReaction(
            comment_id=comment_id,
            user_id=user_id,
            session_id=session_id,
            emoji=reaction.emoji
        )
        db.add(new_reaction)
        await db.commit()
        user_reacted = True
    
    # Get updated count for this emoji
    count_result = await db.execute(
        select(func.count(CommentReaction.id))
        .where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.emoji == reaction.emoji
        )
    )
    count = count_result.scalar() or 0
    
    return ReactionSummary(
        emoji=reaction.emoji,
        count=count,
        user_reacted=user_reacted
    )


@router.get("/comments/{comment_id}", response_model=List[ReactionSummary])
async def get_comment_reactions(
    comment_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all reactions for a comment with counts"""
    
    # Check if comment exists
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Get reaction counts grouped by emoji
    count_query = (
        select(
            CommentReaction.emoji,
            func.count(CommentReaction.id).label('count')
        )
        .where(CommentReaction.comment_id == comment_id)
        .group_by(CommentReaction.emoji)
    )
    
    result = await db.execute(count_query)
    reaction_counts = {row[0]: row[1] for row in result.all()}
    
    # Check which emojis the current user has reacted with
    user_reactions = set()
    if current_user:
        user_query = select(CommentReaction.emoji).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == current_user.id
        )
        result = await db.execute(user_query)
        user_reactions = {row[0] for row in result.all()}
    elif session_id:
        session_query = select(CommentReaction.emoji).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.session_id == session_id
        )
        result = await db.execute(session_query)
        user_reactions = {row[0] for row in result.all()}
    
    # Return summary for all allowed emojis
    summaries = []
    for emoji in ALLOWED_EMOJIS:
        summaries.append(ReactionSummary(
            emoji=emoji,
            count=reaction_counts.get(emoji, 0),
            user_reacted=emoji in user_reactions
        ))
    
    return summaries
