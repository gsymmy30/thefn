import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const { phone } = await request.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  // Strip all non-digit chars, then ensure +1 prefix
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
    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: normalized, channel: "sms" });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Twilio send-code error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
