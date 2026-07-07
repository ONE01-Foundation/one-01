/**
 * שפה וכיוון ממשק (RTL/LTR) — נשמרים במכשיר, משפיעים על כל האפליקציה.
 *
 * MVP default is English/LTR — the canonical spec copy and mockups are English,
 * the new UnitCard layout is built for LTR (emoji+title on left, timestamp on
 * right). Hebrew/RTL stays a first-class option but is opt-in via Settings,
 * not the boot default.
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
  language: 'en',
  layoutDirection: 'ltr',
  initialized: false,

  initialize: async () => {
    try {
      const langRaw = await storage.getItem(LANGUAGE_KEY);
      // Honor an explicit prior pick; otherwise default to English.
      const language: AppLanguage = langRaw === 'he' ? 'he' : 'en';
      const layoutDirection = layoutDirectionForLanguage(language);
      set({ language, layoutDirection, initialized: true });
    } catch {
      set({ language: 'en', layoutDirection: 'ltr', initialized: true });
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
