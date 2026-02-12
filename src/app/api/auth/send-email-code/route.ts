import { NextRequest, NextResponse } from "next/server";
import {
  createSessionForUser,
  getClientIp,
  isValidEmail,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";
import {
  consumeEmailMagicLinkRateLimit,
  findOrCreateUserByIdentity,
  getProfileByUserId,
} from "@/lib/db";
import { sendSupabaseMagicLink } from "@/lib/supabase-auth";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const ipAddress = getClientIp(request.headers.get("x-forwarded-for"));
  const rateLimit = consumeEmailMagicLinkRateLimit(normalized, ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  const authProvider = process.env.AUTH_PROVIDER?.trim().toLowerCase() || "supabase";
  if (authProvider === "local") {
    const userId = findOrCreateUserByIdentity("email", normalized);
    const profile = getProfileByUserId(userId);
    const sessionToken = createSessionForUser({
      userId,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({
      success: true,
      devMode: true,
      nextPath: profile ? "/dashboard" : "/profile/create",
    });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return response;
  }

  try {
    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin).toString();
    await sendSupabaseMagicLink(normalized, callbackUrl);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Supabase send-magic-link error:", message);
    if (message.toLowerCase().includes("rate")) {
      return NextResponse.json(
        {
          error: "Email provider rate limit reached. Please wait 60s and try again.",
          retryAfterSeconds: 60,
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
