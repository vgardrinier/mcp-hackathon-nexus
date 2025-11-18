import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/db/supabaseClient";

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
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const serverId = params.id;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=missing_params`, req.url)
      );
    }

    // Verify state from cookie (CSRF protection)
    const cookieStore = cookies();
    const stateKey = `oauth_state_${serverId}_${userId}`;
    const storedState = cookieStore.get(stateKey)?.value;

    if (!storedState || storedState !== state) {
      console.error("OAuth state mismatch");
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=invalid_state`, req.url)
      );
    }

    // Clear state cookie
    cookieStore.delete(stateKey);

    // Only Notion server supports OAuth for now
    if (serverId !== "notion-http") {
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=unsupported`, req.url)
      );
    }

    const notionClientId = process.env.NOTION_CLIENT_ID;
    const notionClientSecret = process.env.NOTION_CLIENT_SECRET;

    if (!notionClientId || !notionClientSecret) {
      console.error("Notion OAuth credentials not configured");
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=not_configured`, req.url)
      );
    }

    // Exchange code for tokens
    const redirectUri = `${req.nextUrl.origin}/api/user/mcp/servers/${serverId}/auth/complete`;

    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${notionClientId}:${notionClientSecret}`).toString("base64")}`
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorText);
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=token_exchange_failed`, req.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, bot_id, workspace_id, workspace_name } = tokenData;

    if (!access_token) {
      console.error("No access token in response:", tokenData);
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=no_token`, req.url)
      );
    }

    // Calculate expiration (Notion tokens don't expire, but we'll set a far future date)
    // Notion access tokens are long-lived, but we'll refresh after 1 year to be safe
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Store tokens in database
    const { error: dbError } = await supabaseAdmin.from("mcp_server_user_auth_tokens").upsert(
      {
        user_id: userId,
        server_id: serverId,
        access_token: access_token,
        refresh_token: null, // Notion doesn't provide refresh tokens
        access_token_expires_at: expiresAt.toISOString()
      },
      { onConflict: "user_id,server_id" }
    );

    if (dbError) {
      console.error("Failed to store tokens:", dbError);
      return NextResponse.redirect(
        new URL(`/dashboard/servers/${serverId}?oauth_error=storage_failed`, req.url)
      );
    }

    // Success! Redirect back to server detail page
    return NextResponse.redirect(
      new URL(`/dashboard/servers/${serverId}?oauth=success&workspace=${workspace_name || workspace_id}`, req.url)
    );
  } catch (error) {
    console.error("Error in GET /api/user/mcp/servers/[id]/auth/complete:", error);
    return NextResponse.redirect(
      new URL(`/dashboard/servers/${params.id}?oauth_error=internal_error`, req.url)
    );
  }
}

