import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/yamlConfig";

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

    return NextResponse.json(server, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Note: We removed POST (install) and DELETE (uninstall) since all servers
// in ~/.config/nexus are already "installed" and available.
// Users just configure them instead.
