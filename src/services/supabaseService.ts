/**
 * Supabase Service - Database and authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
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

  /** OAuth — נוח בעיקר בווב; בנייטיב דורש הגדרת deep link בפרויקט */
  async signInWithOAuth(provider: 'google' | 'apple') {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    const redirectTo =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}`
        : undefined;
    return await this.client.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    });
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

export const supabaseService = new SupabaseService();

