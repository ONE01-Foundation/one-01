/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEMO DATA — NOT REAL TELEMETRY. DELETE THIS WHOLE FILE WHEN REAL DATA LANDS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feeds the "Your data, live" section on the landing page. Every number and
 * event here is invented, so the section renders a visible "Demo data" tag —
 * see `pulse.demoTag` in landingCopy.ts. Do not remove that tag while this file
 * is the source: numbers presented as live system data have to actually be live.
 *
 * ── To delete the section entirely ────────────────────────────────────────
 *   1. delete this file
 *   2. delete the `#pulse` <section> in app/page.tsx (marked DEMO)
 *   3. delete `pulse` from LandingCopy + both language blocks in landingCopy.ts
 *   4. delete the `.pulse-*` rules in globals.css (one marked block)
 *
 * ── To swap in real data instead ──────────────────────────────────────────
 *   Keep the shapes below (`PulseStats`, `PulseEvent`) and replace the two
 *   generators with Supabase calls (counts + a recent-events RPC), then drop
 *   `demoTag` from the markup. The section needs no other change.
 */

/**
 * Small seeded PRNG. The section must render identically on the server and on
 * the first client paint or React hydration mismatches — so the initial feed is
 * built from a FIXED seed, and only the post-mount ticking uses a live one.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PulseStats {
  ones: number;
  processes: number;
  businesses: number;
  handled: number;
}

/** One line in the "Happening now" feed. `key` picks the label from copy. */
export interface PulseEvent {
  id: number;
  key: PulseEventKey;
  /** Seconds ago, at the time it entered the feed. */
  age: number;
}

export type PulseEventKey =
  | "process_opened"
  | "draft_written"
  | "business_connected"
  | "step_done"
  | "booking_made"
  | "process_closed";

/** Invented starting point. Chosen to look like an early, honest preview. */
export const DEMO_SEED: PulseStats = {
  ones: 1284,
  processes: 3910,
  businesses: 612,
  handled: 8437,
};

/**
 * How much each counter drifts upward per tick. Deliberately gentle — a landing
 * page that visibly inflates its own numbers reads as a lie even when labelled.
 */
const DRIFT: Record<keyof PulseStats, number> = {
  ones: 1,
  processes: 2,
  businesses: 1,
  handled: 3,
};

/** Advance the counters one tick. Pure — the caller owns the state. */
export function tickStats(prev: PulseStats, roll: () => number): PulseStats {
  const next = { ...prev };
  for (const k of Object.keys(DRIFT) as (keyof PulseStats)[]) {
    // Not every counter moves every tick, or they'd climb in lockstep.
    if (roll() < 0.55) next[k] = prev[k] + Math.ceil(roll() * DRIFT[k]);
  }
  return next;
}

const EVENT_KEYS: PulseEventKey[] = [
  "process_opened",
  "draft_written",
  "business_connected",
  "step_done",
  "booking_made",
  "process_closed",
];

/** A fresh event for the top of the feed. */
export function nextEvent(id: number, roll: () => number): PulseEvent {
  return { id, key: EVENT_KEYS[Math.floor(roll() * EVENT_KEYS.length)], age: 0 };
}

/** The feed's initial state — already-aged entries so it doesn't start empty. */
export function seedEvents(roll: () => number, count = 5): PulseEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    key: EVENT_KEYS[Math.floor(roll() * EVENT_KEYS.length)],
    age: (i + 1) * 45 + Math.floor(roll() * 30),
  }));
}
