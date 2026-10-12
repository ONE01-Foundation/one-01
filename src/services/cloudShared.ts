/**
 * cloudShared — mobile's bridge to SHARED UNITS on Supabase (the two-sided Unit).
 *
 * When you share a process, ONE publishes a DISCLOSURE-SAFE snapshot (the same
 * thing SharedProcessPreview shows: process essentials + the outward message +
 * only the OPEN-tier facts — never ask/private data) via the `create_shared_unit`
 * SECURITY DEFINER RPC and gets back a short CODE. Anyone with the code joins and
 * reads/writes the common thread — so the provider side is real, cross-device,
 * cross-surface (same RPCs the web uses). No account/dashboard setup; anon-safe.
 *
 * Pure data layer — no React, no throwing. Every call degrades to a safe default
 * when Supabase isn't configured or a request fails (so sharing still works
 * locally / offline, just without a live link).
 *
 * Backend: supabase/migrations/20260728_shared_units.sql (project dkkxecnfqkcpjjapbesy).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';

/** The disclosure-safe payload published for a shared process — exactly what the
 *  other side is allowed to see (mirrors SharedProcessPreview). NEVER the raw
 *  Unit (which holds private metrics / ask+private facts). */
export interface SharedSnapshot {
  title: string;
  emoji: string;
  status?: string | null;
  /** The open-tier facts, as "Label: value" strings. */
  openFacts: string[];
  /** The outward message ONE drafted (the latest draft body), if any. */
  message?: string;
  sharedByName?: string;
  providerName?: string;
}

export interface SharedUnitRow {
  id: string;
  code: string;
  title: string;
  emoji: string;
  type: string | null;
  unit: SharedSnapshot | Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedMessage {
  id: string;
  unit_id: string;
  author: string;
  role: 'human' | 'one';
  text: string;
  created_at: string;
}

export interface SharedMember {
  id: string;
  unit_id: string;
  name: string;
  created_at: string;
}

function client(): SupabaseClient | null {
  let c = supabaseService.getClient();
  if (!c) {
    supabaseService.initialize();
    c = supabaseService.getClient();
  }
  return c;
}

/** Publish a disclosure-safe snapshot and get back its shareable code (or null
 *  when the backend is unreachable — the caller then shares locally only). */
export async function shareUnit(snapshot: SharedSnapshot, author: string): Promise<SharedUnitRow | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c.rpc('create_shared_unit', {
    p_title: snapshot.title,
    p_emoji: snapshot.emoji || '📌',
    p_type: 'process',
    p_unit: snapshot,
    p_author: author,
  });
  if (error || !data) return null;
  // The RPC returns the row (shape of public.shared_units).
  return (Array.isArray(data) ? data[0] : data) as SharedUnitRow;
}

/** Join a shared unit by its code (adds you as a member); null if unknown. */
export async function joinSharedUnit(code: string, name: string): Promise<SharedUnitRow | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c.rpc('join_shared_unit', {
    p_code: code.trim(),
    p_name: name.trim(),
  });
  if (error || !data) return null;
  return (Array.isArray(data) ? data[0] : data) as SharedUnitRow;
}

/** The common thread — messages newer than `since` (undefined = all). */
export async function getSharedMessages(code: string, since?: string): Promise<SharedMessage[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.rpc('get_shared_messages', {
    p_code: code.trim(),
    p_since: since ?? null,
  });
  return error || !data ? [] : (data as SharedMessage[]);
}

/** Post into the common thread as a human or as ONE. */
export async function postSharedMessage(
  code: string,
  author: string,
  role: 'human' | 'one',
  text: string,
): Promise<SharedMessage | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c.rpc('post_shared_message', {
    p_code: code.trim(),
    p_author: author,
    p_role: role,
    p_text: text,
  });
  if (error || !data) return null;
  return (Array.isArray(data) ? data[0] : data) as SharedMessage;
}

/** Who's in the room. */
export async function listSharedMembers(code: string): Promise<SharedMember[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.rpc('list_shared_members', { p_code: code.trim() });
  return error || !data ? [] : (data as SharedMember[]);
}
