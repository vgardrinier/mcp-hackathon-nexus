import { NextResponse } from "next/server";
import { getLocalUser, saveAuthToken } from "@/lib/localData";

/**
 * POST /api/user/mcp/servers/[id]/auth/manual-token
 *
 * Manually set an access token for a server (local storage, no OAuth).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getLocalUser().id;
    const serverId = params.id;
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    saveAuthToken(userId, serverId, token.trim());

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

