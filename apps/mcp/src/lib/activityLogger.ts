import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ToolCallLog {
  timestamp: string;
  serverName: string;
  serverId: string;
  toolName: string;
  action: string; // "read", "write", "search", "list", "create", "update", "delete", etc.
  parameters: Record<string, unknown>;
  result?: {
    success: boolean;
    summary: string;
    data?: unknown;
  };
  error?: string;
  duration?: number; // ms
}

const LOG_DIR = join(homedir(), ".config", "nexus", "logs");
const LOG_FILE = join(LOG_DIR, "activity.jsonl");

/**
 * ActivityLogger: Human-readable audit trail of all MCP tool calls
 * - Logs every tool invocation with context
 * - Generic format that works for any MCP server
 * - Stores as JSON Lines for easy parsing
 */
export class ActivityLogger {
  private static instance: ActivityLogger;

  private constructor() {
    this.ensureLogDir();
  }

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  private async ensureLogDir() {
    try {
      await mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
      console.error(
        `\x1B[91m[ActivityLogger] Failed to create log directory: ${
          error instanceof Error ? error.message : String(error)
        }\x1B[0m`
      );
    }
  }

  /**
   * Extract action verb from tool name
   * Examples:
   *   - github_search_repositories -> "search"
   *   - linear_create_issue -> "create"
   *   - supabase_list_projects -> "list"
   */
  private extractAction(toolName: string): string {
    const actionVerbs = [
      "search",
      "list",
      "get",
      "read",
      "fetch",
      "create",
      "update",
      "delete",
      "remove",
      "modify",
      "edit",
      "write",
      "add",
      "set",
      "push",
      "pull",
      "clone",
      "fork",
      "star",
      "unstar",
      "watch",
      "unwatch",
      "close",
      "open",
      "merge",
      "rebase",
      "commit",
      "branch",
      "tag",
      "run",
      "execute",
      "query",
      "find",
    ];

    const lowerName = toolName.toLowerCase();
    for (const verb of actionVerbs) {
      if (lowerName.includes(verb)) {
        return verb;
      }
    }

    return "call"; // fallback
  }

  /**
   * Extract resource from tool name
   * Examples:
   *   - github_search_repositories -> "repositories"
   *   - linear_create_issue -> "issue"
   */
  private extractResource(toolName: string): string {
    const parts = toolName.split("_");
    // Skip first part (server prefix) and action verbs
    const resourceParts = parts.filter((part) => {
      const actionVerbs = ["search", "list", "get", "create", "update", "delete", "read", "fetch"];
      return !actionVerbs.includes(part.toLowerCase());
    });

    return resourceParts.slice(1).join(" ") || "resource";
  }

  /**
   * Format parameters in a human-readable way
   */
  private formatParams(params: Record<string, unknown>): string {
    const important = [];

    // Extract commonly important params
    if (params.query || params.q) {
      important.push(`query: "${params.query || params.q}"`);
    }
    if (params.owner) {
      important.push(`owner: ${params.owner}`);
    }
    if (params.repo) {
      important.push(`repo: ${params.repo}`);
    }
    if (params.number) {
      important.push(`#${params.number}`);
    }
    if (params.title) {
      important.push(`title: "${params.title}"`);
    }
    if (params.id) {
      important.push(`id: ${params.id}`);
    }
    if (params.name) {
      important.push(`name: ${params.name}`);
    }
    if (params.path) {
      important.push(`path: ${params.path}`);
    }

    if (important.length > 0) {
      return important.join(", ");
    }

    // Fallback: show first few params
    const keys = Object.keys(params).slice(0, 3);
    if (keys.length === 0) return "no parameters";

    return keys
      .map((key) => {
        const val = params[key];
        if (typeof val === "string") {
          return `${key}: "${val.substring(0, 50)}${val.length > 50 ? "..." : ""}"`;
        }
        return `${key}: ${JSON.stringify(val).substring(0, 50)}`;
      })
      .join(", ");
  }

  /**
   * Summarize result data in a human-friendly way
   */
  private summarizeResult(result: unknown, toolName: string): string {
    if (!result || typeof result !== "object") {
      return "completed";
    }

    const data = result as Record<string, unknown>;

    // Handle MCP standard response format
    if (Array.isArray(data.content)) {
      const content = data.content as Array<{ type: string; text?: string }>;
      const textContent = content.find((c) => c.type === "text")?.text;
      if (textContent) {
        try {
          const parsed = JSON.parse(textContent);
          return this.summarizeResult(parsed, toolName);
        } catch {
          // Plain text response
          const preview = textContent.substring(0, 100);
          return preview.length < textContent.length ? `${preview}...` : preview;
        }
      }
    }

    // Count results
    if (Array.isArray(data)) {
      return `found ${data.length} item${data.length !== 1 ? "s" : ""}`;
    }

    // Check for common array fields
    const arrayFields = [
      "items",
      "results",
      "repositories",
      "issues",
      "pull_requests",
      "projects",
      "teams",
      "users",
    ];
    for (const field of arrayFields) {
      if (Array.isArray(data[field])) {
        return `found ${(data[field] as unknown[]).length} ${field}`;
      }
    }

    // Check for success/created/updated flags
    if (data.success === true) return "success";
    if (data.created) return "created successfully";
    if (data.updated) return "updated successfully";
    if (data.deleted) return "deleted successfully";

    // Check for ID (created resource)
    if (data.id) return `created with id: ${data.id}`;

    // Fallback
    return "completed";
  }

  /**
   * Log a tool call start
   */
  async logToolCall(
    serverName: string,
    serverId: string,
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<{ complete: (result?: unknown, error?: string, duration?: number) => Promise<void> }> {
    const startTime = Date.now();
    const action = this.extractAction(toolName);
    const resource = this.extractResource(toolName);

    const log: ToolCallLog = {
      timestamp: new Date().toISOString(),
      serverName,
      serverId,
      toolName,
      action,
      parameters,
    };

    // Log to console immediately
    const paramsStr = this.formatParams(parameters);
    console.log(
      `\x1B[96m[Activity] ${serverName}: ${action} ${resource}${paramsStr ? ` (${paramsStr})` : ""}\x1B[0m`
    );

    return {
      complete: async (result?: unknown, error?: string, duration?: number) => {
        log.duration = duration || Date.now() - startTime;

        if (error) {
          log.error = error;
          console.log(`\x1B[91m[Activity] ✗ Failed: ${error}\x1B[0m`);
        } else {
          const summary = this.summarizeResult(result, toolName);
          log.result = {
            success: true,
            summary,
            data: result,
          };
          console.log(`\x1B[92m[Activity] ✓ ${summary}\x1B[0m`);
        }

        // Write to log file
        try {
          await appendFile(LOG_FILE, JSON.stringify(log) + "\n");
        } catch (writeError) {
          console.error(
            `\x1B[91m[ActivityLogger] Failed to write log: ${
              writeError instanceof Error ? writeError.message : String(writeError)
            }\x1B[0m`
          );
        }
      },
    };
  }

  /**
   * Get path to log file (for CLI to read)
   */
  static getLogFilePath(): string {
    return LOG_FILE;
  }
}
