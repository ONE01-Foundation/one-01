import type { AppLanguage } from '../stores/localeStore';
import type { UnitProfileSlot } from '../components/UnitChatProfile';
import type { FlowUnit } from './flowUnit';

export function nextMissingSlot(slots: UnitProfileSlot[]): UnitProfileSlot | undefined {
  const req = slots.find((s) => !s.optional && !s.value?.trim());
  if (req) return req;
  return slots.find((s) => s.optional && !s.value?.trim());
}

export function applyProfileSlotsFromMessage(unit: FlowUnit, text: string, language: AppLanguage): FlowUnit {
  const slots = (unit.profileSlots ?? []).map((s) => ({ ...s }));
  if (!slots.length) return unit;
  const t = text.trim();
  const he = language === 'he';
  const idx = slots.findIndex((s) => !s.value?.trim());
  if (idx < 0) return unit;
  const slot = slots[idx];
  const lower = t.toLowerCase();
  const numMatch = t.match(/-?\d+([.,]\d+)?/);
  const num = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : null;

  if (slot.id === 'theory_done') {
    if (/^(כן|yes|y|true|1|עבר)/i.test(lower)) slot.value = he ? 'כן' : 'Yes';
    else if (/^(לא|no|n|false|0)/i.test(lower)) slot.value = he ? 'לא' : 'No';
    else slot.value = t.slice(0, 48);
  } else if (
    slot.id === 'age' ||
    slot.id === 'weight_current' ||
    slot.id === 'weight_target' ||
    slot.id === 'lessons_done' ||
    slot.id === 'hours_week'
  ) {
    slot.value = num != null && !Number.isNaN(num) ? String(num) : t.slice(0, 48);
  } else {
    slot.value = t.slice(0, 120);
  }

  const required = slots.filter((s) => !s.optional);
  const filledReq = required.filter((s) => s.value?.trim()).length;
  const progress = Math.min(94, 10 + Math.round((filledReq / Math.max(required.length, 1)) * 72));
  const next = nextMissingSlot(slots);
  const nextAction = next
    ? he
      ? `למלא בפרופיל: ${next.label}`
      : `Fill in profile: ${next.label}`
    : he
      ? 'לסגור יעד שבועי או צעד מדידה הבא'
      : 'Set a weekly target or next check-in';

  let milestonesOut = unit.milestones;
  if (required.length > 0 && filledReq >= required.length) {
    const age = slots.find((s) => s.id === 'age')?.value;
    const wc = slots.find((s) => s.id === 'weight_current')?.value;
    const wt = slots.find((s) => s.id === 'weight_target')?.value;
    if (age && wc && wt) {
      milestonesOut = he
        ? [
            { id: 'mw1', title: 'מדידת התחלה + יעד שבועי קטן', done: true },
            { id: 'mw2', title: 'שגרת תזונה ופעילות ל־4 שבועות', done: false },
            { id: 'mw3', title: 'בדיקת ביניים מול משקל יעד', done: false },
            { id: 'mw4', title: 'ייצוב משקל ושמירה', done: false },
          ]
        : [
            { id: 'mw1', title: 'Baseline weigh-in + small weekly target', done: true },
            { id: 'mw2', title: 'Nutrition & movement habit (4 weeks)', done: false },
            { id: 'mw3', title: 'Mid-check vs target weight', done: false },
            { id: 'mw4', title: 'Stabilize and maintain', done: false },
          ];
    } else if (slots.some((s) => s.id === 'theory_done')) {
      milestonesOut = he
        ? [
            { id: 'ml1', title: 'תיאוריה / שיעורים לפי הסטטוס שמילאת', done: true },
            { id: 'ml2', title: 'תיאום מבחן מעשי', done: false },
            { id: 'ml3', title: 'מבחן וקבלת רישיון', done: false },
          ]
        : [
            { id: 'ml1', title: 'Theory / lessons per your status', done: true },
            { id: 'ml2', title: 'Schedule practical test', done: false },
            { id: 'ml3', title: 'Exam & license pickup', done: false },
          ];
    }
  }

  return {
    ...unit,
    profileSlots: slots,
    progress,
    nextAction,
    lastUpdatedLabel: he ? 'עודכן מהצ׳אט לפרופיל' : 'Profile updated from chat',
    milestones: milestonesOut,
  };
}

export function findNewlyFilledSlotLabel(before: UnitProfileSlot[], after: UnitProfileSlot[]): string | undefined {
  for (let i = 0; i < after.length; i++) {
    if (!before[i]?.value?.trim() && after[i]?.value?.trim()) return after[i].label;
  }
  return undefined;
}

export function buildAdaptiveProfileReply(beforeUnit: FlowUnit, afterUnit: FlowUnit, userText: string, language: AppLanguage): string {
  const he = language === 'he';
  const slots = afterUnit.profileSlots ?? [];
  const beforeSlots = beforeUnit.profileSlots ?? [];
  const filledLabel = findNewlyFilledSlotLabel(beforeSlots, slots);
  const next = nextMissingSlot(slots);
  const userTurn = beforeUnit.messages.filter((m) => m.sender === 'user').length + 1;
  const requiredLeft = slots.filter((s) => !s.optional && !s.value?.trim()).length;

  const clip = userText.trim().slice(0, 180);
  const ack = filledLabel
    ? he
      ? `הבנתי. «${filledLabel}» נשמר בפרופיל היחידה.`
      : `Understood. «${filledLabel}» is saved on the unit profile.`
    : he
      ? 'קלטתי ושמרתי בפרופיל.'
      : 'Got it—saved to the unit profile.';

  if (requiredLeft === 0) {
    const opt = slots.find((s) => s.optional && !s.value?.trim());
    return he
      ? `${ack}\nהשדות המרכזיים מלאים — אפשר לבנות עכשיו תוכנית שבוע אחת קצרה (מדד אחד + פעולה אחת).${opt ? ` אם תרצה, בהמשך גם ${opt.label}.` : ''}`
      : `${ack}\nCore fields are set—we can shape one short weekly plan (one metric + one action).${opt ? ` Later we can add ${opt.label} if you want.` : ''}`;
  }

  if (clip.length > 80 || /[\n.]/.test(userText)) {
    return he
      ? `${ack}\n${next ? `כשיהיה לך נוח נשלים גם ${next.label} — רק אם זה רלוונטי לך עכשיו.` : 'כשתרצה נמשיך לחדד את התהליך.'}`
      : `${ack}\n${next ? `When it feels right we can finish ${next.label} too—only if it matters now.` : 'We can refine the flow whenever you want.'}`;
  }

  if (userTurn % 2 === 0 && next) {
    return he
      ? `${ack}\nאם תרצה בהמשך — ${next.label}.`
      : `${ack}\nWhenever you want next: ${next.label}.`;
  }

  if (next) {
    return he
      ? `${ack}\nכדי לסגור את התמונה בפרופיל — ${next.label}?`
      : `${ack}\nTo round out the profile—${next.label}?`;
  }

  return ack;
}
