"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * A single lazily-created browser Supabase client. Returns null when the env
 * vars aren't set, so callers can degrade to local-only mode cleanly.
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
