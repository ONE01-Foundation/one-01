import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Live web info for ONE. The browser asks a question; we run it through OpenAI's
// Responses API with the built-in web_search tool so the answer reflects the
// CURRENT internet (prices, dates, availability, facts) — not stale training
// data — and comes back with source links. Used when ONE needs real facts.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Citation {
  url: string
  title: string
}

// OpenAI inlines citation markers as private-use unicode runs (U+E200 opens,
// U+E201 closes) that render as junk like "citeturn0news1". Strip the whole run
// — the real links are returned separately in `citations`. Built from char codes
// so the source stays pure ASCII and unambiguous.
function cleanText(s: string): string {
  const START = String.fromCharCode(0xe200)
  const END = String.fromCharCode(0xe201)
  const runRe = new RegExp(START + '[\\s\\S]*?' + END, 'g')
  const puaRe = new RegExp('[\\uE000-\\uF8FF]', 'g')
  return s
    .replace(runRe, '')
    .replace(puaRe, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

serve(async (req) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return json({ error: 'not configured' }, 503)

  let query = ''
  let lang = 'en'
  try {
    const b = await req.json().catch(() => ({}))
    if (b && typeof b.query === 'string') query = b.query.trim()
    if (b && (b.lang === 'he' || b.lang === 'en')) lang = b.lang
  } catch {
    /* no body */
  }
  if (!query) return json({ error: 'empty query' }, 400)

  const instructions =
    lang === 'he'
      ? 'אתה מנוע המידע של ONE. ענה על השאלה עם מידע עדכני ומדויק מהאינטרנט. היה תמציתי (2–4 משפטים או רשימה קצרה), כלול נתונים ומספרים מרכזיים, וענה בעברית.'
      : "You are ONE's research engine. Answer with current, accurate info from the web. Be concise (2-4 sentences or a short list), include key facts and figures, and reply in English."

  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  const run = async (tool: string) =>
    fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        model: 'gpt-4o',
        tools: [{ type: tool }],
        instructions,
        input: query,
      }),
    })

  try {
    // GA tool name first, then the preview name for older accounts.
    let r = await run('web_search')
    if (!r.ok) r = await run('web_search_preview')
    const d = await r.json()
    if (!r.ok) {
      console.error('[web-search] error', r.status, d?.error?.message)
      return json({ error: d?.error?.message ?? 'search failed' }, r.status)
    }

    // Pull the assistant text + any url citations out of the Responses payload.
    let text = ''
    const citations: Citation[] = []
    const seen = new Set<string>()
    for (const item of d?.output ?? []) {
      if (item?.type !== 'message') continue
      for (const c of item?.content ?? []) {
        if (c?.type !== 'output_text') continue
        text += c.text ?? ''
        for (const a of c?.annotations ?? []) {
          if (a?.type === 'url_citation' && a?.url && !seen.has(a.url)) {
            seen.add(a.url)
            citations.push({ url: a.url, title: a.title || a.url })
          }
        }
      }
    }
    if (!text && typeof d?.output_text === 'string') text = d.output_text
    return json({ text: cleanText(text), citations: citations.slice(0, 5) })
  } catch (err) {
    console.error('[web-search] error', err)
    return json({ error: String(err) }, 500)
  }
})
