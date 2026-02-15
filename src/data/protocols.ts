/**
 * Mock protocol catalog for Discovery (v0.1.2). Local only.
 */

import type { LifeLens } from '../core/types';

export interface Protocol {
  id: string;
  title: string;
  lens: LifeLens;
  estimateMinutes: number;
  description: string;
  stepsPreview: [string, string, string];
}

export const PROTOCOLS: Protocol[] = [
  {
    id: 'proto_biz_1',
    title: 'Launch Landing Page',
    lens: 'business',
    estimateMinutes: 120,
    description: 'Get a simple landing page live in one session.',
    stepsPreview: ['Define goal and audience', 'Pick template or structure', 'Publish and share link'],
  },
  {
    id: 'proto_biz_2',
    title: 'Create Logo',
    lens: 'business',
    estimateMinutes: 90,
    description: 'Design a minimal logo for your brand.',
    stepsPreview: ['Sketch 3 concepts', 'Refine one direction', 'Export and save variants'],
  },
  {
    id: 'proto_biz_3',
    title: 'Build Portfolio',
    lens: 'business',
    estimateMinutes: 180,
    description: 'Assemble a professional portfolio of your work.',
    stepsPreview: ['List 5–7 best projects', 'Write short case studies', 'Choose layout and publish'],
  },
  {
    id: 'proto_health_1',
    title: '14-day Start Fitness',
    lens: 'health',
    estimateMinutes: 15,
    description: 'Two-week kickstart with daily micro-workouts.',
    stepsPreview: ['Set daily time and place', 'Pick 3 exercises', 'Log and adjust'],
  },
  {
    id: 'proto_health_2',
    title: 'Fix Sleep Routine',
    lens: 'health',
    estimateMinutes: 30,
    description: 'Stabilize your sleep schedule in one week.',
    stepsPreview: ['Set target bedtime and wake', 'Wind-down ritual', 'Track for 7 days'],
  },
  {
    id: 'proto_health_3',
    title: 'Nutrition Basics',
    lens: 'health',
    estimateMinutes: 45,
    description: 'Simple meal and hydration habits.',
    stepsPreview: ['Define one protein and one veg per day', 'Plan 3 days of meals', 'Set water reminders'],
  },
  {
    id: 'proto_fin_1',
    title: 'Budget Setup',
    lens: 'finance',
    estimateMinutes: 60,
    description: 'One-page budget that fits your pay cycle.',
    stepsPreview: ['List income and fixed costs', 'Allocate buckets', 'Set one saving rule'],
  },
  {
    id: 'proto_fin_2',
    title: 'Debt Plan',
    lens: 'finance',
    estimateMinutes: 45,
    description: 'Prioritize and track debt payoff.',
    stepsPreview: ['List all debts and rates', 'Choose strategy (avalanche/snowball)', 'Set first milestone'],
  },
  {
    id: 'proto_fin_3',
    title: 'Savings Sprint',
    lens: 'finance',
    estimateMinutes: 20,
    description: '30-day no-spend or low-spend challenge.',
    stepsPreview: ['Define allowed exceptions', 'Daily check-in', 'Review and reward'],
  },
  {
    id: 'proto_know_1',
    title: 'Learn X in 7 days',
    lens: 'knowledge',
    estimateMinutes: 210,
    description: 'Structured 7-day learning sprint for any topic.',
    stepsPreview: ['Pick topic and 3 resources', 'Daily 30-min blocks', 'Summarize and share'],
  },
  {
    id: 'proto_know_2',
    title: 'Study Plan',
    lens: 'knowledge',
    estimateMinutes: 40,
    description: 'Build a study plan for an exam or certification.',
    stepsPreview: ['List chapters or domains', 'Assign days and hours', 'Add review slots'],
  },
  {
    id: 'proto_know_3',
    title: 'Skill Sprint',
    lens: 'knowledge',
    estimateMinutes: 90,
    description: 'Practice one skill with deliberate drills.',
    stepsPreview: ['Choose one sub-skill', 'Find 3 drills', 'Schedule 3 sessions'],
  },
];

export function getProtocolById(id: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}
