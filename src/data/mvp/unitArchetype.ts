/**
 * unitArchetype — ONE's "full process" generator.
 *
 * A process (Unit) should never be born as a bare title. This module turns a
 * desire ("I want to get my driving license", "lose 8kg", "move apartments")
 * into a RICH, fully-populated Unit: realistic metrics, a multi-step plan with
 * some steps already checked, the people involved, assets, a short history
 * timeline, insights ONE has "noticed", decisions, and live reminders.
 *
 * It powers two things:
 *   1. The Settings → "Generate a full test process" button (deterministic
 *      rotation through the archetypes), so the content structure can be
 *      tested end-to-end without an AI round-trip.
 *   2. A domain-aware enrichment layer ONE can lean on when the AI returns a
 *      thin process — `generateRichUnit(desire, …)` keyword-detects the domain
 *      and fills a complete archetype.
 *
 * Bilingual: every string is authored EN + HE and resolved by the active
 * language. Pure-ish — callers pass `now` so timestamps are deterministic.
 */

import type {
  Unit,
  UnitActionType,
  UnitAsset,
  UnitBroadcastType,
  UnitPerson,
  TagId,
} from '../../core/mvp/types';
import { TAG_COLORS } from '../../core/mvp/types';
import type { AppLanguage } from '../../stores/localeStore';

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

let archetypeCounter = 0;
function uid(prefix: string, now: number): string {
  archetypeCounter += 1;
  return `${prefix}_${now}_${archetypeCounter}`;
}

/** Pick EN/HE by language. Authored inline so each archetype reads top-down. */
type Pick = (en: string, he: string) => string;

export type ArchetypeKey =
  | 'fitness'
  | 'license'
  | 'moving'
  | 'learning'
  | 'business'
  | 'travel';

export const ARCHETYPE_KEYS: ArchetypeKey[] = [
  'fitness',
  'license',
  'moving',
  'learning',
  'business',
  'travel',
];

/** The shape each archetype emits — already language-resolved. Mapped onto a
 *  full Unit by `assembleUnit`. */
interface RichContent {
  emoji: string;
  tag: TagId;
  title: string;
  progress: { current: number; total: number; label?: string };
  relationLabel: string;
  broadcast: string;
  broadcastSecondary?: string;
  metrics: Array<{ label: string; value: string; unit?: string; trend?: string }>;
  quickActions: Array<{ label: string; actionType: UnitActionType }>;
  /** [title, subtitle?, done?] steps — a real plan, some already checked. */
  nextSteps: Array<{ title: string; subtitle?: string; done?: boolean }>;
  people: Array<{ name: string; role: string; connectionType?: UnitPerson['connectionType'] }>;
  assets: Array<{ title: string; type: UnitAsset['type'] }>;
  /** Timeline entries, newest-first by `daysAgo`. */
  timeline: Array<{ title: string; subtitle?: string; daysAgo: number }>;
  insights: string[];
  decisions: Array<{ text: string; rationale?: string }>;
  reminders: Array<{ text: string; dueLabel?: string; dueInHours?: number; done?: boolean }>;
}

// ── Domain detection ────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<ArchetypeKey, RegExp> = {
  fitness:
    /weight|lose|gym|workout|fit|muscle|diet|run|כושר|לרזות|משקל|חדר כושר|אימון|דיאטה|לרוץ|שריר/i,
  license:
    /licen[cs]e|driving|driver|test|rishayon|רישיון|נהיגה|טסט|תיאוריה|מבחן/i,
  moving:
    /mov(e|ing)|apartment|relocat|house|rent|דירה|מעבר|לעבור|שכירות|בית|הובלה/i,
  learning:
    /learn|course|study|skill|language|degree|ללמוד|קורס|לימוד|שפה|מיומנות|תואר/i,
  business:
    /business|client|lead|launch|startup|sale|freelanc|עסק|לקוח|ליד|השקה|מכירה|פרילנס/i,
  travel:
    /trip|travel|flight|vacation|abroad|holiday|טיול|נסיעה|טיסה|חופשה|חו"ל|חול/i,
};

/** Keyword-detect the best archetype for a desire. Falls back to 'learning'
 *  (the most generic "make progress on something" shape). */
export function detectArchetype(desire: string): ArchetypeKey {
  for (const key of ARCHETYPE_KEYS) {
    if (DOMAIN_KEYWORDS[key].test(desire)) return key;
  }
  return 'learning';
}

// ── Archetypes ──────────────────────────────────────────────────────────────

function buildContent(key: ArchetypeKey, desire: string, t: Pick): RichContent {
  switch (key) {
    case 'fitness':
      return {
        emoji: '🏋️',
        tag: 'fitness',
        title: desire || t('Get in shape', 'להיכנס לכושר'),
        progress: { current: 7, total: 24, label: t('weeks', 'שבועות') },
        relationLabel: t('Coach Eli +1', 'מאמן אלי +1'),
        broadcast: t("You're 2.4kg down — momentum is real.", 'ירדת 2.4 ק״ג — יש תנופה.'),
        broadcastSecondary: t('Next workout today at 18:00.', 'האימון הבא היום ב־18:00.'),
        metrics: [
          { label: t('Weight', 'משקל'), value: '79.6', unit: 'kg', trend: '-2.4' },
          { label: t('Goal', 'יעד'), value: '74', unit: 'kg' },
          { label: t('Workouts / wk', 'אימונים בשבוע'), value: '3', unit: '' },
          { label: t('Streak', 'רצף'), value: '12', unit: t('days', 'ימים') },
        ],
        quickActions: [
          { label: t('Log weight', 'רישום משקל'), actionType: 'log_weight' },
          { label: t('Add workout', 'הוסף אימון'), actionType: 'start_workout' },
          { label: t('Log meal', 'רישום ארוחה'), actionType: 'add_meal' },
        ],
        nextSteps: [
          { title: t('Set a weekly schedule', 'לקבוע לוז שבועי'), done: true },
          { title: t('Log starting weight (82kg)', 'לרשום משקל התחלה (82 ק״ג)'), done: true },
          { title: t('Hit 3 workouts this week', 'להשלים 3 אימונים השבוע'), subtitle: t('2 of 3 done', '2 מתוך 3') },
          { title: t('Prep meals for the week', 'להכין ארוחות לשבוע') },
          { title: t('Book a progress check with Eli', 'לקבוע בדיקת התקדמות עם אלי') },
        ],
        people: [
          { name: t('Eli', 'אלי'), role: t('Coach', 'מאמן'), connectionType: 'coach' },
          { name: t('Maya', 'מאיה'), role: t('Nutritionist', 'תזונאית'), connectionType: 'provider' },
        ],
        assets: [
          { title: t('Training plan.pdf', 'תוכנית אימונים.pdf'), type: 'document' },
          { title: t('Meal guide', 'מדריך תזונה'), type: 'note' },
          { title: t('Progress photos', 'תמונות התקדמות'), type: 'image' },
        ],
        timeline: [
          { title: t('Logged 79.6kg', 'נרשם 79.6 ק״ג'), subtitle: t('-2.4 from start', '-2.4 מההתחלה'), daysAgo: 0 },
          { title: t('Completed leg day', 'הושלם אימון רגליים'), daysAgo: 2 },
          { title: t('Started the program', 'התחלת את התוכנית'), daysAgo: 49 },
        ],
        insights: [
          t('You train most consistently on Mon / Wed / Fri.', 'אתה מתאמן הכי בעקביות בימי שני / רביעי / שישי.'),
          t('Weeks you log meals, you lose ~2× faster.', 'בשבועות שאתה מתעד ארוחות, אתה יורד פי ~2 מהר יותר.'),
        ],
        decisions: [
          { text: t('Train at 18:00, not mornings', 'להתאמן ב־18:00, לא בבקרים'), rationale: t('Higher show-up rate after work.', 'אחוז הגעה גבוה יותר אחרי העבודה.') },
        ],
        reminders: [
          { text: t('Workout — leg day', 'אימון — יום רגליים'), dueLabel: t('today 18:00', 'היום 18:00'), dueInHours: 5 },
          { text: t('Weigh in', 'שקילה'), dueLabel: t('Sunday morning', 'ראשון בבוקר'), dueInHours: 40 },
        ],
      };

    case 'license':
      return {
        emoji: '🚗',
        tag: 'legal',
        title: desire || t('Get my driving license', 'להוציא רישיון נהיגה'),
        progress: { current: 18, total: 28, label: t('lessons', 'שיעורים') },
        relationLabel: t('Instructor Dani', 'מורה דני'),
        broadcast: t('Theory passed. 18/28 lessons done.', 'תיאוריה עברת. 18/28 שיעורים.'),
        broadcastSecondary: t('Ready to book the test soon.', 'כמעט מוכן לקבוע טסט.'),
        metrics: [
          { label: t('Lessons', 'שיעורים'), value: '18', unit: '/28' },
          { label: t('Theory', 'תיאוריה'), value: t('Passed', 'עבר'), unit: '' },
          { label: t('Spent', 'הוצאה'), value: '4,200', unit: '₪' },
        ],
        quickActions: [
          { label: t('Book lesson', 'לקבוע שיעור'), actionType: 'schedule' },
          { label: t('Log payment', 'רישום תשלום'), actionType: 'payment' },
          { label: t('Upload document', 'העלאת מסמך'), actionType: 'upload' },
        ],
        nextSteps: [
          { title: t('Pass theory exam', 'לעבור מבחן תיאוריה'), done: true },
          { title: t('Complete eye test', 'לעשות בדיקת ראייה'), done: true },
          { title: t('Finish 28 lessons', 'להשלים 28 שיעורים'), subtitle: t('18 done', '18 בוצעו') },
          { title: t('Book the practical test', 'לקבוע טסט מעשי') },
          { title: t('Pass the test', 'לעבור את הטסט') },
        ],
        people: [
          { name: t('Dani', 'דני'), role: t('Driving instructor', 'מורה נהיגה'), connectionType: 'provider' },
        ],
        assets: [
          { title: t('Theory certificate', 'תעודת תיאוריה'), type: 'document' },
          { title: t('Eye test result', 'תוצאת בדיקת ראייה'), type: 'document' },
          { title: t('Green form (טופס ירוק)', 'טופס ירוק'), type: 'document' },
        ],
        timeline: [
          { title: t('Lesson 18 — highway', 'שיעור 18 — נתיב מהיר'), daysAgo: 1 },
          { title: t('Passed theory', 'עברת תיאוריה'), daysAgo: 21 },
          { title: t('First lesson', 'שיעור ראשון'), daysAgo: 75 },
        ],
        insights: [
          t('At ~2 lessons/week you can test in about 5 weeks.', 'בקצב של ~2 שיעורים בשבוע אפשר לגשת לטסט בעוד כ־5 שבועות.'),
          t('Parking is your weakest skill — Dani noted it twice.', 'חניה היא החולשה — דני ציין פעמיים.'),
        ],
        decisions: [
          { text: t('Test with Dani, not an external tester', 'לגשת לטסט עם דני, לא בוחן חיצוני'), rationale: t('Familiar car + route.', 'רכב ומסלול מוכרים.') },
        ],
        reminders: [
          { text: t('Book lesson 19', 'לקבוע שיעור 19'), dueLabel: t('tomorrow', 'מחר'), dueInHours: 20 },
          { text: t('Renew green form before test', 'לחדש טופס ירוק לפני הטסט'), dueLabel: t('in 2 weeks', 'בעוד שבועיים'), dueInHours: 24 * 14 },
        ],
      };

    case 'moving':
      return {
        emoji: '📦',
        tag: 'home',
        title: desire || t('Move apartments', 'מעבר דירה'),
        progress: { current: 9, total: 20, label: t('tasks', 'משימות') },
        relationLabel: t('Movers +2', 'מובילים +2'),
        broadcast: t('Lease signed. Movers booked for the 28th.', 'חוזה נחתם. מובילים ל־28.'),
        broadcastSecondary: t('9 of 20 tasks done.', '9 מתוך 20 משימות.'),
        metrics: [
          { label: t('Move date', 'תאריך מעבר'), value: t('Jun 28', '28.6') },
          { label: t('Budget', 'תקציב'), value: '6,500', unit: '₪' },
          { label: t('Boxes', 'ארגזים'), value: '14', unit: '' },
        ],
        quickActions: [
          { label: t('Add task', 'הוסף משימה'), actionType: 'note' },
          { label: t('Add contact', 'הוסף איש קשר'), actionType: 'note' },
          { label: t('Upload contract', 'העלאת חוזה'), actionType: 'upload' },
        ],
        nextSteps: [
          { title: t('Sign the lease', 'לחתום על החוזה'), done: true },
          { title: t('Book movers', 'להזמין מובילים'), done: true },
          { title: t('Transfer electricity + water', 'להעביר חשמל ומים'), subtitle: t('electricity done', 'חשמל בוצע') },
          { title: t('Pack the kitchen', 'לארוז את המטבח') },
          { title: t('Update address everywhere', 'לעדכן כתובת בכל מקום') },
        ],
        people: [
          { name: t('Movers Co.', 'חברת הובלות'), role: t('Moving company', 'חברת הובלה'), connectionType: 'provider' },
          { name: t('Landlord', 'בעל הדירה'), role: t('Landlord', 'בעל הבית'), connectionType: 'other' },
        ],
        assets: [
          { title: t('Lease.pdf', 'חוזה.pdf'), type: 'document' },
          { title: t('Movers quote', 'הצעת מחיר הובלה'), type: 'document' },
          { title: t('Inventory list', 'רשימת מלאי'), type: 'note' },
        ],
        timeline: [
          { title: t('Booked movers (₪6,500)', 'הוזמנו מובילים (₪6,500)'), daysAgo: 1 },
          { title: t('Signed the lease', 'נחתם החוזה'), daysAgo: 6 },
          { title: t('Started the move', 'התחלת את המעבר'), daysAgo: 20 },
        ],
        insights: [
          t('Cancel old utilities the day AFTER you move, not before.', 'לבטל שירותים ישנים יום אחרי המעבר, לא לפני.'),
          t('You still need a parking permit for moving day.', 'חסר אישור חניה ליום ההובלה.'),
        ],
        decisions: [
          { text: t('Hire movers vs. DIY', 'מובילים במקום לבד'), rationale: t('Saves a full day + your back.', 'חוסך יום שלם ואת הגב.') },
        ],
        reminders: [
          { text: t('Confirm movers', 'לאשר את המובילים'), dueLabel: t('in 3 days', 'בעוד 3 ימים'), dueInHours: 72 },
          { text: t('Arrange parking permit', 'לסדר אישור חניה'), dueLabel: t('next week', 'שבוע הבא'), dueInHours: 24 * 7 },
        ],
      };

    case 'business':
      return {
        emoji: '💼',
        tag: 'business',
        title: desire || t('Land my first 5 clients', 'להשיג 5 לקוחות ראשונים'),
        progress: { current: 2, total: 5, label: t('clients', 'לקוחות') },
        relationLabel: t('Pipeline · 6 leads', 'פייפליין · 6 לידים'),
        broadcast: t('2 clients signed, 3 proposals out.', '2 לקוחות נסגרו, 3 הצעות בחוץ.'),
        broadcastSecondary: t('Follow up with Noa today.', 'לחזור לנועה היום.'),
        metrics: [
          { label: t('Clients', 'לקוחות'), value: '2', unit: '/5' },
          { label: t('Pipeline', 'פייפליין'), value: '6', unit: t('leads', 'לידים') },
          { label: t('MRR', 'הכנסה חודשית'), value: '4,800', unit: '₪' },
        ],
        quickActions: [
          { label: t('Send proposal', 'לשלוח הצעה'), actionType: 'note' },
          { label: t('Schedule call', 'לקבוע שיחה'), actionType: 'schedule' },
          { label: t('Mark as won', 'לסמן כנסגר'), actionType: 'custom' },
        ],
        nextSteps: [
          { title: t('Define the offer + price', 'להגדיר הצעה ומחיר'), done: true },
          { title: t('Build a one-page site', 'להקים דף נחיתה'), done: true },
          { title: t('Reach out to 10 leads', 'לפנות ל־10 לידים'), subtitle: t('6 contacted', '6 נוצר קשר') },
          { title: t('Follow up on 3 proposals', 'לעקוב אחרי 3 הצעות') },
          { title: t('Close 3 more clients', 'לסגור עוד 3 לקוחות') },
        ],
        people: [
          { name: t('Noa', 'נועה'), role: t('Warm lead', 'ליד חם'), connectionType: 'client' },
          { name: t('Ron', 'רון'), role: t('Signed client', 'לקוח חתום'), connectionType: 'client' },
        ],
        assets: [
          { title: t('Proposal template', 'תבנית הצעה'), type: 'document' },
          { title: t('Pricing sheet', 'גיליון תמחור'), type: 'note' },
          { title: t('Landing page', 'דף נחיתה'), type: 'link' },
        ],
        timeline: [
          { title: t('Ron signed (₪2,400/mo)', 'רון חתם (₪2,400/חודש)'), daysAgo: 2 },
          { title: t('Sent 3 proposals', 'נשלחו 3 הצעות'), daysAgo: 5 },
          { title: t('Launched outreach', 'התחלת פנייה ללקוחות'), daysAgo: 18 },
        ],
        insights: [
          t('Leads from referrals close 3× more than cold ones.', 'לידים מהפניות נסגרים פי 3 מקרים.'),
          t('Proposals you send within 24h convert best.', 'הצעות שאתה שולח תוך 24 שעות ממירות הכי טוב.'),
        ],
        decisions: [
          { text: t('Monthly retainer, not per-project', 'ריטיינר חודשי, לא לפי פרויקט'), rationale: t('Predictable income, deeper work.', 'הכנסה צפויה, עבודה עמוקה יותר.') },
        ],
        reminders: [
          { text: t('Follow up with Noa', 'לחזור לנועה'), dueLabel: t('today', 'היום'), dueInHours: 3 },
          { text: t('Send invoice to Ron', 'לשלוח חשבונית לרון'), dueLabel: t('Friday', 'שישי'), dueInHours: 24 * 3 },
        ],
      };

    case 'travel':
      return {
        emoji: '✈️',
        tag: 'travel',
        title: desire || t('Trip to Italy', 'טיול לאיטליה'),
        progress: { current: 5, total: 12, label: t('booked', 'הוזמן') },
        relationLabel: t('With Tamar', 'עם תמר'),
        broadcast: t('Flights booked. Now: where to sleep.', 'טיסות הוזמנו. עכשיו: איפה ישנים.'),
        broadcastSecondary: t('72 days to departure.', '72 ימים להמראה.'),
        metrics: [
          { label: t('Dates', 'תאריכים'), value: t('Sep 3–12', '3–12.9') },
          { label: t('Budget', 'תקציב'), value: '9,000', unit: '₪' },
          { label: t('Travellers', 'מטיילים'), value: '2', unit: '' },
        ],
        quickActions: [
          { label: t('Add booking', 'הוסף הזמנה'), actionType: 'note' },
          { label: t('Save place', 'שמור מקום'), actionType: 'note' },
          { label: t('Upload ticket', 'העלאת כרטיס'), actionType: 'upload' },
        ],
        nextSteps: [
          { title: t('Pick dates', 'לבחור תאריכים'), done: true },
          { title: t('Book flights', 'להזמין טיסות'), done: true },
          { title: t('Book accommodation', 'להזמין לינה'), subtitle: t('Rome done, Florence open', 'רומא בוצע, פירנצה פתוח') },
          { title: t('Plan the route', 'לתכנן מסלול') },
          { title: t('Travel insurance', 'ביטוח נסיעות') },
        ],
        people: [
          { name: t('Tamar', 'תמר'), role: t('Travel partner', 'שותפה לטיול'), connectionType: 'partner' },
        ],
        assets: [
          { title: t('Flight tickets', 'כרטיסי טיסה'), type: 'document' },
          { title: t('Rome hotel booking', 'הזמנת מלון ברומא'), type: 'document' },
          { title: t('Saved places map', 'מפת מקומות שמורים'), type: 'link' },
        ],
        timeline: [
          { title: t('Booked flights (₪3,100)', 'הוזמנו טיסות (₪3,100)'), daysAgo: 3 },
          { title: t('Picked dates: Sep 3–12', 'נבחרו תאריכים: 3–12.9'), daysAgo: 8 },
          { title: t('Started planning', 'התחלת לתכנן'), daysAgo: 14 },
        ],
        insights: [
          t('Florence books up fast in September — reserve soon.', 'פירנצה מתמלאת מהר בספטמבר — כדאי להזמין בקרוב.'),
          t('Trains beat car rental between your cities.', 'רכבות עדיפות על השכרת רכב בין הערים שלך.'),
        ],
        decisions: [
          { text: t('Train between cities, no rental car', 'רכבות בין ערים, בלי רכב שכור'), rationale: t('Cheaper + no parking stress.', 'זול יותר ובלי כאב ראש של חניה.') },
        ],
        reminders: [
          { text: t('Book Florence stay', 'להזמין לינה בפירנצה'), dueLabel: t('this week', 'השבוע'), dueInHours: 24 * 4 },
          { text: t('Buy travel insurance', 'לקנות ביטוח נסיעות'), dueLabel: t('in 2 weeks', 'בעוד שבועיים'), dueInHours: 24 * 14 },
        ],
      };

    case 'learning':
    default:
      return {
        emoji: '📚',
        tag: 'learning',
        title: desire || t('Learn something new', 'ללמוד משהו חדש'),
        progress: { current: 6, total: 20, label: t('sessions', 'מפגשים') },
        relationLabel: t('Self-paced', 'בקצב שלי'),
        broadcast: t("6 sessions in — you're past the hard part.", '6 מפגשים בפנים — עברת את החלק הקשה.'),
        broadcastSecondary: t('Next session: 30 min today.', 'המפגש הבא: 30 דק׳ היום.'),
        metrics: [
          { label: t('Progress', 'התקדמות'), value: '30', unit: '%' },
          { label: t('Sessions', 'מפגשים'), value: '6', unit: '/20' },
          { label: t('Streak', 'רצף'), value: '4', unit: t('days', 'ימים') },
        ],
        quickActions: [
          { label: t('Add session', 'הוסף מפגש'), actionType: 'schedule' },
          { label: t('Add note', 'הוסף הערה'), actionType: 'note' },
          { label: t('Set reminder', 'הגדר תזכורת'), actionType: 'note' },
        ],
        nextSteps: [
          { title: t('Pick the resource / course', 'לבחור קורס / מקור'), done: true },
          { title: t('Set a weekly study slot', 'לקבוע חלון לימוד שבועי'), done: true },
          { title: t('Finish module 2', 'לסיים מודול 2'), subtitle: t('60% through', '60% הושלם') },
          { title: t('Build a small practice project', 'לבנות פרויקט תרגול קטן') },
          { title: t('Review + test yourself', 'לחזור ולתרגל את עצמך') },
        ],
        people: [
          { name: t('Study group', 'קבוצת לימוד'), role: t('Peers', 'עמיתים'), connectionType: 'other' },
        ],
        assets: [
          { title: t('Course link', 'קישור לקורס'), type: 'link' },
          { title: t('Notes', 'הערות'), type: 'note' },
          { title: t('Cheat sheet', 'דף עזר'), type: 'document' },
        ],
        timeline: [
          { title: t('Finished session 6', 'הושלם מפגש 6'), daysAgo: 0 },
          { title: t('Completed module 1', 'הושלם מודול 1'), daysAgo: 7 },
          { title: t('Started learning', 'התחלת ללמוד'), daysAgo: 21 },
        ],
        insights: [
          t('30-min daily beats 3-hour weekend sessions for you.', '30 דקות ביום עדיף לך על מפגשי 3 שעות בסופ״ש.'),
          t('You retain more when you take notes by hand.', 'אתה זוכר יותר כשאתה רושם ביד.'),
        ],
        decisions: [
          { text: t('Project-first, theory as needed', 'קודם פרויקט, תיאוריה לפי הצורך'), rationale: t('Keeps motivation high.', 'שומר על מוטיבציה גבוהה.') },
        ],
        reminders: [
          { text: t('Study session', 'מפגש לימוד'), dueLabel: t('today', 'היום'), dueInHours: 6 },
          { text: t('Review module 2', 'לחזור על מודול 2'), dueLabel: t('weekend', 'סופ״ש'), dueInHours: 24 * 3 },
        ],
      };
  }
}

// ── Assembly ────────────────────────────────────────────────────────────────

function assembleUnit(
  c: RichContent,
  identityId: string,
  now: number,
): Unit {
  const nowIso = new Date(now).toISOString();
  const recentIso = new Date(now - 6 * MS_HOUR).toISOString();
  const id = uid('unit', now);
  const bType: UnitBroadcastType = 'next_step';

  const latest: [string, string?] = c.broadcastSecondary
    ? [c.broadcast, c.broadcastSecondary]
    : [c.broadcast];

  return {
    id,
    identityId,
    title: c.title,
    emoji: c.emoji,
    tagIds: [c.tag],
    color: TAG_COLORS[c.tag],
    broadcast: [
      { id: uid('b', now), text: c.broadcast, priority: 85, type: bType, createdAt: nowIso },
      ...(c.broadcastSecondary
        ? [{ id: uid('b', now), text: c.broadcastSecondary, priority: 60, type: 'event' as UnitBroadcastType, createdAt: nowIso }]
        : []),
    ],
    latestBroadcastText: latest,
    lastUpdatedAt: recentIso,
    unreadUpdates: 2,
    relationLabel: c.relationLabel,
    visibility: 'private',
    progress: c.progress,
    metrics: c.metrics.map((m) => ({
      id: uid('m', now),
      label: m.label,
      value: m.value,
      unit: m.unit || undefined,
      trend: m.trend,
    })),
    quickActions: c.quickActions.map((q) => ({
      id: uid('qa', now),
      label: q.label,
      actionType: q.actionType,
    })),
    nextSteps: c.nextSteps.map((s) => ({
      id: uid('ns', now),
      title: s.title,
      subtitle: s.subtitle,
      done: !!s.done,
    })),
    people: c.people.map((p) => ({
      id: uid('p', now),
      name: p.name,
      role: p.role,
      connectionType: p.connectionType,
    })),
    assets: c.assets.map((a) => ({
      id: uid('as', now),
      title: a.title,
      type: a.type,
      createdAt: nowIso,
    })),
    timeline: c.timeline.map((tl) => ({
      id: uid('tl', now),
      title: tl.title,
      subtitle: tl.subtitle,
      date: new Date(now - tl.daysAgo * MS_DAY).toISOString(),
    })),
    insights: c.insights.map((text) => ({
      id: uid('in', now),
      text,
      createdAt: nowIso,
    })),
    decisions: c.decisions.map((d) => ({
      id: uid('dec', now),
      text: d.text,
      rationale: d.rationale,
      createdAt: nowIso,
    })),
    reminders: c.reminders.map((r) => ({
      id: uid('rem', now),
      text: r.text,
      dueLabel: r.dueLabel,
      dueAt:
        r.dueInHours != null
          ? new Date(now + r.dueInHours * MS_HOUR).toISOString()
          : undefined,
      done: !!r.done,
      createdAt: nowIso,
    })),
    createdAt: new Date(now - 21 * MS_DAY).toISOString(),
    updatedAt: recentIso,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Build a full, rich Unit for a specific archetype key. */
export function generateRichUnitByKey(
  key: ArchetypeKey,
  identityId: string,
  lang: AppLanguage,
  now: number = Date.now(),
  desire = '',
): Unit {
  const t: Pick = (en, he) => (lang === 'he' ? he : en);
  return assembleUnit(buildContent(key, desire, t), identityId, now);
}

/** Build a full, rich Unit from a free-text desire (keyword-detect the domain). */
export function generateRichUnit(
  desire: string,
  identityId: string,
  lang: AppLanguage,
  now: number = Date.now(),
): Unit {
  const key = detectArchetype(desire);
  return generateRichUnitByKey(key, identityId, lang, now, desire.trim());
}

/** Deterministically rotate through the archetypes — used by the Settings
 *  test button so each press generates a different rich domain. */
let sampleRotation = 0;
export function generateSampleUnit(
  identityId: string,
  lang: AppLanguage,
  now: number = Date.now(),
): Unit {
  const key = ARCHETYPE_KEYS[sampleRotation % ARCHETYPE_KEYS.length];
  sampleRotation += 1;
  return generateRichUnitByKey(key, identityId, lang, now);
}

/**
 * Enrich an AI-created process so it's born RICH, not a bare title — without
 * fabricating anything specific to a stranger's life. We seed only:
 *   • insights   — generic domain ADVICE (not made-up people/events)
 *   • quickActions / metrics / nextSteps — scaffolding the user fills in;
 *     metrics use "—" placeholders so we never invent a fake reading
 *   • progress   — a "just started" 0/total bar for shape
 *
 * Anything the AI already provided is kept untouched; we only top up what's
 * thin. People, assets, decisions, reminders and history are deliberately NOT
 * fabricated — those come from the real conversation.
 */
export function enrichUnitFromArchetype(
  unit: Unit,
  desire: string,
  lang: AppLanguage,
  now: number = Date.now(),
): Unit {
  const key = detectArchetype(desire || unit.title);
  const t: Pick = (en, he) => (lang === 'he' ? he : en);
  const c = buildContent(key, '', t);
  const nowIso = new Date(now).toISOString();
  const out: Unit = { ...unit };

  // Insights — pure advice, always safe to seed.
  if (!out.insights || out.insights.length === 0) {
    out.insights = c.insights.map((text) => ({ id: uid('in', now), text, createdAt: nowIso }));
  }

  // Quick actions — scaffolding. Top up to ~3.
  const qa = [...(out.quickActions ?? [])];
  if (qa.length < 3) {
    const have = new Set(qa.map((a) => a.label.toLowerCase()));
    for (const a of c.quickActions) {
      if (qa.length >= 3) break;
      if (!have.has(a.label.toLowerCase())) qa.push({ id: uid('qa', now), label: a.label, actionType: a.actionType });
    }
    out.quickActions = qa;
  }

  // Metrics — labelled scaffolding with "—" placeholders (no invented numbers).
  const ms = [...(out.metrics ?? [])];
  if (ms.length < 3) {
    const have = new Set(ms.map((m) => m.label.toLowerCase()));
    for (const m of c.metrics) {
      if (ms.length >= 3) break;
      if (!have.has(m.label.toLowerCase())) ms.push({ id: uid('m', now), label: m.label, value: '—', unit: m.unit || undefined });
    }
    out.metrics = ms;
  }

  // Next steps — a real starter plan, all unchecked.
  const ns = [...(out.nextSteps ?? [])];
  if (ns.length < 4) {
    const have = new Set(ns.map((s) => s.title.toLowerCase()));
    for (const s of c.nextSteps) {
      if (ns.length >= 4) break;
      if (!have.has(s.title.toLowerCase())) ns.push({ id: uid('ns', now), title: s.title, subtitle: s.subtitle, done: false });
    }
    out.nextSteps = ns;
  }

  // Progress — a "just started" bar for shape (honest: current = 0).
  if (!out.progress) {
    out.progress = { current: 0, total: c.progress.total, label: c.progress.label };
  }

  return out;
}
