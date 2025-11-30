import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { env } from "./env.js";

export interface EdisonResponse {
  allowed: boolean;
  blocked?: boolean;
  response?: any;
  reason?: string;
  sessionBlocked?: boolean;
}

/**
 * Client for interacting with Edison security proxy
 */
export class EdisonClient {
  private baseUrl: string;
  private apiKey: string;
  private enabled: boolean;

  constructor() {
    this.baseUrl = env.EDISON_URL;
    this.apiKey = env.EDISON_API_KEY;
    this.enabled = env.EDISON_ENABLED;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Forward an MCP tool call through Edison for security checking
   */
  async callTool(
    serverName: string,
    toolName: string,
    request: CallToolRequest
  ): Promise<EdisonResponse> {
    if (!this.enabled) {
      return { allowed: true };
    }

    try {
      // Edison expects MCP protocol messages
      const response = await fetch(`${this.baseUrl}/mcp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.id || 1,
          method: "tools/call",
          params: {
            name: `${serverName}/${toolName}`,
            arguments: request.params.arguments || {}
          }
        })
      });

      if (!response.ok) {
        if (response.status === 403) {
          const text = await response.text();
          return {
            allowed: false,
            blocked: true,
            reason: text || "Edison blocked this operation for security reasons"
          };
        }
        throw new Error(`Edison returned ${response.status}: ${await response.text()}`);
      }

      // Parse SSE response
      const text = await response.text();

      // Simple SSE parsing - look for data: lines
      const dataLines = text.split('\n').filter(line => line.startsWith('data: '));
      if (dataLines.length === 0) {
        return { allowed: true };
      }

      const lastData = dataLines[dataLines.length - 1].substring(6); // Remove "data: "
      const result = JSON.parse(lastData);

      // Check if Edison blocked it
      if (result.error && result.error.message?.includes('blocked')) {
        return {
          allowed: false,
          blocked: true,
          reason: result.error.message
        };
      }

      return {
        allowed: true,
        response: result.result
      };
    } catch (error) {
      console.error(`\x1B[91m[Edison] Error calling Edison: ${error instanceof Error ? error.message : String(error)}\x1B[0m`);

      // Fail open - if Edison is down, allow the operation but log it
      console.warn('\x1B[93m[Edison] ⚠️ Edison unavailable, allowing operation (fail-open mode)\x1B[0m');
      return { allowed: true };
    }
  }

  /**
   * Check health of Edison service
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl.replace(':4000', ':4001')}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const edisonClient = new EdisonClient();
