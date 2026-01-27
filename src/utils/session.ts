/**
 * Session management utilities
 */

import * as SecureStore from 'expo-secure-store';
import { SESSION_STORAGE_KEY, USER_STORAGE_KEY } from './constants';

export async function getOrCreateSessionId(): Promise<string> {
  let sessionId = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

export async function getUserId(): Promise<string | null> {
  return await SecureStore.getItemAsync(USER_STORAGE_KEY);
}

export async function setUserId(userId: string): Promise<void> {
  await SecureStore.setItemAsync(USER_STORAGE_KEY, userId);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
}

