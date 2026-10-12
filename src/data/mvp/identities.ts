/**
 * Default identities for a FRESH account — a single, empty personal space.
 * (The old "Ariel / ONE01 / Family" example account + its processes were demo
 * seed data; they're removed so a new user starts clean. Their ids live on in
 * DEMO_IDENTITY_IDS only so the persist migration can strip any left-over copy.)
 */

import type { Identity } from '../../core/mvp/types';

const NOW = '2026-01-01T00:00:00.000Z';

export const MOCK_IDENTITIES: Identity[] = [
  {
    id: 'identity_me',
    name: '',
    type: 'personal',
    initials: '',
    updateCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const DEFAULT_IDENTITY_ID = MOCK_IDENTITIES[0].id;

/** Ids of the old demo/example account, stripped by the store migration. */
export const DEMO_IDENTITY_IDS = ['identity_ariel', 'identity_one01', 'identity_family'];
