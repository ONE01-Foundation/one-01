/**
 * Session management utilities
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SESSION_STORAGE_KEY, USER_STORAGE_KEY } from './constants';

const isWeb = Platform.OS === 'web';

const webStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore quota / privacy mode errors
    }
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const storage = {
  getItem: (key: string) =>
    isWeb ? webStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    isWeb ? webStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    isWeb ? webStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

export async function getOrCreateSessionId(): Promise<string> {
  let sessionId = await storage.getItem(SESSION_STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await storage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

export async function getUserId(): Promise<string | null> {
  return await storage.getItem(USER_STORAGE_KEY);
}

export async function setUserId(userId: string): Promise<void> {
  await storage.setItem(USER_STORAGE_KEY, userId);
}

export async function clearSession(): Promise<void> {
  await storage.removeItem(SESSION_STORAGE_KEY);
  await storage.removeItem(USER_STORAGE_KEY);
}

