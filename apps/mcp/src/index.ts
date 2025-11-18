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
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "mcp-session-id", "authorization"]
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
      res.status(401).json({ error: "Unauthorized: Invalid API key" });
      return;
    }

    const acceptHeader = req.headers.accept || "";
    if (!acceptHeader.includes("application/json") || !acceptHeader.includes("text/event-stream")) {
      req.headers.accept = "application/json, text/event-stream";
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
          console.log(`\x1B[94m[Client] New session initialized: ${newSessionId}\x1B[0m`);
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`\x1B[90mSession closed by client: ${transport.sessionId}\x1B[0m`);
          delete transports[transport.sessionId];
        }
      };

      await proxyMCPServer.connect(transport);
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

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
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


