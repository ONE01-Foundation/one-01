/**
 * activity — ONE's "what I've been doing" engine.
 *
 * Every meaningful action ONE takes on a process (created it, captured a task,
 * saved a decision, set a reminder, wrote an update, completed it) is logged to
 * that unit's `timeline` (see mvpStore.pushUnitNotification). This module reads
 * those timelines back:
 *   • per-process — the Process → Timeline section, and
 *   • cross-process — a single "recent activity" feed for the ONE profile,
 *     so opening ONE shows everything it has quietly been doing for you.
 *
 * Pure + deterministic — callers pass `now` so relative times stay testable.
 */

import type { Unit, UnitActivityKind } from '../core/mvp/types';
import type { AppLanguage } from '../stores/localeStore';

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

export interface ActivityEntry {
  id: string;
  unitId: string;
  unitTitle: string;
  unitEmoji: string;
  /** The action ONE recorded (e.g. "Decision saved: book Florence"). */
  text: string;
  /** Relative time label ("just now", "2h ago", "Mon"). */
  when: string;
  kind?: UnitActivityKind;
}

function pick(lang: AppLanguage, en: string, he: string): string {
  return lang === 'he' ? he : en;
}

/** Short relative-time label for an ISO timestamp. */
export function relativeWhen(iso: string, now: number, lang: AppLanguage): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  if (diff < MS_MIN) return pick(lang, 'just now', 'עכשיו');
  if (diff < MS_HOUR) {
    const m = Math.floor(diff / MS_MIN);
    return pick(lang, `${m}m ago`, `לפני ${m} ד׳`);
  }
  if (diff < MS_DAY) {
    const h = Math.floor(diff / MS_HOUR);
    return pick(lang, `${h}h ago`, `לפני ${h} ש׳`);
  }
  const d = Math.floor(diff / MS_DAY);
  if (d === 1) return pick(lang, 'yesterday', 'אתמול');
  if (d < 7) return pick(lang, `${d}d ago`, `לפני ${d} ימים`);
  try {
    return new Date(t).toLocaleDateString();
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** Emoji + short localized label + accent colour for an activity kind. */
export function activityKindMeta(
  kind: UnitActivityKind | undefined,
  lang: AppLanguage,
): { emoji: string; label: string; color: string } {
  switch (kind) {
    case 'created':
      return { emoji: '✨', label: pick(lang, 'Created', 'נוצר'), color: '#8B5CF6' };
    case 'completed':
      return { emoji: '🎉', label: pick(lang, 'Completed', 'הושלם'), color: '#10B981' };
    case 'capture':
      return { emoji: '📌', label: pick(lang, 'Captured', 'נלכד'), color: '#F59E0B' };
    case 'decision':
      return { emoji: '✓', label: pick(lang, 'Decision', 'החלטה'), color: '#3B82F6' };
    case 'update':
      return { emoji: '↻', label: pick(lang, 'Updated', 'עודכן'), color: '#10B981' };
    case 'reminder':
      return { emoji: '⏰', label: pick(lang, 'Reminder', 'תזכורת'), color: '#F97316' };
    default:
      return { emoji: '•', label: pick(lang, 'Update', 'עדכון'), color: '#94A3B8' };
  }
}

/**
 * Flatten the timelines of a set of units into one newest-first feed. Pass the
 * active identity's units (or all of them) — this function doesn't filter by
 * identity. `limit` caps how many entries come back.
 */
export function buildRecentActivity(
  units: Unit[],
  now: number,
  lang: AppLanguage,
  limit = 8,
): ActivityEntry[] {
  const flat: { unit: Unit; ts: number; id: string; title: string; kind?: UnitActivityKind }[] = [];
  for (const u of units) {
    for (const it of u.timeline ?? []) {
      const ts = Date.parse(it.date);
      flat.push({
        unit: u,
        ts: Number.isNaN(ts) ? 0 : ts,
        id: it.id,
        title: it.title,
        kind: it.kind,
      });
    }
  }
  flat.sort((a, b) => b.ts - a.ts);
  return flat.slice(0, limit).map((e) => ({
    id: e.id,
    unitId: e.unit.id,
    unitTitle: e.unit.title,
    unitEmoji: e.unit.emoji,
    text: e.title,
    when: e.ts ? relativeWhen(new Date(e.ts).toISOString(), now, lang) : '',
    kind: e.kind,
  }));
}
