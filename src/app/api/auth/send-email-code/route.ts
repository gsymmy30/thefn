import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth";
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

  try {
    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin).toString();
    await sendSupabaseMagicLink(normalized, callbackUrl);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Supabase send-magic-link error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
