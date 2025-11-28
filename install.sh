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
mkdir -p "$CONFIG_DIR/servers/custom/supabase"
mkdir -p "$CONFIG_DIR/servers/custom/firecrawl"
mkdir -p "$CONFIG_DIR/servers/custom/notion"

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

# Create Supabase server config
cat > "$CONFIG_DIR/servers/custom/supabase/config.yml" <<'EOF'
id: supabase-mcp-server
name: Supabase
description: Manage Supabase projects, database, auth, and storage
sourceUrl: https://github.com/supabase-community/supabase-mcp
category: official
logoUrl: https://supabase.com/favicon/favicon-32x32.png

requiresAuth: true

env:
  - key: SUPABASE_ACCESS_TOKEN
    name: Supabase Personal Access Token
    description: Create a PAT in your Supabase account settings
    required: true
    valueFromEnv: SUPABASE_ACCESS_TOKEN

config:
  transport: stdio
  command: npx
  args:
    - "-y"
    - "@supabase/mcp-server-supabase"
    - "--access-token"
    - "${SUPABASE_ACCESS_TOKEN}"
EOF

# Create Firecrawl server config
cat > "$CONFIG_DIR/servers/custom/firecrawl/config.yml" <<'EOF'
id: firecrawl-mcp-server
name: Firecrawl
description: Web scraping and crawling with AI-powered extraction
sourceUrl: https://docs.firecrawl.dev/mcp-server
category: official
logoUrl: https://www.firecrawl.dev/favicon.ico

requiresAuth: true

env:
  - key: FIRECRAWL_API_KEY
    name: Firecrawl API Key
    description: Get your API key from https://www.firecrawl.dev/app/api-keys
    required: true
    valueFromEnv: FIRECRAWL_API_KEY

config:
  transport: stdio
  command: npx
  args:
    - "-y"
    - "firecrawl-mcp"
EOF

# Create Notion server config
cat > "$CONFIG_DIR/servers/custom/notion/config.yml" <<'EOF'
id: notion-mcp-server
name: Notion
description: Read and write to Notion pages and databases
sourceUrl: https://github.com/makenotion/notion-mcp-server
category: official
logoUrl: https://www.notion.so/images/favicon.ico

requiresAuth: true

env:
  - key: NOTION_TOKEN
    name: Notion Integration Token
    description: Create an integration at https://www.notion.so/profile/integrations
    required: true
    valueFromEnv: NOTION_TOKEN

config:
  transport: stdio
  command: npx
  args:
    - "-y"
    - "@notionhq/notion-mcp-server"
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

# Install nexus CLI
echo ""
echo -e "${BLUE}Installing nexus CLI...${NC}"
if [ -f "$REPO_DIR/nexus" ]; then
    chmod +x "$REPO_DIR/nexus"

    # Try /usr/local/bin first (system-wide, may need sudo)
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$REPO_DIR/nexus" /usr/local/bin/nexus
        echo -e "${GREEN}✓${NC} nexus CLI installed to /usr/local/bin/nexus"
    else
        # Try with sudo
        if sudo -n ln -sf "$REPO_DIR/nexus" /usr/local/bin/nexus 2>/dev/null; then
            echo -e "${GREEN}✓${NC} nexus CLI installed to /usr/local/bin/nexus"
        else
            # Fallback: user-local bin directory
            mkdir -p "$HOME/.local/bin"
            ln -sf "$REPO_DIR/nexus" "$HOME/.local/bin/nexus"
            echo -e "${GREEN}✓${NC} nexus CLI installed to $HOME/.local/bin/nexus"

            # Check if ~/.local/bin is in PATH
            if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                echo -e "${YELLOW}⚠${NC} Add to your PATH by running:"
                echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
                echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
                echo "    source ~/.bashrc  # or source ~/.zshrc"
            fi
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} nexus CLI script not found, skipping CLI install"
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
      "url": "http://localhost:3001/mcp"
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
echo -e "${BLUE}Nexus CLI commands:${NC}"
echo "  nexus logs      - See what data is being read/written"
echo "  nexus status    - Check service status"
echo "  nexus help      - Show all commands"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
