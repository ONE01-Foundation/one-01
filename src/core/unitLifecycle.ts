import type { AppLanguage } from '../stores/localeStore';
import type { LifeLens, OneProcess } from './types';
import type { SpaceId, DomainId } from './spaces';
import { legacyWorldIdToSpaceDomain } from './spaces';
import type { FlowUnit, OrbItem } from './flowUnit';
import { goalTemplateFromText, recordGoalTemplatePublicSignal } from './goalEngine';
import { formatUnitLogStatusLine } from './displayHelpers';

// ---------------------------------------------------------------------------
// Unit Lifecycle – derived phase & transition vocabulary
// ---------------------------------------------------------------------------

export type UnitPhase = 'profiling' | 'operating';

export function deriveUnitPhase(unit: { profileSlots?: Array<{ optional?: boolean; value?: string }> }): UnitPhase {
  const required = (unit.profileSlots ?? []).filter(s => !s.optional);
  const allFilled = required.length > 0 && required.every(s => s.value?.trim());
  return allFilled ? 'operating' : 'profiling';
}

export const LIFECYCLE_TRANSITIONS = {
  INTENT_TO_CREATED: 'intent_to_created',
  PROFILING_TO_OPERATING: 'profiling_to_operating',
  TO_WAITING: 'to_waiting',
  WAITING_TO_ACTIVE: 'waiting_to_active',
  TO_DONE: 'to_done',
} as const;

export function lensToWorldId(lens: LifeLens): string {
  return lens;
}

export function spaceAndDomainToLens(spaceId: SpaceId, domainId?: DomainId): LifeLens {
  if (domainId === 'health') return 'health';
  if (domainId === 'finance') return 'finance';
  if (domainId === 'learning') return 'knowledge';
  if (spaceId === 'business') return 'business';
  return 'business';
}

export function processToFlowUnit(p: OneProcess, language: AppLanguage): FlowUnit {
  const worldId = lensToWorldId(p.lens);
  const seed = `${p.fields?.goal ?? p.title} ${p.summary ?? ''}`;
  const tmpl = goalTemplateFromText(seed, language, worldId);
  recordGoalTemplatePublicSignal(tmpl);
  const resolvedSpaceId: SpaceId = p.spaceId ?? tmpl.spaceId;
  const resolvedDomainId: DomainId | undefined = p.domainId ?? tmpl.domainId;
  const firstEmpty = tmpl.slots.find((s) => !s.optional) ?? tmpl.slots[0];
  const he = language === 'he';
  const intro = he
    ? `אני ONE — מתחילים את «${tmpl.title}» אחרי ההרשמה.\n${p.summary ? `סיכום מה שכתבת: ${p.summary.slice(0, 200)}${p.summary.length > 200 ? '…' : ''}\n` : ''}נבנה כאן תהליך אמיתי: מה שתשלח נשמר בפרופיל היחידה (מספרים, תאריכים, סטטוסים) — לא רק בועות שמתפזרות.`
    : `I'm ONE—we're starting "${tmpl.title}" after signup.\n${p.summary ? `What you wrote: ${p.summary.slice(0, 200)}${p.summary.length > 200 ? '…' : ''}\n` : ''}We will build a real flow here: what you send is stored on the unit profile, not only as chat bubbles.`;

  const usePersistedSlots = (p.profileSlots?.length ?? 0) > 0;
  const slots = usePersistedSlots ? p.profileSlots! : tmpl.slots.map((s) => ({ ...s }));

  return {
    id: p.id,
    spaceId: resolvedSpaceId,
    domainId: resolvedDomainId,
    title: p.title,
    subtitle: p.subtitle ?? tmpl.subtitle,
    emoji: p.emoji ?? tmpl.emoji,
    status: p.status,
    progress: p.progress ?? 14,
    steps: tmpl.steps,
    profileSlots: slots,
    messages: [
      {
        id: `reg_${p.id}`,
        sender: 'one',
        text:
          intro +
          (firstEmpty
            ? he
              ? `\n\nכשתרצה נשלים את ${firstEmpty.label} — או תכתוב בחופשיות ואזין לפרופיל.`
              : `\n\nWhen you want we will complete ${firstEmpty.label}—or write freely and I will map it to the profile.`
            : ''),
        sentAt: Date.now(),
      },
    ],
    goal: p.fields?.goal ?? (he ? `להגשים: ${p.title}` : `Achieve: ${p.title}`),
    city: he ? 'לא צוין' : 'Not set',
    etaWeeks: 8,
    peopleRoles: [
      { id: 'p1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
      { id: 'p2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
    ],
    nextAction: p.nextAction ?? (firstEmpty ? (he ? `פרופיל: ${firstEmpty.label}` : `Profile: ${firstEmpty.label}`) : undefined),
    lastUpdatedLabel: he ? 'נוצר מהרשמה' : 'Created from signup',
    blockCount: 5,
  };
}

/** כדורי יחידה חדשים מיד מתחת לשורת הבית (origin), לא בסוף הגלגל */
export function insertPersonalOrbsAfterOrigin(prev: OrbItem[], orbs: OrbItem[]): OrbItem[] {
  if (!orbs.length) return prev;
  const idSet = new Set(orbs.map((o) => o.id));
  const without = prev.filter((p) => !idSet.has(p.id));
  const originIdx = without.findIndex((p) => p.id === 'origin');
  if (originIdx < 0) return [...orbs, ...without];
  return [...without.slice(0, originIdx + 1), ...orbs, ...without.slice(originIdx + 1)];
}

/** היסטוריית יחידות בצ׳אט סוכן — הישן למעלה */
export function flowUnitHistorySortKey(unit: FlowUnit): number {
  const times =
    unit.messages
      ?.map((m) => m.sentAt)
      .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t)) ?? [];
  if (times.length) return Math.min(...times);
  const parsed = /^unit_(\d+)$/.exec(unit.id);
  if (parsed) return Number(parsed[1]) || 0;
  return 0;
}

export function sortFlowUnitsHistoryOldestFirst(units: FlowUnit[]): FlowUnit[] {
  return [...units].sort((a, b) => {
    const d = flowUnitHistorySortKey(a) - flowUnitHistorySortKey(b);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

/** תשובת סוכן בצ׳אט יחידה — בלי עדכון הורה בתוך עדכון state אחר */
export function buildAgentUnitChatReply(unit: FlowUnit, userNote: string, language: AppLanguage): string {
  const clip = userNote.trim().slice(0, 220);
  const he = language === 'he';
  const na = unit.nextAction?.trim() || (he ? 'לא הוגדר' : 'not set');
  const goalHint =
    !unit.goal || unit.goal.length < 12
      ? he
        ? 'חדדו את המטרה במשפט אחד. '
        : 'State the goal in one clear sentence. '
      : '';
  if (he) {
    return (
      `שמרתי ב־«${unit.title}»: ${clip || 'עדכון'}\n\n` +
      `${goalHint}הצעד הבא בפרופיל: «${na}».\n` +
      `כתבו במפורש מה לשנות ביעד, בצעד הבא, בחסם או בתאריך יעד — אמשיך לעדכן את השיחה ואת פרופיל היחידה כאן.`
    );
  }
  return (
    `Saved under «${unit.title}»: ${clip || 'update'}\n\n` +
    `${goalHint}Next step on the profile: «${na}».\n` +
    `Spell out changes to goal, next step, blocker, or target date — I will keep the thread and unit profile aligned here.`
  );
}
