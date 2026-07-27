import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Speech-to-text: the browser POSTs recorded audio bytes; we forward to OpenAI
// transcription and return the text. Used by hold-to-record on the voice button.
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

  try {
    const ct = req.headers.get('content-type') || 'audio/webm'
    const buf = new Uint8Array(await req.arrayBuffer())
    if (!buf.length) return json({ error: 'empty audio' }, 400)
    const ext = ct.includes('mp4')
      ? 'mp4'
      : ct.includes('wav')
        ? 'wav'
        : ct.includes('mpeg')
          ? 'mp3'
          : ct.includes('ogg')
            ? 'ogg'
            : 'webm'

    const call = async (model: string) => {
      const form = new FormData()
      form.append('file', new Blob([buf], { type: ct }), `audio.${ext}`)
      form.append('model', model)
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      })
      return { r, d: await r.json() }
    }

    let { r, d } = await call('gpt-4o-transcribe')
    if (!r.ok) ({ r, d } = await call('whisper-1'))
    if (!r.ok) {
      console.error('[stt] error', r.status, d?.error?.message)
      return json({ error: d?.error?.message ?? 'transcription failed' }, r.status)
    }
    return json({ text: d?.text ?? '' })
  } catch (err) {
    console.error('[stt] error', err)
    return json({ error: String(err) }, 500)
  }
})
