"""
Poll endpoints with CRUD, voting, and likes
"""

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth import get_current_active_user, get_optional_current_user
from backend.database import get_db
from backend.models import Poll, PollOption, Vote, Like, User
from backend.schemas import (
    PollCreate,
    PollUpdate,
    PollResponse,
    PollListResponse,
    VoteCreate,
    VoteResponse,
    LikeResponse,
    PollResults,
    PollResultOption,
    PollOptionResponse,
)

router = APIRouter(prefix="/api/polls", tags=["polls"])


async def get_poll_or_404(db: AsyncSession, poll_id: int) -> Poll:
    """Get poll by ID or raise 404"""
    result = await db.execute(
        select(Poll)
        .options(selectinload(Poll.options), selectinload(Poll.owner))
        .where(Poll.id == poll_id)
    )
    poll = result.scalar_one_or_none()
    if not poll:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")
    return poll


async def check_poll_ownership(poll: Poll, user: User) -> None:
    """Check if user owns the poll"""
    if poll.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this poll"
        )


async def enrich_poll_response(
    db: AsyncSession, poll: Poll, user_id: Optional[int] = None
) -> dict:
    """Enrich poll with vote counts and user interaction data"""
    # Get vote counts per option
    vote_counts_query = (
        select(Vote.option_id, func.count(Vote.id).label("count"))
        .where(Vote.poll_id == poll.id)
        .group_by(Vote.option_id)
    )
    vote_counts_result = await db.execute(vote_counts_query)
    vote_counts = {option_id: count for option_id, count in vote_counts_result}

    # Get total votes
    total_votes = sum(vote_counts.values())

    # Get like count
    like_count_result = await db.execute(
        select(func.count(Like.id)).where(Like.poll_id == poll.id)
    )
    like_count = like_count_result.scalar() or 0

    # Check if user has voted
    user_has_voted = False
    user_has_liked = False
    if user_id:
        voted_result = await db.execute(
            select(Vote).where(and_(Vote.poll_id == poll.id, Vote.user_id == user_id)).limit(1)
        )
        user_has_voted = voted_result.scalar_one_or_none() is not None

        liked_result = await db.execute(
            select(Like).where(and_(Like.poll_id == poll.id, Like.user_id == user_id)).limit(1)
        )
        user_has_liked = liked_result.scalar_one_or_none() is not None

    # Enrich options with vote counts
    enriched_options = []
    for option in poll.options:
        enriched_options.append(
            PollOptionResponse(
                id=option.id,
                poll_id=option.poll_id,
                text=option.text,
                order=option.order,
                vote_count=vote_counts.get(option.id, 0),
            )
        )

    # Get owner information
    owner_username = None
    owner_profile_picture = None
    if poll.owner:
        owner_username = poll.owner.username
        owner_profile_picture = poll.owner.avatar_url or poll.owner.profile_picture
    
    # Parse tags from JSON string
    import json
    tags = None
    if poll.tags:
        try:
            tags = json.loads(poll.tags) if isinstance(poll.tags, str) else poll.tags
        except (json.JSONDecodeError, TypeError):
            tags = None
    
    return {
        "id": poll.id,
        "title": poll.title,
        "description": poll.description,
        "tags": tags,
        "category_id": poll.category_id,
        "owner_id": poll.owner_id,
        "owner_username": owner_username,
        "owner_profile_picture": owner_profile_picture,
        "is_active": poll.is_active,
        "allow_multiple_votes": poll.allow_multiple_votes,
        "allow_anonymous_votes": poll.allow_anonymous_votes,
        "allow_anonymous_comments": poll.allow_anonymous_comments,
        "created_at": poll.created_at,
        "updated_at": poll.updated_at,
        "expires_at": poll.expires_at,
        "options": enriched_options,
        "total_votes": total_votes,
        "like_count": like_count,
        "user_has_voted": user_has_voted,
        "user_has_liked": user_has_liked,
    }


@router.post("/", response_model=PollResponse, status_code=status.HTTP_201_CREATED)
async def create_poll(
    poll_data: PollCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new poll"""
    import json
    
    # Convert tags list to JSON string
    tags_json = None
    if poll_data.tags:
        tags_json = json.dumps(poll_data.tags)
    
    # Create poll
    new_poll = Poll(
        title=poll_data.title,
        description=poll_data.description,
        owner_id=current_user.id,
        category_id=poll_data.category_id,
        tags=tags_json,
        allow_multiple_votes=poll_data.allow_multiple_votes,
        allow_anonymous_votes=poll_data.allow_anonymous_votes,
        allow_anonymous_comments=poll_data.allow_anonymous_comments,
        expires_at=poll_data.expires_at,
    )
    db.add(new_poll)
    await db.flush()

    # Create poll options
    for idx, option_data in enumerate(poll_data.options):
        option = PollOption(
            poll_id=new_poll.id, text=option_data.text, order=option_data.order or idx
        )
        db.add(option)

    await db.commit()
    await db.refresh(new_poll)

    # Check for new badges
    from backend.routers.badges import check_and_award_badges
    await check_and_award_badges(db, current_user)
    
    # Reload with options
    poll = await get_poll_or_404(db, new_poll.id)
    enriched = await enrich_poll_response(db, poll, current_user.id)
    return PollResponse(**enriched)


@router.get("/", response_model=List[PollListResponse])
async def list_polls(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    active_only: bool = Query(True),
    search: Optional[str] = Query(None, description="Search polls by title, description, or tags"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    sort_by: Optional[str] = Query("newest", description="Sort by: newest, oldest, most-voted, most-liked"),
    date_from: Optional[str] = Query(None, description="Filter polls created after this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter polls created before this date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """List all polls with search, sort, and date filtering"""
    from backend.models import Category
    query = select(Poll).options(selectinload(Poll.options), selectinload(Poll.owner), selectinload(Poll.category))

    if active_only:
        query = query.where(Poll.is_active == True)
    
    # Category filter
    if category_id is not None:
        query = query.where(Poll.category_id == category_id)
    
    # Search filter - search in title, description, and tags
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Poll.title.ilike(search_pattern),
                Poll.description.ilike(search_pattern),
                Poll.tags.ilike(search_pattern)  # Also search in tags
            )
        )
    
    # Date range filters
    if date_from:
        try:
            date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.where(Poll.created_at >= date_from_obj)
        except ValueError:
            pass  # Ignore invalid date format
    
    if date_to:
        try:
            date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
            # Add one day to include the entire end date
            date_to_obj = date_to_obj + timedelta(days=1)
            query = query.where(Poll.created_at < date_to_obj)
        except ValueError:
            pass  # Ignore invalid date format
    
    # For sorting by votes/likes, we need to join and aggregate
    if sort_by == "most-voted":
        # Subquery to get vote counts
        vote_counts = (
            select(Vote.poll_id, func.count(Vote.id).label("vote_count"))
            .group_by(Vote.poll_id)
            .subquery()
        )
        query = query.outerjoin(vote_counts, Poll.id == vote_counts.c.poll_id)
        query = query.order_by(func.coalesce(vote_counts.c.vote_count, 0).desc())
    elif sort_by == "most-liked":
        # Subquery to get like counts
        like_counts = (
            select(Like.poll_id, func.count(Like.id).label("like_count"))
            .group_by(Like.poll_id)
            .subquery()
        )
        query = query.outerjoin(like_counts, Poll.id == like_counts.c.poll_id)
        query = query.order_by(func.coalesce(like_counts.c.like_count, 0).desc())
    elif sort_by == "oldest":
        query = query.order_by(Poll.created_at.asc())
    else:  # Default to newest
        query = query.order_by(Poll.created_at.desc())
    
    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    polls = result.scalars().all()

    # Enrich with counts and owner info
    response = []
    for poll in polls:
        vote_count_result = await db.execute(
            select(func.count(Vote.id)).where(Vote.poll_id == poll.id)
        )
        total_votes = vote_count_result.scalar() or 0

        like_count_result = await db.execute(
            select(func.count(Like.id)).where(Like.poll_id == poll.id)
        )
        like_count = like_count_result.scalar() or 0

        # Parse tags
        import json
        tags = None
        if poll.tags:
            try:
                tags = json.loads(poll.tags)
            except:
                tags = None
        
        # Get category info
        category_name = None
        category_icon = None
        category_color = None
        if poll.category:
            category_name = poll.category.name
            category_icon = poll.category.icon
            category_color = poll.category.color

        response.append(
            PollListResponse(
                id=poll.id,
                title=poll.title,
                description=poll.description,
                owner_id=poll.owner_id,
                owner_username=poll.owner.username if poll.owner else None,
                owner_profile_picture=poll.owner.profile_picture if poll.owner else None,
                category_id=poll.category_id,
                category_name=category_name,
                category_icon=category_icon,
                category_color=category_color,
                tags=tags,
                is_active=poll.is_active,
                created_at=poll.created_at,
                total_votes=total_votes,
                like_count=like_count,
                option_count=len(poll.options),
            )
        )

    return response


@router.get("/{poll_id}", response_model=PollResponse)
async def get_poll(
    poll_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific poll by ID (public - no auth required)"""
    poll = await get_poll_or_404(db, poll_id)
    user_id = current_user.id if current_user else None
    enriched = await enrich_poll_response(db, poll, user_id)
    return PollResponse(**enriched)


@router.put("/{poll_id}", response_model=PollResponse)
async def update_poll(
    poll_id: int,
    poll_data: PollUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a poll (owner only)"""
    import json
    
    poll = await get_poll_or_404(db, poll_id)
    await check_poll_ownership(poll, current_user)

    # Update basic fields
    if poll_data.title is not None:
        poll.title = poll_data.title
    if poll_data.description is not None:
        poll.description = poll_data.description
    if poll_data.is_active is not None:
        poll.is_active = poll_data.is_active
    if poll_data.expires_at is not None:
        poll.expires_at = poll_data.expires_at
    if poll_data.allow_multiple_votes is not None:
        poll.allow_multiple_votes = poll_data.allow_multiple_votes
    if poll_data.allow_anonymous_votes is not None:
        poll.allow_anonymous_votes = poll_data.allow_anonymous_votes
    if poll_data.allow_anonymous_comments is not None:
        poll.allow_anonymous_comments = poll_data.allow_anonymous_comments
    
    # Update category
    if poll_data.category_id is not None:
        poll.category_id = poll_data.category_id
    
    # Update tags - convert list to JSON string
    if poll_data.tags is not None:
        poll.tags = json.dumps(poll_data.tags) if poll_data.tags else None
    
    # Update poll options if provided
    if poll_data.options is not None:
        for option_update in poll_data.options:
            # Find the option by ID
            result = await db.execute(
                select(PollOption).where(
                    and_(PollOption.id == option_update.id, PollOption.poll_id == poll_id)
                )
            )
            option = result.scalar_one_or_none()
            if option:
                option.text = option_update.text

    await db.commit()
    await db.refresh(poll)

    poll = await get_poll_or_404(db, poll_id)
    enriched = await enrich_poll_response(db, poll, current_user.id)
    return PollResponse(**enriched)


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poll(
    poll_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a poll (owner only)"""
    poll = await get_poll_or_404(db, poll_id)
    await check_poll_ownership(poll, current_user)

    await db.delete(poll)
    await db.commit()


@router.post("/{poll_id}/vote", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
async def vote_on_poll(
    poll_id: int,
    vote_data: VoteCreate,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vote on a poll (user can only vote once unless multiple votes allowed)"""
    poll = await get_poll_or_404(db, poll_id)

    # Check if anonymous voting is allowed
    if not poll.allow_anonymous_votes and not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to vote on this poll"
        )

    # Get client IP address
    client_ip = request.client.host if request.client else None

    # Check if poll is active
    if not poll.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll is not active")

    # Check if poll has expired
    if poll.expires_at and poll.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll has expired")

    # Verify option belongs to this poll
    option_result = await db.execute(
        select(PollOption).where(
            and_(PollOption.id == vote_data.option_id, PollOption.poll_id == poll_id)
        )
    )
    option = option_result.scalar_one_or_none()
    if not option:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid option for this poll"
        )

    # Check if user has already voted (only for logged-in users)
    if current_user:
        existing_vote_result = await db.execute(
            select(Vote).where(and_(Vote.poll_id == poll_id, Vote.user_id == current_user.id))
        )
        existing_vote = existing_vote_result.scalar_one_or_none()

        if existing_vote and not poll.allow_multiple_votes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="You have already voted on this poll"
            )

    # Create vote (user_id will be None for anonymous votes)
    new_vote = Vote(
        user_id=current_user.id if current_user else None,
        poll_id=poll_id,
        option_id=vote_data.option_id,
        ip_address=client_ip if not current_user else None
    )
    db.add(new_vote)
    await db.commit()
    await db.refresh(new_vote)

    # Create notification for poll owner (if voter is not the owner)
    if poll.owner_id != (current_user.id if current_user else None):
        from backend.models import Notification
        
        # Get the option text that was voted on
        option_result = await db.execute(
            select(PollOption).where(PollOption.id == vote_data.option_id)
        )
        voted_option = option_result.scalar_one_or_none()
        option_text = voted_option.option_text if voted_option else "an option"
        
        # Create natural notification message
        if current_user:
            notification_message = f"🗳️ {current_user.username} voted '{option_text}' on your poll '{poll.title}'"
        else:
            notification_message = f"🗳️ Someone (IP: {client_ip}) voted '{option_text}' on your poll '{poll.title}'"
        
        notification = Notification(
            user_id=poll.owner_id,
            poll_id=poll_id,
            message=notification_message,
            notification_type="vote",
            action_user_id=current_user.id if current_user else None,
            action_username=current_user.username if current_user else f"Anonymous (IP: {client_ip})",
            poll_title=poll.title,
            action_detail=option_text,
        )
        db.add(notification)
        await db.commit()

    # Check for new badges (only for logged-in users)
    if current_user:
        from backend.routers.badges import check_and_award_badges
        await check_and_award_badges(db, current_user)

    return new_vote


@router.put("/{poll_id}/vote", response_model=VoteResponse)
async def update_vote(
    poll_id: int,
    vote_data: VoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing vote (change selected option)"""
    poll = await get_poll_or_404(db, poll_id)

    # Check if poll is active
    if not poll.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll is not active")

    # Check if poll has expired
    if poll.expires_at and poll.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll has expired")

    # Verify option belongs to this poll
    option_result = await db.execute(
        select(PollOption).where(
            and_(PollOption.id == vote_data.option_id, PollOption.poll_id == poll_id)
        )
    )
    option = option_result.scalar_one_or_none()
    if not option:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid option for this poll"
        )

    # Find user's existing vote
    existing_vote_result = await db.execute(
        select(Vote).where(and_(Vote.poll_id == poll_id, Vote.user_id == current_user.id))
    )
    existing_vote = existing_vote_result.scalar_one_or_none()

    if not existing_vote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="You haven't voted on this poll yet"
        )

    # Update the vote
    existing_vote.option_id = vote_data.option_id
    existing_vote.voted_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(existing_vote)

    return existing_vote


@router.post("/{poll_id}/like", response_model=LikeResponse)
async def like_poll(
    poll_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Like/unlike a poll (supports anonymous likes if poll allows it)"""
    poll = await get_poll_or_404(db, poll_id)
    
    # Check if user is authenticated or poll allows anonymous likes
    if not current_user and not poll.allow_anonymous_likes:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. This poll does not allow anonymous likes."
        )

    # For anonymous users, we can't track individual likes (they can only view count)
    # So anonymous likes are not supported in the traditional sense
    # The checkbox is more about showing/hiding the like button for non-logged-in users
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Please sign in to like this poll"
        )

    # Check if user has already liked
    existing_like_result = await db.execute(
        select(Like).where(and_(Like.poll_id == poll_id, Like.user_id == current_user.id))
    )
    existing_like = existing_like_result.scalar_one_or_none()

    if existing_like:
        # Unlike
        await db.delete(existing_like)
        await db.commit()
        user_has_liked = False
    else:
        # Like
        new_like = Like(user_id=current_user.id, poll_id=poll_id)
        db.add(new_like)
        await db.commit()
        user_has_liked = True
        
        # Create notification for poll owner (if not owner liking their own poll)
        if poll.owner_id != current_user.id:
            from backend.models import Notification
            from datetime import datetime
            
            notification_message = f"❤️ {current_user.username} liked your poll '{poll.title}'"
            
            notification = Notification(
                user_id=poll.owner_id,
                poll_id=poll_id,
                message=notification_message,
                notification_type="like",
                is_read=False,
                created_at=datetime.utcnow(),
                action_user_id=current_user.id,
                action_username=current_user.username,
                poll_title=poll.title,
                action_detail="like",
            )
            db.add(notification)
            await db.commit()
        
        # Check for new badges (only when liking, not unliking)
        from backend.routers.badges import check_and_award_badges
        await check_and_award_badges(db, current_user)

    # Get updated like count
    like_count_result = await db.execute(
        select(func.count(Like.id)).where(Like.poll_id == poll_id)
    )
    like_count = like_count_result.scalar() or 0

    return LikeResponse(poll_id=poll_id, like_count=like_count, user_has_liked=user_has_liked)


@router.get("/{poll_id}/results", response_model=PollResults)
async def get_poll_results(poll_id: int, db: AsyncSession = Depends(get_db)):
    """Get poll results with vote counts and percentages"""
    poll = await get_poll_or_404(db, poll_id)

    # Get vote counts per option
    vote_counts_query = (
        select(
            PollOption.id,
            PollOption.text,
            PollOption.order,
            func.count(Vote.id).label("vote_count"),
        )
        .outerjoin(Vote, and_(Vote.option_id == PollOption.id, Vote.poll_id == poll_id))
        .where(PollOption.poll_id == poll_id)
        .group_by(PollOption.id, PollOption.text, PollOption.order)
        .order_by(PollOption.order)
    )

    vote_counts_result = await db.execute(vote_counts_query)
    option_results = vote_counts_result.all()

    # Calculate total votes
    total_votes = sum(row.vote_count for row in option_results)

    # Build result options
    result_options = []
    for row in option_results:
        percentage = (row.vote_count / total_votes * 100) if total_votes > 0 else 0
        result_options.append(
            PollResultOption(
                id=row.id, text=row.text, vote_count=row.vote_count, percentage=round(percentage, 2)
            )
        )

    # Get like count
    like_count_result = await db.execute(
        select(func.count(Like.id)).where(Like.poll_id == poll_id)
    )
    like_count = like_count_result.scalar() or 0

    return PollResults(
        poll_id=poll.id,
        title=poll.title,
        total_votes=total_votes,
        like_count=like_count,
        options=result_options,
        is_active=poll.is_active,
        created_at=poll.created_at,
        expires_at=poll.expires_at,
    )


@router.get("/ai/suggest-options", tags=["ai"])
async def get_ai_poll_suggestions(
    title: str = Query(..., description="Poll title"),
    description: Optional[str] = Query(None, description="Poll description"),
    num_options: int = Query(4, ge=2, le=10, description="Number of options to generate"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate AI-powered poll option suggestions using Google Gemini
    """
    from backend.ai_service import generate_poll_options
    
    try:
        options = await generate_poll_options(title, description, num_options)
        return {
            "title": title,
            "suggested_options": options,
            "count": len(options),
            "source": "gemini-ai"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI suggestions: {str(e)}"
        )
