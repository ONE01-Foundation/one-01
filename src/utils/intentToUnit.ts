/**
 * intentToUnit — convert a `OneIntent.process` (returned by ONE's AI)
 * into a real `Unit` we can drop into the store.
 *
 * Layers (most → least specific):
 *   1. The AI tells us emoji, title, broadcast, nextSteps, metrics,
 *      quickActions, tags. We trust it for content, sanitize for shape.
 *   2. If the AI provided fewer than N nextSteps / metrics / quickActions,
 *      we lightly enrich from a small per-tag template registry — purely
 *      additive, never overriding what the AI gave us.
 *   3. Anything still empty stays empty; the user fills it through the
 *      live chat with ONE.
 */

import type {
  Unit,
  UnitBroadcastType,
  UnitMetric,
  UnitQuickAction,
  UnitStep,
  TagId,
} from '../core/mvp/types';
import { TAG_COLORS } from '../core/mvp/types';
import type { OneIntent } from '../services/aiChat';

let unitCounter = 0;

// Broad emoji / pictograph ranges. Good enough to clean a title and to lift a
// stray emoji into the dedicated emoji slot — not a full Unicode emoji spec.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Strip emoji from a process title — the name must read as clean text. */
function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** First emoji found in a string (used to recover one the model wrongly
 *  baked into the title when it gave us no separate emoji). */
function firstEmoji(s: string): string | null {
  const m = s.match(EMOJI_RE);
  return m && m[0] ? m[0] : null;
}

/**
 * Tokenize a process title for similarity matching. We strip Hebrew
 * niqqud, lowercase, drop common filler ("של", "ה", "to", "the", etc.),
 * and split on whitespace + punctuation. The aim isn't NLP-grade — just
 * enough to recognize "כושר" and "תזכורות לכושר" as the same topic.
 */
function tokenizeTitle(s: string): Set<string> {
  const STOP = new Set([
    'של', 'ל', 'ה', 'מ', 'את', 'עם', 'על', 'אל', 'תזכורות', 'תזכורת', 'תהליך',
    'to', 'the', 'a', 'an', 'of', 'and', 'or', 'for', 'in', 'on', 'my', 'our',
    'reminders', 'reminder', 'process',
  ]);
  return new Set(
    s
      .toLowerCase()
      .replace(/[֑-ׇ]/g, '')
      .split(/[\s\p{P}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP.has(t)),
  );
}

/**
 * Find an existing unit whose topic overlaps significantly with a
 * candidate title. Returns the best match if Jaccard similarity ≥ 0.5
 * over the meaningful tokens, otherwise null.
 *
 * Used as a client-side dedupe guard: even if the AI returns
 * create_process, we route the content into an existing process when the
 * topic clearly matches. The user explicitly asked for this — "don't
 * create a new process for every related request, put it under the one
 * that already exists."
 */
export function findSimilarUnit(
  candidateTitle: string,
  units: { id: string; title: string; identityId?: string }[],
  identityId?: string,
): { id: string; title: string } | null {
  const a = tokenizeTitle(candidateTitle);
  if (a.size === 0) return null;
  let best: { id: string; title: string; score: number } | null = null;
  for (const u of units) {
    if (identityId && u.identityId && u.identityId !== identityId) continue;
    const b = tokenizeTitle(u.title);
    if (b.size === 0) continue;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    const union = a.size + b.size - inter;
    if (union === 0) continue;
    const score = inter / union;
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { id: u.id, title: u.title, score };
    }
  }
  return best ? { id: best.id, title: best.title } : null;
}

const VALID_TAGS: TagId[] = [
  'health',
  'fitness',
  'money',
  'business',
  'home',
  'family',
  'legal',
  'learning',
  'travel',
  'services',
];

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueId(prefix: string): string {
  unitCounter += 1;
  return `${prefix}_${Date.now()}_${unitCounter}`;
}

/**
 * Per-tag enrichment defaults. Used when the AI left a field thin —
 * never overrides what the AI provided. The point is: a process should
 * NEVER be born empty. Even if the model returns just a title, the
 * fallback gives the user something to refine.
 *
 * Values are intentionally generic-but-plausible — the AI is responsible
 * for domain-specific numbers (e.g. typical license cost in Israel).
 * These are floors, not ceilings.
 */
const TAG_DEFAULTS: Partial<
  Record<
    TagId,
    {
      quickActions?: string[];
      metrics?: Array<{ label: string; unit?: string }>;
      nextSteps?: string[];
    }
  >
> = {
  health: {
    quickActions: ['Log symptom', 'Add appointment', 'Upload document'],
    metrics: [{ label: 'Status', unit: '' }, { label: 'Last check', unit: '' }],
    nextSteps: ['Book first appointment', 'Gather records', 'Note current symptoms'],
  },
  fitness: {
    quickActions: ['Log weight', 'Add workout', 'Add meal'],
    metrics: [{ label: 'Weight', unit: 'kg' }, { label: 'Goal', unit: 'kg' }, { label: 'Workouts/week', unit: '' }],
    nextSteps: ['Set weekly schedule', 'Log starting weight', 'Plan first workout'],
  },
  money: {
    quickActions: ['Log payment', 'Add receipt', 'Set reminder'],
    metrics: [{ label: 'Balance', unit: '' }, { label: 'Budget', unit: '' }],
    nextSteps: ['Set the budget', 'Identify first expense', 'Schedule review'],
  },
  business: {
    quickActions: ['Send quote', 'Schedule call', 'Mark as won'],
    metrics: [{ label: 'Stage', unit: '' }, { label: 'Value', unit: '' }],
    nextSteps: ['Define the offer', 'List first leads', 'Send first outreach'],
  },
  home: {
    quickActions: ['Add task', 'Add contact', 'Upload document'],
    metrics: [{ label: 'Budget', unit: '' }, { label: 'Target date', unit: '' }],
    nextSteps: ['List what needs to happen', 'Get a quote', 'Pick a date'],
  },
  family: {
    quickActions: ['Add event', 'Add person', 'Set reminder'],
    metrics: [{ label: 'Next milestone', unit: '' }],
    nextSteps: ['Note key dates', 'List people involved', 'Pick the next step'],
  },
  legal: {
    quickActions: ['Upload document', 'Add appointment', 'Log call'],
    metrics: [{ label: 'Status', unit: '' }, { label: 'Deadline', unit: '' }],
    nextSteps: ['Gather required documents', 'Find a specialist', 'Book first consultation'],
  },
  learning: {
    quickActions: ['Add session', 'Add note', 'Set reminder'],
    metrics: [{ label: 'Progress', unit: '%' }, { label: 'Sessions', unit: '' }],
    nextSteps: ['Pick the resource', 'Set first study session', 'Define the goal'],
  },
  travel: {
    quickActions: ['Add booking', 'Invite person', 'Save place'],
    metrics: [{ label: 'Budget', unit: '' }, { label: 'Dates', unit: '' }, { label: 'Travellers', unit: '' }],
    nextSteps: ['Pick dates', 'Book flights', 'Book accommodation'],
  },
  services: {
    quickActions: ['Get quote', 'Schedule visit', 'Upload document'],
    metrics: [{ label: 'Status', unit: '' }, { label: 'Cost', unit: '' }],
    nextSteps: ['Get 3 quotes', 'Pick a provider', 'Schedule the work'],
  },
};

function pickTag(tags?: string[]): TagId {
  if (tags) {
    for (const t of tags) {
      const norm = t.toLowerCase().trim() as TagId;
      if (VALID_TAGS.includes(norm)) return norm;
    }
  }
  return 'health';
}

function buildSteps(
  titles: string[] | undefined,
  fallback: string[] | undefined,
): UnitStep[] {
  // Merge AI's suggestions with the tag's domain defaults so even a
  // bare title yields a populated unit. Floor: 3 steps, ceiling: 8.
  const merged = [...(titles ?? [])];
  if (merged.length < 3 && fallback) {
    for (const f of fallback) {
      if (merged.length >= 3) break;
      if (!merged.find((t) => t.toLowerCase() === f.toLowerCase())) merged.push(f);
    }
  }
  return merged.slice(0, 8).map((title, i) => ({
    id: `ns_${Date.now()}_${i}`,
    title: title.trim(),
    done: false,
  }));
}

function buildMetrics(
  fromAi: NonNullable<OneIntent['process']>['metrics'],
  fallback: Array<{ label: string; unit?: string }> | undefined,
): UnitMetric[] {
  // Aim for 3 metrics minimum — the unit card looks empty otherwise.
  const merged = [...(fromAi ?? [])];
  if (merged.length < 3 && fallback) {
    for (const f of fallback) {
      if (merged.length >= 3) break;
      if (!merged.find((m) => m.label.toLowerCase() === f.label.toLowerCase())) {
        merged.push(f);
      }
    }
  }
  return merged.slice(0, 6).map((m, i) => {
    // ONE's starting estimate, when it gave one — so the card opens with a
    // REAL answer (typical cost / duration), not a blank. Em-dash only when
    // ONE genuinely left it open. (`fallback` entries carry no value.)
    const aiValue = 'value' in m ? (m as { value?: string }).value?.trim() : undefined;
    return {
      id: `m_${Date.now()}_${i}`,
      label: m.label.trim(),
      value: aiValue || '—',
      unit: m.unit?.trim() || undefined,
    };
  });
}

function buildQuickActions(
  fromAi: string[] | undefined,
  fallback: string[] | undefined,
): UnitQuickAction[] {
  const merged = [...(fromAi ?? [])];
  if (merged.length < 3 && fallback) {
    for (const f of fallback) {
      if (merged.length >= 4) break;
      if (!merged.find((a) => a.toLowerCase() === f.toLowerCase())) merged.push(f);
    }
  }
  return merged.slice(0, 4).map((label, i) => ({
    id: `qa_${Date.now()}_${i}`,
    label: label.trim(),
    actionType: label.toLowerCase().replace(/\s+/g, '_'),
  }));
}

/**
 * Build a Unit from a `OneIntent.process` payload.
 * Returns null if the payload doesn't contain a usable process (no title).
 */
export function unitFromIntent(
  intent: OneIntent,
  identityId: string,
  lang: 'he' | 'en' = 'en',
): Unit | null {
  const p = intent.process;
  if (!p?.title?.trim()) return null;

  const tag = pickTag(p.tags);
  const defaults = TAG_DEFAULTS[tag] ?? {};
  // Fallback status line when the model gave no broadcast — refinement-oriented
  // and language-aware (was a hardcoded English "Just started — what is first?").
  const broadcast =
    p.broadcast?.trim() ||
    (lang === 'he'
      ? 'רגע להתחלה — מה הכי חשוב שנדייק קודם?'
      : "Fresh start — what matters most to nail down first?");
  const ts = nowIso();
  const id = uniqueId('unit');
  const broadcastType: UnitBroadcastType = 'event';

  // The title must be clean text — the emoji lives in its own slot. If the
  // model baked an emoji into the name (against the prompt) we strip it, and
  // if it gave us NO separate emoji we lift the stray one out of the title.
  const rawTitle = p.title.trim();
  const cleanTitle = stripEmoji(rawTitle) || rawTitle;
  const emoji = p.emoji?.trim() || firstEmoji(rawTitle) || '✨';

  return {
    id,
    identityId,
    title: cleanTitle,
    emoji,
    tagIds: [tag],
    color: TAG_COLORS[tag],
    broadcast: [
      {
        id: `b_${id}_1`,
        text: broadcast,
        priority: 80,
        type: broadcastType,
        createdAt: ts,
      },
    ],
    latestBroadcastText: [broadcast],
    lastUpdatedAt: ts,
    unreadUpdates: 1,
    visibility: 'private',
    nextSteps: buildSteps(p.nextSteps, defaults.nextSteps),
    metrics: buildMetrics(p.metrics, defaults.metrics),
    quickActions: buildQuickActions(p.quickActions, defaults.quickActions),
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Compose ONE's FIRST in-process message after a process is created.
 *
 * The hand-off from the home chat used to seed the unit's conversation
 * with the model's terse create acknowledgement ("I'll set up a process
 * for…") — which reads like a system notice, not a reply. Instead we
 * open with a real answer: ONE names the process it built and lays out
 * the concrete first steps it already lined up, then invites the user to
 * pick where to start. Built from the ENRICHED unit so it always has
 * substance, regardless of how thin the model's own reply was.
 *
 * Phrasing is gender-neutral in Hebrew (no second-person gendered verbs)
 * so it reads naturally whether or not ONE knows the user's gender.
 */
export function buildProcessOpener(unit: Unit, lang: 'he' | 'en'): string {
  const he = lang === 'he';
  // Don't announce "I set up X for you" + a steps dump (the steps live in the
  // profile). Open by REFINING: name the process, then ask the concrete
  // question that starts turning the intent into something real.
  if (he) {
    return (
      `בוא נדייק את «${unit.title}» ${unit.emoji} ונהפוך את זה למשהו מוחשי.\n` +
      `כדי לכוון נכון — מה היעד המדויק שאתה רוצה להגיע אליו, ועד מתי?`
    );
  }
  return (
    `Let's sharpen “${unit.title}” ${unit.emoji} and turn it into something real.\n` +
    `So I aim it right — what's the exact outcome you want, and by when?`
  );
}
