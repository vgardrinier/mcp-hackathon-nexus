# Google OAuth 404 Error - Troubleshooting

## Common Causes

### 1. Supabase Redirect URL Not Configured

Supabase needs to know which URLs are allowed for OAuth redirects.

**Fix:**
1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - `http://localhost:3000/dashboard` (for local dev)
   - `http://localhost:3000/**` (wildcard for all local routes)
   - Your production URL if you have one

### 2. Check the Exact 404 URL

Look at the browser address bar when you get the 404:
- If it's `https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback?...` → Google redirect URI issue
- If it's `http://localhost:3000/dashboard?...` → Supabase redirect URL not configured
- If it's something else → Different issue

### 3. Verify Google Console Redirect URI

Make sure in Google Cloud Console → OAuth Client → Authorized redirect URIs:
- Exactly: `https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback`
- No trailing slash
- No typos

### 4. Check Browser Console

Open browser DevTools (F12) → Console tab
- Look for any error messages
- Check Network tab to see which request is failing

## Quick Fix Steps

1. **Add redirect URL to Supabase:**
   - Dashboard → Authentication → URL Configuration
   - Add: `http://localhost:3000/dashboard`
   - Save

2. **Verify Google redirect URI:**
   - Google Cloud Console → Your OAuth Client
   - Check: `https://rfrnegounsigaanlbbcy.supabase.co/auth/v1/callback` is listed

3. **Try again:**
   - Clear browser cache/cookies
   - Try signing in with Google again

## Still Not Working?

Share:
- The exact URL in the address bar when you get the 404
- Any error messages from browser console
- Screenshot of Supabase URL Configuration page

