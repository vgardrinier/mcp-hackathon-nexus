import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, mode: "local" }, { status: 200 });
}
