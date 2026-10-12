/**
 * global — the ONE01 Global feed.
 *
 * Global is NOT a content feed. It's the layer of the world OUTSIDE the user —
 * built as a real-time MARKETPLACE OF WANTS: what every ONE out there is trying
 * to move forward right now. On top of the live wants sit the durable sources:
 * official ONEs (businesses / people / institutions), public processes you can
 * JOIN, process TEMPLATES you can create from, AGGREGATE insights, and (for a
 * business identity) MARKET SIGNALS — real demand intelligence.
 *
 * The rule: every item answers "can I connect to this / create a process from
 * this / respond to this want?" — never "is this nice content?".
 *
 * Identity-aware: the same world, filtered by who the user is operating as.
 * Everything is tagged with a CATEGORY so the category chips + topic hashtags
 * can filter the whole surface (live wants + drawers) at once.
 *
 * Each actionable card carries an `archetype` so "Create Process" / "Join" /
 * "Respond" can route straight through the rich-unit generator.
 */

import type { AppLanguage } from '../../stores/localeStore';
import type { IdentityType } from '../../core/mvp/types';
import type { ArchetypeKey } from './unitArchetype';

// ── Categories ────────────────────────────────────────────────────────────
// One taxonomy across the whole Global surface. 'all' is the default chip.
export type CategoryKey =
  | 'all'
  | 'health'
  | 'fitness'
  | 'learning'
  | 'home'
  | 'travel'
  | 'business'
  | 'bureaucracy';

export interface Category {
  key: CategoryKey;
  emoji: string;
  label: string;
}

// ── Card shapes (each now carries a category for filtering) ────────────────
export interface WantCard {
  id: string;
  emoji: string;
  category: CategoryKey;
  /** What someone out there is trying to move forward, right now. */
  text: string;
  /** Distance / time / count — the "live" texture. */
  meta: string;
  /** If the want maps to a process the user can start themselves. */
  archetype?: ArchetypeKey;
}

export interface OfficialOne {
  id: string;
  emoji: string;
  name: string;
  category: string;
  status: string;
  cat: CategoryKey;
}

export interface PublicProcessCard {
  id: string;
  emoji: string;
  title: string;
  by: string;
  meta: string;
  archetype: ArchetypeKey;
  cat: CategoryKey;
}

export interface TemplateCard {
  id: string;
  emoji: string;
  title: string;
  usedBy: number;
  steps: string[];
  archetype: ArchetypeKey;
  cat: CategoryKey;
}

export interface InsightCard {
  id: string;
  emoji: string;
  title: string;
  points: string[];
  archetype: ArchetypeKey;
  cat: CategoryKey;
}

export interface SignalCard {
  id: string;
  emoji: string;
  text: string;
  cat: CategoryKey;
}

export interface GlobalFeed {
  /** Rotating world-level broadcast lines (kept for other surfaces). */
  broadcasts: string[];
  /** The chip taxonomy (localized, 'all' first). */
  categories: Category[];
  /** Specific topic hashtags per category — the second, finer filter row. */
  hashtagsByCategory: Record<CategoryKey, string[]>;
  /** The live marketplace of wants — the top loop. */
  wants: WantCard[];
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
    t('Common blocker today: missing documents.', 'החסם הנפוץ היום: מסמכים חסרים.'),
  ];

  // ONE leads (the whole world — key stays 'all' so the filter still means
  // "everything"; the chip shows ONE's orb, not an emoji). Fitness folds INTO
  // Health, so it's no longer its own chip. Icons are drawn in the component.
  const categories: Category[] = [
    { key: 'all', emoji: '', label: 'ONE' },
    { key: 'health', emoji: '🩺', label: t('Health', 'בריאות') },
    { key: 'learning', emoji: '📚', label: t('Learning', 'לימודים') },
    { key: 'home', emoji: '🏠', label: t('Home', 'בית ומעבר') },
    { key: 'travel', emoji: '✈️', label: t('Travel', 'טיולים') },
    { key: 'business', emoji: '💼', label: t('Business', 'עסקים') },
    { key: 'bureaucracy', emoji: '📋', label: t('Bureaucracy', 'בירוקרטיה') },
  ];

  const hashtagsByCategory: Record<CategoryKey, string[]> = {
    all: [
      t('#apartment-move', '#מעבר_דירה'),
      t('#driving-license', '#רישיון_נהיגה'),
      t('#english', '#אנגלית'),
      t('#desert-trip', '#טיול_מדבר'),
      t('#weight-gain', '#עלייה_במשקל'),
    ],
    health: [
      t('#doctor-appointment', '#תור_רופא'),
      t('#dentist', '#שיניים'),
      t('#checkups', '#בדיקות'),
      t('#haircut', '#תספורת'),
    ],
    fitness: [
      t('#weight-gain', '#עלייה_במשקל'),
      t('#workouts', '#אימונים'),
      t('#nutrition', '#תזונה'),
    ],
    learning: [
      t('#english', '#אנגלית'),
      t('#degree', '#תואר'),
      t('#online-course', '#קורס_אונליין'),
      t('#exam', '#מבחן'),
    ],
    home: [
      t('#apartment-move', '#מעבר_דירה'),
      t('#movers', '#הובלה'),
      t('#furniture', '#ריהוט'),
      t('#rent', '#שכירות'),
    ],
    travel: [
      t('#desert-trip', '#טיול_מדבר'),
      t('#flights', '#טיסות'),
      t('#hotel', '#מלון'),
      t('#weekend', '#סופש'),
    ],
    business: [
      t('#customers', '#לקוחות'),
      t('#leads', '#לידים'),
      t('#marketing', '#שיווק'),
    ],
    bureaucracy: [
      t('#driving-license', '#רישיון_נהיגה'),
      t('#documents', '#מסמכים'),
      t('#insurance', '#ביטוח'),
    ],
  };

  // The live marketplace — what ONEs out there want right now. This is the
  // headline loop of Global; it should read as a real-time pulse of demand.
  const wants: WantCard[] = [
    {
      id: 'want_move',
      emoji: '📦',
      category: 'home',
      text: t('Someone 2km away is starting an apartment move and looking for movers.', 'מישהו במרחק 2 ק״מ מתחיל מעבר דירה ומחפש מובילים.'),
      meta: t('2 km away · just now', '2 ק״מ · הרגע'),
      archetype: 'moving',
    },
    {
      id: 'want_english',
      emoji: '🗣️',
      category: 'learning',
      text: t('4 people near you are looking for a private English tutor.', '4 אנשים לידך מחפשים מורה פרטי לאנגלית.'),
      meta: t('near you · this week', 'באזורך · השבוע'),
      archetype: 'learning',
    },
    {
      id: 'want_haircut',
      emoji: '💇',
      category: 'health',
      text: t('Someone wants a haircut appointment for today.', 'מישהו מחפש תור לתספורת להיום.'),
      meta: t('nearby · today', 'בסביבה · היום'),
    },
    {
      id: 'want_desert',
      emoji: '🏜️',
      category: 'travel',
      text: t('A group is forming for a desert trip this weekend.', 'קבוצה מתארגנת לטיול מדבר בסופ״ש.'),
      meta: t('8 seats left · Thursday', '8 מקומות · חמישי'),
      archetype: 'travel',
    },
    {
      id: 'want_weight',
      emoji: '🏋️',
      category: 'fitness',
      text: t('12 people started a weight-gain process this week.', '12 אנשים התחילו תהליך עלייה במשקל השבוע.'),
      meta: t('trending · this week', 'עולה · השבוע'),
      archetype: 'fitness',
    },
    {
      id: 'want_license',
      emoji: '🚗',
      category: 'bureaucracy',
      text: t('Someone is starting the driving-license process from scratch.', 'מישהו מתחיל תהליך רישיון נהיגה מאפס.'),
      meta: t('just now', 'הרגע'),
      archetype: 'license',
    },
    {
      id: 'want_dentist',
      emoji: '🦷',
      category: 'health',
      text: t('Someone is looking for a dentist available this week.', 'מישהו מחפש רופא שיניים זמין השבוע.'),
      meta: t('nearby · this week', 'בסביבה · השבוע'),
    },
    {
      id: 'want_biz',
      emoji: '💼',
      category: 'business',
      text: t('A new business is looking for its first customers nearby.', 'עסק חדש מחפש לקוחות ראשונים באזורך.'),
      meta: t('new · near you', 'חדש · באזורך'),
      archetype: 'business',
    },
  ];

  const officials: OfficialOne[] = [
    {
      id: 'off_salon',
      emoji: '💇',
      name: t('Sarah Salon', 'מספרת שרה'),
      category: t('Haircuts · color · beard trim', 'תספורות · צבע · זקן'),
      status: t('Open today until 20:00', 'פתוח היום עד 20:00'),
      cat: 'health',
    },
    {
      id: 'off_clinic',
      emoji: '🩺',
      name: t('Dr. Cohen Clinic', 'מרפאת ד״ר כהן'),
      category: t('Appointments · documents · treatment', 'תורים · מסמכים · טיפול'),
      status: t('Next opening: tomorrow 09:00', 'תור פנוי: מחר 09:00'),
      cat: 'health',
    },
    {
      id: 'off_trips',
      emoji: '🏜️',
      name: t('Desert Trips', 'טיולי מדבר'),
      category: t('Public trips · registration', 'טיולים ציבוריים · הרשמה'),
      status: t('3 trips this month', '3 טיולים החודש'),
      cat: 'travel',
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
      cat: 'travel',
    },
    {
      id: 'pp_english',
      emoji: '🗣️',
      title: t('English Course — Beginners', 'קורס אנגלית — מתחילים'),
      by: t('SpeakNow School', 'בית הספר SpeakNow'),
      meta: t('Starts Sunday · 12 weeks', 'מתחיל ראשון · 12 שבועות'),
      archetype: 'learning',
      cat: 'learning',
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
      cat: 'home',
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
      cat: 'fitness',
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
      cat: 'bureaucracy',
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
      cat: 'travel',
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
      cat: 'home',
    },
    {
      id: 'ins_license',
      emoji: '🚗',
      title: t('Driving license', 'רישיון נהיגה'),
      points: [t('Most slow down right before booking the test.', 'רובם נתקעים בדיוק לפני קביעת הטסט.')],
      archetype: 'license',
      cat: 'bureaucracy',
    },
    {
      id: 'ins_trip',
      emoji: '✈️',
      title: t('Planning a trip', 'תכנון טיול'),
      points: [t('Budget, dates, people and documents come first.', 'קודם תקציב, תאריכים, אנשים ומסמכים.')],
      archetype: 'travel',
      cat: 'travel',
    },
  ];

  const signals: SignalCard[] = business
    ? [
        { id: 'sig_1', emoji: '📍', text: t('18 people near Jerusalem are looking for a trip next week.', '18 אנשים ליד ירושלים מחפשים טיול בשבוע הבא.'), cat: 'travel' },
        { id: 'sig_2', emoji: '✂️', text: t('12 people nearby searched for haircut appointments this week.', '12 אנשים בסביבה חיפשו תורים לתספורת השבוע.'), cat: 'health' },
        { id: 'sig_3', emoji: '❓', text: t('Most questions this week were about first-treatment price.', 'רוב השאלות השבוע היו על מחיר טיפול ראשון.'), cat: 'business' },
      ]
    : [];

  return {
    broadcasts,
    categories,
    hashtagsByCategory,
    wants,
    officials,
    publicProcesses,
    templates,
    insights,
    signals,
  };
}
