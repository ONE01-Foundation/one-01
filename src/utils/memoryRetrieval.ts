/**
 * memoryRetrieval — simple per-process memory recall, no embeddings.
 *
 * MVP: a fast keyword overlap score across each unit's broadcast text,
 * people, latest chat snippets, and steps. Returns the top K matches so
 * the home-chat path can include them as context for the AI call.
 *
 * Replace with a vector store later — same interface.
 */

import type { Unit } from '../core/mvp/types';
import type { ChatMessageStored } from '../stores/mvpStore';

export interface MemorySnippet {
  unitId: string;
  unitTitle: string;
  unitEmoji: string;
  /** A 1–3 sentence chunk of evidence. */
  text: string;
  /** Stable rank — higher = more relevant. */
  score: number;
}

/** Tokenize: lowercase, strip punctuation, drop tiny words. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Build a relevance score for a candidate document against a query by
 * counting shared distinct tokens. Cheap and predictable.
 */
function overlap(queryTokens: Set<string>, docText: string): number {
  if (queryTokens.size === 0) return 0;
  const docTokens = new Set(tokens(docText));
  let n = 0;
  for (const t of queryTokens) if (docTokens.has(t)) n++;
  return n;
}

/**
 * Search across the user's units + persisted chat history. Returns the
 * top K snippets so the AI can ground its answer.
 *
 * Heuristic for "is this a memory query":
 *   - contains "when" / "what" / "who" / "where" / "did" / Hebrew equiv.
 *   - mentions a past tense / question mark
 * Caller is responsible for deciding whether to invoke this — we just
 * surface evidence.
 */
export function searchMemory(
  query: string,
  args: {
    units: Unit[];
    unitChats: Record<string, ChatMessageStored[]>;
    /** Max snippets returned. Default 5. */
    limit?: number;
  },
): MemorySnippet[] {
  const q = new Set(tokens(query));
  if (q.size === 0) return [];
  const limit = args.limit ?? 5;
  const out: MemorySnippet[] = [];

  for (const u of args.units) {
    // 1. Unit-card text (title + broadcast + people names).
    const cardEvidence = [
      u.title,
      ...(u.latestBroadcastText ?? []),
      ...(u.people?.map((p) => p.name) ?? []),
      ...(u.nextSteps?.map((s) => s.title) ?? []),
    ]
      .filter(Boolean)
      .join(' · ');
    const cardScore = overlap(q, cardEvidence);
    if (cardScore > 0) {
      out.push({
        unitId: u.id,
        unitTitle: u.title,
        unitEmoji: u.emoji,
        text: cardEvidence,
        score: cardScore + 1, // small boost: unit summary is high-signal
      });
    }
    // 2. Chat history — keep last 25 per unit; rank each message.
    const history = args.unitChats[u.id] ?? [];
    for (const m of history.slice(-25)) {
      const s = overlap(q, m.text);
      if (s > 0) {
        out.push({
          unitId: u.id,
          unitTitle: u.title,
          unitEmoji: u.emoji,
          text: `${m.from === 'one' ? 'ONE' : 'You'}: ${m.text}`,
          score: s,
        });
      }
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/**
 * Cheap "is the user asking about the past?" detector. Used to decide
 * whether to spend the cost of retrieval + extra context.
 */
export function looksLikeMemoryQuery(text: string): boolean {
  const t = text.toLowerCase();
  // English: when/what/who/where/did + "?"
  if (
    /\?/.test(t) &&
    /\b(when|what|who|where|did|was|were|why|how|last|remember)\b/.test(t)
  ) {
    return true;
  }
  // Hebrew memory triggers — מה / מתי / מי / איפה / היכן / זוכר / אמרנו / החלטנו
  if (/\?/.test(t) && /(מה|מתי|מי\b|איפה|היכן|זוכר|אמרנו|החלטנו|דיברנו)/.test(t)) {
    return true;
  }
  return false;
}
