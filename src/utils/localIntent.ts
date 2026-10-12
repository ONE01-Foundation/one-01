/**
 * localIntent — a deterministic, offline "ONE brain" that classifies a chat
 * message into the SAME intent shape the AI returns, using Hebrew + English
 * heuristics. It's the fallback whenever `invokeOneIntent` can't be reached
 * (no network, not signed in, or a blocked edge function), so the core flow —
 * ONE generating a process or a draft right in the conversation — keeps working
 * everywhere instead of silently doing nothing.
 *
 * Scope on purpose: the two VISIBLE "ONE made something" moments — create a
 * process, and draft an outward message — plus reminders; everything else is a
 * normal chat reply. The real AI stays the primary brain when it's reachable.
 */

import type { OneIntent } from '../services/aiChat';

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** Natural-language "when" as the user said it, for a reminder. */
function extractWhen(text: string): string | undefined {
  const m = text.match(
    /(מחר בבוקר|מחרתיים|מחר|היום|הערב|בעוד \S+|ביום \S+|בשעה \S+|ב-?\d{1,2}(:\d{2})?|tomorrow morning|tomorrow|tonight|today|next \w+|on \w+day|at \d{1,2}(:\d{2})?\s?(am|pm)?|in \d+ \w+)/i,
  );
  return m ? m[0].trim() : undefined;
}

/** Who the message is to — the span after "ל"/"to" following the write verb. */
function extractRecipient(text: string, he: boolean): string | undefined {
  if (he) {
    // "כתוב לשרה ש…" / "תשלח לדני מייל" → ל<name>
    const m = text.match(/(?:כתוב|תכתוב|נסח|תנסח|שלח|תשלח|תכין (?:הודעה|מייל))\s+ל([֐-׿\w'"-]+)/);
    if (m) return m[1].trim();
  } else {
    const m = text.match(/\bto\s+(?:the\s+)?([a-z][\w'"-]*(?:\s+[a-z][\w'"-]*)?)/i);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** A plausible, editable message body built from what the user described —
 *  the content after "ש…"/"that…", wrapped as a real note to the recipient.
 *  NOTE: JS `\b` is ASCII-only, so it does NOT fire around Hebrew letters —
 *  Hebrew extraction uses (start|space) anchors instead. */
function buildLocalDraftBody(text: string, to: string | undefined, he: boolean): string {
  let content = '';
  if (he) {
    // Prefer the clause after "ש" ("…that I'll be late"); else strip the
    // leading command ("כתוב לדני …") so the recipient/verb don't leak in.
    const after = text.match(/(?:^|\s)ש(\S.*)$/);
    content = (
      after
        ? after[1]
        : text.replace(/^.*?(?:כתוב|תכתוב|נסח|תנסח|שלח|תשלח|תכין(?:\s+(?:הודעה|מייל))?)\s+(?:ל\S+\s+)?/, '')
    ).trim();
  } else {
    const m = text.match(/\bthat\s+(.+)$/i);
    content = (m ? m[1] : text).replace(/^(write|draft|send|email|message|a note|to [^,]+,?)\s*/i, '').trim();
  }
  if (!content) content = text.trim();
  const greet = he ? (to ? `היי ${to},` : 'היי,') : to ? `Hi ${to},` : 'Hi,';
  return `${greet}\n${content}`;
}

/** A short, natural question to fill a metric by its label — ONE asks for one
 *  detail at a time so the process gets built through the conversation. */
export function metricQuestion(label: string, he: boolean): string {
  const l = label.trim();
  return he ? `ומה לגבי ${l}?` : `And what about ${l}?`;
}

/** Strip intention prefixes ("אני רוצה ל…", "I want to…") and truncate, so a
 *  new process reads as a short name, not the whole sentence. */
export function cleanProcessTitle(text: string, heParam: boolean): string {
  let t = text.trim();
  // Content-aware: a Hebrew sentence gets Hebrew cleaning even if the app's UI
  // language is English (the title IS the user's words).
  const he = heParam || hasHebrew(text);
  if (he) {
    // Strip the "אני רוצה / צריך …" lead-in; KEEP the infinitive ל (ללמוד,
    // לתכנן) — stripping it mangles the verb.
    t = t.replace(/^(אני\s+)?(רוצה|צריך|מעוניינ[הת]?|מתכננ[הת]?|חייב[ת]?)\s+/, '').trim();
  } else {
    t = t.replace(/^(i\s+)?(want|wanna|need|would like|plan|planning|intend)\s+(to\s+)?/i, '').trim();
  }
  const words = t.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  return words || text.trim();
}

export interface LocalIntentCtx {
  lang: 'he' | 'en';
}

/** Classify a message into an OneIntent using heuristics. For create_process /
 *  chat the `reply`/`process` are left for the caller to compose (it already
 *  owns the unit builder + reply generator); reminder/draft are filled here. */
export function localOneIntent(value: string, ctx: LocalIntentCtx): OneIntent {
  const text = value.trim();
  const he = ctx.lang === 'he' || hasHebrew(text);

  // 1) Reminder — "תזכיר לי…" / "remind me…".
  if (/תזכיר\s*לי|תזכורת|remind me|reminder\b|don'?t let me forget/i.test(text)) {
    const body = text
      .replace(/^.*?(תזכיר\s*לי( ל)?|תזכורת[:,]?|remind me( to)?|please remind me( to)?)[:,]?\s*/i, '')
      .trim();
    return {
      kind: 'add_reminder',
      reply: he ? 'קבעתי תזכורת 🔔' : 'Set a reminder 🔔',
      reminder: { text: body || text, when: extractWhen(text) },
    };
  }

  // 2) Draft a message — "כתוב ל…" / "נסח…" / "write to…" / "email…".
  if (
    /כתוב\s+ל|תכתוב\s+ל|נסח|תנסח|תשלח\s+ל|שלח\s+ל|תכין\s+(הודעה|מייל)|write\s+(a\s+)?(message|email|note|text)|draft\b|send\s+.*\bto\b|email\s+(the\s+)?\w/i.test(
      text,
    )
  ) {
    const to = extractRecipient(text, he);
    const channel: NonNullable<OneIntent['draft']>['channel'] = /מייל|email/i.test(text)
      ? 'email'
      : /sms|הודעת טקסט/i.test(text)
        ? 'sms'
        : 'whatsapp';
    return {
      kind: 'draft_message',
      reply: he ? 'הכנתי טיוטה — תבדוק, תערוך ושלח.' : 'Drafted it — review, edit, and send.',
      draft: { channel, to, body: buildLocalDraftBody(text, to, he) },
    };
  }

  // 3) Create a process — an intention verb, or a substantial non-question
  //    statement (a want/plan the user is voicing, not a question to answer).
  const intentionVerb = he
    ? /רוצה|צריך|מתכנן|תכנן|קבע|תקבע|לקבוע|לתאם|תתאם|תזמן|תארגן|לארגן|תנהל|נהל|להתחיל|תכין|לבנות|לחפש|למצוא|לסדר/.test(
        text,
      )
    : /\b(i\s+)?(want|wanna|need|plan(ning)?|book|schedule|arrange|organi[sz]e|manage|start|build|find|look\s+for|set\s+up|prepare|sort\s+out)\b/i.test(
        text,
      );
  const isQuestion =
    /[?？]/.test(text) ||
    /^(מה|איך|למה|מתי|איפה|האם|כמה|מי)\b/.test(text) ||
    /^(what|how|why|when|where|who|which|is|are|do|does|can|could|should|would)\b/i.test(text);
  if (intentionVerb || (text.length > 18 && !isQuestion)) {
    // Caller builds the unit (desireToUnit + archetype) and the reply.
    return { kind: 'create_process', reply: '' };
  }

  // 4) Plain chat — caller composes the reply via generateOneReply.
  return { kind: 'chat', reply: '' };
}
