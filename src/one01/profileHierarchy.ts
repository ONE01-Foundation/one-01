/**
 * ONE – היררכיית פרופיל: Origin (Root Identity) + World (Context Engine).
 * מקור אמת למבנה הסטייט התפעולי – לא אפליקציה/טאב/מסך, מערכת תפעולית.
 *
 * Origin = מערכת של מערכות
 * World = מערכת תחום
 * Process = יחידת ביצוע
 * Asset = יחידת מידע
 * Connector = מקור חיצוני
 * Skill = יכולת חישובית
 * Metric = מדד סטייט
 *
 * הצגה: Score → Status → Next Action → Drill Down (בלי להעמיס UI).
 */

// ─── Ids & enums ───────────────────────────────────────────────────────────

export type OriginType = 'personal' | 'business' | 'team' | 'project';

export type WorldId =
  | 'health'
  | 'business'
  | 'finance'
  | 'learning'
  | 'family'
  | 'creation'
  | 'knowledge'
  | string; // Custom Worlds

export type WorldStatus = 'active' | 'paused';

export type MetricTrend = 'up' | 'down' | 'stable';
export type MetricStatus = 'ok' | 'warning' | 'alert';

/** מדד – תמיד: Score, Trend, Status */
export interface LiveMetric {
  id: string;
  label: string;
  value: number | string;
  trend?: MetricTrend;
  status?: MetricStatus;
  updatedAt: string;
}

// ─── Connectors ─────────────────────────────────────────────────────────────

export type ConnectorId =
  | 'gmail'
  | 'google_calendar'
  | 'whatsapp'
  | 'notion'
  | 'stripe'
  | 'bank'
  | 'apple_health'
  | 'shopify'
  | 'github'
  | 'webhooks'
  | 'garmin'
  | 'fitbit'
  | 'myfitnesspal'
  | string;

export interface ConnectorState {
  id: ConnectorId;
  name: string;
  connected: boolean;
  lastSyncAt?: string;
}

// ─── Skills (יכולות פנימיות) – שלב ראשון toggle on/off ─────────────────────

export type SkillId =
  | 'summarization'
  | 'planning'
  | 'forecasting'
  | 'analytics'
  | 'reminder_engine'
  | 'automation_engine'
  | 'ai_drafting'
  | 'decision_support'
  | string;

export interface SkillState {
  id: SkillId;
  name: string;
  enabled: boolean;
}

// ─── People / Roles ─────────────────────────────────────────────────────────

export type RoleKind = 'owner' | 'team_member' | 'collaborator' | 'client';

export interface OriginPerson {
  id: string;
  name: string;
  role: RoleKind;
}

// ─── Process summary at World level (להצגה ברשימת Processes בעולם) ─────────

export interface WorldProcessSummary {
  id: string;
  title: string;
  status: 'active' | 'done' | 'paused';
  stage?: string;
  nextAction?: string;
  completionPercent?: number;
  lastUpdated: string;
}

// ─── Asset (יחידת מידע בעולם) ─────────────────────────────────────────────

export interface WorldAsset {
  id: string;
  type: string;
  title: string;
  updatedAt: string;
}

// ─── Agent capability per World ────────────────────────────────────────────

export interface WorldAgentCapability {
  id: string;
  name: string;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣ פרופיל Origin (Root Identity – Container תפעולי)
// ─────────────────────────────────────────────────────────────────────────────

export interface OriginIdentity {
  name: string;
  type: OriginType;
  description?: string;
  createdAt: string;
  ownerId: string;
}

/** Worlds פעילים ברמת Origin */
export interface OriginWorldRef {
  id: WorldId;
  name: string;
  color?: string;
  icon?: string;
  status: WorldStatus;
}

/** Origin Metrics – KPI כללי (Overview חיים) */
export type OriginMetricId =
  | 'active_processes'
  | 'completion_rate'
  | 'health_score'
  | 'financial_stability_score'
  | 'productivity_index'
  | 'risk_alerts'
  | 'agent_activity_level'
  | 'pending_actions';

export interface OriginProfile {
  /** A. פרטי זהות */
  identity: OriginIdentity;

  /** B. Worlds פעילים */
  worlds: OriginWorldRef[];

  /** C. Connectors (חיבורים חיצוניים) */
  connectors: ConnectorState[];

  /** D. Skills (יכולות פנימיות) */
  skills: SkillState[];

  /** E. People / Roles */
  people: OriginPerson[];

  /** F. Origin Metrics – עליון, סטייט חי */
  metrics: LiveMetric[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣ פרופיל World (Context Engine, למשל: בריאות / עסקים / פיננסים)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldHeader {
  name: string;
  color: string;
  icon?: string;
  status: WorldStatus;
}

export interface WorldProfile {
  id: WorldId;

  /** A. Header */
  header: WorldHeader;

  /** B. World Metrics (ברמה העליונה של העולם) */
  metrics: LiveMetric[];

  /** C. Processes פעילים בעולם */
  processes: WorldProcessSummary[];

  /** D. Assets בעולם */
  assets: WorldAsset[];

  /** E. Connectors ספציפיים לעולם */
  connectors: ConnectorState[];

  /** F. Agent Capabilities ספציפיים לעולם */
  agentCapabilities: WorldAgentCapability[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels & defaults (לשימוש ב-UI)
// ─────────────────────────────────────────────────────────────────────────────

export const ORIGIN_METRIC_LABELS: Record<OriginMetricId, string> = {
  active_processes: 'Active Processes',
  completion_rate: 'Completion Rate',
  health_score: 'Health Score',
  financial_stability_score: 'Financial Stability Score',
  productivity_index: 'Productivity Index',
  risk_alerts: 'Risk Alerts',
  agent_activity_level: 'Agent Activity Level',
  pending_actions: 'Pending Actions',
};

export const WORLD_IDS: WorldId[] = [
  'health',
  'business',
  'finance',
  'learning',
  'family',
  'creation',
  'knowledge',
];

export const WORLD_LABELS: Record<string, string> = {
  health: 'בריאות',
  business: 'עסקים',
  finance: 'פיננסים',
  learning: 'למידה',
  family: 'משפחה',
  creation: 'יצירה',
  knowledge: 'ידע',
};

/** מה להראות ברמת Origin (תמיד למעלה) */
export const ORIGIN_TOP_METRICS: OriginMetricId[] = [
  'health_score', // או Overall Score
  'active_processes',
  'completion_rate',
  'risk_alerts',
  'agent_activity_level',
  'pending_actions',
];

/** מה להראות ברמת World (למעלה בעולם) */
export type WorldTopDisplay = {
  scoreLabel: string;   // Health Score / Business Score / etc.
  trend: boolean;
  lastUpdate: boolean;
  pendingActions: boolean;
  riskIndicator: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// סטייט חי: מיפוי מהמשתמש והתהליכים הקיימים לפרופיל Origin
// (מאפשר להציג ב-ProfileScreen מדדים אמיתיים בלי להעמיס UI)
// ─────────────────────────────────────────────────────────────────────────────

import type { OneUser, OneProcess, LifeLens } from '../core/types';
import { LENS_LABELS } from '../core/types';

export function getOriginProfileFromUser(user: OneUser): OriginProfile {
  const now = new Date().toISOString();
  const activeCount = user.processes.filter((p) => p.status === 'active').length;
  const doneCount = user.processes.filter((p) => p.status === 'done').length;
  const total = user.processes.length;
  const completionRate = total ? Math.round((doneCount / total) * 100) : 0;

  const metrics: LiveMetric[] = [
    { id: 'active_processes', label: ORIGIN_METRIC_LABELS.active_processes, value: activeCount, updatedAt: now },
    { id: 'completion_rate', label: ORIGIN_METRIC_LABELS.completion_rate, value: `${completionRate}%`, trend: 'stable', updatedAt: now },
    { id: 'pending_actions', label: ORIGIN_METRIC_LABELS.pending_actions, value: activeCount, status: activeCount > 0 ? 'warning' : 'ok', updatedAt: now },
  ];

  const worlds: OriginWorldRef[] = (user.lenses as WorldId[]).map((id) => ({
    id,
    name: WORLD_LABELS[id] ?? LENS_LABELS[id as LifeLens] ?? id,
    status: 'active',
  }));

  return {
    identity: {
      name: user.name,
      type: 'personal',
      createdAt: user.processes[0]?.createdAt ?? now,
      ownerId: user.id,
    },
    worlds,
    connectors: [],
    skills: [],
    people: [{ id: user.id, name: user.name, role: 'owner' }],
    metrics,
  };
}

/** המרת OneProcess ל־WorldProcessSummary (לפרופיל עולם) */
export function toWorldProcessSummary(p: OneProcess): WorldProcessSummary {
  const steps = p.steps ?? [];
  const completed = steps.filter((s) => s.completed).length;
  const completionPercent = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    completionPercent,
    lastUpdated: p.timeline?.[p.timeline.length - 1]?.at ?? p.createdAt,
  };
}
