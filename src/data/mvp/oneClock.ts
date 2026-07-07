/**
 * ONE's internal clock — gives the agent a real sense of *now*: the part of
 * the day, the weekday, the date, and weekend-vs-weekday. Home broadcast lines
 * pull from this so ONE sounds like it's living alongside the user in time,
 * not reciting static copy.
 *
 * Pure-ish: callers pass `now` (a ms timestamp or Date) so the output is
 * testable and a coarse time-bucket can drive memoization. Defaults to the
 * real clock for convenience (JS-thread only — never called inside a worklet).
 */

import type { AppLanguage } from '../../stores/localeStore';

export type PartOfDay = 'late' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeContext {
  hour: number;
  part: PartOfDay;
  /** 0 = Sunday … 6 = Saturday (JS getDay order). */
  dayIndex: number;
  isWeekend: boolean;
  /** Localized date, e.g. "June 26" / "26 ביוני". */
  dateLabel: string;
  /** Localized weekday name, e.g. "Thursday" / "חמישי". */
  dayName: string;
}

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function partOfDay(hour: number): PartOfDay {
  if (hour < 5) return 'late';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

export function getTimeContext(lang: AppLanguage, now: number | Date = Date.now()): TimeContext {
  const d = now instanceof Date ? now : new Date(now);
  const hour = d.getHours();
  const dayIndex = d.getDay();
  // Hebrew/Israeli week treats Friday + Saturday as the weekend; English
  // default is Saturday + Sunday.
  const isWeekend =
    lang === 'he' ? dayIndex === 5 || dayIndex === 6 : dayIndex === 0 || dayIndex === 6;
  const dayName = (lang === 'he' ? HE_DAYS : EN_DAYS)[dayIndex];
  const day = d.getDate();
  const month = (lang === 'he' ? HE_MONTHS : EN_MONTHS)[d.getMonth()];
  const dateLabel = lang === 'he' ? `${day} ב${month}` : `${month} ${day}`;
  return { hour, part: partOfDay(hour), dayIndex, isWeekend, dateLabel, dayName };
}

/**
 * A coarse bucket string that only changes a few times a day (date + part of
 * day). Used to memoize the broadcast loop so it refreshes when the part of
 * day flips (morning → afternoon) without churning on every tick.
 */
export function timeBucket(now: number | Date = Date.now()): string {
  const d = now instanceof Date ? now : new Date(now);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${partOfDay(d.getHours())}`;
}

const HE_PART: Record<PartOfDay, string> = {
  late: 'אחרי חצות',
  morning: 'בוקר',
  afternoon: 'אחר הצהריים',
  evening: 'ערב',
  night: 'לילה',
};
const EN_PART: Record<PartOfDay, string> = {
  late: 'late night',
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
};

/**
 * A stable day-seed derived from the date only (not the clock time). Used to
 * pick a greeting / time-line VARIANT that stays fixed within a given day but
 * rotates day-to-day, so ONE doesn't say the exact same thing every morning —
 * without churning on every render (the seed only changes when the date does).
 */
function daySeed(now: number | Date): number {
  const d = now instanceof Date ? now : new Date(now);
  return d.getDate() + d.getMonth() * 31;
}

/** Deterministic pick from a non-empty list by the day-seed. */
function pickByDay<T>(list: readonly T[], now: number | Date, offset = 0): T {
  return list[(daySeed(now) + offset) % list.length];
}

// ── Time-of-day greetings ──────────────────────────────────────────────────
//
// A SET of variants per part-of-day so the opening greeting isn't identical
// every morning / afternoon / evening. `{name}` is filled with ", <name>" when
// an identity name is known. Chosen deterministically by the day-seed, so it's
// stable within a day but rotates across days.

const HE_GREETINGS: Record<PartOfDay, readonly string[]> = {
  late: ['מאוחר{name}.', 'שקט של אחרי חצות{name}.', 'מאוחר. אני שומר על הדברים.'],
  morning: [
    'בוקר טוב{name}.',
    'בוקר{name}. יום חדש להתקדם בו.',
    'בוקר טוב. נתחיל בקטן?',
    'בוקר אור{name}.',
  ],
  afternoon: [
    'צהריים טובים{name}.',
    'אמצע היום{name}. איך מתקדם?',
    'צהריים{name}. יש רגע להתארגן?',
    'צהריים טובים. נמשיך מאיפה שעצרנו?',
  ],
  evening: [
    'ערב טוב{name}.',
    'ערב{name}. בוא נסגור קצוות.',
    'ערב טוב. איך היה היום?',
    'ערב רגוע{name}.',
  ],
  night: ['עוד ער{name}?', 'לילה{name}. עוד משהו קטן?', 'מאוחר, אבל אני כאן{name}.'],
};

const EN_GREETINGS: Record<PartOfDay, readonly string[]> = {
  late: ["It's late{name}.", 'The quiet after midnight{name}.', "It's late. I'll keep watch."],
  morning: [
    'Good morning{name}.',
    'Morning{name}. A fresh start.',
    'Good morning. Shall we start small?',
    'Morning light{name}.',
  ],
  afternoon: [
    'Good afternoon{name}.',
    'Midday{name}. How’s it moving?',
    'Afternoon{name}. A moment to regroup?',
    'Good afternoon. Pick up where we left off?',
  ],
  evening: [
    'Good evening{name}.',
    'Evening{name}. Let’s tie off loose ends.',
    'Good evening. How was the day?',
    'Quiet evening{name}.',
  ],
  night: ['Still up{name}?', 'Night{name}. One more small thing?', 'Up late{name}?'],
};

/**
 * A varied, time-of-day greeting — the general opener the Home broadcast leads
 * with (never a specific task). Rotates day-to-day via the day-seed so it isn't
 * the identical line every morning. `identityName`, when present, is woven in.
 */
export function timeGreeting(
  lang: AppLanguage,
  now: number | Date = Date.now(),
  identityName?: string,
): string {
  const part = partOfDay((now instanceof Date ? now : new Date(now)).getHours());
  const variants = (lang === 'he' ? HE_GREETINGS : EN_GREETINGS)[part];
  const namePart = identityName ? `, ${identityName}` : '';
  return pickByDay(variants, now).replace('{name}', namePart);
}

/**
 * ONE-voiced, time-aware lines drawn from the real clock. Returns a small set
 * (2–3) chosen by the actual moment, so the Home broadcast genuinely reflects
 * the day, the hour and the date — ONE "knows" what time it is.
 *
 * Order is intentional: [0] is the day/part-of-day beat (woven near the top of
 * the loop), the rest (weekend framing when relevant + the date) trail later.
 * The [0] beat rotates day-to-day via the day-seed so it isn't identical each
 * day at the same hour.
 */
export function timeAwareLines(lang: AppLanguage, now: number | Date = Date.now()): string[] {
  const c = getTimeContext(lang, now);
  const out: string[] = [];
  if (lang === 'he') {
    if (c.part === 'late') {
      out.push(
        pickByDay(
          ['מאוחר. אני שומר על הדברים בזמן שאתה נח.', 'שעה מאוחרת — הכול רשום, אפשר לנוח.'],
          now,
        ),
      );
    } else if (c.part === 'morning') {
      out.push(
        pickByDay(
          [`בוקר של יום ${c.dayName}. ממה נתחיל?`, `יום ${c.dayName} מתחיל. מה הדבר הראשון?`],
          now,
        ),
      );
    } else if (c.part === 'evening') {
      out.push(
        pickByDay(
          [`ערב של יום ${c.dayName}. בוא נסגור קצוות.`, `יום ${c.dayName} מתקרב לסיום. מה נשאר?`],
          now,
        ),
      );
    } else {
      out.push(
        pickByDay([`יום ${c.dayName}, ${HE_PART[c.part]}.`, `${HE_PART[c.part]} של יום ${c.dayName}.`], now),
      );
    }
    if (c.isWeekend) out.push('סוף שבוע — קצב רגוע יותר.');
    out.push(`היום ${c.dateLabel}.`);
  } else {
    if (c.part === 'late') {
      out.push(
        pickByDay(
          ["It's late. I'll keep watch while you rest.", 'Late hour — everything’s logged, rest easy.'],
          now,
        ),
      );
    } else if (c.part === 'morning') {
      out.push(
        pickByDay(
          [`A fresh ${c.dayName} morning. Where do we start?`, `${c.dayName} is under way. First thing?`],
          now,
        ),
      );
    } else if (c.part === 'evening') {
      out.push(
        pickByDay(
          [`${c.dayName} evening — let's tie off loose ends.`, `${c.dayName} is winding down. What's left?`],
          now,
        ),
      );
    } else {
      out.push(pickByDay([`${c.dayName} ${EN_PART[c.part]}.`, `${EN_PART[c.part]} on ${c.dayName}.`], now));
    }
    if (c.isWeekend) out.push("It's the weekend — easier pace.");
    out.push(`Today is ${c.dateLabel}.`);
  }
  return out;
}
