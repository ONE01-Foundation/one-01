import { getSupabase } from "./supabase";

export interface WebCitation {
  url: string;
  title: string;
}
export interface WebSearchResult {
  text: string;
  citations: WebCitation[];
}

/**
 * Ask ONE's research engine for live web info. Runs the query through the
 * `web-search` edge function (OpenAI Responses + web_search tool), so the answer
 * reflects the CURRENT internet and comes back with source links. Returns null
 * if search isn't available — callers degrade to ONE's ordinary answer.
 */
export async function searchWeb(
  query: string,
  lang: "en" | "he" = "en",
): Promise<WebSearchResult | null> {
  const client = getSupabase();
  if (!client) return null;
  const q = query.trim();
  if (!q) return null;
  try {
    const { data, error } = await client.functions.invoke("web-search", {
      body: { query: q, lang },
    });
    if (error) return null;
    const text = (data as { text?: string } | null)?.text;
    if (typeof text !== "string" || !text.trim()) return null;
    const citations = ((data as { citations?: WebCitation[] } | null)?.citations ?? []).filter(
      (c) => c && typeof c.url === "string",
    );
    return { text: text.trim(), citations };
  } catch {
    return null;
  }
}
