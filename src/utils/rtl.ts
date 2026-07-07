/**
 * RTL helpers — the only approach that actually works on this app's Expo Go /
 * device combo.
 *
 * Do NOT use `textAlign: 'left' | 'right'` for direction — the device swaps them
 * (so 'right' lands on the physical left), and the JS swap flag can't be
 * toggled reliably in Expo Go. Instead set an explicit `direction` (Yoga layout
 * direction), which is swap-immune AND engine-immune:
 *   • On an `rtl` flex row the first child lands on the right.
 *   • An `rtl` Text aligns to its leading edge = the right.
 */

type Dir = 'ltr' | 'rtl';

/** True when the content should read right-to-left (Hebrew). */
export function wantsRTL(lang: string): boolean {
  return lang === 'he';
}

/**
 * Style for a FLEX ROW (or any flex container) — sets explicit layout direction.
 * In an `rtl` row the first child (e.g. a leading icon) ends up on the right.
 */
export function rtlRow(lang: string): { direction: Dir } {
  return { direction: lang === 'he' ? 'rtl' : 'ltr' };
}

/**
 * Style for TEXT — right-aligns Hebrew via `direction` (NOT textAlign, which the
 * device swaps). Returns `null` for English (the default already left-aligns).
 * Drop it straight into a style array.
 */
export function rtlText(lang: string): { direction: 'rtl'; writingDirection: 'rtl' } | null {
  return lang === 'he' ? { direction: 'rtl', writingDirection: 'rtl' } : null;
}
