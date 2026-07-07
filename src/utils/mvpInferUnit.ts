/**
 * Tiny rule-based inference: free-text desire → spec-shaped Unit.
 *
 * v0 dumb mapping — once goalEngine.ts/compiler.ts are wired this can be
 * replaced. The point is to demo the "talk → process" pattern visibly.
 *
 * Returns Units that conform to ONE_DATA_MODEL_AND_EXAMPLES so they render
 * correctly in the new UnitCard and the rest of the new MVP surface.
 */

import type { TagId, Unit, UnitBroadcastType } from '../core/mvp/types';
import { TAG_COLORS } from '../core/mvp/types';
import { MOCK_UNITS } from '../data/mvp/units';

interface Rule {
  match: RegExp;
  emoji: string;
  tagIds: TagId[];
  /** Two-line broadcast: [primary, secondary]. */
  broadcast: [string, string?];
  /** Type of the primary broadcast — drives attention score. */
  broadcastType: UnitBroadcastType;
  /** Display title. If undefined, the cleaned user input is used. */
  title?: string;
  /** Relationship/metadata label shown on the small card. */
  relationLabel?: string;
  progress?: { current: number; total: number };
  /**
   * If set, when this rule matches we return the canonical MOCK_UNITS entry
   * with this id instead of synthesizing — preserves the spec timestamps,
   * full metric grid, next steps, and people for the Process Preview.
   */
  canonicalUnitId?: string;
}

const RULES: Rule[] = [
  {
    match: /(נהיג|driving|רישיון|license)/i,
    emoji: '🚗',
    tagIds: ['learning'],
    title: 'Driving License',
    broadcast: [
      'Next lesson is scheduled for Tuesday.',
      'The next step is preparing for the test.',
    ],
    broadcastType: 'event',
    relationLabel: 'Instructor Eli',
    progress: { current: 5, total: 8 },
    canonicalUnitId: 'unit_driving_license',
  },
  {
    match: /(משקל|weight|כושר|gym|fitness|gain)/i,
    emoji: '💪',
    tagIds: ['fitness', 'health'],
    title: 'Weight Gain',
    broadcast: [
      'Next workout today at 2:00 PM.',
      'Protein goal reached yesterday.',
    ],
    broadcastType: 'event',
    relationLabel: 'Coach Eli +1',
    progress: { current: 21, total: 32 },
    canonicalUnitId: 'unit_weight_gain',
  },
  {
    match: /(בריאות|רופא|doctor|health|checkup)/i,
    emoji: '🩺',
    tagIds: ['health'],
    title: 'Health',
    broadcast: ['Next checkup in 2 weeks.', 'Lab results not in yet.'],
    broadcastType: 'waiting',
    relationLabel: 'Private',
  },
  {
    match: /(אתר|website|landing|web)/i,
    emoji: '💼',
    tagIds: ['business'],
    title: 'Business Website',
    broadcast: [
      'The landing page is almost ready.',
      'Payment flow still needs to be connected.',
    ],
    broadcastType: 'progress',
    relationLabel: 'ONE01 Team',
    progress: { current: 8, total: 12 },
    canonicalUnitId: 'unit_business_website',
  },
  {
    match: /(עסק|business|לקוח|client)/i,
    emoji: '💼',
    tagIds: ['business'],
    broadcast: [
      'You have a new opportunity to review.',
      'Last client is waiting on you.',
    ],
    broadcastType: 'next_step',
    relationLabel: 'Private',
  },
  {
    match: /(שיפוץ|בית|home|renovation|דירה|apartment|move)/i,
    emoji: '🏠',
    tagIds: ['home'],
    title: 'Move Apartment',
    broadcast: [
      "Waiting for the architect's approval.",
      'Kitchen measurements are still missing.',
    ],
    broadcastType: 'waiting',
    relationLabel: 'Shared +2',
    progress: { current: 4, total: 9 },
    canonicalUnitId: 'unit_move_apartment',
  },
  {
    match: /(תביעה|פיצוי|claim|injury|lawyer)/i,
    emoji: '⚖️',
    tagIds: ['legal'],
    title: 'Injury Claim',
    broadcast: [
      'Your lawyer is waiting for the medical report.',
      'One document is still missing.',
    ],
    broadcastType: 'waiting',
    relationLabel: 'Lawyer Cohen',
    progress: { current: 3, total: 7 },
    canonicalUnitId: 'unit_injury_claim',
  },
  {
    match: /(כסף|תקצב|budget|money|finance|חיסכון|חוסך)/i,
    emoji: '💰',
    tagIds: ['money'],
    broadcast: ['Monthly review pending.', 'Spending is on track.'],
    broadcastType: 'next_step',
    relationLabel: 'Private',
  },
  {
    match: /(טיול|trip|חופשה|vacation|נסיע|travel)/i,
    emoji: '✈️',
    tagIds: ['travel'],
    broadcast: ['Still looking up dates.', 'Nothing booked yet.'],
    broadcastType: 'next_step',
    relationLabel: 'Private',
  },
];

const FALLBACK: Rule = {
  match: /.*/,
  emoji: '🎯',
  tagIds: ['custom'],
  broadcast: ['Just getting started.', 'No actions defined yet.'],
  broadcastType: 'calm',
  relationLabel: 'Private',
};

function pickRule(desire: string): Rule {
  return RULES.find((r) => r.match.test(desire)) ?? FALLBACK;
}

let unitCounter = 0;

/**
 * Convert one free-text desire to a spec-shaped Unit.
 *
 * If the matched rule has a `canonicalUnitId`, returns the seeded MOCK_UNITS
 * entry with that id (preserving static timestamps + full metric grid + next
 * steps + people, exactly as in ONE_DATA_MODEL_AND_EXAMPLES). Otherwise
 * synthesizes a fresh Unit from the rule.
 */
export function desireToUnit(desire: string, identityId: string = 'identity_ariel'): Unit {
  const cleaned = desire.trim();
  const rule = pickRule(cleaned);
  if (rule.canonicalUnitId) {
    const canonical = MOCK_UNITS.find((u) => u.id === rule.canonicalUnitId);
    if (canonical) {
      // Re-bind to the active identity so Identity Switch filtering still works
      // for user-initiated units (the seed maps Business Website to ONE01, but
      // a user typing "build a website" in Personal context expects it under
      // their personal identity).
      return { ...canonical, identityId };
    }
  }
  unitCounter += 1;
  const now = new Date().toISOString();
  const primaryTag = rule.tagIds[0];
  return {
    id: `unit_${Date.now()}_${unitCounter}`,
    identityId,
    title: rule.title ?? cleaned,
    emoji: rule.emoji,
    tagIds: rule.tagIds,
    color: TAG_COLORS[primaryTag],
    broadcast: [
      {
        id: `b_${unitCounter}_1`,
        text: rule.broadcast[0],
        priority: 80,
        type: rule.broadcastType,
        createdAt: now,
      },
      ...(rule.broadcast[1]
        ? [
            {
              id: `b_${unitCounter}_2`,
              text: rule.broadcast[1],
              priority: 60,
              type: 'progress' as UnitBroadcastType,
              createdAt: now,
            },
          ]
        : []),
    ],
    latestBroadcastText: rule.broadcast,
    lastUpdatedAt: now,
    unreadUpdates: 1,
    relationLabel: rule.relationLabel,
    visibility: 'private',
    progress: rule.progress,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse multi-input desires text into discrete intents.
 * Splits on newlines, commas, semicolons, and "וגם"/"and" connectors.
 */
export function parseDesires(text: string): string[] {
  return text
    .split(/\n+|,|;|\bוגם\b|\band\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
