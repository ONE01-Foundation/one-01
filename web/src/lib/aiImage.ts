import { getSupabase } from "./supabase";

/**
 * Generate (or reuse) a contextual image for a unit / step via the `ai-image`
 * edge function. The function keys the result by `key` and stores it as stock,
 * so the same topic is generated ONCE and then reused instantly by everyone.
 * Returns a permanent public URL, or null if generation isn't available.
 */
export async function generateImage(prompt: string, key?: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke("ai-image", {
      body: { prompt, key },
    });
    if (error) return null;
    const url = (data as { url?: string } | null)?.url;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
}
