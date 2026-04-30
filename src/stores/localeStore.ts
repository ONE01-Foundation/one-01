/**
 * שפה וכיוון ממשק (RTL/LTR) — נשמרים במכשיר, משפיעים על כל האפליקציה.
 */
import { create } from 'zustand';
import { storage } from '../utils/session';

const LANGUAGE_KEY = 'one_app_language';

export type AppLanguage = 'he' | 'en';
export type LayoutDirection = 'rtl' | 'ltr';

/** כיוון ממשק נגזר מהשפה: עברית → RTL, אנגלית → LTR */
export function layoutDirectionForLanguage(language: AppLanguage): LayoutDirection {
  return language === 'he' ? 'rtl' : 'ltr';
}

type LocaleStore = {
  language: AppLanguage;
  layoutDirection: LayoutDirection;
  initialized: boolean;
  initialize: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

export const useLocaleStore = create<LocaleStore>((set) => ({
  language: 'he',
  layoutDirection: 'rtl',
  initialized: false,

  initialize: async () => {
    try {
      const langRaw = await storage.getItem(LANGUAGE_KEY);
      const language: AppLanguage = langRaw === 'en' ? 'en' : 'he';
      const layoutDirection = layoutDirectionForLanguage(language);
      set({ language, layoutDirection, initialized: true });
    } catch {
      set({ language: 'he', layoutDirection: 'rtl', initialized: true });
    }
  },

  setLanguage: async (language) => {
    try {
      await storage.setItem(LANGUAGE_KEY, language);
    } catch {
      /* ignore */
    }
    set({ language, layoutDirection: layoutDirectionForLanguage(language) });
  },
}));
