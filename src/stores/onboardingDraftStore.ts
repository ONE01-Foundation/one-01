import { create } from 'zustand';
import type { AgentPersona } from '../core/types';

interface OnboardingDraftState {
  persona: AgentPersona | null;
  agentName: string;
  userName: string;
  firstUnitTitle: string;
  firstUnitSummary: string;
  setPersona: (p: AgentPersona) => void;
  setAgentName: (s: string) => void;
  setUserName: (s: string) => void;
  setFirstUnit: (title: string, summary: string) => void;
  reset: () => void;
}

export const useOnboardingDraftStore = create<OnboardingDraftState>((set) => ({
  persona: null,
  agentName: '',
  userName: '',
  firstUnitTitle: '',
  firstUnitSummary: '',
  setPersona: (persona) => set({ persona }),
  setAgentName: (agentName) => set({ agentName }),
  setUserName: (userName) => set({ userName }),
  setFirstUnit: (firstUnitTitle, firstUnitSummary) => set({ firstUnitTitle, firstUnitSummary }),
  reset: () =>
    set({
      persona: null,
      agentName: '',
      userName: '',
      firstUnitTitle: '',
      firstUnitSummary: '',
    }),
}));
