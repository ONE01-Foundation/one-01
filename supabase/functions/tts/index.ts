import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'TTS service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const {
      text,
      voice_id = '21m00Tcm4TlvDq8ikWAM',
      model_id = 'eleven_monolingual_v1',
      stability = 0.5,
      similarity_boost = 0.5,
      speed = 1.0,
    } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text string is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: { stability, similarity_boost, speed },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(res.body, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
