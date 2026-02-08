/**
 * Loading Store - Tracks if loading screen has been shown
 */

import { create } from 'zustand';
import { storage } from '../utils/session';

const LOADING_COMPLETED_KEY = 'one_loading_completed';

interface LoadingStore {
  hasSeenLoading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  markLoadingComplete: () => Promise<void>;
  resetLoading: () => Promise<void>;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  hasSeenLoading: false,
  initialized: false,

  initialize: async () => {
    try {
      const completed = await storage.getItem(LOADING_COMPLETED_KEY);
      set({
        hasSeenLoading: completed === 'true',
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize loading store:', error);
      set({
        hasSeenLoading: false,
        initialized: true,
      });
    }
  },

  markLoadingComplete: async () => {
    try {
      await storage.setItem(LOADING_COMPLETED_KEY, 'true');
      set({ hasSeenLoading: true });
    } catch (error) {
      console.error('Failed to mark loading complete:', error);
    }
  },

  resetLoading: async () => {
    try {
      await storage.removeItem(LOADING_COMPLETED_KEY);
      set({ hasSeenLoading: false });
    } catch (error) {
      console.error('Failed to reset loading:', error);
    }
  },
}));

