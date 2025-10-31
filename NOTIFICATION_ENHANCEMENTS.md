# Enhanced Notification System

## Overview
The notification system has been upgraded to provide detailed information about each activity on your polls. Users can now see comprehensive details about votes, likes, comments, replies, and comment votes.

## What's New

### 1. Detailed Notification Information
Each notification now includes:
- **Action User**: Who performed the action (username or "Anonymous")
- **Poll Title**: Which poll the action was on
- **Action Detail**: Specific details (vote choice, upvote/downvote, etc.)
- **Comment ID**: Link to the specific comment (for comment-related notifications)

### 2. Visual Improvements
- **Icons**: Each notification type has a distinct emoji icon:
  - 🗳️ Poll vote
  - ❤️ Poll like
  - 💬 New comment
  - ↩️ Reply to comment
  - 👍 Comment vote (like/dislike)
  
- **Structured Layout**: Notifications show:
  - Icon on the left
  - Main message
  - Detailed information in colored badges
  - Timestamp ("2 minutes ago", etc.)

### 3. Notification Types

#### Poll Vote Notification
```
🗳️ algsoch1 voted on your poll
From: algsoch1 • Poll: What's your favorite color? • Voted: Blue
2 minutes ago
```

#### Poll Like Notification
```
❤️ john123 liked your poll
From: john123 • Poll: What's your favorite color? • Action: like
5 minutes ago
```

#### Comment Notification
```
💬 sarah_dev commented on your poll
From: sarah_dev • Poll: What's your favorite color?
"I think blue is the best choice because..."
10 minutes ago
```

#### Reply Notification
```
↩️ mike_user replied to your comment
From: mike_user • Poll: What's your favorite color?
"I agree with you! Blue is amazing..."
15 minutes ago
```

#### Comment Vote Notification
```
👍 alice789 liked your comment
From: alice789 • Poll: What's your favorite color? • Action: 👍 Liked
20 minutes ago
```

## Technical Details

### Database Changes (Migration 006)
New fields added to `notifications` table:
- `action_user_id` - ID of user who performed the action
- `action_username` - Username (for display, includes anonymous info)
- `comment_id` - Related comment ID (nullable)
- `poll_title` - Poll title for context
- `action_detail` - Specific action details

### Backend Changes
1. **Comment Votes**: Now create notifications when someone upvotes/downvotes your comment
2. **Enhanced Context**: All notifications include poll title and action user info
3. **Anonymous Support**: Shows "Anonymous (IP: xxx)" for anonymous actions

### Frontend Changes
1. **getNotificationIcon()**: Returns appropriate emoji for each type
2. **getNotificationDetails()**: Formats detailed info into badges
3. **Enhanced CSS**: New styles for notification icons, badges, and layout

## Benefits

### For Poll Owners
- See exactly who interacted with your poll
- Know which option they voted for
- Track engagement on specific comments

### For Comment Authors
- Get notified when someone votes on your comment
- See if they liked or disliked it
- Know who replied to you

### For All Users
- Better context with poll titles
- Quick visual scanning with icons
- Detailed information at a glance

## Usage

1. **View Notifications**: Click the bell icon (🔔) in the header
2. **See Details**: Each notification shows:
   - Who did what
   - On which poll
   - What specific action
3. **Navigate**: Click any notification to jump to that poll
4. **Mark Read**: Notifications are auto-marked as read when clicked
5. **Clear All**: Use "Mark all as read" to clear unread badge

## Examples

### Scenario 1: Someone votes on your poll
Before:
```
🗳️ Someone voted on your poll 'Favorite Color'
```

After:
```
🗳️ algsoch1 voted 'Blue' on your poll 'Favorite Color'
From: algsoch1 • Poll: Favorite Color • Voted: Blue
```

### Scenario 2: Someone likes your comment
Before:
```
(No notification)
```

After:
```
👍 sarah_dev liked your comment: "Blue is the best..."
From: sarah_dev • Poll: Favorite Color • Action: 👍 Liked
```

### Scenario 3: Anonymous user comments
Before:
```
💬 Someone commented on 'Favorite Color'
```

After:
```
💬 Someone (IP: 192.168.1.1) commented on 'Favorite Color': "I prefer red..."
From: Anonymous (IP: 192.168.1.1) • Poll: Favorite Color
```

## Future Enhancements

Possible future additions:
- Filter notifications by type
- Group similar notifications ("3 people liked your comment")
- Email notifications for important activities
- Push notifications for real-time updates
- Notification preferences (mute certain types)

## Migration

To apply these changes to your database:
```bash
python apply_migration_006.py
```

Or if using Alembic:
```bash
alembic upgrade head
```

## Compatibility

- ✅ Works with existing notifications (old ones show less detail)
- ✅ Backward compatible (no breaking changes)
- ✅ Supports both authenticated and anonymous users
- ✅ Works on all screen sizes (responsive design)
