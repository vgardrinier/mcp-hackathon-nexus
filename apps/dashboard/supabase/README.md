# Supabase Setup for Nexus L2 MCP Dashboard

## Quick Setup

1. **Create a Supabase project** at https://supabase.com

2. **Run migrations** in order:
   - `001_initial_schema.sql` - Creates all tables
   - `002_seed_data.sql` - Seeds GitHub and Notion servers
   - `003_user_setup_function.sql` - Creates user setup helper function

3. **Set environment variables** in your dashboard app:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Enable automatic user setup** (optional):
   - In Supabase SQL Editor, run:
   ```sql
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```
   - This will automatically create a `users` row and install default servers when someone signs up.

## Manual Test User Setup

If you want to create a test user manually:

1. Sign up via Supabase Auth (email/password or magic link)

2. Get the user ID from `auth.users` table

3. Run this SQL:
   ```sql
   SELECT setup_new_user('<user-id-from-auth-users>', '<user-email>');
   ```

   This will:
   - Create the user row with a generated API key
   - Install GitHub and Notion servers for the user
   - Return the API key (save this for MCP client config)

4. Use the returned API key as `API_KEY` in your MCP server environment.

## Database Schema

- `users` - User accounts with API keys
- `mcp_servers` - Available MCP servers (marketplace)
- `mcp_server_users` - User-server installations
- `mcp_server_user_auth_tokens` - OAuth tokens for HTTP servers
- `mcp_server_environment_vars` - Required env vars per server
- `mcp_server_environment_var_values` - User-specific env var values

