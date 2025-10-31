# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for QuickPoll.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "NEW PROJECT"
4. Enter project name: "QuickPoll" (or your preferred name)
5. Click "CREATE"

## Step 2: Enable Google+ API

1. In the Google Cloud Console, navigate to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and then click "ENABLE"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace account)
3. Click "CREATE"
4. Fill in the required information:
   - **App name**: QuickPoll
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click "SAVE AND CONTINUE"
6. On the "Scopes" page, click "ADD OR REMOVE SCOPES"
7. Add these scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
8. Click "UPDATE" then "SAVE AND CONTINUE"
9. Skip "Test users" and click "SAVE AND CONTINUE"
10. Review and click "BACK TO DASHBOARD"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Select "Web application"
4. Enter a name: "QuickPoll Web Client"
5. Add authorized redirect URIs:
   - **Development**: `http://localhost:8000/api/users/auth/google/callback`
   - **Production**: `https://your-domain.com/api/users/auth/google/callback`
6. Click "CREATE"
7. **IMPORTANT**: Copy the Client ID and Client Secret - you'll need these!

## Step 5: Update Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/users/auth/google/callback
```

Replace:
- `your_client_id_here` with your actual Client ID
- `your_client_secret_here` with your actual Client Secret

For production, update the redirect URI to match your domain:
```bash
GOOGLE_REDIRECT_URI=https://your-domain.com/api/users/auth/google/callback
```

## Step 6: Install Dependencies

The required dependencies are already in `requirements.txt`. Install them:

```bash
pip install -r requirements.txt
```

## Step 7: Run Database Migration

Apply the OAuth migration to add the necessary database fields:

```bash
python apply_migration.py
```

This will add:
- `oauth_provider` column (stores 'google', 'github', etc.)
- `oauth_id` column (stores provider's user ID)
- `profile_picture` column (stores profile image URL)
- Makes `hashed_password` nullable (OAuth users don't need passwords)

## Step 8: Start the Server

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## Step 9: Test the Integration

1. Open your browser to `http://localhost:3000` (or your frontend URL)
2. Click "Login" or "Sign up"
3. Click "Continue with Google"
4. You'll be redirected to Google's login page
5. Sign in with your Google account
6. Approve the permissions
7. You'll be redirected back to QuickPoll, now logged in!

## How It Works

### Backend Flow:

1. **Login Request**: User clicks "Continue with Google"
2. **Redirect to Google**: Frontend redirects to `/api/users/auth/google/login`
3. **Google Authentication**: User signs in with Google
4. **Callback**: Google redirects to `/api/users/auth/google/callback` with authorization code
5. **Token Exchange**: Backend exchanges code for user info
6. **User Creation/Login**: 
   - If user exists with this Google ID → log them in
   - If email exists but not linked → link Google account
   - If new user → create account automatically
7. **JWT Token**: Backend creates JWT token
8. **Frontend Redirect**: Redirects to frontend with token in URL
9. **Auto Login**: Frontend saves token and logs user in

### Security Features:

- ✅ OAuth 2.0 with PKCE flow
- ✅ Secure token storage
- ✅ Email verification by Google
- ✅ Automatic account linking
- ✅ No password needed for OAuth users

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure the redirect URI in Google Console exactly matches the one in your `.env`
- Check for trailing slashes - they must match exactly
- Verify you're using the correct port (8000 for backend)

### "Client secret not provided"
- Make sure `GOOGLE_CLIENT_SECRET` is set in your `.env` file
- Restart the server after updating `.env`

### "Failed to get user info from Google"
- Check that Google+ API is enabled in Google Cloud Console
- Verify the scopes are correctly set (openid, email, profile)

### Users can't link existing accounts
- Users with the same email can link their Google account
- If email is already linked to another OAuth provider, they'll get an error
- They can still use username/password login

## Production Deployment

For production:

1. Update `GOOGLE_REDIRECT_URI` to your production domain
2. Add the production redirect URI to Google Cloud Console
3. Set `ALLOWED_ORIGINS` in `.env` to include your frontend domain
4. Make sure your SSL certificate is valid (Google requires HTTPS for production)

## Additional OAuth Providers

The system is designed to support multiple OAuth providers. To add more:

1. Install the provider's library (if needed)
2. Register OAuth provider in `backend/routers/users.py`
3. Create login/callback endpoints following the Google pattern
4. Add provider button to frontend

Supported patterns:
- `oauth_provider`: 'google', 'github', 'facebook', etc.
- `oauth_id`: Provider's unique user ID
- `profile_picture`: User's profile image URL

## Support

If you encounter issues:
1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Make sure database migrations are applied
4. Test with a fresh Google account

## Security Notes

- Never commit your `.env` file with real credentials
- Keep your Client Secret secure
- Use HTTPS in production
- Regularly rotate your secrets
- Monitor OAuth usage in Google Cloud Console
