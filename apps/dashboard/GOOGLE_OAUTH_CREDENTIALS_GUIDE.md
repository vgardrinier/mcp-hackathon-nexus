# How to Get Google OAuth Credentials

## Step-by-Step Guide

### 1. Go to Google Cloud Console

Visit: https://console.cloud.google.com/

Sign in with your Google account.

### 2. Create or Select a Project

- If you see a project dropdown at the top, click it
- Click **"New Project"** (or select an existing project)
- Enter project name: `Nexus MCP` (or any name you like)
- Click **"Create"**
- Wait for project creation (takes a few seconds)

### 3. Enable Google+ API (if needed)

- In the left sidebar, go to **"APIs & Services"** → **"Library"**
- Search for **"Google+ API"** or **"Google Identity"**
- Click on it and click **"Enable"** (if not already enabled)

### 4. Configure OAuth Consent Screen

**Option A: New Google Auth Platform (what you're seeing)**

1. In the left sidebar, click **"Branding"** (under Google Auth Platform)
2. Fill in:
   - **App name**: `Nexus L2 MCP` (or your app name)
   - **App logo**: (optional)
   - **Support email**: Your email
   - **Application home page**: `https://rfrnegounsigaanlbbcy.supabase.co` (or your domain)
   - **Privacy policy link**: (optional for now)
   - **Terms of service link**: (optional for now)
3. Click **"Save"**

4. Go to **"Audience"** in the sidebar
5. You should see options for user type - if you see **"External"**, select it
6. If you don't see External, it might already be set or you may need to go to the old interface (see Option B)

**Option B: Old Interface (if Option A doesn't work)**

1. In the top search bar, type: **"OAuth consent screen"**
2. Or go to: **"APIs & Services"** → **"OAuth consent screen"** (in the left menu, might be under a different section)
3. Choose **"External"** (unless you have a Google Workspace account)
4. Click **"Create"** or **"Edit"**

Fill in the required fields:
- **App name**: `Nexus L2 MCP` (or your app name)
- **User support email**: Your email
- **Developer contact information**: Your email
- Click **"Save and Continue"**

Scopes (optional):
- Click **"Add or Remove Scopes"**
- Select: `email`, `profile`, `openid` (usually pre-selected)
- Click **"Update"** → **"Save and Continue"**

Test users (for development):
- Click **"Add Users"**
- Add your email address
- Click **"Add"** → **"Save and Continue"**

### 5. Create OAuth Credentials

**Option A: New Google Auth Platform**

1. In the left sidebar, click **"Clients"** (under Google Auth Platform)
2. Click **"+ CREATE CLIENT"** or **"Create OAuth client ID"** button
3. Select **"Web application"** as the application type
4. Fill in:
   - **Name**: `Nexus MCP Dashboard` (or any name)
   - **Authorized JavaScript origins**: 
     - `https://rfrnegounsigaanlbbcy.supabase.co`
     - (Optional for local dev): `http://localhost:3000`
   - **Authorized redirect URIs**:
     - `https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback`
     - (Optional for local dev): `http://localhost:3000/auth/v1/callback`
5. Click **"Create"**

**Option B: Old Interface (if Option A doesn't work)**

1. In the top search bar, type: **"Credentials"**
2. Or go to: **"APIs & Services"** → **"Credentials"**
3. Click **"+ CREATE CREDENTIALS"** at the top
4. Select **"OAuth client ID"**
5. If prompted, choose application type: **"Web application"**
6. Configure the OAuth client (same as Option A above)
7. Click **"Create"**

### 6. Copy Your Credentials

You'll see a popup with:
- **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
- **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

**IMPORTANT**: Copy both of these! You won't be able to see the secret again.

### 7. Add to Supabase

1. Go to **Supabase Dashboard** → Your project
2. Go to **Authentication** → **Providers**
3. Find **Google** and click **Enable**
4. Paste:
   - **Client ID** (from step 6)
   - **Client Secret** (from step 6)
5. Click **Save**

### 8. Test It!

1. Go to your dashboard: `http://localhost:3000/login`
2. Click **"Continue with Google"**
3. Sign in with your Google account
4. You should be redirected to `/dashboard`!

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Console exactly matches:
  - `https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback`
- Check for typos, trailing slashes, etc.

### "Access blocked" error
- Make sure your email is added as a test user (step 4)
- Or publish your app (requires verification for production)

### Can't find OAuth consent screen
- Make sure you've created a project first
- Try refreshing the page

## Quick Reference

**Google Cloud Console**: https://console.cloud.google.com/

**Your Supabase Redirect URI**: 
```
https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback
```

**Where to add credentials in Supabase**:
- Dashboard → Authentication → Providers → Google

That's it! You're ready to use Google OAuth. 🎉

