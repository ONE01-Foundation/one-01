import type { AppLanguage } from '../stores/localeStore';
import type { SpaceId, DomainId } from './spaces';
import { legacyWorldIdToSpaceDomain } from './spaces';
import type { UnitProfileSlot } from '../components/UnitChatProfile';
import { useGlobalIntentSignalsStore } from '../stores/globalIntentSignalsStore';
import { spaceOrDomainTitle } from './displayHelpers';

export type GoalTemplate = {
  title: string;
  spaceId: SpaceId;
  domainId?: DomainId;
  emoji: string;
  subtitle: string;
  slots: UnitProfileSlot[];
  steps: number;
  publicSignalKey: string;
  publicSignalLabelHe: string;
  publicSignalLabelEn: string;
};

export const EMPTY_GLOBAL_SIGNALS: { key: string; labelHe: string; labelEn: string; count: number }[] = [];

export function recordGoalTemplatePublicSignal(tmpl: GoalTemplate): void {
  useGlobalIntentSignalsStore.getState().recordUnitIntent(
    tmpl.spaceId,
    tmpl.publicSignalKey,
    tmpl.publicSignalLabelHe,
    tmpl.publicSignalLabelEn
  );
}

export function inferWorldForIntent(intentRaw: string, fallbackWorldId: string): string {
  const t = intentRaw.toLowerCase();
  if (/(לקוח|לקוחות|לקוחה|crm|onboard|retention|support|sla|customer|client|churn)/.test(t)) return 'clients';
  if (/(שיווק|קמפיין|מודעה|ads|meta|google ads|seo|content|funnel|landing)/.test(t)) return 'marketing';
  if (/(מכירה|מכירות|ליד|לידים|quote|proposal|deal|close|pipeline|follow[- ]?up)/.test(t)) return 'sales';
  if (/(תפעול|ops|inventory|procurement|logistics|אספקה|איכות|qa|sop)/.test(t)) return 'operations';
  if (/(עובד|עובדים|גיוס|ראיון|hr|hire|hiring|team|culture|training)/.test(t)) return 'team';
  if (/(לקוח|לקוחות|מכירה|מכירות|עסק|עסקי|invoice|crm|lead|sales|client|quote)/.test(t)) return 'business';
  if (/(כסף|תזרים|חשבונית|גביה|מס|השקעה|finance|cash|payment|tax|invoice)/.test(t)) return 'finance';
  if (/(בריאות|רופא|בדיקה|תרופה|health|doctor|medic|clinic)/.test(t)) return 'health';
  if (/(לימוד|מבחן|קורס|למידה|study|learn|course|exam)/.test(t)) return 'knowledge';
  if (/(זוג|משפחה|חבר|relationship|family|friend)/.test(t)) return 'relations';
  return fallbackWorldId;
}

export function _goalTemplateCore(goal: string, language: AppLanguage, fallbackWorld: string): GoalTemplate {
  const g = goal.toLowerCase();
  const he = language === 'he';
  const trimTitle = goal.trim().slice(0, 28);
  if (/(רדת|משקל|דיאטה|diet|lose weight|weight loss|lbs|קילו|kg\b|נשמן|רזון)/.test(g)) {
    return {
      title: trimTitle || (he ? 'לרדת במשקל' : 'Lose weight'),
      ...legacyWorldIdToSpaceDomain('health'),
      emoji: '⚖️',
      subtitle: he ? 'מעקב משקל, גיל ויעד' : 'Weight, age & target tracking',
      slots: he
        ? [
            { id: 'age', label: 'גיל (בשנים)' },
            { id: 'weight_current', label: 'משקל נוכחי (ק״ג)' },
            { id: 'weight_target', label: 'משקל יעד (ק״ג)' },
            { id: 'constraints', label: 'מגבלות רפואיות / מה חשוב שנדע', optional: true },
          ]
        : [
            { id: 'age', label: 'Age (years)' },
            { id: 'weight_current', label: 'Current weight (kg)' },
            { id: 'weight_target', label: 'Target weight (kg)' },
            { id: 'constraints', label: 'Medical notes / constraints', optional: true },
          ],
      steps: 12,
      publicSignalKey: 'intent_weight_loss',
      publicSignalLabelHe: 'ירידה במשקל',
      publicSignalLabelEn: 'Losing weight',
    };
  }
  if (/(רישיון|נהיגה|license|driving)/.test(g)) {
    return {
      title: he ? 'רישיון נהיגה' : "Driver's license",
      ...legacyWorldIdToSpaceDomain('personal'),
      emoji: '🚗',
      subtitle: he ? 'תיאוריה · שיעורים · מבחן' : 'Theory · lessons · exam',
      slots: he
        ? [
            { id: 'theory_done', label: 'מבחן תיאוריה (כן/לא)' },
            { id: 'lessons_done', label: 'כמה שיעורי נהיגה כבר עשית?' },
            { id: 'exam_target', label: 'תאריך יעד למבחן (אופציונלי)', optional: true },
          ]
        : [
            { id: 'theory_done', label: 'Theory exam done? (yes/no)' },
            { id: 'lessons_done', label: 'How many driving lessons completed?' },
            { id: 'exam_target', label: 'Target test date (optional)', optional: true },
          ],
      steps: 25,
      publicSignalKey: 'intent_drivers_license',
      publicSignalLabelHe: 'רישיון נהיגה',
      publicSignalLabelEn: "Driver's license",
    };
  }
  if (/(מבחן|למוד|בחינה|exam prep|study plan|course\b|לימוד)/.test(g)) {
    return {
      title: trimTitle || (he ? 'הכנה למבחן' : 'Exam prep'),
      ...legacyWorldIdToSpaceDomain('knowledge'),
      emoji: '📝',
      subtitle: he ? 'תוכנית למידה ומעקב' : 'Study plan & tracking',
      slots: he
        ? [
            { id: 'subject', label: 'נושא / קורס' },
            { id: 'exam_when', label: 'מתי המבחן (משוער)?' },
            { id: 'hours_week', label: 'כמה שעות בשבוע להשקיע?', optional: true },
          ]
        : [
            { id: 'subject', label: 'Subject / course' },
            { id: 'exam_when', label: 'When is the exam (estimate)?' },
            { id: 'hours_week', label: 'Hours per week?', optional: true },
          ],
      steps: 15,
      publicSignalKey: 'intent_exam_prep',
      publicSignalLabelHe: 'הכנה למבחן / לימודים',
      publicSignalLabelEn: 'Exam / study prep',
    };
  }
  if (/(עסק|לקוח|מכירות|business|startup|crm)/.test(g)) {
    return {
      title: trimTitle || (he ? 'יעד עסקי' : 'Business goal'),
      ...legacyWorldIdToSpaceDomain('business'),
      emoji: '💼',
      subtitle: he ? 'יעד, מדדים וצעדים' : 'Goals, metrics, steps',
      slots: he
        ? [
            { id: 'outcome', label: 'מה התוצר או המדד שמסמן הצלחה?' },
            { id: 'timeline', label: 'באיזה חלון זמן?' },
          ]
        : [
            { id: 'outcome', label: 'What outcome defines success?' },
            { id: 'timeline', label: 'What time window?' },
          ],
      steps: 14,
      publicSignalKey: 'intent_business_goal',
      publicSignalLabelHe: 'יעד עסקי / מכירות',
      publicSignalLabelEn: 'Business / sales goal',
    };
  }
  if (/(חיסכון|כסף|תקציב|save money|savings|finance\b)/.test(g)) {
    return {
      title: trimTitle || (he ? 'יעד כספי' : 'Money goal'),
      ...legacyWorldIdToSpaceDomain('finance'),
      emoji: '💸',
      subtitle: he ? 'יעד, סכום, לו״ז' : 'Target amount & timeline',
      slots: he
        ? [
            { id: 'amount', label: 'סכום יעד (בערך)' },
            { id: 'horizon', label: 'עד מתי?' },
          ]
        : [
            { id: 'amount', label: 'Target amount (approx.)' },
            { id: 'horizon', label: 'By when?' },
          ],
      steps: 12,
      publicSignalKey: 'intent_finance_goal',
      publicSignalLabelHe: 'יעד כספי / חיסכון',
      publicSignalLabelEn: 'Money / savings goal',
    };
  }
  const inferred = inferWorldForIntent(goal, fallbackWorld);
  return {
    title: trimTitle || (he ? 'יחידה חדשה' : 'New unit'),
    ...legacyWorldIdToSpaceDomain(inferred),
    emoji: '🧩',
    subtitle: he ? 'נוצר מהמטרה שבחרת' : 'Created from your goal',
    slots: he
      ? [
          { id: 'clarify_goal', label: 'חדד את המטרה במשפט אחד' },
          { id: 'first_step', label: 'מה הצעד הקטן הראשון השבוע?' },
        ]
      : [
          { id: 'clarify_goal', label: 'Sharpen the goal in one sentence' },
          { id: 'first_step', label: 'First small step this week?' },
        ],
    steps: 10,
    publicSignalKey: `intent_${inferred}_custom`,
    publicSignalLabelHe: 'תהליך אישי חדש',
    publicSignalLabelEn: 'New personal process',
  };
}

export function goalTemplateFromText(goal: string, language: AppLanguage, fallbackWorld: string): GoalTemplate {
  return _goalTemplateCore(goal, language, fallbackWorld);
}

export function buildAgentGoalPromptMessage(language: AppLanguage, spaceId: string): string {
  const he = language === 'he';
  const w = spaceOrDomainTitle(spaceId, language);
  if (he) {
    return `מה ברצונך להגשים?\nבחרו דוגמה למטה או כתבו בשורת המקלדת — ניצור יחידה, נעבור לכדור שלה בבית, ואמשיך לשאול כאן ולמלא את הפרופיל (הנתונים נשמרים שם, לא רק בבועות). מרחב נוכחי: ${w}.`;
  }
  return `What do you want to achieve?\nPick an example below or type in the keyboard — we will create a unit, jump to its orb at home, and continue here while your profile fills in (data lives on the profile, not only in bubbles). Current space: ${w}.`;
}

export function creationGoalChipsForSpace(spaceId: string, language: AppLanguage): string[] {
  const he = language === 'he';
  if (spaceId === 'health') {
    return he
      ? ['לרדת במשקל', 'מעקב שינה', 'תור לרופא']
      : ['Lose weight', 'Sleep tracking', 'Doctor visit'];
  }
  if (spaceId === 'knowledge') {
    return he ? ['הכנה למבחן', 'קורס מקצועי', 'תוכנית למידה'] : ['Exam prep', 'Professional course', 'Study plan'];
  }
  if (spaceId === 'business') {
    return he ? ['לסגור 3 לקוחות', 'הקמת עסק', 'מעקב משימות'] : ['Close 3 clients', 'Start a business', 'Task tracking'];
  }
  if (spaceId === 'finance') {
    return he ? ['חיסכון לרכב', 'החזר מס', 'יעד חודשי'] : ['Save for a car', 'Tax refund', 'Monthly target'];
  }
  if (spaceId === 'relations') {
    return he ? ['יום הולדת במשפחה', 'פגישה עם חברים', 'מעקב קשרים'] : ['Family birthday', 'Friends meet-up', 'Relationship check-ins'];
  }
  if (spaceId === 'leisure') {
    return he ? ['ערב קולנוע', 'טיול סופ״ש', 'רשימת ציוד'] : ['Movie night', 'Weekend trip', 'Gear checklist'];
  }
  return he
    ? ['לרדת במשקל', 'רישיון נהיגה', 'הכנה למבחן', 'יעד כספי', 'משהו אחר — אכתוב למטה']
    : ['Lose weight', "Driver's license", 'Exam prep', 'Money goal', 'Something else — I will type'];
}
