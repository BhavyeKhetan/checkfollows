import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (hostname === "app.checkfollows.com" && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/account", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
