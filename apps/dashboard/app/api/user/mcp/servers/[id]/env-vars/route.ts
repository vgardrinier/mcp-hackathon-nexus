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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
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

    // Get environment var definitions
    console.log("Fetching env vars for server:", serverId);
    const { data: envVarDefs, error: defsError } = await supabaseAdmin
      .from("mcp_server_environment_vars")
      .select("*")
      .eq("server_id", serverId)
      .order("name");

    if (defsError) {
      console.error("Failed to fetch env var definitions:", defsError);
      console.error("Error code:", defsError.code);
      console.error("Error message:", defsError.message);
      console.error("Error details:", defsError.details);
      console.error("Error hint:", defsError.hint);
      return NextResponse.json({ 
        error: "Failed to fetch env var definitions", 
        details: defsError.message,
        code: defsError.code,
        hint: defsError.hint
      }, { status: 500 });
    }
    
    console.log("Found env var definitions:", envVarDefs?.length || 0);

    // Get user values (only if there are env var definitions)
    const envVarIds = envVarDefs?.map((def) => def.id) || [];
    let userValues: any[] = [];
    
    if (envVarIds.length > 0) {
      const { data, error: valuesError } = await supabaseAdmin
        .from("mcp_server_environment_var_values")
        .select("*")
        .eq("user_id", userId)
        .in("environment_var_id", envVarIds);

      if (valuesError) {
        console.error("Failed to fetch user values:", valuesError);
        return NextResponse.json({ error: "Failed to fetch user values", details: valuesError.message }, { status: 500 });
      }
      
      userValues = data || [];
    }

    const valuesMap = new Map(userValues.map((v) => [v.environment_var_id, v.value]));

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
    console.error("Error type:", typeof error);
    console.error("Error instanceof Error:", error instanceof Error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Error stringified:", JSON.stringify(error, null, 2));
    }
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error),
      type: typeof error
    }, { status: 500 });
  }
}

