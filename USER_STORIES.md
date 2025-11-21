# User Stories: What to Expect After Supabase Setup

## Setup Steps

1. **Connect Supabase to repo:**
   - Create Supabase project
   - Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Run migrations: `001_initial_schema.sql`, `002_seed_data.sql`, `003_user_setup_function.sql`

2. **Start dashboard:**
   ```bash
   cd apps/dashboard
   pnpm dev
   ```

3. **Start MCP server:**
   ```bash
   export API_KEY=<your-api-key-from-dashboard>
   export DASHBOARD_URL=http://localhost:3000
   export HTTP_SERVER_PORT=3001
   pnpm dev:mcp:http
   ```

---

## What You'll See

### ✅ **MCP Servers Page** (`/dashboard/servers`)

**After migrations, you'll see 2 servers:**

1. **GitHub** (STDIO)
   - Status: "disconnected" 
   - Description: "GitHub MCP server using STDIO transport..."
   - **This is REAL** - Can be installed and will work

2. **Notion** (Streamable HTTP)
   - Status: "disconnected"
   - Description: "Official Notion MCP server over HTTP..."
   - **This is REAL** - Can be installed, but OAuth is stubbed (won't fully work yet)

### ⚠️ **MCP Clients Page** (`/dashboard/clients`)

**You'll see 3 client cards:**

1. **ChatGPT** - "OpenAI's GPT models"
2. **Claude** - "Anthropic's Claude models"  
3. **Gemini** - "Google's Gemini models"

**⚠️ IMPORTANT:** These are **UI-only** - they don't actually connect anything. They're informational cards that link to the connect page. The real clients you'll use are:
- **Cursor** (via `/dashboard/connect`)
- **Claude Desktop** (via `/dashboard/connect`)

---

## Complete User Story: End-to-End Flow

### Story 1: Install GitHub Server and Use in Cursor ✅ **FULLY WORKS**

1. **Sign up** → `/signup`
   - Create account
   - **Auto-setup happens:** User row created with API key, GitHub + Notion servers auto-installed
   - Get redirected to dashboard

2. **Get API key** → `/dashboard/account`
   - See your API key
   - Copy it (you'll need this for MCP server)

3. **Configure GitHub server** → `/dashboard/servers/github-stdio`
   - Server is already installed (auto-installed on signup)
   - Enter your `GITHUB_TOKEN` in the env var form
   - Click "Save Environment Variables"

4. **Start MCP server:**
   ```bash
   export API_KEY=<your-api-key>
   export DASHBOARD_URL=http://localhost:3000
   pnpm dev:mcp:http
   ```
   - Should see: "Fetched 1 end servers" (or 2 if Notion installed)
   - Should see: "[GitHub] Transport created with authentication"
   - Should see: "[GitHub] Initialized"
   - Should see: "End servers installed, server is ready"

5. **Connect Cursor** → `/dashboard/connect`
   - Click "Cursor (HTTP)" tab
   - Copy the config JSON
   - Paste into Cursor's MCP settings file
   - Restart Cursor

6. **Use GitHub tools in Cursor:**
   - GitHub tools appear with namespacing: `search_repos_0_nxs`, `get_file_contents_0_nxs`, etc.
   - Can call tools and they route through Nexus → GitHub MCP server
   - ✅ **FULLY FUNCTIONAL**

### Story 2: Install Notion Server ⚠️ **PARTIALLY WORKS**

1. **Install Notion** → `/dashboard/servers`
   - Click "Connect" on Notion card
   - Server gets installed

2. **Authenticate Notion** → `/dashboard/servers/notion-http`
   - Click "Connect with Notion"
   - ⚠️ **OAuth is stubbed** - redirects back but doesn't actually get token
   - Status stays "auth required"

3. **MCP server behavior:**
   - MCP server fetches Notion server config
   - Sees `requiresAuth: true` but `accessToken: null`
   - Skips connecting (logs: "requires authentication but no access token found")
   - ⚠️ **Notion tools won't appear** until OAuth is implemented

### Story 3: Connect Claude Desktop ✅ **FULLY WORKS**

1. **Get config** → `/dashboard/connect`
   - Click "Claude Desktop" tab
   - Copy the config JSON
   - Shows file path: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. **Add to Claude Desktop config:**
   - Open the config file
   - Add the Nexus MCP server config
   - Restart Claude Desktop

3. **Use tools in Claude:**
   - GitHub tools appear (if GitHub server is installed and configured)
   - Tools are namespaced: `search_repos_0_nxs`, etc.
   - ✅ **FULLY FUNCTIONAL**

### Story 4: MCP Clients Page (ChatGPT/Claude/Gemini) ⚠️ **UI ONLY**

1. **View clients** → `/dashboard/clients`
   - See 3 cards: ChatGPT, Claude, Gemini
   - All show "disconnected" status

2. **Click "Connect":**
   - Redirects to `/dashboard/connect?client=chatgpt` (or claude/gemini)
   - Shows config snippets for that client
   - **But:** These are just config examples - no actual integration

3. **Reality:**
   - ChatGPT/Gemini don't have MCP support yet (as of this writing)
   - Claude card is redundant (use Claude Desktop instead)
   - This page is more of a "future clients" placeholder

---

## What Actually Works vs What's Stubbed

### ✅ **FULLY FUNCTIONAL:**

- ✅ User signup/login
- ✅ API key generation
- ✅ GitHub server installation
- ✅ GitHub env var configuration
- ✅ MCP server fetching from dashboard API
- ✅ GitHub MCP server connection (STDIO)
- ✅ Tool namespacing
- ✅ Tool routing
- ✅ Cursor HTTP connection
- ✅ Claude Desktop STDIO connection
- ✅ End-to-end tool execution

### ⚠️ **PARTIALLY WORKING:**

- ⚠️ Notion server installation (works)
- ⚠️ Notion OAuth flow (stubbed - redirects but doesn't get token)
- ⚠️ Notion tools (won't appear until OAuth works)

### 🎨 **UI ONLY (No Backend):**

- 🎨 MCP Clients page (ChatGPT/Claude/Gemini cards)
- 🎨 Client "Connect" buttons (just navigate to connect page)
- 🎨 Client status indicators (hardcoded to "disconnected")

---

## Expected Behavior Summary

**After Supabase setup:**

1. **`/dashboard/servers`** → Shows 2 real servers (GitHub, Notion)
2. **`/dashboard/clients`** → Shows 3 UI cards (informational only)
3. **`/dashboard/connect`** → Shows real configs for Cursor/Claude Desktop
4. **`/dashboard/account`** → Shows your real API key

**What works end-to-end:**
- Install GitHub → Set GITHUB_TOKEN → Start MCP server → Connect Cursor/Claude → Use GitHub tools ✅

**What's stubbed:**
- Notion OAuth (UI exists, but doesn't actually get tokens)
- MCP Clients page (just UI, no real integration)

**Bottom line:** The core L2 MCP functionality works! GitHub server → Cursor/Claude Desktop connection is fully functional. Notion needs OAuth implementation, and the clients page is just informational UI.

