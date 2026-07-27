import { getSupabase } from "./supabase";
import type { Process } from "./mockData";

// A canonical unit living in Global — built once, forked by anyone. This is the
// "TikTok sound / Wikipedia page" model: pull an existing one instantly, or your
// own becomes the canonical entry others pull. `uses` is the Global aggregate.
export interface GlobalUnit {
  id: string;
  topic_key: string;
  title: string;
  emoji: string;
  type: string | null;
  lang: string;
  steps: { label: string }[];
  metrics: { label: string; value: string }[];
  insights: string[];
  next_action: string | null;
  cover_image: string | null;
  uses: number;
}

/** Stable canonical key for a topic (matches the ai-image stock key style). */
export function unitTopicKey(p: { type?: string; title: string }): string {
  return `${(p.type ?? "").toLowerCase()}:${p.title.trim().toLowerCase()}`;
}

/** Publish (or enrich) a unit as the canonical Global entry for its topic. */
export async function publishGlobalUnit(p: Process): Promise<void> {
  const client = getSupabase();
  if (!client || !p.title.trim()) return;
  try {
    await client.rpc("publish_global_unit", {
      p_topic_key: unitTopicKey(p),
      p_title: p.title,
      p_emoji: p.emoji,
      p_type: p.type ?? null,
      p_lang: /[֐-׿]/.test(p.title) ? "he" : "en",
      p_steps: p.steps.map((s) => ({ label: s.label })),
      p_metrics: p.metrics ?? [],
      p_insights: p.insights ?? [],
      p_next_action: p.nextAction ?? null,
      p_cover_image: p.coverImage ?? null,
    });
  } catch {
    /* best-effort — Global publish never blocks the local flow */
  }
}

/** Search the Global library (empty query → top units by usage). */
export async function searchGlobalUnits(q: string): Promise<GlobalUnit[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client.rpc("search_global_units", { p_q: q, p_limit: 12 });
    if (error || !Array.isArray(data)) return [];
    return data as GlobalUnit[];
  } catch {
    return [];
  }
}

/** Pull a canonical unit — bumps its aggregate `uses` and returns its data. */
export async function forkGlobalUnit(id: string): Promise<GlobalUnit | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("fork_global_unit", { p_id: id });
    if (error) return null;
    return ((Array.isArray(data) ? data[0] : data) as GlobalUnit) ?? null;
  } catch {
    return null;
  }
}
