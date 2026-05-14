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
          title: 'גילוי — בהתפתחות',
          sub: 'ככל שיותר יחידות נפתחות, התמונה מתחדדת.',
        },
        {
          key: 'agg-src',
          title: 'מה יזין את האגרגט',
          sub: 'בעתיד: מחירים, זמינות, וביקורות — מנתונים אמיתיים.',
        },
        {
          key: 'agg-ai',
          title: 'AI ותהליכים',
          sub: 'ONE לומד מהתהליכים שלך — עוד לא מנתונים חיצוניים.',
        },
      ]
    : [
        {
          key: 'agg-q',
          title: 'Discovery — evolving',
          sub: 'As more units open, the picture sharpens.',
        },
        {
          key: 'agg-src',
          title: 'What will feed the aggregate',
          sub: 'Future: pricing, availability, reviews — from real data.',
        },
        {
          key: 'agg-ai',
          title: 'AI & processes',
          sub: 'ONE learns from your processes — not yet from external data.',
        },
      ];

  const discovery: SectionRow[] = he
    ? [
        {
          key: 'd-svc',
          title: 'ספקים ומוצרים',
          sub: 'ספקים ומוצרים — בקרוב. כרגע ONE מתמקד בתהליכים שלך.',
        },
      ]
    : [
        {
          key: 'd-svc',
          title: 'Providers & products',
          sub: 'Providers and products — coming. For now ONE focuses on your processes.',
        },
      ];

  const marketPulse: SectionRow[] = he
    ? [
        {
          key: 'm1',
          title: 'מגמות שוק',
          sub: 'מגמות שוק — בהמתנה לנתונים אמיתיים.',
        },
      ]
    : [
        {
          key: 'm1',
          title: 'Market trends',
          sub: 'Market trends — waiting for real data.',
        },
      ];

  return { aggregate, discovery, marketPulse };
}
