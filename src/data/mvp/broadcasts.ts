/**
 * Home Broadcast — per ONE_DATA_MODEL_AND_EXAMPLES §6 + ONE_UI_UX_SPEC §6.
 *
 * The Home surface speaks ONE-style ambient messages reflecting the active
 * identity's state. Lines are i18n-aware: the loop builder takes the active
 * `AppLanguage` and pulls Hebrew or English strings via the shared
 * `translate()` dictionary.
 *
 * Identity-aware: messages mentioning processes that don't exist under the
 * active identity are filtered out so switching from Ariel to ONE01 doesn't
 * leak "Driving License is waiting…" — see `buildBroadcastLoop` below.
 */

import type { Identity, IdentityType, Unit } from '../../core/mvp/types';
import type { AppLanguage } from '../../stores/localeStore';
import { translate, localizedGreeting } from '../../i18n/strings';
import { timeAwareLines, timeGreeting } from './oneClock';
import { analyzeAll } from '../../utils/processIntelligence';

/** Drop empty + duplicate lines (keeping first occurrence + order). Stops the
 *  loop from repeating itself — the "nagging" the broadcast used to do. */
function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const k = (l ?? '').trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(l);
    }
  }
  return out;
}

/**
 * Empty-state loop — what the user sees when they have no processes yet.
 * Language-aware: pulls from the i18n dictionary.
 */
export function emptyStateLines(lang: AppLanguage): readonly string[] {
  return [
    translate(lang, 'home_broadcast_empty_1'),
    translate(lang, 'home_broadcast_empty_2'),
    translate(lang, 'home_broadcast_empty_3'),
  ];
}

/** Kept exported for back-compat with English-only callers. */
export const HOME_BROADCAST_EMPTY_LINES: readonly string[] = emptyStateLines('en');
export const HOME_BROADCAST_CLOSING_LINE = translate('en', 'home_broadcast_closing');

/**
 * Identity-aware "holding" line — the calm, general reassurance that ONE is
 * keeping the user's threads. Tone shifts with identity type (business =
 * colleague register, family = household register). Used mid-loop, after the
 * greeting opener and the specific attention lines.
 */
function holdingLine(lang: AppLanguage, identityType?: IdentityType): string {
  let holdingKey: 'home_broadcast_holding' | 'home_broadcast_holding_business' | 'home_broadcast_holding_family' =
    'home_broadcast_holding';
  if (identityType === 'business') holdingKey = 'home_broadcast_holding_business';
  else if (identityType === 'family') holdingKey = 'home_broadcast_holding_family';
  return translate(lang, holdingKey);
}

// ── Broadcast rules ─────────────────────────────────────────────────────
//
// A small rule set that runs over the active identity's units and emits AT
// MOST ONE line — the first matching rule wins (priority by order in
// `BROADCAST_RULES`). Lines are language-aware.

interface BroadcastContext {
  units: Unit[];
  identity?: Identity;
  lang: AppLanguage;
  /** Current millisecond timestamp — passed in so the function stays pure
   *  and easy to test (no internal `Date.now()`). */
  now: number;
}

type BroadcastRule = (ctx: BroadcastContext) => string | null;

const STALE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const urgentFirst: BroadcastRule = ({ units, lang }) => {
  const hot = units.find((u) => (u.unreadUpdates ?? 0) >= 3);
  if (!hot) return null;
  if (lang === 'he') {
    return `${hot.title} צריך אותך עכשיו — ${hot.unreadUpdates} עדכונים מחכים.`;
  }
  return `${hot.title} needs you now — ${hot.unreadUpdates} updates waiting.`;
};

const staleNudge: BroadcastRule = ({ units, lang, now }) => {
  const stale = units.find((u) => {
    const t = Date.parse(u.lastUpdatedAt);
    if (Number.isNaN(t)) return false;
    return now - t > STALE_DAYS * MS_PER_DAY;
  });
  if (!stale) return null;
  if (lang === 'he') {
    return `${stale.title} שקט כבר זמן. רוצה לחזור אליו?`;
  }
  return `${stale.title} has been quiet for a while. Want to revisit?`;
};

const todaysFocus: BroadcastRule = ({ units, lang }) => {
  const top = units[0];
  if (!top) return null;
  if (lang === 'he') {
    return `היום הייתי שם את ${top.title} ראשון.`;
  }
  return `Today, I'd put ${top.title} first.`;
};

const businessFraming: BroadcastRule = ({ identity, units, lang }) => {
  if (identity?.type !== 'business') return null;
  const inProgress = units.filter((u) => u.progress && u.progress.current < u.progress.total).length;
  if (inProgress === 0) return null;
  if (lang === 'he') {
    return `${inProgress} ${inProgress === 1 ? 'תהליך באמצע' : 'תהליכים באמצע'}.`;
  }
  return `${inProgress} ${inProgress === 1 ? 'process is' : 'processes are'} mid-flight.`;
};

const BROADCAST_RULES: BroadcastRule[] = [
  urgentFirst,
  todaysFocus,
  businessFraming,
  staleNudge,
];

/** Run the rules in priority order, return at most one line. */
function runRules(ctx: BroadcastContext): string[] {
  for (const rule of BROADCAST_RULES) {
    const line = rule(ctx);
    if (line) return [line];
  }
  return [];
}

/**
 * Build a broadcast loop for the active identity's units. Order matters — the
 * loop is played top-to-bottom and PARKS on the last line when it rests:
 *   1. a general, time-of-day greeting opener (never a specific task)
 *   2. ONE's sense of *now* (day + part-of-day)
 *   3. the smart, state-aware attention lines (the specific stuff)
 *   4. a calm, general "holding" reassurance
 *   5. weekend framing (when relevant) + the date
 *   6. urgency hint when nothing is hot
 *   7. a general, open-ended closing prompt — where the loop rests
 *
 * If `units` is empty, returns the language-appropriate empty-state loop.
 */
export function buildBroadcastLoop(
  units: Unit[],
  identityOrName?: Identity | string,
  lang: AppLanguage = 'en',
  now: number = Date.now(),
): readonly string[] {
  const identity =
    identityOrName && typeof identityOrName !== 'string'
      ? (identityOrName as Identity)
      : undefined;
  const identityName =
    typeof identityOrName === 'string' ? identityOrName : identity?.name;
  const identityType = identity?.type;

  // ONE's sense of *now* — woven through the loop so it sounds present in time.
  const timeLines = timeAwareLines(lang, now);

  // Completed processes drop OUT of the broadcast — ONE never nags about what's
  // already done, and a just-finished process stops asking questions.
  const activeUnits = units.filter((u) => u.status !== 'completed');

  if (activeUnits.length === 0) {
    // No active work — a brand-new user OR everything's complete. Either way ONE
    // stays calm: no manufactured urgency, nothing to nag with.
    const allDone = units.length > 0;
    return dedupe(
      [
        localizedGreeting(lang, identityName, new Date(now)),
        timeLines[0],
        ...(allDone
          ? [lang === 'he' ? 'הכול סגור כרגע. מרחב לנשום.' : 'All clear right now. Room to breathe.']
          : emptyStateLines(lang)),
        timeLines[timeLines.length - 1], // the date beat, last
      ].filter(Boolean),
    );
  }

  // Smart, STATE-AWARE lead. analyzeAll surfaces only the processes that
  // genuinely need attention (overdue / due-soon / almost-done / stalled /
  // next-step), each as its OWN specific line — so the loop says useful, varied
  // things instead of repeating a generic "I'd put X first". Calm processes are
  // left out on purpose: ONE speaks up only when there's something to say.
  const focuses = analyzeAll(activeUnits, now, lang);
  const smartLines = focuses.slice(0, 3).map((f) => f.focus.headline);
  const leadLines = smartLines.length
    ? smartLines
    : runRules({ units: activeUnits, identity, lang, now });

  const anyUnread = activeUnits.some((u) => (u.unreadUpdates ?? 0) > 0);

  return dedupe(
    [
      // OPEN: a general, time-of-day greeting. ONE never opens on a specific
      // task, and this rotates day-to-day so it isn't the same line each
      // morning/afternoon/evening.
      timeGreeting(lang, now, identityName),
      timeLines[0], // ONE's sense of *now* — day + part-of-day, near the top
      // THEN: the smart, state-aware attention lines (the specific stuff).
      ...leadLines,
      holdingLine(lang, identityType), // calm, general reassurance
      ...timeLines.slice(1), // weekend framing (when relevant) + the date
      anyUnread ? '' : translate(lang, 'home_broadcast_urgency_hint'),
      // CLOSE / PARK: a general, open-ended prompt. `restAtEnd` parks the loop
      // on the LAST line when it goes quiet — so ONE rests on something general,
      // never on a specific task line.
      translate(lang, 'home_broadcast_closing'),
    ].filter(Boolean),
  );
}

/**
 * Convert one Unit into a single-sentence Home-broadcast line. English
 * keeps the spec's example phrasing; Hebrew uses a closer cousin.
 */
function personaliseLine(u: Unit, lang: AppLanguage): string | null {
  const primary = u.latestBroadcastText?.[0];
  if (!primary) return null;

  const primaryType = u.broadcast?.[0]?.type;
  const title = u.title;

  if (lang === 'he') {
    if (primaryType === 'event') {
      if (/workout/i.test(primary)) return `האימון הבא שלך ב־14:00.`;
      if (/lesson/i.test(primary)) return `${title} מחכה לשיעור הבא.`;
      return `${title}: ${primary}`;
    }
    if (primaryType === 'waiting') return `${title} ${primary}`;
    if (primaryType === 'missing_info') return `${title}: ${primary}`;
    if (primaryType === 'progress') return `ל־${title} יש החלטות פתוחות.`;
    return `${title}: ${primary}`;
  }

  if (primaryType === 'event') {
    if (/workout/i.test(primary)) return `Your next workout is at 2:00 PM.`;
    if (/lesson/i.test(primary)) return `${title} is waiting for the next lesson.`;
    return `${title}: ${primary.toLowerCase()}`;
  }
  if (primaryType === 'waiting') return `${title} ${normalize(primary)}`;
  if (primaryType === 'missing_info') return `${title}: ${primary.toLowerCase()}`;
  if (primaryType === 'progress') return `The ${title.toLowerCase()} has open decisions.`;
  return `${title}: ${primary.toLowerCase()}`;
}

function normalize(s: string): string {
  if (!s) return s;
  if (s.length > 1 && s[1] === s[1].toUpperCase()) return s;
  return s[0].toLowerCase() + s.slice(1);
}

export const HOME_BROADCAST_INTERVAL_MS = 4200;
export const HOME_BROADCAST_CLOSING_HOLD_MS = 7000;

/**
 * Per-line dwell time. ONE doesn't tick like a metronome — each line lingers
 * for roughly how long it takes to read, and every so often it holds a beat
 * longer, the way a person pauses mid-thought. This is what makes the loop
 * feel like ONE is *speaking* rather than flipping cards on a fixed timer.
 *
 * Deterministic by index so the rhythm is stable across re-renders (no
 * Math.random churn that would make the same line dwell differently each pass).
 */
export function broadcastDwellMs(line: string, index: number): number {
  if (!line) return HOME_BROADCAST_INTERVAL_MS;
  if (line === HOME_BROADCAST_CLOSING_LINE) return HOME_BROADCAST_CLOSING_HOLD_MS;
  // Reading time: a calm base + ~48ms per character, clamped so long lines
  // don't overstay.
  const reading = Math.min(8000, 2600 + line.length * 48);
  // Every third line ONE lingers a touch longer — a small "thinking" pause.
  const linger = index % 3 === 2 ? 1600 : 0;
  return reading + linger;
}

// Legacy static lines — kept for tests / fallback. New code path uses
// `buildBroadcastLoop` with an `AppLanguage` parameter.
export const HOME_BROADCAST_LINES: readonly string[] = [
  'Good morning.',
  'You have a few things moving.',
  'Weight Gain needs a quick update.',
  'Your next workout is at 2:00 PM.',
  'Driving License is waiting for the next lesson.',
  'The business website has open decisions.',
  'Nothing is urgent right now.',
];
