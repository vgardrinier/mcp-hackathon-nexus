# Nexus Installer for Windows
# Run: irm https://get.nexus.sh/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Blue "╔════════════════════════════════════════╗"
Write-ColorOutput Blue "║                                        ║"
Write-ColorOutput Blue "║           Nexus Installer              ║"
Write-ColorOutput Blue "║                                        ║"
Write-ColorOutput Blue "╚════════════════════════════════════════╝"
Write-Output ""

Write-ColorOutput Green "✓ Detected OS: Windows"

# Set config directory
$ConfigDir = Join-Path $env:APPDATA "nexus"

# Ask about Docker
Write-Output ""
Write-ColorOutput Yellow "Do you have Docker installed and running? (y/n)"
$HasDocker = Read-Host

$UseDocker = $false
if ($HasDocker -match "^[Yy]$") {
    # Verify Docker is actually running
    try {
        docker ps | Out-Null
        $UseDocker = $true
        Write-ColorOutput Green "✓ Docker detected and running"
    } catch {
        Write-ColorOutput Yellow "⚠ Docker command not found or not running"
        Write-Output "Please start Docker and try again, or continue with native mode"
        Write-Output ""
        Write-ColorOutput Yellow "Continue with native mode? (y/n)"
        $UseNative = Read-Host
        if ($UseNative -notmatch "^[Yy]$") {
            exit 1
        }
    }
}

# Check Node.js if not using Docker
if (-not $UseDocker) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Red "✗ Node.js is required for native mode"
        Write-Output "Please install Node.js from https://nodejs.org"
        exit 1
    }
    $NodeVersion = node --version
    Write-ColorOutput Green "✓ Node.js detected: $NodeVersion"

    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Yellow "Installing pnpm..."
        npm install -g pnpm
    }
    $PnpmVersion = pnpm --version
    Write-ColorOutput Green "✓ pnpm detected: $PnpmVersion"
}

# Create config directory structure
Write-Output ""
Write-ColorOutput Blue "Setting up Nexus configuration..."
New-Item -ItemType Directory -Force -Path (Join-Path $ConfigDir "servers\custom\github") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ConfigDir "servers\custom\linear") | Out-Null

# Create GitHub server config
$GithubConfig = @"
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
"@
$GithubConfig | Out-File -FilePath (Join-Path $ConfigDir "servers\custom\github\config.yml") -Encoding UTF8

# Create Linear server config
$LinearConfig = @"
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
"@
$LinearConfig | Out-File -FilePath (Join-Path $ConfigDir "servers\custom\linear\config.yml") -Encoding UTF8

Write-ColorOutput Green "✓ Created server configs in $ConfigDir"

# Get the repo (clone or use current directory)
$RepoDir = ""
if ((Test-Path "docker-compose.yml") -and (Test-Path "apps\mcp")) {
    # Already in the repo
    $RepoDir = Get-Location
    Write-ColorOutput Green "✓ Using current directory: $RepoDir"
} else {
    # Need to clone
    $RepoDir = Join-Path $env:USERPROFILE ".nexus\repo"
    if (Test-Path $RepoDir) {
        Write-ColorOutput Yellow "⚠ Nexus repo already exists, pulling latest..."
        Set-Location $RepoDir
        git pull origin master
    } else {
        Write-ColorOutput Blue "Cloning Nexus repository..."
        git clone https://github.com/vgardrinier/mcp-hackathon-nexus.git $RepoDir
    }
    Set-Location $RepoDir
    Write-ColorOutput Green "✓ Repository ready: $RepoDir"
}

# Start services
Write-Output ""
if ($UseDocker) {
    Write-ColorOutput Blue "Starting Nexus with Docker..."
    docker compose up -d

    # Wait for services to be ready
    Write-ColorOutput Yellow "Waiting for services to start..."
    Start-Sleep -Seconds 5

    # Check if services are running
    $DockerStatus = docker compose ps
    if ($DockerStatus -match "Up") {
        Write-ColorOutput Green "✓ Nexus services started successfully"
    } else {
        Write-ColorOutput Red "✗ Failed to start services"
        docker compose logs
        exit 1
    }

    $McpUrl = "http://localhost:3001/mcp"
    $DashboardUrl = "http://localhost:3000"
} else {
    Write-ColorOutput Blue "Starting Nexus in native mode..."

    # Install dependencies
    pnpm install

    # Start services in background using pm2
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Yellow "Installing pm2..."
        pnpm add -g pm2
    }

    pm2 start ecosystem.config.js

    Write-ColorOutput Green "✓ Nexus services started successfully"
    Write-ColorOutput Yellow "Tip: Use 'pm2 logs' to view logs, 'pm2 stop all' to stop"

    $McpUrl = "http://localhost:3001/mcp"
    $DashboardUrl = "http://localhost:3000"
}

# Print success message and Cursor config
Write-Output ""
Write-ColorOutput Green "╔════════════════════════════════════════╗"
Write-ColorOutput Green "║                                        ║"
Write-ColorOutput Green "║     Nexus installed successfully!      ║"
Write-ColorOutput Green "║                                        ║"
Write-ColorOutput Green "╚════════════════════════════════════════╝"
Write-Output ""
Write-ColorOutput Blue "Dashboard: $DashboardUrl"
Write-ColorOutput Blue "MCP Endpoint: $McpUrl"
Write-Output ""
Write-ColorOutput Yellow "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-ColorOutput Yellow "Configure Cursor:"
Write-ColorOutput Yellow "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output ""
Write-Output "Copy the JSON below and paste it into:"
Write-Output "Cursor Settings → Features → Model Context Protocol"
Write-Output ""
Write-ColorOutput Green @"
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
"@
Write-Output ""
Write-ColorOutput Yellow "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output ""
Write-ColorOutput Blue "Next steps:"
Write-Output "1. Visit $DashboardUrl to configure your MCP servers"
Write-Output "2. Add your GitHub token and Linear API key"
Write-Output "3. Copy the JSON above into Cursor settings"
Write-Output "4. Restart Cursor to load MCP tools"
Write-Output ""
Write-ColorOutput Green "Happy coding! 🚀"
