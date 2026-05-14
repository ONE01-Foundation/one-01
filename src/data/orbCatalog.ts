import type { AppLanguage } from '../stores/localeStore';
import type { OrbItem, FlowUnit } from '../core/flowUnit';
import { legacyWorldIdToSpaceDomain } from '../core/spaces';

export const ORB_DATA_BY_WORLD: Record<string, OrbItem[]> = {
  personal: [
    { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
    { id: 'license', emoji: '🚗', title: 'רישיון נהיגה', subtitle: 'מבחן תיאוריה, שיעורים, מבחן מעשי' },
    { id: 'mass', emoji: '💪', title: 'עלות 5 קילו מסה', subtitle: 'תזונה, אימונים, מעקב' },
    { id: 'passport', emoji: '🛂', title: 'חידוש דרכון', subtitle: 'תיאום תור, מסמכים, איסוף' },
  ],
  business: [
    { id: 'origin', emoji: '🏢', title: 'סקירת עסק', subtitle: '' },
    { id: 'biz_dashboard', emoji: '📈', title: 'לוח KPI שבועי', subtitle: 'יעדים, המרות, צווארי בקבוק' },
    { id: 'biz_q_plan', emoji: '🧭', title: 'תוכנית רבעונית', subtitle: 'מטרות, בעלים, דדליינים' },
    { id: 'biz_automation', emoji: '⚙️', title: 'אוטומציות חוסכות זמן', subtitle: 'CRM, פולואפ, דוחות' },
  ],
  clients: [
    { id: 'origin', emoji: '🤝', title: 'לקוחות', subtitle: '' },
    { id: 'clients_onboarding', emoji: '🧾', title: 'Onboarding לקוח חדש', subtitle: 'טפסים, דרישות, kickoff' },
    { id: 'clients_retention', emoji: '❤️', title: 'שימור לקוחות', subtitle: 'NPS, פולואפים, מניעת נטישה' },
    { id: 'clients_support', emoji: '🎧', title: 'תמיכה ו-SLA', subtitle: 'תורים, זמני תגובה, הסלמה' },
  ],
  marketing: [
    { id: 'origin', emoji: '📣', title: 'שיווק', subtitle: '' },
    { id: 'mkt_content', emoji: '🎬', title: 'תוכן חודשי', subtitle: 'רעיונות, הפקה, פרסום' },
    { id: 'mkt_ads', emoji: '💸', title: 'קמפיינים ממומנים', subtitle: 'קריאייטיב, קהלים, אופטימיזציה' },
    { id: 'mkt_site', emoji: '🌐', title: 'שיפור אתר/דפי נחיתה', subtitle: 'מהירות, CTA, A/B' },
  ],
  sales: [
    { id: 'origin', emoji: '💰', title: 'מכירות', subtitle: '' },
    { id: 'sales_pipeline', emoji: '🎯', title: 'ניהול Pipeline', subtitle: 'לידים, הצעות, סגירות' },
    { id: 'sales_followups', emoji: '📞', title: 'פולואפים יומיים', subtitle: 'שיחות, וואטסאפ, סטטוס' },
    { id: 'sales_pricing', emoji: '🧮', title: 'בניית הצעת מחיר', subtitle: 'סקופ, תמחור, מרווח' },
  ],
  operations: [
    { id: 'origin', emoji: '🛠️', title: 'תפעול', subtitle: '' },
    { id: 'ops_board', emoji: '📋', title: 'לוח משימות צוות', subtitle: 'עדיפויות, בעלים, SLA' },
    { id: 'ops_inventory', emoji: '📦', title: 'מלאי ורכש', subtitle: 'חוסרים, הזמנות, עלות' },
    { id: 'ops_quality', emoji: '✅', title: 'בקרת איכות', subtitle: 'צ׳קליסט, חריגות, תיקונים' },
  ],
  team: [
    { id: 'origin', emoji: '👥', title: 'צוות', subtitle: '' },
    { id: 'team_hiring', emoji: '🧲', title: 'גיוס תפקיד קריטי', subtitle: 'דרישות, סורסינג, ראיונות' },
    { id: 'team_training', emoji: '🎓', title: 'הכשרת עובדים', subtitle: 'SOP, חניכה, בדיקה' },
    { id: 'team_reviews', emoji: '🗓️', title: 'שיחות 1:1 חודשיות', subtitle: 'יעדים, חסמים, משוב' },
  ],
  health: [
    { id: 'origin', emoji: '🏥', title: 'בריאות', subtitle: '' },
    { id: 'h1', emoji: '🩺', title: 'תור לרופא', subtitle: 'הזמנה, הגעה, סיכום' },
    { id: 'h2', emoji: '💊', title: 'מעקב תרופות', subtitle: 'רישום, תזכורות, מעקב' },
    { id: 'h3', emoji: '🩸', title: 'בדיקות דם שנתיות', subtitle: 'הפניה, תיאום, תוצאות' },
  ],
  finance: [
    { id: 'origin', emoji: '💰', title: 'כסף', subtitle: '' },
    { id: 'f1', emoji: '📈', title: 'השקעות', subtitle: 'מטרה, פלטפורמה, פיזור נכסים' },
    { id: 'f2', emoji: '🧾', title: 'החזרי מס', subtitle: 'טפסים, הגשה, מעקב' },
    { id: 'f3', emoji: '🚗', title: 'חיסכון לרכב', subtitle: 'יעד, תקציב חודשי, אסטרטגיה' },
  ],
  knowledge: [
    { id: 'origin', emoji: '📚', title: 'לימודים', subtitle: '' },
    { id: 'k1', emoji: '🧠', title: 'תוכנית למידה', subtitle: 'נושאים, תרגול, מבחן' },
    { id: 'k2', emoji: '📝', title: 'הכנה למבחן', subtitle: 'סילבוס, תרגול, חזרות' },
    { id: 'k3', emoji: '🎓', title: 'קורס מקצועי', subtitle: 'מערכים, משימות, מעקב' },
  ],
  leisure: [
    { id: 'origin', emoji: '😊', title: 'פנאי', subtitle: '' },
    { id: 'l1', emoji: '🎬', title: 'ערב קולנוע', subtitle: 'כרטיסים, הגעה, ביקורת קצרה' },
    { id: 'l2', emoji: '🏕️', title: 'קמפינג משפחתי', subtitle: 'ציוד, מסלול, תזכורות' },
    { id: 'l3', emoji: '🎮', title: 'גיימינג עם חברים', subtitle: 'זמן, משחק, סיכום חוויה' },
  ],
  relations: [
    { id: 'origin', emoji: '💕', title: 'קשרים', subtitle: '' },
    { id: 'r1', emoji: '🎂', title: 'יום הולדת במשפחה', subtitle: 'מתנה, הזמנה, תזכורת לאורחים' },
    { id: 'r2', emoji: '☕', title: 'פגישה עם חברים', subtitle: 'מקום, שעה, אישור הגעה' },
    { id: 'r3', emoji: '💌', title: 'מעקב אחר קשרים', subtitle: 'שיחות, תאריכים חשובים, הערות' },
  ],
};

export const ORB_DATA_BY_WORLD_EN: Record<string, OrbItem[]> = {
  personal: [
    { id: 'origin', emoji: '👤', title: 'Home', subtitle: '' },
    { id: 'license', emoji: '🚗', title: "Driver's license", subtitle: 'Theory, lessons, practical exam' },
    { id: 'mass', emoji: '💪', title: 'Gain 5 kg muscle', subtitle: 'Nutrition, workouts, tracking' },
    { id: 'passport', emoji: '🛂', title: 'Passport renewal', subtitle: 'Appointment, documents, pickup' },
  ],
  business: [
    { id: 'origin', emoji: '🏢', title: 'Business overview', subtitle: '' },
    { id: 'biz_dashboard', emoji: '📈', title: 'Weekly KPI dashboard', subtitle: 'Targets, conversion, bottlenecks' },
    { id: 'biz_q_plan', emoji: '🧭', title: 'Quarterly plan', subtitle: 'Goals, owners, deadlines' },
    { id: 'biz_automation', emoji: '⚙️', title: 'Time-saving automations', subtitle: 'CRM, follow-ups, reports' },
  ],
  clients: [
    { id: 'origin', emoji: '🤝', title: 'Clients', subtitle: '' },
    { id: 'clients_onboarding', emoji: '🧾', title: 'Client onboarding', subtitle: 'Forms, requirements, kickoff' },
    { id: 'clients_retention', emoji: '❤️', title: 'Client retention', subtitle: 'NPS, follow-ups, churn prevention' },
    { id: 'clients_support', emoji: '🎧', title: 'Support & SLA', subtitle: 'Queues, response times, escalation' },
  ],
  marketing: [
    { id: 'origin', emoji: '📣', title: 'Marketing', subtitle: '' },
    { id: 'mkt_content', emoji: '🎬', title: 'Monthly content engine', subtitle: 'Ideas, production, publishing' },
    { id: 'mkt_ads', emoji: '💸', title: 'Paid campaigns', subtitle: 'Creatives, audiences, optimization' },
    { id: 'mkt_site', emoji: '🌐', title: 'Website & landing optimization', subtitle: 'Speed, CTA, A/B tests' },
  ],
  sales: [
    { id: 'origin', emoji: '💰', title: 'Sales', subtitle: '' },
    { id: 'sales_pipeline', emoji: '🎯', title: 'Pipeline management', subtitle: 'Leads, proposals, closes' },
    { id: 'sales_followups', emoji: '📞', title: 'Daily follow-ups', subtitle: 'Calls, messages, status updates' },
    { id: 'sales_pricing', emoji: '🧮', title: 'Proposal pricing', subtitle: 'Scope, pricing, margin control' },
  ],
  operations: [
    { id: 'origin', emoji: '🛠️', title: 'Operations', subtitle: '' },
    { id: 'ops_board', emoji: '📋', title: 'Team ops board', subtitle: 'Priorities, owners, SLA' },
    { id: 'ops_inventory', emoji: '📦', title: 'Inventory & procurement', subtitle: 'Stock gaps, orders, cost' },
    { id: 'ops_quality', emoji: '✅', title: 'Quality control', subtitle: 'Checklists, incidents, fixes' },
  ],
  team: [
    { id: 'origin', emoji: '👥', title: 'Team', subtitle: '' },
    { id: 'team_hiring', emoji: '🧲', title: 'Hiring critical role', subtitle: 'JD, sourcing, interviews' },
    { id: 'team_training', emoji: '🎓', title: 'Employee training', subtitle: 'SOP, shadowing, validation' },
    { id: 'team_reviews', emoji: '🗓️', title: 'Monthly 1:1 reviews', subtitle: 'Goals, blockers, feedback' },
  ],
  health: [
    { id: 'origin', emoji: '🏥', title: 'Health', subtitle: '' },
    { id: 'h1', emoji: '🩺', title: 'Doctor visit', subtitle: 'Booking, visit, summary' },
    { id: 'h2', emoji: '💊', title: 'Medication tracking', subtitle: 'Log, reminders, follow-up' },
    { id: 'h3', emoji: '🩸', title: 'Annual blood tests', subtitle: 'Referral, scheduling, results' },
  ],
  finance: [
    { id: 'origin', emoji: '💰', title: 'Finance', subtitle: '' },
    { id: 'f1', emoji: '📈', title: 'Investing', subtitle: 'Goal, platform, diversification' },
    { id: 'f2', emoji: '🧾', title: 'Tax refunds', subtitle: 'Forms, filing, tracking' },
    { id: 'f3', emoji: '🚗', title: 'Saving for a car', subtitle: 'Goal, monthly budget, strategy' },
  ],
  knowledge: [
    { id: 'origin', emoji: '📚', title: 'Learning', subtitle: '' },
    { id: 'k1', emoji: '🧠', title: 'Learning plan', subtitle: 'Topics, practice, exam' },
    { id: 'k2', emoji: '📝', title: 'Exam prep', subtitle: 'Syllabus, practice, review' },
    { id: 'k3', emoji: '🎓', title: 'Professional course', subtitle: 'Modules, tasks, tracking' },
  ],
  leisure: [
    { id: 'origin', emoji: '😊', title: 'Leisure', subtitle: '' },
    { id: 'l1', emoji: '🎬', title: 'Movie night', subtitle: 'Tickets, trip, quick review' },
    { id: 'l2', emoji: '🏕️', title: 'Family camping', subtitle: 'Gear, route, reminders' },
    { id: 'l3', emoji: '🎮', title: 'Gaming with friends', subtitle: 'Time, game, recap' },
  ],
  relations: [
    { id: 'origin', emoji: '💕', title: 'Relationships', subtitle: '' },
    { id: 'r1', emoji: '🎂', title: 'Family birthday', subtitle: 'Gift, RSVP, guest reminders' },
    { id: 'r2', emoji: '☕', title: 'Friends coffee', subtitle: 'Place, time, RSVP' },
    { id: 'r3', emoji: '💌', title: 'Relationship check-ins', subtitle: 'Calls, important dates, notes' },
  ],
};

export const ORB_EXTRA_EN: Record<string, Pick<OrbItem, 'title' | 'subtitle'>> = {
  study_plan: { title: 'Study plan', subtitle: 'Topics, practice, exam' },
  exam: { title: 'Exam prep', subtitle: 'Syllabus, practice, review' },
  content: { title: 'Content production', subtitle: 'Idea, shoot, edit' },
  launch: { title: 'Launch', subtitle: 'Landing page, promo, metrics' },
  class_plan: { title: 'Lesson plan', subtitle: 'Structure, tasks, feedback' },
  business_ops: { title: 'Business ops', subtitle: 'Clients, billing, tracking' },
};

export function localizedOrbDataForSpace(
  worldId: string,
  personalOrbs: OrbItem[],
  language: AppLanguage,
  flowUnits: FlowUnit[],
  includeCatalogExamples: boolean
): OrbItem[] {
  const catalogHe = ORB_DATA_BY_WORLD[worldId] ?? ORB_DATA_BY_WORLD.personal;
  const catalogEn = ORB_DATA_BY_WORLD_EN[worldId] ?? ORB_DATA_BY_WORLD_EN.personal;

  const { spaceId: _filterSp, domainId: _filterDm } = legacyWorldIdToSpaceDomain(worldId);
  const userOrbsForWorld = (excludeOrigin: boolean) =>
    personalOrbs.filter((o) => {
      if (excludeOrigin && o.id === 'origin') return false;
      const u = flowUnits.find((fu) => fu.id === o.id);
      return u?.spaceId === _filterSp && (!_filterDm || u?.domainId === _filterDm);
    });

  const catalogExamplesForWorld = (): OrbItem[] => {
    const cat = language === 'he' ? catalogHe : catalogEn;
    return cat.filter((o) => o.id !== 'origin');
  };

  const mergeById = (base: OrbItem[], extras: OrbItem[]): OrbItem[] => {
    const seen = new Set(base.map((o) => o.id));
    const out = [...base];
    for (const o of extras) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
    return out;
  };

  if (language === 'he') {
    if (worldId === 'personal') {
      if (!includeCatalogExamples) return personalOrbs;
      return mergeById(catalogHe, personalOrbs.filter((o) => !catalogHe.some((c) => c.id === o.id)));
    }
    const origin = catalogHe.find((o) => o.id === 'origin');
    const head = [origin ?? personalOrbs[0] ?? { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' }];
    const user = userOrbsForWorld(true);
    if (!includeCatalogExamples) return [...head, ...user];
    const examples = catalogExamplesForWorld().filter((o) => !user.some((u) => u.id === o.id));
    return [...head, ...mergeById(examples, user)];
  }
  if (worldId === 'personal') {
    const mappedPersonal = personalOrbs.map((o) => {
      const fromEn = ORB_DATA_BY_WORLD_EN.personal.find((e) => e.id === o.id);
      if (fromEn) return { ...o, title: fromEn.title, subtitle: fromEn.subtitle };
      const extra = ORB_EXTRA_EN[o.id];
      return extra ? { ...o, title: extra.title, subtitle: extra.subtitle ?? o.subtitle } : o;
    });
    if (!includeCatalogExamples) return mappedPersonal;
    return mergeById(
      ORB_DATA_BY_WORLD_EN.personal.map((o) => {
        const m = mappedPersonal.find((p) => p.id === o.id);
        return m ? { ...o, title: m.title, subtitle: m.subtitle } : o;
      }),
      mappedPersonal.filter((o) => !ORB_DATA_BY_WORLD_EN.personal.some((c) => c.id === o.id))
    );
  }
  const originEn = catalogEn.find((o) => o.id === 'origin');
  const head = [originEn ?? { id: 'origin', emoji: '👤', title: 'Home', subtitle: '' }];
  const user = userOrbsForWorld(true);
  if (!includeCatalogExamples) return [...head, ...user];
  const examples = catalogExamplesForWorld().filter((o) => !user.some((u) => u.id === o.id));
  return [...head, ...mergeById(examples, user)];
}

export const BUSINESS_ACCOUNT_ORBS_HE: OrbItem[] = [
  { id: 'origin', emoji: '🏢', title: 'חשבון עסקי', subtitle: '' },
  { id: 'sales_pipeline', emoji: '🎯', title: 'צינור מכירות', subtitle: 'לידים, הצעות, סגירות' },
  { id: 'ops_board', emoji: '🗂️', title: 'לוח תפעול', subtitle: 'משימות, SLA, בקרה יומית' },
  { id: 'cashflow', emoji: '💸', title: 'תזרים עסקי', subtitle: 'גבייה, תשלומים, תחזית' },
];

export const BUSINESS_ACCOUNT_ORBS_EN: OrbItem[] = [
  { id: 'origin', emoji: '🏢', title: 'Business account', subtitle: '' },
  { id: 'sales_pipeline', emoji: '🎯', title: 'Sales pipeline', subtitle: 'Leads, quotes, closures' },
  { id: 'ops_board', emoji: '🗂️', title: 'Ops board', subtitle: 'Tasks, SLA, daily control' },
  { id: 'cashflow', emoji: '💸', title: 'Business cashflow', subtitle: 'Collections, payments, forecast' },
];

export function businessAccountOrbs(language: AppLanguage): OrbItem[] {
  return language === 'he' ? BUSINESS_ACCOUNT_ORBS_HE : BUSINESS_ACCOUNT_ORBS_EN;
}
