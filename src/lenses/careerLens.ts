/**
 * Career Lens - Job search, skills, networking, projects
 */

import { BaseLens } from './baseLens';
import { Lens, Protocol, SubAgent, UIComponent } from '../types';
import { CareerCapability } from '../types/lenses';

export class CareerLens extends BaseLens {
  id = 'career';
  name = 'Career';
  category: Lens['category'] = 'career';
  capabilities: CareerCapability[] = [
    'job_search',
    'skill_development',
    'networking',
    'project_management',
    'performance_tracking',
  ];
  icon = '💼';
  description = 'Advance your career and professional development';

  protocols: Protocol[] = [
    {
      id: 'job_search',
      name: 'Job Search',
      description: 'Find and apply to relevant job opportunities',
      lensId: this.id,
      steps: [
        {
          id: 'job_preferences',
          order: 1,
          type: 'input',
          component: {
            id: 'preferences_form',
            type: 'form',
            props: {
              fields: [
                { name: 'title', type: 'text', label: 'Job Title' },
                { name: 'location', type: 'text', label: 'Location' },
                { name: 'salary_range', type: 'text', label: 'Salary Range' },
                { name: 'remote', type: 'boolean', label: 'Remote Work' },
              ],
            },
          },
        },
        {
          id: 'job_listings',
          order: 2,
          type: 'display',
          component: {
            id: 'job_list',
            type: 'list',
            props: {
              title: 'Matching Job Opportunities',
            },
          },
        },
      ],
    },
  ];

  agents: SubAgent[] = [
    {
      id: 'job_search_agent',
      name: 'Job Search Assistant',
      role: 'Helps find and apply to jobs',
      capabilities: ['job_matching', 'application_tracking', 'interview_prep'],
      lensId: this.id,
    },
    {
      id: 'skill_agent',
      name: 'Skill Development Coach',
      role: 'Identifies and develops professional skills',
      capabilities: ['skill_assessment', 'learning_paths', 'certification_tracking'],
      lensId: this.id,
    },
  ];

  async initialize(): Promise<void> {
    console.log('Career Lens initialized');
  }

  async cleanup(): Promise<void> {
    console.log('Career Lens cleaned up');
  }

  async executeStep(protocolId: string, stepId: string, data?: unknown): Promise<UIComponent[]> {
    const protocol = this.protocols.find((p) => p.id === protocolId);
    if (!protocol) {
      return [];
    }

    const step = protocol.steps.find((s) => s.id === stepId);
    if (!step || !step.component) {
      return [];
    }

    return [step.component];
  }

  async handleInput(protocolId: string, stepId: string, input: unknown): Promise<UIComponent[]> {
    return [];
  }

  getProtocolsForGoal(goal: string): Protocol[] {
    const goalLower = goal.toLowerCase();
    if (goalLower.includes('job') || goalLower.includes('career') || goalLower.includes('work')) {
      return [this.protocols[0]]; // job_search
    }
    return this.protocols;
  }

  validateContext(context: Record<string, unknown>): boolean {
    return true;
  }
}

