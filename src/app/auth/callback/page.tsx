"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CompletionState = "loading" | "error";

function readCallbackPayload() {
  const url = new URL(window.location.href);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");

  return {
    tokenHash,
    type,
    accessToken,
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CompletionState>("loading");
  const [error, setError] = useState("");

  const payload = useMemo(() => {
    if (typeof window === "undefined") {
      return { tokenHash: null, type: "magiclink", accessToken: null };
    }
    return readCallbackPayload();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      if (!payload.tokenHash && !payload.accessToken) {
        if (!cancelled) {
          setState("error");
          setError("This sign-in link is missing required data.");
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/complete-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error("Login completion failed");
        }

        const data = (await res.json()) as { nextPath?: string };
        if (!cancelled) {
          router.replace(data.nextPath ?? "/dashboard");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setError("Invalid or expired link. Please request a new magic link.");
        }
      }
    }

    void completeLogin();

    return () => {
      cancelled = true;
    };
  }, [payload, router]);

  return (
    <div className="noise scanlines relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <main className="relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
          finishing sign in
        </h1>
        {state === "loading" ? (
          <p className="mt-4 font-body text-sm tracking-[0.12em] uppercase text-white/45">
            please wait...
          </p>
        ) : (
          <p className="mt-4 font-body text-sm tracking-[0.04em] text-[#ff3c7d]">{error}</p>
        )}
      </main>
    </div>
  );
}
