# Fix Supabase Redirect URL Configuration

## The Issue

After Google OAuth, you're getting 401 Unauthorized errors because Supabase needs to process the OAuth callback and set session cookies before redirecting to your app.

## Solution

1. **Update Supabase Redirect URLs:**
   - Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
   - Under **Redirect URLs**, add:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/dashboard/servers`
     - `http://localhost:3000/dashboard/**` (wildcard for all dashboard routes)
   - Click **Save**

2. **The OAuth flow now works like this:**
   - User clicks "Continue with Google"
   - Google authenticates
   - Google redirects to Supabase callback
   - Supabase processes OAuth and sets cookies
   - Supabase redirects to `/auth/callback?next=/dashboard/servers`
   - Our callback handler exchanges code for session
   - Redirects to `/dashboard/servers` with cookies set

## Why This Works

The `/auth/callback` route:
- Receives the OAuth code from Supabase
- Exchanges it for a session server-side
- Sets cookies properly
- Then redirects to the dashboard

This ensures cookies are set before the dashboard tries to make API calls.

## Test It

1. Update Supabase redirect URLs (step 1 above)
2. Try Google sign-in again
3. You should be redirected to `/dashboard/servers` with working authentication!

