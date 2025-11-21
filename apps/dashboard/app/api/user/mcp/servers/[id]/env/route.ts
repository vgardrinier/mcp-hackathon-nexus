import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabaseClient";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      return session.user.id;
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return user.id;
  } catch (error) {
    console.error("Error in getUserId:", error);
    return null;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle params as Promise (Next.js 15) or object (Next.js 14)
    const params = context.params;
    const resolvedParams = params instanceof Promise ? await params : params;
    const serverId = resolvedParams.id;
    
    if (!serverId) {
      return NextResponse.json({ error: "Missing server ID" }, { status: 400 });
    }

    const { envVars } = await req.json();
    console.log("Saving env vars for server:", serverId, "user:", userId);
    console.log("Env vars received:", Object.keys(envVars || {}));

    if (!envVars || typeof envVars !== "object") {
      return NextResponse.json({ error: "Invalid envVars" }, { status: 400 });
    }

    // Get environment var definitions for this server
    const { data: envVarDefs, error: defsError } = await supabaseAdmin
      .from("mcp_server_environment_vars")
      .select("*")
      .eq("server_id", serverId);

    if (defsError) {
      console.error("Failed to fetch env var definitions:", defsError);
      return NextResponse.json({ error: "Failed to fetch env var definitions", details: defsError.message }, { status: 500 });
    }

    console.log("Found env var definitions:", envVarDefs?.length || 0);

    // Upsert values
    const upserts = envVarDefs
      ?.filter((def) => envVars[def.key] !== undefined)
      .map((def) => ({
        user_id: userId,
        environment_var_id: def.id,
        value: envVars[def.key] || null
      })) || [];

    console.log("Upserting", upserts.length, "env var values");

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("mcp_server_environment_var_values")
        .upsert(upserts, { onConflict: "user_id,environment_var_id" });

      if (upsertError) {
        console.error("Failed to upsert env vars:", upsertError);
        console.error("Error code:", upsertError.code);
        console.error("Error message:", upsertError.message);
        return NextResponse.json({ error: "Failed to save env vars", details: upsertError.message }, { status: 500 });
      }
      
      console.log("Successfully saved env vars");
    } else {
      console.log("No env vars to save");
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]/env:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

