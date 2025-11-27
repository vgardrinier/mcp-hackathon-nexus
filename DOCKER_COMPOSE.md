# Local development with Docker Compose

This repo now ships a Compose setup that runs both services (Next.js dashboard + MCP HTTP server) without needing Node on your host. It is aimed at day-to-day dev, not production.

## Prereqs
- Docker Desktop or any recent Docker engine with Compose v2 support
- Supabase project + credentials (URL, anon key, service role key)
- Run the SQL migrations against your Supabase instance once (see `MIGRATION_GUIDE.md` or `apps/dashboard/supabase/ALL_MIGRATIONS.sql`)

## One-time setup
1) Dashboard env: copy `apps/dashboard/.env.example` to `apps/dashboard/.env` and fill:
   - `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Optional Notion OAuth client if you plan to test that flow
2) MCP env: copy `apps/mcp/.env.example` to `apps/mcp/.env` and fill:
   - `API_KEY` (any secret string; used by the MCP HTTP server auth)
   - `HTTP_SERVER_PORT=3001`
   - Optional: `MCP_SERVERS_CONFIG` if you want a different YAML path (defaults to `apps/mcp/servers/config.yml`)
3) Build images: `docker compose build`

## Run the stack
```bash
docker compose up
```

- Dashboard: http://localhost:3000
- MCP HTTP endpoint: http://localhost:3001/mcp
- File changes on the host hot-reload thanks to bind mounts; `node_modules` live in a named volume, `pnpm install` runs automatically on first start.

Stop with `docker compose down` (add `-v` to drop the pnpm/node_modules volumes).

## Useful commands
- View logs: `docker compose logs -f dashboard` or `docker compose logs -f mcp`
- Rebuild after adding deps: `docker compose build dashboard mcp`
- Clean everything: `docker compose down -v && docker compose rm -f`

## Notes
- Supabase is still external; point the env vars to your project. If you want Supabase in Docker too, use Supabase CLI's `supabase start` stack and point the envs at those service URLs.
- MCP server configs now live in YAML under `apps/mcp/servers/`, so the MCP container does not need the dashboard to boot. The dashboard can still run alongside it for UI flows.
