/**
 * Finance Lens - Budgeting, investing, savings, debt management
 */

import { BaseLens } from './baseLens';
import { Lens, Protocol, SubAgent, UIComponent } from '../types';
import { FinanceCapability } from '../types/lenses';

export class FinanceLens extends BaseLens {
  id = 'finance';
  name = 'Finance';
  category: Lens['category'] = 'finance';
  capabilities: FinanceCapability[] = [
    'budgeting',
    'investing',
    'savings_tracking',
    'debt_management',
    'expense_analysis',
  ];
  icon = '💰';
  description = 'Manage your finances, budget, and investments';

  protocols: Protocol[] = [
    {
      id: 'budget_creation',
      name: 'Budget Creation',
      description: 'Create and manage monthly budgets',
      lensId: this.id,
      steps: [
        {
          id: 'income_input',
          order: 1,
          type: 'input',
          component: {
            id: 'income_form',
            type: 'form',
            props: {
              fields: [
                { name: 'monthly_income', type: 'number', label: 'Monthly Income' },
                { name: 'income_sources', type: 'text', label: 'Income Sources' },
              ],
            },
          },
        },
        {
          id: 'expense_categories',
          order: 2,
          type: 'input',
          component: {
            id: 'expense_form',
            type: 'form',
            props: {
              fields: [
                { name: 'housing', type: 'number', label: 'Housing' },
                { name: 'food', type: 'number', label: 'Food' },
                { name: 'transportation', type: 'number', label: 'Transportation' },
                { name: 'entertainment', type: 'number', label: 'Entertainment' },
              ],
            },
          },
        },
        {
          id: 'budget_display',
          order: 3,
          type: 'display',
          component: {
            id: 'budget_chart',
            type: 'chart',
            props: {
              chartType: 'pie',
              title: 'Monthly Budget Breakdown',
            },
          },
        },
      ],
    },
  ];

  agents: SubAgent[] = [
    {
      id: 'budget_agent',
      name: 'Budget Advisor',
      role: 'Helps create and maintain budgets',
      capabilities: ['budget_analysis', 'expense_tracking', 'savings_optimization'],
      lensId: this.id,
    },
    {
      id: 'investment_agent',
      name: 'Investment Advisor',
      role: 'Provides investment guidance',
      capabilities: ['portfolio_analysis', 'risk_assessment', 'investment_suggestions'],
      lensId: this.id,
    },
  ];

  async initialize(): Promise<void> {
    console.log('Finance Lens initialized');
  }

  async cleanup(): Promise<void> {
    console.log('Finance Lens cleaned up');
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
    if (goalLower.includes('budget') || goalLower.includes('spending')) {
      return [this.protocols[0]]; // budget_creation
    }
    return this.protocols;
  }

  validateContext(context: Record<string, unknown>): boolean {
    return true;
  }
}

