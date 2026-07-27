"use client";

/**
 * aiChat — thin browser client for the `ai-chat` Supabase Edge Function, the
 * same one the mobile app uses (supabase/functions/ai-chat/index.ts).
 *
 *   POST /functions/v1/ai-chat
 *   body:   { messages, model?, temperature?, max_tokens? }
 *   returns { text, model, usage }
 *
 * The function accepts anon-key calls (no user session required), so ONE can
 * think before the user has signed in. Every caller wraps this in try/catch
 * and falls back to the local `oneBrain` heuristic, so the product keeps
 * working offline / when the env vars or network are unavailable.
 */

import { getSupabase } from "./supabase";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  model?: string;
  temperature?: number;
  /** Cap completion length — short replies feel snappier in a chat UI. */
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Call the ai-chat Edge Function and return ONE's reply text. Throws on a
 * missing client, a transport error, or an empty completion so the caller can
 * fall back to the local brain.
 */
export async function invokeAiChat(
  messages: AiChatMessage[],
  options: AiChatOptions = {},
): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error("ai-chat: Supabase client not configured");

  const { data, error } = await client.functions.invoke("ai-chat", {
    body: {
      messages,
      model: options.model ?? "gpt-4o-mini",
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 240,
    },
  });
  if (error) throw error;

  const text = (data as { text?: string } | null)?.text?.trim();
  if (!text) throw new Error("ai-chat: empty completion");
  return text;
}

/**
 * ONE's voice. Kept short so replies stay in character and concise. `extra`
 * lets the caller graft in live context (e.g. the process it just opened).
 */
export function oneSystemPrompt(lang: "en" | "he", extra?: string): string {
  const base =
    lang === "he"
      ? "אתה ONE — הנציג האישי של המשתמש, שהופך כוונות למציאות. אתה מדבר בגוף ראשון בתור ה‑ONE שלו: חם, קצר וקונקרטי — 1 עד 3 משפטים, בלי רשימות אלא אם ביקשו. חשוב: אם שאלו אותך שאלה עובדתית (כמה זמן, כמה עולה, מה צריך, איך) — תן קודם את התשובה האמיתית מהידע שלך, כולל מספר/טווח/רשימת מסמכים קונקרטית, ורק אז הצע את הצעד הבא. אל תגיד 'אני אבדוק ואחזור' כשאתה יודע את התשובה. אתה לא רק מפטפט — אתה מזיז קדימה: אשר מה תטפל בו, נקוב בצעד הבא הקונקרטי, ושאל לכל היותר שאלה חדה אחת אם חסר לך פרט קריטי. לעולם אל תמציא עובדות; אם אתה לא בטוח, אמור זאת בקצרה."
      : "You are ONE — the user's personal representative that turns intentions into done. You speak in the first person as their ONE: warm, brief, concrete — 1 to 3 short sentences, no lists unless asked. Important: if asked a factual question (how long, how much, what's needed, how) give the real answer from your knowledge first — a concrete number/range/document list — and only then propose the next step. Never say 'I'll check and get back to you' when you actually know. You don't just chat, you move things forward: confirm what you'll handle, name the concrete next step, and ask at most one sharp question if a critical detail is missing. Never invent facts; if unsure, say so briefly.";
  // Mirror the user's language on every message — Hebrew, English, or anything
  // else — regardless of the app's UI language.
  const mirror =
    lang === "he"
      ? "תמיד ענה באותה שפה שבה המשתמש כתב את ההודעה האחרונה (עברית, אנגלית או כל שפה אחרת)."
      : "Always reply in the same language the user wrote their latest message in (Hebrew, English, or any other language).";
  return extra ? `${base} ${mirror} ${extra}` : `${base} ${mirror}`;
}
