import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { env } from "./lib/env.js";
import {
  InternalServerErrorResponseSkeleton,
  InvalidSessionIdResponseSkeleton
} from "./lib/httpSkeleton.js";
import { verifyBearerToken } from "./lib/httpAuth.js";
import { cleanup, initializeServer, proxyMCPServer } from "./lib/mcpProxy.js";

console.log("Starting Nexus L2 MCP HTTP server...");

const app = express();

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id", "mcp-session-id", "*"],
    allowedHeaders: ["Content-Type", "mcp-session-id", "Mcp-Session-Id", "authorization"]
  })
);

app.use(express.json());

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function isAuthorized(req: Request): boolean {
  if (env.ALLOW_UNAUTHENTICATED_MCP) {
    return true;
  }
  return verifyBearerToken(req, env.API_KEY);
}

async function handleMCPRequest(req: Request, res: Response) {
  try {
    if (!isAuthorized(req)) {
      console.log(`\x1B[91m[Auth] Unauthorized request from ${req.headers["user-agent"] || "unknown"}\x1B[0m`);
      res.status(401).json({ error: "Unauthorized: Invalid API key" });
      return;
    }

    const acceptHeader = req.headers.accept || "";
    if (!acceptHeader.includes("application/json") || !acceptHeader.includes("text/event-stream")) {
      req.headers.accept = "application/json, text/event-stream";
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const method = (req.body as any)?.method;
    const bodyStr = JSON.stringify(req.body).substring(0, 200);
    console.log(
      `\x1B[94m[Request] ${method || "unknown"} | Session: ${sessionId || "NEW"} | Body: ${bodyStr}...\x1B[0m`
    );
    
    // Log all relevant headers for debugging
    const relevantHeaders = {
      "mcp-session-id": req.headers["mcp-session-id"],
      "Mcp-Session-Id": req.headers["mcp-session-id"],
      "authorization": req.headers["authorization"] ? "Bearer ***" : undefined,
      "accept": req.headers["accept"],
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"]
    };
    console.log(`\x1B[90m[Headers] ${JSON.stringify(relevantHeaders, null, 2)}\x1B[0m`);
    
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      console.log(`\x1B[92m[Session] ✅ Using existing session: ${sessionId}\x1B[0m`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      console.log(`\x1B[93m[Session] 🔄 Creating new session for initialize request\x1B[0m`);
      const newSessionId = randomUUID();
      
      // Set headers BEFORE creating transport so they're available when SDK writes response
      res.setHeader("Mcp-Session-Id", newSessionId);
      res.setHeader("mcp-session-id", newSessionId);
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-session-id, *");
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (initializedSessionId) => {
          transports[initializedSessionId] = transport;
          console.log(`\x1B[92m[Session] ✅ New session initialized: ${initializedSessionId}\x1B[0m`);
          // Ensure headers are still set (SDK might overwrite, so set again)
          if (!res.headersSent) {
            res.setHeader("Mcp-Session-Id", initializedSessionId);
            res.setHeader("mcp-session-id", initializedSessionId);
            res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-session-id, *");
          }
          console.log(`\x1B[90m[Session] Headers confirmed: Mcp-Session-Id=${initializedSessionId}, mcp-session-id=${initializedSessionId}\x1B[0m`);
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`\x1B[90mSession closed by client: ${transport.sessionId}\x1B[0m`);
          delete transports[transport.sessionId];
        }
      };

      await proxyMCPServer.connect(transport);
      
      // Set headers immediately after transport creation, before handleRequest
      // The SDK will set mcp-session-id, we ensure Mcp-Session-Id is also set
      const originalWriteHead = res.writeHead.bind(res);
      res.writeHead = function(statusCode?: any, statusMessage?: any, headers?: any) {
        if (transport.sessionId) {
          const finalHeaders = typeof statusCode === 'number' 
            ? (headers || statusMessage || {})
            : (statusCode || {});
          finalHeaders['Mcp-Session-Id'] = transport.sessionId;
          finalHeaders['mcp-session-id'] = transport.sessionId;
          if (typeof statusCode === 'number') {
            return originalWriteHead(statusCode, statusMessage, finalHeaders);
          } else {
            return originalWriteHead(finalHeaders);
          }
        }
        return originalWriteHead(statusCode, statusMessage, headers);
      };
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided"
        },
        id: null
      });
      return;
    }

    // Ensure session headers are set before SDK handles the request
    // For existing sessions, set headers if not already sent
    if (transport.sessionId) {
      if (!res.headersSent) {
        res.setHeader("Mcp-Session-Id", transport.sessionId);
        res.setHeader("mcp-session-id", transport.sessionId);
        res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-session-id, *");
      }
    }

    // Handle the request - SDK will manage the SSE response stream
    await transport.handleRequest(req, res, req.body);
    
    // Log response completion (note: for SSE, this may log before stream closes)
    console.log(`\x1B[90m[Response] ${method || "unknown"} handled | Session: ${transport.sessionId || "none"}\x1B[0m`);
  } catch (error) {
    console.error(`\x1B[91m[Error] ❌ Error handling MCP request: ${error instanceof Error ? error.message : String(error)}\x1B[0m`);
    if (error instanceof Error && error.stack) {
      console.error(`\x1B[91m[Error] Stack: ${error.stack}\x1B[0m`);
    }
    if (!res.headersSent) {
      res.status(500).json(InternalServerErrorResponseSkeleton);
    }
  }
}

app.post("/mcp", handleMCPRequest);

async function handleMCPSessionRequest(req: Request, res: Response) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized: Invalid API key" });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json(InvalidSessionIdResponseSkeleton);
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
}

app.get("/mcp", handleMCPSessionRequest);
app.delete("/mcp", handleMCPSessionRequest);

async function main() {
  try {
    app.listen(env.HTTP_SERVER_PORT, () => {
      console.log(
        `\n\x1B[35mNexus L2 MCP HTTP endpoint listening on port ${env.HTTP_SERVER_PORT}\x1B[0m\n`
      );
    });

    initializeServer().catch((error) => {
      console.error("\x1B[91mError initializing end servers:", error, "\x1B[0m");
    });
  } catch (error) {
    console.error("\nFatal error starting HTTP server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\n\x1B[90mReceived SIGINT (Ctrl+C), shutting down gracefully...\x1B[0m");

  try {
    for (const [sessionId, transport] of Object.entries(transports)) {
      console.log(`\x1B[90mClosing session: ${sessionId}\x1B[0m`);
      try {
        await transport.close();
      } catch (error) {
        console.log(
          `\x1B[90mError closing session ${sessionId}: ${
            error instanceof Error ? error.message : String(error)
          }\x1B[0m`
        );
      }
    }

    await cleanup();
    console.log("\x1B[90mServer is shutdown.\x1B[0m");
  } catch (error) {
    console.log(
      `\x1B[90mCleanup error: ${error instanceof Error ? error.message : String(error)}\x1B[0m`
    );
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\x1B[90mReceived SIGTERM, shutting down gracefully...\x1B[0m");

  try {
    for (const [sessionId, transport] of Object.entries(transports)) {
      console.log(`\x1B[90mClosing session: ${sessionId}\x1B[0m`);
      try {
        await transport.close();
      } catch (error) {
        console.log(
          `\x1B[90mError closing session ${sessionId}: ${
            error instanceof Error ? error.message : String(error)
          }\x1B[0m`
        );
      }
    }

    await cleanup();
    console.log("\x1B[90mGoodbye!\x1B[0m");
  } catch (error) {
    console.log(
      `\x1B[90mCleanup error: ${error instanceof Error ? error.message : String(error)}\x1B[0m`
    );
  }

  process.exit(0);
});

main();


