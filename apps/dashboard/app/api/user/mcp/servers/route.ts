import { NextResponse } from "next/server";
import {
  listAvailableServers,
  isServerConfigured,
  getResolvedEnvVars
} from "@/lib/yamlConfig";

export async function GET() {
  try {
    const servers = listAvailableServers();

    const result = servers.map((server) => {
      const configured = isServerConfigured(server);
      const resolvedEnvVars = getResolvedEnvVars(server);

      // Check if authenticated (has access token or all env vars filled)
      const authenticated = server.config.transport === "streamable-http"
        ? Boolean(server.accessToken || server.accessTokenFromEnv)
        : configured;

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        transport: server.config.transport,
        sourceUrl: server.sourceUrl,
        logoUrl: server.logoUrl,
        requiresAuth: server.requiresAuth,
        installed: true, // All servers in ~/.config/nexus are "installed"
        authenticated,
        configured
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
