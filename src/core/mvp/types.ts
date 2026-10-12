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

/**
 * A thing ONE remembers about the user — the "remembers what matters to you"
 * promise made concrete. Account-wide (one ONE knows you across every space).
 * Captured from chat ("remember that…") or added by hand in the ONE profile.
 */
export interface MemoryItem {
  id: string;
  text: string;
  /** Epoch ms. */
  ts: number;
  /**
   * Sharing rule for this remembered fact — same scale as a DisclosureField.
   * A memory is something ONE learned about you, so it is `private` by default;
   * you open it up deliberately. Older memories have no tier and read as private.
   */
  tier?: DisclosureTier;
}

/**
 * ── ONE's TOOLS ──────────────────────────────────────────────────────────────
 * Interactive capabilities ONE deploys INSIDE the conversation as chat widgets
 * (a multiple-choice quiz, appointment booking, a form…). A tool almost always
 * serves a PROCESS and feeds its result back into it. The quiz is the first.
 */

/** One multiple-choice question. `correct` indexes into `options`. */
export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  /** Optional one-line explanation shown after answering. */
  why?: string;
}

/** A live quiz ONE deployed in the thread. State lives in the store so the
 *  widget reads it live (like a process card) and it survives reloads. */
export interface QuizRun {
  id: string;
  /** The process this quiz is helping with (score flows back here). */
  unitId?: string;
  title: string;
  /** The unit metric to write the result onto when finished (e.g. "תיאוריה"). */
  metricLabel?: string;
  questions: QuizQuestion[];
  /** Chosen option index per question; null = not yet answered. */
  answers: (number | null)[];
  /** ISO timestamp set when every question is answered. */
  finishedAt?: string;
}

export interface BookingSlot {
  id: string;
  /** Display label, e.g. "יום ג׳ 14:00" / "Tue 14:00". */
  label: string;
  /** ISO timestamp of the slot start, when known. */
  iso?: string;
}

/** A live booking ONE deployed in the thread — pick a time with a provider.
 *  State lives in the store so the widget reads it live and survives reloads.
 *  The confirmed slot flows back onto the process as a timeline entry. */
export interface BookingRun {
  id: string;
  /** The process this booking belongs to. */
  unitId?: string;
  title: string;
  /** Who the appointment is with, when known (e.g. "מוסך דני"). */
  provider?: string;
  slots: BookingSlot[];
  /** The chosen slot id; undefined until the user picks one. */
  selectedSlotId?: string;
  /** ISO timestamp set when the user confirms the booking. */
  confirmedAt?: string;
}

export interface FormField {
  id: string;
  label: string;
  placeholder?: string;
  /** 'number' hints a numeric keypad; default is free text. */
  kind?: 'text' | 'number';
  value?: string;
  /** When set, submitting saves this field onto the matching disclosure fact
   *  (name/phone/email/city/age) so ONE can then represent it. */
  discKey?: string;
}

/** A live form ONE deployed in the thread — collect a few structured details.
 *  On submit the values flow back: a note on the process, and any `discKey`
 *  field is saved into "What ONE knows about you" (the disclosure policy). */
export interface FormRun {
  id: string;
  unitId?: string;
  title: string;
  fields: FormField[];
  /** ISO timestamp set when the user submits. */
  submittedAt?: string;
}

/**
 * How freely ONE may disclose a given fact about you when it represents you to
 * a business or a person. This is ONE's trust core and its sharpest contrast
 * with "agent" products that sign in AS you with your full credentials: ONE is
 * a *permissioned representative* — it never impersonates you, and it discloses
 * only what you've allowed.
 *   • open    — ONE may share this freely whenever it's relevant.
 *   • ask     — ONE shares this only after it asks you and you approve.
 *   • private — ONE never discloses this to anyone.
 */
export type DisclosureTier = 'open' | 'ask' | 'private';

/**
 * One fact ONE can represent on your behalf, paired with the rule for sharing
 * it. System fields (name/phone/email/…) carry a stable `key` the UI maps to a
 * localized label; user-added fields carry a literal `label`.
 */
export interface DisclosureField {
  id: string;
  /** i18n key for a built-in field (see SYSTEM_DISCLOSURE_LABELS). */
  key?: string;
  /** Literal label for a user-added field. */
  label?: string;
  /** The value ONE would share. Empty until you fill it in. */
  value?: string;
  /** Sharing rule for this fact. */
  tier: DisclosureTier;
  /** Built-in field — not user-removable. */
  system?: boolean;
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
  | 'reminder'
  | 'draft';

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

/**
 * An outward artifact ONE composed for a process — the actual next
 * communication or document (the WhatsApp to the instructor, the email to the
 * landlord, the filled form text). This is the "intent → reality" bridge: ONE
 * doesn't just track the process, it drafts the thing that moves it forward,
 * which the user reviews, edits, and sends. Sending uses the OS share sheet;
 * ONE never sends silently.
 */
export interface UnitDraft {
  id: string;
  /** How it would go out — shapes the icon + the send affordance. */
  channel: 'whatsapp' | 'email' | 'sms' | 'call' | 'form' | 'note';
  /** Who it's for, as a label ("Sarah Salon", "the landlord", "Dr. Cohen"). */
  to?: string;
  /** Subject line (channel === 'email'). */
  subject?: string;
  /** The actual text ONE composed — editable by the user before sending. */
  body: string;
  status: 'draft' | 'sent';
  createdAt: string;
  /** ISO time the user sent it via the share sheet. */
  sentAt?: string;
  /**
   * Ids of 'ask'-tier disclosure fields the user has approved for THIS outreach.
   * 'open' fields are always included (policy); 'private' never. This is what
   * makes selective disclosure concrete at the moment ONE acts on your behalf.
   */
  sharedFields?: string[];
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
  /** Short code from the shared backend once this process is published for the
   *  other side to join (see cloudShared). Absent = local-only share. */
  shareCode?: string;
  /** Which side of the shared thread THIS user is on for this process:
   *  'one' = you shared it (ONE represents you); 'human' = you JOINED someone
   *  else's shared process by code. Drives who's "the other side" for live
   *  notifications, and which role your messages post as. Undefined = 'one'. */
  sharedRole?: 'one' | 'human';
  /** The name you appear as in the shared thread (the provider's join name for a
   *  joined process; the owner's open Name otherwise). */
  sharedAs?: string;

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
  /** Outward artifacts ONE drafted for this process (newest first). */
  drafts?: UnitDraft[];

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
