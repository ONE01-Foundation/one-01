import type { AppLanguage } from '../stores/localeStore';

export type SettingsStringKey =
  | 'settings_title'
  | 'settings_appearance'
  | 'settings_theme_auto'
  | 'settings_theme_light'
  | 'settings_theme_dark'
  | 'settings_language'
  | 'settings_lang_he'
  | 'settings_lang_en'
  | 'settings_language_hint'
  | 'menu_share'
  | 'menu_profile'
  | 'menu_history'
  | 'menu_settings';

/** מחרוזות כותרת צ׳אט / סטטוס — לא תלויות בתוכן אנגלי כדי לא לבלבל RTL */
export type ChatChromeKey =
  | 'chat_title_default'
  | 'chat_status_agent'
  | 'chat_status_thinking'
  | 'chat_status_planning'
  | 'chat_status_ready';

export type AppStringKey = SettingsStringKey | ChatChromeKey;

const SETTINGS_HE: Record<SettingsStringKey, string> = {
  settings_title: 'הגדרות',
  settings_appearance: 'מראה',
  settings_theme_auto: 'אוטומטי',
  settings_theme_light: 'בהיר',
  settings_theme_dark: 'כהה',
  settings_language: 'שפה',
  settings_lang_he: 'עברית',
  settings_lang_en: 'English',
  settings_language_hint: 'כיוון הממשק (ימין/שמאל) משתנה אוטומטית לפי השפה.',
  menu_share: 'שיתוף',
  menu_profile: 'פרופיל',
  menu_history: 'היסטוריה',
  menu_settings: 'הגדרות',
};

const SETTINGS_EN: Record<SettingsStringKey, string> = {
  settings_title: 'Settings',
  settings_appearance: 'Appearance',
  settings_theme_auto: 'Auto',
  settings_theme_light: 'Light',
  settings_theme_dark: 'Dark',
  settings_language: 'Language',
  settings_lang_he: 'Hebrew',
  settings_lang_en: 'English',
  settings_language_hint: 'Layout direction (RTL/LTR) follows the selected language.',
  menu_share: 'Share',
  menu_profile: 'Profile',
  menu_history: 'History',
  menu_settings: 'Settings',
};

const CHAT_HE: Record<ChatChromeKey, string> = {
  chat_title_default: 'ONE שלי',
  chat_status_agent: 'סוכן',
  chat_status_thinking: 'חושב…',
  chat_status_planning: 'מתכנן…',
  chat_status_ready: 'מוכן',
};

const CHAT_EN: Record<ChatChromeKey, string> = {
  chat_title_default: 'My One',
  chat_status_agent: 'Agent',
  chat_status_thinking: 'Thinking...',
  chat_status_planning: 'Planning...',
  chat_status_ready: 'Ready',
};

const DICT: Record<AppLanguage, Record<AppStringKey, string>> = {
  he: { ...SETTINGS_HE, ...CHAT_HE },
  en: { ...SETTINGS_EN, ...CHAT_EN },
};

export function translate(lang: AppLanguage, key: AppStringKey): string {
  return DICT[lang][key] ?? key;
}

/** שורת משנה בכותרת צ׳אט ליחידה — ללא מילה "Steps" באנגלית במצב עברית */
export function formatChatUnitProgressLine(language: AppLanguage, progress: number, steps: number): string {
  if (language === 'he') {
    return `${progress}% · ${steps} צעדים`;
  }
  return `${progress}% · ${steps} Steps`;
}

const LRI = '\u2066';
const PDI = '\u2069';

/**
 * במצב עברית + RTL, קטעי Latin בתוך כותרת לא אמורים לשבור את כיוון הפסקה.
 * עוטף רצפי ASCII ב־LRI…PDI (Unicode bidi isolate).
 */
export function embedLatinRunsForRtlDisplay(text: string, language: AppLanguage): string {
  if (language !== 'he' || !text) return text;
  return text.replace(/[A-Za-z][A-Za-z0-9\s.,%·'\-/]*/g, (run) => LRI + run + PDI);
}
