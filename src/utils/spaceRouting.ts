/**
 * spaceRouting — the "one ONE that routes" logic.
 *
 * You talk to the SAME ONE; the active space is the default lens, but ONE routes
 * a new intent to the RIGHT space (personal / business / family) when the content
 * clearly belongs elsewhere. The model proposes a space (`process.space`); for
 * the offline/local path we infer it from keywords. Either way the hint maps to
 * an EXISTING identity of that type — spaces are created explicitly by the user,
 * never auto-spawned here, so a process always lands somewhere real.
 */
import type { Identity, IdentityType } from '../core/mvp/types';

export type SpaceHint = IdentityType; // 'personal' | 'business' | 'family'

/** Map a space hint to an existing identity of that type; falls back to the
 *  active identity when that space doesn't exist. */
export function resolveSpaceIdentityId(
  hint: SpaceHint | undefined,
  identities: Identity[],
  activeIdentityId: string,
): string {
  if (!hint) return activeIdentityId;
  const match = identities.find((i) => i.type === hint);
  return match ? match.id : activeIdentityId;
}

const BUSINESS_RE =
  /(לקוח|לקוחות|עסק|עסקי|עסקית|חשבונית|הזמנה|ספק|מלאי|עובד|עובדת|משכורת|פגיש[הת] עבודה|client|customer|invoice|\bbusiness\b|work meeting|supplier|inventory|payroll|my shop|my business)/i;
const FAMILY_RE =
  /(משפח|אישת|אשת|בעלי|בן שלי|בת שלי|הבן שלי|הבת שלי|ילד|ילדה|ילדים|אמא|אבא|הורים|סבא|סבת|wife|husband|my son|my daughter|my kid|my child|\bmom\b|\bdad\b|parents|grandma|grandpa|\bfamily\b|household)/i;

/** Light keyword inference for the offline/local path (no AI). Returns undefined
 *  when nothing clearly points away from the active space. */
export function inferSpaceFromText(text: string): SpaceHint | undefined {
  if (!text) return undefined;
  if (BUSINESS_RE.test(text)) return 'business';
  if (FAMILY_RE.test(text)) return 'family';
  return undefined;
}

/** Localized space label for user-facing "added to your {space}" notes. */
export function spaceLabel(type: IdentityType, he: boolean): string {
  if (type === 'business') return he ? 'העסקי' : 'Business';
  if (type === 'family') return he ? 'המשפחה' : 'Family';
  return he ? 'האישי' : 'Personal';
}
