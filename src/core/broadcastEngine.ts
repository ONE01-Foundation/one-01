import type { AppLanguage } from '../stores/localeStore';
import { spaceOrDomainTitle } from './displayHelpers';
import { formatUnitLogStatusLine } from './displayHelpers';
import type { FlowUnit, OrbItem, BroadcastMessage } from './flowUnit';

export function getGlobalBroadcastMessages(
  spaceId: string,
  language: AppLanguage,
  crowdSignals: { key: string; labelHe: string; labelEn: string; count: number }[]
): BroadcastMessage[] {
  const name = spaceOrDomainTitle(spaceId, language);
  const crowd: BroadcastMessage[] = [];
  const top = crowdSignals.filter((s) => s.count > 0).slice(0, 4);
  if (language === 'he') {
    for (const s of top) {
      crowd.push({
        type: 'ציבורי · אנונימי',
        body: `דפוס דומה זוהה — «${s.labelHe}»`,
      });
    }
  } else {
    for (const s of top) {
      crowd.push({
        type: 'Public · anonymous',
        body: `Similar pattern detected — «${s.labelEn}»`,
      });
    }
  }
  if (language === 'he') {
    return [
      ...crowd,
      {
        type: 'גילוי',
        body: `«${name}» — גילוי בהתפתחות. ככל שיותר יחידות נפתחות, התמונה מתחדדת.`,
      },
      {
        type: 'אגרגט',
        body: 'בעתיד: מחירים, זמינות, וביקורות — מנתונים אמיתיים.',
      },
      {
        type: 'סוכנים',
        body: 'ONE לומד מהתהליכים שלך — עוד לא מנתונים חיצוניים.',
      },
    ];
  }
  return [
    ...crowd,
    {
      type: 'Discovery',
      body: `"${name}" — discovery evolving. As more units open, the picture sharpens.`,
    },
    {
      type: 'Aggregate',
      body: 'Future: pricing, availability, reviews — from real data.',
    },
    {
      type: 'Agents',
      body: 'ONE learns from your processes — not yet from external data.',
    },
  ];
}

export function broadcastMessagesForOrbItem(item: OrbItem, units: FlowUnit[], language: AppLanguage): BroadcastMessage[] {
  const he = language === 'he';
  const t = {
    next: he ? 'צעד הבא' : 'Next step',
    goal: he ? 'מטרה' : 'Goal',
    progress: he ? 'התקדמות' : 'Progress',
    update: he ? 'עדכון' : 'Update',
    area: he ? 'אזור' : 'Area',
    unit: he ? 'יחידה' : 'Unit',
    reminder: he ? 'תזכורת' : 'Reminder',
    ready: he ? 'מוכן לביצוע' : 'Ready to go',
    chatHint: he ? 'פתחו בצ׳אט למעקב אחר צעדים' : 'Open chat to track steps',
    need: he ? 'צריך ממך' : 'Need from you',
    status: he ? 'סטטוס' : 'Status',
  };
  const unit = units.find((u) => u.id === item.id);
  if (unit) {
    const out: BroadcastMessage[] = [];
    const slots = unit.profileSlots?.filter((s) => !s.optional) ?? [];
    const missing = slots.filter((s) => !s.value?.trim());
    if (missing.length > 0) {
      out.push({
        type: t.need,
        body: he ? `${missing.length} שדות חסרים בפרופיל — ${missing[0].label}` : `${missing.length} profile fields missing — ${missing[0].label}`,
      });
      for (const s of missing.slice(1, 4)) {
        out.push({ type: t.need, body: s.label });
      }
    }
    const stLine = formatUnitLogStatusLine(unit.status, unit.progress, unit.steps, language);
    out.push({ type: t.status, body: stLine });
    if (unit.nextAction?.trim()) out.push({ type: t.next, body: unit.nextAction.trim() });
    if (unit.goal?.trim()) out.push({ type: t.goal, body: unit.goal.trim() });
    out.push({ type: t.progress, body: `${unit.progress}% · ${unit.subtitle}` });
    if (unit.lastUpdatedLabel?.trim()) out.push({ type: t.update, body: unit.lastUpdatedLabel.trim() });
    if (unit.city?.trim()) out.push({ type: t.area, body: unit.city.trim() });
    return out.length > 0 ? out : [{ type: t.unit, body: unit.subtitle || item.subtitle }];
  }
  return [
    { type: t.update, body: item.subtitle || t.ready },
    { type: t.reminder, body: `«${item.title}» — ${t.chatHint}` },
  ];
}

export const BROADCAST_BY_SPACE_HE: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'מצב', body: 'ONE לומד את הקצב שלך — היחידות שלך יזינו את התמונה.' },
  ],
  business: [
    { type: 'מצב', body: 'ONE לומד את הפעילות העסקית — עוד יחידות, יותר תובנות.' },
  ],
  health: [],
  finance: [],
  knowledge: [],
  leisure: [],
  relations: [],
};

export const BROADCAST_BY_SPACE_EN: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'status', body: 'ONE is learning your rhythm — your units will shape the picture.' },
  ],
  business: [
    { type: 'status', body: 'ONE is learning your business activity — more units, more insight.' },
  ],
  health: [],
  finance: [],
  knowledge: [],
  leisure: [],
  relations: [],
};

export function broadcastMessagesForSpace(spaceId: string, language: AppLanguage, units: FlowUnit[]): BroadcastMessage[] {
  const he = language === 'he';
  const open = units
    .filter((u) => u.spaceId === spaceId && u.status !== 'done')
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  if (open.length === 0) {
    return he
      ? [{ type: 'סטטוס', body: 'אין עדיין יחידות פתוחות במרחב הזה. פתחו יחידה חדשה מהצ׳אט.' }]
      : [{ type: 'Status', body: 'No active units in this space yet. Create one from chat.' }];
  }
  const top = open.slice(0, 3);
  return top.map((u) => ({
    type: he ? 'יחידה פעילה' : 'Active unit',
    body: he
      ? `${u.title} · ${u.progress}% · ${u.nextAction || 'ממתין לצעד הבא'}`
      : `${u.title} · ${u.progress}% · ${u.nextAction || 'Waiting for next action'}`,
  }));
}
