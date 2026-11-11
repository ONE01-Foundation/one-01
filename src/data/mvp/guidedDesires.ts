/**
 * Guided desires — the "ONE fills the desire WITH you" catalog.
 *
 * Some intents are too broad to turn straight into a process: "I want a license"
 * shouldn't instantly become "Driving license". Instead ONE asks a short, guided
 * series of questions, each offered as tappable CHOICE PILLS (emoji + word), and
 * only once the desire is specific enough does it OPEN THE TOPIC as a real
 * process. This is the data for that flow; the orchestration lives in
 * `ChatChoiceCard` and the Home send pipeline.
 *
 * Pure data + pure helpers — safe to import anywhere (no store/React imports).
 */

export interface GuidedOption {
  /** Stable slot value (language-independent). */
  value: string;
  /** A small glyph for the pill — NOT always present (per the product note: a
   *  pill is emoji + word, but the emoji is optional). */
  emoji?: string;
  label: { he: string; en: string };
}

export interface GuidedStep {
  /** Slot id, e.g. 'type' — the key the answer is stored under. */
  id: string;
  prompt: { he: string; en: string };
  options: GuidedOption[];
  /** Only ask this step when the prior answers make it relevant (branching). */
  when?: (answers: Record<string, string>) => boolean;
}

export interface GuidedDesire {
  key: string;
  /** Detects the broad intent in free text. */
  match: RegExp;
  /** The base noun that leads the process title, e.g. "רישיון" / "License". */
  noun: { he: string; en: string };
  emoji?: string;
  steps: GuidedStep[];
}

export const GUIDED_DESIRES: GuidedDesire[] = [
  {
    key: 'license',
    match: /(רישיון|רשיון|licen[cs]e|permit)/i,
    noun: { he: 'רישיון', en: 'License' },
    emoji: '📄',
    steps: [
      {
        id: 'type',
        prompt: { he: 'איזה רישיון?', en: 'What kind of license?' },
        options: [
          { value: 'driving', emoji: '🚗', label: { he: 'נהיגה', en: 'Driving' } },
          { value: 'firearm', emoji: '🔫', label: { he: 'נשק', en: 'Firearm' } },
          { value: 'business', emoji: '🏢', label: { he: 'עסק', en: 'Business' } },
          { value: 'professional', emoji: '📜', label: { he: 'מקצועי', en: 'Professional' } },
        ],
      },
      {
        id: 'vehicle',
        when: (a) => a.type === 'driving',
        prompt: { he: 'איזה כלי?', en: 'Which vehicle?' },
        options: [
          { value: 'motorcycle', emoji: '🏍️', label: { he: 'אופנוע', en: 'Motorcycle' } },
          { value: 'car', emoji: '🚗', label: { he: 'רכב', en: 'Car' } },
          { value: 'truck', emoji: '🚚', label: { he: 'משאית', en: 'Truck' } },
        ],
      },
      {
        id: 'status',
        prompt: { he: 'חדש או חידוש?', en: 'New or renewal?' },
        options: [
          { value: 'new', emoji: '🆕', label: { he: 'חדש', en: 'New' } },
          { value: 'renew', emoji: '🔄', label: { he: 'חידוש', en: 'Renewal' } },
        ],
      },
    ],
  },
  {
    key: 'fitness',
    match: /(כושר|אימון|אימונים|להתאמן|לרזות|לרדת במשקל|לעלות במשקל|שריר|מסה|fitness|workout|gym|lose weight|gain (?:weight|muscle)|get fit)/i,
    noun: { he: 'כושר', en: 'Fitness' },
    emoji: '💪',
    steps: [
      {
        id: 'goal',
        prompt: { he: 'מה המטרה?', en: 'What’s the goal?' },
        options: [
          { value: 'lose', emoji: '🔥', label: { he: 'ירידה במשקל', en: 'Lose weight' } },
          { value: 'gain', emoji: '💪', label: { he: 'עלייה במסה', en: 'Build muscle' } },
          { value: 'tone', emoji: '✨', label: { he: 'חיטוב', en: 'Tone up' } },
          { value: 'health', emoji: '❤️', label: { he: 'בריאות כללית', en: 'General health' } },
        ],
      },
      {
        id: 'freq',
        prompt: { he: 'כמה פעמים בשבוע?', en: 'How many times a week?' },
        options: [
          { value: 'x2_3', emoji: '🟢', label: { he: '2–3 בשבוע', en: '2–3 / week' } },
          { value: 'x4_5', emoji: '🟡', label: { he: '4–5 בשבוע', en: '4–5 / week' } },
          { value: 'daily', emoji: '🔴', label: { he: 'כל יום', en: 'Daily' } },
        ],
      },
      {
        id: 'where',
        prompt: { he: 'איפה?', en: 'Where?' },
        options: [
          { value: 'gym', emoji: '🏋️', label: { he: 'חדר כושר', en: 'Gym' } },
          { value: 'home', emoji: '🏠', label: { he: 'בית', en: 'Home' } },
          { value: 'outdoor', emoji: '🌳', label: { he: 'בחוץ', en: 'Outdoors' } },
        ],
      },
    ],
  },
  {
    key: 'insurance',
    match: /(ביטוח|insurance)/i,
    noun: { he: 'ביטוח', en: 'Insurance' },
    emoji: '🛡️',
    steps: [
      {
        id: 'type',
        prompt: { he: 'ביטוח למה?', en: 'Insurance for what?' },
        options: [
          { value: 'car', emoji: '🚗', label: { he: 'רכב', en: 'Car' } },
          { value: 'health', emoji: '🩺', label: { he: 'בריאות', en: 'Health' } },
          { value: 'home', emoji: '🏠', label: { he: 'דירה', en: 'Home' } },
          { value: 'life', emoji: '❤️', label: { he: 'חיים', en: 'Life' } },
          { value: 'travel', emoji: '✈️', label: { he: 'נסיעות', en: 'Travel' } },
        ],
      },
      {
        id: 'goal',
        prompt: { he: 'מה המטרה?', en: 'What’s the goal?' },
        options: [
          { value: 'cheaper', emoji: '💸', label: { he: 'זול יותר', en: 'Cheaper' } },
          { value: 'new', emoji: '🆕', label: { he: 'פוליסה חדשה', en: 'New policy' } },
          { value: 'claim', emoji: '📩', label: { he: 'תביעה', en: 'A claim' } },
        ],
      },
    ],
  },
];

/** The broad intent → a guided desire, if one fits (and it isn't already so
 *  specific that guiding adds nothing). */
export function matchGuidedDesire(text: string): GuidedDesire | undefined {
  const t = text.trim();
  if (t.length > 60) return undefined; // a long, detailed ask is already specific
  const lower = t.toLowerCase();
  const desire = GUIDED_DESIRES.find((d) => d.match.test(t));
  if (!desire) return undefined;
  // Already specific? If the text already names the PRIMARY choice (e.g. "car
  // insurance", "ביטוח רכב"), there's nothing to ask — let the normal pipeline
  // build that exact process directly.
  const primary = desire.steps[0];
  if (
    primary.options.some(
      (o) => (o.label.en.length > 2 && lower.includes(o.label.en.toLowerCase())) || t.includes(o.label.he),
    )
  ) {
    return undefined;
  }
  return desire;
}

/** The steps actually asked given the answers so far (branching via `when`). */
export function visibleSteps(desire: GuidedDesire, answers: Record<string, string>): GuidedStep[] {
  return desire.steps.filter((s) => !s.when || s.when(answers));
}

/** The pill label for an already-answered step, for the "answered" rendering. */
export function pickedLabel(step: GuidedStep, value: string, he: boolean): string {
  const opt = step.options.find((o) => o.value === value);
  if (!opt) return value;
  return `${opt.emoji ? opt.emoji + ' ' : ''}${he ? opt.label.he : opt.label.en}`;
}

/** The process TITLE once the desire is specific — "רישיון נהיגה", "ביטוח רכב",
 *  "כושר עלייה במסה". Leads with the noun + the PRIMARY (first) choice. */
export function guidedTitle(desire: GuidedDesire, answers: Record<string, string>, he: boolean): string {
  const noun = he ? desire.noun.he : desire.noun.en;
  const primary = desire.steps[0];
  const opt = primary.options.find((o) => o.value === answers[primary.id]);
  const label = opt ? (he ? opt.label.he : opt.label.en) : '';
  return label ? `${noun} ${label}` : noun;
}

/** A one-line human summary of the remaining choices — fed into the opened topic
 *  as context so nothing the user told ONE is lost. The PRIMARY (first) choice is
 *  skipped (it already leads the title) to avoid "רישיון נהיגה · נהיגה". */
export function guidedSummary(desire: GuidedDesire, answers: Record<string, string>, he: boolean): string {
  const primaryId = desire.steps[0].id;
  const parts = visibleSteps(desire, answers)
    .filter((s) => s.id !== primaryId)
    .map((s) => (answers[s.id] ? pickedLabel(s, answers[s.id], he) : null))
    .filter(Boolean) as string[];
  return parts.join(' · ');
}
