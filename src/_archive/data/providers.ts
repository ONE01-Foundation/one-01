/**
 * Mock provider directory (v0.1.2). Local only. Real providers in v0.2.
 */

import type { LifeLens } from '../core/types';

export interface Provider {
  id: string;
  displayName: string;
  lens: LifeLens;
  specialties: string[];
  priceRange: string;
  responseTime: string;
  rating: number;
  bio: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'prov_1',
    displayName: 'Alex Finance',
    lens: 'finance',
    specialties: ['Budgeting', 'Debt payoff', 'Savings'],
    priceRange: '$$',
    responseTime: 'Within 24h',
    rating: 4.8,
    bio: 'Certified coach focused on simple budgets and debt plans.',
  },
  {
    id: 'prov_2',
    displayName: 'Jordan Health',
    lens: 'health',
    specialties: ['Fitness', 'Sleep', 'Nutrition'],
    priceRange: '$',
    responseTime: 'Within 12h',
    rating: 4.9,
    bio: 'Helping you build sustainable health habits.',
  },
  {
    id: 'prov_3',
    displayName: 'Casey Business',
    lens: 'business',
    specialties: ['Landing pages', 'Branding', 'Portfolios'],
    priceRange: '$$$',
    responseTime: 'Within 48h',
    rating: 4.7,
    bio: 'Design and launch support for solopreneurs.',
  },
  {
    id: 'prov_4',
    displayName: 'Sam Knowledge',
    lens: 'knowledge',
    specialties: ['Study plans', 'Learning sprints', 'Skill drills'],
    priceRange: '$',
    responseTime: 'Within 24h',
    rating: 4.6,
    bio: 'Structured learning and exam prep.',
  },
  {
    id: 'prov_5',
    displayName: 'Riley Multi',
    lens: 'business',
    specialties: ['Strategy', 'Marketing', 'Operations'],
    priceRange: '$$',
    responseTime: 'Within 24h',
    rating: 4.5,
    bio: 'Generalist support for small business.',
  },
  {
    id: 'prov_6',
    displayName: 'Morgan Fit',
    lens: 'health',
    specialties: ['Workouts', 'Recovery', 'Habit stacking'],
    priceRange: '$$',
    responseTime: 'Within 12h',
    rating: 4.8,
    bio: 'Fitness and routine design.',
  },
  {
    id: 'prov_7',
    displayName: 'Taylor Money',
    lens: 'finance',
    specialties: ['Investing basics', 'Tax prep', 'Emergency fund'],
    priceRange: '$$',
    responseTime: 'Within 48h',
    rating: 4.4,
    bio: 'Practical money management.',
  },
  {
    id: 'prov_8',
    displayName: 'Quinn Learn',
    lens: 'knowledge',
    specialties: ['Certifications', 'Languages', 'Technical skills'],
    priceRange: '$$',
    responseTime: 'Within 24h',
    rating: 4.7,
    bio: 'Structured learning paths.',
  },
  {
    id: 'prov_9',
    displayName: 'Drew Launch',
    lens: 'business',
    specialties: ['MVP', 'Pricing', 'Pitch'],
    priceRange: '$$$',
    responseTime: 'Within 48h',
    rating: 4.6,
    bio: 'From idea to first launch.',
  },
  {
    id: 'prov_10',
    displayName: 'Sky Wellness',
    lens: 'health',
    specialties: ['Mindfulness', 'Stress', 'Sleep'],
    priceRange: '$',
    responseTime: 'Within 24h',
    rating: 4.9,
    bio: 'Mind and body balance.',
  },
];

export function getProviderById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
