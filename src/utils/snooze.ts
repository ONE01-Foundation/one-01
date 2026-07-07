/**
 * snooze — reschedule a reminder forward.
 *
 * ONE is supposed to bring things back at the right moment. "Not now" can't
 * mean "lost" — it means "remind me later". This computes the new due moment
 * + a language-aware label for the three quick snooze choices. Pure: pass
 * `now` in so it stays deterministic and testable.
 */

import type { AppLanguage } from '../stores/localeStore';

export type SnoozeOption = 'later' | 'tomorrow' | 'week';

/** The three choices, in the order they should appear in an action sheet. */
export const SNOOZE_OPTIONS: SnoozeOption[] = ['later', 'tomorrow', 'week'];

export interface SnoozeResult {
  /** New resolved ISO due time. */
  dueAt: string;
  /** Human, language-aware due label ("tomorrow 9:00", "בעוד שבוע"). */
  dueLabel: string;
}

/** Compute the new due moment + label for a snooze choice, relative to `now`. */
export function snoozeTarget(option: SnoozeOption, now: number, lang: AppLanguage): SnoozeResult {
  const he = lang === 'he';
  const d = new Date(now);
  switch (option) {
    case 'later':
      // A few hours out — still today, just "not right now".
      d.setHours(d.getHours() + 3, d.getMinutes(), 0, 0);
      return { dueAt: d.toISOString(), dueLabel: he ? 'בעוד 3 שעות' : 'in 3 hours' };
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return { dueAt: d.toISOString(), dueLabel: he ? 'מחר 9:00' : 'tomorrow 9:00' };
    case 'week':
    default:
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return { dueAt: d.toISOString(), dueLabel: he ? 'בעוד שבוע' : 'in a week' };
  }
}

/** Localized label for a snooze choice (the button text in an action sheet). */
export function snoozeOptionLabel(option: SnoozeOption, lang: AppLanguage): string {
  const he = lang === 'he';
  switch (option) {
    case 'later':
      return he ? 'אחר כך היום' : 'Later today';
    case 'tomorrow':
      return he ? 'מחר בבוקר' : 'Tomorrow morning';
    case 'week':
    default:
      return he ? 'בעוד שבוע' : 'Next week';
  }
}
