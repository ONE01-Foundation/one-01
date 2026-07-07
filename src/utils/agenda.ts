/**
 * agenda — ONE's "Today" engine.
 *
 * ONE is a digital intermediary that completes processes. The agenda is how it
 * earns that: it looks across ALL the active identity's processes and assembles
 * a single, prioritized list of what actually needs the user now — due/overdue
 * reminders, steps with a deadline, processes that are hot (new updates) or have
 * gone quiet. Each item points back to the process so it's one tap to act.
 *
 * Pure: callers pass `now` so it stays deterministic and testable.
 */

import type { Unit } from '../core/mvp/types';
import type { AppLanguage } from '../stores/localeStore';

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

export type AgendaKind = 'reminder' | 'step' | 'hot' | 'stuck';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  /** Higher = more urgent. Used to sort the list. */
  priority: number;
  unitId: string;
  unitTitle: string;
  unitEmoji: string;
  /** The actionable thing ("Call the instructor", "Book Florence stay"). */
  text: string;
  /** Context line — process name + when it's due / how stale. */
  sub: string;
  /** When set, the item can be ticked off in place (source pointer). */
  reminderId?: string;
  stepId?: string;
  overdue?: boolean;
}

function pick(lang: AppLanguage, en: string, he: string): string {
  return lang === 'he' ? he : en;
}

function relWhen(ms: number, lang: AppLanguage): string {
  const h = Math.round(ms / MS_HOUR);
  if (h <= 0) return pick(lang, 'now', 'עכשיו');
  if (h < 24) return pick(lang, `in ${h}h`, `בעוד ${h} ש׳`);
  return pick(lang, 'tomorrow', 'מחר');
}

/**
 * Build the prioritized agenda across a set of units. Pass the active
 * identity's units (or all of them) — the function doesn't filter by identity.
 */
export function buildAgenda(units: Unit[], now: number, lang: AppLanguage): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const u of units) {
    // A finished process is out of the picture — it no longer needs the user.
    if (u.status === 'completed') continue;

    // 1. Reminders — due or overdue (within the next day).
    for (const r of u.reminders ?? []) {
      if (r.done || !r.dueAt) continue;
      const due = Date.parse(r.dueAt);
      if (Number.isNaN(due)) continue;
      const overdue = due <= now;
      const soon = !overdue && due - now <= MS_DAY;
      if (!overdue && !soon) continue;
      items.push({
        id: `rem_${u.id}_${r.id}`,
        kind: 'reminder',
        priority: overdue ? 100 : 80,
        unitId: u.id,
        unitTitle: u.title,
        unitEmoji: u.emoji,
        text: r.text,
        sub: `${u.title} · ${overdue ? pick(lang, 'overdue', 'עבר הזמן') : relWhen(due - now, lang)}`,
        reminderId: r.id,
        overdue,
      });
    }

    // 2. Next steps that carry a deadline today / overdue.
    for (const s of u.nextSteps ?? []) {
      if (s.done || !s.dueAt) continue;
      const due = Date.parse(s.dueAt);
      if (Number.isNaN(due)) continue;
      const overdue = due <= now;
      const soon = !overdue && due - now <= MS_DAY;
      if (!overdue && !soon) continue;
      items.push({
        id: `step_${u.id}_${s.id}`,
        kind: 'step',
        priority: overdue ? 90 : 70,
        unitId: u.id,
        unitTitle: u.title,
        unitEmoji: u.emoji,
        text: s.title,
        sub: `${u.title} · ${overdue ? pick(lang, 'overdue', 'עבר הזמן') : relWhen(due - now, lang)}`,
        stepId: s.id,
        overdue,
      });
    }

    // 3. Hot — the process has piled up unread updates.
    if ((u.unreadUpdates ?? 0) >= 2) {
      items.push({
        id: `hot_${u.id}`,
        kind: 'hot',
        priority: 60,
        unitId: u.id,
        unitTitle: u.title,
        unitEmoji: u.emoji,
        text: pick(lang, `${u.unreadUpdates} new updates`, `${u.unreadUpdates} עדכונים חדשים`),
        sub: u.title,
      });
    }

    // 4. Stuck — quiet for a while but still has open steps.
    const last = Date.parse(u.lastUpdatedAt);
    if (!Number.isNaN(last)) {
      const days = Math.floor((now - last) / MS_DAY);
      const openSteps = (u.nextSteps ?? []).filter((s) => !s.done).length;
      if (days >= 10 && openSteps > 0) {
        items.push({
          id: `stuck_${u.id}`,
          kind: 'stuck',
          priority: 40,
          unitId: u.id,
          unitTitle: u.title,
          unitEmoji: u.emoji,
          text: pick(lang, 'Quiet for a while — pick it back up?', 'שקט כבר זמן — לחזור אליו?'),
          sub: `${u.title} · ${pick(lang, `${days}d`, `${days} ימים`)}`,
        });
      }
    }
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, 8);
}

/** ONE-voiced headline summarising the agenda. */
export function agendaHeadline(count: number, lang: AppLanguage): string {
  if (count === 0) return pick(lang, "You're all caught up — nothing needs you right now.", 'הכול תחת שליטה — שום דבר לא דורש אותך כרגע.');
  if (count === 1) return pick(lang, '1 thing needs you today.', 'דבר אחד מחכה לך היום.');
  return pick(lang, `${count} things need you today.`, `${count} דברים מחכים לך היום.`);
}
