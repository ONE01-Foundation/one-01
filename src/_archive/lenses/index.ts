/**
 * Lens Registry - Central export for all lenses
 */

import { HealthLens } from './healthLens';
import { FinanceLens } from './financeLens';
import { CareerLens } from './careerLens';
import { BaseLens } from './baseLens';
import { Lens } from '../types';

export { BaseLens } from './baseLens';
export { HealthLens } from './healthLens';
export { FinanceLens } from './financeLens';
export { CareerLens } from './careerLens';

// Lens registry - all available lenses
export const lensRegistry: BaseLens[] = [
  new HealthLens(),
  new FinanceLens(),
  new CareerLens(),
];

// Helper function to get lens by ID
export function getLensById(id: string): BaseLens | undefined {
  return lensRegistry.find((lens) => lens.id === id);
}

// Helper function to get lenses by category
export function getLensesByCategory(category: Lens['category']): BaseLens[] {
  return lensRegistry.filter((lens) => lens.category === category);
}

