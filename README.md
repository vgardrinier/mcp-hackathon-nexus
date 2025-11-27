# Nexus

**Run MCP servers locally. Complete privacy. Instant latency.**

Nexus runs fully on your machine—nothing ever leaves your device. Get hundreds of MCP tools with near-instant latency (80-100x faster than cloud routing), 90-95% lower token usage, and full transparent logs.

## Features

- 🔒 **100% Local** - Docker-based or native mode, your data never leaves your machine
- ⚡ **Blazing Fast** - 80-100x faster than cloud MCP routing
- 💰 **Token Efficient** - 90-95% lower token usage vs cloud proxies
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
1. Ask if you have Docker (uses native mode if not)
2. Set up config directories
3. Create default server configs (GitHub, Linear)
4. Start Nexus services
5. Print Cursor config JSON ready to copy-paste

## After Installation

1. **Configure your servers**
   Visit http://localhost:3000 and add your API tokens (GitHub, Linear, etc.)

2. **Connect Cursor**
   Copy the JSON from install output and paste into:
   `Cursor Settings → Features → Model Context Protocol`

3. **Start coding**
   Restart Cursor and you'll have access to MCP tools!

## Requirements

**Docker mode** (recommended):
- Docker installed and running

**Native mode**:
- Node.js 18+
- pnpm (auto-installed if missing)

## Supported MCP Servers

Out of the box:
- **GitHub** - Repos, issues, PRs, code search
- **Linear** - Issues, projects, teams

More coming soon. All MCP servers compatible with STDIO transport work with Nexus.

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
**Logs**: `docker compose logs -f` (Docker) or `pm2 logs` (native)
**Stop**: `docker compose down` (Docker) or `pm2 stop all` (native)
**Restart**: `docker compose restart` (Docker) or `pm2 restart all` (native)

## Configuration

Server configs live in:
- **Mac/Linux**: `~/.config/nexus/servers/custom/`
- **Windows**: `%APPDATA%\nexus\servers\custom\`

Each server has a `config.yml` file. Edit directly or use the dashboard.

## Why Nexus?

**Privacy**: Your code and data never leave your machine. No cloud MCP routing, no third-party servers.

**Speed**: Direct local communication means ~90-95ms latency instead of cloud routing's 8-10 seconds.

**Cost**: Fewer tokens used since there's no cloud proxy overhead.

**Transparency**: See exactly what tools are being called and what data they access.

## License

MIT

## Contributing

Issues and PRs welcome! This was built for the Anthropic MCP Hackathon.

---

Built with ❤️ by [@vgardrinier](https://github.com/vgardrinier)
