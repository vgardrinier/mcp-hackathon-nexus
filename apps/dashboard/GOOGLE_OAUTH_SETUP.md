# Google OAuth Setup Guide

## Difficulty: ⭐ Easy (5-10 minutes)

Supabase has built-in Google OAuth support, so integration is very straightforward!

## Steps to Enable Google OAuth

### 1. Configure Google OAuth in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Google** in the list
3. Click **Enable**
4. You'll need to create a Google OAuth app (see below)

### 2. Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `https://<your-project-id>.supabase.co/auth/v1/callback`
   - For local dev: `http://localhost:3000/auth/v1/callback` (if needed)
7. Copy the **Client ID** and **Client Secret**

### 3. Add Credentials to Supabase

1. Back in Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. Paste:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)
3. Click **Save**

### 4. Done! 🎉

The code is already added to login and signup pages. Users can now:
- Click "Continue with Google" button
- Sign in/sign up with their Google account
- The trigger will automatically set up their user account

## How It Works

1. User clicks "Continue with Google"
2. Redirects to Google for authentication
3. Google redirects back to Supabase
4. Supabase creates user in `auth.users`
5. **Trigger automatically runs** → creates user row, installs servers
6. User is redirected to `/dashboard`

## Notes

- **No code changes needed** - the buttons are already added!
- The trigger (`handle_new_user`) will automatically set up users who sign in via Google
- Works for both signup and login (Google handles both cases)
- Email confirmation is not required for OAuth users

## Testing

1. Make sure Google OAuth is enabled in Supabase
2. Go to `/login` or `/signup`
3. Click "Continue with Google"
4. Sign in with your Google account
5. You should be redirected to `/dashboard`

That's it! Very simple thanks to Supabase's built-in OAuth support.

