#!/bin/bash
set -e

echo "🧪 Nexus Install Test"
echo "===================="
echo ""
echo "This will:"
echo "  1. Backup your current config (if exists)"
echo "  2. Stop current containers"
echo "  3. Test fresh install in /tmp"
echo "  4. Restore everything"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Save current state
ORIGINAL_DIR=$(pwd)
BACKUP_CONFIG=false
BACKUP_REPO=false

echo ""
echo "📦 Saving current state..."

if [ -d ~/.config/nexus ]; then
    echo "  • Backing up ~/.config/nexus"
    rm -rf ~/.config/nexus.backup
    mv ~/.config/nexus ~/.config/nexus.backup
    BACKUP_CONFIG=true
fi

if [ -d ~/.nexus ]; then
    echo "  • Backing up ~/.nexus"
    rm -rf ~/.nexus.backup
    mv ~/.nexus ~/.nexus.backup
    BACKUP_REPO=true
fi

# Stop existing containers
echo ""
echo "🛑 Stopping current containers..."
cd "$ORIGINAL_DIR"
docker compose down 2>/dev/null || true

# Test install in temp directory
echo ""
echo "🚀 Testing fresh install..."
cd /tmp
rm -rf /tmp/nexus-test
mkdir -p /tmp/nexus-test
cd /tmp/nexus-test

# Run install script
echo ""
echo "📥 Running install script..."
curl -sL "https://raw.githubusercontent.com/vgardrinier/mcp-hackathon-nexus/local/functional/install.sh" | bash > install.log 2>&1

INSTALL_EXIT=$?
if [ $INSTALL_EXIT -ne 0 ]; then
    echo "❌ Install script failed!"
    cat install.log

    # Cleanup and restore
    cd "$ORIGINAL_DIR"
    docker compose down 2>/dev/null || true
    rm -rf ~/.nexus ~/.config/nexus
    [ "$BACKUP_CONFIG" = true ] && mv ~/.config/nexus.backup ~/.config/nexus
    [ "$BACKUP_REPO" = true ] && mv ~/.nexus.backup ~/.nexus
    docker compose up -d 2>/dev/null || true

    exit 1
fi

echo "✓ Install script completed"

# Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Run tests
echo ""
echo "🧪 Running tests..."
TEST_PASSED=true

# Test 1: Dashboard API
echo "  • Testing dashboard API..."
DASHBOARD_RESPONSE=$(curl -s http://localhost:3000/api/user/mcp/servers)
if echo "$DASHBOARD_RESPONSE" | grep -q "github"; then
    echo "    ✓ Dashboard responds with GitHub server"
else
    echo "    ❌ Dashboard test failed"
    echo "    Response: $DASHBOARD_RESPONSE"
    TEST_PASSED=false
fi

if echo "$DASHBOARD_RESPONSE" | grep -q "linear"; then
    echo "    ✓ Dashboard responds with Linear server"
else
    echo "    ❌ Dashboard missing Linear server"
    TEST_PASSED=false
fi

# Test 2: MCP endpoint
echo "  • Testing MCP endpoint..."
MCP_RESPONSE=$(curl -s http://localhost:3001/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}')

if echo "$MCP_RESPONSE" | grep -q "Nexus L2 MCP"; then
    echo "    ✓ MCP endpoint responds correctly"
else
    echo "    ❌ MCP endpoint test failed"
    echo "    Response: $MCP_RESPONSE"
    TEST_PASSED=false
fi

# Test 3: Config files created
echo "  • Testing config files..."
if [ -f ~/.config/nexus/servers/custom/github/config.yml ]; then
    echo "    ✓ GitHub config created"
else
    echo "    ❌ GitHub config missing"
    TEST_PASSED=false
fi

if [ -f ~/.config/nexus/servers/custom/linear/config.yml ]; then
    echo "    ✓ Linear config created"
else
    echo "    ❌ Linear config missing"
    TEST_PASSED=false
fi

# Test 4: Containers running
echo "  • Testing containers..."
RUNNING_CONTAINERS=$(docker compose ps --filter "status=running" --format "{{.Service}}" | wc -l)
if [ "$RUNNING_CONTAINERS" -ge 2 ]; then
    echo "    ✓ Both containers running"
else
    echo "    ❌ Expected 2 containers, found $RUNNING_CONTAINERS"
    docker compose ps
    TEST_PASSED=false
fi

# Cleanup test
echo ""
echo "🧹 Cleaning up test environment..."
docker compose down -v 2>/dev/null || true
rm -rf ~/.nexus ~/.config/nexus

# Restore original state
echo ""
echo "♻️  Restoring original state..."

if [ "$BACKUP_CONFIG" = true ]; then
    echo "  • Restoring ~/.config/nexus"
    mv ~/.config/nexus.backup ~/.config/nexus
fi

if [ "$BACKUP_REPO" = true ]; then
    echo "  • Restoring ~/.nexus"
    mv ~/.nexus.backup ~/.nexus
fi

cd "$ORIGINAL_DIR"
echo "  • Restarting original containers..."
docker compose up -d 2>/dev/null || true

echo ""
echo "===================="
if [ "$TEST_PASSED" = true ]; then
    echo "✅ ALL TESTS PASSED"
    echo ""
    echo "Your install script works! Safe to share with friends."
    exit 0
else
    echo "❌ SOME TESTS FAILED"
    echo ""
    echo "Check the output above for details."
    exit 1
fi
