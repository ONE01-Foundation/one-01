/**
 * buildLocalProcess — turn a plain-language intent into a real, archetype-enriched
 * Unit WITHOUT any backend (the "offline brain"). Shared by HomeFocus's composer
 * fallback and the MeetOne first-run conversation, so there is ONE source of truth
 * for "a sentence becomes a process".
 *
 * It keeps the archetype PLAN (step titles, metric labels, a domain opener) but
 * resets any sample progress to a true zero-start — nothing claims work the user
 * hasn't done yet.
 */
import type { Unit, Identity } from '../core/mvp/types';
import { desireToUnit } from './mvpInferUnit';
import { enrichUnitFromArchetype, detectArchetypeStrict, generateRichUnit } from '../data/mvp/unitArchetype';
import { cleanProcessTitle } from './localIntent';
import { inferSpaceFromText, resolveSpaceIdentityId } from './spaceRouting';

export function buildLocalProcess(text: string, identities: Identity[], activeId: string): Unit {
  const contentHe = /[֐-׿]/.test(text);
  const cLang: 'he' | 'en' = contentHe ? 'he' : 'en';
  // Route to the right space from keywords (business / family / else active).
  const targetId = resolveSpaceIdentityId(inferSpaceFromText(text), identities, activeId);
  // A recognised domain → the fully-bilingual rich archetype; otherwise the
  // generic desire→unit path, enriched.
  const archKey = detectArchetypeStrict(text);
  const enriched = archKey
    ? generateRichUnit(text, targetId, cLang)
    : enrichUnitFromArchetype(desireToUnit(text, targetId), text, cLang);
  return {
    ...enriched,
    identityId: targetId,
    title: cleanProcessTitle(text, contentHe),
    nextSteps: (enriched.nextSteps ?? []).map((s) => ({ ...s, done: false })),
    progress: enriched.progress ? { ...enriched.progress, current: 0 } : enriched.progress,
    latestBroadcastText: [contentHe ? 'בדיוק התחלנו.' : 'Just getting started.', undefined] as [string, string?],
    broadcast: [],
    metrics: (enriched.metrics ?? []).map((m) => {
      const frac = String(m.value ?? '').match(/^(\d+)\s*\/\s*(\d+)$/);
      return { ...m, value: frac ? `0/${frac[2]}` : '', trend: undefined };
    }),
    history: [],
    decisions: [],
    reminders: [],
    timeline: [],
    unreadUpdates: 0,
  };
}
