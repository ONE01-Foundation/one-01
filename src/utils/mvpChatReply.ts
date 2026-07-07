/**
 * Chat reply generator — calls the `ai-chat` Supabase Edge Function
 * when a session exists, falls back to a local heuristic otherwise so
 * the app keeps working offline / pre-sign-in.
 *
 * Both `generateUnitReply` and `generateOneReply` are now async. The
 * sync heuristic implementations are kept as private fallbacks under
 * `localUnitReply` / `localOneReply`.
 */

import type { Unit } from '../core/mvp/types';
import {
  invokeAiChat,
  pickOneSystemPrompt,
  type AiChatMessage,
} from '../services/aiChat';
import { analyzeUnit } from './processIntelligence';

type Lang = 'en' | 'he';

interface UnitContext {
  unit: Unit;
  /** Active language — so the OFFLINE fallback replies match the app's
   *  Hebrew-first voice instead of always answering in English. */
  lang?: Lang;
}

interface OneContext {
  /** active identity display name (e.g. "Ariel"). */
  identityName?: string;
  unitsCount?: number;
  /** Active language for the offline fallback voice. */
  lang?: Lang;
}

// pick — choose one line from a pool, biased by input length so the same
// input doesn't flip on every send (which would feel jittery) but two
// different inputs in a row don't get the same line back-to-back.
function pick(pool: readonly string[], seed: string): string {
  if (pool.length === 0) return '';
  if (pool.length === 1) return pool[0];
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  return pool[Math.abs(h) % pool.length];
}

// ─── Process chat (inside a Unit) ────────────────────────────────────────────

/**
 * Try the AI first; on any failure (no session, network, function error)
 * fall back to the local heuristic so the chat always replies with
 * something sensible. Optional `history` lets callers pass the prior
 * conversation so the AI has context.
 */
export async function generateUnitReply(
  input: string,
  ctx: UnitContext,
  history: AiChatMessage[] = [],
): Promise<string> {
  try {
    const sys = pickOneSystemPrompt(input);
    const unitContext = `Active process: ${ctx.unit.emoji} ${ctx.unit.title}.
Latest update: ${ctx.unit.latestBroadcastText[0] ?? '—'}.
Open next steps: ${(ctx.unit.nextSteps ?? []).filter((s) => !s.done).slice(0, 3).map((s) => '- ' + s.title).join('\n') || 'none'}.`;
    const messages: AiChatMessage[] = [
      { role: 'system', content: sys + '\n\n' + unitContext },
      ...history.slice(-6),
      { role: 'user', content: input },
    ];
    return await invokeAiChat(messages, { maxTokens: 180 });
  } catch (e) {
    console.warn('[generateUnitReply] AI call failed, falling back to local:', e);
    return localUnitReply(input, ctx);
  }
}

function localUnitReply(input: string, ctx: UnitContext): string {
  const text = input.trim();
  const lower = text.toLowerCase();
  const { unit } = ctx;
  const he = ctx.lang === 'he';

  if (!text) return he ? 'ספר לי מה השתנה.' : 'Tell me what changed.';

  const firstOpen = unit.nextSteps?.find((s) => !s.done);
  // ONE's live read on THIS process — reused for status / "what now" answers so
  // the offline reply still sounds like it actually knows where things stand.
  const focus = analyzeUnit(unit, Date.now(), he ? 'he' : 'en');

  // ── Acknowledgements (he + en) ──────────────────────────────────────────
  if (/^(ok|okay|yes|yeah|yep|done|good|👍|✓|sure)\b/.test(lower) || /^(כן|סבבה|אוקיי|בוצע|יאללה|מעולה|טוב)\b/.test(text)) {
    if (firstOpen) {
      return he
        ? `יופי. אז הצעד הבא הוא "${firstOpen.title}" — נצא לזה?`
        : `Great. So the next move is "${firstOpen.title}" — shall we?`;
    }
    return he ? 'רשמתי קדימה. מה המהלך הבא?' : "Marked it forward. What's the next move?";
  }
  if (/^(no|not yet|nope|cancel)\b/.test(lower) || /^(לא|עוד לא|בטל|לא עכשיו)\b/.test(text)) {
    return he
      ? 'הבנתי — נשאיר את זה בצד. שאזכיר לך מאוחר יותר?'
      : "Got it — we'll hold off. Want me to nudge you later?";
  }

  // ── Questions (he uses ? too; also catch Hebrew question words) ─────────
  const isQuestion = text.includes('?') || /\b(מה|מתי|איפה|כמה|האם|למה|איך)\b/.test(text);
  if (isQuestion) {
    // Status / progress / "where are we" → speak ONE's read.
    if (/progress|how'?s|where|status|going/.test(lower) || /(איפה|מצב|התקדמ|כמה נשאר|מה קורה)/.test(text)) {
      return `${focus.headline} ${focus.reason}`.trim();
    }
    if (/when|time|schedule|deadline/.test(lower) || /(מתי|מועד|דדליין|לו"?ז)/.test(text)) {
      const dueStep = (unit.nextSteps ?? []).find((s) => !s.done && s.dueAt);
      if (dueStep?.dueAt) {
        return he
          ? `לפי מה שרשום, "${dueStep.title}" אמור להיסגר בקרוב. שנתכונן אליו?`
          : `From what's logged, "${dueStep.title}" is due soon. Want to get ahead of it?`;
      }
      return he ? `אין מועד קשיח על ${unit.title} כרגע. לקבוע אחד?` : `No hard deadline on ${unit.title} yet. Want to set one?`;
    }
    if (/(next|what now|what should)/.test(lower) || /(הצעד הבא|מה עכשיו|מה כדאי)/.test(text)) {
      return firstOpen
        ? he ? `הייתי מתחיל מ־"${firstOpen.title}".` : `I'd start with "${firstOpen.title}".`
        : he ? 'אין צעד פתוח כרגע — רוצה להוסיף אחד?' : 'No open step right now — want to add one?';
    }
    // Generic question — answer from the read, not a shrug.
    return he
      ? `${focus.headline} מה תרצה לדעת יותר לעומק?`
      : `${focus.headline} What would you like to dig into?`;
  }

  // ── Scheduling / time → a reminder-shaped ack ───────────────────────────
  if (/(tomorrow|today|tonight|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\bam\b|\bpm\b|\d{1,2}:\d{2})/.test(lower) || /(מחר|היום|הערב|השבוע|שבוע הבא|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|בשעה)/.test(text)) {
    return he
      ? `רשמתי על ציר הזמן של ${unit.title}. אזכיר לך קצת לפני.`
      : `Noted — added to the timeline of ${unit.title}. I'll remind you a bit before.`;
  }

  // ── People / messaging ──────────────────────────────────────────────────
  if (/\b(call|text|message|email|send|tell)\b/.test(lower) || /(תתקשר|תשלח|תודיע|הודעה|מייל|תכתוב ל)/.test(text)) {
    return he ? 'אני מנסח הודעה — למי היא מיועדת?' : 'Drafting a message — who should it go to?';
  }

  // ── Money / payment ─────────────────────────────────────────────────────
  if (/(pay|paid|cost|price|invoice|receipt|\$|₪)/.test(lower) || /(שילמ|תשלום|עלות|מחיר|חשבונית|קבלה|שקל)/.test(text)) {
    return he ? `רשמתי ל-${unit.title}. לצרף קבלה?` : `Logged against ${unit.title}. Want me to attach a receipt?`;
  }

  // ── File / document ─────────────────────────────────────────────────────
  if (/(file|doc|document|pdf|photo|image|attach)/.test(lower) || /(קובץ|מסמך|תמונה|צרף|העלה)/.test(text)) {
    return he ? `מעולה — שלח קישור או קובץ ואצרף אותו ל-${unit.title}.` : `Got it — link or upload it and I'll attach it to ${unit.title}.`;
  }

  // ── Finished signals ────────────────────────────────────────────────────
  if (/(finished|complete|completed|wrapped)/.test(lower) || /(סיימתי|גמרתי|הושלם|נסגר)/.test(text)) {
    return he ? `יפה. לסגור את ${unit.title} או להשאיר פתוח?` : `Nice. Want me to close out ${unit.title} or keep it open?`;
  }

  // ── Default — substance, referencing the process by name ────────────────
  if (text.length > 80) {
    return pick(
      he
        ? [
            `רשמתי. הוספתי את זה להיסטוריה של ${unit.title}.`,
            `נשמר ל-${unit.title}. אקח את זה בחשבון.`,
            `קיבלתי. ${unit.title} כבר משקף את זה.`,
          ]
        : [
            `Captured. I added that to ${unit.title}'s history.`,
            `Logged against ${unit.title}. I'll factor it in.`,
            `Saved. ${unit.title} now reflects that.`,
          ],
      text,
    );
  }
  if (text.length > 20) {
    return pick(
      he
        ? [`רשמתי על ${unit.title}. עוד משהו שכדאי שאדע?`, `קיבלתי. מה עוד?`]
        : [`Got it. Anything else I should know about ${unit.title}?`, `Noted on ${unit.title}. What else?`],
      text,
    );
  }
  return pick(he ? [`רשמתי.`, `קיבלתי.`, `נשמר.`] : [`Noted.`, `Got it.`, `Saved.`], text);
}

// ─── General ONE chat (outside any Unit) ─────────────────────────────────────

export async function generateOneReply(
  input: string,
  ctx: OneContext = {},
  history: AiChatMessage[] = [],
): Promise<string> {
  try {
    const sys = pickOneSystemPrompt(input);
    const persona = ctx.identityName
      ? `User's active identity name: ${ctx.identityName}.`
      : '';
    const activity = ctx.unitsCount
      ? `Active processes count: ${ctx.unitsCount}.`
      : 'No active processes yet.';
    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content: [sys, persona, activity].filter(Boolean).join('\n\n'),
      },
      ...history.slice(-6),
      { role: 'user', content: input },
    ];
    return await invokeAiChat(messages, { maxTokens: 180 });
  } catch (e) {
    console.warn('[generateOneReply] AI call failed, falling back to local:', e);
    return localOneReply(input, ctx);
  }
}

function localOneReply(input: string, ctx: OneContext = {}): string {
  const text = input.trim();
  const lower = text.toLowerCase();
  const he = ctx.lang === 'he';
  const who = ctx.identityName ?? (he ? '' : 'you');

  if (!text) return he ? 'ספר לי מה חשוב.' : 'Tell me what matters.';

  // Direct echo of one of the suggestion prompts → deflect back to user
  // rather than treating them as intentions.
  if (/what do you want to move forward/.test(lower) || /מה הדבר שהיית רוצה לקדם/.test(text)) {
    return he ? 'זה תלוי בך. מה על הראש כרגע?' : `That's up to you. Anything on your mind right now?`;
  }
  if (/tell me what'?s on your mind/.test(lower) || /מה על הראש/.test(text)) {
    return he ? 'אני כאן. מה הדבר הראשון?' : `I'm here. What's the first thing?`;
  }
  if (/want to start a new process/.test(lower) || /להתחיל תהליך חדש/.test(text)) {
    return he ? 'בכיף — תאר את זה במשפט אחד ואני מקים.' : `Yes — describe it in one sentence and I'll set it up.`;
  }

  // Help / what can you do
  if (/(help|what can|capabilities|features|do you)/.test(lower) || /(עזור|מה אתה יודע|מה אתה יכול|יכולות)/.test(text)) {
    return he
      ? 'אני הופך משפט אחד לתהליך, מחזיק את ההקשר ביניהם, וצף לך את הצעד הבא. נסה: "אני רוצה לעלות במשקל" או "עזור לי לתכנן טיול".'
      : `I can turn one sentence into a process, hold context across them, and surface the next step. Try: "I want to gain weight" or "Help me plan a trip".`;
  }

  // Switch identity
  if (/(switch|change|other identity|business|personal|family|account)/.test(lower) || /(החלף|זהות|עסק|משפחה|חשבון)/.test(text)) {
    return he ? 'לחיצה ארוכה על הפרצוף שלי מחליפה זהות. לקחת אותך לשם?' : `You can long-press the orb to switch identities. Want me to take you there?`;
  }

  // What's on my plate
  if (/(plate|going on|today|happening|update|status)/.test(lower) || /(מה קורה|מה יש לי|היום|עדכון|מצב)/.test(text)) {
    const n = ctx.unitsCount ?? 0;
    if (he) {
      return n
        ? `יש ${n} תהליכים בתנועה. לעבור עליהם ביחד?`
        : 'אין כרגע שום דבר פעיל. מה בא לך להתחיל?';
    }
    return n
      ? `${who} has ${n} active process${n === 1 ? '' : 'es'} moving. Want me to walk through them?`
      : `Nothing active right now. What do you want to start?`;
  }

  // Greetings
  if (/^(hi|hello|hey|shalom|sup|good (morning|evening|afternoon))/.test(lower) || /^(שלום|היי|היי|אהלן|בוקר טוב|ערב טוב|צהריים טובים)/.test(text)) {
    return pick(
      he
        ? [`היי${who ? ' ' + who : ''}. מה ראשון?`, `אהלן${who ? ' ' + who : ''}. מה מקדמים היום?`, `היי. אני מוכן כשתהיה.`]
        : [`Hi ${who}. What's first?`, `Hey ${who}. What are we moving today?`, `Hi. I'm ready when you are.`],
      text,
    );
  }

  // Intentions — suggest creating a process
  if (/(i want|i need|i'm going to|planning|let's)/.test(lower) || /(אני רוצה|אני צריך|בא לי|מתכנן|תכנן|בוא נ)/.test(text) || text.length > 30) {
    return pick(
      he
        ? [`נשמע כמו תהליך. להקים אותו?`, `אני יכול לשאת את זה. לפתוח תהליך?`, `בוא נהפוך את זה לתהליך — אשר ואני מתחיל.`]
        : [`Sounds like a process. Want me to set it up?`, `I can carry that. Should I open a process for it?`, `Let's turn that into a process. Confirm and I'll start.`],
      text,
    );
  }

  // Short
  if (text.length < 10) {
    return pick(
      he
        ? [`ספר לי עוד קצת.`, `תמשיך — מה ההמשך?`, `אני מקשיב.`]
        : [`Tell me a bit more.`, `Keep going — what's the rest?`, `I'm listening.`],
      text,
    );
  }

  return pick(
    he
      ? [`קיבלתי. איך אני יכול לעזור עם זה?`, `רשמתי. מה תרצה שאעשה עכשיו?`, `שמעתי. שאפעל על זה או רק אחזיק?`]
      : [`Got it. How can I help with that?`, `Noted. What do you want me to do next?`, `Heard. Want me to act on it or just hold it?`],
    text,
  );
}
