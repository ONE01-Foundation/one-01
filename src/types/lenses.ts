/**
 * Lens-specific type definitions
 */

import { Lens, LensCategory } from './index';

// ============================================================================
// Health Lens
// ============================================================================

export interface HealthLens extends Lens {
  category: 'health';
  capabilities: HealthCapability[];
}

export type HealthCapability =
  | 'nutrition_tracking'
  | 'fitness_planning'
  | 'sleep_analysis'
  | 'medical_records'
  | 'wellness_coaching';

// ============================================================================
// Finance Lens
// ============================================================================

export interface FinanceLens extends Lens {
  category: 'finance';
  capabilities: FinanceCapability[];
}

export type FinanceCapability =
  | 'budgeting'
  | 'investing'
  | 'savings_tracking'
  | 'debt_management'
  | 'expense_analysis';

// ============================================================================
// Career Lens
// ============================================================================

export interface CareerLens extends Lens {
  category: 'career';
  capabilities: CareerCapability[];
}

export type CareerCapability =
  | 'job_search'
  | 'skill_development'
  | 'networking'
  | 'project_management'
  | 'performance_tracking';

// ============================================================================
// Home Lens
// ============================================================================

export interface HomeLens extends Lens {
  category: 'home';
  capabilities: HomeCapability[];
}

export type HomeCapability =
  | 'maintenance_scheduling'
  | 'renovation_planning'
  | 'organization'
  | 'inventory_management'
  | 'energy_optimization';

// ============================================================================
// Social Lens
// ============================================================================

export interface SocialLens extends Lens {
  category: 'social';
  capabilities: SocialCapability[];
}

export type SocialCapability =
  | 'relationship_tracking'
  | 'event_planning'
  | 'communication'
  | 'social_analytics'
  | 'community_building';

