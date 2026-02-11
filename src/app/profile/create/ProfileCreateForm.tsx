"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileCreateForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, fullName, bio }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save profile");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-up delay-2 mt-8 flex w-full max-w-md flex-col gap-4">
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Display name"
        className="glass w-full rounded-2xl px-5 py-3 font-body text-sm text-white placeholder-white/25 outline-none focus:border-[#ff3c7d]/30"
        maxLength={40}
        required
      />
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name (optional)"
        className="glass w-full rounded-2xl px-5 py-3 font-body text-sm text-white placeholder-white/25 outline-none focus:border-[#ff3c7d]/30"
        maxLength={80}
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio (optional)"
        className="glass min-h-28 w-full resize-none rounded-2xl px-5 py-3 font-body text-sm text-white placeholder-white/25 outline-none focus:border-[#ff3c7d]/30"
        maxLength={300}
      />
      <button
        type="submit"
        disabled={loading || !displayName.trim()}
        className="btn-invite mt-2 flex h-12 w-full items-center justify-center rounded-full border border-white/8 bg-white/[0.03] font-body text-sm font-medium tracking-[0.15em] text-white/60 backdrop-blur-sm disabled:opacity-40"
      >
        {loading ? "saving..." : "save profile"}
      </button>

      {error && <p className="mt-1 font-body text-xs tracking-wide text-[#ff3c7d]">{error}</p>}
    </form>
  );
}
