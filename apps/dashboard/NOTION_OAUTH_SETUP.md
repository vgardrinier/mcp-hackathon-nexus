# Notion OAuth Setup Guide

## Prerequisites

1. A Notion account
2. Access to create integrations in Notion

## Step 1: Create Notion Integration

**Important:** You need a **Public** integration (not Internal) because the Notion MCP server uses OAuth.

1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**
3. Fill in the details:
   - **Name**: Nexus L2 MCP (or any name you prefer)
   - **Type**: **Public** (required for OAuth - Internal integrations only give you a secret token, not OAuth)
   - **Company name**: Your name or "Nexus L2 MCP" (required for Public)
   - **Website**: `http://localhost:3000` or your domain (required for Public)
   - **Privacy policy URL**: Can use `http://localhost:3000` temporarily (required for Public)
   - **Logo**: Optional
   - **Associated workspace**: Select your workspace
4. Click **"Submit"**
5. After creation, you'll see:
   - **OAuth client ID** (shown on the integration page, looks like: `abc123-def456-...`)
   - **OAuth client secret** (click "Show" to reveal, looks like: `secret_abc123...`)
   
**Note:** Internal integrations only provide a "Internal Integration Secret" which won't work with the Notion MCP server's OAuth flow. You must use a Public integration.

## Step 2: Configure Redirect URI

1. In your Notion integration settings, find **"Redirect URIs"**
2. Add your redirect URI:
   - **Development**: `http://localhost:3000/api/user/mcp/servers/notion-http/auth/complete`
   - **Production**: `https://your-domain.com/api/user/mcp/servers/notion-http/auth/complete`
3. Click **"Save changes"**

## Step 3: Set Environment Variables

Add these to your `.env.local` file (or your deployment environment):

```bash
NOTION_CLIENT_ID=your-client-id-here
NOTION_CLIENT_SECRET=your-client-secret-here
```

## Step 4: Test the Flow

1. Start your dashboard: `pnpm dev`
2. Navigate to `/dashboard/servers`
3. Click on **Notion** server
4. Click **"Connect with Notion"**
5. You should be redirected to Notion's authorization page
6. Authorize the integration
7. You should be redirected back with a success message
8. The server should now show as "Authenticated"

## Troubleshooting

### "OAuth not configured" error
- Make sure `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET` are set in your environment
- Restart your Next.js dev server after adding env vars

### "Invalid redirect URI" error
- Make sure the redirect URI in Notion matches exactly:
  - `http://localhost:3000/api/user/mcp/servers/notion-http/auth/complete` (dev)
  - Or your production URL (production)
- Check for trailing slashes or typos

### "OAuth state verification failed"
- This usually means the OAuth flow took too long (>10 minutes)
- Try again - the state cookie expires after 10 minutes

### Tokens not appearing in database
- Check Supabase logs for errors
- Verify the `mcp_server_user_auth_tokens` table exists
- Check that the user ID matches between auth and database

## Security Notes

- **Never commit** `NOTION_CLIENT_SECRET` to version control
- Use environment variables or secrets management
- In production, use HTTPS (required for secure cookies)
- OAuth state is stored in httpOnly cookies for CSRF protection

## Next Steps

After successful OAuth setup:
1. Restart your MCP server
2. The MCP server will fetch the Notion access token
3. Notion tools should appear in your MCP clients (Cursor, Claude Desktop)
4. Tools will be namespaced: `search_pages_1_nxs`, `create_page_1_nxs`, etc.

