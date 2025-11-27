import { NextResponse } from "next/server";
import { getServerConfig, updateServerEnvVars } from "@/lib/yamlConfig";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = context.params;
    const resolvedParams = params instanceof Promise ? await params : params;
    const serverId = resolvedParams.id;

    if (!serverId) {
      return NextResponse.json({ error: "Missing server ID" }, { status: 400 });
    }

    const { envVars } = await req.json();
    if (!envVars || typeof envVars !== "object") {
      return NextResponse.json({ error: "Invalid envVars" }, { status: 400 });
    }

    const server = getServerConfig(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Update env vars in YAML
    const success = updateServerEnvVars(serverId, envVars);

    if (!success) {
      return NextResponse.json({ error: "Failed to update env vars" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]/env:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
