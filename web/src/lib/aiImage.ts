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

/**
 * A FREE, no-cost stock image for a topic — a Creative-Commons photo from
 * Openverse (openaccess, no API key). Used as a cover when paid generation is
 * off, before falling back to Wikipedia. Returns a hotlinkable URL or null.
 */
export async function freeStockImage(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q || typeof fetch === "undefined") return null;
  try {
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&mature=false&page_size=3`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { results?: { url?: string; thumbnail?: string }[] };
    const hit = (d.results ?? []).find((x) => x.thumbnail || x.url);
    return hit?.thumbnail || hit?.url || null;
  } catch {
    return null;
  }
}

/**
 * Upload YOUR OWN image (as a validator/curator) to the public `unit-images`
 * bucket and get back a permanent public URL — so you can create images with
 * your own tools and put them on a unit instead of paying for generation.
 */
export async function uploadUnitImage(file: Blob, key: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const type = file.type || "image/png";
    const ext = (type.split("/")[1] || "png").replace("jpeg", "jpg").split("+")[0];
    const slug = key.replace(/[^a-z0-9]+/gi, "-").slice(0, 48).toLowerCase() || "img";
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `uploads/${slug}-${rand}.${ext}`;
    const { error } = await client.storage
      .from("unit-images")
      .upload(path, file, { contentType: type, upsert: true });
    if (error) return null;
    const { data } = client.storage.from("unit-images").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}
