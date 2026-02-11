"use client";

import { useEffect, useState } from "react";

// --- Embers ---
const EMBER_COUNT = 30;
const EMBER_COLORS = ["#ff2d6b", "#ff6b2d", "#bf5af2", "#ffde03", "#ff2d9b"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function Embers() {
  const [embers, setEmbers] = useState<
    { id: number; left: string; size: string; color: string; duration: string; delay: string; drift: string }[]
  >([]);

  useEffect(() => {
    setEmbers(
      Array.from({ length: EMBER_COUNT }, (_, i) => ({
        id: i,
        left: `${randomBetween(2, 98)}%`,
        size: `${randomBetween(1.5, 4)}px`,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
        duration: `${randomBetween(8, 16)}s`,
        delay: `${randomBetween(0, 12)}s`,
        drift: `${randomBetween(-30, 30)}px`,
      }))
    );
  }, []);

  if (embers.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[3]">
      {embers.map((e) => (
        <div
          key={e.id}
          className="ember"
          style={{
            left: e.left,
            "--size": e.size,
            "--color": e.color,
            "--duration": e.duration,
            "--delay": e.delay,
            "--drift": e.drift,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// --- Live clock ---
function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m} ${ampm}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <div className="animate-fade-in delay-8 fixed bottom-6 left-6 z-20 font-body text-[0.6rem] tracking-[0.3em] uppercase text-white/15">
      {time}
    </div>
  );
}

// --- Staggered title ---
function Title() {
  const word1 = "the";
  const word2 = "function";

  return (
    <h1 className="glitch-text bass-pulse text-center font-display text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
      {word1.split("").map((char, i) => (
        <span
          key={`w1-${i}`}
          className="animate-letter inline-block"
          style={{ animationDelay: `${0.1 + i * 0.06}s` }}
        >
          {char}
        </span>
      ))}
      {word2.split("").map((char, i) => (
        <span
          key={`w2-${i}`}
          className="animate-letter inline-block bg-gradient-to-r from-[#ff3c7d] via-[#e040fb] to-[#c084fc] bg-clip-text text-transparent"
          style={{ animationDelay: `${0.1 + (word1.length + i) * 0.06}s` }}
        >
          {char}
        </span>
      ))}
    </h1>
  );
}

export default function LandingScene() {
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

      {/* Floating embers */}
      <Embers />

      {/* Content */}
      <main className="relative z-10 flex flex-col items-center px-6">
        <Title />

        {/* Divider */}
        <div className="animate-fade-in delay-6 mt-6 h-px w-12 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Button */}
        <a
          href="/login"
          className="btn-invite animate-wiggle delay-7 mt-6 flex h-12 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-8 font-body text-sm font-medium tracking-[0.15em] text-white/50 backdrop-blur-sm"
        >
          enter
        </a>
      </main>

      {/* Live clock */}
      <LiveClock />
    </div>
  );
}
