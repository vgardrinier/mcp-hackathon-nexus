import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/db/supabaseClient";

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

/**
 * POST /api/user/mcp/servers/[id]/auth/manual-token
 * 
 * Manually set a Notion integration token (secret_*) bypassing OAuth.
 * This is needed because Notion OAuth returns ntn_* tokens that don't work with the MCP server.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serverId = params.id;
    
    // Only allow for Notion server
    if (serverId !== "notion-http") {
      return NextResponse.json(
        { error: "Manual token setting only supported for Notion server" },
        { status: 400 }
      );
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const trimmedToken = token.trim();

    // Validate token format - must start with secret_
    if (!trimmedToken.startsWith("secret_")) {
      return NextResponse.json(
        { 
          error: "Invalid token format. Notion integration tokens must start with 'secret_'",
          hint: "Get your integration token from https://www.notion.so/my-integrations"
        },
        { status: 400 }
      );
    }

    // Set expiration far in the future (Notion integration tokens don't expire)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);

    // Store token in database
    const { error: dbError } = await supabaseAdmin
      .from("mcp_server_user_auth_tokens")
      .upsert(
        {
          user_id: userId,
          server_id: serverId,
          access_token: trimmedToken,
          refresh_token: null,
          access_token_expires_at: expiresAt.toISOString()
        },
        { onConflict: "user_id,server_id" }
      );

    if (dbError) {
      console.error("Failed to store manual token:", dbError);
      return NextResponse.json(
        { error: "Failed to store token", details: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        message: "Integration token stored successfully. Restart the MCP server to use it."
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/user/mcp/servers/[id]/auth/manual-token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

