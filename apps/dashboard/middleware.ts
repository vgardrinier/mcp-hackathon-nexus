import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Local-only mode: no auth/session syncing required
  return NextResponse.next({
    request: {
      headers: request.headers
    }
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/user/:path*"
  ]
};

