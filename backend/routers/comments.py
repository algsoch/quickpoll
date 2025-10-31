"""
Comment management endpoints
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth import get_current_user, get_optional_current_user
from backend.database import get_db
from backend.models import Comment, Poll, User, Notification, CommentVote
from backend.schemas import CommentCreate, CommentResponse, CommentUpdate, CommentVoteRequest
from backend.ai_service import analyze_comment_sentiment

router = APIRouter(prefix="/api/comments", tags=["comments"])


@router.post("/polls/{poll_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    poll_id: int,
    comment_data: CommentCreate,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new comment on a poll with AI sentiment analysis
    Supports anonymous comments if poll allows it
    """
    # Check if poll exists
    result = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = result.scalar_one_or_none()
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )

    # Check if user is authenticated or poll allows anonymous comments
    if not current_user and not poll.allow_anonymous_comments:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to comment on this poll"
        )

    # Get client IP address
    client_ip = request.client.host if request.client else None

    # If replying to a comment, verify parent exists and belongs to same poll
    if comment_data.parent_id:
        parent_result = await db.execute(
            select(Comment).where(Comment.id == comment_data.parent_id)
        )
        parent_comment = parent_result.scalar_one_or_none()
        if not parent_comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent comment not found"
            )
        if parent_comment.poll_id != poll_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment does not belong to this poll"
            )

    # Analyze sentiment using AI
    sentiment_result = await analyze_comment_sentiment(comment_data.content)

    # Create comment
    new_comment = Comment(
        poll_id=poll_id,
        user_id=current_user.id if current_user else None,
        ip_address=client_ip if not current_user else None,
        parent_id=comment_data.parent_id,
        content=comment_data.content,
        sentiment=sentiment_result["sentiment"],
        sentiment_confidence=sentiment_result["confidence"],
        upvotes=0,
        downvotes=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)

    # Create notification for poll owner (if not owner commenting)
    if poll.owner_id != (current_user.id if current_user else None):
        # Create preview of comment (first 50 characters)
        comment_preview = comment_data.content[:50] + "..." if len(comment_data.content) > 50 else comment_data.content
        
        # Create natural notification message
        if current_user:
            notification_message = f"💬 {current_user.username} commented on '{poll.title}': \"{comment_preview}\""
        else:
            notification_message = f"💬 Someone (IP: {client_ip}) commented on '{poll.title}': \"{comment_preview}\""
        
        notification = Notification(
            user_id=poll.owner_id,
            poll_id=poll_id,
            message=notification_message,
            notification_type="comment",
            is_read=False,
            created_at=datetime.utcnow(),
            action_user_id=current_user.id if current_user else None,
            action_username=current_user.username if current_user else f"Anonymous (IP: {client_ip})",
            comment_id=new_comment.id,
            poll_title=poll.title,
            action_detail="new_comment",
        )
        db.add(notification)
        await db.commit()
        
    # If this is a reply, notify the parent comment author
    if comment_data.parent_id:
        parent_result = await db.execute(
            select(Comment).where(Comment.id == comment_data.parent_id)
        )
        parent_comment = parent_result.scalar_one_or_none()
        
        # Only notify if parent comment has a user and it's not the same user replying
        if parent_comment and parent_comment.user_id and parent_comment.user_id != (current_user.id if current_user else None):
            comment_preview = comment_data.content[:50] + "..." if len(comment_data.content) > 50 else comment_data.content
            
            if current_user:
                notification_message = f"↩️ {current_user.username} replied to your comment: \"{comment_preview}\""
            else:
                notification_message = f"↩️ Someone (IP: {client_ip}) replied to your comment: \"{comment_preview}\""
            
            notification = Notification(
                user_id=parent_comment.user_id,
                poll_id=poll_id,
                message=notification_message,
                notification_type="reply",
                is_read=False,
                created_at=datetime.utcnow(),
                action_user_id=current_user.id if current_user else None,
                action_username=current_user.username if current_user else f"Anonymous (IP: {client_ip})",
                comment_id=new_comment.id,
                poll_title=poll.title,
                action_detail="reply",
            )
            db.add(notification)
            await db.commit()

    # Check for new badges (only for logged-in users)
    if current_user:
        from backend.routers.badges import check_and_award_badges
        await check_and_award_badges(db, current_user)

    # Count replies for response
    reply_count_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.parent_id == new_comment.id)
    )
    reply_count = reply_count_result.scalar() or 0

    # Build response
    return CommentResponse(
        id=new_comment.id,
        poll_id=new_comment.poll_id,
        user_id=new_comment.user_id,
        username=current_user.username if current_user else None,
        ip_address=new_comment.ip_address,
        parent_id=new_comment.parent_id,
        content=new_comment.content,
        sentiment=new_comment.sentiment,
        sentiment_confidence=new_comment.sentiment_confidence,
        upvotes=new_comment.upvotes,
        downvotes=new_comment.downvotes,
        reply_count=reply_count,
        created_at=new_comment.created_at,
        updated_at=new_comment.updated_at,
    )


@router.get("/polls/{poll_id}/comments", response_model=List[CommentResponse])
async def get_poll_comments(
    poll_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all comments for a poll (threaded)
    Returns top-level comments only; replies are in separate field
    """
    # Check if poll exists
    result = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = result.scalar_one_or_none()
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poll not found"
        )

    # Get top-level comments (no parent)
    comments_result = await db.execute(
        select(Comment)
        .where(Comment.poll_id == poll_id, Comment.parent_id.is_(None))
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    comments = comments_result.scalars().all()

    # Build response with reply counts
    response = []
    for comment in comments:
        reply_count_result = await db.execute(
            select(func.count(Comment.id)).where(Comment.parent_id == comment.id)
        )
        reply_count = reply_count_result.scalar() or 0

        response.append(
            CommentResponse(
                id=comment.id,
                poll_id=comment.poll_id,
                user_id=comment.user_id,
                username=comment.user.username if comment.user else None,
                ip_address=comment.ip_address,
                parent_id=comment.parent_id,
                content=comment.content,
                sentiment=comment.sentiment,
                sentiment_confidence=comment.sentiment_confidence,
                upvotes=comment.upvotes,
                downvotes=comment.downvotes,
                reply_count=reply_count,
                created_at=comment.created_at,
                updated_at=comment.updated_at,
            )
        )

    return response


@router.get("/comments/{comment_id}/replies", response_model=List[CommentResponse])
async def get_comment_replies(
    comment_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all replies to a specific comment
    """
    # Check if parent comment exists
    parent_result = await db.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    parent_comment = parent_result.scalar_one_or_none()
    if not parent_comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Get replies
    replies_result = await db.execute(
        select(Comment)
        .where(Comment.parent_id == comment_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    replies = replies_result.scalars().all()

    # Build response
    response = []
    for reply in replies:
        # Count sub-replies
        sub_reply_count_result = await db.execute(
            select(func.count(Comment.id)).where(Comment.parent_id == reply.id)
        )
        sub_reply_count = sub_reply_count_result.scalar() or 0

        response.append(
            CommentResponse(
                id=reply.id,
                poll_id=reply.poll_id,
                user_id=reply.user_id,
                username=reply.user.username if reply.user else None,
                ip_address=reply.ip_address,
                parent_id=reply.parent_id,
                content=reply.content,
                sentiment=reply.sentiment,
                sentiment_confidence=reply.sentiment_confidence,
                upvotes=reply.upvotes,
                downvotes=reply.downvotes,
                reply_count=sub_reply_count,
                created_at=reply.created_at,
                updated_at=reply.updated_at,
            )
        )

    return response


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a comment (owner only)
    Re-analyzes sentiment on update
    """
    # Get comment
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Check ownership
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own comments"
        )

    # Re-analyze sentiment
    sentiment_result = await analyze_comment_sentiment(comment_data.content)

    # Update comment
    comment.content = comment_data.content
    comment.sentiment = sentiment_result["sentiment"]
    comment.sentiment_confidence = sentiment_result["confidence"]
    comment.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(comment)

    # Count replies
    reply_count_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.parent_id == comment.id)
    )
    reply_count = reply_count_result.scalar() or 0

    return CommentResponse(
        id=comment.id,
        poll_id=comment.poll_id,
        user_id=comment.user_id,
        username=comment.user.username if comment.user else None,
        ip_address=comment.ip_address,
        parent_id=comment.parent_id,
        content=comment.content,
        sentiment=comment.sentiment,
        sentiment_confidence=comment.sentiment_confidence,
        upvotes=comment.upvotes,
        downvotes=comment.downvotes,
        reply_count=reply_count,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a comment (owner or admin only)
    Cascades to replies automatically
    """
    # Get comment
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Check ownership or admin
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments (or be an admin)"
        )

    await db.delete(comment)
    await db.commit()
    return None


@router.post("/comments/{comment_id}/vote", response_model=CommentResponse)
async def vote_on_comment(
    comment_id: int,
    vote_data: CommentVoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upvote or downvote a comment with proper vote tracking
    - If user hasn't voted: add their vote
    - If user voted same type: remove their vote (toggle off)
    - If user voted different type: switch their vote
    """
    from sqlalchemy import and_
    
    # Get comment
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Check if user already voted
    vote_result = await db.execute(
        select(CommentVote).where(
            and_(
                CommentVote.comment_id == comment_id,
                CommentVote.user_id == current_user.id
            )
        )
    )
    existing_vote = vote_result.scalar_one_or_none()

    if existing_vote:
        if existing_vote.vote_type == vote_data.vote_type:
            # User clicked same vote - toggle off (remove vote)
            if existing_vote.vote_type == "upvote":
                comment.upvotes = max(0, comment.upvotes - 1)
            else:
                comment.downvotes = max(0, comment.downvotes - 1)
            await db.delete(existing_vote)
        else:
            # User switched vote type
            if existing_vote.vote_type == "upvote":
                comment.upvotes = max(0, comment.upvotes - 1)
                comment.downvotes += 1
            else:
                comment.downvotes = max(0, comment.downvotes - 1)
                comment.upvotes += 1
            existing_vote.vote_type = vote_data.vote_type
    else:
        # New vote
        new_vote = CommentVote(
            comment_id=comment_id,
            user_id=current_user.id,
            vote_type=vote_data.vote_type
        )
        db.add(new_vote)
        
        if vote_data.vote_type == "upvote":
            comment.upvotes += 1
        else:
            comment.downvotes += 1
        
        # Create notification for comment author (if not voting on own comment)
        if comment.user_id and comment.user_id != current_user.id:
            # Get poll info for context
            poll_result = await db.execute(
                select(Poll).where(Poll.id == comment.poll_id)
            )
            poll = poll_result.scalar_one_or_none()
            
            if poll:
                vote_emoji = "👍" if vote_data.vote_type == "upvote" else "👎"
                comment_preview = comment.content[:30] + "..." if len(comment.content) > 30 else comment.content
                
                notification_message = f"{vote_emoji} {current_user.username} {'liked' if vote_data.vote_type == 'upvote' else 'disliked'} your comment: \"{comment_preview}\""
                
                notification = Notification(
                    user_id=comment.user_id,
                    poll_id=comment.poll_id,
                    message=notification_message,
                    notification_type="comment_vote",
                    is_read=False,
                    created_at=datetime.utcnow(),
                    action_user_id=current_user.id,
                    action_username=current_user.username,
                    comment_id=comment.id,
                    poll_title=poll.title,
                    action_detail=vote_data.vote_type,
                )
                db.add(notification)

    await db.commit()
    await db.refresh(comment)

    # Count replies
    reply_count_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.parent_id == comment.id)
    )
    reply_count = reply_count_result.scalar() or 0
    
    # Get user's current vote (if any) after the update
    user_vote_result = await db.execute(
        select(CommentVote).where(
            and_(
                CommentVote.comment_id == comment_id,
                CommentVote.user_id == current_user.id
            )
        )
    )
    user_vote = user_vote_result.scalar_one_or_none()
    user_vote_type = user_vote.vote_type if user_vote else None

    return CommentResponse(
        id=comment.id,
        poll_id=comment.poll_id,
        user_id=comment.user_id,
        username=comment.user.username if comment.user else None,
        ip_address=comment.ip_address,
        parent_id=comment.parent_id,
        content=comment.content,
        sentiment=comment.sentiment,
        sentiment_confidence=comment.sentiment_confidence,
        upvotes=comment.upvotes,
        downvotes=comment.downvotes,
        reply_count=reply_count,
        user_vote=user_vote_type,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )
