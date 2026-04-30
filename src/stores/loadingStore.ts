/**
 * Loading Store - Tracks if loading/splash has been shown.
 * אחד_ספלאש_כדור = ספלאש הכדור בתוך OneScreen (גדילה מהמרכז, ריחוף, פרצוף).
 */

import { create } from 'zustand';
import { storage } from '../utils/session';

const LOADING_COMPLETED_KEY = 'one_loading_completed';
/** מפתח נפרד לספלאש הכדור – גם משתמשים שראו מסך טעינה ישן יראו את האנימציה פעם אחת */
const ORB_SPLASH_SEEN_KEY = 'one_orb_splash_v1';

interface LoadingStore {
  hasSeenLoading: boolean;
  /** האם המשתמש כבר ראה את ספלאש הכדור (גדילה + ריחוף + פרצוף) בתוך OneScreen */
  hasSeenOrbSplash: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  markLoadingComplete: () => Promise<void>;
  markOrbSplashComplete: () => Promise<void>;
  resetLoading: () => Promise<void>;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  hasSeenLoading: false,
  hasSeenOrbSplash: false,
  initialized: false,

  initialize: async () => {
    try {
      const [completed, orbSplashSeen] = await Promise.all([
        storage.getItem(LOADING_COMPLETED_KEY),
        storage.getItem(ORB_SPLASH_SEEN_KEY),
      ]);
      set({
        hasSeenLoading: completed === 'true',
        hasSeenOrbSplash: orbSplashSeen === 'true',
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize loading store:', error);
      set({
        hasSeenLoading: false,
        hasSeenOrbSplash: false,
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

  markOrbSplashComplete: async () => {
    try {
      await storage.setItem(ORB_SPLASH_SEEN_KEY, 'true');
      set({ hasSeenOrbSplash: true });
    } catch (error) {
      console.error('Failed to mark orb splash complete:', error);
    }
  },

  resetLoading: async () => {
    try {
      await storage.removeItem(LOADING_COMPLETED_KEY);
      await storage.removeItem(ORB_SPLASH_SEEN_KEY);
      set({ hasSeenLoading: false, hasSeenOrbSplash: false });
    } catch (error) {
      console.error('Failed to reset loading:', error);
    }
  },
}));

