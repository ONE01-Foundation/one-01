"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public project connection. The anon key is SAFE to ship in the browser
// bundle — row access is still enforced by RLS, and the ai-chat edge function
// accepts anon-key calls. Committing it as a fallback means the deployed static
// build (Cloudflare Pages) always has a real client even when the build step
// didn't inject NEXT_PUBLIC_* env vars — which is why login + AI worked on the
// dev server (.env.local) but silently fell back to mock on the live site.
// NEVER put the service_role key here.
const FALLBACK_URL = "https://dkkxecnfqkcpjjapbesy.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRra3hlY25mcWtjcGpqYXBiZXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODA1NzcsImV4cCI6MjA5MzE1NjU3N30.eM81oDiZVkjwEkzaDyLGDKj--fkiPD6PwhHmOuwMxBw";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * A single lazily-created browser Supabase client. Falls back to the public
 * project constants above so it's never null in a deployed build; only returns
 * null in the impossible case that both env vars and fallbacks are empty.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Magic-link + OAuth both return via a redirect carrying a code; the
        // client auto-exchanges it for a session on load.
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}
