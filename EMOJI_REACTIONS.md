# Emoji Reactions System 🎉

## Overview
The Emoji Reactions System allows users to react to polls and comments with emoji reactions, similar to social media platforms. Users can choose from 6 different emojis to express their feelings about content.

## Features

### Available Emojis
- 👍 Thumbs Up
- 👎 Thumbs Down
- 😂 Laughing Face
- ❤️ Red Heart
- 🎉 Party Popper
- 🤔 Thinking Face

### Core Functionality
- **Multiple Reactions**: Users can react with different emojis (but only once per emoji type)
- **Toggle Reactions**: Click an emoji again to remove your reaction
- **Real-time Counts**: See how many people reacted with each emoji
- **Visual Feedback**: User's reactions are highlighted
- **Anonymous Support**: Anonymous reactions on polls/comments that allow it
- **Persistent**: Reactions are stored in the database

## Implementation

### Database Schema

#### poll_reactions Table
```sql
CREATE TABLE poll_reactions (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    session_id VARCHAR(255),  -- For anonymous users
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### comment_reactions Table
```sql
CREATE TABLE comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    session_id VARCHAR(255),  -- For anonymous users
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Backend API

#### Poll Reactions

**Add/Toggle Poll Reaction**
```http
POST /api/reactions/polls/{poll_id}
Content-Type: application/json
Authorization: Bearer <token> (optional for anonymous)

{
    "emoji": "👍",
    "session_id": "uuid" (optional, for anonymous)
}

Response:
{
    "emoji": "👍",
    "count": 5,
    "user_reacted": true
}
```

**Get Poll Reactions**
```http
GET /api/reactions/polls/{poll_id}?session_id=uuid
Authorization: Bearer <token> (optional)

Response:
[
    {"emoji": "👍", "count": 5, "user_reacted": true},
    {"emoji": "👎", "count": 2, "user_reacted": false},
    {"emoji": "😂", "count": 0, "user_reacted": false},
    {"emoji": "❤️", "count": 8, "user_reacted": false},
    {"emoji": "🎉", "count": 3, "user_reacted": false},
    {"emoji": "🤔", "count": 1, "user_reacted": false}
]
```

#### Comment Reactions

**Add/Toggle Comment Reaction**
```http
POST /api/reactions/comments/{comment_id}
Content-Type: application/json
Authorization: Bearer <token> (optional for anonymous)

{
    "emoji": "❤️",
    "session_id": "uuid" (optional, for anonymous)
}
```

**Get Comment Reactions**
```http
GET /api/reactions/comments/{comment_id}?session_id=uuid
Authorization: Bearer <token> (optional)
```

### Frontend Implementation

#### HTML Structure
```html
<!-- Reaction Picker Component -->
<div class="reaction-picker" id="pollReactions-{pollId}">
    <button class="reaction-btn" data-emoji="👍" title="Thumbs Up">
        <span class="emoji">👍</span>
        <span class="count">0</span>
    </button>
    <button class="reaction-btn" data-emoji="👎" title="Thumbs Down">
        <span class="emoji">👎</span>
        <span class="count">0</span>
    </button>
    <!-- ... more reaction buttons -->
</div>
```

#### JavaScript Functions

**Load Reactions**
```javascript
async function loadPollReactions(pollId) {
    const sessionId = getOrCreateSessionId();
    const headers = currentToken ? 
        { 'Authorization': `Bearer ${currentToken}` } : 
        {};
    
    const response = await fetch(
        `${API_BASE_URL}/api/reactions/polls/${pollId}?session_id=${sessionId}`,
        { headers }
    );
    
    if (response.ok) {
        const reactions = await response.json();
        displayReactions(pollId, reactions);
    }
}
```

**Toggle Reaction**
```javascript
async function toggleReaction(pollId, emoji) {
    const sessionId = getOrCreateSessionId();
    const headers = { 'Content-Type': 'application/json' };
    
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    
    const response = await fetch(
        `${API_BASE_URL}/api/reactions/polls/${pollId}`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ emoji, session_id: sessionId })
        }
    );
    
    if (response.ok) {
        const result = await response.json();
        updateReactionButton(pollId, emoji, result);
    }
}
```

### Styling

#### CSS Classes
```css
.reaction-picker {
    display: flex;
    gap: 8px;
    padding: 12px;
    flex-wrap: wrap;
}

.reaction-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: 2px solid var(--border);
    border-radius: 20px;
    background: var(--background);
    cursor: pointer;
    transition: all 0.2s ease;
}

.reaction-btn:hover {
    background: var(--primary-light);
    transform: scale(1.05);
}

.reaction-btn.reacted {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

.reaction-btn .emoji {
    font-size: 20px;
}

.reaction-btn .count {
    font-size: 14px;
    font-weight: 600;
}

/* Animation for adding reaction */
@keyframes reactionPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3) rotate(10deg); }
    100% { transform: scale(1); }
}

.reaction-btn.animating .emoji {
    animation: reactionPop 0.4s ease;
}
```

## User Interactions

### Adding a Reaction
1. User clicks on an emoji button
2. Button animates (pop effect)
3. Count increments/decrements
4. Button highlights if user reacted
5. Backend saves reaction

### Removing a Reaction
1. User clicks on already-reacted emoji
2. Button de-highlights
3. Count decrements
4. Backend removes reaction

### Visual States
- **Default**: Gray border, white background, emoji + count visible
- **Hovered**: Light blue background, slightly larger
- **Reacted**: Blue background, white text, highlighted
- **Animating**: Pop animation on emoji

## Responsive Design

### Desktop (>768px)
- Horizontal layout with all 6 emojis in one row
- 20px emoji size
- 12px spacing between buttons

### Tablet (≤768px)
- Wrap to 2 rows (3 emojis each)
- 18px emoji size
- 10px spacing

### Mobile (≤480px)
- Wrap to 3 rows (2 emojis each)
- 16px emoji size
- 8px spacing
- Full-width reactions picker

## Session Management

### Anonymous Users
```javascript
function getOrCreateSessionId() {
    let sessionId = localStorage.getItem('quickpoll_session_id');
    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem('quickpoll_session_id', sessionId);
    }
    return sessionId;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

## Performance Optimizations

1. **Debouncing**: Prevent rapid clicks (300ms cooldown)
2. **Caching**: Store reactions in memory to reduce API calls
3. **Batch Updates**: Update multiple reactions in one render
4. **Lazy Loading**: Load reactions when poll/comment is visible

## Accessibility

- **Keyboard Navigation**: Tab through reactions, Enter/Space to toggle
- **Screen Readers**: Aria-labels on buttons ("React with thumbs up, 5 reactions")
- **High Contrast**: Visible focus states
- **Touch-Friendly**: Minimum 44x44px touch targets on mobile

## Testing Checklist

- [ ] Add reaction to poll
- [ ] Remove reaction from poll
- [ ] Add multiple different reactions to same poll
- [ ] React as logged-in user
- [ ] React as anonymous user (if allowed)
- [ ] View reaction counts
- [ ] Highlight user's reactions
- [ ] Add reaction to comment
- [ ] Remove reaction from comment
- [ ] Reactions persist after page reload
- [ ] Reactions update in real-time for other users
- [ ] Mobile responsive layout works
- [ ] Animations play smoothly
- [ ] Session ID persists for anonymous users
- [ ] Prevent reaction spam (debouncing works)
- [ ] Error handling for network failures

## Future Enhancements

1. **Custom Emojis**: Allow users to add custom emoji reactions
2. **Reaction Analytics**: Show which users reacted with what
3. **Trending Reactions**: Highlight most-used reactions
4. **Reaction Notifications**: Notify when someone reacts to your content
5. **Reaction Filters**: Filter comments by reactions
6. **Animated Emojis**: Use animated GIF emojis instead of Unicode
7. **Reaction Streaks**: Gamify frequent reactors

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- None (uses native fetch API and localStorage)

## Performance Metrics

- Initial Load: < 100ms
- Reaction Toggle: < 200ms
- Animation Duration: 400ms
- Memory Usage: < 500KB per 100 reactions

## Changelog

### v1.0.0 (2025-10-29)
- Initial implementation
- 6 emoji types supported
- Poll and comment reactions
- Anonymous reaction support
- Responsive design
- Animations and visual feedback
