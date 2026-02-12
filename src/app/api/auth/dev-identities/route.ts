import { NextResponse } from "next/server";
import { listRecentEmailIdentities } from "@/lib/db";

export async function GET() {
  const authProvider = process.env.AUTH_PROVIDER?.trim().toLowerCase() || "supabase";

  if (authProvider !== "local") {
    return NextResponse.json({ enabled: false, emails: [] });
  }

  const identities = listRecentEmailIdentities(12).map((item) => ({
    email: item.email,
    label: item.display_name ? `${item.display_name} (${item.email})` : item.email,
  }));

  return NextResponse.json({ enabled: true, emails: identities });
}
