/**
 * bizBrain — the ONE that sits inside a business profile. It answers from the
 * business's own data (hours, services, open slots) and can turn a free-text
 * request into a booking. This is the ONE-to-ONE moment: you talk to the
 * salon's ONE in plain language and it books you in.
 */

import type { Business } from "./mockData";

export interface BizResult {
  lines: string[];
  /** Show the slot chips prompt. */
  offerSlots?: boolean;
  /** A confirmed booking to enact (creates/updates a unit in your world). */
  booking?: { slot: string; service?: string };
}

const DAY_TOKENS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Strong keywords that clearly point at a specific business (kept tight so a
// generic "I want a haircut" still opens a process, not a salon lookup).
const BIZ_ALIASES: Record<string, string> = {
  salon: "sarah",
  hairdresser: "sarah",
  "driving instructor": "dana",
  instructor: "dana",
  movers: "allmove",
  "moving company": "allmove",
};

/** Find the business a home message is talking about (by name or strong alias). */
export function findBusiness(businesses: Business[], text: string): Business | undefined {
  const t = text.toLowerCase();
  const byName = businesses.find((b) => t.includes(b.name.toLowerCase()));
  if (byName) return byName;
  for (const [kw, id] of Object.entries(BIZ_ALIASES)) {
    if (t.includes(kw)) return businesses.find((b) => b.id === id);
  }
  return undefined;
}

/** Compact human hours string, grouping identical weekday blocks. */
export function formatHours(biz: Business): string {
  const weekdays = biz.hours.filter((h) => ["Sun", "Mon", "Tue", "Wed", "Thu"].includes(h.day));
  const sameWeekday = weekdays.every(
    (h) => h.open === weekdays[0].open && h.close === weekdays[0].close,
  );
  const fri = biz.hours.find((h) => h.day === "Fri");
  const sat = biz.hours.find((h) => h.day === "Sat");
  const parts: string[] = [];
  if (sameWeekday && weekdays[0].close) parts.push(`Sun–Thu ${weekdays[0].open}–${weekdays[0].close}`);
  if (fri) parts.push(fri.close ? `Fri ${fri.open}–${fri.close}` : "Fri closed");
  if (sat) parts.push(sat.close ? `Sat ${sat.open}–${sat.close}` : "Sat closed");
  return parts.join(" · ");
}

/** Open right now? `now` is passed in so the module stays pure. */
export function openState(biz: Business, now: Date): { open: boolean; text: string } {
  const dayIdx = now.getDay(); // 0 = Sun
  const h = biz.hours[dayIdx];
  if (!h || !h.close) return { open: false, text: "Closed today" };
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [hh, mm] = s.split(":").map(Number);
    return hh * 60 + mm;
  };
  const open = cur >= toMin(h.open) && cur < toMin(h.close);
  return { open, text: open ? `Open now · closes ${h.close}` : `Closed · opens ${h.open}` };
}

function servicesLine(biz: Business): string {
  return biz.services.map((s) => `${s.name} ${s.price}`).join(", ");
}

/** Match a slot the user described in free text ("book tuesday 6", "the 28th"). */
function matchSlot(biz: Business, t: string): string | undefined {
  return biz.slots.find((slot) => {
    const s = slot.toLowerCase();
    const dayTok = DAY_TOKENS.find((d) => s.startsWith(d));
    const timeMatch = s.match(/\d{1,2}(:\d{2})?/);
    const dayOk = dayTok ? t.includes(dayTok) : false;
    const timeOk = timeMatch ? t.includes(timeMatch[0].replace(":00", "")) || t.includes(timeMatch[0]) : false;
    // "the 28th" style slots (movers): match on the number.
    const numMatch = s.match(/\b(\d{1,2})(st|nd|rd|th)\b/);
    const numOk = numMatch ? t.includes(numMatch[1]) : false;
    return (dayOk && timeOk) || (numOk && /book|take|yes|confirm|the/.test(t));
  });
}

function serviceIn(biz: Business, t: string): string | undefined {
  return biz.services.find((s) => t.includes(s.name.toLowerCase().split(" ")[0]))?.name;
}

export function bizReply(biz: Business, text: string, now: Date): BizResult {
  const t = text.trim().toLowerCase();
  if (!t) return { lines: [`Hi! I'm ${biz.name}'s ONE — I can share hours, prices, or book you in.`] };

  if (/^(hi|hey|hello|shalom|yo)\b/.test(t)) {
    return { lines: [`Hi! I'm ${biz.name}'s ONE. Ask me our hours or prices, or I can find you a time.`] };
  }

  // Booking a specific time the user named.
  const named = matchSlot(biz, t);
  if (named && /\b(book|take|reserve|yes|confirm|want|the)\b/.test(t)) {
    return { lines: [`Done — I'll book you for ${named}. Confirming it now.`], booking: { slot: named, service: serviceIn(biz, t) } };
  }

  // Hours / open question.
  if (/\b(hour|hours|open|close|closing|when.*open|today|tomorrow)\b/.test(t)) {
    const st = openState(biz, now);
    return { lines: [`${st.text}. Our hours: ${formatHours(biz)}.`] };
  }

  // Prices / services.
  if (/\b(price|prices|cost|how much|service|services|menu|charge)\b/.test(t)) {
    return { lines: [`Here's what we do: ${servicesLine(biz)}. Want me to book one?`], offerSlots: true };
  }

  // Availability / booking intent.
  if (/\b(book|appointment|available|availability|slot|free|time|times|when can|schedule|reserve|tour)\b/.test(t) || named) {
    return { lines: [`Sure — here's what's open. Pick a time, or tell me a day that works.`], offerSlots: true };
  }

  return { lines: [`I can tell you our hours or prices, or find you a time — what works?`], offerSlots: true };
}
