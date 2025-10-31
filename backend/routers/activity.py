"""Activity Feed Router - Live activity feed of recent actions"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from typing import List, Optional
from datetime import datetime, timedelta
from ..database import get_db
from ..models import Poll, Vote, Comment, User
from pydantic import BaseModel

router = APIRouter(prefix="/api/activity", tags=["activity"])

# Response Models
class ActivityUser(BaseModel):
    id: int
    username: str

class ActivityPoll(BaseModel):
    id: int
    title: str

class ActivityItem(BaseModel):
    id: str
    activity_type: str  # poll_created, vote_cast, comment_posted, poll_trending
    user: Optional[ActivityUser]
    poll: ActivityPoll
    timestamp: datetime
    metadata: dict

    class Config:
        from_attributes = True

@router.get("/feed", response_model=List[ActivityItem])
async def get_activity_feed(
    activity_filter: str = Query("all", description="Filter: all, polls, votes, comments, trending"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get paginated activity feed with recent activities.
    
    Filters:
    - all: All activities
    - polls: Only new polls created
    - votes: Only votes cast
    - comments: Only comments posted
    - trending: Trending polls (most votes in last hour)
    """
    
    activities = []
    now = datetime.utcnow()
    
    # Get recent polls (created in last 24 hours)
    if activity_filter in ["all", "polls"]:
        recent_polls = db.query(Poll).filter(
            Poll.created_at >= now - timedelta(hours=24)
        ).order_by(desc(Poll.created_at)).limit(limit if activity_filter == "polls" else 10).all()
        
        for poll in recent_polls:
            activities.append({
                "id": f"poll_{poll.id}_{int(poll.created_at.timestamp())}",
                "activity_type": "poll_created",
                "user": {
                    "id": poll.user_id,
                    "username": poll.user.username
                } if poll.user else None,
                "poll": {
                    "id": poll.id,
                    "title": poll.title
                },
                "timestamp": poll.created_at,
                "metadata": {
                    "description": poll.description[:100] if poll.description else "",
                    "is_active": poll.is_active
                }
            })
    
    # Get recent votes (last 1 hour)
    if activity_filter in ["all", "votes"]:
        recent_votes = db.query(Vote).filter(
            Vote.created_at >= now - timedelta(hours=1)
        ).order_by(desc(Vote.created_at)).limit(limit if activity_filter == "votes" else 15).all()
        
        for vote in recent_votes:
            activities.append({
                "id": f"vote_{vote.id}_{int(vote.created_at.timestamp())}",
                "activity_type": "vote_cast",
                "user": {
                    "id": vote.user_id,
                    "username": vote.user.username
                } if vote.user_id and vote.user else None,
                "poll": {
                    "id": vote.poll_id,
                    "title": vote.poll.title
                },
                "timestamp": vote.created_at,
                "metadata": {
                    "option": vote.option
                }
            })
    
    # Get recent comments (last 2 hours)
    if activity_filter in ["all", "comments"]:
        recent_comments = db.query(Comment).filter(
            Comment.created_at >= now - timedelta(hours=2)
        ).order_by(desc(Comment.created_at)).limit(limit if activity_filter == "comments" else 10).all()
        
        for comment in recent_comments:
            activities.append({
                "id": f"comment_{comment.id}_{int(comment.created_at.timestamp())}",
                "activity_type": "comment_posted",
                "user": {
                    "id": comment.user_id,
                    "username": comment.user.username
                } if comment.user_id and comment.user else None,
                "poll": {
                    "id": comment.poll_id,
                    "title": comment.poll.title
                },
                "timestamp": comment.created_at,
                "metadata": {
                    "content": comment.content[:100],
                    "likes": comment.likes
                }
            })
    
    # Get trending polls (most votes in last hour)
    if activity_filter in ["all", "trending"]:
        trending_polls = db.query(
            Poll,
            func.count(Vote.id).label('vote_count')
        ).join(Vote).filter(
            Vote.created_at >= now - timedelta(hours=1),
            Poll.is_active == True
        ).group_by(Poll.id).order_by(desc('vote_count')).limit(5).all()
        
        for poll, vote_count in trending_polls:
            if vote_count >= 3:  # Only show if at least 3 votes
                activities.append({
                    "id": f"trending_{poll.id}_{int(datetime.utcnow().timestamp())}",
                    "activity_type": "poll_trending",
                    "user": {
                        "id": poll.user_id,
                        "username": poll.user.username
                    } if poll.user else None,
                    "poll": {
                        "id": poll.id,
                        "title": poll.title
                    },
                    "timestamp": datetime.utcnow(),
                    "metadata": {
                        "vote_count": vote_count,
                        "description": poll.description[:100] if poll.description else ""
                    }
                })
    
    # Sort all activities by timestamp (newest first)
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Apply pagination
    paginated_activities = activities[offset:offset + limit]
    
    return paginated_activities
