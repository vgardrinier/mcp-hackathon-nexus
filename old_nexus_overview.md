# Onboarding Guide: Understanding previous Nexus MCP codebase 

## 🎯 Overview

**What is Nexus MCP?**
A unified MCP (Model Context Protocol) server aggregator that allows users to:
- Browse and install multiple MCP servers through a dashboard
- Access all servers through a single endpoint
- Manage authentication (OAuth & environment variables) centrally

**Why does it exist?**
Instead of configuring each MCP server individually, Nexus MCP acts as a proxy that:
- Aggregates tools from multiple servers
- Handles authentication flows
- Provides a unified interface for MCP clients (like Cursor IDE)

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌─────────────┐
│   LLM powered    │  (MCP Client) / ex: Cursor IDE
│     APP     │
└──────┬──────┘
       │ MCP Protocol (STDIO or HTTP) / stdio is the one used most of the times
       │
┌──────▼─────────────────────────────────────┐
│      Nexus L2 MCP Server                  │   /L2 as in layer 2 like crypto project (l1 being the mcp servers)
│      (apps/mcp)                           │
│  ┌─────────────────────────────────────┐  │
│  │  Proxy MCP Server                   │  │
│  │  - Aggregates tools                 │  │
│  │  - Namespaces by server            │  │
│  └─────────────────────────────────────┘  │
│           │                                │
│           │ Connects to                    │
│           ▼                                │
│  ┌─────────────────────────────────────┐  │
│  │  End Servers (GitHub, Notion, etc)  │  │
│  │  - STDIO or Streamable HTTP          │  │
│  │  - OAuth or Env Var auth            │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
       │
       │ Fetches server configs
       ▼
┌─────────────────────────────────────────────┐
│      Dashboard (apps/dashboard)            │
│  ┌─────────────────────────────────────┐  │
│  │  Next.js Web App                    │  │
│  │  - Server marketplace               │  │
│  │  - User management                  │  │
│  │  - OAuth flows                      │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
       │
       │ Stores data
       ▼
┌─────────────────────────────────────────────┐
│      Supabase (PostgreSQL)                  │
│  - Users, API keys                         │
│  - MCP server configs                       │
│  - OAuth tokens                            │
│  - Environment variables                    │
└─────────────────────────────────────────────┘
```

### Key Components

1. **Dashboard App** (`apps/dashboard`)
   - Next.js 15 web application
   - User authentication (Supabase Auth)
   - Server marketplace & management
   - OAuth flow handling

2. **MCP Server** (`apps/mcp`)
   - TypeScript MCP proxy server
   - Aggregates multiple MCP servers
   - Handles STDIO and HTTP transports
   - Tool namespacing

3. **Database** (`packages/database`)
   - Currently using Supabase client directly

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.17+ (we're using v25.1.0)
- **pnpm** 10.0.0+
- **PostgreSQL** database (via Supabase)
- **Supabase** account

### Initial Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd repo_name
pnpm install

# 2. Set up environment variables
cd apps/dashboard
cp .env.example .env
# Fill in:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_DEV_APP_BASE_URL

# 3. Set up database
# - Create Supabase project
# - Run migrations (if any)
# - Set up storage bucket for logos

# 4. Start development
pnpm dev
# This starts:
# - Dashboard on http://localhost:3000
# - MCP server (stdio mode)
```

---

## 📁 Nexus Project Structure

```
nexux-mcp/
├── apps/
│   ├── dashboard/              # Next.js web app
│   │   ├── app/
│   │   │   ├── (landing)/      # Public landing page
│   │   │   ├── (internal)/     # Protected routes
│   │   │   │   └── dashboard/
│   │   │   │       ├── servers/ # Server marketplace
│   │   │   │       └── user/    # User settings
│   │   │   └── api/             # API routes
│   │   │       ├── mcp/         # Public MCP server APIs
│   │   │       ├── user/        # User-specific APIs
│   │   │       └── external/    # External APIs (for MCP server)
│   │   ├── components/         # React components
│   │   ├── lib/
│   │   │   ├── mcp/            # MCP types & utilities
│   │   │   ├── oauth/          # OAuth flow handling
│   │   │   └── supabase/       # Supabase clients
│   │   └── context/            # React contexts
│   │
│   └── mcp/                    # Nexus L2 MCP Server
│       ├── src/
│       │   ├── index.ts        # HTTP server entry
│       │   ├── stdio.ts        # STDIO server entry
│       │   └── lib/
│       │       ├── mcp-server/  # Proxy server logic
│       │       ├── end-server/  # End server management
│       │       └── api/         # Dashboard API client
│       └── build/               # Compiled output
│
└── packages/
    └── database/               # Shared database schemas
        └── src/
            └── schema.ts       # Drizzle ORM schemas
```

---

