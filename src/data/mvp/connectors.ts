/**
 * Connectors — the sources ONE can link to, to become a true "digital
 * intermediary". Connecting is mock for now (no real OAuth): the point is to
 * surface WHAT ONE plugs into and let the user turn sources on/off. Connected
 * state is persisted in the store (`connections`).
 *
 * Each connector says, in ONE's voice, what it lets ONE DO for you — so the
 * list reads like capability, not settings.
 */

export interface Connector {
  id: string;
  emoji: string;
  name: { he: string; en: string };
  /** One line: what ONE does once this is connected. */
  desc: { he: string; en: string };
}

export const CONNECTORS: Connector[] = [
  {
    id: 'email',
    emoji: '📧',
    name: { he: 'אימייל', en: 'Email' },
    desc: {
      he: 'ONE קורא אישורים, חשבונות ועדכונים — ומעדכן את התהליכים לבד.',
      en: 'ONE reads confirmations, bills and updates — and moves your processes on its own.',
    },
  },
  {
    id: 'calendar',
    emoji: '📅',
    name: { he: 'יומן', en: 'Calendar' },
    desc: {
      he: 'ONE קובע פגישות, מזכיר לך ומסנכרן דדליינים.',
      en: 'ONE books, reminds and keeps your deadlines in sync.',
    },
  },
  {
    id: 'whatsapp',
    emoji: '💬',
    name: { he: 'וואטסאפ', en: 'WhatsApp' },
    desc: {
      he: 'ONE עוקב אחרי שיחות ומתכתב עבורך עם אנשי הקשר בתהליך.',
      en: 'ONE follows threads and follows up with the people in a process.',
    },
  },
  {
    id: 'bank',
    emoji: '🏦',
    name: { he: 'בנק ותשלומים', en: 'Bank & payments' },
    desc: {
      he: 'ONE יודע מה שולם, מה נותר, וכמה כל תהליך עולה.',
      en: "ONE tracks what's paid, what's left, and what each process costs.",
    },
  },
  {
    id: 'contacts',
    emoji: '👥',
    name: { he: 'אנשי קשר', en: 'Contacts' },
    desc: {
      he: 'ONE יודע מי מעורב בכל תהליך ואיך להשיג אותו.',
      en: 'ONE knows who is involved in each process and how to reach them.',
    },
  },
  {
    id: 'files',
    emoji: '📁',
    name: { he: 'מסמכים', en: 'Documents' },
    desc: {
      he: 'ONE שומר, מסדר ומאתר את המסמכים של כל תהליך.',
      en: 'ONE stores, files and finds the documents for every process.',
    },
  },
];
