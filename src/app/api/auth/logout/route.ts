import { NextRequest, NextResponse } from "next/server";
import { hashToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { revokeSessionByTokenHash } from "@/lib/db";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    revokeSessionByTokenHash(hashToken(sessionToken));
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
