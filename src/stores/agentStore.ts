/**
 * Agent Store - Manages agent state and context
 */

import { create } from 'zustand';
import { Agent, AgentStatus, AgentContext, Goal, Lens } from '../types';

interface AgentStore {
  agent: Agent | null;
  status: AgentStatus;
  context: AgentContext | null;
  activeLenses: Lens[];
  
  // Actions
  setAgent: (agent: Agent) => void;
  updateStatus: (status: AgentStatus) => void;
  updateContext: (context: Partial<AgentContext>) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  activateLens: (lens: Lens) => void;
  deactivateLens: (lensId: string) => void;
  setActiveProtocol: (protocolId: string | undefined) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agent: null,
  status: 'idle',
  context: null,
  activeLenses: [],

  setAgent: (agent) => set({ agent }),

  updateStatus: (status) => set({ status }),

  updateContext: (context) =>
    set((state) => ({
      context: state.context ? { ...state.context, ...context } : null,
    })),

  addGoal: (goal) =>
    set((state) => ({
      context: state.context
        ? {
            ...state.context,
            goals: [...(state.context.goals || []), goal],
          }
        : null,
    })),

  updateGoal: (goalId, updates) =>
    set((state) => ({
      context: state.context
        ? {
            ...state.context,
            goals: (state.context.goals || []).map((goal) =>
              goal.id === goalId ? { ...goal, ...updates } : goal
            ),
          }
        : null,
    })),

  activateLens: (lens) =>
    set((state) => ({
      activeLenses: state.activeLenses.some((l) => l.id === lens.id)
        ? state.activeLenses
        : [...state.activeLenses, lens],
      agent: state.agent
        ? {
            ...state.agent,
            activeLenses: [
              ...state.agent.activeLenses,
              ...(state.agent.activeLenses.includes(lens.id) ? [] : [lens.id]),
            ],
          }
        : null,
    })),

  deactivateLens: (lensId) =>
    set((state) => ({
      activeLenses: state.activeLenses.filter((l) => l.id !== lensId),
      agent: state.agent
        ? {
            ...state.agent,
            activeLenses: state.agent.activeLenses.filter((id) => id !== lensId),
          }
        : null,
    })),

  setActiveProtocol: (protocolId) =>
    set((state) => ({
      agent: state.agent ? { ...state.agent, currentProtocol: protocolId } : null,
    })),
}));

