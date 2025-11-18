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

    // Ensure user exists in users table (in case trigger didn't run)
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingUser) {
      console.log("User not found in users table, creating...");
      // Get user email from auth using the session client
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
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // Generate API key
      const { randomUUID } = await import("crypto");
      const apiKey = randomUUID();
      
      const { error: createUserError } = await supabaseAdmin
        .from("users")
        .insert({
          id: userId,
          email: authUser?.email || null,
          api_key: apiKey
        });

      if (createUserError) {
        console.error("Failed to create user:", createUserError);
        // If it's a unique constraint violation, user might have been created concurrently
        if (createUserError.code !== "23505") {
          return NextResponse.json({ 
            error: "Failed to set up user account",
            details: createUserError.message
          }, { status: 500 });
        }
      } else {
        console.log("User created successfully with API key");
      }
    }

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
    console.log("Installing server:", serverId, "for user:", userId);
    const { error: installError } = await supabaseAdmin.from("mcp_server_users").insert({
      user_id: userId,
      server_id: serverId
    });

    if (installError) {
      console.error("Install error:", installError);
      console.error("Error code:", installError.code);
      console.error("Error message:", installError.message);
      console.error("Error details:", installError.details);
      console.error("Error hint:", installError.hint);
      
      // If already installed, that's fine
      if (installError.code !== "23505") {
        return NextResponse.json({ 
          error: "Failed to install server",
          details: installError.message,
          code: installError.code,
          hint: installError.hint
        }, { status: 500 });
      }
    }
    
    console.log("Server installed successfully");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
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

