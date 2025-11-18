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

    // Verify server exists
    const { data: server, error: serverError } = await supabaseAdmin
      .from("mcp_servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();

    if (serverError || !server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Install server for user
    const { error: installError } = await supabaseAdmin.from("mcp_server_users").insert({
      user_id: userId,
      server_id: serverId
    });

    if (installError) {
      // If already installed, that's fine
      if (installError.code !== "23505") {
        return NextResponse.json({ error: "Failed to install server" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serverId = params.id;

    // Uninstall server
    const { error: uninstallError } = await supabaseAdmin
      .from("mcp_server_users")
      .delete()
      .eq("user_id", userId)
      .eq("server_id", serverId);

    if (uninstallError) {
      return NextResponse.json({ error: "Failed to uninstall server" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/user/mcp/servers/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

