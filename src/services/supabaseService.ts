/**
 * Supabase Service - Database and authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Agent, Goal, ConversationMessage, Lens } from '../types';

// These should be moved to environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

class SupabaseService {
  private client: SupabaseClient | null = null;

  initialize(): void {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase credentials not configured');
      return;
    }

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    });
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

