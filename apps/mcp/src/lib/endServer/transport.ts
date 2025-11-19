import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Lightweight authenticated HTTP transport wrapper that injects a Bearer token.
 */
export class AuthenticatedStreamableHTTPClientTransport {
  private transport: StreamableHTTPClientTransport;
  private accessToken?: string;

  constructor(url: URL, accessToken?: string) {
    this.transport = new StreamableHTTPClientTransport(url);
    // Trim and store token - ensure it doesn't already have Bearer prefix
    this.accessToken = accessToken?.trim().replace(/^Bearer\s+/i, "").trim();

    if (this.accessToken) {
      // Log token type for debugging (first few chars only)
      const tokenPreview = this.accessToken.substring(0, 10) + "...";
      const tokenType = this.accessToken.startsWith("secret_") ? "integration" : 
                       this.accessToken.startsWith("ntn_") ? "OAuth" : "unknown";
      console.log(`\x1B[90m[Auth] Token loaded: ${tokenPreview} (type: ${tokenType}, length: ${this.accessToken.length})\x1B[0m`);
      
      if (!this.accessToken.startsWith("secret_")) {
        console.log(`\x1B[93m[Auth] ⚠️  Warning: Token doesn't start with 'secret_'. Notion API requires integration tokens (secret_*), not OAuth tokens (ntn_*)\x1B[0m`);
      }
      
      this.patchTransportMethods();
    }
  }

  private patchTransportMethods() {
    // Patch both start() and send() to inject Bearer token
    const self = this;
    
    const createAuthFetch = (originalFetch: typeof fetch) => {
      return async function(input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.toString());
        const headers = new Headers(init?.headers);
        
        if (self.accessToken) {
          const authHeader = `Bearer ${self.accessToken}`;
          headers.set("Authorization", authHeader);
          
          // Notion API requires Notion-Version header
          const isNotion = url.hostname.includes("notion.com") || url.hostname.includes("mcp.notion");
          if (isNotion) {
            headers.set("Notion-Version", "2022-06-28");
          }
        }
        
        return originalFetch(url.toString(), { ...init, headers });
      };
    };
    
    // Patch start() method
    const originalStart = this.transport.start.bind(this.transport);
    this.transport.start = async function() {
      const originalFetch = global.fetch;
      global.fetch = createAuthFetch(originalFetch);
      
      try {
        return await originalStart();
      } finally {
        global.fetch = originalFetch;
      }
    };

    // Patch send() method
    const originalSend = this.transport.send.bind(this.transport);
    this.transport.send = async function(message: JSONRPCMessage) {
      const originalFetch = global.fetch;
      global.fetch = createAuthFetch(originalFetch);
      
      try {
        return await originalSend(message);
      } finally {
        global.fetch = originalFetch;
      }
    };
  }

  get onmessage() {
    return this.transport.onmessage;
  }
  set onmessage(handler) {
    this.transport.onmessage = handler;
  }

  get onerror() {
    return this.transport.onerror;
  }
  set onerror(handler) {
    this.transport.onerror = handler;
  }

  get onclose() {
    return this.transport.onclose;
  }
  set onclose(handler) {
    this.transport.onclose = handler;
  }

  async start() {
    // start() makes requests that need auth, so fetch is already patched
    return this.transport.start();
  }

  async close() {
    return this.transport.close();
  }

  send(message: JSONRPCMessage) {
    return this.transport.send(message);
  }
}


