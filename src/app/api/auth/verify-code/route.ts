import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const { phone, code } = await request.json();

  if (!phone || !code) {
    return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
  }

  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifySid) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  const client = twilio(accountSid, authToken);

  try {
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: normalized, code });

    if (check.status !== "approved") {
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("session_phone", normalized, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
