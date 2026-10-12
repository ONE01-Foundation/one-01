/**
 * homePrefsStore — preferences for the Home SURFACE, kept deliberately SEPARATE
 * from mvpStore so experimenting with the home paradigm never risks the core
 * data model (units, identities, memories, disclosure).
 *
 * homeMode:
 *   • 'classic' — the current resting-broadcast home (default, untouched).
 *   • 'chat'    — Home is one continuous conversation with ONE, who speaks
 *                 first: a persistent thread where ONE's proactive updates land
 *                 as its own chat bubbles. See ChatHomeScreen.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { storage } from '../utils/session';

export type HomeMode = 'classic' | 'chat' | 'presence';

interface HomePrefsStore {
  homeMode: HomeMode;
  setHomeMode: (m: HomeMode) => void;
  toggleHomeMode: () => void;
}

const prefsStorage: StateStorage = {
  getItem: async (name) => (await storage.getItem(name)) ?? null,
  setItem: async (name, value) => {
    await storage.setItem(name, value);
  },
  removeItem: async (name) => {
    await storage.removeItem(name);
  },
};

export const useHomePrefs = create<HomePrefsStore>()(
  persist(
    (set, get) => ({
      // The CLASSIC home is the representative surface — its orb, broadcast-
      // bubbles and scroll are the best-built elements, so the representative
      // concept (dynamic status, conversational onboarding, in-chat widgets) is
      // built there. 'chat' + 'presence' stay as experimental toggles. (Key
      // bumped to v3 so this default takes effect over an earlier persisted one.)
      homeMode: 'classic',
      setHomeMode: (homeMode) => set({ homeMode }),
      toggleHomeMode: () => set({ homeMode: get().homeMode === 'chat' ? 'classic' : 'chat' }),
    }),
    { name: 'one_home_prefs_v3', storage: createJSONStorage(() => prefsStorage) },
  ),
);
