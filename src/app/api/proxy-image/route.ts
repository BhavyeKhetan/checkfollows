import { NextResponse } from "next/server";
import { getPreviewProvider } from "@/lib/instagram/provider";
import { upsertInstagramTarget } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const username = searchParams.get("username")?.replace(/^@/, "").trim().toLowerCase();

  if (!imageUrl && !username) {
    return new NextResponse("Image URL or username is required", { status: 400 });
  }

  // If local static asset, pass through
  if (imageUrl?.startsWith("/")) {
    return NextResponse.redirect(new URL(imageUrl, request.url));
  }

  // 1. Try fetching imageUrl if provided
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await res.arrayBuffer();

        return new NextResponse(imageBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch (err) {
      console.warn("Direct proxy-image fetch failed:", err);
    }
  }

  // 2. If imageUrl failed (e.g. 403 expired Instagram signature) or wasn't provided, and we have username, fetch fresh profile avatar
  if (username) {
    try {
      const previewProv = getPreviewProvider();
      const freshProfile = await previewProv.fetchProfile(username);
      if (freshProfile?.avatarUrl && freshProfile.avatarUrl !== imageUrl) {
        await upsertInstagramTarget(freshProfile);
        const freshRes = await fetch(freshProfile.avatarUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });

        if (freshRes.ok) {
          const contentType = freshRes.headers.get("content-type") || "image/jpeg";
          const imageBuffer = await freshRes.arrayBuffer();

          return new NextResponse(imageBuffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }
    } catch (refreshErr) {
      console.error("Auto-refresh avatar failed for:", username, refreshErr);
    }
  }

  // Fallback SVG
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100%" height="100%" fill="#EDEDE8"/>
    <circle cx="50" cy="40" r="18" fill="#121212" opacity="0.3"/>
    <path d="M 20 85 C 20 65, 35 55, 50 55 C 65 55, 80 65, 80 85 Z" fill="#121212" opacity="0.3"/>
  </svg>`;

  return new NextResponse(fallbackSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
