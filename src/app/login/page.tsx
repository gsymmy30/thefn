"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first code input when step changes
  useEffect(() => {
    if (step === "code") {
      codeRefs.current[0]?.focus();
    }
  }, [step]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setStep("code");
    } catch {
      setError("Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(finalCode: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: finalCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid code");
        setCode(["", "", "", "", "", ""]);
        codeRefs.current[0]?.focus();
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const finalCode = newCode.join("");
      if (finalCode.length === 6) {
        submitCode(finalCode);
      }
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      codeRefs.current[5]?.focus();
      submitCode(pasted);
    }
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

      {/* Content */}
      <main className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        {/* Wordmark */}
        <a href="/" className="animate-fade-in delay-1 mb-12 font-display text-xl font-extrabold tracking-tight text-white">
          the<span className="bg-gradient-to-r from-[#ff3c7d] via-[#e040fb] to-[#c084fc] bg-clip-text text-transparent">function</span>
        </a>

        {step === "phone" ? (
          <form onSubmit={handleSendCode} className="animate-fade-up delay-2 flex w-full flex-col items-center gap-6">
            <label className="font-body text-xs tracking-[0.2em] uppercase text-white/30">
              your number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="glass w-full rounded-2xl px-6 py-4 text-center font-body text-lg tracking-wider text-white placeholder-white/20 outline-none focus:border-[#ff3c7d]/30"
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={loading || !phone}
              className="btn-invite flex h-12 w-full items-center justify-center rounded-full border border-white/8 bg-white/[0.03] font-body text-sm font-medium tracking-[0.15em] text-white/50 backdrop-blur-sm disabled:opacity-30"
            >
              {loading ? "sending..." : "send code"}
            </button>
          </form>
        ) : (
          <div className="animate-fade-up flex w-full flex-col items-center gap-6">
            <label className="font-body text-xs tracking-[0.2em] uppercase text-white/30">
              enter code
            </label>
            <div className="flex gap-3" onPaste={handleCodePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="glass h-14 w-11 rounded-xl text-center font-display text-xl font-bold text-white outline-none focus:border-[#ff3c7d]/30"
                />
              ))}
            </div>
            <button
              onClick={() => { setStep("phone"); setCode(["", "", "", "", "", ""]); setError(""); }}
              className="font-body text-xs tracking-wider text-white/20 transition-colors hover:text-white/50"
            >
              wrong number?
            </button>
          </div>
        )}

        {error && (
          <p className="animate-fade-up mt-4 font-body text-xs tracking-wider text-[#ff3c7d]">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
