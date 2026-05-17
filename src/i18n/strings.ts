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
  | 'settings_onboarding_experience'
  | 'settings_onboarding_composer_toggle'
  | 'settings_onboarding_composer_hint'
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
  | 'chat_status_ready'
  | 'preview_header'
  | 'preview_complexity_light'
  | 'preview_complexity_moderate'
  | 'preview_complexity_involved'
  | 'preview_steps_anticipated'
  | 'preview_active_units'
  | 'preview_insight_common'
  | 'preview_confirm'
  | 'preview_dismiss'
  | 'preview_dismissed_reply'
  | 'preview_thinking'
  | 'preview_activating'
  | 'preview_ai_thinking'
  | 'preview_ai_analysis'
  | 'preview_ai_steps'
  | 'preview_ai_questions'
  | 'preview_ai_risks'
  | 'preview_ai_notes'
  | 'preview_type_simple_hint'
  | 'preview_type_note_hint'
  | 'preview_type_entity_title'
  | 'preview_type_entity_hint'
  | 'preview_type_next'
  | 'preview_type_whats_known'
  | 'unit_preview_chat'
  | 'unit_preview_profile'
  | 'unit_preview_continue'
  | 'unit_preview_missing_fields'
  | 'unit_preview_phase_profiling'
  | 'unit_preview_phase_operating'
  | 'unit_preview_phase_waiting'
  | 'unit_preview_phase_done'
  | 'unit_preview_next_action'
  | 'unit_preview_last_update';

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
  settings_onboarding_experience: 'אונבורדינג',
  settings_onboarding_composer_toggle: 'גרסת הסבר מאוחדת (ספלאש + לנדינג)',
  settings_onboarding_composer_hint:
    'כשהמפסק דלוק — טקסט הלנדינג והספלאש משתמשים בגרסה שמסבירה את ONE, היחידות והזרימה בצורה מקצועית ומאוחדת. אפס חשבון מההתחלה כדי לראות מיד.',
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
  settings_onboarding_experience: 'Onboarding',
  settings_onboarding_composer_toggle: 'Unified product intro (splash + landing)',
  settings_onboarding_composer_hint:
    'When on, splash and landing copy use a curated version that explains ONE, units, and the flow in one coherent narrative. Use “Restart onboarding from scratch” to preview immediately.',
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
  preview_header: 'הבנתי. הנה מה שאני מתכנן:',
  preview_complexity_light: 'קל',
  preview_complexity_moderate: 'בינוני',
  preview_complexity_involved: 'מורכב',
  preview_steps_anticipated: 'שלבים צפויים',
  preview_active_units: 'יחידות פעילות כרגע',
  preview_insight_common: '',
  preview_confirm: 'קדימה',
  preview_dismiss: 'לא עכשיו',
  preview_dismissed_reply: 'הבנתי, נחזור לזה מאוחר יותר.',
  preview_thinking: 'רגע, אני מעבד את זה...',
  preview_activating: 'מוכן. מפעיל.',
  preview_ai_thinking: 'ONE מנתח...',
  preview_ai_analysis: 'ניתוח ONE',
  preview_ai_steps: 'שלבים מוצעים',
  preview_ai_questions: 'לבירור',
  preview_ai_risks: 'שימו לב',
  preview_ai_notes: 'כדאי לדעת',
  preview_type_simple_hint: 'הגדרה מהירה — פרט או שניים',
  preview_type_note_hint: 'התחל להוסיף מה שידוע — ONE יארגן',
  preview_type_entity_title: 'ישות תפעולית',
  preview_type_entity_hint: 'ניהול מתמשך — אנשי קשר, סטטוס, פעולות',
  preview_type_next: 'הבא',
  preview_type_whats_known: 'מה ידוע',
  unit_preview_chat: "צ'אט",
  unit_preview_profile: 'פרופיל',
  unit_preview_continue: 'המשך',
  unit_preview_missing_fields: '{n} שדות חסרים',
  unit_preview_phase_profiling: 'פרופיל',
  unit_preview_phase_operating: 'בתהליך',
  unit_preview_phase_waiting: 'ממתין',
  unit_preview_phase_done: 'הושלם',
  unit_preview_next_action: 'הפעולה הבאה',
  unit_preview_last_update: 'עודכן',
};

const CHAT_EN: Record<ChatChromeKey, string> = {
  chat_title_default: 'My One',
  chat_status_agent: 'Agent',
  chat_status_thinking: 'Thinking...',
  chat_status_planning: 'Planning...',
  chat_status_ready: 'Ready',
  preview_header: "I see what you're after. Here's the plan:",
  preview_complexity_light: 'Light',
  preview_complexity_moderate: 'Moderate',
  preview_complexity_involved: 'Involved',
  preview_steps_anticipated: 'steps anticipated',
  preview_active_units: 'active units right now',
  preview_insight_common: '',
  preview_confirm: "Let's go",
  preview_dismiss: 'Not now',
  preview_dismissed_reply: 'Got it, we can revisit this later.',
  preview_thinking: 'One moment, processing this...',
  preview_activating: 'Ready. Activating.',
  preview_ai_thinking: 'ONE is analyzing...',
  preview_ai_analysis: "ONE's analysis",
  preview_ai_steps: 'Suggested steps',
  preview_ai_questions: 'To clarify',
  preview_ai_risks: 'Watch out',
  preview_ai_notes: 'Good to know',
  preview_type_simple_hint: 'Quick setup — a detail or two',
  preview_type_note_hint: 'Start adding what you know — ONE will organize',
  preview_type_entity_title: 'Operational entity',
  preview_type_entity_hint: 'Ongoing management — contacts, status, actions',
  preview_type_next: 'Next',
  preview_type_whats_known: 'What\'s known',
  unit_preview_chat: 'Chat',
  unit_preview_profile: 'Profile',
  unit_preview_continue: 'Continue',
  unit_preview_missing_fields: '{n} missing fields',
  unit_preview_phase_profiling: 'Profiling',
  unit_preview_phase_operating: 'Operating',
  unit_preview_phase_waiting: 'Waiting',
  unit_preview_phase_done: 'Done',
  unit_preview_next_action: 'Next action',
  unit_preview_last_update: 'Updated',
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
