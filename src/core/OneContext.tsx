/**
 * ONE01 Context – User, Agent, Processes. Offline-first, persist to storage.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  LifeLens,
  AgentPersona,
  Hat,
  OneAgent,
  OneProcess,
  OneUser,
  OnboardingState,
  ProcessEvent,
  ProcessFields,
  ProcessMessage,
} from './types';
import { storage } from '../utils/session';

const ONE_USER_KEY = 'one_user';

const initialOnboarding: OnboardingState = {
  step: 'welcome',
  name: '',
  persona: null,
  lenses: [],
  desire: '',
};

type State = {
  user: OneUser | null;
  onboarding: OnboardingState;
  initialized: boolean;
  /** Temporary agent speaking subtitle; cleared after 3s */
  agentStatusText: string | null;
};

type Action =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_PERSONA'; payload: AgentPersona }
  | { type: 'SET_LENSES'; payload: LifeLens[] }
  | { type: 'SET_DESIRE'; payload: string }
  | { type: 'NEXT_STEP'; payload?: OnboardingState['step'] }
  | { type: 'COMPLETE'; payload: OneUser }
  | { type: 'LOAD'; payload: OneUser | null }
  | { type: 'UPDATE_USER'; payload: OneUser }
  | { type: 'RESET' }
  | { type: 'SET_AGENT_STATUS_TEXT'; payload: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, onboarding: { ...state.onboarding, name: action.payload } };
    case 'SET_PERSONA':
      return { ...state, onboarding: { ...state.onboarding, persona: action.payload } };
    case 'SET_LENSES':
      return { ...state, onboarding: { ...state.onboarding, lenses: action.payload } };
    case 'SET_DESIRE':
      return { ...state, onboarding: { ...state.onboarding, desire: action.payload } };
    case 'NEXT_STEP': {
      const steps: OnboardingState['step'][] = ['welcome', 'name', 'style', 'lens', 'desire', 'confirm'];
      const i = steps.indexOf(state.onboarding.step);
      const step = action.payload ?? (i < steps.length - 1 ? steps[i + 1] : state.onboarding.step);
      return { ...state, onboarding: { ...state.onboarding, step } };
    }
    case 'COMPLETE':
      return { ...state, user: action.payload, onboarding: initialOnboarding };
    case 'LOAD':
      return { ...state, user: action.payload, initialized: true };
    case 'UPDATE_USER':
      return { ...state, user: action.payload };
    case 'RESET':
      return { ...state, user: null, onboarding: initialOnboarding, agentStatusText: null };
    case 'SET_AGENT_STATUS_TEXT':
      return { ...state, agentStatusText: action.payload };
    default:
      return state;
  }
}

const initialState: State = {
  user: null,
  onboarding: initialOnboarding,
  initialized: false,
  agentStatusText: null,
};

interface OneContextValue extends State {
  setName: (name: string) => void;
  setPersona: (p: AgentPersona) => void;
  setLenses: (l: LifeLens[]) => void;
  setDesire: (d: string) => void;
  nextStep: () => void;
  completeOnboarding: () => Promise<void>;
  initialize: () => Promise<void>;
  getProcess: (id: string) => OneProcess | null;
  addProcessMessage: (processId: string, sender: 'user' | 'agent', text: string) => Promise<void>;
  updateProcessSummary: (processId: string, summary: string) => Promise<void>;
  updateProcess: (processId: string, process: OneProcess) => Promise<void>;
  setProcessStatus: (processId: string, status: 'active' | 'done') => Promise<void>;
  setProcessOutcome: (processId: string, outcome: string) => Promise<void>;
  updateAgentHats: (hats: Hat[]) => Promise<void>;
  addProcess: (process: OneProcess) => Promise<void>;
  createProcess: (params: { lens: LifeLens; title: string }) => Promise<OneProcess>;
  clearUser: () => Promise<void>;
  attachProviderToProcess: (processId: string, providerId: string, providerDisplayName: string) => Promise<void>;
  startProcessFromProtocol: (protocolId: string) => Promise<OneProcess | null>;
  setAgentStatusText: (text: string) => void;
  isOnboarded: boolean;
}

const Ctx = createContext<OneContextValue | null>(null);

function emptyFields(): ProcessFields {
  return {};
}

function timelineEvent(type: ProcessEvent['type'], payload: Record<string, unknown>): ProcessEvent {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    type,
    payload,
  };
}

function buildUserFromOnboarding(o: OnboardingState): OneUser {
  const now = new Date().toISOString();
  const uid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const aid = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const pid = `process_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const desire = o.desire.trim() || 'My first goal';
  const agent: OneAgent = {
    id: aid,
    name: 'Nobody',
    persona: o.persona!,
    hats: ['base'],
  };

  const firstProcess: OneProcess = {
    id: pid,
    title: desire,
    lens: o.lenses[0],
    status: 'active',
    createdAt: now,
    summary: `Goal: ${desire}`,
    messages: [],
    fields: { goal: desire },
    timeline: [],
  };

  return {
    id: uid,
    name: o.name.trim(),
    lenses: o.lenses,
    agent,
    processes: [firstProcess],
  };
}

const AGENT_STATUS_FADE_MS = 3000;

export function OneProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const statusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeProcess = useCallback((p: OneProcess): OneProcess => {
    return {
      ...p,
      fields: p.fields ?? emptyFields(),
      timeline: p.timeline ?? [],
    };
  }, []);

  const initialize = useCallback(async () => {
    try {
      const raw = await storage.getItem(ONE_USER_KEY);
      let user: OneUser | null = raw ? JSON.parse(raw) : null;
      if (user) {
        const rawHats = user.agent?.hats;
        const hats: Hat[] = Array.isArray(rawHats)
          ? (rawHats as string[]).filter((h): h is Hat => ['base', 'health', 'finance', 'knowledge', 'business', 'provider'].includes(h))
          : ['base'];
        if (!hats.includes('base')) hats.unshift('base');
        user = {
          ...user,
          agent: {
            ...user.agent,
            hats,
          },
          processes: user.processes.map((p) => normalizeProcess(p as OneProcess)),
        };
      }
      dispatch({ type: 'LOAD', payload: user });
    } catch {
      dispatch({ type: 'LOAD', payload: null });
    }
  }, [normalizeProcess]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const completeOnboarding = useCallback(async () => {
    const o = state.onboarding;
    if (!o.name.trim() || !o.persona || o.lenses.length === 0) return;
    const user = buildUserFromOnboarding(o);
    await storage.setItem(ONE_USER_KEY, JSON.stringify(user));
    dispatch({ type: 'COMPLETE', payload: user });
  }, [state.onboarding]);

  const persistUser = useCallback(async (user: OneUser) => {
    await storage.setItem(ONE_USER_KEY, JSON.stringify(user));
    dispatch({ type: 'UPDATE_USER', payload: user });
  }, []);

  const getProcess = useCallback(
    (id: string): OneProcess | null => {
      if (!state.user) return null;
      return state.user.processes.find((p) => p.id === id) ?? null;
    },
    [state.user]
  );

  const addProcessMessage = useCallback(
    async (processId: string, sender: 'user' | 'agent', text: string) => {
      if (!state.user) return;
      const now = new Date().toISOString();
      const msg: ProcessMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sender,
        text,
        createdAt: now,
      };
      const processes = state.user.processes.map((p) => {
        if (p.id !== processId) return p;
        const ev = timelineEvent('note', { messageId: msg.id, text: text.slice(0, 100) });
        return {
          ...p,
          messages: [...p.messages, msg],
          timeline: [...p.timeline, ev],
        };
      });
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const updateProcessSummary = useCallback(
    async (processId: string, summary: string) => {
      if (!state.user) return;
      const processes = state.user.processes.map((p) =>
        p.id === processId ? { ...p, summary } : p
      );
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const updateProcess = useCallback(
    async (processId: string, process: OneProcess) => {
      if (!state.user) return;
      const processes = state.user.processes.map((p) => (p.id === processId ? process : p));
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const setProcessStatus = useCallback(
    async (processId: string, status: 'active' | 'done') => {
      if (!state.user) return;
      const processes = state.user.processes.map((p) => {
        if (p.id !== processId) return p;
        const ev = timelineEvent('status', { status });
        return { ...p, status, timeline: [...p.timeline, ev] };
      });
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const setProcessOutcome = useCallback(
    async (processId: string, outcome: string) => {
      if (!state.user) return;
      const processes = state.user.processes.map((p) =>
        p.id === processId
          ? { ...p, fields: { ...p.fields, outcome } }
          : p
      );
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const updateAgentHats = useCallback(
    async (hats: Hat[]) => {
      if (!state.user) return;
      const next: Hat[] = hats.includes('base') ? hats : ['base', ...hats];
      const agent: OneAgent = { ...state.user.agent, hats: next };
      await persistUser({ ...state.user, agent });
    },
    [state.user, persistUser]
  );

  const addProcess = useCallback(
    async (process: OneProcess) => {
      if (!state.user) return;
      await persistUser({ ...state.user, processes: [...state.user.processes, process] });
    },
    [state.user, persistUser]
  );

  const createProcess = useCallback(
    async (params: { lens: LifeLens; title: string }): Promise<OneProcess> => {
      const now = new Date().toISOString();
      const pid = `process_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const title = params.title.trim() || 'New process';
      const process: OneProcess = {
        id: pid,
        title,
        lens: params.lens,
        status: 'active',
        createdAt: now,
        summary: `Goal: ${title}`,
        messages: [],
        fields: { goal: title },
        timeline: [],
      };
      await addProcess(process);
      return process;
    },
    [addProcess]
  );

  const clearUser = useCallback(async () => {
    await storage.removeItem(ONE_USER_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  const attachProviderToProcess = useCallback(
    async (processId: string, providerId: string, providerDisplayName: string) => {
      if (!state.user) return;
      const resourceEntry = `Provider: ${providerDisplayName}`;
      const processes = state.user.processes.map((p) => {
        if (p.id !== processId) return p;
        const resources = [...(p.fields?.resources ?? []), resourceEntry];
        const ev = timelineEvent('field_update', { providerId, providerDisplayName });
        return {
          ...p,
          fields: { ...p.fields, resources },
          timeline: [...p.timeline, ev],
        };
      });
      await persistUser({ ...state.user, processes });
    },
    [state.user, persistUser]
  );

  const startProcessFromProtocol = useCallback(
    async (protocolId: string): Promise<OneProcess | null> => {
      const { getProtocolById } = await import('../data/protocols');
      const protocol = getProtocolById(protocolId);
      if (!protocol || !state.user) return null;
      const process = await createProcess({ lens: protocol.lens, title: protocol.title });
      const updated: OneProcess = {
        ...process,
        fields: {
          ...process.fields,
          context: protocol.description,
          nextSteps: [...protocol.stepsPreview],
        },
      };
      await updateProcess(process.id, updated);
      return updated;
    },
    [state.user, createProcess, updateProcess]
  );

  const setAgentStatusText = useCallback((text: string) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    dispatch({ type: 'SET_AGENT_STATUS_TEXT', payload: text });
    statusTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'SET_AGENT_STATUS_TEXT', payload: null });
      statusTimeoutRef.current = null;
    }, AGENT_STATUS_FADE_MS);
  }, []);

  const value: OneContextValue = {
    ...state,
    setName: (name) => dispatch({ type: 'SET_NAME', payload: name }),
    setPersona: (p) => dispatch({ type: 'SET_PERSONA', payload: p }),
    setLenses: (l) => dispatch({ type: 'SET_LENSES', payload: l }),
    setDesire: (d) => dispatch({ type: 'SET_DESIRE', payload: d }),
    nextStep: () => dispatch({ type: 'NEXT_STEP' }),
    completeOnboarding,
    initialize,
    getProcess,
    addProcessMessage,
    updateProcessSummary,
    updateProcess,
    setProcessStatus,
    setProcessOutcome,
    updateAgentHats,
    addProcess,
    createProcess,
    clearUser,
    attachProviderToProcess,
    startProcessFromProtocol,
    setAgentStatusText,
    isOnboarded: !!state.user,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOne() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useOne must be used inside OneProvider');
  return c;
}
