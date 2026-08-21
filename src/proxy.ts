import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0].toLowerCase();
  const pathname = request.nextUrl.pathname;
  const isAppHost = hostname === "app.checkfollows.com";
  const isMarketingHost =
    hostname === "checkfollows.com" || hostname === "www.checkfollows.com";
  const isProductPath =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/track/") ||
    pathname.startsWith("/app/");

  // Authentication must happen on the app origin so Supabase's session
  // cookies are created on the same origin that serves the paid product.
  if (isMarketingHost && isProductPath) {
    const destination = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      "https://app.checkfollows.com"
    );
    return NextResponse.redirect(destination);
  }

  if (isAppHost && pathname === "/") {
    return NextResponse.rewrite(new URL("/dashboard", request.url));
  }

  // Keep the app subdomain product-only. Public marketing, legal, pricing,
  // and SEO pages stay on www.checkfollows.com.
  if (isAppHost && !isProductPath) {
    const destination = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      "https://www.checkfollows.com"
    );
    return NextResponse.redirect(destination);
  }

  const response = NextResponse.next();
  if (isAppHost) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
