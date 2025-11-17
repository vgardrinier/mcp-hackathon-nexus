## 🔑 Key Concepts

### 1. MCP (Model Context Protocol)

**What is MCP?**
A protocol that allows AI assistants to access external tools and data sources.

**Two Transport Types:**
- **STDIO**: Standard input/output (for local servers)
  - Runs as a subprocess
  - Uses environment variables for auth
  - Example: `npx @modelcontextprotocol/server-github`
  
- **Streamable HTTP**: HTTP-based (for hosted servers)
  - Connects via URL
  - Uses OAuth for auth
  - Example: `https://mcp.notion.com/mcp`

### 2. Server Lifecycle

**Adding a Server:**
1. Admin adds server config to database (`mcp_servers` table)
2. User installs server via dashboard UI
3. User authenticates (OAuth or env vars)
4. Dashboard notifies MCP server via webhook
5. MCP server connects to end server
6. Tools become available

**Server Configuration:**
```typescript
// STDIO Server
{
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: '...' }
}

// HTTP Server
{
  transport: 'streamable-http',
  url: 'https://mcp.notion.com/mcp'
}
```

### 3. Authentication Flow

**OAuth (Streamable HTTP):**
1. User clicks "Authenticate"
2. Dashboard initiates OAuth flow
3. User authorizes on provider site
4. Provider redirects with code
5. Dashboard exchanges code for tokens
6. Tokens stored in database
7. MCP server uses tokens for requests

**Environment Variables (STDIO):**
1. User enters env vars in dashboard
2. Values stored per-user in database
3. MCP server injects env vars when starting subprocess

### 4. Tool Aggregation

**How it works:**
- Each end server provides tools (e.g., `github_search_repos`)
- Nexus MCP namespaces them: `github_0_search_repos`
- Client sees unified tool list
- Nexus routes to correct end server

**Example:**
```
GitHub Server Tools:
  - search_repos
  - get_file_contents

Notion Server Tools:
  - search_pages
  - create_page

Nexus Aggregated Tools:
  - github_0_search_repos
  - github_0_get_file_contents
  - notion_1_search_pages
  - notion_1_create_page
```

---

