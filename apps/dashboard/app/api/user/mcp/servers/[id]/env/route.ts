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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serverId = params.id;
    const { envVars } = await req.json();

    if (!envVars || typeof envVars !== "object") {
      return NextResponse.json({ error: "Invalid envVars" }, { status: 400 });
    }

    // Get environment var definitions for this server
    const { data: envVarDefs, error: defsError } = await supabaseAdmin
      .from("mcp_server_environment_vars")
      .select("*")
      .eq("server_id", serverId);

    if (defsError) {
      return NextResponse.json({ error: "Failed to fetch env var definitions" }, { status: 500 });
    }

    // Upsert values
    const upserts = envVarDefs
      ?.filter((def) => envVars[def.key] !== undefined)
      .map((def) => ({
        user_id: userId,
        environment_var_id: def.id,
        value: envVars[def.key] || null
      })) || [];

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("mcp_server_environment_var_values")
        .upsert(upserts, { onConflict: "user_id,environment_var_id" });

      if (upsertError) {
        return NextResponse.json({ error: "Failed to save env vars" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]/env:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

