# Anonymous Voting Feature

## Overview
The QuickPoll application now supports anonymous voting, allowing poll creators to enable voting without requiring users to sign in.

## Features Implemented

### 1. Poll Statistics Dashboard
- **Total Polls**: Shows the total number of polls created
- **Active Polls**: Number of currently active polls
- **Closed Polls**: Number of closed polls
- Displayed on the home page alongside visitor and user statistics

### 2. Anonymous Voting
Poll creators can now enable anonymous voting when creating a poll:
- **Checkbox Option**: "Allow anyone to vote (no login required)"
- When enabled, visitors can vote without signing in
- Anonymous votes are recorded with a NULL user_id
- Works with both single and multiple vote options

### 3. Closed Poll Editing
- Poll owners can now edit closed polls
- Edit button appears for all polls owned by the user
- Allows updating poll details even after closing

## Database Changes

### New Column: `polls.allow_anonymous_votes`
- Type: Boolean
- Default: false
- Purpose: Enables/disables anonymous voting for the poll

### Modified Column: `votes.user_id`
- Changed from NOT NULL to nullable
- Allows anonymous votes to be recorded
- Removed unique constraint to support anonymous voting with multiple votes enabled

## API Changes

### Poll Creation
**POST /api/polls**
- New field: `allow_anonymous_votes: boolean`
- Example:
```json
{
  "title": "Favorite Color",
  "description": "Vote for your favorite color",
  "allow_anonymous_votes": true,
  "options": [...]
}
```

### Poll Response
**GET /api/polls/{poll_id}**
- Returns `allow_anonymous_votes` field
- Frontend uses this to determine if login is required

### Voting
**POST /api/polls/{poll_id}/vote**
- Authorization header is now optional
- If poll allows anonymous votes, no authentication required
- If poll requires login and user not authenticated, returns 401

### Statistics
**GET /api/stats/polls**
- New endpoint returning:
  - `total_polls`: Total number of polls
  - `active_polls`: Number of active polls  
  - `closed_polls`: Number of closed polls
  - `timestamp`: Current server time

## Frontend Changes

### Create Poll Form
- Added checkbox for "Allow anyone to vote (no login required)"
- Helper text explains the feature
- Checkbox value is sent with poll creation request

### Poll Detail View
- Shows "Submit Vote" button for:
  - Logged-in users (always)
  - Anonymous users (only if poll allows anonymous votes)
- Login prompt only shown if poll requires authentication
- Supports voting without authentication when allowed

### Statistics Display
- Upgraded from 4 to 6 statistics cards
- Added: Total Polls, Active Polls, Closed Polls
- Real-time updates from backend API

## Usage Examples

### Creating an Anonymous Poll
1. Click "Create New Poll"
2. Fill in poll details
3. Check "Allow anyone to vote (no login required)"
4. Submit

### Voting Anonymously
1. View a poll that allows anonymous voting
2. Select an option
3. Click "Submit Vote" (no login required)
4. Vote is recorded with NULL user_id

### Viewing Statistics
1. Navigate to home page
2. View statistics dashboard
3. See total, active, and closed poll counts

## Security Considerations

- Anonymous votes cannot be traced back to users
- Duplicate vote prevention:
  - For logged-in users: Based on user_id + poll_id + option_id
  - For anonymous users: Not enforced (unless future IP tracking implemented)
- Poll creators can still restrict voting to logged-in users (default)

## Migration

Run the migration to add support for anonymous voting:
```bash
python apply_migration.py
```

This will:
1. Add `allow_anonymous_votes` column to polls table
2. Make `user_id` nullable in votes table
3. Drop the unique constraint on votes

## Testing

Test the following scenarios:
1. ✅ Create poll with anonymous voting enabled
2. ✅ Vote on anonymous poll without logging in
3. ✅ View poll statistics on home page
4. ✅ Edit a closed poll (as owner)
5. ✅ Create poll without anonymous voting (requires login to vote)
6. ✅ Multiple votes on anonymous poll (if enabled)
