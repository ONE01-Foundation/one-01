/**
 * Supabase Service - Database and authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { Agent, Goal, ConversationMessage, Lens } from '../types';
import type { OneUser } from '../core/types';

// Env first; committed PUBLIC fallbacks so a build is never env-less (the anon
// publishable key is public by design — it already ships in the web bundle).
// Without this the AI client stays null on an env-less build and every call
// silently drops to the local responder ("AI doesn't work on web").
const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() || 'https://dkkxecnfqkcpjjapbesy.supabase.co';
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() || 'sb_publishable_gDnOUz82cx0AflfmFoTL5A_SNbWeasq';

function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A signed-in user flattened to just what the ONE01 UI needs. */
export interface AuthedUser {
  id: string;
  email: string | null;
  /** Provider-supplied display name (Google full name, etc.) if any. */
  name: string | null;
  /** Provider-supplied avatar URL if any. */
  avatarUrl: string | null;
}

function toAuthedUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }): AuthedUser {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    id: u.id,
    email: u.email ?? null,
    name: str(m.full_name) ?? str(m.name) ?? null,
    avatarUrl: str(m.avatar_url) ?? str(m.picture) ?? null,
  };
}

class SupabaseService {
  private client: SupabaseClient | null = null;

  initialize(): void {
    if (this.client) return; // idempotent — one GoTrue client for the whole app
    if (!isValidSupabaseUrl(SUPABASE_URL) || !SUPABASE_ANON_KEY) {
      this.client = null;
      if (SUPABASE_URL || SUPABASE_ANON_KEY) {
        console.warn(
          'Supabase: invalid or missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (URL must be https://…)'
        );
      }
      return;
    }

    const options =
      Platform.OS === 'web'
        ? // On web, let Supabase use its default (localStorage-based) storage
          {}
        : {
            auth: {
              storage: {
                getItem: async (key: string) => {
                  return await SecureStore.getItemAsync(key);
                },
                setItem: async (key: string, value: string) => {
                  await SecureStore.setItemAsync(key, value);
                },
                removeItem: async (key: string) => {
                  await SecureStore.deleteItemAsync(key);
                },
              },
            },
          };

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  /** The project URL + anon key, for raw fetches to Edge Functions that must
   *  control their own headers (supabase-js's functions.invoke injects
   *  `x-supabase-client-platform`, which older function CORS allow-lists reject
   *  on web — see aiChat). Null until initialized. */
  getConfig(): { url: string; anonKey: string } | null {
    if (!this.client) return null;
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
  }

  // Authentication methods
  async signIn(email: string, password: string) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.auth.signUp({ email, password });
  }

  async signOut() {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.auth.signOut();
  }

  async getCurrentUser() {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.auth.getUser();
  }

  /** התחברות אנונימית (אם מופעל בפרויקט) — מאפשרת שמירת שורת פרופיל לפי auth.uid */
  async signInAnonymously() {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.auth.signInAnonymously();
  }

  /**
   * OAuth on native (Expo Go compatible) — opens the provider's consent page in
   * an in-app browser (ASWebAuthenticationSession on iOS) and returns the
   * session to the app via a deep link.
   *
   * Flow:
   *   1. redirectTo = Linking.createURL('/')  → `exp://…` in Expo Go,
   *      `one://…` in a standalone/dev build. Whatever it is, this exact URL
   *      must be in Supabase → Auth → URL Configuration → Redirect URLs.
   *   2. Ask Supabase for the provider URL (skipBrowserRedirect so WE open it).
   *   3. Open it; the browser bounces back to `redirectTo` after consent.
   *   4. The returned URL carries either a PKCE `code` (→ exchangeCodeForSession)
   *      or implicit `access_token`+`refresh_token` (→ setSession). We handle
   *      both so it works regardless of the client's flowType.
   *
   * Returns a discriminated result instead of throwing, so the caller can show
   * a friendly message (e.g. provider-not-enabled) without a red screen.
   */
  async signInWithProviderNative(
    provider: 'google' | 'apple'
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.client) return { ok: false, error: 'no_client' };

    const redirectTo = Linking.createURL('/');
    // Surfaced so the developer can copy the exact value into Supabase's
    // Redirect URLs allow-list (it changes with the LAN IP in Expo Go).
    console.log('[auth] OAuth redirectTo =', redirectTo);

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.url) return { ok: false, error: 'no_oauth_url' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      // 'cancel' / 'dismiss' = user backed out; don't treat as a hard error.
      return {
        ok: false,
        error: result.type === 'success' ? 'no_return_url' : 'cancelled',
      };
    }

    const params = parseUrlParams(result.url);
    if (params.error_description) return { ok: false, error: params.error_description };

    if (params.code) {
      const { error: exErr } = await this.client.auth.exchangeCodeForSession(params.code);
      return exErr ? { ok: false, error: exErr.message } : { ok: true };
    }
    if (params.access_token && params.refresh_token) {
      const { error: setErr } = await this.client.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      return setErr ? { ok: false, error: setErr.message } : { ok: true };
    }
    return { ok: false, error: 'no_tokens' };
  }

  /** Where an OAuth / magic-link flow should return. Web: the current page URL
   *  (origin + path, no hash) so the reloaded app re-opens where we left off and
   *  supabase-js (detectSessionInUrl) picks up the session. Native: the app's
   *  deep link. Both exact values must be in Supabase → Auth → URL Configuration
   *  → Redirect URLs. */
  private authRedirectUrl(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return Linking.createURL('/');
  }

  /**
   * Sign in with Google / Apple. On native this runs the in-app-browser PKCE
   * flow (see signInWithProviderNative). On web it asks Supabase for the provider
   * URL and lets the browser do a full-page redirect; the session is picked up on
   * reload, so a resolved `{ ok: true }` here just means "redirecting".
   */
  async signInWithProvider(provider: 'google' | 'apple'): Promise<{ ok: boolean; error?: string }> {
    if (Platform.OS !== 'web') return this.signInWithProviderNative(provider);
    if (!this.client) return { ok: false, error: 'no_client' };
    const { error } = await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: this.authRedirectUrl() },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /**
   * Passwordless email: send a magic link (works on the Supabase free tier with
   * the built-in mailer, rate-limited). Clicking the link returns to the app and
   * the session is detected automatically (web: detectSessionInUrl; native: the
   * deep-link listener). `shouldCreateUser` lets first-time emails in too.
   */
  async sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.client) return { ok: false, error: 'no_client' };
    const clean = email.trim();
    if (!clean) return { ok: false, error: 'empty' };
    const { error } = await this.client.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: this.authRedirectUrl(), shouldCreateUser: true },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  /** The currently signed-in user (flattened), or null. */
  async currentUser(): Promise<AuthedUser | null> {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    const u = data.session?.user;
    return u ? toAuthedUser(u) : null;
  }

  /** Subscribe to sign-in / sign-out. Returns an unsubscribe fn. */
  onAuthChange(cb: (user: AuthedUser | null) => void): () => void {
    if (!this.client) return () => {};
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      cb(session?.user ? toAuthedUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  /**
   * שומר את מצב ONE המקומי בטבלת profiles (אחרי התחברות).
   * דורש טבלה `public.profiles` ו־RLS — ראה supabase/profiles_v01.sql
   */
  async syncOneUserProfile(user: OneUser): Promise<{ ok: boolean; reason?: string }> {
    if (!this.client) {
      return { ok: false, reason: 'no_client' };
    }
    const { data: sessionData } = await this.client.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      return { ok: false, reason: 'no_session' };
    }
    const { error } = await this.client.from('profiles').upsert(
      {
        id: uid,
        one_user: user as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn('profiles upsert:', error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  }

  /** טוען את מסמך one_user מהשורה של המשתמש המחובר (אם קיים) */
  async fetchOneUserProfileForCurrentSession(): Promise<OneUser | null> {
    if (!this.client) return null;
    const { data: sessionData } = await this.client.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return null;
    const { data, error } = await this.client.from('profiles').select('one_user').eq('id', uid).maybeSingle();
    if (error || !data?.one_user) return null;
    return data.one_user as OneUser;
  }

  // Data methods
  async saveGoal(goal: Goal) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.from('goals').upsert(goal);
  }

  async getGoals(userId: string) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  async saveMessage(message: ConversationMessage) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client.from('messages').insert(message);
  }

  async getMessages(sessionId: string) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return await this.client
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
  }

  // Real-time subscriptions
  subscribeToMessages(sessionId: string, callback: (message: ConversationMessage) => void) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return this.client
      .channel(`messages:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          callback(payload.new as ConversationMessage);
        }
      )
      .subscribe();
  }
}

/**
 * Pull query + fragment params out of an OAuth callback URL without relying on
 * RN's partial `URL`/`URLSearchParams` polyfill. Handles both
 * `redirect?code=…` (PKCE) and `redirect#access_token=…&refresh_token=…`
 * (implicit) — everything after the first `?` or `#` is treated as params,
 * and any additional `#` is flattened to `&`.
 */
function parseUrlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const start = url.search(/[?#]/);
  if (start === -1) return out;
  const raw = url.slice(start + 1).replace(/#/g, '&');
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const val = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export const supabaseService = new SupabaseService();

