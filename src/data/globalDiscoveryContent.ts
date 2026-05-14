import type { AppLanguage } from '../stores/localeStore';
import type { OneProcess } from '../core/types';
import type { FlowUnit } from '../core/flowUnit';
import { deriveOperationalSummary, deriveRecurringGoalTypes, deriveInactiveUnits, deriveCommonlyMissingSlots } from '../core/operationalPatterns';
import { domainLabel } from '../core/spaces';

type SectionRow = { key: string; title: string; sub: string };

export function getStaticGlobalSections(
  language: AppLanguage,
  processes?: OneProcess[],
  units?: FlowUnit[]
): {
  aggregate: SectionRow[];
  discovery: SectionRow[];
  marketPulse: SectionRow[];
} {
  const he = language === 'he';
  const procs = processes ?? [];
  const flowUnits = units ?? [];

  const summary = deriveOperationalSummary(procs);
  const recurring = deriveRecurringGoalTypes(procs);
  const inactive = deriveInactiveUnits(procs, Date.now());
  const missingSlots = deriveCommonlyMissingSlots(flowUnits);

  if (summary.total === 0) {
    return {
      aggregate: [
        {
          key: 'agg-empty',
          title: he ? 'אין יחידות עדיין' : 'No units yet',
          sub: he ? 'התחל שיחה כדי ליצור את היחידה הראשונה שלך' : 'Start a conversation to create your first unit',
        },
      ],
      discovery: [],
      marketPulse: [],
    };
  }

  const aggregate: SectionRow[] = [];

  const parts: string[] = [];
  if (summary.active > 0) parts.push(he ? `${summary.active} פעילות` : `${summary.active} active`);
  if (summary.waiting > 0) parts.push(he ? `${summary.waiting} ממתינות` : `${summary.waiting} waiting`);
  if (summary.done > 0) parts.push(he ? `${summary.done} הושלמו` : `${summary.done} completed`);
  aggregate.push({
    key: 'agg-summary',
    title: he ? 'סיכום תפעולי' : 'Operational summary',
    sub: parts.join(' · '),
  });

  if (recurring.length > 0) {
    const domainLines = recurring
      .slice(0, 4)
      .map((r) => `${domainLabel('personal', r.domainId, language === 'he' ? 'he' : 'en')} (${r.count})`)
      .join(', ');
    aggregate.push({
      key: 'agg-domains',
      title: he ? 'תחומים פעילים' : 'Active domains',
      sub: domainLines,
    });
  }

  const discovery: SectionRow[] = [];

  const recentUnits = [...procs]
    .filter((p) => p.status !== 'done')
    .sort((a, b) => {
      const aLast = a.timeline.length > 0 ? new Date(a.timeline[a.timeline.length - 1].at).getTime() : new Date(a.createdAt).getTime();
      const bLast = b.timeline.length > 0 ? new Date(b.timeline[b.timeline.length - 1].at).getTime() : new Date(b.createdAt).getTime();
      return bLast - aLast;
    })
    .slice(0, 3);

  if (recentUnits.length > 0) {
    for (const u of recentUnits) {
      discovery.push({
        key: `recent-${u.id}`,
        title: u.title,
        sub: `${u.progress ?? 0}% · ${u.nextAction ?? (he ? 'ממתין' : 'waiting')}`,
      });
    }
  }

  const marketPulse: SectionRow[] = [];

  if (inactive.length > 0) {
    for (const u of inactive.slice(0, 3)) {
      marketPulse.push({
        key: `stale-${u.id}`,
        title: he ? `«${u.title}» — דורש תשומת לב` : `«${u.title}» — needs attention`,
        sub: he ? 'לא היה עדכון כבר שבוע' : 'No updates for a week',
      });
    }
  }

  if (missingSlots.length > 0) {
    const top = missingSlots.slice(0, 3).map((s) => s.label).join(', ');
    marketPulse.push({
      key: 'attention-missing',
      title: he ? 'שדות חסרים נפוצים' : 'Commonly missing fields',
      sub: top,
    });
  }

  if (marketPulse.length === 0) {
    marketPulse.push({
      key: 'm-ok',
      title: he ? 'הכל מתקדם' : 'All on track',
      sub: he ? 'אין יחידות שדורשות תשומת לב מיידית' : 'No units require immediate attention',
    });
  }

  return { aggregate, discovery, marketPulse };
}
