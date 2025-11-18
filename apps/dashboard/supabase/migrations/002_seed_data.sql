-- Seed: MCP Servers (GitHub STDIO + Notion HTTP)

-- GitHub Server (STDIO)
INSERT INTO mcp_servers (id, name, description, transport, command, args, url, source_url, requires_auth)
VALUES (
  'github-stdio',
  'GitHub',
  'GitHub MCP server using STDIO transport. Requires GITHUB_TOKEN environment variable.',
  'stdio',
  'npx',
  ARRAY['@modelcontextprotocol/server-github'],
  NULL,
  'https://github.com/modelcontextprotocol/servers',
  false
) ON CONFLICT (id) DO NOTHING;

-- Notion Server (Streamable HTTP)
INSERT INTO mcp_servers (id, name, description, transport, command, args, url, source_url, requires_auth)
VALUES (
  'notion-http',
  'Notion',
  'Official Notion MCP server over HTTP. Requires OAuth authentication.',
  'streamable-http',
  NULL,
  NULL,
  'https://mcp.notion.com/mcp',
  'https://github.com/notionhq/notion-mcp-server',
  true
) ON CONFLICT (id) DO NOTHING;

-- Environment Variables for GitHub Server
INSERT INTO mcp_server_environment_vars (server_id, name, key, description, required)
VALUES (
  'github-stdio',
  'GitHub Personal Access Token',
  'GITHUB_TOKEN',
  'Your GitHub personal access token with appropriate scopes',
  true
) ON CONFLICT (server_id, key) DO NOTHING;

-- Note: To create a test user:
-- 1. Sign up via Supabase Auth (email/password or magic link)
-- 2. Run the following SQL to create the user row and install servers:
--
-- INSERT INTO users (id, email, api_key)
-- VALUES (
--   '<user-id-from-auth-users>',
--   '<user-email>',
--   gen_random_uuid()::text
-- )
-- ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
--
-- INSERT INTO mcp_server_users (user_id, server_id)
-- VALUES
--   ('<user-id-from-auth-users>', 'github-stdio'),
--   ('<user-id-from-auth-users>', 'notion-http')
-- ON CONFLICT (user_id, server_id) DO NOTHING;

