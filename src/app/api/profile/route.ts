import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { upsertProfile } from "@/lib/db";

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const displayName = sanitizeText(body.displayName, 40);
  const fullName = sanitizeText(body.fullName, 80);
  const bio = sanitizeText(body.bio, 300);

  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  upsertProfile({
    userId: user.userId,
    displayName,
    fullName,
    bio,
  });

  return NextResponse.json({ success: true });
}
