#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                        ║${NC}"
echo -e "${BLUE}║           Nexus Installer              ║${NC}"
echo -e "${BLUE}║                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
else
    echo -e "${RED}Unsupported OS. This script supports Mac and Linux.${NC}"
    echo "For Windows, use: irm https://get.nexus.sh/install.ps1 | iex"
    exit 1
fi

echo -e "${GREEN}✓${NC} Detected OS: $OS"

# Set config directory based on OS
if [ "$OS" = "mac" ] || [ "$OS" = "linux" ]; then
    CONFIG_DIR="$HOME/.config/nexus"
else
    echo -e "${RED}Failed to set config directory${NC}"
    exit 1
fi

# Check for Docker
echo ""
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker is required to run Nexus"
    echo ""
    echo -e "${BLUE}Please install Docker:${NC}"
    echo "  Mac: https://www.docker.com/products/docker-desktop"
    echo "  Linux: https://docs.docker.com/engine/install/"
    echo ""
    echo "Then run this script again."
    exit 1
fi

if ! docker ps &> /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Docker is installed but not running"
    echo ""
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker detected and running"

# Create config directory structure
echo ""
echo -e "${BLUE}Setting up Nexus configuration...${NC}"
mkdir -p "$CONFIG_DIR/servers/custom/github"
mkdir -p "$CONFIG_DIR/servers/custom/linear"

# Create GitHub server config
cat > "$CONFIG_DIR/servers/custom/github/config.yml" <<'EOF'
# GitHub MCP Server (stdio transport)
id: github-mcp-server
name: GitHub
description: Access GitHub repositories, issues, PRs via MCP
sourceUrl: https://github.com/modelcontextprotocol/servers
category: official
logoUrl: https://github.githubassets.com/favicons/favicon.svg

# This server requires authentication
requiresAuth: true

# Environment variables needed by this server
env:
  - key: GITHUB_TOKEN
    name: GitHub Personal Access Token
    description: Token with repo access
    required: true
    valueFromEnv: GITHUB_TOKEN  # Reads from process.env.GITHUB_TOKEN

# How to start this server (runs a command)
config:
  transport: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-github"
EOF

# Create Linear server config
cat > "$CONFIG_DIR/servers/custom/linear/config.yml" <<'EOF'
id: linear-mcp-server
name: Linear
description: Manage Linear issues, projects, and teams
category: official
logoUrl: https://linear.app/favicon.ico

requiresAuth: true

env:
  - key: LINEAR_API_KEY
    name: Linear API Key
    description: Personal API key from Linear settings
    required: true
    valueFromEnv: LINEAR_API_KEY

config:
  transport: stdio
  command: npx
  args:
    - "-y"
    - "@mseep/linear-mcp"
EOF

echo -e "${GREEN}✓${NC} Created server configs in $CONFIG_DIR"

# Get the repo (clone or use current directory)
REPO_DIR=""
if [ -f "docker-compose.yml" ] && [ -d "apps/mcp" ]; then
    # Already in the repo
    REPO_DIR="$(pwd)"
    echo -e "${GREEN}✓${NC} Using current directory: $REPO_DIR"
else
    # Need to clone
    REPO_DIR="$HOME/.nexus/repo"
    if [ -d "$REPO_DIR" ]; then
        echo -e "${YELLOW}⚠${NC} Nexus repo already exists, pulling latest..."
        cd "$REPO_DIR"
        git pull origin master
    else
        echo -e "${BLUE}Cloning Nexus repository...${NC}"
        git clone -b local/functional https://github.com/vgardrinier/mcp-hackathon-nexus.git "$REPO_DIR"
    fi
    cd "$REPO_DIR"
    echo -e "${GREEN}✓${NC} Repository ready: $REPO_DIR"
fi

# Start services
echo ""
echo -e "${BLUE}Starting Nexus with Docker...${NC}"
docker compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Check if services are running
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Nexus services started successfully"
else
    echo -e "${RED}✗${NC} Failed to start services"
    docker compose logs
    exit 1
fi

MCP_URL="http://localhost:3001/mcp"
DASHBOARD_URL="http://localhost:3000"

# Print success message and Cursor config
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}║     Nexus installed successfully!      ║${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Dashboard:${NC} $DASHBOARD_URL"
echo -e "${BLUE}MCP Endpoint:${NC} $MCP_URL"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Configure Cursor:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Copy the JSON below and paste it into:"
echo "Cursor Settings → Features → Model Context Protocol"
echo ""
echo -e "${GREEN}"
cat <<'CURSOR_CONFIG'
{
  "mcpServers": {
    "nexus": {
      "transport": {
        "type": "streamableHttp",
        "url": "http://localhost:3001/mcp"
      }
    }
  }
}
CURSOR_CONFIG
echo -e "${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit $DASHBOARD_URL to configure your MCP servers"
echo "2. Add your GitHub token and Linear API key"
echo "3. Copy the JSON above into Cursor settings"
echo "4. Restart Cursor to load MCP tools"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
