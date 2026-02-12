import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  getAvatarModelByUserId,
  getProfileByUserId,
  listProfilePhotosByUserId,
} from "@/lib/db";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (!user) {
    redirect("/login");
  }

  const profile = getProfileByUserId(user.userId);
  if (!profile) {
    redirect("/profile/create");
  }

  const photos = listProfilePhotosByUserId(user.userId);
  const avatarModel = getAvatarModelByUserId(user.userId);

  return (
    <div className="noise scanlines relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <main className="relative z-10 w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            @{profile.handle ?? "profile"}
          </h1>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/15 px-4 py-2 font-body text-xs tracking-[0.14em] uppercase text-white/60 hover:text-white"
          >
            back
          </Link>
        </div>

        <p className="mt-4 font-body text-2xl font-semibold text-white/90">{profile.display_name}</p>
        {profile.bio && <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-white/65">{profile.bio}</p>}

        <section className="mt-8">
          <p className="mb-3 font-body text-xs tracking-[0.2em] uppercase text-white/35">avatar preview</p>
          {avatarModel?.status === "ready" && avatarModel.sample_image_path ? (
            <div className="max-w-sm overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/avatar/sample?ts=${avatarModel.updated_at}`}
                alt="Avatar sample"
                className="h-72 w-full object-cover"
              />
            </div>
          ) : (
            <p className="font-body text-sm text-white/45">
              {avatarModel?.status === "failed"
                ? "Avatar sample failed. Re-save profile photos to retry."
                : "Avatar sample is being prepared."}
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mb-3 font-body text-xs tracking-[0.2em] uppercase text-white/35">
            photos ({photos.length})
          </p>
          {photos.length === 0 ? (
            <p className="font-body text-sm text-white/45">No photos uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/profile/photos/${photo.id}`}
                    alt={photo.original_name}
                    className="h-44 w-full object-cover sm:h-56"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
