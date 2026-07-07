/**
 * Onboarding example "units" — shown on Home before the user has signed
 * in / completed onboarding. They aren't real processes; they're
 * illustrative use-cases that demonstrate WHAT ONE can hold for you.
 *
 * Shape mirrors `Unit` so they render through the same UnitCard /
 * StackedCard pipeline without a parallel component. They have:
 *   • zero unread events (no badge)
 *   • no progress bar (we removed it)
 *   • a recent "lastUpdatedAt" so timestamps read sensibly
 *
 * Switching to real processes happens the moment `hasCompletedOnboarding`
 * flips to true after sign-in (or via the dev "mark as onboarded" affordance).
 */

import type { Unit } from '../../core/mvp/types';

const ONBOARDING_IDENTITY_ID = 'identity_onboarding';
// All example cards share the same "just now" timestamp so the time
// label reads consistently across the stack. Static string — avoids
// `new Date()` reactivity in renders.
const RECENT_TS = '2026-06-24T19:00:00.000Z';

function makeExample(
  id: string,
  emoji: string,
  title: string,
  enLine: string,
): Unit {
  return {
    id,
    identityId: ONBOARDING_IDENTITY_ID,
    title,
    emoji,
    tagIds: [],
    color: '#10B981',
    broadcast: [],
    latestBroadcastText: [enLine],
    lastUpdatedAt: RECENT_TS,
    unreadUpdates: 0,
    visibility: 'private',
    createdAt: RECENT_TS,
    updatedAt: RECENT_TS,
  };
}

/**
 * Use-case cards — the things ONE is good at. Order intentionally goes
 * concrete → abstract so the stack reads naturally as the user pulls
 * the cards up.
 */
export const ONBOARDING_EXAMPLE_UNITS: Unit[] = [
  makeExample(
    'onboarding_health',
    '💪',
    'Health & fitness',
    'Set a goal — I track workouts, weight, and streaks.',
  ),
  makeExample(
    'onboarding_learning',
    '🎓',
    'Learning something new',
    "Tell me what you want to learn. I'll plan the path.",
  ),
  makeExample(
    'onboarding_work',
    '💼',
    'Work projects',
    'Tasks, deadlines, and the people involved — all in one place.',
  ),
  makeExample(
    'onboarding_home',
    '🏠',
    'Life at home',
    'From moving apartments to errands, I keep things moving.',
  ),
  makeExample(
    'onboarding_travel',
    '✈️',
    'Trips & travel',
    'Plans, bookings, and reminders — together, not scattered.',
  ),
];
