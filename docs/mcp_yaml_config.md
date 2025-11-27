# MCP YAML Config Spec (branch `codex/file-based-mcp-configs`)

This branch replaces Supabase-stored MCP server configs with local YAML files. The MCP HTTP process boots from files and polls every 30s for changes.

## Layout and entrypoint
- Default config file lives inside the repo source folder: `apps/mcp/servers/default/config.yml`.
- Override via `MCP_SERVERS_CONFIG` (resolved from `apps/mcp/`); the parent directory of that file is the base for relative `sources`.
- Repo source: `apps/mcp/servers/default/` contains shipped servers (e.g., `github/`, `notion/`).
- Custom source lives outside the repo by default:
  - macOS/Linux: `~/.config/nexus/servers/custom/`
  - Windows: `%APPDATA%/nexus/servers/custom/` (e.g., `C:\Users\<user>\AppData\Roaming\nexus\servers\custom`)
  - Override via `MCP_USER_SERVERS_DIR`.
- Each source directory contains subfolders (one per server). Each server folder must contain `config.yml` or `config.yaml`.

## Global config (`apps/mcp/servers/default/config.yml`)

```yaml
meta:
  name: Nexus Official Servers
  description: Built-in MCP servers shipped with the repo.
  authors:
    - Nexus Team
  about: Contains default MCP servers (e.g., GitHub, Notion).
# sources is optional; if omitted defaults are applied:
#   - repo source "." (official)
#   - user custom source (~/.config/nexus/servers/custom or %APPDATA%/nexus/servers/custom)
```

Notes:
- If the file is missing/invalid, defaults are used: repo source `.` (official) plus the user custom source (see above).
- Regardless of file contents, the user custom source is auto-appended if missing.
- You can still add `sources` to mix in other folders; `path` can be absolute or relative to this file.
- Optional fields on a source: `category` (applied to all servers in that source), `optional` (skip missing source silently; default false).

## Per-server config (`<source>/<server>/config.yml`)

Required:
- `id` (string)
- `name` (string)
- `config` (one of the transports below)

Common optional fields:
- `description` (string)
- `sourceUrl` (string)
- `category` (string) — overrides the source-level category
- `logoUrl` (string)
- `installedOn` (string) — falls back to the config file mtime
- `requiresAuth` (bool, default `false`)
- `accessToken` (string) or `accessTokenFromEnv` (string env var name)
- `accessTokenExpiresAt` (string or null)
- `env` (array, default `[]`)
  - `key` (string, required)
  - `name` (string, optional; defaults to `key`)
  - `description` (string, optional)
  - `required` (bool, default `false`)
  - `value` (string, optional) or `valueFromEnv` (env var name, optional) or `valueFromFile` (string path, optional; relative paths resolve from user config dir)

Transport configs (`config`):
- STDIO:
  ```yaml
  config:
    transport: stdio
    command: npx
    args: ["@modelcontextprotocol/server-github"]  # default []
    env:                                           # optional object, merged with env var values
      SOME_FLAG: "1"
  ```
- Streamable HTTP:
  ```yaml
  config:
    transport: streamable-http
    url: https://mcp.notion.com/mcp
  ```

## Credentials and env resolution
- `env[*].value` wins over `env[*].valueFromEnv`; missing values become `null`.
- `valueFromFile` resolves a file (absolute or relative to the user config dir) and trims it.
- `accessTokenFromEnv` pulls from process env; `valueFromEnv` does the same.
- Optional user-level secrets file: `~/.config/nexus/.env` (Windows: `%APPDATA%/nexus/.env`). Loaded automatically (does **not** override existing env vars).
- Servers requiring missing required env vars are skipped at registration time.

## Validation rules (from `apps/mcp/src/lib/configLoader.ts`)
- Paths: source `path` resolved relative to the config file directory unless absolute.
- Invalid per-server config: skipped with a warning (zod-validated).
- Missing `config.yml` inside a server folder: skipped with a warning.
- Duplicate `id` across sources: later ones are skipped with a warning.
- If the global config is missing/invalid, defaults are used and a debug log is printed.

## Examples

Global config (repo):
```yaml
sources:
  - path: .
    category: official
  # user custom source is auto-added if missing
```

GitHub STDIO server:
```yaml
id: github-stdio
name: GitHub
description: GitHub MCP server using STDIO transport. Requires GITHUB_TOKEN.
sourceUrl: https://github.com/modelcontextprotocol/servers
requiresAuth: false
env:
  - key: GITHUB_TOKEN
    name: GitHub Personal Access Token
    description: Token with repo scope
    required: true
    valueFromEnv: GITHUB_TOKEN
config:
  transport: stdio
  command: npx
  args: ["@modelcontextprotocol/server-github"]
```

Notion HTTP server:
```yaml
id: notion-http
name: Notion
description: Official Notion MCP server over HTTP. Requires OAuth token.
sourceUrl: https://github.com/notionhq/notion-mcp-server
requiresAuth: true
accessTokenFromEnv: NOTION_MCP_TOKEN
config:
  transport: streamable-http
  url: https://mcp.notion.com/mcp
```
