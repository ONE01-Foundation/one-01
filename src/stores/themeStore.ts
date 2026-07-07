/**
 * Theme Store - Manages app theme state
 */

import { create } from 'zustand';
import { Theme, resolveTheme, getThemeColors, ThemeColors } from '../utils/theme';
import { storage } from '../utils/session';

const THEME_PREFERENCE_KEY = 'one_theme_preference';

interface ThemeStore {
  theme: Theme;
  colors: ThemeColors;
  preference: 'auto' | 'light' | 'dark';
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setPreference: (preference: 'auto' | 'light' | 'dark') => Promise<void>;
  updateTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  colors: getThemeColors('light'),
  preference: 'auto',
  initialized: false,

  initialize: async () => {
    try {
      // Load saved preference. Default to 'light' for first-time users — the
      // ONE_UI_UX_SPEC visual language is built around a white/off-white surface
      // with black text, so light is the canonical mode. Auto/dark remain
      // available via Settings.
      const savedPreference = await storage.getItem(THEME_PREFERENCE_KEY);
      const preference = (savedPreference as 'auto' | 'light' | 'dark') || 'light';

      // Resolve theme based on preference
      const theme = resolveTheme(preference);
      const colors = getThemeColors(theme);

      set({
        theme,
        colors,
        preference,
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize theme:', error);
      // Default to light theme
      set({
        theme: 'light',
        colors: getThemeColors('light'),
        preference: 'light',
        initialized: true,
      });
    }
  },

  setPreference: async (preference) => {
    try {
      await storage.setItem(THEME_PREFERENCE_KEY, preference);
      
      const theme = resolveTheme(preference);
      const colors = getThemeColors(theme);

      set({ preference, theme, colors });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  },

  updateTheme: () => {
    const { preference } = get();
    const theme = resolveTheme(preference);
    const colors = getThemeColors(theme);

    set({ theme, colors });
  },
}));

