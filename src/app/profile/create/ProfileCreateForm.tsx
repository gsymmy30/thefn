"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_PROFILE_PHOTO_BYTES,
  MAX_PROFILE_PHOTOS,
  MIN_PROFILE_PHOTOS,
} from "@/lib/profile-constants";

export default function ProfileCreateForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const previewUrls = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  );
  const photoCountOk = photos.length >= MIN_PROFILE_PHOTOS && photos.length <= MAX_PROFILE_PHOTOS;

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList).slice(0, MAX_PROFILE_PHOTOS);
    setPhotos(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tooLarge = photos.find((photo) => photo.size > MAX_PROFILE_PHOTO_BYTES);
      if (tooLarge) {
        setError("Each photo must be 12MB or smaller.");
        return;
      }

      const form = new FormData();
      form.append("handle", handle.trim().replace(/^@+/, ""));
      form.append("displayName", displayName);
      form.append("bio", bio);
      photos.forEach((photo) => {
        form.append("photos", photo);
      });

      const res = await fetch("/api/profile", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        let message = "Failed to save profile";
        try {
          const data = (await res.json()) as { error?: string };
          message = data.error || message;
        } catch {
          try {
            const text = await res.text();
            if (text) message = text.slice(0, 160);
          } catch {
            message = "Failed to save profile";
          }
        }
        setError(message);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Failed to save profile. Try fewer/smaller images.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/");
      router.refresh();
    } catch {
      setError("Failed to log out");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-up delay-2 mt-8 flex w-full max-w-md flex-col gap-4">
      <div className="space-y-2">
        <label className="font-body text-[0.65rem] tracking-[0.2em] uppercase text-white/35">
          @ handle
        </label>
        <div className="glass flex items-center rounded-2xl px-5 py-3">
          <span className="mr-2 font-body text-sm text-white/45">@</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="yourhandle"
            className="w-full bg-transparent font-body text-sm text-white placeholder-white/25 outline-none"
            maxLength={20}
            required
          />
        </div>
      </div>

      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Name"
        className="glass w-full rounded-2xl px-5 py-3 font-body text-sm text-white placeholder-white/25 outline-none focus:border-[#ff3c7d]/30"
        maxLength={40}
        required
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Short bio"
        className="glass min-h-28 w-full resize-none rounded-2xl px-5 py-3 font-body text-sm text-white placeholder-white/25 outline-none focus:border-[#ff3c7d]/30"
        maxLength={220}
      />
      <div className="glass rounded-2xl p-4">
        <label className="block cursor-pointer rounded-xl border border-dashed border-white/15 px-4 py-6 text-center transition hover:border-white/30">
          <span className="font-body text-xs tracking-[0.16em] uppercase text-white/55">
            upload {MIN_PROFILE_PHOTOS}-{MAX_PROFILE_PHOTOS} best photos
          </span>
          <p className="mt-2 font-body text-[0.68rem] tracking-[0.08em] uppercase text-white/30">
            only you in frame • jpeg/png/heic/heif/webp
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.jpg,.jpeg,.png,.heic,.heif,.webp"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
        </label>

        {photos.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-body text-[0.65rem] tracking-[0.18em] uppercase text-white/30">
              selected {photos.length}/{MAX_PROFILE_PHOTOS}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Selected ${idx + 1}`} className="h-24 w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={loading || loggingOut || !displayName.trim() || !handle.trim() || !photoCountOk}
        className="btn-invite mt-2 flex h-12 w-full items-center justify-center rounded-full border border-white/8 bg-white/[0.03] font-body text-sm font-medium tracking-[0.15em] text-white/60 backdrop-blur-sm disabled:opacity-40"
      >
        {loading ? "saving..." : "save profile"}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading || loggingOut}
        className="mt-1 flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-transparent font-body text-xs font-medium tracking-[0.14em] uppercase text-white/45 transition hover:text-white/70 disabled:opacity-40"
      >
        {loggingOut ? "logging out..." : "log out"}
      </button>

      {error && <p className="mt-1 font-body text-xs tracking-wide text-[#ff3c7d]">{error}</p>}
      {!photoCountOk && (
        <p className="mt-1 font-body text-xs tracking-wide text-white/35">
          Add {MIN_PROFILE_PHOTOS}-{MAX_PROFILE_PHOTOS} photos to continue.
        </p>
      )}
    </form>
  );
}
