import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileCreateForm from "@/app/profile/create/ProfileCreateForm";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function CreateProfilePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (!user) {
    redirect("/login");
  }

  if (user.profileDisplayName) {
    redirect("/dashboard");
  }

  return (
    <div className="noise scanlines relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <main className="relative z-10 flex max-w-lg flex-col items-center px-6 text-center">
        <h1 className="animate-slam delay-1 font-display text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
          profile setup
        </h1>
        <p className="animate-fade-up delay-3 mt-6 font-body text-sm tracking-[0.15em] uppercase text-white/35">
          tell us a little about yourself
        </p>
        <ProfileCreateForm />
      </main>
    </div>
  );
}
