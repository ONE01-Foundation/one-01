import type { AppLanguage } from '../stores/localeStore';

type SectionRow = { key: string; title: string; sub: string };

export function getStaticGlobalSections(language: AppLanguage): {
  aggregate: SectionRow[];
  discovery: SectionRow[];
  marketPulse: SectionRow[];
} {
  const he = language === 'he';

  const aggregate: SectionRow[] = he
    ? [
        {
          key: 'agg-q',
          title: 'חיפושי סוכנים (24 שעות)',
          sub: '1.4k שאילתות · ~62% ספקי שירות · ~28% מוצרים ומסלולים · ~10% תהליכים',
        },
        {
          key: 'agg-src',
          title: 'מה נכנס לאגרגט',
          sub: 'מחירון, סלוטים, SLA, ביקורות מאומתות, נפח חיפוש ויחידות בבית שמצביעות על ביקוש',
        },
        {
          key: 'agg-ai',
          title: 'למה זה עוזר ל-AI ולך',
          sub: 'שכבה אחת עקבית לפי עולם — פחות סתירות בין סוכנים, יותר בחירה מושכלת לפני פתיחת יחידה',
        },
      ]
    : [
        {
          key: 'agg-q',
          title: 'Agent searches (24h)',
          sub: '1.4k queries · ~62% services · ~28% products & bundles · ~10% flows',
        },
        {
          key: 'agg-src',
          title: 'What feeds the aggregate',
          sub: 'Pricing, slots, SLAs, verified reviews, search volume, and home units that signal demand',
        },
        {
          key: 'agg-ai',
          title: 'Why people & AI both win',
          sub: 'One consistent layer per world — fewer cross-agent conflicts, sharper picks before you open a unit',
        },
      ];

  const discovery: SectionRow[] = he
    ? [
        {
          key: 'd-svc',
          title: 'ספקי שירות',
          sub: 'משרדי ליווי, קליניקות, מאמנים, יועצים — דירוג לפי זמינות, מהירות מענה והתאמה לעולם הזה.',
        },
        {
          key: 'd-prd',
          title: 'מוצרים ומסלולים',
          sub: 'חבילות התחלה, מנויים, קורסים וכלים — מול ביקוש אמיתי מהשטח, לא רק פרסום.',
        },
        {
          key: 'd-match',
          title: 'התאמה מהשוק',
          sub: 'סוכנים מרכיבים הצעות מול אותו אגרגט — כדי לצמצם רעש ולהגיע מהר לשורה התחתונה.',
        },
      ]
    : [
        {
          key: 'd-svc',
          title: 'Service providers',
          sub: 'Desks, clinics, coaches, consultants — ranked by availability, response time, and fit to this world.',
        },
        {
          key: 'd-prd',
          title: 'Products & bundles',
          sub: 'Starter packs, subscriptions, courses, and tools — against real demand signals, not ads alone.',
        },
        {
          key: 'd-match',
          title: 'Market-matched offers',
          sub: 'Agents compose options against the same aggregate — less noise, faster path to a decision.',
        },
      ];

  const marketPulse: SectionRow[] = he
    ? [
        {
          key: 'm1',
          title: 'היצע מול ביקוש',
          sub: 'חבילות ליווי בתחילת דרך — היצע גבוה; חלונות פגישה בערב — ביקוש חזק באזורים מסוימים.',
        },
        {
          key: 'm2',
          title: 'מה נפתח כיחידות',
          sub: 'תבניות שחוזרות מהחיפושים → נכנסות לבית כיחידות — מעידות על כיוון השוק.',
        },
      ]
    : [
        {
          key: 'm1',
          title: 'Supply vs demand',
          sub: 'Starter coaching — high supply; evening slots — tight demand in several metros.',
        },
        {
          key: 'm2',
          title: 'What becomes a unit',
          sub: 'Patterns that repeat in agent queries tend to land as home units — a live market compass.',
        },
      ];

  return { aggregate, discovery, marketPulse };
}
