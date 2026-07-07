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

// These should be moved to environment variables
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

class SupabaseService {
  private client: SupabaseClient | null = null;

  initialize(): void {
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

