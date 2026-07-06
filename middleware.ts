import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const apiKey = process.env.AGENT_API_KEY;
  const requestHeaders = new Headers(request.headers);
  if (apiKey) {
    requestHeaders.set("x-api-key", apiKey);
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/eve/:path*"],
};
