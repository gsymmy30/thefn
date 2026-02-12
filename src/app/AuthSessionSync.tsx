"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CHANNEL_NAME = "thefn-auth-events";
const STORAGE_KEY = "__thefn_auth_redirect__";

function getNextPath(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { nextPath?: unknown }).nextPath;
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  return value;
}

export default function AuthSessionSync() {
  const router = useRouter();

  useEffect(() => {
    function applyRedirect(nextPath: string) {
      router.replace(nextPath);
      router.refresh();
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        const nextPath = getNextPath(event.data);
        if (nextPath) applyRedirect(nextPath);
      };
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { nextPath?: unknown };
        const nextPath = getNextPath(parsed);
        if (nextPath) applyRedirect(nextPath);
      } catch {
        return;
      }
    }

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [router]);

  return null;
}
