/**
 * businessDirectory — a tiny directory of businesses that each "have their own
 * ONE". When the user talks to their home ONE about one of these (by name or a
 * strong keyword), ONE answers from the business's data — its hours, prices and
 * open slots — as if it consulted that business's ONE.
 *
 * Mirrors the web product's bizBrain. Pure + localized; no network.
 */

type Lang = 'he' | 'en';
interface Loc {
  he: string;
  en: string;
}
interface BizService {
  label: Loc;
  price: string;
}
export interface DirectoryBusiness {
  id: string;
  emoji: string;
  name: Loc;
  category: Loc;
  hoursText: Loc;
  services: BizService[];
  slots: string[];
  /** Lowercase keywords (he + en) that clearly point at THIS business. Kept
   *  tight so a generic "I want a haircut" still opens a process, not a lookup. */
  aliases: string[];
  /** Set for cloud (Supabase-backed) businesses — enables follow + owner
   *  dashboard + cloud booking. Absent on the built-in static directory. */
  cloudId?: string;
  /** Capability key of the creator (only present on cloud businesses). */
  ownerKey?: string;
}

export const DIRECTORY: DirectoryBusiness[] = [
  {
    id: 'sarah',
    emoji: '💈',
    name: { he: 'מספרת שרה', en: 'Sarah Salon' },
    category: { he: 'מספרה', en: 'Hair salon' },
    hoursText: {
      he: 'א׳–ה׳ 09:00–20:00 · ו׳ 09:00–14:00 · שבת סגור',
      en: 'Sun–Thu 09:00–20:00 · Fri 09:00–14:00 · Sat closed',
    },
    services: [
      { label: { he: 'תספורת', en: 'Haircut' }, price: '₪80' },
      { label: { he: 'פן', en: 'Blow-dry' }, price: '₪120' },
      { label: { he: 'צבע', en: 'Color' }, price: '₪250' },
    ],
    slots: ['שלישי 18:00', 'רביעי 10:00', 'חמישי 12:00'],
    aliases: ['מספרה', 'מספרת שרה', 'שרה', 'sarah salon', 'sarah', 'salon', 'hairdresser'],
  },
  {
    id: 'dana',
    emoji: '🚗',
    name: { he: 'מורה דנה', en: 'Instructor Dana' },
    category: { he: 'מורה נהיגה', en: 'Driving instructor' },
    hoursText: {
      he: 'א׳–ה׳ 08:00–18:00 · ו׳ 08:00–12:00 · שבת סגור',
      en: 'Sun–Thu 08:00–18:00 · Fri 08:00–12:00 · Sat closed',
    },
    services: [
      { label: { he: 'שיעור נהיגה', en: 'Driving lesson' }, price: '₪160' },
      { label: { he: 'ליווי לטסט', en: 'Test-day escort' }, price: '₪450' },
    ],
    slots: ['ראשון 08:00', 'שני 15:00', 'רביעי 17:00'],
    aliases: ['מורה נהיגה', 'מורה לנהיגה', 'מורה דנה', 'דנה', 'instructor dana', 'driving instructor'],
  },
  {
    id: 'allmove',
    emoji: '📦',
    name: { he: 'אולמוב הובלות', en: 'AllMove' },
    category: { he: 'חברת הובלות', en: 'Moving company' },
    hoursText: {
      he: 'א׳–ו׳ 07:00–19:00 · שבת סגור',
      en: 'Sun–Fri 07:00–19:00 · Sat closed',
    },
    services: [
      { label: { he: 'הובלת 2 חדרים', en: '2-room move' }, price: 'מ-₪1,750' },
      { label: { he: 'אריזה', en: 'Packing' }, price: '₪400' },
    ],
    slots: ['ה-26 בבוקר', 'ה-28 בבוקר', 'ה-28 בערב'],
    aliases: ['הובלות', 'חברת הובלות', 'מובילים', 'הובלה', 'allmove', 'movers', 'moving company'],
  },
];

/** Find the business a home message is talking about (by name or strong alias). */
export function findDirectoryBusiness(text: string): DirectoryBusiness | undefined {
  const t = text.toLowerCase();
  return DIRECTORY.find((b) => b.aliases.some((a) => t.includes(a)));
}

/**
 * Like findDirectoryBusiness but over a merged list (static + live cloud
 * businesses). Cloud entries are searched first so a user-created business
 * wins over a same-named built-in one.
 */
export function findAnyBusiness(
  text: string,
  cloud: DirectoryBusiness[],
): DirectoryBusiness | undefined {
  const t = text.toLowerCase();
  return (
    cloud.find((b) => b.aliases.some((a) => a.length > 1 && t.includes(a))) ??
    findDirectoryBusiness(text)
  );
}

function slotMatches(slot: string, t: string): boolean {
  const parts = slot.toLowerCase().split(/\s+/);
  return parts.some((p) => p.length > 2 && t.includes(p));
}

/**
 * Does this message ask to BOOK with the business? Fires on an explicit booking
 * verb, a bare "yes", OR a bare slot mention ("רביעי 10") — the last is key for
 * a follow-up turn after ONE offered times, so it doesn't forget the context.
 */
export function directoryBookingIntent(
  biz: DirectoryBusiness,
  text: string,
): { slot: string; service?: string } | null {
  const t = text.trim().toLowerCase();
  const matched = biz.slots.find((s) => slotMatches(s, t));
  const wantsBooking =
    /לקבוע|תקבע|תזמן|קבע לי|תקבעי|לתאם|book|reserve|schedule/.test(t) ||
    /^(כן|בטח|סבבה|בסדר|אוקיי|אישור|yes|yeah|sure|ok|okay)\b/.test(t);
  if (!matched && !wantsBooking) return null;
  const service = biz.services.find(
    (s) => t.includes(s.label.he.toLowerCase()) || t.includes(s.label.en.toLowerCase()),
  );
  return { slot: matched ?? biz.slots[0], service: service?.label.he };
}

/** Confirmation line after ONE books on your behalf. */
export function directoryBookingConfirm(
  biz: DirectoryBusiness,
  slot: string,
  service: string | undefined,
  lang: Lang,
): string {
  const name = biz.name[lang];
  if (lang === 'he') {
    return `סגור! קבעתי לך ${service ? service + ' ' : ''}ב${slot} ב${name}. הוספתי את זה לתהליכים שלך.`;
  }
  return `Done! Booked ${service ? service + ' ' : ''}for ${slot} at ${name}. Added to your processes.`;
}

/** ONE's answer, sourced from the business's ONE. */
export function businessDirectoryReply(biz: DirectoryBusiness, text: string, lang: Lang): string {
  const t = text.toLowerCase();
  const name = biz.name[lang];
  const via = lang === 'he' ? `בדקתי עם הוואן של ${name}` : `I checked with ${name}'s ONE`;

  if (/שע|פתוח|סגור|hour|open|close|מתי/.test(t)) {
    return lang === 'he' ? `${via} — ${biz.hoursText.he}.` : `${via} — ${biz.hoursText.en}.`;
  }
  if (/מחיר|כמה|עלות|price|cost|service|שירות/.test(t)) {
    const list = biz.services.map((s) => `${s.label[lang]} ${s.price}`).join(', ');
    return lang === 'he' ? `${via} — ${list}. שאקבע תור?` : `${via} — ${list}. Want me to book?`;
  }
  if (/תור|פנוי|לקבוע|book|available|slot|time|זמין/.test(t)) {
    const slots = biz.slots.join(', ');
    return lang === 'he'
      ? `${via} — זמנים פנויים: ${slots}. שאתפוס אחד?`
      : `${via} — open times: ${slots}. Want me to grab one?`;
  }
  return lang === 'he'
    ? `יש לי קשר עם הוואן של ${name} — אפשר לשאול על שעות, מחירים או לקבוע תור.`
    : `I'm connected to ${name}'s ONE — ask about hours, prices, or booking.`;
}
