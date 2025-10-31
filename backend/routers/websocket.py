"""
WebSocket endpoint for real-time poll results
"""

import asyncio
import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.routers.polls import get_poll_or_404, get_poll_results

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        # poll_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, poll_id: int):
        """Connect a client to a poll's updates"""
        await websocket.accept()
        if poll_id not in self.active_connections:
            self.active_connections[poll_id] = set()
        self.active_connections[poll_id].add(websocket)

    def disconnect(self, websocket: WebSocket, poll_id: int):
        """Disconnect a client from a poll's updates"""
        if poll_id in self.active_connections:
            self.active_connections[poll_id].discard(websocket)
            if not self.active_connections[poll_id]:
                del self.active_connections[poll_id]

    async def broadcast(self, poll_id: int, message: str):
        """Broadcast a message to all clients watching a poll"""
        if poll_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[poll_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    disconnected.append(connection)

            # Clean up disconnected clients
            for conn in disconnected:
                self.disconnect(conn, poll_id)


manager = ConnectionManager()


@router.websocket("/ws/polls/{poll_id}/results")
async def websocket_poll_results(websocket: WebSocket, poll_id: int):
    """WebSocket endpoint for live poll results"""
    # Get database session
    db_gen = get_db()
    db: AsyncSession = await anext(db_gen)

    try:
        # Verify poll exists
        await get_poll_or_404(db, poll_id)

        # Connect client
        await manager.connect(websocket, poll_id)

        # Send initial results
        results = await get_poll_results(poll_id, db)
        await websocket.send_text(results.model_dump_json())

        # Keep connection alive and send updates periodically
        try:
            while True:
                # Wait for messages (to detect disconnection)
                # or send updates every 5 seconds
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                except asyncio.TimeoutError:
                    # Send updated results
                    results = await get_poll_results(poll_id, db)
                    await websocket.send_text(results.model_dump_json())

        except WebSocketDisconnect:
            manager.disconnect(websocket, poll_id)

    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass

    finally:
        manager.disconnect(websocket, poll_id)
        try:
            await db.close()
        except Exception:
            pass


async def notify_poll_update(poll_id: int, db: AsyncSession):
    """Notify all connected clients about a poll update"""
    try:
        results = await get_poll_results(poll_id, db)
        await manager.broadcast(poll_id, results.model_dump_json())
    except Exception as e:
        print(f"Error broadcasting poll update: {e}")
