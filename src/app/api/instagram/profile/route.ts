import { NextResponse } from "next/server";
import { fetchInstagramProfile } from "@/lib/apify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 });
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
    return NextResponse.json({ success: false, error: "Invalid Instagram username" }, { status: 400 });
  }

  try {
    const result = await fetchInstagramProfile(cleanUsername);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch profile" }, { status: 500 });
  }
}
