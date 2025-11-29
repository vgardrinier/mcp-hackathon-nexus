# Nexus

**Run MCP servers locally. Complete privacy. Sub-100ms latency.**

Nexus runs fully on your machine—nothing ever leaves your device. Get sub-100ms latency (vs cloud's 5-10 seconds) and 91.8% lower token usage through intelligent tool filtering. Full transparent logs for every operation.

## Features

- 🔒 **100% Local** - Docker-based your data & tokens never leaves your machine
- ⚡ **Fast** - Sub-100ms latency vs cloud MCP routing (5-10 seconds)
- 💰 **Token Efficient** - 91.8% lower token usage through smart tool filtering
- 🔍 **Transparent** - Full logs of every tool call and response
- 🎯 **Simple Setup** - One command install, works with Cursor out of the box
- 🛠️ **Dashboard** - Visual UI to configure servers and manage tokens

## Quick Start

### Mac/Linux
```bash
curl -sL https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/master/install.sh | bash
```

### Windows
```powershell
irm https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/master/install.ps1 | iex
```

The install script will:
1. Check if Docker is installed and running
2. Set up config directories (`~/.config/nexus/`)
3. Create default server configs (e.g. GitHub, Linear, Firecrawl...)
4. Clone repo and start services with Docker
5. Print Cursor config JSON ready to copy-paste

**Takes ~30 seconds. No Node.js or dependencies needed on your machine.**

## After Installation

1. **Configure your servers**
   Visit http://localhost:3000 and add your API tokens (GitHub, Linear, etc.)

2. **Connect Cursor**
   Copy the JSON from install output and paste into:
   `Cursor Settings → Features → Model Context Protocol`

3. **Start coding**
   Restart Cursor and you'll have access to MCP tools!

## Requirements

- **Docker** (required) - [Get Docker Desktop](https://www.docker.com/products/docker-desktop)

That's it! Docker handles all dependencies internally.

## Supported MCP Servers

Ships with:
- **GitHub** - Repos, issues, PRs, code search
- **Linear** - Issues, projects, teams
- **Notion** - Read and write Notion pages and databases
- **Supabase** - Database, auth, storage management
- **Firecrawl** - Web scraping and crawling with AI extraction
... and many more

Nexus supports any MCP server using STDIO transport. Add more servers by dropping config files in `~/.config/nexus/servers/custom/`.

## How It Works

```
Cursor → http://localhost:3001/mcp → Nexus Proxy → GitHub/Linear/etc MCP Servers
```

Nexus acts as an L2 proxy that:
1. Accepts MCP requests from Cursor over HTTP
2. Routes to appropriate STDIO MCP servers
3. Streams responses back in real-time
4. Logs everything for transparency

All processing happens locally—zero cloud dependencies.

## Management

**Dashboard**: http://localhost:3000

### Nexus CLI

After installation, use the `nexus` command to manage your local setup:

```bash
nexus logs           # View activity logs (what data was read/written)
nexus logs -f        # Follow activity in real-time
nexus status         # Check service status
nexus restart        # Restart services
nexus stop / start   # Stop or start services
nexus update         # Pull latest changes
nexus help           # Show all commands
```

### Activity Logs

The `nexus logs` command shows a human-readable audit trail of all tool calls:

```bash
$ nexus logs

[10:23:45] 🔍 GitHub: search repositories
   ├─ query: "react hooks"
   └─ ✓ found 150 repositories
      (245ms)

[10:24:12] 📖 Linear: list issues
   └─ ✓ found 23 issues

[10:24:30] ✍️  GitHub: create issue
   ├─ repo: my-app
   └─ ✓ created with id: #142
```

This works generically for **any MCP server** you add - no server-specific code needed.

### Docker Logs

For raw service logs:
- `docker compose logs -f`
- `docker compose logs mcp` - MCP server logs only
- `docker compose logs dashboard` - Dashboard logs only

## Uninstall & Reinstall

**To completely remove Nexus:**
```bash
nexus uninstall
```

**To reinstall (after uninstall or if installation failed):**
```bash
curl -sL https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/master/install.sh | bash
```

**Manual uninstall:**
```bash
cd ~/.nexus/repo
docker compose down -v
rm -rf ~/.nexus ~/.config/nexus
rm /usr/local/bin/nexus  # or ~/.local/bin/nexus
```

Then remove the Cursor MCP config from Settings → Features → Model Context Protocol.

## Configuration

Server configs live in:
- **Mac/Linux**: `~/.config/nexus/servers/custom/`
- **Windows**: `%APPDATA%\nexus\servers\custom\`


## License

MIT

## Contributing

Issues and PRs welcome! This was built for the 1y MCP anniversary Hackathon.

Built with ❤️ by [@vgardrinier](https://github.com/vgardrinier)
