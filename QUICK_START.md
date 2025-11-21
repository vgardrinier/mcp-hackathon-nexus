# Quick Start Guide

Prefer Docker Compose? See `DOCKER_COMPOSE.md` for a two-container setup (dashboard + MCP).

## Why Cursor MCP is Still Loading (Orange)

The MCP connection is loading because:
1. ✅ Database migrations haven't run yet
2. ✅ You haven't signed up / gotten your API key
3. ✅ MCP server isn't running
4. ✅ API key isn't set in `apps/mcp/.env`

## Step-by-Step Fix

### 1. Run Supabase Migrations

See `MIGRATION_GUIDE.md` for detailed SQL steps, or:

1. Go to: https://supabase.com/dashboard/project/mcp-hackathon-nexus/sql
2. Click "New query"
3. Copy/paste each migration file in order:
   - `apps/dashboard/supabase/migrations/001_initial_schema.sql`
   - `apps/dashboard/supabase/migrations/002_seed_data.sql`
   - `apps/dashboard/supabase/migrations/003_user_setup_function.sql`
4. Click "Run" after each one

### 2. Start Dashboard

```bash
cd apps/dashboard
pnpm dev
```

Dashboard will start at: http://localhost:3000

### 3. Sign Up & Get API Key

1. Go to: http://localhost:3000/signup
2. Create an account (email/password)
3. You'll be redirected to `/dashboard/servers`
4. Go to: http://localhost:3000/dashboard/account
5. **Copy your API key** (you'll need this next)

### 4. Configure MCP Server

Edit `apps/mcp/.env` (copy from `.env.example` first):

```bash
API_KEY=paste-your-api-key-here
DASHBOARD_URL=http://localhost:3000
HTTP_SERVER_PORT=3001
```

### 5. Start MCP Server

```bash
# From project root
pnpm dev:mcp:http
```

You should see:
- ✅ "Fetched X end servers"
- ✅ "Server listening on port 3001"
- ✅ "End servers installed, server is ready"

### 6. Configure Cursor

1. Go to: http://localhost:3000/dashboard/connect
2. Click "Cursor (HTTP)" tab
3. Copy the JSON config
4. Paste into Cursor's MCP settings file (usually `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`)
5. **Restart Cursor**

### 7. Verify Connection

In Cursor, you should see:
- ✅ MCP connection turns green (not orange)
- ✅ Tools appear: `github_0_search_repos`, `github_0_get_file_contents`, etc.
- ✅ Can call tools successfully

## Troubleshooting

**Still orange?**
- Check MCP server is running: `curl http://localhost:3001/mcp` (should return JSON-RPC error, not connection refused)
- Check API key matches: Compare `apps/mcp/.env` API_KEY with `/dashboard/account`
- Check Cursor config has correct URL: `http://localhost:3001/mcp`
- Check Cursor config has correct Authorization header: `Bearer <your-api-key>`

**No tools appearing?**
- Make sure you've installed GitHub server: `/dashboard/servers` → click "Connect" on GitHub
- Make sure you've set GITHUB_TOKEN: `/dashboard/servers/github-stdio` → enter token → Save
- Check MCP server logs for errors

**MCP server won't start?**
- Check `apps/mcp/.env` has all required vars
- Check dashboard is running (MCP server needs to fetch config from it)
- Check API key is valid (should match what's in Supabase `users` table)
