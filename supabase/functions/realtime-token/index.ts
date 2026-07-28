import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Mints a short-lived (ephemeral) OpenAI Realtime session token so the browser
// can open a live spoken WebRTC conversation directly with the model WITHOUT
// ever seeing the real API key. Used by tap-to-talk on the voice button.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return json({ error: 'not configured' }, 503)

  let instructions =
    'You are ONE — a warm, concise personal assistant. Keep spoken replies short and natural.'
  try {
    const b = await req.json().catch(() => ({}))
    if (b && typeof b.instructions === 'string' && b.instructions.trim()) instructions = b.instructions.trim()
  } catch {
    /* no body */
  }

  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  try {
    // Newer GA endpoint first, fall back to the older sessions endpoint. In BOTH
    // we enable input-audio transcription — otherwise the user's speech is never
    // turned into text, and the app's pipeline (which builds/updates processes
    // and asks the tailoring questions) never sees what was said.
    let r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          instructions,
          audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' } } },
        },
      }),
    })
    let d = await r.json()
    if (!r.ok) {
      r = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'alloy',
          instructions,
          input_audio_transcription: { model: 'whisper-1' },
        }),
      })
      d = await r.json()
    }
    if (!r.ok) {
      console.error('[realtime-token] error', r.status, d?.error?.message)
      return json({ error: d?.error?.message ?? 'realtime unavailable' }, r.status)
    }
    const secret = d?.client_secret?.value ?? d?.value ?? null
    const model = d?.session?.model ?? d?.model ?? 'gpt-realtime'
    return json({ secret, model })
  } catch (err) {
    console.error('[realtime-token] error', err)
    return json({ error: String(err) }, 500)
  }
})
