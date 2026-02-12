"use client";

import { useEffect } from "react";

function hasSupabaseAuthHash(hash: string) {
  if (!hash) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return Boolean(params.get("access_token") || params.get("refresh_token"));
}

export default function AuthHashRedirector() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/auth/callback") return;
    if (!hasSupabaseAuthHash(window.location.hash)) return;

    const nextUrl = `/auth/callback${window.location.search}${window.location.hash}`;
    window.location.replace(nextUrl);
  }, []);

  return null;
}
