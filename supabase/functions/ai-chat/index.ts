import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// NOTE: these CORS headers must be on EVERY response, not just the OPTIONS
// preflight. On web (react-native-web / app.one01.io) the browser blocks any
// response that lacks Access-Control-Allow-Origin, so omitting them on the
// POST responses silently breaks ONE's chat in the browser while native keeps
// working. This file is kept in sync with the deployed v2 of the function —
// redeploying a version without `...CORS` on the real responses regresses web.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // verify_jwt=true at the platform level already rejects invalid JWTs.
  // Inside the function we try to resolve the user, but DO NOT require one.
  // This lets the mobile app talk to ONE before the user has completed a
  // sign-in — calls with just the publishable anon key are accepted.
  // Auth logging stays useful for personalized usage limits down the road.
  let userId: string | null = null
  let isAnonymous = false
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      userId = data.user.id
      isAnonymous = (data.user as { is_anonymous?: boolean }).is_anonymous === true
    }
  } catch (_err) {
    // Anon-key-only call — no user attached. Allowed.
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    const body = await req.json()
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens = 500,
      response_format,
    } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const payload: Record<string, unknown> = { model, messages, temperature, max_tokens }
    if (response_format) payload.response_format = response_format

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await openaiRes.json()

    if (!openaiRes.ok) {
      console.error('[ai-chat] OpenAI error', openaiRes.status, data?.error?.message)
      return new Response(
        JSON.stringify({ error: data.error?.message ?? 'AI provider error' }),
        { status: openaiRes.status, headers: { 'Content-Type': 'application/json', ...CORS } },
      )
    }

    console.log('[ai-chat] ok', { userId, isAnonymous, model: data.model, totalTokens: data.usage?.total_tokens })

    return new Response(JSON.stringify({
      text: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    console.error('[ai-chat] error', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
