/**
 * One01 – מסך אחד, מחליף מצבים.
 * Orb View | Card View | Global View
 */

export type ViewMode = 'orb' | 'card' | 'global';

export interface CardContext {
  worldId: string;
  orbId: string;
}
