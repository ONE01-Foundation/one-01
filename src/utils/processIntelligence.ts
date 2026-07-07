/**
 * processIntelligence — ONE's read on a process.
 *
 * ONE is meant to be a chief-of-staff, not a notepad: it should look at where a
 * process actually stands and tell you the single most useful next move, with a
 * reason. This module turns the raw Unit signals (open steps + their due dates,
 * reminders, progress, how long since anything moved, lifecycle) into a small
 * `UnitFocus` verdict the UI can render and act on in one tap.
 *
 * It is intentionally PURE and fully offline — no AI round-trip. That keeps the
 * proactive nudge instant and reliable even when the network or the edge
 * function is down, and it composes with the AI chat rather than competing.
 *
 * Localized he/en. Manual-RTL safe (returns plain strings; callers wrap with
 * rtlText). All Date use is fine here — this runs on-device, not in a worklet.
 */
import type { Unit, UnitStep, UnitReminder } from '../core/mvp/types';

export type FocusState =
  | 'overdue' // a reminder/step blew past its due time
  | 'due_soon' // something is due within ~2 days
  | 'almost_done' // ≥80% there, or one step from the finish line
  | 'stalled' // nothing has moved in a while but work remains
  | 'next_step' // healthy, with a clear open step
  | 'on_track' // moving, nothing demanding attention
  | 'done'; // completed — a recap, not a nudge

/** A one-tap action ONE can take from its read. Mirrors writes the
 *  UnitProfileSheet already performs, so the card never invents new behavior. */
export type UnitFocusCta =
  | { kind: 'complete_step'; stepId: string; label: string }
  | { kind: 'complete_process'; label: string }
  | { kind: 'reminder_done'; reminderId: string; label: string }
  | { kind: 'snooze_reminder'; reminderId: string; label: string }
  | { kind: 'discuss'; prompt: string; label: string };

export interface UnitFocus {
  state: FocusState;
  /** Short line ONE says about this process right now. */
  headline: string;
  /** One-line "why" — the signal ONE is reacting to. */
  reason: string;
  /** 0..100 — used to rank this process against the others. */
  urgency: number;
  /** Optional contextual action. */
  cta?: UnitFocusCta;
}

const DAY = 86_400_000;
const STALLED_DAYS = 7;
const DUE_SOON_DAYS = 2;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole-day-aware relative phrase: "today" / "tomorrow" / "in 3 days" /
 *  "2 days ago". Returns null when the ISO can't be parsed. */
function relativeDay(iso: string | undefined, nowMs: number, lang: 'en' | 'he'): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const he = lang === 'he';
  const diff = Math.round((startOfDay(ms) - startOfDay(nowMs)) / DAY);
  if (diff === 0) return he ? 'היום' : 'today';
  if (diff === 1) return he ? 'מחר' : 'tomorrow';
  if (diff === -1) return he ? 'אתמול' : 'yesterday';
  if (diff > 1) return he ? `בעוד ${diff} ימים` : `in ${diff} days`;
  return he ? `לפני ${-diff} ימים` : `${-diff} days ago`;
}

/** Days since the unit last moved (rounded down, never negative). */
function daysSince(iso: string | undefined, nowMs: number): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((nowMs - ms) / DAY));
}

/** Earliest-due open reminder that carries a resolvable dueAt. */
function nextDueReminder(reminders: UnitReminder[]): UnitReminder | null {
  const dated = reminders
    .filter((r) => !r.done && r.dueAt && !Number.isNaN(Date.parse(r.dueAt)))
    .sort((a, b) => Date.parse(a.dueAt as string) - Date.parse(b.dueAt as string));
  return dated[0] ?? null;
}

/** Earliest-due open step that carries a resolvable dueAt. */
function nextDueStep(steps: UnitStep[]): UnitStep | null {
  const dated = steps
    .filter((s) => !s.done && s.dueAt && !Number.isNaN(Date.parse(s.dueAt)))
    .sort((a, b) => Date.parse(a.dueAt as string) - Date.parse(b.dueAt as string));
  return dated[0] ?? null;
}

function progressFraction(unit: Unit, openSteps: UnitStep[], totalSteps: number): number | null {
  if (unit.progress && unit.progress.total > 0) {
    return Math.min(1, Math.max(0, unit.progress.current / unit.progress.total));
  }
  if (totalSteps > 0) return (totalSteps - openSteps.length) / totalSteps;
  return null;
}

/**
 * The core read. Walks the signals in priority order (most demanding first) and
 * returns the first that fires, so the card always shows the ONE thing that
 * matters most for this process right now.
 */
export function analyzeUnit(unit: Unit, nowMs: number, lang: 'en' | 'he'): UnitFocus {
  const he = lang === 'he';
  const steps = unit.nextSteps ?? [];
  const reminders = unit.reminders ?? [];
  const openSteps = steps.filter((s) => !s.done);
  const openReminders = reminders.filter((r) => !r.done);
  const totalSteps = steps.length;
  const frac = progressFraction(unit, openSteps, totalSteps);

  // 0 ─ Completed: a warm recap, never a nudge.
  if (unit.status === 'completed') {
    return {
      state: 'done',
      headline: he ? 'הושלם — מכוונה למציאות.' : 'Complete — from intent to reality.',
      reason: he ? 'אפשר לפתוח מחדש אם צריך.' : 'Reopen any time if it comes back.',
      urgency: 0,
    };
  }

  const dueRem = nextDueReminder(openReminders);
  const dueStep = nextDueStep(openSteps);

  // 1 ─ Overdue: a dated reminder/step is in the past.
  const overdueRem = dueRem && Date.parse(dueRem.dueAt as string) < nowMs ? dueRem : null;
  const overdueStep = dueStep && Date.parse(dueStep.dueAt as string) < nowMs ? dueStep : null;
  if (overdueRem || overdueStep) {
    const isRem = !!overdueRem;
    const text = isRem ? (overdueRem as UnitReminder).text : (overdueStep as UnitStep).title;
    const whenIso = isRem ? (overdueRem as UnitReminder).dueAt : (overdueStep as UnitStep).dueAt;
    const rel = relativeDay(whenIso, nowMs, lang);
    const lateDays = Math.max(1, daysSince(whenIso, nowMs));
    return {
      state: 'overdue',
      headline: he ? `התעכב: ${text}` : `Overdue: ${text}`,
      reason: he
        ? `היה אמור ${rel ?? 'מזמן'}. כדאי לסגור את זה.`
        : `Was due ${rel ?? 'a while ago'}. Worth closing out.`,
      urgency: Math.min(100, 88 + lateDays),
      cta: isRem
        ? {
            kind: 'reminder_done',
            reminderId: (overdueRem as UnitReminder).id,
            label: he ? 'בוצע' : 'Done',
          }
        : {
            kind: 'complete_step',
            stepId: (overdueStep as UnitStep).id,
            label: he ? 'סמן כבוצע' : 'Mark done',
          },
    };
  }

  // 2 ─ Due soon: dated within the next couple of days.
  const soon = [dueRem, dueStep]
    .filter((x): x is UnitReminder | UnitStep => !!x)
    .find((x) => {
      const ms = Date.parse((x as { dueAt?: string }).dueAt as string);
      return ms - nowMs <= DUE_SOON_DAYS * DAY;
    });
  if (soon) {
    const isRem = 'text' in soon;
    const text = isRem ? (soon as UnitReminder).text : (soon as UnitStep).title;
    const rel = relativeDay((soon as { dueAt?: string }).dueAt, nowMs, lang);
    return {
      state: 'due_soon',
      headline: he ? `${rel ?? 'בקרוב'}: ${text}` : `${rel ?? 'Soon'}: ${text}`,
      reason: he ? 'מתקרב מועד — שווה להתכונן.' : 'Coming up — worth getting ahead of it.',
      urgency: 78,
      cta: isRem
        ? {
            kind: 'reminder_done',
            reminderId: (soon as UnitReminder).id,
            label: he ? 'בוצע' : 'Done',
          }
        : {
            kind: 'complete_step',
            stepId: (soon as UnitStep).id,
            label: he ? 'סמן כבוצע' : 'Mark done',
          },
    };
  }

  // 3 ─ Almost done: ≥80% there, at most one open step.
  if (frac !== null && frac >= 0.8 && openSteps.length <= 1) {
    if (openSteps.length === 0) {
      return {
        state: 'almost_done',
        headline: he ? 'הכול בוצע — לסגור את התהליך?' : 'Everything is done — close it out?',
        reason: he ? 'לא נשארו צעדים פתוחים.' : 'No open steps remain.',
        urgency: 72,
        cta: { kind: 'complete_process', label: he ? 'סמן כהושלם ✓' : 'Mark complete ✓' },
      };
    }
    const last = openSteps[0];
    return {
      state: 'almost_done',
      headline: he ? `צעד אחרון: ${last.title}` : `Last step: ${last.title}`,
      reason: he ? 'כמעט שם — צעד אחד מהיעד.' : 'Almost there — one step from the finish.',
      urgency: 66,
      cta: { kind: 'complete_step', stepId: last.id, label: he ? 'סמן כבוצע' : 'Mark done' },
    };
  }

  // 4 ─ Stalled: nothing moved in a while, but work remains.
  const idle = daysSince(unit.lastUpdatedAt, nowMs);
  const hasOpenWork = openSteps.length > 0 || openReminders.length > 0;
  if (idle >= STALLED_DAYS && hasOpenWork) {
    return {
      state: 'stalled',
      headline: he
        ? `נח כבר ${idle} ימים — נחזיר לתנועה?`
        : `Idle ${idle} days — get it moving?`,
      reason: he
        ? 'לא היה עדכון לאחרונה. בוא נבחר צעד.'
        : 'No movement lately. Let’s pick the next move.',
      urgency: Math.min(64, 46 + idle),
      cta: {
        kind: 'discuss',
        label: he ? 'מה הצעד הבא?' : 'What’s next?',
        prompt: he
          ? `מה הצעד הבא הכי חשוב ב"${unit.title}"?`
          : `What’s the most important next step for "${unit.title}"?`,
      },
    };
  }

  // 5 ─ Healthy with a clear next step.
  if (openSteps.length > 0) {
    const next = openSteps[0];
    const doneCount = totalSteps - openSteps.length;
    return {
      state: 'next_step',
      headline: he ? `הצעד הבא: ${next.title}` : `Next: ${next.title}`,
      reason:
        totalSteps > 0
          ? he
            ? `${doneCount} מתוך ${totalSteps} צעדים הושלמו.`
            : `${doneCount} of ${totalSteps} steps done.`
          : he
            ? 'בוא נתקדם עם זה.'
            : 'Let’s move this forward.',
      urgency: 40,
      cta: { kind: 'complete_step', stepId: next.id, label: he ? 'סמן כבוצע' : 'Mark done' },
    };
  }

  // 6 ─ An open reminder but no steps.
  if (openReminders.length > 0) {
    const r = openReminders[openReminders.length - 1];
    return {
      state: 'next_step',
      headline: he ? `שמור על: ${r.text}` : `On your radar: ${r.text}`,
      reason: r.dueLabel
        ? he
          ? `ל${r.dueLabel}.`
          : `for ${r.dueLabel}.`
        : he
          ? 'מחכה לתשומת לבך.'
          : 'Waiting for your attention.',
      urgency: 36,
      cta: { kind: 'reminder_done', reminderId: r.id, label: he ? 'בוצע' : 'Done' },
    };
  }

  // 7 ─ Calm. Moving, nothing demanding — offer a gentle way in.
  return {
    state: 'on_track',
    headline: he ? 'בתנועה. אעדכן כשיהיה משהו.' : 'In motion. I’ll flag anything that needs you.',
    reason: he ? 'אין כרגע צעד דחוף.' : 'Nothing urgent right now.',
    urgency: 10,
    cta: {
      kind: 'discuss',
      label: he ? 'מה הלאה?' : 'What now?',
      prompt: he
        ? `מה כדאי לקדם עכשיו ב"${unit.title}"?`
        : `What’s worth pushing on now for "${unit.title}"?`,
    },
  };
}

/**
 * Rank all active processes by how much they need attention. Completed and
 * fully-calm processes are dropped, so the result is a focus list: the things
 * actually worth a move, hottest first.
 */
export function analyzeAll(
  units: Unit[],
  nowMs: number,
  lang: 'en' | 'he',
): Array<{ unit: Unit; focus: UnitFocus }> {
  return units
    .filter((u) => u.status !== 'completed')
    .map((unit) => ({ unit, focus: analyzeUnit(unit, nowMs, lang) }))
    .filter((x) => x.focus.urgency >= 30)
    .sort((a, b) => b.focus.urgency - a.focus.urgency);
}

/** The single most important move across every active process, or null. */
export function topFocus(
  units: Unit[],
  nowMs: number,
  lang: 'en' | 'he',
): { unit: Unit; focus: UnitFocus } | null {
  return analyzeAll(units, nowMs, lang)[0] ?? null;
}
