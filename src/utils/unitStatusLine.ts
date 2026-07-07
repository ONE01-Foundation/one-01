import type { Unit } from '../core/mvp/types';

// The generic seed lines a brand-new process used to carry. We treat them as
// "no real broadcast yet" so a LIVE status is derived instead of showing a
// static default prompt that reads the same on every fresh card.
const SEED_BROADCASTS = [
  'רגע להתחלה — מה הכי חשוב שנדייק קודם?',
  'Fresh start — what matters most to nail down first?',
  'Just getting started.',
];

/** True when `text` is one of the generic "nothing has happened yet" seed
 *  lines — callers filter these out so a fresh process never shows a static
 *  default prompt where a live status belongs. */
export function isSeedBroadcast(text: string | undefined | null): boolean {
  return SEED_BROADCASTS.includes((text ?? '').trim());
}

/**
 * A LIVE, self-updating one-line status for a process — the single source of
 * truth for "what's happening here right now", shared by the Home cards and the
 * profile's All-processes list so they never drift apart.
 *
 * Priority: the real latest broadcast (the line that bumps as things happen) →
 * the next actionable reminder → the next open step → unread updates → step
 * progress. Returns `null` when there is genuinely nothing live to say, so the
 * caller can render a clean title-only row instead of a stale default prompt.
 */
export function unitStatusLine(unit: Unit, he: boolean): string | null {
  const bc = (unit.latestBroadcastText?.[0] ?? '').trim();
  if (bc && !isSeedBroadcast(bc)) return bc;

  const reminder = (unit.reminders ?? []).find((r) => !r.done);
  if (reminder?.text) return he ? `תזכורת: ${reminder.text}` : `Reminder: ${reminder.text}`;

  const step = (unit.nextSteps ?? []).find((s) => !s.done);
  if (step?.title) return he ? `הבא בתור: ${step.title}` : `Next up: ${step.title}`;

  const unread = unit.unreadUpdates ?? 0;
  if (unread > 0) {
    return he
      ? unread === 1 ? 'עדכון חדש ממתין' : `${unread} עדכונים חדשים`
      : unread === 1 ? '1 new update' : `${unread} new updates`;
  }

  const steps = unit.nextSteps ?? [];
  if (steps.length > 0) {
    const done = steps.filter((s) => s.done).length;
    return he ? `${done}/${steps.length} צעדים הושלמו` : `${done}/${steps.length} steps done`;
  }

  return null;
}
