/**
 * tools — the catalog of ONE's capabilities ("the toolbox"). Each tool is a
 * capability ONE can deploy inside the conversation as a widget. `live` tools
 * work today; `soon` tools are on the way. The ONE profile renders this as the
 * Toolbox (toggle `live` tools on/off per account); the chat checks `enabledTools`
 * before deploying one.
 *
 * Adding a tool here + a ChatWidget kind + a renderer + a deploy trigger is all
 * it takes to grow the toolbox.
 */

export interface ToolDef {
  id: string;
  emoji: string;
  label: (he: boolean) => string;
  desc: (he: boolean) => string;
  status: 'live' | 'soon';
  /** Requires a paid plan. */
  pro?: boolean;
}

export const TOOLS: ToolDef[] = [
  {
    id: 'quiz',
    emoji: '🧠',
    label: (he) => (he ? 'מבחן אמריקאי' : 'Quiz'),
    desc: (he) => (he ? 'תרגול ושאלות רב־ברירה בתוך תהליך' : 'Multiple-choice practice inside a process'),
    status: 'live',
  },
  {
    id: 'reminders',
    emoji: '🔔',
    label: (he) => (he ? 'תזכורות' : 'Reminders'),
    desc: (he) => (he ? 'מעקב ודחיפה לצעד הבא' : 'Tracks and nudges the next step'),
    status: 'live',
  },
  {
    id: 'drafts',
    emoji: '✍️',
    label: (he) => (he ? 'ניסוח הודעות' : 'Message drafts'),
    desc: (he) => (he ? 'מנסח הודעה מוכנה לשליחה' : 'Drafts a ready-to-send message'),
    status: 'live',
  },
  {
    id: 'booking',
    emoji: '📅',
    label: (he) => (he ? 'קביעת תורים' : 'Booking'),
    desc: (he) => (he ? 'בחירת שעה מול ספק, בשיחה' : 'Pick a slot with a provider, in chat'),
    status: 'live',
  },
  {
    id: 'forms',
    emoji: '📝',
    label: (he) => (he ? 'טפסים' : 'Forms'),
    desc: (he) => (he ? 'איסוף פרטים מובנה' : 'Structured detail collection'),
    status: 'live',
  },
  {
    id: 'sources',
    emoji: '🔎',
    label: (he) => (he ? 'חיפוש מקורות' : 'Source search'),
    desc: (he) => (he ? 'הבאת מידע אמין' : 'Pulls in reliable info'),
    status: 'soon',
    pro: true,
  },
];

/** A live tool is on unless explicitly toggled off. */
export function toolEnabled(enabled: Record<string, boolean>, id: string): boolean {
  return enabled[id] !== false;
}
