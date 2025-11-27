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

# Ask about Docker
echo ""
echo -e "${YELLOW}Do you have Docker installed and running? (y/n)${NC}"
read -r HAS_DOCKER

USE_DOCKER=false
if [[ "$HAS_DOCKER" =~ ^[Yy]$ ]]; then
    # Verify Docker is actually running
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        USE_DOCKER=true
        echo -e "${GREEN}✓${NC} Docker detected and running"
    else
        echo -e "${YELLOW}⚠${NC} Docker command not found or not running"
        echo "Please start Docker and try again, or continue with native mode"
        echo ""
        echo -e "${YELLOW}Continue with native mode? (y/n)${NC}"
        read -r USE_NATIVE
        if [[ ! "$USE_NATIVE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Check Node.js if not using Docker
if [ "$USE_DOCKER" = false ]; then
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗${NC} Node.js is required for native mode"
        echo "Please install Node.js from https://nodejs.org"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Node.js detected: $(node --version)"

    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}Installing pnpm...${NC}"
        npm install -g pnpm
    fi
    echo -e "${GREEN}✓${NC} pnpm detected: $(pnpm --version)"
fi

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
        git clone https://github.com/vgardrinier/mcp-hackathon-nexus.git "$REPO_DIR"
    fi
    cd "$REPO_DIR"
    echo -e "${GREEN}✓${NC} Repository ready: $REPO_DIR"
fi

# Start services
echo ""
if [ "$USE_DOCKER" = true ]; then
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
else
    echo -e "${BLUE}Starting Nexus in native mode...${NC}"

    # Install dependencies
    pnpm install

    # Start services in background using pm2
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}Installing pm2...${NC}"
        pnpm add -g pm2
    fi

    pm2 start ecosystem.config.js

    echo -e "${GREEN}✓${NC} Nexus services started successfully"
    echo -e "${YELLOW}Tip: Use 'pm2 logs' to view logs, 'pm2 stop all' to stop${NC}"

    MCP_URL="http://localhost:3001/mcp"
    DASHBOARD_URL="http://localhost:3000"
fi

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
