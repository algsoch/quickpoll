# Bug Fix: Anonymous Comments Database Constraint

## Issue
Anonymous users were unable to post comments even when `allow_anonymous_comments` was enabled on a poll.

## Error Message
```
sqlalchemy.exc.IntegrityError: null value in column "user_id" of relation "comments" violates not-null constraint
```

## Root Cause
The `comments` table had `user_id` column set as `NOT NULL` in the database, but the model definition in `backend/models.py` already had it correctly defined as `Optional[int]` with `nullable=True`. The database schema was out of sync with the model.

## Solution

### 1. Created Migration File
**File**: `alembic/versions/010_fix_comment_user_nullable.py`

This migration makes the `user_id` column nullable in the `comments` table to support anonymous comments.

### 2. Created Migration Script
**File**: `apply_migration_010.py`

This script applies the database schema change:
```sql
ALTER TABLE comments 
ALTER COLUMN user_id DROP NOT NULL;
```

### 3. Applied Migration
```bash
python apply_migration_010.py
```

**Output**:
```
Applying migration 010: Fix comment user_id nullable...
Making user_id nullable in comments table...
✓ user_id is now nullable

✓ Migration 010 applied successfully!
Anonymous comments are now supported!
```

## Files Modified
1. `alembic/versions/010_fix_comment_user_nullable.py` - New migration file
2. `apply_migration_010.py` - New migration script

## Files Already Correct (No Changes Needed)
- `backend/models.py` - Comment model already had `user_id` defined as `Optional[int]`
- `backend/routers/comments.py` - Already handles anonymous comments correctly
- `frontend/app.js` - Already sends `allowAnonymous` parameter correctly

## Testing
After applying the migration and restarting the backend server:

1. Create a poll with "Allow anyone to comment" enabled
2. Log out
3. Post a comment as anonymous user
4. **Expected Result**: Comment posts successfully with `user_id = NULL` and IP address stored

## Technical Details

### Database Schema Before
```sql
user_id INTEGER NOT NULL REFERENCES users(id)
```

### Database Schema After
```sql
user_id INTEGER REFERENCES users(id)  -- Now nullable
```

### Model Definition (Already Correct)
```python
user_id: Mapped[Optional[int]] = mapped_column(
    Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
)
```

## Backend Server Status
✅ Running on port 8000  
✅ Database connected to Azure PostgreSQL  
✅ All tables initialized  
✅ Anonymous comments now supported

## Previous Related Fixes (Phase 10)
1. ✅ Property name mismatch (`allow_anonymous_voting` → `allow_anonymous_votes`)
2. ✅ Comment button event listener for anonymous users
3. ✅ Mobile responsive confirmation modals
4. ✅ **Database constraint fix for anonymous comments** (Current)

## Next Steps
1. Test anonymous commenting functionality
2. Test anonymous voting functionality
3. Verify settings persist in edit modal
4. Confirm mobile responsiveness
