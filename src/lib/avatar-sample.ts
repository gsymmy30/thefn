import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { listProfilePhotosByUserId } from "@/lib/db";

type LocalSampleResult =
  | { ok: true; sampleImagePath: string }
  | { ok: false; error: string };

function extensionFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return ".jpg";
  return ext;
}

export async function generateLocalSampleAvatar(userId: string): Promise<LocalSampleResult> {
  const photos = listProfilePhotosByUserId(userId);
  if (photos.length === 0) {
    return { ok: false, error: "No profile photos found" };
  }

  const source = photos[0];
  const sourceAbs = path.join(process.cwd(), "data", source.storage_path);
  const dir = path.join(process.cwd(), "data", "avatar-samples", userId);
  await mkdir(dir, { recursive: true });

  const filename = `sample-${Date.now()}-${randomUUID()}${extensionFromPath(source.storage_path)}`;
  const targetAbs = path.join(dir, filename);
  await copyFile(sourceAbs, targetAbs);

  return {
    ok: true,
    sampleImagePath: path.join("avatar-samples", userId, filename),
  };
}
