# API Documentation

## Base URL

- Development: `http://localhost:8000`
- Production: `https://your-domain.com`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_token>
```

## Rate Limiting

- Default: 60 requests per minute per IP
- Configurable via `RATE_LIMIT_PER_MINUTE` environment variable

## Response Format

### Success Response

```json
{
  "id": 1,
  "data": {...}
}
```

### Error Response

```json
{
  "detail": "Error message"
}
```

## Endpoints

### Authentication

#### POST /api/users/register

Register a new user.

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (min 8 chars, must contain letter and digit)"
}
```

**Response:** 201 Created
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "is_active": true,
  "is_admin": false,
  "created_at": "2025-10-27T12:00:00"
}
```

#### POST /api/users/login

Authenticate and receive JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** 200 OK
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### GET /api/users/me

Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "is_active": true,
  "is_admin": false,
  "created_at": "2025-10-27T12:00:00"
}
```

### Polls

#### POST /api/polls

Create a new poll (requires authentication).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (3-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "allow_multiple_votes": false,
  "expires_at": "2025-12-31T23:59:59 (optional)",
  "options": [
    {"text": "Option 1", "order": 0},
    {"text": "Option 2", "order": 1}
  ]
}
```

**Response:** 201 Created

#### GET /api/polls

List all polls.

**Query Parameters:**
- `skip` (int, default: 0) - Number of polls to skip
- `limit` (int, default: 50, max: 100) - Number of polls to return
- `active_only` (bool, default: true) - Only return active polls

**Response:** 200 OK
```json
[
  {
    "id": 1,
    "title": "Poll Title",
    "description": "Description",
    "owner_id": 1,
    "is_active": true,
    "created_at": "2025-10-27T12:00:00",
    "total_votes": 42,
    "like_count": 10,
    "option_count": 3
  }
]
```

#### GET /api/polls/{poll_id}

Get detailed poll information.

**Headers:** `Authorization: Bearer <token>` (optional)

**Response:** 200 OK

#### PUT /api/polls/{poll_id}

Update a poll (owner only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "is_active": true,
  "expires_at": "2025-12-31T23:59:59 (optional)"
}
```

**Response:** 200 OK

#### DELETE /api/polls/{poll_id}

Delete a poll (owner only).

**Headers:** `Authorization: Bearer <token>`

**Response:** 204 No Content

#### POST /api/polls/{poll_id}/vote

Vote on a poll (requires authentication, one vote per user unless multiple votes allowed).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "option_id": 1
}
```

**Response:** 201 Created

#### POST /api/polls/{poll_id}/like

Like or unlike a poll (requires authentication).

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "poll_id": 1,
  "like_count": 11,
  "user_has_liked": true
}
```

#### GET /api/polls/{poll_id}/results

Get poll results with vote counts and percentages.

**Response:** 200 OK
```json
{
  "poll_id": 1,
  "title": "Poll Title",
  "total_votes": 100,
  "like_count": 10,
  "options": [
    {
      "id": 1,
      "text": "Option 1",
      "vote_count": 42,
      "percentage": 42.0
    },
    {
      "id": 2,
      "text": "Option 2",
      "vote_count": 58,
      "percentage": 58.0
    }
  ],
  "is_active": true,
  "created_at": "2025-10-27T12:00:00",
  "expires_at": null
}
```

### WebSocket

#### WS /ws/polls/{poll_id}/results

Real-time poll results updates via WebSocket.

**Connection:** `ws://localhost:8000/ws/polls/{poll_id}/results`

**Messages:** Automatically receives poll result updates every 5 seconds

### Monitoring

#### GET /health

Application health check.

**Response:** 200 OK
```json
{
  "status": "healthy",
  "database": "healthy",
  "timestamp": "2025-10-27T12:00:00"
}
```

#### GET /metrics

Prometheus metrics endpoint.

**Response:** 200 OK (Prometheus format)

#### GET /admin/stats

Admin statistics (requires Basic Auth).

**Headers:** `Authorization: Basic <base64(admin:password)>`

**Response:** 200 OK
```json
{
  "users": 100,
  "polls": 50,
  "votes": 500,
  "likes": 200,
  "timestamp": "2025-10-27T12:00:00"
}
```

## Error Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/polls/1/results');
```

### Receiving Updates

```javascript
ws.onmessage = (event) => {
  const results = JSON.parse(event.data);
  // Update UI with new results
};
```

### Connection Management

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
  // Implement reconnection logic
};
```
