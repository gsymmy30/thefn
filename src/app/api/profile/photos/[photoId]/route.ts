import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getProfilePhotoByIdForUser } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ photoId: string }> }
) {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authUser = getAuthenticatedUserFromToken(cookieToken);
  if (!authUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { photoId } = await context.params;
  const photo = getProfilePhotoByIdForUser(photoId, authUser.userId);
  if (!photo) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const absolutePath = path.join(process.cwd(), "data", photo.storage_path);
    const file = await readFile(absolutePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": photo.mime_type,
        "Content-Length": String(file.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
