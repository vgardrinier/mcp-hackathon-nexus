import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

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

    // Only Notion server supports OAuth for now
    if (serverId !== "notion-http") {
      return NextResponse.json({ error: "OAuth not supported for this server" }, { status: 400 });
    }

    const notionClientId = process.env.NOTION_CLIENT_ID;
    if (!notionClientId) {
      return NextResponse.json(
        { error: "Notion OAuth not configured. Missing NOTION_CLIENT_ID" },
        { status: 500 }
      );
    }

    // Generate OAuth state for CSRF protection
    const state = randomBytes(32).toString("hex");
    const stateKey = `oauth_state_${serverId}_${userId}`;

    // Build redirect URI
    const redirectUri = `${req.nextUrl.origin}/api/user/mcp/servers/${serverId}/auth/complete`;

    // Build Notion OAuth URL
    const notionAuthUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    notionAuthUrl.searchParams.set("client_id", notionClientId);
    notionAuthUrl.searchParams.set("redirect_uri", redirectUri);
    notionAuthUrl.searchParams.set("response_type", "code");
    notionAuthUrl.searchParams.set("state", state);
    notionAuthUrl.searchParams.set("owner", "user");

    // Store state in cookie (httpOnly, secure in production)
    const cookieStore = cookies();
    cookieStore.set(stateKey, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/"
    });

    return NextResponse.json({ redirectUrl: notionAuthUrl.toString() }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]/auth/initiate:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

