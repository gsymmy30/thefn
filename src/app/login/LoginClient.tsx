"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const [savedEmails, setSavedEmails] = useState<Array<{ email: string; label: string }>>([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    async function loadDevIdentities() {
      try {
        const res = await fetch("/api/auth/dev-identities");
        if (!res.ok) return;
        const data = (await res.json()) as {
          enabled?: boolean;
          emails?: Array<{ email: string; label: string }>;
        };
        setLocalMode(Boolean(data.enabled));
        setSavedEmails(Array.isArray(data.emails) ? data.emails : []);
      } catch {
        return;
      }
    }
    void loadDevIdentities();
  }, []);

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const inCooldown = cooldownRemaining > 0;

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (typeof data.retryAfterSeconds === "number" && data.retryAfterSeconds > 0) {
          setCooldownUntil(Date.now() + data.retryAfterSeconds * 1000);
        }
        setError(data.error || "Something went wrong");
        return;
      }

      const data = await res.json();
      if (typeof data.nextPath === "string" && data.nextPath) {
        window.location.href = data.nextPath;
        return;
      }
      if (typeof data.devMagicLink === "string" && data.devMagicLink) {
        window.location.href = data.devMagicLink;
        return;
      }

      setCooldownUntil(Date.now() + 60 * 1000);
      setSent(true);
    } catch {
      setError("Failed to send link");
    } finally {
      setLoading(false);
    }
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

      <main className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        <Link href="/" className="animate-fade-in delay-1 mb-12 font-display text-xl font-extrabold tracking-tight text-white">
          the<span className="bg-gradient-to-r from-[#ff3c7d] via-[#e040fb] to-[#c084fc] bg-clip-text text-transparent">function</span>
        </Link>

        <form onSubmit={handleSendLink} className="animate-fade-up delay-2 flex w-full flex-col items-center gap-6">
          <label className="font-body text-xs tracking-[0.2em] uppercase text-white/30">
            your email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="glass w-full rounded-2xl px-6 py-4 text-center font-body text-lg tracking-wider text-white placeholder-white/20 outline-none focus:border-[#ff3c7d]/30"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={loading || inCooldown || !email}
            className="btn-invite flex h-12 w-full items-center justify-center rounded-full border border-white/8 bg-white/[0.03] font-body text-sm font-medium tracking-[0.15em] text-white/50 backdrop-blur-sm disabled:opacity-30"
          >
            {loading ? "sending..." : inCooldown ? `wait ${cooldownRemaining}s` : "send magic link"}
          </button>
        </form>

        {error && (
          <p className="animate-fade-up mt-4 font-body text-xs tracking-wider text-[#ff3c7d]">
            {error}
          </p>
        )}
        {sent && (
          <p className="animate-fade-up mt-4 text-center font-body text-xs tracking-wider text-white/50">
            check your inbox and click the link to continue
          </p>
        )}
        {localMode && savedEmails.length > 0 && (
          <div className="animate-fade-up mt-6 flex w-full flex-col gap-2">
            <p className="font-body text-[0.65rem] tracking-[0.2em] uppercase text-white/30">
              quick switch
            </p>
            {savedEmails.map((item) => (
              <button
                key={item.email}
                type="button"
                onClick={() => {
                  setEmail(item.email);
                  setCooldownUntil(0);
                }}
                className="glass flex h-10 items-center justify-start rounded-xl px-4 font-body text-xs text-white/70 transition hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <p className="animate-fade-up delay-3 mt-8 font-body text-xs tracking-wider text-white/25">
          new here?{" "}
          <Link href="/signup" className="text-white/60 hover:text-white">
            create account
          </Link>
        </p>
      </main>
    </div>
  );
}
