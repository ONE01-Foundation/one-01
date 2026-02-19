/**
 * ONE01 v0.1 – Source of truth.
 * Process Engine: Intent → Protocol → Process Card → Outcome → Origin Memory
 * Life Lenses (Hats): context filters only. No separate accounts.
 */

/** v0.1: exactly 4 Life Lenses */
export type LifeLens = 'health' | 'finance' | 'knowledge' | 'business';

export const LIFE_LENSES: LifeLens[] = ['health', 'finance', 'knowledge', 'business'];

export const LENS_LABELS: Record<LifeLens, string> = {
  health: 'Health',
  finance: 'Finance',
  knowledge: 'Knowledge',
  business: 'Business',
};

/** Agent tone for responses later. Stored at onboarding. */
export type AgentPersona = 'friendly' | 'professional' | 'neutral';

export const PERSONA_LABELS: Record<AgentPersona, string> = {
  friendly: 'Friendly',
  professional: 'Professional',
  neutral: 'Neutral',
};

/** Agent capabilities (Hats). One agent, many hats. */
export type Hat = 'base' | 'health' | 'finance' | 'knowledge' | 'business' | 'provider';

export const HAT_LABELS: Record<Hat, string> = {
  base: 'Base',
  health: 'Health',
  finance: 'Finance',
  knowledge: 'Knowledge',
  business: 'Business',
  provider: 'Provider',
};

/** Glow color behind agent face per hat. General = white. */
export function getHatColor(hat: Hat): string {
  switch (hat) {
    case 'health': return '#34C759';
    case 'finance': return '#0A84FF';
    case 'knowledge': return '#AF52DE';
    case 'business': return '#FF9500';
    case 'provider': return '#5AC8FA';
    default: return '#FFFFFF';
  }
}

/** One personal agent per user ("Nobody") */
export interface OneAgent {
  id: string;
  name: string;
  persona: AgentPersona;
  hats: Hat[];
}

/** שלב בתהליך – לפרוגרס ולהצגה */
export interface ProcessStep {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

/** צפי vs מציאות – מה נדרש (כסף, זמן, משאבים); משתמש יכול "להתווכח" (מחיר/זמן אחר) */
export interface ProcessReality {
  estimatedCostNis?: number;
  estimatedTimeDays?: number;
  estimatedTimeMinutes?: number;
  resources?: string[];
  /** משא ומתן: יעד משתמש (למשל מחיר נמוך יותר, זמן קצר יותר) */
  targetCostNis?: number;
  targetTimeDays?: number;
}

/** Card fields compiled from notes (rule-based in v0.1.1) */
export type ProcessFields = {
  goal?: string;
  context?: string;
  constraints?: string[];
  nextSteps?: string[];
  risks?: string[];
  resources?: string[];
  outcome?: string;
};

export type ProcessEventType = 'note' | 'compile' | 'status' | 'field_update';

export interface ProcessEvent {
  id: string;
  at: string;
  type: ProcessEventType;
  payload: Record<string, unknown>;
}

/** Process = main unit. Messages + compiler → Card fields. */
export interface OneProcess {
  id: string;
  title: string;
  lens: LifeLens;
  status: 'active' | 'done';
  createdAt: string;
  summary: string;
  messages: ProcessMessage[];
  fields: ProcessFields;
  timeline: ProcessEvent[];
  steps?: ProcessStep[];
  reality?: ProcessReality;
}

export interface ProcessMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  createdAt: string;
}

/** One user, one agent, lenses, active processes */
export interface OneUser {
  id: string;
  name: string;
  lenses: LifeLens[];
  agent: OneAgent;
  processes: OneProcess[];
}

/** Onboarding: birth → worlds (hats) → direction (first process) → naming → login */
export interface OnboardingState {
  step: 'birth' | 'worlds' | 'direction' | 'naming' | 'login';
  name: string;
  persona: AgentPersona | null;
  lenses: LifeLens[];
  desire: string;
}
