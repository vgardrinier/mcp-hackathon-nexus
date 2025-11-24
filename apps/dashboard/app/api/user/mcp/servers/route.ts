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

    // Try to get session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (session?.user) {
      return session.user.id;
    }

    // If no session, try getUser (which validates the token)
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Auth error:", error.message);
      return null;
    }
    
    return user?.id || null;
  } catch (error) {
    console.error("Error in getUserId:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all available servers
    const { data: allServers, error: serversError } = await supabaseAdmin
      .from("mcp_servers")
      .select("*")
      .order("name");

    if (serversError) {
      return NextResponse.json({ error: "Failed to fetch servers" }, { status: 500 });
    }

    // Get installed servers for user
    const { data: installedServers, error: installedError } = await supabaseAdmin
      .from("mcp_server_users")
      .select("server_id")
      .eq("user_id", userId);

    if (installedError) {
      return NextResponse.json({ error: "Failed to fetch installed servers" }, { status: 500 });
    }

    const installedServerIds = new Set(installedServers?.map((s) => s.server_id) || []);

    // Get auth status for installed servers
    const { data: authTokens, error: authError } = await supabaseAdmin
      .from("mcp_server_user_auth_tokens")
      .select("server_id")
      .eq("user_id", userId);

    if (authError) {
      return NextResponse.json({ error: "Failed to fetch auth tokens" }, { status: 500 });
    }

    const authenticatedServerIds = new Set(authTokens?.map((t) => t.server_id) || []);

    // Fetch all env var records to check required env vars for STDIO servers
    const { data: allEnvVars, error: allEnvVarsError } = await supabaseAdmin
      .from("mcp_server_environment_vars")
      .select("id, server_id, required");

    if (allEnvVarsError) {
      console.error("Failed to fetch all env vars:", allEnvVarsError);
    }

    // Build map: server_id -> array of required env var IDs
    const serverRequiredEnvVarIds = new Map<string, string[]>();
    allEnvVars?.forEach((envVar) => {
      if (envVar.required) {
        if (!serverRequiredEnvVarIds.has(envVar.server_id)) {
          serverRequiredEnvVarIds.set(envVar.server_id, []);
        }
        serverRequiredEnvVarIds.get(envVar.server_id)!.push(envVar.id);
      }
    });

    // Get user env var values with their env var IDs
    const { data: userEnvVarValues, error: userEnvVarValuesError } = await supabaseAdmin
      .from("mcp_server_environment_var_values")
      .select("environment_var_id, value")
      .eq("user_id", userId);

    if (userEnvVarValuesError) {
      console.error("Failed to fetch user env var values:", userEnvVarValuesError);
    }

    const userEnvVarValuesMap = new Map(
      userEnvVarValues?.map((v) => [v.environment_var_id, v.value]) || []
    );

    const result = allServers?.map((server) => {
      const installed = installedServerIds.has(server.id);
      const authenticated = authenticatedServerIds.has(server.id);
      
      // For STDIO servers, check if all required env vars are set
      let configured = false;
      if (installed) {
        if (server.transport === "stdio") {
          const requiredEnvVarIds = serverRequiredEnvVarIds.get(server.id) || [];
          if (requiredEnvVarIds.length === 0) {
            // No required env vars, so it's configured
            configured = true;
          } else {
            // Check if all required env vars have non-empty values
            configured = requiredEnvVarIds.every((envVarId) => {
              const value = userEnvVarValuesMap.get(envVarId);
              return value != null && value.trim() !== "";
            });
          }
        } else if (server.transport === "streamable-http") {
          // For HTTP servers, configured = authenticated (if requiresAuth) or always true (if not)
          configured = server.requires_auth ? authenticated : true;
        } else {
          configured = true;
        }
      }

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        transport: server.transport,
        sourceUrl: server.source_url,
        logoUrl: server.logo_url,
        requiresAuth: server.requires_auth,
        installed,
        authenticated,
        configured
      };
    });

    return NextResponse.json(result || [], { status: 200 });
  } catch (error) {
    console.error("Error in /api/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

