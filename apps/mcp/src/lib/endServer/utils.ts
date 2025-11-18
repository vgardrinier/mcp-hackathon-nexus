import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  EndServerConfig,
  EndServerEnvVariable,
  EndServerTransport,
  EndServerTransportType
} from "./types.js";
import { AuthenticatedStreamableHTTPClientTransport } from "./transport.js";

/**
 * Verifies that all required environment variables are present.
 */
export function verifyEnvironmentVariables(environmentVariables: EndServerEnvVariable[]): boolean {
  return environmentVariables.every((envVar) => !envVar.required || envVar.value !== undefined);
}

/**
 * Creates the appropriate MCP transport for a configured end server.
 */
export async function createServerTransport(
  serverConfig: EndServerConfig,
  accessToken?: string
): Promise<EndServerTransport> {
  switch (serverConfig.transport) {
    case EndServerTransportType.STDIO:
      return new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        ...(serverConfig.env &&
          Object.keys(serverConfig.env).length > 0 && {
            env: {
              ...process.env,
              ...serverConfig.env
            } as Record<string, string>
          })
      });

    case EndServerTransportType.STREAMABLE_HTTP:
      const url = typeof serverConfig.url === "string" ? new URL(serverConfig.url) : serverConfig.url;
      return new AuthenticatedStreamableHTTPClientTransport(url, accessToken);

    default:
      throw new Error(`Unsupported transport: ${(serverConfig as EndServerConfig).transport}`);
  }
}

/**
 * Utility for checking if an access token has expired.
 */
export function isAccessTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;

  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  return expirationDate.getTime() - bufferMs <= now.getTime();
}


