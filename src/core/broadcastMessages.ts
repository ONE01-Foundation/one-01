/**
 * Broadcast messages per Hat – Live intelligence stream. Rotates every ~5s.
 */

import type { Hat } from './types';

/** General / base hat */
const GENERAL: string[] = [
  'You have 2 active processes waiting.',
  'Momentum is high today — execute one step.',
  'Ready when you are.',
  'What will you move forward today?',
];

const HEALTH: string[] = [
  'Recovery mode: take a short walk today.',
  'Hydration low — drink water now.',
  'Sleep quality matters. Wind down early.',
  'One small health win today.',
];

const FINANCE: string[] = [
  'Spending stable — ₪240 left this week.',
  'Market volatility rising — stay cautious.',
  'Budget on track. No alerts.',
  'Review subscriptions when you have a moment.',
];

const BUSINESS: string[] = [
  'New client request detected: landing page needed.',
  'Next deliverable: logo draft (2h).',
  'Follow up on proposal sent Tuesday.',
  'Delegation window: assign one task today.',
];

const KNOWLEDGE: string[] = [
  'Learning streak: 3 days.',
  'Next topic: Liquidity Zones.',
  'One article or video today.',
  'Curiosity pays. Pick one deep read.',
];

const PROVIDER: string[] = [
  'Provider network active.',
  'You can attach experts to any process.',
];

const BY_HAT: Record<Hat, string[]> = {
  base: GENERAL,
  health: HEALTH,
  finance: FINANCE,
  knowledge: KNOWLEDGE,
  business: BUSINESS,
  provider: PROVIDER,
};

export function getBroadcastMessagesForHats(hats: Hat[]): string[] {
  const set = new Set<string>();
  for (const hat of hats) {
    const list = BY_HAT[hat] ?? GENERAL;
    list.forEach((m) => set.add(m));
  }
  if (set.size === 0) return GENERAL;
  return Array.from(set);
}
