"""
Test database models
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import User, Poll, PollOption, Vote, Like
from backend.auth import get_password_hash


@pytest.mark.asyncio
async def test_create_user(db_session: AsyncSession):
    """Test creating a user"""
    user = User(
        username="modeltest",
        email="model@example.com",
        hashed_password=get_password_hash("TestPass123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.id is not None
    assert user.username == "modeltest"
    assert user.is_active is True


@pytest.mark.asyncio
async def test_create_poll(db_session: AsyncSession, test_user: User):
    """Test creating a poll"""
    poll = Poll(title="Test Poll", description="Test Description", owner_id=test_user.id)
    db_session.add(poll)
    await db_session.commit()
    await db_session.refresh(poll)

    assert poll.id is not None
    assert poll.title == "Test Poll"
    assert poll.owner_id == test_user.id


@pytest.mark.asyncio
async def test_create_poll_option(db_session: AsyncSession, test_user: User):
    """Test creating poll options"""
    poll = Poll(title="Test Poll", owner_id=test_user.id)
    db_session.add(poll)
    await db_session.flush()

    option = PollOption(poll_id=poll.id, text="Option 1", order=0)
    db_session.add(option)
    await db_session.commit()
    await db_session.refresh(option)

    assert option.id is not None
    assert option.text == "Option 1"
    assert option.poll_id == poll.id


@pytest.mark.asyncio
async def test_create_vote(db_session: AsyncSession, test_user: User):
    """Test creating a vote"""
    poll = Poll(title="Test Poll", owner_id=test_user.id)
    db_session.add(poll)
    await db_session.flush()

    option = PollOption(poll_id=poll.id, text="Option 1", order=0)
    db_session.add(option)
    await db_session.flush()

    vote = Vote(user_id=test_user.id, poll_id=poll.id, option_id=option.id)
    db_session.add(vote)
    await db_session.commit()
    await db_session.refresh(vote)

    assert vote.id is not None
    assert vote.user_id == test_user.id
    assert vote.poll_id == poll.id
    assert vote.option_id == option.id


@pytest.mark.asyncio
async def test_create_like(db_session: AsyncSession, test_user: User):
    """Test creating a like"""
    poll = Poll(title="Test Poll", owner_id=test_user.id)
    db_session.add(poll)
    await db_session.flush()

    like = Like(user_id=test_user.id, poll_id=poll.id)
    db_session.add(like)
    await db_session.commit()
    await db_session.refresh(like)

    assert like.id is not None
    assert like.user_id == test_user.id
    assert like.poll_id == poll.id


@pytest.mark.asyncio
async def test_cascade_delete_poll(db_session: AsyncSession, test_user: User):
    """Test cascade delete of poll"""
    poll = Poll(title="Test Poll", owner_id=test_user.id)
    db_session.add(poll)
    await db_session.flush()

    option = PollOption(poll_id=poll.id, text="Option 1", order=0)
    db_session.add(option)
    await db_session.flush()

    vote = Vote(user_id=test_user.id, poll_id=poll.id, option_id=option.id)
    db_session.add(vote)
    await db_session.commit()

    # Delete poll
    await db_session.delete(poll)
    await db_session.commit()

    # Verify cascade delete worked (vote and option should be deleted)
    from sqlalchemy import select

    vote_check = await db_session.execute(select(Vote).where(Vote.poll_id == poll.id))
    assert vote_check.scalar_one_or_none() is None

    option_check = await db_session.execute(
        select(PollOption).where(PollOption.poll_id == poll.id)
    )
    assert option_check.scalar_one_or_none() is None
