/**
 * MVP types — direct mapping of ONE_DATA_MODEL_AND_EXAMPLES §1.
 * Lives in src/core/mvp/ to avoid colliding with legacy src/core/types.ts during the
 * migration window. Once legacy code is archived, these can move up a directory.
 */

export type IdentityType = 'personal' | 'business' | 'family';

export type TagId =
  | 'health'
  | 'learning'
  | 'business'
  | 'money'
  | 'home'
  | 'family'
  | 'travel'
  | 'legal'
  | 'services'
  | 'fitness'
  | 'custom';

export interface Identity {
  id: string;
  name: string;
  type: IdentityType;
  avatarUrl?: string;
  initials?: string;
  updateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type UnitBroadcastType =
  | 'next_step'
  | 'event'
  | 'waiting'
  | 'progress'
  | 'missing_info'
  | 'attention'
  | 'calm'
  | 'system';

export interface UnitBroadcastItem {
  id: string;
  text: string;
  priority: number;
  type: UnitBroadcastType;
  createdAt: string;
}

export interface UnitMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
}

export type UnitActionType =
  | 'log_weight'
  | 'add_calories'
  | 'start_workout'
  | 'add_meal'
  | 'schedule'
  | 'upload'
  | 'note'
  | 'payment'
  | 'custom';

export interface UnitQuickAction {
  id: string;
  label: string;
  icon?: string;
  actionType: UnitActionType;
}

export interface UnitStep {
  id: string;
  title: string;
  subtitle?: string;
  dueAt?: string;
  done?: boolean;
}

export interface UnitPerson {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  connectionType?: 'coach' | 'provider' | 'family' | 'client' | 'partner' | 'other';
}

export interface UnitAsset {
  id: string;
  title: string;
  type: 'file' | 'image' | 'link' | 'note' | 'document';
  url?: string;
  createdAt: string;
}

/** What kind of action produced a timeline entry — drives its icon + colour.
 *  Mirrors UnitNotification['kind'] so ONE's logged work reads consistently. */
export type UnitActivityKind =
  | 'event'
  | 'capture'
  | 'decision'
  | 'update'
  | 'created'
  | 'completed'
  | 'reminder';

export interface UnitTimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  /** ISO timestamp — when ONE did this. */
  date: string;
  /** Action category, when the entry was auto-logged by ONE. */
  kind?: UnitActivityKind;
}

export interface UnitInsight {
  id: string;
  text: string;
  createdAt: string;
}

export interface UnitHistoryItem {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface UnitDecision {
  id: string;
  text: string;
  /** Optional one-line "why" — helps future-self remember the reasoning. */
  rationale?: string;
  createdAt: string;
}

export interface UnitReminder {
  id: string;
  /** What to be reminded of ("Call the instructor", "Renew the license"). */
  text: string;
  /** Natural-language due exactly as the user said it ("tomorrow 9am",
   *  "Friday", "in 2 weeks"). Shown to the user; not a scheduled trigger. */
  dueLabel?: string;
  /** Resolved ISO due time, when we can compute one. Native scheduled
   *  notifications can hook off this later. */
  dueAt?: string;
  done?: boolean;
  /** True once ONE has surfaced this reminder at its due moment (fired the
   *  toast). Prevents re-firing every scan. Cleared when the reminder is
   *  snoozed to a new time so it fires again then. */
  notified?: boolean;
  createdAt: string;
}

export interface Unit {
  id: string;
  identityId: string;
  title: string;
  emoji: string;
  tagIds: TagId[];
  /** Hex color string — used for the thin bottom line on the small card. */
  color?: string;

  broadcast: UnitBroadcastItem[];
  /** [primary, optional secondary] — 2-line broadcast on the card. */
  latestBroadcastText: [string, string?];

  lastUpdatedAt: string;
  unreadUpdates: number;

  /** One short metadata label: "Coach Eli +1", "Shared +2", "Auto", etc. */
  relationLabel?: string;
  visibility?: 'private' | 'shared' | 'public';

  progress?: {
    current: number;
    total: number;
    label?: string;
  };

  metrics?: UnitMetric[];
  quickActions?: UnitQuickAction[];
  nextSteps?: UnitStep[];
  people?: UnitPerson[];
  assets?: UnitAsset[];
  timeline?: UnitTimelineItem[];
  insights?: UnitInsight[];
  history?: UnitHistoryItem[];
  decisions?: UnitDecision[];
  reminders?: UnitReminder[];

  /** Lifecycle. Undefined / 'active' = in progress. 'completed' = the user
   *  finished it — from intent to reality. Completed processes drop out of
   *  the agenda + due nudges and sort to the bottom of the list. */
  status?: 'active' | 'completed';
  completedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  scope: 'one' | 'unit';
  unitId?: string;
  identityId: string;
  sender: 'user' | 'one' | 'person' | 'system';
  senderName?: string;
  text: string;
  createdAt: string;
}

/** Soft accent colors per tag — used for the thin bottom line on cards. ONE_UI_UX_SPEC §1. */
export const TAG_COLORS: Record<TagId, string> = {
  health: '#34D399', // mint/green
  fitness: '#10B981',
  learning: '#8B5CF6', // purple
  business: '#4B5563', // black/gray
  money: '#F59E0B', // gold
  home: '#3B82F6', // blue
  family: '#EC4899', // pink
  travel: '#FB923C', // orange
  legal: '#6366F1', // indigo
  services: '#64748B',
  custom: '#94A3B8',
};

export const TAG_LABELS: Record<TagId, string> = {
  health: 'Health',
  fitness: 'Fitness',
  learning: 'Learning',
  business: 'Business',
  money: 'Money',
  home: 'Home',
  family: 'Family',
  travel: 'Travel',
  legal: 'Legal',
  services: 'Services',
  custom: 'Custom',
};
