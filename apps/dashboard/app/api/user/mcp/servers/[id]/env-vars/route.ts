import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

async function getUserId(req: NextRequest): Promise<string | null> {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    }
  });

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serverId = params.id;

    // Get environment var definitions
    const { data: envVarDefs, error: defsError } = await supabaseAdmin
      .from("mcp_server_environment_vars")
      .select("*")
      .eq("server_id", serverId)
      .order("name");

    if (defsError) {
      return NextResponse.json({ error: "Failed to fetch env var definitions" }, { status: 500 });
    }

    // Get user values
    const envVarIds = envVarDefs?.map((def) => def.id) || [];
    const { data: userValues, error: valuesError } = await supabaseAdmin
      .from("mcp_server_environment_var_values")
      .select("*")
      .eq("user_id", userId)
      .in("environment_var_id", envVarIds);

    if (valuesError) {
      return NextResponse.json({ error: "Failed to fetch user values" }, { status: 500 });
    }

    const valuesMap = new Map(userValues?.map((v) => [v.environment_var_id, v.value]) || []);

    const envVars = envVarDefs?.map((def) => ({
      id: def.id,
      name: def.name,
      key: def.key,
      description: def.description,
      required: def.required,
      value: valuesMap.get(def.id) || null
    }));

    return NextResponse.json({ envVars: envVars || [] }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]/env-vars:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

