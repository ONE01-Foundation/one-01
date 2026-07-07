/**
 * Entitlements — what each subscription tier actually unlocks.
 *
 * This is the single source of truth that turns `plan` (free / pro / max) into
 * real product limits. UI reads it to gate actions (connect a source, add a
 * profile) and to nudge an upgrade when a free user hits a wall.
 *
 * Limits are chosen so the seeded demo (2 identities) sits INSIDE the free tier
 * — the wall only appears when the user tries to go beyond it.
 */

import type { PlanTier } from '../stores/mvpStore';

export interface Entitlements {
  /** Max number of identities (profiles) the user can have. */
  maxProfiles: number;
  /** Max number of connected sources (email, calendar, bank, …). */
  maxConnections: number;
  /** Whether ONE uses the advanced (smarter) model. */
  advancedModel: boolean;
  /** Whether ONE may take initiative / act on the user's behalf. */
  proactive: boolean;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export function entitlementsFor(plan: PlanTier): Entitlements {
  switch (plan) {
    case 'max':
      return {
        maxProfiles: UNLIMITED,
        maxConnections: UNLIMITED,
        advancedModel: true,
        proactive: true,
      };
    case 'pro':
      return {
        maxProfiles: UNLIMITED,
        maxConnections: UNLIMITED,
        advancedModel: true,
        proactive: false,
      };
    case 'free':
    default:
      return {
        // Personal + one more (e.g. business) are free; unlimited needs Pro.
        maxProfiles: 2,
        // A single source to taste the value; connect everything with Pro.
        maxConnections: 1,
        advancedModel: false,
        proactive: false,
      };
  }
}
