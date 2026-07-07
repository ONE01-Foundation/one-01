/**
 * Attention score — verbatim from ONE_MIGRATION_BUILD_PLAN §6.
 *
 * Higher score = more attention needed. Used to sort the Processes list.
 *
 *   unreadUpdates * 10
 *   + 50 if the primary broadcast is type 'attention'
 *   + 40 if 'missing_info'
 *   + 30 if 'event'
 *   + 20 if 'waiting'
 *   + recency bonus: max(0, 24 - hoursSinceUpdate)
 */

import type { Unit } from './types';

const TYPE_WEIGHT: Record<string, number> = {
  attention: 50,
  missing_info: 40,
  event: 30,
  waiting: 20,
  next_step: 15,
  progress: 5,
  calm: 0,
  system: 0,
};

function getHoursSince(iso: string, now: number = Date.now()): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 999;
  return Math.max(0, (now - t) / (1000 * 60 * 60));
}

export function attentionScore(unit: Unit, now: number = Date.now()): number {
  let score = (unit.unreadUpdates ?? 0) * 10;

  const primary = unit.broadcast?.[0];
  if (primary) {
    score += TYPE_WEIGHT[primary.type] ?? 0;
  }

  const hoursSinceUpdate = getHoursSince(unit.lastUpdatedAt, now);
  score += Math.max(0, 24 - hoursSinceUpdate);

  return score;
}

export function sortByAttention(units: Unit[], now?: number): Unit[] {
  return [...units].sort((a, b) => {
    // Completed processes always sink to the bottom — they're done, they
    // don't compete for attention.
    const aDone = a.status === 'completed' ? 1 : 0;
    const bDone = b.status === 'completed' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // Chat-app ordering: the MOST-RECENTLY-UPDATED process leads. Any update or
    // change to a process (a new broadcast, a captured task, a chat message)
    // bumps its `lastUpdatedAt`, floating its card to the top of the list.
    const ta = Date.parse(a.lastUpdatedAt) || 0;
    const tb = Date.parse(b.lastUpdatedAt) || 0;
    if (tb !== ta) return tb - ta;
    // Same timestamp → fall back to how much attention each needs.
    return attentionScore(b, now) - attentionScore(a, now);
  });
}
