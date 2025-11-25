import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  console.warn(
    "OAuth callback called for server",
    params.id,
    "but OAuth is disabled in local mode."
  );
  return NextResponse.json(
    { error: "OAuth disabled in local mode. Use manual token or env vars." },
    { status: 400 }
  );
}
