/**
 * useT — small hook that returns a `t(key)` function bound to the active
 * language. Replaces ad-hoc `translate(language, key)` calls in components.
 *
 *   const t = useT();
 *   <Text>{t('home_chat_cta')}</Text>
 *
 * Re-renders the calling component whenever the user toggles the language
 * (subscribes via the locale store), so a single mental model covers both
 * sides.
 */

import { useCallback } from 'react';
import { useLocaleStore } from '../stores/localeStore';
import { translate, type AppStringKey } from './strings';

export function useT() {
  const language = useLocaleStore((s) => s.language);
  return useCallback((key: AppStringKey) => translate(language, key), [language]);
}

/** Convenience selector when a component only needs the raw language code. */
export function useLanguage() {
  return useLocaleStore((s) => s.language);
}
