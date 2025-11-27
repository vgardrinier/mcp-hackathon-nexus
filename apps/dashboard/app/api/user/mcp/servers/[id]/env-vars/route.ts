import { NextResponse } from "next/server";
import { getServerConfig, getResolvedEnvVars } from "@/lib/yamlConfig";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = context.params;
    const resolvedParams = params instanceof Promise ? await params : params;
    const serverId = resolvedParams.id;

    if (!serverId) {
      return NextResponse.json({ error: "Missing server ID" }, { status: 400 });
    }

    const server = getServerConfig(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const resolvedValues = getResolvedEnvVars(server);

    // Transform to match expected format
    const envVars = (server.env || []).map((envVar) => ({
      id: `${serverId}-${envVar.key}`,
      name: envVar.name || envVar.key,
      key: envVar.key,
      description: envVar.description || null,
      required: envVar.required || false,
      value: resolvedValues[envVar.key] || null
    }));

    return NextResponse.json({ envVars }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]/env-vars:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
