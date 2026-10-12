/**
 * Hebrew-aware fuzzy matching for process updates — shared by the Home chat and
 * the Unit profile sheet so "update my weight to 72" lands on the RIGHT existing
 * metric (not a hidden extra one), and a declared value that answers an open
 * step checks that step off.
 *
 * The AI labels a declared value ("salary cost") that rarely matches a metric
 * label character-for-character ("estimated cost"). Exact-match dropped these on
 * the floor. These helpers do token-overlap matching instead.
 */

import type { UnitStep } from '../core/mvp/types';

/** lowercase, strip Hebrew niqqud + punctuation, collapse whitespace. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud / cantillation marks
    .replace(/["'`.,:;!?()[\]{}<>/\\|״׳–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Short Hebrew/English particles that carry no matching signal.
const STOP_TOKENS = new Set([
  'the', 'a', 'of', 'to', 'for', 'and', 'my', 'is', 'on', 'in',
  'של', 'עם', 'על', 'את', 'לי', 'כ', 'ה', 'ו', 'ל', 'ב', 'מ',
]);

/** Significant tokens (≥2 chars, non-stopword) for overlap matching. */
export function sigTokens(s: string): string[] {
  return normalizeLabel(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

/** Index of the metric whose label best matches `wanted` — exact first,
 *  then a shared significant token. -1 if nothing reasonable matches. */
export function matchMetricIndex(metrics: { label: string }[], wanted: string): number {
  const wn = normalizeLabel(wanted);
  const exact = metrics.findIndex((m) => normalizeLabel(m.label) === wn);
  if (exact >= 0) return exact;
  const wTokens = new Set(sigTokens(wanted));
  if (wTokens.size === 0) return -1;
  return metrics.findIndex((m) => sigTokens(m.label).some((t) => wTokens.has(t)));
}

/** Given declared updates, check off any OPEN step whose title is clearly
 *  answered by one (e.g. user gives the company name → "decide company
 *  name"). Conservative: needs ≥half the step's significant tokens shared.
 *  Returns the (possibly) updated steps + the titles that got completed. */
export function completeStepsFromUpdates(
  steps: UnitStep[] | undefined,
  updates: Array<{ metricLabel: string; value: string }>,
): { steps: UnitStep[]; completed: string[] } {
  const list = steps ?? [];
  if (!list.length || !updates?.length) return { steps: list, completed: [] };
  const completed: string[] = [];
  const next = list.map((s) => {
    if (s.done) return s;
    const stTokens = sigTokens(s.title);
    if (!stTokens.length) return s;
    for (const u of updates) {
      const uTokens = new Set([
        ...sigTokens(u.metricLabel),
        ...sigTokens(String(u.value)),
      ]);
      const overlap = stTokens.filter((t) => uTokens.has(t)).length;
      if (overlap >= 1 && overlap / stTokens.length >= 0.5) {
        completed.push(s.title);
        return { ...s, done: true };
      }
    }
    return s;
  });
  return { steps: next, completed };
}
