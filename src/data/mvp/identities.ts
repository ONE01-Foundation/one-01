/**
 * Mock identities — verbatim from ONE_DATA_MODEL_AND_EXAMPLES §2.
 */

import type { Identity } from '../../core/mvp/types';

export const MOCK_IDENTITIES: Identity[] = [
  {
    id: 'identity_ariel',
    name: 'Ariel',
    type: 'personal',
    initials: 'A',
    updateCount: 3,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
  },
  {
    id: 'identity_one01',
    name: 'ONE01',
    type: 'business',
    initials: 'O',
    updateCount: 22,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
  },
];

export const DEFAULT_IDENTITY_ID = MOCK_IDENTITIES[0].id;
