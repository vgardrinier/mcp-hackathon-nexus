# Nexus

**Run MCP servers locally. Complete privacy. Sub-100ms latency.**

Nexus runs fully on your machine—nothing ever leaves your device. Get sub-100ms latency (vs cloud's 5-10 seconds) and 91.8% lower token usage through intelligent tool filtering. Full transparent logs for every operation.

## Features

- 🔒 **100% Local** - Docker-based or native mode, your data never leaves your machine
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

Ships with:
- **GitHub** - Repos, issues, PRs, code search
- **Linear** - Issues, projects, teams

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
**Logs**: `docker compose logs -f` (Docker) or `pm2 logs` (native)
**Stop**: `docker compose down` (Docker) or `pm2 stop all` (native)
**Restart**: `docker compose restart` (Docker) or `pm2 restart all` (native)

## Uninstall

**Docker mode:**
```bash
cd ~/.nexus/repo  # or wherever you cloned
docker compose down -v
rm -rf ~/.nexus ~/.config/nexus
```

**Native mode:**
```bash
pm2 stop all
pm2 delete all
rm -rf ~/.nexus ~/.config/nexus
```

Then remove the Cursor MCP config from Settings → Features → Model Context Protocol.

## Configuration

Server configs live in:
- **Mac/Linux**: `~/.config/nexus/servers/custom/`
- **Windows**: `%APPDATA%\nexus\servers\custom\`

Each server has a `config.yml` file. Edit directly or use the dashboard.

## Why Nexus?

**Privacy**: Your code and data never leave your machine. No cloud MCP routing, no third-party servers.

**Speed**: Direct local communication means sub-100ms latency instead of cloud routing's 5-10 seconds.

**Cost**: 91.8% fewer tokens through intelligent tool filtering. Only sends relevant tools to Cursor instead of exposing all tools.

**Transparency**: See exactly what tools are being called and what data they access.

## How Smart Filtering Works

Traditional MCP setup: Cursor receives all 60+ tools on every request → high token usage

Nexus approach:
1. First query: Cursor sees only `auto_select_tool`
2. You ask: "search my repos"
3. Nexus routes to correct GitHub tool automatically
4. Next query: Cursor receives only top 5 relevant tools
5. Result: 91.8% token reduction (measured)

Run `npx tsx apps/mcp/src/lib/tokenMeasurement.test.ts` to see the proof.

## License

MIT

## Contributing

Issues and PRs welcome! This was built for the Anthropic MCP Hackathon.

---

Built with ❤️ by [@vgardrinier](https://github.com/vgardrinier)
