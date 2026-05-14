import type { OneProcess } from './types';
import type { DomainId } from './spaces';
import type { FlowUnit } from './flowUnit';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Count how many processes exist per domain (only domains with count >= 2).
 */
export function deriveRecurringGoalTypes(
  processes: OneProcess[]
): { domainId: DomainId; count: number }[] {
  const counts = new Map<DomainId, number>();
  for (const p of processes) {
    const d = p.domainId;
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([domainId, count]) => ({ domainId, count }))
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count);
}

/**
 * Return active processes with no timeline events in the last 7 days.
 */
export function deriveInactiveUnits(
  processes: OneProcess[],
  now: number
): OneProcess[] {
  return processes.filter((p) => {
    if (p.status !== 'active') return false;
    const lastEvent = p.timeline.length > 0 ? p.timeline[p.timeline.length - 1] : null;
    const lastTs = lastEvent ? new Date(lastEvent.at).getTime() : new Date(p.createdAt).getTime();
    return now - lastTs > SEVEN_DAYS_MS;
  });
}

/**
 * Across all active units, find which required profile-slot labels are most commonly unfilled.
 */
export function deriveCommonlyMissingSlots(
  units: FlowUnit[]
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const u of units) {
    if (u.status !== 'active') continue;
    for (const s of u.profileSlots ?? []) {
      if (s.optional) continue;
      if (!s.value?.trim()) {
        counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Simple status counts across all processes.
 */
export function deriveOperationalSummary(
  processes: OneProcess[]
): { active: number; waiting: number; done: number; total: number } {
  let active = 0;
  let waiting = 0;
  let done = 0;
  for (const p of processes) {
    if (p.status === 'active') active++;
    else if (p.status === 'waiting') waiting++;
    else if (p.status === 'done') done++;
  }
  return { active, waiting, done, total: processes.length };
}
