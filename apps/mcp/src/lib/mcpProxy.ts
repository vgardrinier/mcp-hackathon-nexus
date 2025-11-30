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
import type { ToolRouter } from "./toolRouter.js";
import { ActivityLogger } from "./activityLogger.js";
import { sanitizeIntent, detectInjectionAttempt, checkRateLimit } from "./security.js";
import { edisonClient } from "./edisonClient.js";
import { syncNexusConfigToEdison } from "./edisonConfigGenerator.js";
import { resolve } from "node:path";
import os from "node:os";

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
let toolRouter: ToolRouter | null = null;
const activityLogger = ActivityLogger.getInstance();

// Query context tracking for smart filtering
let lastQueryIntent: string | null = null;
let lastQueryTimestamp: number = 0;
const QUERY_CONTEXT_TTL = 30000; // 30 seconds

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
      properties: {}
    }
  },
  {
    name: "list-server-status",
    description: "List basic connection status for installed MCP servers.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "nexus_init",
    description: "**PRIMARY TOOL**: Use this to access GitHub, Linear, Supabase, and all other integrated services. Nexus automatically routes your request to the correct tool. Pass your intent as natural language (e.g., 'list my supabase projects', 'get github PRs', 'show linear issues').",
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "Natural language description of what you want to accomplish (e.g., 'list my supabase projects', 'get last pull requests', 'search for code')"
        },
        args: {
          type: "object",
          description: "Arguments to pass to the selected tool"
        },
        _intent: {
          type: "string",
          description: "Optional: Explicit tool name if you know which tool to use"
        }
      },
      required: ["intent"]
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
    },
  "auto_select_tool": async () => {
    throw new Error("auto_select_tool requires arguments and special handling");
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

  // Check if we have a recent query context for smart filtering
  const hasRecentQuery = lastQueryIntent && (Date.now() - lastQueryTimestamp) < QUERY_CONTEXT_TTL;

  if (hasRecentQuery && toolRouter) {
    console.log(`\x1B[96m[Tools] 🎯 Smart filtering enabled for query: "${lastQueryIntent}"\x1B[0m`);

    // Get top 5 candidate tools from router
    const candidates = toolRouter.searchTools(lastQueryIntent!, 5);
    console.log(`\x1B[90m[Tools] Found ${candidates.length} candidate tools\x1B[0m`);

    // Build filtered namespaced tools
    const filteredTools: Tool[] = [];
    for (const candidate of candidates) {
      const endServer = endServers[candidate.serverId];
      if (!endServer?.isTransportCreated) continue;

      try {
        const allServerTools = await endServer.listTools();
        const matchingTool = allServerTools.find(t => t.name === candidate.name);

        if (matchingTool) {
          filteredTools.push({
            ...matchingTool,
            name: candidate.namespacedName,
            description: `${matchingTool.description || ""}${matchingTool.description ? " " : ""}(End Server: ${endServer.name})`
          });
        }
      } catch (error) {
        console.error(`\x1B[91m[Tools] Error fetching tool ${candidate.name} from ${endServer.name}\x1B[0m`);
      }
    }

    const filteredToolsList = [...customTools, ...filteredTools];
    console.log(`\x1B[92m[Tools] ✅ Returning ${filteredToolsList.length} filtered tools (smart mode):\x1B[0m`);
    console.log(`\x1B[90m[Tools]   - ${customTools.length} custom tools: ${customTools.map(t => t.name).join(', ')}\x1B[0m`);
    console.log(`\x1B[90m[Tools]   - ${filteredTools.length} filtered end server tools: ${filteredTools.map(t => t.name).join(', ')}\x1B[0m`);

    return { tools: filteredToolsList };
  }

  // Default mode: Only show nexus_init to force intelligent routing
  console.log(`\x1B[96m[Tools] 🤖 Showing only nexus_init (forcing intelligent routing)\x1B[0m`);

  const minimalTools = customTools.filter(t => t.name === 'nexus_init' || t.name === 'list-end-servers' || t.name === 'list-server-status');
  console.log(`\x1B[92m[Tools] ✅ Returning ${minimalTools.length} tools (intelligent routing mode):\x1B[0m`);
  console.log(`\x1B[90m[Tools]   - ${minimalTools.map(t => t.name).join(', ')}\x1B[0m`);

  return { tools: minimalTools };
});

proxyMCPServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`\x1B[94m[Tool Call] 🔧 Client requested: ${request.params.name}\x1B[0m`);

  // Special handling for nexus_init
  if (request.params.name === "nexus_init") {
    if (!toolRouter) {
      return {
        content: [{ type: "text", text: "Tool router not initialized. Server may be starting up." }],
        isError: true
      };
    }

    try {
      const rawIntent = request.params.arguments?.intent as string;
      const args = request.params.arguments?.args as Record<string, unknown> | undefined;
      const explicitIntent = request.params.arguments?._intent as string | undefined;

      if (!rawIntent) {
        return {
          content: [{ type: "text", text: "Missing required argument: intent" }],
          isError: true
        };
      }

      // Security: Check for injection attempts
      if (detectInjectionAttempt(rawIntent)) {
        console.log(`\x1B[93m[Security] ⚠️ Potential injection detected in: "${rawIntent.slice(0, 100)}..."\x1B[0m`);
      }

      // Security: Sanitize intent before processing
      const intent = sanitizeIntent(rawIntent);
      console.log(`\x1B[90m[Auto-Select] Routing query: "${intent}"\x1B[0m`);

      // Set query context for potential tool list filtering
      lastQueryIntent = intent;
      lastQueryTimestamp = Date.now();

      const result = await toolRouter.route({ userQuery: intent, _intent: explicitIntent });

      console.log(`\x1B[92m[Auto-Select] Selected: ${result.selectedTool} (confidence: ${result.confidence})\x1B[0m`);
      console.log(`\x1B[90m[Auto-Select] Reason: ${result.reason}\x1B[0m`);

      // Handle ambiguous routing - return candidates for outer LLM to resolve
      if (result.needsClarification && result.candidates) {
        // Truncate descriptions to keep response concise
        const truncateDesc = (desc?: string, maxLen = 80) => {
          if (!desc) return '';
          const firstLine = desc.split('\n')[0].trim();
          return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '...' : firstLine;
        };

        const candidateList = result.candidates
          .slice(0, 4) // Max 4 candidates
          .map((c) => `• **${c.server}**: \`${c.tool}\`${truncateDesc(c.description) ? ` - ${truncateDesc(c.description)}` : ''}`)
          .join("\n");
        
        // Keep clarification message short and actionable
        const clarificationMessage = `🔀 Which service did you mean?

${candidateList}

💡 Try: "${result.candidates[0].server.toLowerCase()} ${intent}" or "${result.candidates[1]?.server.toLowerCase() || result.candidates[0].server.toLowerCase()} ${intent}"`;

        return {
          content: [{ type: "text", text: clarificationMessage }],
          isError: false
        };
      }

      // Now execute the selected tool
      if (result.selectedTool.endsWith("_nxs")) {
        const { nexusId, toolName } = parseNamespacedToolName(result.selectedTool);
        const endServerId = namespaceToServerId[nexusId];
        const endServer = endServers[endServerId];

        console.log(`\x1B[90m[Auto-Select] Executing ${toolName} on ${endServer.name}\x1B[0m`);

        // Security: Check rate limit before execution
        const rateLimit = checkRateLimit(toolName);
        if (!rateLimit.allowed) {
          const resetInSec = Math.ceil(rateLimit.resetInMs / 1000);
          console.log(`\x1B[91m[Security] 🚫 Rate limit exceeded for ${toolName}. Reset in ${resetInSec}s\x1B[0m`);
          return {
            content: [{ 
              type: "text", 
              text: `⚠️ Rate limit exceeded for tool '${toolName}'. Try again in ${resetInSec} seconds.\n\nThis limit helps prevent API quota exhaustion.` 
            }],
            isError: true
          };
        }
        console.log(`\x1B[90m[Security] Rate limit OK for ${toolName}: ${rateLimit.remaining} calls remaining\x1B[0m`);

        // If no args provided, try to extract from intent (basic heuristic)
        let finalArgs = args || {};
        if (!args || Object.keys(args).length === 0) {
          // Try to extract search query from intent
          if (toolName.includes('search')) {
            // Extract meaningful keywords from intent
            const keywords = intent.split(' ').filter(w =>
              !['find', 'my', 'the', 'a', 'an', 'about', 'for', 'in', 'on', 'with'].includes(w.toLowerCase())
            );
            finalArgs = { q: keywords.join(' ') };
            console.log(`\x1B[90m[Auto-Select] Extracted args from intent: ${JSON.stringify(finalArgs)}\x1B[0m`);
          }
        }

        // Edison security check (if enabled)
        if (edisonClient.isEnabled()) {
          console.log(`\x1B[96m[Edison] 🔒 Checking security for ${endServer.name}:${toolName}\x1B[0m`);

          const edisonResult = await edisonClient.callTool(
            endServer.name,
            toolName,
            request
          );

          if (!edisonResult.allowed || edisonResult.blocked) {
            console.log(`\x1B[91m[Edison] 🚨 BLOCKED: ${edisonResult.reason}\x1B[0m`);
            return {
              content: [{
                type: "text",
                text: `🚨 **Security Block**\n\n${edisonResult.reason || 'This operation was blocked by Edison for security reasons.'}\n\n💡 This prevents potential data exfiltration or prompt injection attacks.`
              }],
              isError: true
            };
          }

          console.log(`\x1B[92m[Edison] ✅ Allowed: ${endServer.name}:${toolName}\x1B[0m`);
        }

        // Log tool call start
        const logHandle = await activityLogger.logToolCall(
          endServer.name,
          endServer.id,
          toolName,
          finalArgs
        );

        try {
          const toolResult = await endServers[endServerId].callTool(toolName, {
            ...request.params,
            arguments: finalArgs
          });

          // Log completion
          await logHandle.complete(toolResult);

          // Build clean header - minimal, just shows what was called
          const serverName = endServer.name;
          const header = `✅ **${serverName}** → \`${toolName}\``;

          return {
            ...toolResult,
            content: [
              {
                type: "text",
                text: header
              },
              ...(Array.isArray(toolResult.content) ? toolResult.content : [toolResult.content])
            ]
          };
        } catch (error) {
          // Log error
          await logHandle.complete(undefined, error instanceof Error ? error.message : String(error));
          throw error;
        }
      }

      return {
        content: [{ type: "text", text: `Selected tool ${result.selectedTool} but it's not a recognized end server tool` }],
        isError: true
      };
    } catch (error) {
      console.error(`\x1B[91m[Auto-Select] Error: ${error instanceof Error ? error.message : String(error)}\x1B[0m`);
      return {
        content: [{ type: "text", text: `Error in auto_select_tool: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
  }

  const customToolExecutor = customToolExecutors[request.params.name];
  if (customToolExecutor && request.params.name !== "nexus_init") {
    console.log(`\x1B[90m[Tool Call] Executing custom tool: ${request.params.name}\x1B[0m`);
    const result = await customToolExecutor();
    console.log(`\x1B[92m[Tool Call] ✅ Custom tool completed: ${request.params.name}\x1B[0m`);
    return result;
  }

  if (request.params.name.endsWith("_nxs")) {
    const { nexusId, toolName } = parseNamespacedToolName(request.params.name);
    const endServerId = namespaceToServerId[nexusId];
    const endServer = endServers[endServerId];

    // Edison security check (if enabled)
    if (edisonClient.isEnabled()) {
      console.log(`\x1B[96m[Edison] 🔒 Checking security for ${endServer.name}:${toolName}\x1B[0m`);

      const edisonResult = await edisonClient.callTool(
        endServer.name,
        toolName,
        request
      );

      if (!edisonResult.allowed || edisonResult.blocked) {
        console.log(`\x1B[91m[Edison] 🚨 BLOCKED: ${edisonResult.reason}\x1B[0m`);
        return {
          content: [{
            type: "text",
            text: `🚨 **Security Block**\n\n${edisonResult.reason || 'This operation was blocked by Edison for security reasons.'}\n\n💡 This prevents potential data exfiltration or prompt injection attacks.`
          }],
          isError: true
        };
      }

      console.log(`\x1B[92m[Edison] ✅ Allowed: ${endServer.name}:${toolName}\x1B[0m`);
    }

    // Security: Check rate limit before execution
    const rateLimit = checkRateLimit(toolName);
    if (!rateLimit.allowed) {
      const resetInSec = Math.ceil(rateLimit.resetInMs / 1000);
      console.log(`\x1B[91m[Security] 🚫 Rate limit exceeded for ${toolName}. Reset in ${resetInSec}s\x1B[0m`);
      return {
        content: [{
          type: "text",
          text: `⚠️ Rate limit exceeded for tool '${toolName}'. Try again in ${resetInSec} seconds.\n\nThis limit helps prevent API quota exhaustion.`
        }],
        isError: true
      };
    }

    // Log tool call
    const args = (request.params.arguments as Record<string, unknown>) || {};
    const logHandle = await activityLogger.logToolCall(
      endServer.name,
      endServer.id,
      toolName,
      args
    );

    try {
      const result = await endServer.callTool(toolName, request.params);
      await logHandle.complete(result);
      return result;
    } catch (error) {
      await logHandle.complete(undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
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

  // Auto-generate Edison config from Nexus YAML configs
  if (edisonClient.isEnabled()) {
    console.log('\x1B[96m[Edison] Generating security configuration from Nexus MCP servers...\x1B[0m');
    const edisonConfigDir = resolve(os.homedir(), '.config/nexus/edison');
    try {
      await syncNexusConfigToEdison(userEndServers, edisonConfigDir);
    } catch (error) {
      console.error(
        `\x1B[91m[Edison] Failed to generate config: ${error instanceof Error ? error.message : String(error)}\x1B[0m`
      );
    }

    // Check Edison health after config generation
    console.log('\x1B[96m[Edison] Checking connection to Edison security layer...\x1B[0m');
    const edisonHealthy = await edisonClient.healthCheck();
    if (edisonHealthy) {
      console.log('\x1B[92m[Edison] ✅ Edison security layer connected and ready\x1B[0m');
    } else {
      console.warn('\x1B[93m[Edison] ⚠️  Edison is enabled but not responding. Running in fail-open mode (operations allowed, warnings logged).\x1B[0m');
    }
  } else {
    console.log('\x1B[90m[Edison] Security layer disabled (set EDISON_ENABLED=true to enable)\x1B[0m');
  }

  // Start polling for config changes every 30 seconds
  startPolling();
}

export function setToolRouter(router: ToolRouter) {
  toolRouter = router;
  console.log("\x1B[90m[Router] Tool router initialized\x1B[0m");
}

export function getEndServers(): Record<string, EndServer> {
  return endServers;
}

export function getServerIdToNamespace(): Record<string, string> {
  return serverIdToNamespace;
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
