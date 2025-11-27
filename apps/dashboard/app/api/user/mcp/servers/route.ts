import { NextResponse } from "next/server";
import {
  getAuthToken,
  getEnvVarDefs,
  getEnvVarValues,
  getInstalledServerIds,
  getLocalUser,
  listServers
} from "@/lib/localData";

export async function GET() {
  try {
    const user = getLocalUser();
    const servers = listServers();
    const installedServerIds = getInstalledServerIds(user.id);
    const userEnvVarValues = new Map(
      servers.flatMap((server) =>
        getEnvVarValues(user.id, server.id).map((v) => [v.environment_var_id, v.value])
      )
    );

    const result = servers.map((server) => {
      const installed = installedServerIds.has(server.id);
      const authToken = getAuthToken(user.id, server.id);
      const envVarDefs = getEnvVarDefs(server.id);

      let configured = false;
      if (installed) {
        if (server.transport === "stdio") {
          const requiredEnvVarIds = envVarDefs.filter((v) => v.required).map((v) => v.id);
          configured =
            requiredEnvVarIds.length === 0 ||
            requiredEnvVarIds.every((id) => {
              const value = userEnvVarValues.get(id);
              return value != null && value.toString().trim() !== "";
            });
        } else if (server.transport === "streamable-http") {
          configured = server.requires_auth ? Boolean(authToken) : true;
        } else {
          configured = true;
        }
      }

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        transport: server.transport,
        sourceUrl: server.source_url,
        logoUrl: server.logo_url,
        requiresAuth: server.requires_auth,
        installed,
        authenticated: Boolean(authToken),
        configured
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in /api/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

