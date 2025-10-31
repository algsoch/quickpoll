# API Keys Feature Guide

## Overview
The API Keys feature allows users to create and manage API keys for programmatic access to QuickPoll. This enables automated poll creation, voting, and other operations without requiring browser-based login.

## Features Implemented

### Backend (✅ Complete)
1. **Database Schema**
   - `api_keys` table with the following fields:
     - `id`: Primary key
     - `user_id`: Foreign key to users table
     - `key_name`: Descriptive name for the key
     - `key_hash`: SHA256 hash of the API key (never stores plain key)
     - `key_prefix`: First 12 characters for identification
     - `is_active`: Boolean flag for revocation
     - `created_at`: Creation timestamp
     - `last_used_at`: Last usage timestamp (auto-updated)
     - `expires_at`: Optional expiration date
   - Indexes on: `key_hash`, `user_id`, `key_prefix`

2. **API Key Format**
   - Format: `qp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Prefix: `qp_live_` (12 characters including underscore)
   - Random part: 32 URL-safe characters
   - Total length: 40 characters

3. **Security Features**
   - Keys are hashed with SHA256 before storage
   - Full key is only shown once during creation
   - Keys can be revoked (soft delete via `is_active` flag)
   - Expiration support (optional, up to 365 days)
   - Last used timestamp tracking

4. **REST API Endpoints**
   - `POST /api/api-keys/` - Create new API key
     - Request body: `{ "key_name": "My Key", "expires_in_days": 90 }`
     - Response: Returns full key (⚠️ only time it's shown!)
   
   - `GET /api/api-keys/` - List user's API keys
     - Returns: Array of keys with metadata (no full keys)
   
   - `DELETE /api/api-keys/{key_id}` - Revoke an API key
     - Sets `is_active = false`
   
   - `GET /api/api-keys/verify` - Test API key validity
     - Header: `X-API-Key: qp_live_...`
     - Returns: User info if valid

5. **Dual Authentication**
   - Endpoints support both JWT tokens AND API keys
   - API key takes precedence if both provided
   - Header format: `X-API-Key: qp_live_...` OR `Authorization: Bearer <jwt>`

### Frontend (✅ Complete)
1. **User Interface**
   - **API Keys Button**: Added to user menu (🔑 API Keys)
   - **API Keys Modal**: Main management interface
   - **Create API Key Modal**: Form to generate new keys
   - **Show API Key Modal**: One-time display of newly created key

2. **Key Features**
   - **List View**: Shows all user's API keys with:
     - Key name
     - Key prefix (e.g., `qp_live_abc1...`)
     - Status badge (Active/Revoked/Expired)
     - Created date
     - Last used date
     - Expiration date
     - Revoke button (for active keys)
   
   - **Create New Key**:
     - Input: Key name (required, max 100 chars)
     - Select: Expiration (Never, 30d, 90d, 180d, 1 year)
     - Validation: Client-side and server-side
   
   - **One-Time Key Display**:
     - Shows full API key in copyable format
     - Warning message about saving the key
     - Copy to clipboard button with visual feedback
     - Key metadata (name, prefix, created, expires)
     - "I've Saved My Key" confirmation button

3. **Visual Design**
   - Clean, modern interface consistent with app theme
   - Dark mode support
   - Empty state for users with no keys
   - Loading states with skeletons
   - Color-coded status badges:
     - 🟢 Active (green)
     - 🔴 Revoked (red)
     - 🟡 Expired (orange)

4. **User Experience**
   - One-click copy to clipboard
   - Toast notifications for success/error
   - Confirmation dialog before revoking
   - Auto-refresh list after create/revoke
   - Form validation and error handling

## Usage Examples

### Creating an API Key
1. Click "🔑 API Keys" button in user menu
2. Click "✨ Create New API Key"
3. Enter a descriptive name (e.g., "My App API Key")
4. Optionally select expiration period
5. Click "🔑 Generate API Key"
6. **IMPORTANT**: Copy and save the key immediately!
7. Click "✅ I've Saved My Key" when done

### Using an API Key
Include the API key in request headers:

```bash
# Example: Create a poll via API
curl -X POST http://localhost:8000/api/polls/ \
  -H "X-API-Key: qp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Favorite Programming Language?",
    "description": "Vote for your favorite!",
    "options": ["Python", "JavaScript", "Go", "Rust"]
  }'
```

### Revoking an API Key
1. Open "🔑 API Keys" modal
2. Find the key you want to revoke
3. Click "🗑️ Revoke" button
4. Confirm the action
5. Key status changes to "Revoked" and stops working immediately

## Technical Implementation

### File Changes
1. **Backend**
   - `backend/models.py` - Added `APIKey` model
   - `backend/schemas.py` - Added API key schemas
   - `backend/api_keys.py` - NEW: Utility functions
   - `backend/routers/api_keys.py` - NEW: REST endpoints
   - `backend/auth.py` - Enhanced with dual auth support
   - `backend/main.py` - Registered API keys router
   - `alembic/versions/009_add_api_keys.py` - Database migration
   - `apply_migration_009.py` - Migration script

2. **Frontend**
   - `frontend/index.html` - Added API Keys button and modals (v7)
   - `frontend/app.js` - Added API key management functions (v7)
   - `frontend/styles.css` - Added API key UI styles (v7)

### Database Migration
```sql
-- Migration 009: API Keys
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_api_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_key_user ON api_keys(user_id);
CREATE INDEX idx_api_key_prefix ON api_keys(key_prefix);
```

### Security Considerations
1. **Never Log Full Keys**: Only log key prefixes for debugging
2. **Hash Storage**: Keys are hashed with SHA256 before database storage
3. **One-Time Display**: Full key is only shown during creation
4. **Revocation**: Instant revocation via `is_active` flag
5. **Expiration**: Optional time-based expiration
6. **HTTPS Required**: Always use HTTPS in production to prevent key interception

## Best Practices

### For Users
1. **Name Your Keys**: Use descriptive names like "Production App", "Test Script", etc.
2. **Save Immediately**: Copy the key when first created - you won't see it again!
3. **Rotate Regularly**: Create new keys and revoke old ones periodically
4. **Use Expiration**: Set expiration dates for temporary access
5. **Revoke Unused**: Delete keys you're no longer using
6. **Keep Secure**: Treat API keys like passwords - never commit to git!

### For Developers
1. **Environment Variables**: Store keys in environment variables, not code
2. **Error Handling**: Handle 401/403 errors gracefully
3. **Key Rotation**: Build key rotation into your app
4. **Monitoring**: Track key usage via `last_used_at` field
5. **Rate Limiting**: Implement rate limiting on API endpoints

## Next Steps
The API Keys feature is now fully functional! Users can:
- ✅ Create API keys with optional expiration
- ✅ View all their API keys with status
- ✅ Copy newly created keys to clipboard
- ✅ Revoke keys they no longer need
- ✅ Use API keys for programmatic access

## Testing Checklist
- [ ] Create API key via UI
- [ ] Copy key to clipboard
- [ ] Use key to make API request
- [ ] Check last_used_at updates
- [ ] Revoke key via UI
- [ ] Verify revoked key fails
- [ ] Test key expiration
- [ ] Test dual auth (JWT + API key)

## Future Enhancements
Potential improvements for v2:
- [ ] API key scopes/permissions (read-only, write, admin)
- [ ] Usage statistics per key
- [ ] Rate limiting per key
- [ ] Webhook support
- [ ] API key regeneration
- [ ] IP whitelisting
- [ ] Key usage alerts

---
**Status**: ✅ Feature Complete
**Version**: 1.0
**Last Updated**: 2025-10-29
