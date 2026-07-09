"use client";

/**
 * Splash — the web opening moment, mirroring the mobile app: a black dot grows
 * from the centre, its eyes open, it breathes once, then the whole overlay
 * fades out to reveal the page beneath (Home on /app, the landing hero on /).
 *
 * Plays once per browser session (sessionStorage), so clicking through from the
 * landing to /app — or navigating internally — doesn't replay it. A fresh load
 * or refresh opens with the splash again.
 */

import { useEffect, useState } from "react";

const SEEN_KEY = "one_splash_seen";

export function Splash({
  bg = "var(--bg)",
  size = 96,
  padBottom,
  always = false,
}: {
  /** Background + eye ("cut-out") colour — match the surface it covers. */
  bg?: string;
  size?: number;
  /** Bottom padding (e.g. "25vh") to raise the centred orb so it lands exactly
   *  where the page's own orb sits — a seamless handoff. */
  padBottom?: string;
  /** Replay on EVERY load/refresh (the landing "awakening"), ignoring the
   *  once-per-session gate — but still mark the session so /app doesn't
   *  double-splash right after. */
  always?: boolean;
}) {
  const [mounted, setMounted] = useState(true);
  const [grown, setGrown] = useState(false);
  const [eyes, setEyes] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode — just play it */
    }
    // `always` replays every load; otherwise honour the once-per-session gate.
    if (seen && !always) {
      setMounted(false);
      return;
    }
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }

    const timers: number[] = [];
    // Kick the rise on the next frame so the transition actually runs.
    const raf = requestAnimationFrame(() => setGrown(true));
    timers.push(window.setTimeout(() => setEyes(true), 780));
    timers.push(window.setTimeout(() => setLeaving(true), 1650));
    timers.push(window.setTimeout(() => setMounted(false), 2120));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="one-splash"
      style={{ background: bg, opacity: leaving ? 0 : 1, paddingBottom: padBottom }}
    >
      <div
        className="one-splash-face"
        style={{
          // Starts lower + larger (near screen centre), then rises to the
          // page's orb spot while shrinking to size — becoming the character.
          transform: grown ? "translateY(0) scale(1)" : "translateY(15vh) scale(1.65)",
          opacity: 1,
        }}
      >
        <div className="one-splash-breath">
          <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#0A0A0A" />
            <g style={{ opacity: eyes ? 1 : 0, transition: "opacity 480ms ease" }}>
              <circle cx="34" cy="45" r="12" fill={bg} />
              <circle cx="66" cy="45" r="12" fill={bg} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
