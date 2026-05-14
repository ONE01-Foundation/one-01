import type { AppLanguage } from '../stores/localeStore';
import { spaceOrDomainTitle } from './displayHelpers';
import { formatUnitLogStatusLine } from './displayHelpers';
import type { FlowUnit, OrbItem, BroadcastMessage } from './flowUnit';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function lastActivityMs(unit: FlowUnit): number {
  const msgs = unit.messages ?? [];
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].sentAt : 0;
  return lastMsg || 0;
}

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
    signal: he ? 'סיגנל' : 'Signal',
  };
  const unit = units.find((u) => u.id === item.id);
  if (unit) {
    const out: BroadcastMessage[] = [];
    const now = Date.now();

    if (unit.status === 'waiting') {
      const hint = unit.nextAction?.trim() || (he ? 'ממתין להמשך' : 'awaiting next step');
      out.push({ type: t.signal, body: he ? `«${unit.title}» ממתינה — ${hint}` : `«${unit.title}» waiting — ${hint}` });
    }

    const lastActive = lastActivityMs(unit);
    if (lastActive > 0 && now - lastActive > SEVEN_DAYS_MS && unit.status !== 'done') {
      out.push({ type: t.signal, body: he ? `«${unit.title}» — לא היה עדכון כבר שבוע` : `«${unit.title}» — no updates for a week` });
    }

    if (unit.progress >= 80 && unit.status === 'active') {
      out.push({ type: t.signal, body: he ? `«${unit.title}» קרוב לסיום — ${unit.progress}%` : `«${unit.title}» near completion — ${unit.progress}%` });
    }

    const requiredSlots = unit.profileSlots?.filter((s) => !s.optional) ?? [];
    const missingSlots = requiredSlots.filter((s) => !s.value?.trim());
    if (requiredSlots.length > 0 && missingSlots.length === 0) {
      out.push({ type: t.signal, body: he ? `«${unit.title}» — הפרופיל מלא, מוכן להתקדם` : `«${unit.title}» — profile complete, ready to advance` });
    }

    if (lastActive > 0 && now - lastActive < ONE_DAY_MS) {
      out.push({ type: t.signal, body: he ? `«${unit.title}» — יחידה חדשה, בואו נתחיל` : `«${unit.title}» — new unit, let's begin` });
    }

    if (missingSlots.length > 0) {
      out.push({
        type: t.need,
        body: he ? `${missingSlots.length} שדות חסרים בפרופיל — ${missingSlots[0].label}` : `${missingSlots.length} profile fields missing — ${missingSlots[0].label}`,
      });
      for (const s of missingSlots.slice(1, 4)) {
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
  const now = Date.now();
  const spaceUnits = units.filter((u) => u.spaceId === spaceId);
  const activeUnits = spaceUnits.filter((u) => u.status === 'active');
  const waitingUnits = spaceUnits.filter((u) => u.status === 'waiting');
  const staleUnits = spaceUnits.filter((u) => {
    if (u.status === 'done') return false;
    const last = lastActivityMs(u);
    return last > 0 && now - last > SEVEN_DAYS_MS;
  });
  let totalMissingSlots = 0;
  for (const u of spaceUnits) {
    const req = u.profileSlots?.filter((s) => !s.optional) ?? [];
    totalMissingSlots += req.filter((s) => !s.value?.trim()).length;
  }

  if (spaceUnits.length === 0) {
    return he
      ? [{ type: 'סטטוס', body: 'ONE לומד את הקצב שלך — היחידות שלך יזינו את התמונה.' }]
      : [{ type: 'status', body: 'ONE is learning your rhythm — your units will shape the picture.' }];
  }

  const out: BroadcastMessage[] = [];

  if (activeUnits.length > 0) {
    out.push({
      type: he ? 'סיכום' : 'Summary',
      body: he ? `${activeUnits.length} יחידות פעילות` : `${activeUnits.length} active units`,
    });
  }
  if (waitingUnits.length > 0) {
    out.push({
      type: he ? 'סיכום' : 'Summary',
      body: he ? `${waitingUnits.length} יחידות ממתינות` : `${waitingUnits.length} units waiting`,
    });
  }
  if (totalMissingSlots > 0) {
    out.push({
      type: he ? 'סיכום' : 'Summary',
      body: he ? `${totalMissingSlots} שדות חסרים בסה"כ` : `${totalMissingSlots} total missing fields`,
    });
  }
  if (staleUnits.length > 0) {
    out.push({
      type: he ? 'תשומת לב' : 'Attention',
      body: he ? `${staleUnits.length} יחידות ללא עדכון שבוע+` : `${staleUnits.length} units with no update for a week+`,
    });
  }

  const recentlyActive = [...spaceUnits]
    .filter((u) => u.status !== 'done')
    .sort((a, b) => lastActivityMs(b) - lastActivityMs(a))
    .slice(0, 2);
  for (const u of recentlyActive) {
    out.push({
      type: he ? 'יחידה פעילה' : 'Active unit',
      body: he
        ? `${u.title} · ${u.progress}% · ${u.nextAction || 'ממתין לצעד הבא'}`
        : `${u.title} · ${u.progress}% · ${u.nextAction || 'Waiting for next action'}`,
    });
  }

  return out;
}
