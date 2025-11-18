-- ============================================
-- NEXUS L2 MCP - ALL MIGRATIONS
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================

-- ============================================
-- MIGRATION 001: Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  api_key TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCP Servers (available servers in marketplace)
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('stdio', 'streamable-http')),
  command TEXT,
  args TEXT[],
  url TEXT,
  logo_url TEXT,
  source_url TEXT,
  requires_auth BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Server relationships (which servers a user has installed)
CREATE TABLE IF NOT EXISTS mcp_server_users (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

-- OAuth tokens for HTTP servers
CREATE TABLE IF NOT EXISTS mcp_server_user_auth_tokens (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

-- Environment variable definitions per server
CREATE TABLE IF NOT EXISTS mcp_server_environment_vars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, key)
);

-- User-specific environment variable values
CREATE TABLE IF NOT EXISTS mcp_server_environment_var_values (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  environment_var_id UUID NOT NULL REFERENCES mcp_server_environment_vars(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, environment_var_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_mcp_server_users_user_id ON mcp_server_users(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_users_server_id ON mcp_server_users(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_user_auth_tokens_user_server ON mcp_server_user_auth_tokens(user_id, server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_environment_vars_server_id ON mcp_server_environment_vars(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_environment_var_values_user_id ON mcp_server_environment_var_values(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_server_user_auth_tokens_updated_at BEFORE UPDATE ON mcp_server_user_auth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_server_environment_var_values_updated_at BEFORE UPDATE ON mcp_server_environment_var_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 002: Seed Data
-- ============================================

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

-- ============================================
-- MIGRATION 003: User Setup Function
-- ============================================

-- Function to automatically set up a new user after Supabase Auth signup
CREATE OR REPLACE FUNCTION setup_new_user(user_id UUID, user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  generated_api_key TEXT;
BEGIN
  -- Generate API key
  generated_api_key := gen_random_uuid()::text;

  -- Create user row
  INSERT INTO users (id, email, api_key)
  VALUES (user_id, user_email, generated_api_key)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Install default servers (GitHub and Notion)
  INSERT INTO mcp_server_users (user_id, server_id)
  VALUES
    (user_id, 'github-stdio'),
    (user_id, 'notion-http')
  ON CONFLICT (user_id, server_id) DO NOTHING;

  RETURN generated_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service_role (for admin API calls)
GRANT EXECUTE ON FUNCTION setup_new_user(UUID, TEXT) TO service_role;

-- Trigger function to automatically set up user when they sign up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM setup_new_user(NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- DONE! All migrations complete.
-- ============================================

