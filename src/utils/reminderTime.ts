/**
 * reminderTime — best-effort natural-language → due timestamp for reminders.
 *
 * ONE returns a free-text `when` ("tomorrow 9am", "מחר", "in 2 hours",
 * "ביום ראשון"). We pin it to an ISO instant so the home can surface the
 * reminder the moment it's due. When we can't parse a time we return
 * undefined — the reminder still exists, just without a due moment.
 *
 * Pass `now` (Date.now()) in so this stays pure + testable, and so it never
 * touches a forbidden argless `Date.now()` inside a worklet path.
 */

// 0 = Sunday … 6 = Saturday (JS getDay order).
const HE_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const EN_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Resolve a `when` phrase to an ISO due time, or undefined if unparseable. */
export function resolveReminderDue(when: string | undefined, now: number): string | undefined {
  if (!when) return undefined;
  const s = when.toLowerCase().trim();

  // "in N units" / "בעוד N יחידות" — the number is optional ("in an hour",
  // "בעוד שעה" → 1).
  const rel = s.match(
    /(?:in|בעוד)\s*(\d+)?\s*(?:an?\s+)?(minutes?|min|דקה|דקות|hours?|שעה|שעות|days?|יום|ימים|weeks?|שבוע|שבועות)/,
  );
  if (rel) {
    const n = rel[1] ? parseInt(rel[1], 10) : 1;
    const unit = rel[2];
    const d = new Date(now);
    if (/min|דק/.test(unit)) d.setMinutes(d.getMinutes() + n);
    else if (/hour|שע/.test(unit)) d.setHours(d.getHours() + n);
    else if (/week|שבוע/.test(unit)) d.setDate(d.getDate() + n * 7);
    else d.setDate(d.getDate() + n);
    return d.toISOString();
  }

  // Day anchor.
  let d: Date | null = null;
  if (/tomorrow|מחר/.test(s)) {
    d = new Date(now);
    d.setDate(d.getDate() + 1);
  } else if (/tonight|הערב|בערב/.test(s)) {
    d = new Date(now);
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  } else if (/today|היום/.test(s)) {
    d = new Date(now);
  } else {
    for (let i = 0; i < 7; i++) {
      if (s.includes(HE_WEEKDAYS[i]) || s.includes(EN_WEEKDAYS[i])) {
        d = new Date(now);
        const diff = (i - d.getDay() + 7) % 7 || 7; // next occurrence (never today)
        d.setDate(d.getDate() + diff);
        break;
      }
    }
  }

  // Explicit clock time: "9", "9:30", "9am", "20:00".
  const tm = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (tm && (d || /\d/.test(s))) {
    let hh = parseInt(tm[1], 10);
    const mm = tm[2] ? parseInt(tm[2], 10) : 0;
    const ap = tm[3];
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    if (hh > 23 || mm > 59) {
      // The number was something else (a date, a duration) — fall through.
    } else {
      if (!d) d = new Date(now);
      d.setHours(hh, mm, 0, 0);
      return d.toISOString();
    }
  }

  if (d) {
    d.setHours(9, 0, 0, 0); // a date with no clock → default morning
    return d.toISOString();
  }
  return undefined;
}

/** True when the reminder's moment has arrived (or passed). */
export function isReminderDue(dueAt: string | undefined, now: number): boolean {
  if (!dueAt) return false;
  const t = Date.parse(dueAt);
  return !Number.isNaN(t) && t <= now;
}

/** Compact relative label for a due time: "now" / "in 20m" / "tomorrow". */
export function formatDueRelative(dueAt: string | undefined, now: number, he: boolean): string {
  if (!dueAt) return '';
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return '';
  const min = Math.round((t - now) / 60000);
  if (min <= 0) return he ? 'עכשיו' : 'now';
  if (min < 60) return he ? `בעוד ${min} דק׳` : `in ${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return he ? `בעוד ${h} ש׳` : `in ${h}h`;
  const days = Math.round(h / 24);
  if (days === 1) return he ? 'מחר' : 'tomorrow';
  return he ? `בעוד ${days} ימים` : `in ${days}d`;
}
