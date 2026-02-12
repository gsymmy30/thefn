import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getAvatarModelByUserId } from "@/lib/db";

export const runtime = "nodejs";

function mimeTypeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  if (ext === ".heif") return "image/heif";
  return "image/jpeg";
}

export async function GET(request: NextRequest) {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authUser = getAuthenticatedUserFromToken(cookieToken);
  if (!authUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const model = getAvatarModelByUserId(authUser.userId);
  if (!model?.sample_image_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const absolutePath = path.join(process.cwd(), "data", model.sample_image_path);
    const file = await readFile(absolutePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": mimeTypeFromPath(model.sample_image_path),
        "Content-Length": String(file.byteLength),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
