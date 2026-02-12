import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import DashboardActions from "@/app/dashboard/DashboardActions";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (!user) {
    redirect("/login");
  }

  if (!user.profileDisplayName) {
    redirect("/profile/create");
  }

  return (
    <div className="noise scanlines relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Party haze blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <main className="relative z-10 flex flex-col items-center px-6">
        <h1 className="animate-slam delay-1 font-display text-6xl font-extrabold tracking-tight text-white sm:text-8xl">
          you&apos;re in<span className="text-[#ff3c7d]">.</span>
        </h1>
        <p className="animate-fade-up delay-3 mt-6 font-body text-sm tracking-[0.2em] uppercase text-white/25">
          welcome, {user.profileDisplayName}
        </p>
        <Link
          href="/profile"
          className="mt-6 rounded-full border border-white/15 px-5 py-2 font-body text-xs tracking-[0.14em] uppercase text-white/60 transition hover:text-white"
        >
          view profile
        </Link>
        <DashboardActions />
      </main>
    </div>
  );
}
