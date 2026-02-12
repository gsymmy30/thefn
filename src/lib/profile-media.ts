import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

const PROFILE_UPLOAD_ROOT = path.join(process.cwd(), "data", "profile-uploads");

export type SavedProfilePhoto = {
  storagePath: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
};

function extensionFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export function isAllowedProfilePhoto(file: File) {
  return ALLOWED_MIME_TYPES.has(file.type);
}

export async function saveProfilePhotos(userId: string, files: File[]): Promise<SavedProfilePhoto[]> {
  const userDir = path.join(PROFILE_UPLOAD_ROOT, userId);
  await mkdir(userDir, { recursive: true });

  const saved: SavedProfilePhoto[] = [];
  for (const file of files) {
    const ext = extensionFromMime(file.type);
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const absolutePath = path.join(userDir, filename);
    const relativePath = path.join("profile-uploads", userId, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    saved.push({
      storagePath: relativePath,
      mimeType: file.type,
      originalName: file.name || filename,
      sizeBytes: file.size,
    });
  }

  return saved;
}

export async function deleteStoredProfilePhotos(paths: string[]) {
  await Promise.all(
    paths.map(async (storedPath) => {
      const absolutePath = path.join(process.cwd(), "data", storedPath);
      await rm(absolutePath, { force: true });
    })
  );
}
