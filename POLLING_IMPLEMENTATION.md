# Polling Implementation for Dynamic Server Config Updates

## What Was Added

The MCP server now **automatically detects changes** to user's server configurations every 30 seconds without requiring a restart.

## Changes Made to `apps/mcp/src/lib/mcpProxy.ts`

### 1. New State Management
```typescript
const endServersData: Record<string, EndServerData> = {};
let pollingInterval: NodeJS.Timeout | null = null;
```
- `endServersData`: Stores original server configs for comparison
- `pollingInterval`: Tracks the polling timer for cleanup

### 2. New Functions

#### `syncEndServers()`
- Fetches latest server configs from dashboard API
- Compares with currently loaded servers
- **Detects and handles:**
  - ✅ New servers added → registers and connects
  - ✅ Servers removed → unregisters and disconnects
  - ✅ Config changes (env vars, tokens) → reconnects

#### `unregisterEndServer(serverId)`
- Closes transport cleanly
- Removes server from all tracking structures
- Cleans up namespace mappings

#### `hasServerConfigChanged(existing, incoming)`
- Compares environment variables
- Compares access tokens
- Compares transport config (command, args, url)
- Returns `true` if any changes detected

#### `startPolling()`
- Starts 30-second interval timer
- Calls `syncEndServers()` every cycle
- Guards against multiple polling instances

#### `stopPolling()`
- Clears interval timer
- Called during cleanup/shutdown

### 3. Integration Points

**On startup (`initializeServer`):**
```typescript
// After loading initial servers...
startPolling(); // ← Added this
```

**On shutdown (`cleanup`):**
```typescript
stopPolling(); // ← Added this
// Then close all transports...
```

## How It Works

### Flow Diagram
```
┌─────────────────────────────────────────────┐
│  Every 30 seconds                           │
│  ↓                                          │
│  1. Fetch latest servers from dashboard    │
│  ↓                                          │
│  2. Compare with current servers            │
│  ↓                                          │
│  3a. New server?                            │
│      → Register + Connect                   │
│  ↓                                          │
│  3b. Server removed?                        │
│      → Disconnect + Unregister              │
│  ↓                                          │
│  3c. Config changed?                        │
│      → Disconnect + Re-register + Connect   │
│  ↓                                          │
│  4. If changes → Notify client tools list   │
│     changed                                 │
└─────────────────────────────────────────────┘
```

## What Users Experience

### Before (Without Polling)
```
User: Installs GitHub server in dashboard
User: Sets GITHUB_TOKEN env var
User: Has to manually restart MCP server
```

### After (With Polling)
```
User: Installs GitHub server in dashboard
User: Sets GITHUB_TOKEN env var
... wait up to 30 seconds ...
MCP Server: "New server detected: GitHub"
MCP Server: Automatically connects
Claude/Cursor: Receives tools list update
User: GitHub tools are now available ✨
```

## Log Messages

When changes are detected, you'll see:

```bash
# New server added
[92mNew server detected: GitHub[0m
[90m[GitHub] Transport created with authentication.[0m
[90m[GitHub] Initialized.[0m

# Server removed
[93mServer removed: Notion[0m
[90mUnregistering server 'Notion'...[0m

# Config changed (e.g., env var updated)
[93mConfig changed for: GitHub[0m
[90mUnregistering server 'GitHub'...[0m
[92mNew server detected: GitHub[0m

# Polling started
[90mStarting config polling (every 30s)...[0m

# Polling stopped
[90mPolling stopped.[0m
```

## Error Handling

- If dashboard is unreachable: Logs error, skips sync, tries again in 30s
- If server fails to connect: Logs error, leaves server unregistered
- If config comparison fails: Falls back to no changes detected
- Polling errors are caught and logged, won't crash the server

## Testing

To test the polling mechanism:

1. **Start MCP server:**
   ```bash
   pnpm dev:mcp:http
   # Should see: "Starting config polling (every 30s)..."
   ```

2. **Install a server via dashboard:**
   - Go to `/dashboard/servers`
   - Click "Connect" on a server
   - Set env vars if needed
   - Wait up to 30 seconds

3. **Check logs:**
   ```bash
   # Should see:
   # "New server detected: <server-name>"
   # "[<server-name>] Transport created..."
   # "[<server-name>] Initialized."
   ```

4. **Update env var:**
   - Change env var value in dashboard
   - Wait up to 30 seconds
   - Should see: "Config changed for: <server-name>"

5. **Uninstall a server:**
   - Click "Uninstall" in dashboard
   - Wait up to 30 seconds
   - Should see: "Server removed: <server-name>"

## Notes for Your Notion Integration

- ✅ Polling won't interfere with your Notion OAuth work
- ✅ When OAuth tokens are stored, polling will detect and reconnect
- ✅ Access token changes trigger reconnection automatically
- ✅ All changes are non-breaking to existing code

## Performance

- Polling interval: 30 seconds (configurable by changing `30000` in `startPolling()`)
- API call per cycle: 1 GET request to `/api/external/user/mcp/servers`
- Minimal overhead: Only reconnects when changes detected
- Efficient comparison: Uses JSON.stringify for deep equality

## Clean Code Principles Applied

✅ **Single Responsibility:** Each function does one thing
✅ **Clear Naming:** `syncEndServers()`, `hasServerConfigChanged()`
✅ **Error Handling:** Try-catch blocks, graceful fallbacks
✅ **Logging:** Color-coded, informative messages
✅ **Cleanup:** Proper timer cleanup on shutdown
✅ **No Breaking Changes:** Existing code unchanged

## Future Enhancements (Optional)

- Add configurable polling interval via env var
- Implement exponential backoff on dashboard errors
- Add metrics (# syncs, # changes detected)
- Support webhook alternative (faster than polling)
