#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup, initializeServer, proxyMCPServer } from "./lib/mcpProxy.js";
import "./lib/env.js";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = () => {};
console.error = () => {};
console.warn = () => {};

const fatalError = (message: string, error?: unknown) => {
  originalConsoleError.call(console, `[FATAL] ${message}`, error);
};

async function main() {
  try {
    await initializeServer();

    const transport = new StdioServerTransport();
    await proxyMCPServer.connect(transport);

    process.on("SIGINT", async () => {
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await cleanup();
      process.exit(0);
    });
  } catch (error) {
    fatalError("Fatal error starting STDIO server:", error);
    process.exit(1);
  }
}

main();


