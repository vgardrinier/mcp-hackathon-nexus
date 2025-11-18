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

