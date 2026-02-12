import { NextRequest, NextResponse } from "next/server";
import {
  createSessionForUser,
  getClientIp,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";
import { findOrCreateUserByIdentity, getProfileByUserId } from "@/lib/db";
import {
  getSupabaseEmailFromAccessToken,
  verifySupabaseMagicLink,
} from "@/lib/supabase-auth";
import { consumeDevMagicLink } from "@/lib/db";

const SUPABASE_EMAIL_TYPES = new Set(["magiclink", "signup", "email"]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const tokenHash = typeof body.tokenHash === "string" ? body.tokenHash : null;
  const tokenType = typeof body.type === "string" ? body.type : "magiclink";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : null;

  if (!tokenHash && !accessToken) {
    return NextResponse.json({ error: "Missing callback token" }, { status: 400 });
  }

  try {
    let emailResult: { email: string };
    if (tokenType === "localdev") {
      const devResult = consumeDevMagicLink(tokenHash as string);
      if (!devResult) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
      }
      emailResult = { email: devResult.email };
    } else {
      emailResult = accessToken
        ? await getSupabaseEmailFromAccessToken(accessToken)
        : await verifySupabaseMagicLink(tokenHash as string, tokenType);

      if (!SUPABASE_EMAIL_TYPES.has(tokenType) && !accessToken) {
        return NextResponse.json({ error: "Unsupported callback type" }, { status: 400 });
      }
    }

    const userId = findOrCreateUserByIdentity("email", emailResult.email);
    const profile = getProfileByUserId(userId);

    const sessionToken = createSessionForUser({
      userId,
      ipAddress: getClientIp(request.headers.get("x-forwarded-for")),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({
      success: true,
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
  } catch {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }
}
