import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Generates a contextual image for a unit (or a unit step) with OpenAI, then
// stores it in the public `unit-images` bucket keyed by a stable slug — so the
// SAME topic is generated ONCE and then reused by everyone as canonical "stock"
// (the Global aggregate idea: build a unit's assets once, share the fork).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const BUCKET = 'unit-images'

// Small stable string hash → an ASCII-safe, collision-resistant filename even
// when the prompt/key is Hebrew (Storage object names must be ASCII-friendly).
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

serve(async (req) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) return json({ error: 'AI image service not configured' }, 503)

  try {
    const { prompt, key } = await req.json()
    if (!prompt || typeof prompt !== 'string') return json({ error: 'prompt is required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const stableKey = typeof key === 'string' && key.trim() ? key.trim() : prompt
    const base =
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'unit'
    const path = `${base}-${hash(stableKey)}.png`

    // Already generated for this topic? Return the stored stock URL — no re-gen.
    const { data: listed } = await admin.storage.from(BUCKET).list('', { search: path })
    if (listed && listed.some((f) => f.name === path)) {
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
      return json({ url: pub.publicUrl, cached: true })
    }

    const oai = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'medium', n: 1 }),
    })
    const data = await oai.json()
    if (!oai.ok) {
      console.error('[ai-image] openai error', oai.status, data?.error?.message)
      return json({ error: data?.error?.message ?? 'image generation failed' }, oai.status)
    }
    // The generations endpoint returns a temporary URL; re-host the bytes in our
    // public bucket so the "stock" image is permanent.
    const tmpUrl = data?.data?.[0]?.url as string | undefined
    const b64 = data?.data?.[0]?.b64_json as string | undefined
    let bytes: Uint8Array
    if (b64) {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    } else if (tmpUrl) {
      const imgRes = await fetch(tmpUrl)
      if (!imgRes.ok) return json({ error: 'could not fetch generated image' }, 502)
      bytes = new Uint8Array(await imgRes.arrayBuffer())
    } else {
      return json({ error: 'no image returned' }, 502)
    }
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (upErr) return json({ error: upErr.message }, 500)

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    console.log('[ai-image] generated', path)
    return json({ url: pub.publicUrl })
  } catch (err) {
    console.error('[ai-image] error', err)
    return json({ error: String(err) }, 500)
  }
})
