/**
 * booking — ONE's appointment-booking tool. Detects a "book me a time" intent
 * and builds a BookingRun with concrete slots ONE can offer in the thread.
 *
 * For now the slots are generated locally (next business days, a few hours
 * each) so the widget is a complete pick-a-time loop with or without a backend.
 * When the two-sided provider side of Units lands, these slots come from the
 * provider's real availability instead — same widget, real data.
 */
import type { BookingRun, BookingSlot } from '../../core/mvp/types';

/** Does this message ask ONE to set up an appointment / time? */
export function bookingForText(text: string): boolean {
  return /לקבוע תור|לתאם תור|קביעת תור|לקבוע פגישה|לתאם פגישה|לזמן תור|תקבע (לי )?תור|book(\s+an?\s+)?(appointment|slot|time|meeting)|make an appointment|schedule (a|an|me)|set up a (time|meeting|call)/i.test(
    text,
  );
}

const DAYS_HE = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Offer late-morning / early-afternoon / late-afternoon on each working day.
const SLOT_HOURS = [10, 13, 16];

/** Build a booking with ~6 concrete slots over the next working days (Israel:
 *  Sun–Fri, skip Saturday). Pure/deterministic given `now`. */
export function buildBookingRun(opts: {
  unitId?: string;
  title: string;
  provider?: string;
  lang: 'en' | 'he';
  now?: number;
}): BookingRun {
  const he = opts.lang === 'he';
  const now = opts.now ?? Date.now();
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const slots: BookingSlot[] = [];
  for (let dayOffset = 1; dayOffset <= 10 && slots.length < 6; dayOffset++) {
    const d = new Date(base);
    d.setDate(base.getDate() + dayOffset);
    if (d.getDay() === 6) continue; // skip Saturday
    const dayName = he ? DAYS_HE[d.getDay()] : DAYS_EN[d.getDay()];
    for (const h of SLOT_HOURS) {
      if (slots.length >= 6) break;
      const slotDate = new Date(d);
      slotDate.setHours(h, 0, 0, 0);
      slots.push({
        id: `slot_${slotDate.getTime()}`,
        label: `${dayName} ${String(h).padStart(2, '0')}:00`,
        iso: slotDate.toISOString(),
      });
    }
  }

  return {
    id: `bk_${Date.now()}`,
    unitId: opts.unitId,
    title: opts.title,
    provider: opts.provider,
    slots,
  };
}
