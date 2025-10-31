# ✅ Google OAuth Quick Start Checklist

Follow these steps to enable Google Sign-In for QuickPoll:

## ☑️ Step 1: Google Cloud Console Setup (15 minutes)

- [ ] Go to https://console.cloud.google.com/
- [ ] Create new project named "QuickPoll"
- [ ] Enable "Google+ API" in APIs & Services → Library
- [ ] Configure OAuth consent screen:
  - [ ] Select "External"
  - [ ] Fill in app name: "QuickPoll"
  - [ ] Add your email as support email
  - [ ] Add scopes: openid, email, profile
- [ ] Create OAuth 2.0 credentials:
  - [ ] Type: Web application
  - [ ] Name: "QuickPoll Web Client"
  - [ ] Add redirect URI: `http://localhost:8000/api/users/auth/google/callback`
- [ ] Copy Client ID → Save it!
- [ ] Copy Client Secret → Save it!

## ☑️ Step 2: Update Environment Variables (2 minutes)

- [ ] Open your `.env` file
- [ ] Add these three lines:
```
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/users/auth/google/callback
```
- [ ] Replace `your_client_id_here` with actual Client ID
- [ ] Replace `your_client_secret_here` with actual Client Secret
- [ ] Save the `.env` file

## ☑️ Step 3: Already Done! ✅

These steps are already complete:
- ✅ Dependencies installed (`authlib`)
- ✅ Database migration applied (OAuth fields added)
- ✅ Backend endpoints created
- ✅ Frontend buttons added
- ✅ OAuth flow implemented

## ☑️ Step 4: Test It! (3 minutes)

- [ ] Make sure your backend server is running:
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

- [ ] Open frontend in browser: `http://localhost:3000`
- [ ] Click "Login" button
- [ ] You should see "Continue with Google" button
- [ ] Click it!
- [ ] Sign in with your Google account
- [ ] Approve permissions
- [ ] You should be redirected back and logged in! 🎉

## 🎯 Expected Results

### ✅ Success Signs:
- Green notification: "Successfully signed in with Google!"
- Your name appears in the header
- You can create polls
- Profile picture loaded (if you have one on Google)

### ❌ Common Issues:

**"redirect_uri_mismatch"**
- Solution: Make sure redirect URI in Google Console matches exactly: `http://localhost:8000/api/users/auth/google/callback`

**"Client ID not provided"**
- Solution: Double-check `.env` file has `GOOGLE_CLIENT_ID` set
- Restart your backend server after changing `.env`

**"Access blocked: This app's request is invalid"**
- Solution: Enable Google+ API in Google Cloud Console

## 📚 Documentation

For detailed help, see:
- `GOOGLE_OAUTH_SETUP.md` - Complete setup guide
- `GOOGLE_OAUTH_IMPLEMENTATION.md` - Technical details
- `GOOGLE_OAUTH_VISUAL_GUIDE.md` - Visual walkthrough

## 🚀 Production Deployment

When deploying to production:
- [ ] Update `GOOGLE_REDIRECT_URI` to production URL
- [ ] Add production redirect URI to Google Console
- [ ] Update `ALLOWED_ORIGINS` in `.env`
- [ ] Ensure HTTPS is enabled
- [ ] Test OAuth flow on production

## 🎉 You're Done!

Once the checklist is complete, your users can:
- ✅ Sign in with one click using Google
- ✅ No password needed
- ✅ Automatic account creation
- ✅ Verified email addresses
- ✅ Profile pictures synced

Enjoy your new Google OAuth integration! 🎊
