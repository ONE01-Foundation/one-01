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

/** Visible chrome added during the new MVP redesign — Home, sheets, input. */
export type HomeChromeKey =
  // Home: broadcast / status / input
  | 'home_input_placeholder_rest'           // "Talk to ONE."
  | 'home_chat_cta'                         // "What matters most right now?"
  | 'home_chat_status_thinking'             // "Thinking…"
  | 'home_chat_status_searching'            // "Searching memory…"
  | 'home_chat_status_updating'             // "Updating…"
  | 'home_broadcast_closing'                // "What do you want to move forward?"
  | 'home_broadcast_empty_1'                // "What do you want to move forward?"
  | 'home_broadcast_empty_2'                // "Tell me, and I'll keep it moving."
  | 'home_broadcast_empty_3'                // "Start with anything on your mind."
  | 'home_broadcast_urgency_hint'           // "Nothing needs you right now."
  | 'home_broadcast_holding'                // "I'm holding what you started."
  | 'home_broadcast_holding_business'       // "I'm on the open items for you."
  | 'home_broadcast_holding_family'         // "I'm holding everyone's threads."
  // Greetings (time of day)
  | 'home_greet_late'                       // "It's late{, name}."
  | 'home_greet_morning'                    // "Good morning{, name}."
  | 'home_greet_afternoon'                  // "Good afternoon{, name}."
  | 'home_greet_evening'                    // "Good evening{, name}."
  | 'home_greet_night'                      // "Still up{, name}?"
  // Card pills
  | 'card_pin'
  | 'card_share'
  | 'card_delete'
  | 'card_done'                             // "Done ✓"
  | 'card_timestamp_yesterday'              // "Yesterday"
  // Identity sheet
  | 'identity_new_one'                      // "New ONE"
  | 'identity_role_personal'
  | 'identity_role_business'
  | 'identity_role_family'
  // ONE profile sheet
  | 'one_profile_label'                     // "ONE"
  | 'one_profile_stat_connections'
  | 'one_profile_stat_trust_points'
  | 'one_profile_stat_possesses'
  | 'one_profile_section_appearance'
  | 'one_profile_section_language'
  | 'one_profile_section_identities'
  | 'one_profile_all_settings'
  // Quick actions sheet
  | 'qa_title'                              // "What should I do?"
  | 'qa_subtitle'                           // "Hand me anything…"
  | 'qa_attach_photo'
  | 'qa_attach_photo_hint'
  | 'qa_take_photo'
  | 'qa_take_photo_hint'
  | 'qa_attach_document'
  | 'qa_attach_document_hint'
  | 'qa_voice_memo'
  | 'qa_voice_memo_hint'
  | 'qa_new_process'
  | 'qa_new_process_hint'
  | 'qa_stub_alert_body'                    // "I'll wire this up when the picker module lands."
  // Unit profile sheet
  | 'unit_section_people'
  | 'unit_section_insights'
  | 'unit_section_assets'
  | 'unit_section_timeline'
  | 'unit_section_history'
  | 'unit_section_settings'
  | 'unit_settings_name'
  | 'unit_settings_visibility'
  | 'unit_settings_identity'
  | 'unit_empty_assets'
  | 'unit_empty_timeline'
  | 'unit_empty_history'
  | 'unit_chat_start'                       // "Start the conversation..."
  | 'common_open_settings'                  // "Open settings"
  | 'common_close'                          // "Close"
  | 'common_open_one_profile'               // accessibility label
  | 'common_open_one_profile_long_press';

export type AppStringKey = SettingsStringKey | ChatChromeKey | HomeChromeKey;

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
    'When on, splash and landing copy use a curated version that explains ONE, units, and the flow in one coherent narrative. Use "Restart onboarding from scratch" to preview immediately.',
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

const HOME_HE: Record<HomeChromeKey, string> = {
  home_input_placeholder_rest: 'דבר עם ONE.',
  home_chat_cta: 'מה הכי חשוב לך עכשיו?',
  home_chat_status_thinking: 'חושב…',
  home_chat_status_searching: 'מחפש בזיכרון…',
  home_chat_status_updating: 'מעדכן…',
  home_broadcast_closing: 'מה אתה רוצה להתקדם בו?',
  home_broadcast_empty_1: 'מה אתה רוצה להתקדם בו?',
  home_broadcast_empty_2: 'תגיד לי, ואני אשמור על תנועה.',
  home_broadcast_empty_3: 'נתחיל ממה שעל הלב.',
  home_broadcast_urgency_hint: 'אין משהו דחוף כרגע.',
  home_broadcast_holding: 'אני מחזיק את מה שהתחלת.',
  home_broadcast_holding_business: 'אני על הפתוחות בשבילך.',
  home_broadcast_holding_family: 'אני שומר על כל החוטים של המשפחה.',
  home_greet_late: 'מאוחר{name}.',
  home_greet_morning: 'בוקר טוב{name}.',
  home_greet_afternoon: 'צהריים טובים{name}.',
  home_greet_evening: 'ערב טוב{name}.',
  home_greet_night: 'עוד ער{name}?',
  card_pin: 'הצמד',
  card_share: 'שתף',
  card_delete: 'מחק',
  card_done: 'הושלם ✓',
  card_timestamp_yesterday: 'אתמול',
  identity_new_one: 'ONE חדש',
  identity_role_personal: 'אישי',
  identity_role_business: 'עסקי',
  identity_role_family: 'משפחה',
  one_profile_label: 'ONE',
  one_profile_stat_connections: 'קשרים',
  one_profile_stat_trust_points: 'נקודות אמון',
  one_profile_stat_possesses: 'נמצאים',
  one_profile_section_appearance: 'מראה',
  one_profile_section_language: 'שפה',
  one_profile_section_identities: 'זהויות',
  one_profile_all_settings: 'כל ההגדרות',
  qa_title: 'מה לעשות?',
  qa_subtitle: 'תן לי כל דבר — אני אשייך אותו לתהליך המתאים.',
  qa_attach_photo: 'צרף תמונה',
  qa_attach_photo_hint: 'מהספרייה שלך',
  qa_take_photo: 'צלם תמונה',
  qa_take_photo_hint: 'מהמצלמה',
  qa_attach_document: 'צרף מסמך',
  qa_attach_document_hint: 'PDF, וורד, כל פורמט',
  qa_voice_memo: 'הקלטה',
  qa_voice_memo_hint: 'תקליט ואני אתמלל',
  qa_new_process: 'תהליך חדש',
  qa_new_process_hint: 'התחל משהו מחדש',
  qa_stub_alert_body: 'אני אחבר את זה כשמודול הבחירה ינחת.',
  unit_section_people: 'אנשים',
  unit_section_insights: 'תובנות',
  unit_section_assets: 'נכסים',
  unit_section_timeline: 'ציר זמן',
  unit_section_history: 'היסטוריה',
  unit_section_settings: 'הגדרות תהליך',
  unit_settings_name: 'שם',
  unit_settings_visibility: 'נראות',
  unit_settings_identity: 'זהות',
  unit_empty_assets: 'אין קבצים עדיין.',
  unit_empty_timeline: 'פעילות תופיע כאן ככל שהתהליך יתקדם.',
  unit_empty_history: 'אין היסטוריה עדיין.',
  unit_chat_start: 'התחל את השיחה...',
  common_open_settings: 'פתח הגדרות',
  common_close: 'סגור',
  common_open_one_profile: 'פתח פרופיל ONE',
  common_open_one_profile_long_press: 'לחיצה ארוכה למעבר בין זהויות',
};

const HOME_EN: Record<HomeChromeKey, string> = {
  home_input_placeholder_rest: 'Talk to ONE.',
  home_chat_cta: 'What matters most right now?',
  home_chat_status_thinking: 'Thinking…',
  home_chat_status_searching: 'Searching memory…',
  home_chat_status_updating: 'Updating…',
  home_broadcast_closing: 'What do you want to move forward?',
  home_broadcast_empty_1: 'What do you want to move forward?',
  home_broadcast_empty_2: "Tell me, and I'll keep it moving.",
  home_broadcast_empty_3: 'Start with anything on your mind.',
  home_broadcast_urgency_hint: 'Nothing needs you right now.',
  home_broadcast_holding: "I'm holding what you started.",
  home_broadcast_holding_business: "I'm on the open items for you.",
  home_broadcast_holding_family: "I'm holding everyone's threads.",
  home_greet_late: "It's late{name}.",
  home_greet_morning: 'Good morning{name}.',
  home_greet_afternoon: 'Good afternoon{name}.',
  home_greet_evening: 'Good evening{name}.',
  home_greet_night: 'Still up{name}?',
  card_pin: 'Pin',
  card_share: 'Share',
  card_delete: 'Delete',
  card_done: 'Done ✓',
  card_timestamp_yesterday: 'Yesterday',
  identity_new_one: 'New ONE',
  identity_role_personal: 'Personal',
  identity_role_business: 'Business',
  identity_role_family: 'Family',
  one_profile_label: 'ONE',
  one_profile_stat_connections: 'CONNECTIONS',
  one_profile_stat_trust_points: 'TRUST POINTS',
  one_profile_stat_possesses: 'POSSESSES',
  one_profile_section_appearance: 'Appearance',
  one_profile_section_language: 'Language',
  one_profile_section_identities: 'Identities',
  one_profile_all_settings: 'All settings',
  qa_title: 'What should I do?',
  qa_subtitle: "Hand me anything — I'll route it to the right process.",
  qa_attach_photo: 'Attach photo',
  qa_attach_photo_hint: 'From your library',
  qa_take_photo: 'Take photo',
  qa_take_photo_hint: 'Use the camera',
  qa_attach_document: 'Attach document',
  qa_attach_document_hint: 'PDF, Word, anything',
  qa_voice_memo: 'Voice memo',
  qa_voice_memo_hint: 'Record + transcribe',
  qa_new_process: 'New process',
  qa_new_process_hint: 'Start something from scratch',
  qa_stub_alert_body: "I'll wire this up when the picker module lands.",
  unit_section_people: 'People',
  unit_section_insights: 'Insights',
  unit_section_assets: 'Assets',
  unit_section_timeline: 'Timeline',
  unit_section_history: 'History',
  unit_section_settings: 'Process Settings',
  unit_settings_name: 'Name',
  unit_settings_visibility: 'Visibility',
  unit_settings_identity: 'Identity',
  unit_empty_assets: 'No files yet.',
  unit_empty_timeline: 'Activity will appear here as the process moves forward.',
  unit_empty_history: 'No history yet.',
  unit_chat_start: 'Start the conversation...',
  common_open_settings: 'Open settings',
  common_close: 'Close',
  common_open_one_profile: 'Open ONE profile',
  common_open_one_profile_long_press: 'Long press for identity switch',
};

const DICT: Record<AppLanguage, Record<AppStringKey, string>> = {
  he: { ...SETTINGS_HE, ...CHAT_HE, ...HOME_HE },
  en: { ...SETTINGS_EN, ...CHAT_EN, ...HOME_EN },
};

export function translate(lang: AppLanguage, key: AppStringKey): string {
  return DICT[lang][key] ?? key;
}

/**
 * Time-of-day greeting that respects the active language and (optional)
 * identity name. Hebrew puts the comma+name AFTER the greeting just like
 * English; both branches use the same `{name}` placeholder which is filled
 * here so callers don't need to format.
 */
export function localizedGreeting(lang: AppLanguage, identityName?: string, now: Date = new Date()): string {
  const h = now.getHours();
  let key: HomeChromeKey;
  if (h < 5) key = 'home_greet_late';
  else if (h < 12) key = 'home_greet_morning';
  else if (h < 17) key = 'home_greet_afternoon';
  else if (h < 22) key = 'home_greet_evening';
  else key = 'home_greet_night';
  const namePart = identityName ? `, ${identityName}` : '';
  return translate(lang, key).replace('{name}', namePart);
}

/** שורת משנה בכותרת צ׳אט ליחידה — ללא מילה "Steps" באנגלית במצב עברית */
export function formatChatUnitProgressLine(language: AppLanguage, progress: number, steps: number): string {
  if (language === 'he') {
    return `${progress}% · ${steps} צעדים`;
  }
  return `${progress}% · ${steps} Steps`;
}

const LRI = '⁦';
const PDI = '⁩';

/**
 * במצב עברית + RTL, קטעי Latin בתוך כותרת לא אמורים לשבור את כיוון הפסקה.
 * עוטף רצפי ASCII ב־LRI…PDI (Unicode bidi isolate).
 */
export function embedLatinRunsForRtlDisplay(text: string, language: AppLanguage): string {
  if (language !== 'he' || !text) return text;
  return text.replace(/[A-Za-z][A-Za-z0-9\s.,%·'\-/]*/g, (run) => LRI + run + PDI);
}
