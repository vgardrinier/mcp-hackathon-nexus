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
  private sessionId: string | null = null;

  constructor() {
    this.baseUrl = env.EDISON_URL;
    this.apiKey = env.EDISON_API_KEY;
    this.enabled = env.EDISON_ENABLED;
  }

  /**
   * Reset the session (e.g., when starting a new conversation)
   */
  resetSession(): void {
    this.sessionId = null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if Edison approves a tool call (using agent API)
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
      // Use Edison's agent API for simple approval check
      const managementUrl = this.baseUrl.replace(':4000', ':4001');
      const argsStr = JSON.stringify(request.params.arguments || {}).substring(0, 100);

      // Build request body, including session_id if we have one to maintain trifecta tracking
      const requestBody: Record<string, unknown> = {
        name: `${serverName}_${toolName}`,
        args_summary: argsStr,
        agent_name: "nexus",
        agent_type: "mcp_proxy"
      };
      
      // Reuse session_id to track lethal trifecta across calls
      if (this.sessionId) {
        requestBody.session_id = this.sessionId;
      }

      const response = await fetch(`${managementUrl}/agent/begin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Edison returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();

      // Store session_id for subsequent calls (trifecta tracking)
      if (result.session_id) {
        this.sessionId = result.session_id;
      }

      // Check approval status
      if (!result.ok || result.approved === false) {
        return {
          allowed: false,
          blocked: true,
          reason: result.error || "Operation blocked by Edison security policy"
        };
      }

      return {
        allowed: true,
        sessionBlocked: false
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
