import { NextRequest, NextResponse } from "next/server";
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
    const installedServerIds = getInstalledServerIds(user.id);
    const servers = listServers().filter((s) => installedServerIds.has(s.id));
    const userEnvValues = servers.flatMap((server) => getEnvVarValues(user.id, server.id));

    const result = servers.map((server) => {
      const envVarDefs = getEnvVarDefs(server.id);
      const envVars = envVarDefs.map((envVar) => {
        const userValue = userEnvValues.find((value) => value.environment_var_id === envVar.id);
        return {
          name: envVar.name,
          key: envVar.key,
          description: envVar.description ?? undefined,
          required: envVar.required,
          value: userValue?.value ?? null
        };
      });

      const authToken = getAuthToken(user.id, server.id);

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        sourceUrl: server.source_url,
        installedOn: new Date().toISOString(),
        logoUrl: server.logo_url,
        requiresAuth: server.requires_auth,
        config:
          server.transport === "stdio"
            ? {
                transport: "stdio" as const,
                command: server.command ?? "node",
                args: server.args ?? [],
                env: envVars.reduce<Record<string, string>>((acc, envVar) => {
                  if (envVar.value != null) {
                    acc[envVar.key] = envVar.value;
                  }
                  return acc;
                }, {})
              }
            : {
                transport: "streamable-http" as const,
                url: server.url ?? ""
              },
        environmentVariables: envVars,
        accessToken: authToken?.access_token,
        accessTokenExpiresAt: authToken?.access_token_expires_at ?? null
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in /api/external/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


