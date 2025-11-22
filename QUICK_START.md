# Quick Start Guide

The MCP server now reads MCP server definitions from YAML under `apps/mcp/servers/**/config.yml`. You no longer need Supabase or the dashboard to boot the MCP service (the dashboard can still run for UI/OAuth flows).

## 1. Configure environment

Copy `apps/mcp/.env.example` to `apps/mcp/.env` and set:
- `API_KEY`: secret you will use as the Bearer token for `/mcp` (choose any value).
- `HTTP_SERVER_PORT`: default `3001`.
- Optional: `ALLOW_UNAUTHENTICATED_MCP=true` to bypass auth locally.

Export tokens for the built-in servers before starting:
- `GITHUB_TOKEN` for the GitHub STDIO server.
- `NOTION_MCP_TOKEN` (secret_*) for the Notion HTTP server.

## 2. Understand the file layout

```
apps/mcp/servers/config.yml          # lists source folders
apps/mcp/servers/default/github/config.yml
apps/mcp/servers/default/notion/config.yml
apps/mcp/servers/custom/             # gitignored, for your personal servers
```

Add a new server by creating a folder with a `config.yml` inside one of the source paths. The YAML fields mirror the old DB columns: `id`, `name`, `transport`, `command/args` or `url`, `env` entries with `valueFromEnv`, and optional `accessTokenFromEnv` for HTTP servers.

## 3. Start MCP server

```bash
pnpm dev:mcp:http
```

You should see logs like `Loaded 2 end servers from config.` and transports created.

## 4. Point your client (Cursor/Claude)

Use the HTTP endpoint `http://localhost:3001/mcp` with header `Authorization: Bearer <API_KEY>`. For Cursor, update your MCP settings JSON accordingly.

## Troubleshooting

- Missing tools? Ensure required env vars in `env:` are set (e.g., `GITHUB_TOKEN`, `NOTION_MCP_TOKEN`).
- Changing YAML? The MCP process polls every 30s; restart to force an immediate reload.
- Want unauthenticated local dev? Set `ALLOW_UNAUTHENTICATED_MCP=true` in `.env`.
