import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  createAvatarGeneration,
  isHandleTaken,
  replaceProfilePhotos,
  updateAvatarModelFailed,
  updateAvatarModelReady,
  upsertAvatarModelPending,
  upsertProfile,
} from "@/lib/db";
import {
  deleteStoredProfilePhotos,
  isAllowedProfilePhoto,
  saveProfilePhotos,
} from "@/lib/profile-media";
import {
  MAX_PROFILE_PHOTOS,
  MAX_PROFILE_PHOTO_BYTES,
  MIN_PROFILE_PHOTOS,
} from "@/lib/profile-constants";
import { generateLocalSampleAvatar } from "@/lib/avatar-sample";

export const runtime = "nodejs";

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function normalizeHandle(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/^@+/, "");
  if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function isFileLike(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    "type" in value &&
    "name" in value &&
    "arrayBuffer" in value
  );
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Profile formData parse error:", error);
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const handle = normalizeHandle(formData.get("handle"));
  const displayName = sanitizeText(formData.get("displayName"), 40);
  const bio = sanitizeText(formData.get("bio"), 220);
  const fileEntries = formData
    .getAll("photos")
    .filter((entry): entry is File => isFileLike(entry) && entry.size > 0);

  if (!handle) {
    return NextResponse.json(
      { error: "Handle must be 3-20 chars using letters, numbers, or _" },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (fileEntries.length < MIN_PROFILE_PHOTOS || fileEntries.length > MAX_PROFILE_PHOTOS) {
    return NextResponse.json(
      { error: `Upload ${MIN_PROFILE_PHOTOS}-${MAX_PROFILE_PHOTOS} photos.` },
      { status: 400 }
    );
  }
  if (isHandleTaken(handle, user.userId)) {
    return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
  }

  for (const file of fileEntries) {
    if (!isAllowedProfilePhoto(file)) {
      return NextResponse.json(
        { error: "Photos must be JPEG, PNG, HEIC, HEIF, or WEBP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Each photo must be 12MB or smaller." },
        { status: 400 }
      );
    }
  }

  let savedPaths: string[] = [];
  try {
    const savedPhotos = await saveProfilePhotos(user.userId, fileEntries);
    savedPaths = savedPhotos.map((photo) => photo.storagePath);

    const oldPaths = replaceProfilePhotos(user.userId, savedPhotos);
    upsertProfile({
      userId: user.userId,
      handle,
      displayName,
      fullName: null,
      bio,
    });

    await deleteStoredProfilePhotos(oldPaths);

    // Phase 1 avatar pipeline: mark model pending, generate local sample image, mark ready.
    upsertAvatarModelPending(user.userId, "local-sample-v1");
    createAvatarGeneration({
      userId: user.userId,
      prompt: "sample avatar preview",
      status: "pending",
    });

    const sampleResult = await generateLocalSampleAvatar(user.userId);
    if (sampleResult.ok) {
      updateAvatarModelReady(user.userId, sampleResult.sampleImagePath);
      createAvatarGeneration({
        userId: user.userId,
        prompt: "sample avatar preview",
        status: "ready",
        imagePath: sampleResult.sampleImagePath,
      });
    } else {
      updateAvatarModelFailed(user.userId, sampleResult.error);
      createAvatarGeneration({
        userId: user.userId,
        prompt: "sample avatar preview",
        status: "failed",
        errorMessage: sampleResult.error,
      });
    }
  } catch (error) {
    if (savedPaths.length > 0) {
      await deleteStoredProfilePhotos(savedPaths);
    }
    console.error("Profile save error:", error);
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
