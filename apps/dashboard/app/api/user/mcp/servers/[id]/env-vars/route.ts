import { NextResponse } from "next/server";
import { getEnvVarDefs, getEnvVarValues, getLocalUser } from "@/lib/localData";

export async function GET(
  _req: Request,
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

    const envVarDefs = getEnvVarDefs(serverId);
    const userValues = getEnvVarValues(userId, serverId);
    const valuesMap = new Map(userValues.map((v) => [v.environment_var_id, v.value]));

    const envVars = envVarDefs.map((def) => ({
      id: def.id,
      name: def.name,
      key: def.key,
      description: def.description,
      required: def.required,
      value: valuesMap.get(def.id) || null
    }));

    return NextResponse.json({ envVars }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]/env-vars:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

