import { NextRequest, NextResponse } from "next/server";
import {
  findUserByApiKey,
  getAuthTokenForUserServer,
  getEnvVarUserValuesForUser,
  getEnvVarsForServer,
  getInstalledServersForUser
} from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized: Missing API key" }, { status: 401 });
  }

  const apiKey = authHeader.substring("Bearer ".length);

  try {
    const user = await findUserByApiKey(apiKey);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized: Invalid API key" }, { status: 401 });
    }

    const installedServers = await getInstalledServersForUser(user.id);
    const userEnvValues = await getEnvVarUserValuesForUser(user.id);

    const result = await Promise.all(
      installedServers.map(async (server) => {
        const envVarsRaw = await getEnvVarsForServer(server.id);
        const envVars = envVarsRaw.map((envVar) => {
          const userValue = userEnvValues.find(
            (value) => value.environment_var_id === envVar.id && value.user_id === user.id
          );

          return {
            name: envVar.name,
            key: envVar.key,
            description: envVar.description ?? undefined,
            required: envVar.required,
            value: userValue?.value ?? null
          };
        });

        const authToken = await getAuthTokenForUserServer(user.id, server.id);

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
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in /api/external/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


