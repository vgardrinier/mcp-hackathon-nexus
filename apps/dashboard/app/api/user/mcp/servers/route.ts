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

    const result = allServers?.map((server) => ({
      id: server.id,
      name: server.name,
      description: server.description,
      transport: server.transport,
      sourceUrl: server.source_url,
      logoUrl: server.logo_url,
      requiresAuth: server.requires_auth,
      installed: installedServerIds.has(server.id),
      authenticated: authenticatedServerIds.has(server.id)
    }));

    return NextResponse.json(result || [], { status: 200 });
  } catch (error) {
    console.error("Error in /api/user/mcp/servers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

