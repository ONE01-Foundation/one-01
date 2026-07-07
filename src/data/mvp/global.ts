/**
 * global — the ONE01 Global feed.
 *
 * Global is NOT a content feed. It's the layer of the world OUTSIDE the user:
 * official ONEs (businesses / people / institutions), public processes you can
 * JOIN, process TEMPLATES you can create from, AGGREGATE insights drawn from
 * similar processes, and (for business identities) MARKET SIGNALS — real
 * demand intelligence.
 *
 * The rule: every item answers "can I connect to this / create a process from
 * this / is this an official source / does it help a process I have / is it a
 * real-world insight?" — never "is this nice content?".
 *
 * Identity-aware: the same world, filtered by who the user is operating as.
 * Personal → services, templates, public processes. Business → market signals
 * + demand on top.
 *
 * Each actionable card carries an `archetype` so "Create Process" / "Join" can
 * route straight through the rich-unit generator and become a real process.
 */

import type { AppLanguage } from '../../stores/localeStore';
import type { IdentityType } from '../../core/mvp/types';
import type { ArchetypeKey } from './unitArchetype';

export interface OfficialOne {
  id: string;
  emoji: string;
  name: string;
  category: string;
  status: string;
}

export interface PublicProcessCard {
  id: string;
  emoji: string;
  title: string;
  by: string;
  meta: string;
  archetype: ArchetypeKey;
}

export interface TemplateCard {
  id: string;
  emoji: string;
  title: string;
  usedBy: number;
  steps: string[];
  archetype: ArchetypeKey;
}

export interface InsightCard {
  id: string;
  emoji: string;
  title: string;
  points: string[];
  archetype: ArchetypeKey;
}

export interface SignalCard {
  id: string;
  emoji: string;
  text: string;
}

export interface GlobalFeed {
  /** Rotating world-level broadcast lines. */
  broadcasts: string[];
  officials: OfficialOne[];
  publicProcesses: PublicProcessCard[];
  templates: TemplateCard[];
  insights: InsightCard[];
  /** Empty unless the active identity is a business. */
  signals: SignalCard[];
}

export function buildGlobalFeed(
  lang: AppLanguage,
  identityType: IdentityType | undefined,
): GlobalFeed {
  const t = (en: string, he: string) => (lang === 'he' ? he : en);
  const business = identityType === 'business';

  const broadcasts = [
    t('People are starting apartment-move processes this week.', 'אנשים מתחילים השבוע תהליכי מעבר דירה.'),
    t('3 official businesses near you can help with appointments.', '3 עסקים רשמיים לידך יכולים לעזור עם תורים.'),
    t('A new desert trip is open for registration.', 'טיול מדבר חדש פתוח להרשמה.'),
    t('Weight-gain templates are used by 2,400 people.', 'תבניות עלייה במשקל בשימוש 2,400 אנשים.'),
    t("Common blocker today: missing documents.", 'החסם הנפוץ היום: מסמכים חסרים.'),
  ];

  const officials: OfficialOne[] = [
    {
      id: 'off_salon',
      emoji: '💇',
      name: t('Sarah Salon', 'מספרת שרה'),
      category: t('Haircuts · color · beard trim', 'תספורות · צבע · זקן'),
      status: t('Open today until 20:00', 'פתוח היום עד 20:00'),
    },
    {
      id: 'off_clinic',
      emoji: '🩺',
      name: t('Dr. Cohen Clinic', 'מרפאת ד״ר כהן'),
      category: t('Appointments · documents · treatment', 'תורים · מסמכים · טיפול'),
      status: t('Next opening: tomorrow 09:00', 'תור פנוי: מחר 09:00'),
    },
    {
      id: 'off_trips',
      emoji: '🏜️',
      name: t('Desert Trips', 'טיולי מדבר'),
      category: t('Public trips · registration', 'טיולים ציבוריים · הרשמה'),
      status: t('3 trips this month', '3 טיולים החודש'),
    },
  ];

  const publicProcesses: PublicProcessCard[] = [
    {
      id: 'pp_desert',
      emoji: '🌌',
      title: t('Night Trip to the Desert', 'טיול לילה במדבר'),
      by: t('Desert Trips', 'טיולי מדבר'),
      meta: t('Thursday · 250₪ · 8 seats left', 'חמישי · 250₪ · 8 מקומות'),
      archetype: 'travel',
    },
    {
      id: 'pp_english',
      emoji: '🗣️',
      title: t('English Course — Beginners', 'קורס אנגלית — מתחילים'),
      by: t('SpeakNow School', 'בית הספר SpeakNow'),
      meta: t('Starts Sunday · 12 weeks', 'מתחיל ראשון · 12 שבועות'),
      archetype: 'learning',
    },
  ];

  const templates: TemplateCard[] = [
    {
      id: 'tpl_move',
      emoji: '📦',
      title: t('Move Apartment', 'מעבר דירה'),
      usedBy: 12000,
      steps: [
        t('Contract', 'חוזה'),
        t('Moving company', 'חברת הובלה'),
        t('Packing', 'אריזה'),
        t('Utilities', 'שירותים'),
        t('Address update', 'עדכון כתובת'),
      ],
      archetype: 'moving',
    },
    {
      id: 'tpl_weight',
      emoji: '🏋️',
      title: t('Weight Gain', 'עלייה במשקל'),
      usedBy: 2400,
      steps: [
        t('Current weight', 'משקל נוכחי'),
        t('Goal weight', 'משקל יעד'),
        t('Calories', 'קלוריות'),
        t('Workout routine', 'שגרת אימונים'),
        t('Tracking', 'מעקב'),
      ],
      archetype: 'fitness',
    },
    {
      id: 'tpl_license',
      emoji: '🚗',
      title: t('Driving License', 'רישיון נהיגה'),
      usedBy: 8600,
      steps: [
        t('Theory', 'תיאוריה'),
        t('Eye test', 'בדיקת ראייה'),
        t('Lessons', 'שיעורים'),
        t('Test', 'טסט'),
      ],
      archetype: 'license',
    },
    {
      id: 'tpl_trip',
      emoji: '✈️',
      title: t('Plan a Trip', 'תכנון טיול'),
      usedBy: 5300,
      steps: [
        t('Dates', 'תאריכים'),
        t('Budget', 'תקציב'),
        t('Flights', 'טיסות'),
        t('Accommodation', 'לינה'),
        t('Route', 'מסלול'),
      ],
      archetype: 'travel',
    },
  ];

  const insights: InsightCard[] = [
    {
      id: 'ins_move',
      emoji: '📦',
      title: t('Moving apartments', 'מעבר דירה'),
      points: [
        t('Moving-company quote', 'הצעת מחיר הובלה'),
        t('Contract dates', 'תאריכי חוזה'),
        t('Utility transfer', 'העברת שירותים'),
      ],
      archetype: 'moving',
    },
    {
      id: 'ins_license',
      emoji: '🚗',
      title: t('Driving license', 'רישיון נהיגה'),
      points: [t('Most slow down right before booking the test.', 'רובם נתקעים בדיוק לפני קביעת הטסט.')],
      archetype: 'license',
    },
    {
      id: 'ins_trip',
      emoji: '✈️',
      title: t('Planning a trip', 'תכנון טיול'),
      points: [t('Budget, dates, people and documents come first.', 'קודם תקציב, תאריכים, אנשים ומסמכים.')],
      archetype: 'travel',
    },
  ];

  const signals: SignalCard[] = business
    ? [
        { id: 'sig_1', emoji: '📍', text: t('18 people near Jerusalem are looking for a trip next week.', '18 אנשים ליד ירושלים מחפשים טיול בשבוע הבא.') },
        { id: 'sig_2', emoji: '✂️', text: t('12 people nearby searched for haircut appointments this week.', '12 אנשים בסביבה חיפשו תורים לתספורת השבוע.') },
        { id: 'sig_3', emoji: '❓', text: t('Most questions this week were about first-treatment price.', 'רוב השאלות השבוע היו על מחיר טיפול ראשון.') },
      ]
    : [];

  return { broadcasts, officials, publicProcesses, templates, insights, signals };
}
