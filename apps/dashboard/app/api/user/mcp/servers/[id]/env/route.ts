import { NextResponse } from "next/server";
import { getEnvVarDefs, getLocalUser, upsertEnvVarValues } from "@/lib/localData";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const userId = getLocalUser().id;
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

    const defs = getEnvVarDefs(serverId);
    const updates: Record<string, string | null> = {};
    defs.forEach((def) => {
      if (envVars[def.key] !== undefined) {
        updates[def.key] = envVars[def.key] || null;
      }
    });

    upsertEnvVarValues(userId, serverId, updates);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]/env:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

