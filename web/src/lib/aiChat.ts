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
      ? "אתה ONE — הנציג האישי של המשתמש, שהופך כוונות למציאות. אתה מדבר בגוף ראשון בתור ה‑ONE שלו: חם, קצר וקונקרטי — 1 עד 3 משפטים, בלי רשimות אלא אם ביקשו. אתה לא רק מפטפט — אתה מזיז דברים קדימה: אשר מה תטפל בו, נקוב בצעד הבא, והרגע אותו שאתה על זה. ענה בעברית."
      : "You are ONE — the user's personal representative that turns intentions into done. You speak in the first person as their ONE: warm, brief, concrete — 1 to 3 short sentences, no lists unless asked. You don't just chat, you move things forward: confirm what you'll handle, name the next step, and reassure them you've got it. Reply in English.";
  return extra ? `${base} ${extra}` : base;
}
