"""
Test poll endpoints
"""

import pytest
from httpx import AsyncClient
from backend.models import User


@pytest.mark.asyncio
async def test_create_poll(client: AsyncClient, auth_headers):
    """Test creating a poll"""
    response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Test Poll",
            "description": "This is a test poll",
            "allow_multiple_votes": False,
            "options": [
                {"text": "Option 1", "order": 0},
                {"text": "Option 2", "order": 1},
                {"text": "Option 3", "order": 2},
            ],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Poll"
    assert len(data["options"]) == 3


@pytest.mark.asyncio
async def test_create_poll_no_auth(client: AsyncClient):
    """Test creating poll without authentication"""
    response = await client.post(
        "/api/polls",
        json={
            "title": "Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_polls(client: AsyncClient):
    """Test listing polls"""
    response = await client.get("/api/polls")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_poll(client: AsyncClient, auth_headers):
    """Test getting a specific poll"""
    # Create a poll first
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll_id = create_response.json()["id"]

    # Get the poll
    response = await client.get(f"/api/polls/{poll_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == poll_id
    assert data["title"] == "Test Poll"


@pytest.mark.asyncio
async def test_vote_on_poll(client: AsyncClient, auth_headers):
    """Test voting on a poll"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Vote Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll = create_response.json()
    poll_id = poll["id"]
    option_id = poll["options"][0]["id"]

    # Vote
    vote_response = await client.post(
        f"/api/polls/{poll_id}/vote",
        headers=auth_headers,
        json={"option_id": option_id},
    )
    assert vote_response.status_code == 201


@pytest.mark.asyncio
async def test_vote_twice_on_poll(client: AsyncClient, auth_headers):
    """Test voting twice on the same poll (should fail)"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Double Vote Test",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll = create_response.json()
    poll_id = poll["id"]
    option_id = poll["options"][0]["id"]

    # First vote
    await client.post(
        f"/api/polls/{poll_id}/vote",
        headers=auth_headers,
        json={"option_id": option_id},
    )

    # Second vote
    second_vote = await client.post(
        f"/api/polls/{poll_id}/vote",
        headers=auth_headers,
        json={"option_id": option_id},
    )
    assert second_vote.status_code == 400


@pytest.mark.asyncio
async def test_like_poll(client: AsyncClient, auth_headers):
    """Test liking a poll"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Like Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll_id = create_response.json()["id"]

    # Like
    like_response = await client.post(f"/api/polls/{poll_id}/like", headers=auth_headers)
    assert like_response.status_code == 200
    data = like_response.json()
    assert data["user_has_liked"] is True
    assert data["like_count"] == 1


@pytest.mark.asyncio
async def test_unlike_poll(client: AsyncClient, auth_headers):
    """Test unliking a poll"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Unlike Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll_id = create_response.json()["id"]

    # Like
    await client.post(f"/api/polls/{poll_id}/like", headers=auth_headers)

    # Unlike
    unlike_response = await client.post(f"/api/polls/{poll_id}/like", headers=auth_headers)
    assert unlike_response.status_code == 200
    data = unlike_response.json()
    assert data["user_has_liked"] is False
    assert data["like_count"] == 0


@pytest.mark.asyncio
async def test_delete_poll(client: AsyncClient, auth_headers):
    """Test deleting a poll"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Delete Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll_id = create_response.json()["id"]

    # Delete
    delete_response = await client.delete(f"/api/polls/{poll_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    # Verify deleted
    get_response = await client.get(f"/api/polls/{poll_id}", headers=auth_headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_get_poll_results(client: AsyncClient, auth_headers):
    """Test getting poll results"""
    # Create a poll
    create_response = await client.post(
        "/api/polls",
        headers=auth_headers,
        json={
            "title": "Results Test Poll",
            "options": [{"text": "Option 1"}, {"text": "Option 2"}],
        },
    )
    poll_id = create_response.json()["id"]

    # Get results
    results_response = await client.get(f"/api/polls/{poll_id}/results")
    assert results_response.status_code == 200
    data = results_response.json()
    assert "options" in data
    assert "total_votes" in data
