import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { EndServer } from "./endServer/endServer.js";
import type { EndServerData } from "./endServer/types.js";
import { hasValidEnv, parseNamespacedToolName } from "./mcpUtils.js";
import { loadConfiguredEndServers } from "./configLoader.js";

const SERVER_INFO = {
  name: "Nexus L2 MCP",
  version: "0.1.0"
};

export const proxyMCPServer = new Server(SERVER_INFO, {
  capabilities: { tools: {} }
});

async function notifyToolsChanged() {
  return proxyMCPServer
    .notification({
      method: "notifications/tools/list_changed"
    })
    .catch((error: Error) => {
      if (error.message === "Not connected") {
        console.log("\x1B[90mNo clients connected to receive tools list notification.\x1B[0m");
      } else {
        console.error("\x1B[91mError sending tools list changed notification:", error, "\x1B[0m");
      }
    });
}

const serverIdToNamespace: Record<string, string> = {};
const namespaceToServerId: Record<string, string> = {};
let namespaceCounter = 0;

const endServers: Record<string, EndServer> = {};
const endServersData: Record<string, EndServerData> = {};
let pollingInterval: NodeJS.Timeout | null = null;

function registerEndServer(endServerData: EndServerData): boolean {
  if (!hasValidEnv(endServerData)) {
    const missingVars = endServerData.environmentVariables
      .filter((envVar) => envVar.required && (!envVar.value || envVar.value.trim() === ""))
      .map((envVar) => envVar.key);
    console.log(
      `\x1B[93mEnd server '${endServerData.name}' has missing required environment variables: ${missingVars.join(", ")}. Skipping.\x1B[0m`
    );
    return false;
  }

  endServers[endServerData.id] = new EndServer(endServerData, {
    handleToolsListChanged: notifyToolsChanged
  });
  endServersData[endServerData.id] = endServerData;

  const namespace = namespaceCounter.toString();
  serverIdToNamespace[endServerData.id] = namespace;
  namespaceToServerId[namespace] = endServerData.id;
  namespaceCounter++;

  return true;
}

async function unregisterEndServer(serverId: string) {
  const endServer = endServers[serverId];
  if (!endServer) return;

  console.log(`\x1B[90mUnregistering server '${endServer.name}'...\x1B[0m`);

  try {
    if (endServer.isTransportCreated) {
      await endServer.closeTransport();
    }
  } catch (error) {
    console.log(
      `\x1B[90mError closing transport for '${endServer.name}': ${
        error instanceof Error ? error.message : String(error)
      }\x1B[0m`
    );
  }

  delete endServers[serverId];
  delete endServersData[serverId];
  const namespace = serverIdToNamespace[serverId];
  if (namespace) {
    delete namespaceToServerId[namespace];
    delete serverIdToNamespace[serverId];
  }
}

function hasServerConfigChanged(existing: EndServerData, incoming: EndServerData): boolean {
  // Check env vars
  const existingEnvVars = JSON.stringify(
    existing.environmentVariables.map((v) => ({ key: v.key, value: v.value, required: v.required })).sort()
  );
  const incomingEnvVars = JSON.stringify(
    incoming.environmentVariables.map((v) => ({ key: v.key, value: v.value, required: v.required })).sort()
  );

  if (existingEnvVars !== incomingEnvVars) {
    return true;
  }

  // Check access token
  if (existing.accessToken !== incoming.accessToken) {
    return true;
  }

  // Check config (command, args, url)
  if (JSON.stringify(existing.config) !== JSON.stringify(incoming.config)) {
    return true;
  }

  if (
    existing.name !== incoming.name ||
    existing.description !== incoming.description ||
    existing.sourceUrl !== incoming.sourceUrl ||
    existing.category !== incoming.category ||
    existing.logoUrl !== incoming.logoUrl ||
    existing.requiresAuth !== incoming.requiresAuth ||
    existing.accessTokenExpiresAt !== incoming.accessTokenExpiresAt
  ) {
    return true;
  }

  return false;
}

// Custom tools that are always available
const customTools: Tool[] = [
  {
    name: "list-end-servers",
    description: "List the MCP servers the user has installed for this Nexus API key.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "list-server-status",
    description: "List basic connection status for installed MCP servers.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
];

// Store execute functions separately for tool calls
const customToolExecutors: Record<string, () => Promise<{ content: unknown; isError?: boolean }>> = {
  "list-end-servers": async () => {
      const formatServer = (endServer: EndServer) => ({
        id: endServer.id,
        name: endServer.name,
        description: endServer.description,
        sourceUrl: endServer.sourceUrl,
        category: endServer.category,
        installedOn: endServer.installedOn,
        logoUrl: endServer.logoUrl,
        requiredEnvVars: endServer.environmentVariables.map((envVar) => envVar.key)
      });

      try {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ mcpServers: Object.values(endServers).map(formatServer) }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error listing servers:", error);
        return {
          content: [{ type: "text", text: "Error listing servers" }],
          isError: true
        };
      }
  },
  "list-server-status": async () => {
      return {
        content: Object.values(endServers).map((endServer) => ({
          id: endServer.id,
          name: endServer.name,
          isTransportCreated: endServer.isTransportCreated
        })),
        isError: false
      };
    }
};

proxyMCPServer.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("\x1B[94m[Tools] 📋 Client requested tools list...\x1B[0m");
  console.log(`\x1B[90m[Tools] End servers registered: ${Object.keys(endServers).length}\x1B[0m`);
  
  // Debug: Log all registered end servers and their transport status
  if (Object.keys(endServers).length > 0) {
    const serverStatus = Object.keys(endServers).map(id => {
      const server = endServers[id];
      const status = server.isTransportCreated ? '✅ ready' : '❌ transport not created';
      return `${server.name} (${status})`;
    }).join(', ');
    console.log(`\x1B[90m[Tools] Registered servers: ${serverStatus}\x1B[0m`);
  } else {
    console.log(`\x1B[93m[Tools] ⚠️  No end servers registered. Only custom tools will be available.\x1B[0m`);
  }

  const toolsPerServer: Record<string, Tool[]> = {};

  for (const endServerId of Object.keys(endServers)) {
    if (!endServers[endServerId].isTransportCreated) {
      console.log(`\x1B[90m[Tools] Skipping ${endServers[endServerId].name} - transport not created\x1B[0m`);
      continue;
    }
    try {
      console.log(`\x1B[90m[Tools] Fetching tools from ${endServers[endServerId].name}...\x1B[0m`);
      toolsPerServer[endServerId] = await endServers[endServerId].listTools();
      console.log(`\x1B[90m[Tools] ${endServers[endServerId].name} returned ${toolsPerServer[endServerId].length} tools\x1B[0m`);
    } catch (error) {
      console.error(`\x1B[91m[Tools] Error fetching tools from ${endServers[endServerId].name}: ${error instanceof Error ? error.message : String(error)}\x1B[0m`);
      toolsPerServer[endServerId] = [];
    }
  }

  const namespacedTools = Object.entries(toolsPerServer).flatMap(([endServerId, tools]) =>
    tools.map((tool) => ({
      ...tool,
      name: `${tool.name}_${serverIdToNamespace[endServerId]}_nxs`,
      description: `${tool.description || ""}${tool.description ? " " : ""}(End Server: ${
        endServers[endServerId].name
      })`
    }))
  );

  const allTools = [...customTools, ...namespacedTools];
  console.log(`\x1B[92m[Tools] ✅ Returning ${allTools.length} tools total:\x1B[0m`);
  console.log(`\x1B[90m[Tools]   - ${customTools.length} custom tools: ${customTools.map(t => t.name).join(', ')}\x1B[0m`);
  if (namespacedTools.length > 0) {
    console.log(`\x1B[90m[Tools]   - ${namespacedTools.length} end server tools: ${namespacedTools.slice(0, 5).map(t => t.name).join(', ')}${namespacedTools.length > 5 ? '...' : ''}\x1B[0m`);
  }
  
  const response = { tools: allTools };
  console.log(`\x1B[90m[Tools] Response: ${JSON.stringify(response).substring(0, 300)}...\x1B[0m`);
  return response;
});

proxyMCPServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`\x1B[94m[Tool Call] 🔧 Client requested: ${request.params.name}\x1B[0m`);

  const customToolExecutor = customToolExecutors[request.params.name];
  if (customToolExecutor) {
    console.log(`\x1B[90m[Tool Call] Executing custom tool: ${request.params.name}\x1B[0m`);
    const result = await customToolExecutor();
    console.log(`\x1B[92m[Tool Call] ✅ Custom tool completed: ${request.params.name}\x1B[0m`);
    return result;
  }

  if (request.params.name.endsWith("_nxs")) {
    const { nexusId, toolName } = parseNamespacedToolName(request.params.name);
    const endServerId = namespaceToServerId[nexusId];
    return await endServers[endServerId].callTool(toolName, request.params);
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function syncEndServers() {
  let latestEndServers: EndServerData[] = [];

  try {
    latestEndServers = await loadConfiguredEndServers();
  } catch (error) {
    console.log(
      `\x1B[90mSkipping sync: ${error instanceof Error ? error.message : String(error)}\x1B[0m`
    );
    return;
  }

  const latestServerIds = new Set(latestEndServers.map((s) => s.id));
  const currentServerIds = new Set(Object.keys(endServers));

  let hasChanges = false;

  // Remove servers that no longer exist
  for (const serverId of currentServerIds) {
    if (!latestServerIds.has(serverId)) {
      console.log(`\x1B[93mServer removed: ${endServers[serverId].name}\x1B[0m`);
      await unregisterEndServer(serverId);
      hasChanges = true;
    }
  }

  // Add new servers or update existing ones
  for (const latestServer of latestEndServers) {
    const existing = endServers[latestServer.id];

    if (!existing) {
      // New server
      console.log(`\x1B[92mNew server detected: ${latestServer.name}\x1B[0m`);
      try {
        if (!registerEndServer(latestServer)) {
          console.log(`\x1B[90mSkipping '${latestServer.name}' due to validation issues.\x1B[0m`);
          continue;
        }

        await endServers[latestServer.id].createTransport();
        await endServers[latestServer.id].startTransport();
        await endServers[latestServer.id].initializeConnection();
        hasChanges = true;
      } catch (error) {
        console.log(
          `\x1B[90mFailed to setup '${latestServer.name}': ${
            error instanceof Error ? error.message : String(error)
          }\x1B[0m`
        );
      }
    } else if (hasServerConfigChanged(endServersData[latestServer.id], latestServer)) {
      // Config changed, reconnect
      console.log(`\x1B[93mConfig changed for: ${latestServer.name}\x1B[0m`);
      await unregisterEndServer(latestServer.id);

      try {
        if (!registerEndServer(latestServer)) {
          console.log(`\x1B[90mSkipping '${latestServer.name}' due to validation issues.\x1B[0m`);
          continue;
        }

        await endServers[latestServer.id].createTransport();
        await endServers[latestServer.id].startTransport();
        await endServers[latestServer.id].initializeConnection();
        hasChanges = true;
      } catch (error) {
        console.log(
          `\x1B[90mFailed to reconnect '${latestServer.name}': ${
            error instanceof Error ? error.message : String(error)
          }\x1B[0m`
        );
      }
    }
  }

  if (hasChanges) {
    await notifyToolsChanged();
  }
}

export async function initializeServer() {
  let userEndServers: EndServerData[] = [];

  try {
    userEndServers = await loadConfiguredEndServers();
    console.log(`\x1B[90mLoaded ${userEndServers.length} end servers from config.\x1B[0m`);
  } catch (error) {
    console.error(
      "\x1B[91mFailed to load end servers from config:",
      error instanceof Error ? error.message : String(error),
      "\x1B[0m"
    );
    console.log(
      "\x1B[90mMCP server will continue without end servers. Fix the config and restart.\x1B[0m"
    );
    return;
  }

  for (const endServer of userEndServers) {
    try {
      console.log(`\x1B[90mRegistering end server: ${endServer.name} (id: ${endServer.id})\x1B[0m`);
      if (!registerEndServer(endServer)) {
        console.log(`\x1B[90mSkipping server '${endServer.name}' due to validation issues.\x1B[0m`);
        continue;
      }
      console.log(`\x1B[90mRegistered ${endServer.name}, creating transport...\x1B[0m`);

      await endServers[endServer.id].createTransport();
      console.log(`\x1B[90mTransport created for ${endServer.name}\x1B[0m`);
      
      await endServers[endServer.id].startTransport();
      console.log(`\x1B[90mTransport started for ${endServer.name}\x1B[0m`);
      
      await endServers[endServer.id].initializeConnection();
      console.log(`\x1B[90mConnection initialized for ${endServer.name}\x1B[0m`);
    } catch (error) {
      console.error(
        `\x1B[91mFailed to setup end server '${endServer.name}', skipping. Error: ${
          error instanceof Error ? error.message : String(error)
        }\x1B[0m`
      );
      if (error instanceof Error && error.stack) {
        console.error(`\x1B[91mStack trace: ${error.stack}\x1B[0m`);
      }
    }
  }

  console.log(`\x1B[90mEnd servers installed: ${Object.keys(endServers).length} registered, server is ready.\x1B[0m`);

  // Start polling for config changes every 30 seconds
  startPolling();
}

export function startPolling() {
  if (pollingInterval) {
    console.log("\x1B[90mPolling already started.\x1B[0m");
    return;
  }

  console.log("\x1B[90mStarting config polling (every 30s)...\x1B[0m");
  pollingInterval = setInterval(() => {
    syncEndServers().catch((error) => {
      console.log(
        `\x1B[90mPolling error: ${error instanceof Error ? error.message : String(error)}\x1B[0m`
      );
    });
  }, 30000);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("\x1B[90mPolling stopped.\x1B[0m");
  }
}

export async function cleanup() {
  console.log("\x1B[90mCleaning up...\x1B[0m");

  stopPolling();

  const closePromises = Object.values(endServers).map(async (endServer) => {
    try {
      if (endServer.isTransportCreated) {
        await endServer.closeTransport();
      }
    } catch (error) {
      console.log(
        `\x1B[90mError closing ${endServer.name} (ignoring): ${
          error instanceof Error ? error.message : String(error)
        }\x1B[0m`
      );
    }
  });

  try {
    await Promise.race([
      Promise.all(closePromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Cleanup timeout")), 5000))
    ]);
    console.log("\x1B[90mAll end servers closed.\x1B[0m");
  } catch {
    console.log("\x1B[90mCleanup completed with timeout or errors.\x1B[0m");
  }
}

function handleFatal(error: Error | string, type: "exception" | "rejection") {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Error POSTing to endpoint") ||
    message.includes("invalid_token") ||
    message.includes("Unauthorized: Invalid or missing access token") ||
    message.includes("has missing environment variables, skipping") ||
    message.includes("EPIPE")
  ) {
    console.log(`\x1B[90mIgnoring MCP SDK ${type}: ${message}\x1B[0m`);
    return;
  }

  console.error(`\x1B[91m${type}: ${message}\x1B[0m`);
  if (error instanceof Error) {
    console.error(error.stack);
  }
  process.exit(1);
}

process.on("uncaughtException", (error) => handleFatal(error, "exception"));
process.on("unhandledRejection", (reason: Error | string) => handleFatal(reason, "rejection"));
