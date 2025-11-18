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
    this.accessToken = accessToken;

    if (accessToken) {
      this.patchSendWithAuth();
    }
  }

  private patchSendWithAuth() {
    const originalSend = this.transport.send.bind(this.transport);

    this.transport.send = async (message: JSONRPCMessage) => {
      const originalFetch = global.fetch;

      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (this.accessToken) {
          headers.set("Authorization", `Bearer ${this.accessToken}`);
        }

        return originalFetch(input, {
          ...init,
          headers
        });
      };

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
    return this.transport.start();
  }

  async close() {
    return this.transport.close();
  }

  send(message: JSONRPCMessage) {
    return this.transport.send(message);
  }
}


