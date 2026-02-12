"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardActions() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="mt-8 flex h-11 items-center justify-center rounded-full border border-white/10 px-6 font-body text-xs font-medium tracking-[0.14em] uppercase text-white/45 transition hover:text-white/70 disabled:opacity-40"
    >
      {loggingOut ? "logging out..." : "log out"}
    </button>
  );
}
