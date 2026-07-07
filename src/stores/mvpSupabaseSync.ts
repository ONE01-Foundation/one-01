/**
 * mvpSupabaseSync — bridge between the local useMvpStore (zustand) and
 * the Supabase `profiles.one_user` JSON column.
 *
 * Strategy: we store the entire MVP-store persisted slice under the key
 * `mvp` inside `profiles.one_user`. This keeps the existing OneUser blob
 * intact (other legacy code may still write to it) and keeps schema work
 * to zero — no new migrations, just a JSON envelope.
 *
 * Push: debounced upsert; called on every store change while a session
 *       exists. Local AsyncStorage stays the source of truth for offline.
 * Pull: called when auth state flips to SIGNED_IN; loads the row and
 *       applies it to the local store.
 */

import { supabaseService } from '../services/supabaseService';

const TABLE = 'profiles';
const PUSH_DEBOUNCE_MS = 1200;

export interface MvpSyncPayload {
  name: string;
  identities: unknown[];
  activeIdentityId: string;
  units: unknown[];
  hasCompletedOnboarding: boolean;
  homeChat?: unknown[];
  unitChats?: Record<string, unknown[]>;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized: string | null = null;

/**
 * Debounced push of the MVP store slice into profiles.one_user.mvp.
 * Skips when no session, when serialized payload hasn't changed, or
 * when Supabase isn't initialized.
 */
export function pushMvpToSupabase(payload: MvpSyncPayload): void {
  const client = supabaseService.getClient();
  if (!client) return;
  const ser = JSON.stringify(payload);
  if (ser === lastSerialized) return;
  lastSerialized = ser;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const { data: sessionData } = await client.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return;
    // Merge: read current row, splice in the .mvp slot, write back. Keeps
    // any other keys (legacy OneUser) intact.
    const { data: existing } = await client
      .from(TABLE)
      .select('one_user')
      .eq('id', uid)
      .maybeSingle();
    const merged = { ...(existing?.one_user ?? {}), mvp: payload };
    const { error } = await client
      .from(TABLE)
      .upsert(
        { id: uid, one_user: merged, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[mvpSync] push failed:', error.message);
    }
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Fetch profiles.one_user.mvp for the currently signed-in user. Returns
 * null when no session, no row, or no .mvp key.
 */
export async function pullMvpFromSupabase(): Promise<MvpSyncPayload | null> {
  const client = supabaseService.getClient();
  if (!client) return null;
  const { data: sessionData } = await client.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await client
    .from(TABLE)
    .select('one_user')
    .eq('id', uid)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[mvpSync] pull failed:', error.message);
    return null;
  }
  const mvp = (data?.one_user as { mvp?: MvpSyncPayload } | null)?.mvp;
  if (!mvp) return null;
  // Reset the dedupe marker so an outbound push of the SAME shape can
  // still go through after a fresh hydrate.
  lastSerialized = JSON.stringify(mvp);
  return mvp;
}

/**
 * Subscribe to Supabase auth state changes. Returns an unsubscribe fn.
 * On SIGNED_IN, the caller typically pulls the profile and applies it.
 * On SIGNED_OUT, the caller typically resets the local store.
 */
export function subscribeToAuthChanges(
  cb: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'OTHER') => void,
): () => void {
  const client = supabaseService.getClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      cb('SIGNED_IN');
    } else if (event === 'SIGNED_OUT') {
      cb('SIGNED_OUT');
    } else {
      cb('OTHER');
    }
  });
  return () => data.subscription.unsubscribe();
}
