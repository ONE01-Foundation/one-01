"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Orb } from "@/components/Orb";
import { OneWord } from "@/components/Logo";
import { Sheet } from "@/components/product/Sheet";
import {
  IDENTITIES,
  PROCESSES,
  BUSINESSES,
  PLAN_META,
  type PlanTier,
  type Process,
  type Business,
  type UnitDraft,
} from "@/lib/mockData";
import { interpret, type ChatMsg } from "@/lib/oneBrain";
import { bizReply, openState, findBusiness } from "@/lib/bizBrain";
import { invokeAiChat, oneSystemPrompt, type AiChatMessage } from "@/lib/aiChat";
import {
  ensureSession,
  saveUnits,
  loadUnits,
  fetchProviders,
  createBooking,
  fetchIncomingBookings,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  getSessionUser,
  onAuthChange,
  myKey,
  saveBusiness,
  followSet,
  isFollowing,
  fetchFollowers,
  fetchCustomers,
  type CloudStatus,
  type CloudBooking,
  type AuthUser,
  type CloudFollower,
  type CloudCustomer,
} from "@/lib/cloud";

// ONE aggregates each process from your connected sources. It infers which ones
// feed a given unit from the unit's type and any linked business — this is what
// makes "a digital intermediary that gathers reality for you" concrete: every
// number on a card came from somewhere ONE is watching on your behalf.
function unitSources(p: Process): { label: string; detail: string }[] {
  const out: { label: string; detail: string }[] = [];
  if (p.businessId) {
    const b = BUSINESSES.find((x) => x.id === p.businessId);
    if (b) out.push({ label: `${b.name}'s ONE`, detail: "Live availability, pricing & confirmations" });
  }
  switch (p.type) {
    case "gov":
      out.push({ label: "Gov portal", detail: "Application status & required forms" });
      out.push({ label: "Email", detail: "Official confirmations" });
      break;
    case "move":
      out.push({ label: "Email", detail: "Mover quotes & threads" });
      out.push({ label: "Calendar", detail: "Move-out date" });
      break;
    case "fitness":
      out.push({ label: "Health app", detail: "Weight, sleep & activity" });
      break;
    case "finance":
      out.push({ label: "Accounting", detail: "Invoice & payment status" });
      break;
    case "business":
      out.push({ label: "Email", detail: `Thread with ${p.relation}` });
      out.push({ label: "CRM", detail: "Deal stage & notes" });
      break;
    case "appointment":
      out.push({ label: "Calendar", detail: "Your availability" });
      break;
  }
  return out;
}

/**
 * Turn a cloud booking (written by another party's ONE) into a provider-side
 * process card — the incoming-request view of the two-sided marketplace.
 */
function bookingToProcess(b: CloudBooking): Process {
  const done = b.status === "pending" ? 1 : 2;
  return {
    id: `cloud_${b.id}`,
    identityId: "one01",
    emoji: "📥",
    title: `Booking request — ${b.customer_name}`,
    time: "now",
    unread: b.status === "pending" ? 1 : 0,
    summary: `${b.service ? b.service + " · " : ""}${b.slot} — ${b.status}. Arrived from ${b.customer_name}'s ONE.`,
    type: "appointment",
    nextAction:
      b.status === "pending" ? `Confirm ${b.slot} or propose another time.` : `Confirmed for ${b.slot}.`,
    metrics: [
      { label: "Service", value: b.service ?? "—" },
      { label: "Requested", value: b.slot },
      { label: "Client", value: b.customer_name },
      { label: "Status", value: b.status },
    ],
    quickActions: ["Confirm booking", "Propose another time", "Message client"],
    insights: ["Arrived from a customer's ONE through the shared cloud."],
    relation: b.customer_name,
    progress: { done, total: 3 },
    people: [b.customer_name],
    steps: [
      { label: "Request received", done: true },
      { label: "Confirm the time", done: b.status !== "pending" },
      { label: "Send calendar hold", done: false },
    ],
    decisions: [],
    timeline: [{ at: "now", text: `${b.customer_name}'s ONE requested ${b.slot}.` }],
  };
}

/**
 * Turn a free-text description ("a hair salon, haircut ₪80, color ₪250, open
 * 9–6") into a partial Business — ONE building the profile from conversation.
 */
function parseBusinessFromText(text: string): Partial<Business> {
  const t = text.trim();
  const out: Partial<Business> = {};

  const catMap: [RegExp, string, string][] = [
    // Order matters: more-specific categories come first. "nail salon" must match
    // the beauty rule, not the broader hair-"salon" rule below it.
    [/nail|manicure|pedicure|spa|beauty|makeup|lash|wax/i, "Beauty studio", "💅"],
    [/salon|hair|barber|styl/i, "Hair salon", "💈"],
    [/driv/i, "Driving instructor", "🚗"],
    [/mov(e|ing)/i, "Moving company", "📦"],
    [/clinic|doctor|dentist|dental|medical/i, "Clinic", "🩺"],
    [/gym|fitness|train|yoga|pilates/i, "Fitness studio", "🏋️"],
    [/cafe|coffee|restaurant|food|bakery|kitchen/i, "Café", "☕"],
    [/photo/i, "Photographer", "📷"],
    [/law|legal|account/i, "Professional services", "💼"],
    [/clean/i, "Cleaning service", "🧽"],
    [/tutor|lesson|teacher|course/i, "Tutor", "📚"],
  ];
  out.emoji = "🏪";
  out.category = "Local business";
  for (const [re, cat, emoji] of catMap) {
    if (re.test(t)) {
      out.category = cat;
      out.emoji = emoji;
      break;
    }
  }

  const nameM =
    t.match(/\b(?:called|named)\s+([A-Z][\w '&-]{1,30})/) ||
    t.match(/^([A-Z][\w '&-]{1,28}?)\s+(?:is|—|-|,|offers|provides|does)/);
  if (nameM) out.name = nameM[1].trim();

  const services: { name: string; price: string }[] = [];
  for (const c of t.split(/[,.;\n·—]|(?:\band\b)/i)) {
    const pm = c.match(/([₪$€]\s?\d[\d,]*)/);
    if (pm) {
      let n = c
        .replace(pm[0], "")
        .replace(/\b(costs?|is|are|for|price[ds]?|at|about|only|from)\b/gi, " ")
        .replace(/[-:–]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(a|an|the)\s+/i, "");
      if (n.length >= 2) services.push({ name: n.slice(0, 40), price: pm[1].replace(/\s/g, "") });
    }
  }
  if (services.length) out.services = services;

  const timeM = t.match(/(\d{1,2})(?::(\d{2}))?\s?(?:-|–|to|until|till)\s?(\d{1,2})(?::(\d{2}))?/i);
  if (timeM) {
    const open = `${timeM[1].padStart(2, "0")}:${timeM[2] ?? "00"}`;
    const close = `${timeM[3].padStart(2, "0")}:${timeM[4] ?? "00"}`;
    out.hours = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) =>
      d === "Sat"
        ? { day: d, open: "", close: null }
        : d === "Fri"
          ? { day: d, open, close: "14:00" }
          : { day: d, open, close },
    );
  }
  return out;
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41.6 16.2 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.8 36.3 45 30.9 45 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9.5A1.7 1.7 0 0 0 11 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A unit's live detail — metrics, steps, connections, insights, decisions,
 * timeline, sources. Rendered in the desktop split BESIDE the unit's chat, so
 * it updates the moment the chat changes the unit. Reads its Process fresh each
 * render, so upserts show immediately.
 */
/* Drawer toggle — a chevron; points toward opening, flips 180° when open. */
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/* Home scroll affordances — up reveals Global, down reveals Updates. */
function ChevronUpIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/* Temporary chat — the dashed ring from the mobile app: a conversation that
   leaves no trace. */
function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
/* Kebab — three vertical dots; opens the unit's options menu. */
function KebabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}
/** Voice bars — the resting state of the dock's action button, as in the app's
    hero. It flips to the send arrow the moment there's something to send. */
function VoiceIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8.5v7M12 4.5v15M16 8.5v7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** The one input bar the whole product uses — the hero's capsule: a quiet "+"
    inside on the left, the dark action button on the right. Same shape on the
    home canvas and inside an open unit, so the product has a single "speak to
    ONE" affordance rather than one per surface. */
function AppInput({
  value,
  onChange,
  onSend,
  placeholder,
  caret = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  /** Home: no placeholder copy at all — just a resting caret, so ONE looks
   *  ready to be spoken to rather than instructing you. (Same as the hero.) */
  caret?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasText = value.trim().length > 0;
  return (
    <div className="app-bar">
      <button className="app-bar-plus" aria-label="Add" type="button">
        <PlusIcon />
      </button>
      <span className="app-bar-wrap">
        {caret && !value && !focused && <span className="app-bar-caret" aria-hidden="true" />}
        <input
          className="app-bar-input"
          dir="auto"
          placeholder={caret ? undefined : placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
        />
      </span>
      <button
        className="app-bar-go"
        aria-label={hasText ? "Send" : "Voice"}
        type="button"
        onClick={() => hasText && onSend()}
      >
        {hasText ? <SendIcon /> : <VoiceIcon />}
      </button>
    </div>
  );
}

// ── ONE's capabilities — the skills you switch on. A small catalog you enable
//    from the profile (or add from Global); each is a thing ONE can DO for you.
interface Capability {
  key: string;
  emoji: string;
  en: string;
  he: string;
  descEn: string;
  descHe: string;
}
const CAPABILITY_CATALOG: Capability[] = [
  {
    key: "booking",
    emoji: "📅",
    en: "Appointment booking",
    he: "קביעת תורים",
    descEn: "Finds open times and books with providers.",
    descHe: "מוצא זמנים פנויים וקובע מול נותני שירות.",
  },
  {
    key: "reminders",
    emoji: "⏰",
    en: "Reminders",
    he: "תזכורות",
    descEn: "Nudges you before anything is due.",
    descHe: "מזכיר לך לפני כל מועד.",
  },
  {
    key: "forms",
    emoji: "🗂️",
    en: "Form filling",
    he: "מילוי טפסים",
    descEn: "Fills out forms and applications for you.",
    descHe: "ממלא עבורך טפסים ובקשות.",
  },
  {
    key: "quiz",
    emoji: "🎓",
    en: "Quiz teaching",
    he: "לימוד עם מבחנים",
    descEn: "Teaches a topic with multiple-choice quizzes.",
    descHe: "מלמד נושא עם מבחני בחירה אמריקאיים.",
  },
  {
    key: "research",
    emoji: "🔎",
    en: "Research & compare",
    he: "מחקר והשוואה",
    descEn: "Gathers options and compares them for you.",
    descHe: "אוסף אפשרויות ומשווה ביניהן בשבילך.",
  },
  {
    key: "translate",
    emoji: "🌐",
    en: "Translate",
    he: "תרגום",
    descEn: "Translates messages and documents between languages.",
    descHe: "מתרגם הודעות ומסמכים בין שפות.",
  },
  {
    key: "travel",
    emoji: "✈️",
    en: "Trip planning",
    he: "תכנון טיולים",
    descEn: "Plans routes, stays and bookings for a trip.",
    descHe: "מתכנן מסלול, לינה והזמנות לטיול.",
  },
  {
    key: "negotiate",
    emoji: "🤝",
    en: "Negotiate",
    he: "משא ומתן",
    descEn: "Handles back-and-forth to get you a better deal.",
    descHe: "מנהל את המשא ומתן כדי להשיג לך עסקה טובה יותר.",
  },
];
// Capabilities behind a paid plan (a subscription is required to switch on).
const PREMIUM_CAPS = ["research", "travel", "negotiate"];
// Map a free-text ask to the capability it needs (first match wins).
const CAP_INTENT: { key: string; re: RegExp }[] = [
  { key: "quiz", re: /\b(quiz|test)\s+me\b|\bteach me\b|תבחן אות|בחן אות|תלמד אות|למד אות|מבחן|תרגול/i },
  { key: "booking", re: /\bbook\b|schedule|appointment|reserve|קבע(?: לי)? תור|לקבוע תור|תזמן|להזמין תור/i },
  { key: "forms", re: /fill (out )?(the )?form|application form|למלא (לי )?טופס|תמלא טופס|בקשה רשמית/i },
  { key: "reminders", re: /remind me|set a reminder|תזכיר לי|קבע תזכורת|תזכורת/i },
  { key: "translate", re: /translate|תרגם|תתרגם|תרגום ל/i },
  { key: "travel", re: /plan (a )?trip|itinerary|תכנן(?: לי)? טיול|מסלול טיול|לתכנן חופשה/i },
  { key: "negotiate", re: /negotiate|haggle|get a better (price|deal)|תנהל מו"מ|להתמקח|לנהל משא ומתן/i },
  { key: "research", re: /research|compare|which is better|תשווה|השוואה בין|מה עדיף|תחקור/i },
];
function capabilityForText(text: string): string | null {
  for (const c of CAP_INTENT) if (c.re.test(text)) return c.key;
  return null;
}
function capName(key: string, lang: "en" | "he"): string {
  const c = CAPABILITY_CATALOG.find((x) => x.key === key);
  return c ? (lang === "he" ? c.he : c.en) : key;
}

// ── Official / trusted sources ONE may draw on in Global. `official` sources are
//    authoritative (gov offices); `reference` are open knowledge (Wikipedia).
//    Adding custom channels is role-gated (coming) — see the Global note.
interface Source {
  key: string;
  emoji: string;
  en: string;
  he: string;
  kind: "official" | "reference";
  host: string;
}
const SOURCE_CATALOG: Source[] = [
  { key: "licensing", emoji: "🚗", en: "Licensing Authority", he: "רשות הרישוי", kind: "official", host: "gov.il" },
  { key: "gov", emoji: "🏛️", en: "Government portal", he: "פורטל השירותים הממשלתי", kind: "official", host: "gov.il" },
  { key: "nii", emoji: "📋", en: "National Insurance", he: "ביטוח לאומי", kind: "official", host: "btl.gov.il" },
  { key: "health", emoji: "🩺", en: "Ministry of Health", he: "משרד הבריאות", kind: "official", host: "health.gov.il" },
  { key: "wikipedia", emoji: "📚", en: "Wikipedia", he: "ויקיפדיה", kind: "reference", host: "wikipedia.org" },
];

// ── ONE's memory — the personal facts it holds, each with its own permission.
//    This is selective disclosure: you decide per field whether ONE may use it
//    freely, must ask first, or keep it private.
interface MemoryFact {
  key: string;
  emoji: string;
  en: string;
  he: string;
}
const MEMORY_CATALOG: MemoryFact[] = [
  { key: "name", emoji: "🪪", en: "Name", he: "שם" },
  { key: "age", emoji: "🎂", en: "Age", he: "גיל" },
  { key: "gender", emoji: "🧑", en: "Gender", he: "מין" },
  { key: "address", emoji: "🏠", en: "Address", he: "כתובת" },
  { key: "phone", emoji: "📱", en: "Phone", he: "טלפון" },
  { key: "email", emoji: "✉️", en: "Email", he: "אימייל" },
  { key: "height", emoji: "📏", en: "Height", he: "גובה" },
  { key: "weight", emoji: "⚖️", en: "Weight", he: "משקל" },
  { key: "idnum", emoji: "🆔", en: "ID number", he: "תעודת זהות" },
];
type MemPerm = "open" | "ask" | "private";
const PERM_CYCLE: Record<MemPerm, MemPerm> = { open: "ask", ask: "private", private: "open" };
const PERM_DOT: Record<MemPerm, string> = { open: "🟢", ask: "🟡", private: "🔴" };
interface MemEntry {
  value: string;
  perm: MemPerm;
}

// Best-effort Wikipedia thumbnail for a topic — an allowed open-reference image
// source. The REST summary API sends CORS headers, so this works from the
// browser. Returns null on any miss so callers can silently skip the image.
async function wikiThumbnail(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    return j.thumbnail?.source ?? j.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

// Hebrew for the details card — section headers, plus lookups that translate the
// common machine-written metric labels / values / quick-actions so a Hebrew card
// doesn't read half-English. Unknown terms fall back to their original text.
const UNIT_SECTION: Record<"en" | "he", Record<string, string>> = {
  en: {
    nextSteps: "Next steps",
    connections: "Connections",
    insights: "Insights",
    decisions: "Decisions",
    timeline: "Timeline",
    sources: "Sources",
  },
  he: {
    nextSteps: "השלבים הבאים",
    connections: "קשרים",
    insights: "תובנות",
    decisions: "החלטות",
    timeline: "ציר זמן",
    sources: "מקורות",
  },
};
const METRIC_LABEL_HE: Record<string, string> = {
  when: "מתי",
  status: "סטטוס",
  provider: "נותן השירות",
  service: "שירות",
  documents: "מסמכים",
  fee: "עלות",
  cost: "עלות",
  appointment: "תור",
  deadline: "מועד אחרון",
  contact: "איש קשר",
  location: "מיקום",
  budget: "תקציב",
  date: "תאריך",
  time: "שעה",
  people: "אנשים",
};
const VALUE_HE: Record<string, string> = {
  "in progress": "בתהליך",
  confirmed: "מאושר",
  paid: "שולם",
  pending: "ממתין",
  done: "הושלם",
  booked: "נקבע",
  "not started": "טרם התחיל",
};
const ACTION_HE: Record<string, string> = {
  "book appointment": "קבע תור",
  "upload a document": "העלה מסמך",
  "add the fee": "הוסף עלות",
  reschedule: "שנה מועד",
  "message provider": "שלח הודעה",
  "message client": "הודעה ללקוח",
  "add to calendar": "הוסף ליומן",
  "confirm booking": "אשר הזמנה",
  "propose another time": "הצע זמן אחר",
};

function UnitDetail({
  p,
  businesses,
  isStepDone,
  toggleStep,
  runQuickAction,
  openBiz,
  lang,
  onDraftEdit,
  onDraftApprove,
  onDraftDiscard,
}: {
  p: Process;
  businesses: Business[];
  isStepDone: (p: Process, i: number) => boolean;
  toggleStep: (p: Process, i: number) => void;
  runQuickAction: (p: Process, label: string) => void;
  openBiz: (id: string) => void;
  lang: "en" | "he";
  onDraftEdit: (procId: string, draftId: string, body: string) => void;
  onDraftApprove: (procId: string, draftId: string) => void;
  onDraftDiscard: (procId: string, draftId: string) => void;
}) {
  const sources = unitSources(p);
  const he = lang === "he";
  const S = UNIT_SECTION[lang];
  const locMetric = (s: string) => (he ? METRIC_LABEL_HE[s.trim().toLowerCase()] ?? s : s);
  const locValue = (s: string) => (he ? VALUE_HE[s.trim().toLowerCase()] ?? s : s);
  const locAction = (s: string) => (he ? ACTION_HE[s.trim().toLowerCase()] ?? s : s);
  return (
    <div className="unit-detail-body">
      {p.nextAction && <div className="unit-pulse unit-detail-pulse">{p.nextAction}</div>}

      {p.metrics && p.metrics.length > 0 && (
        <div className="metric-grid">
          {p.metrics.map((m) => (
            <div className="metric" key={m.label}>
              <div className="metric-value">{locValue(m.value)}</div>
              <div className="metric-label">{locMetric(m.label)}</div>
            </div>
          ))}
        </div>
      )}

      {p.quickActions && p.quickActions.length > 0 && (
        <div className="qa-row">
          {p.quickActions.map((a) => (
            <button key={a} className="qa-btn" onClick={() => runQuickAction(p, a)}>
              {locAction(a)}
            </button>
          ))}
        </div>
      )}

      <div className="sheet-section">
        <h4>{S.nextSteps}</h4>
        {p.steps.map((s, i) => {
          const done = isStepDone(p, i);
          return (
            <button
              key={i}
              className={`step-item${done ? " done" : ""}`}
              style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onClick={() => toggleStep(p, i)}
            >
              <span className={`step-check${done ? " done" : ""}`}>{done ? "✓" : ""}</span>
              <span className="step-text">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sheet-section">
        <h4>{S.connections}</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(p.people.length ? p.people : [p.relation]).filter(Boolean).map((person) => {
            const b = businesses.find(
              (x) =>
                person.toLowerCase().includes(x.name.toLowerCase()) ||
                x.name.toLowerCase().includes(person.toLowerCase()),
            );
            return b ? (
              <button
                key={person}
                className="sheet-pill ghost biz-link"
                style={{ fontWeight: 600, fontSize: 12.5 }}
                onClick={() => openBiz(b.id)}
              >
                {b.emoji} {person} ›
              </button>
            ) : (
              <span key={person} className="sheet-pill ghost" style={{ fontWeight: 600, fontSize: 12.5 }}>
                {person}
              </span>
            );
          })}
        </div>
      </div>

      {p.insights && p.insights.length > 0 && (
        <div className="sheet-section">
          <h4>{S.insights}</h4>
          <div className="insight-list">
            {p.insights.map((t, i) => (
              <div className="insight" key={i}>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {p.decisions.length > 0 && (
        <div className="sheet-section">
          <h4>{S.decisions}</h4>
          {p.decisions.map((d) => (
            <div className="sheet-row" key={d}>
              <span className="r-label" style={{ fontWeight: 500 }}>
                {d}
              </span>
            </div>
          ))}
        </div>
      )}

      {p.drafts && p.drafts.length > 0 && (
        <div className="sheet-section">
          <h4>{he ? "טיוטות" : "Drafts"}</h4>
          <p className="draft-sub">
            {he
              ? "ONE ניסח את זה בשמך. תבדוק, תערוך ואשר — השליחה בפועל נשארת אצלך."
              : "ONE wrote these for you. Review, edit, approve — the actual send stays yours."}
          </p>
          {p.drafts.map((d) => (
            <div className={`draft-card${d.status === "approved" ? " is-approved" : ""}`} key={d.id}>
              <div className="draft-head">
                <span className="draft-kind">
                  {d.kind === "email" ? "✉️" : d.kind === "form" ? "🗂️" : "💬"}{" "}
                  {he
                    ? d.kind === "email"
                      ? "מייל"
                      : d.kind === "form"
                        ? "טופס"
                        : "הודעה"
                    : d.kind}
                </span>
                {d.to && (
                  <span className="draft-to">
                    {he ? "אל" : "To"}: {d.to}
                  </span>
                )}
                {d.status === "approved" && (
                  <span className="draft-badge">✓ {he ? "אושר" : "Approved"}</span>
                )}
              </div>
              {d.subject && <div className="draft-subject">{d.subject}</div>}
              <textarea
                className="draft-body"
                value={d.body}
                rows={5}
                onChange={(e) => onDraftEdit(p.id, d.id, e.target.value)}
              />
              <div className="draft-actions">
                <button
                  className="sheet-pill"
                  onClick={() => onDraftApprove(p.id, d.id)}
                  disabled={d.status === "approved"}
                >
                  {d.status === "approved" ? (he ? "מאושר ✓" : "Approved ✓") : he ? "אשר" : "Approve"}
                </button>
                <button className="sheet-pill ghost" onClick={() => onDraftDiscard(p.id, d.id)}>
                  {he ? "מחק" : "Discard"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sheet-section">
        <h4>{S.timeline}</h4>
        {p.timeline.map((ev, i) => (
          <div className="timeline-item" key={i}>
            <span className="timeline-dot" />
            <span>
              <b style={{ fontWeight: 600 }}>{ev.at}</b> — {ev.text}
            </span>
          </div>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="sheet-section">
          <h4>{S.sources}</h4>
          <div className="source-list">
            {sources.map((s) => (
              <div className="source-item" key={s.label}>
                <span className="source-dot" />
                <span className="source-label">{s.label}</span>
                <span className="source-detail">{s.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product chrome copy, EN + HE. Mock content (process titles, ONE's replies,
//    business data) stays in its own language — this covers the fixed UI only.
type UILang = "en" | "he";
const PRODUCT_UI: Record<UILang, Record<string, string>> = {
  en: {
    upgrade: "Upgrade",
    tempChat: "Temporary chat",
    exitTemp: "Exit temporary chat",
    options: "Options",
    editProfile: "Edit profile",
    wipeChat: "Wipe chat",
    capabilities: "Capabilities",
    capabilitiesSub: "What ONE can do for you",
    addCapability: "Add a capability",
    capAdd: "Add",
    capAdded: "Added",
    capsGlobalSub: "Switch on more of what ONE can do",
    sources: "Official sources",
    sourcesSub: "Trusted places ONE draws information from",
    official: "Official",
    reference: "Open reference",
    addSource: "Add a source",
    addSourceHint: "Adding channels is role-based — coming soon",
    capNeedRun: "Switch it on",
    memTitle: "Memory",
    memorySub: "What ONE knows — you set who each fact is shared with",
    memAddValue: "Add",
    permOpen: "Open",
    permAsk: "Ask first",
    permPrivate: "Private",
    memPulled: "Pulled from your memory",
    memShare: "Share for this",
    routeInto: "Continue in ",
    tempTag: "Temporary chat · nothing is saved",
    tempAnon: "Off the record. Ask me anything — I won't keep this.",
    newChat: "New chat",
    profiles: "Profiles",
    processes: "Processes",
    newProfile: "New profile",
    nothingHere: "Nothing here yet.",
    oneProfile: "ONE profile",
    settings: "Settings",
    cloudSynced: "☁ Synced to cloud",
    cloudConnecting: "☁ Connecting…",
    cloudOffline: "• Saved on this device",
    talkToOne: "Talk to ONE",
    tellChanged: "Tell ONE what changed…",
    hideDetails: "Hide details",
    details: "Details",
    share: "Share",
    copied: "Copied ✓",
    deleteProcess: "Delete process",
    confirmDelete: "Tap again to delete",
    done: "done",
    repSub: "Your representative across every identity.",
    account: "Account",
    signInBlurb: "Sign in so your processes follow you across every device.",
    continueGoogle: "Continue with Google",
    orMagic: "or a magic link",
    sendLink: "Send link",
    synced: "☁ synced",
    signOut: "Sign out",
    identity: "Identity",
    active: "active",
    plan: "Plan",
    onFree: "You're on FREE",
    unlockMore: "Unlock more with Pro / Max",
    activePlan: "Active plan",
    more: "More",
    memory: "Memory",
    memoryVal: "{n} processes remembered",
    connections: "Connections",
    connectionsVal: "1 of 6 connected",
    upgradeOne: "Upgrade ONE",
    choosePlan: "Choose the plan that fits how much you move.",
    perMonth: "per month",
    choosePro: "Choose Pro",
    chooseMax: "Choose Max",
    proFeat: "Unlimited identities · advanced model",
    maxFeat: "Everything in Pro · proactive ONE",
    preferences: "Preferences",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    langName: "English",
    exportData: "Export my data",
    backToSite: "← Back to site",
    global: "Global",
    globalLede: "Every ONE out here can be talked to. Walk in, ask, book — your ONE handles the rest.",
    live: "Live",
    onesOnline: "ONEs online",
    openNow: "Open now",
    closedNow: "Closed",
    createBiz: "Create a business ONE",
    createBizSub: "Set hours, services — or just describe it",
    homeTab: "Home",
    worlds: "Worlds",
    worldAll: "All",
    wHealth: "Health",
    wLearning: "Learning",
    wLeisure: "Leisure",
    wFinance: "Finance",
    wHome: "Home",
    wFood: "Food",
    wCommunity: "Community",
    emptyWorld: "No ONEs here yet — be the first.",
    backHome: "Back",
    newProcess: "New process",
    processesSub: "Your active engagements",
    requests: "Requests",
    requestsSub: "Waiting on you",
    connectionsSub: "ONEs you're linked to",
    news: "News",
    newsSub: "Across the network",
    statusThinking: "Thinking…",
    statusConnecting: "Connecting…",
    statusSearching: "Searching…",
    statusWorking: "Working…",
    genExamples: "Generate examples",
    generating: "Generating…",
    emptyProcesses: "No processes yet. Tell ONE an intention — or:",
    updates: "Updates",
    updatesSub: "What moved across your processes",
    updatesEmpty: "Nothing new. ONE will surface updates here.",
  },
  he: {
    upgrade: "שדרוג",
    tempChat: "צ'אט זמני",
    exitTemp: "צא מצ'אט זמני",
    options: "אפשרויות",
    editProfile: "עריכת פרופיל",
    wipeChat: "נקה צ'אט",
    capabilities: "יכולות",
    capabilitiesSub: "מה ONE יכול לעשות בשבילך",
    addCapability: "הוסף יכולת",
    capAdd: "הוסף",
    capAdded: "נוסף",
    capsGlobalSub: "הפעל עוד ממה ש‑ONE יודע לעשות",
    sources: "מקורות רשמיים",
    sourcesSub: "מקומות מהימנים שמהם ONE שואב מידע",
    official: "רשמי",
    reference: "מקור פתוח",
    addSource: "הוסף מקור",
    addSourceHint: "הוספת ערוצים היא לפי הרשאות — בקרוב",
    capNeedRun: "הפעל את זה",
    memTitle: "זיכרון",
    memorySub: "מה ONE יודע — אתה קובע עם מי כל פרט משותף",
    memAddValue: "הוסף",
    permOpen: "פתוח",
    permAsk: "לשאול קודם",
    permPrivate: "פרטי",
    memPulled: "נשלף מהזיכרון שלך",
    memShare: "שתף לצורך זה",
    routeInto: "המשך ב־",
    tempTag: "צ'אט זמני · שום דבר לא נשמר",
    tempAnon: "בלי לשמור. שאל אותי כל דבר — זה לא יישאר.",
    newChat: "צ'אט חדש",
    profiles: "פרופילים",
    processes: "תהליכים",
    newProfile: "פרופיל חדש",
    nothingHere: "אין כאן עדיין כלום.",
    oneProfile: "הפרופיל של ONE",
    settings: "הגדרות",
    cloudSynced: "☁ מסונכרן לענן",
    cloudConnecting: "☁ מתחבר…",
    cloudOffline: "• נשמר במכשיר הזה",
    talkToOne: "דברו עם ONE",
    tellChanged: "ספרו ל‑ONE מה השתנה…",
    hideDetails: "הסתרת פרטים",
    details: "פרטים",
    share: "שיתוף",
    copied: "הועתק ✓",
    deleteProcess: "מחיקת תהליך",
    confirmDelete: "לחצו שוב למחיקה",
    done: "הושלמו",
    repSub: "הנציג שלכם בכל זהות.",
    account: "חשבון",
    signInBlurb: "התחברו כדי שהתהליכים ילכו איתכם בכל מכשיר.",
    continueGoogle: "המשך עם Google",
    orMagic: "או בקישור קסם",
    sendLink: "שליחת קישור",
    synced: "☁ מסונכרן",
    signOut: "התנתקות",
    identity: "זהות",
    active: "פעיל",
    plan: "תוכנית",
    onFree: "אתם על FREE",
    unlockMore: "פותחים עוד עם Pro / Max",
    activePlan: "תוכנית פעילה",
    more: "עוד",
    memory: "זיכרון",
    memoryVal: "{n} תהליכים בזיכרון",
    connections: "חיבורים",
    connectionsVal: "1 מתוך 6 מחוברים",
    upgradeOne: "שדרוג ONE",
    choosePlan: "בחרו את התוכנית שמתאימה לקצב שלכם.",
    perMonth: "לחודש",
    choosePro: "בחירת Pro",
    chooseMax: "בחירת Max",
    proFeat: "זהויות ללא הגבלה · מודל מתקדם",
    maxFeat: "כל מה שב‑Pro · ONE יזום",
    preferences: "העדפות",
    language: "שפה",
    theme: "ערכת נושא",
    light: "בהיר",
    dark: "כהה",
    langName: "עברית",
    exportData: "ייצוא הנתונים שלי",
    backToSite: "← חזרה לאתר",
    global: "גלובל",
    globalLede: "אפשר לדבר עם כל ONE שיש כאן. להיכנס, לשאול, להזמין — וה‑ONE שלכם מטפל בשאר.",
    live: "חי",
    onesOnline: "ONE מחוברים",
    openNow: "פתוח עכשיו",
    closedNow: "סגור",
    createBiz: "יצירת ONE עסקי",
    createBizSub: "הגדירו שעות ושירותים — או פשוט תארו",
    homeTab: "בית",
    worlds: "עולמות",
    worldAll: "הכול",
    wHealth: "בריאות",
    wLearning: "לימודים",
    wLeisure: "פנאי",
    wFinance: "כלכלה",
    wHome: "בית",
    wFood: "אוכל",
    wCommunity: "קהילה",
    emptyWorld: "אין כאן ONE עדיין — היו הראשונים.",
    backHome: "חזרה",
    newProcess: "תהליך חדש",
    processesSub: "המעורבויות הפעילות שלכם",
    requests: "בקשות",
    requestsSub: "מחכות לכם",
    connectionsSub: "ONE שאתם מחוברים אליהם",
    news: "חדשות",
    newsSub: "מהרשת",
    statusThinking: "חושב…",
    statusConnecting: "מתחבר…",
    statusSearching: "מחפש…",
    statusWorking: "עובד…",
    genExamples: "צור דוגמאות",
    generating: "יוצר…",
    emptyProcesses: "אין עדיין תהליכים. ספרו ל‑ONE כוונה — או:",
    updates: "עדכונים",
    updatesSub: "מה זז בתהליכים שלכם",
    updatesEmpty: "אין חדש. ONE יציג כאן עדכונים.",
  },
};

// ── Global is organised into "worlds" — broad domains of life a ONE can live
//    in. Each business is sorted into one by its category text. Add keywords
//    here as the directory grows.
const WORLD_KEYS = [
  "health",
  "learning",
  "leisure",
  "finance",
  "home",
  "food",
  "community",
] as const;
type WorldKey = (typeof WORLD_KEYS)[number];
const WORLD_EMOJI: Record<WorldKey, string> = {
  health: "🩺",
  learning: "📚",
  leisure: "✨",
  finance: "💰",
  home: "🏠",
  food: "🍽️",
  community: "🏘️",
};
// Which dict key labels each world.
const WORLD_LABEL: Record<WorldKey, string> = {
  health: "wHealth",
  learning: "wLearning",
  leisure: "wLeisure",
  finance: "wFinance",
  home: "wHome",
  food: "wFood",
  community: "wCommunity",
};
function worldOf(category: string): WorldKey {
  const c = category.toLowerCase();
  if (/(gym|fitness|health|clinic|doctor|dentist|wellness|therap|medic|pharma|nutrition)/.test(c)) return "health";
  if (/(instructor|teacher|school|course|tutor|driving|lesson|academ|learn|studio)/.test(c)) return "learning";
  if (/(salon|hair|nail|beauty|spa|barber|entertain|game|sport|travel|tour|leisure|event)/.test(c)) return "leisure";
  if (/(bank|account|finance|insur|invest|tax|loan|mortgage)/.test(c)) return "finance";
  if (/(mov|clean|repair|plumb|electr|renov|construct|handyman|home|garden)/.test(c)) return "home";
  if (/(restaurant|cafe|food|bakery|cater|grocery|deli|coffee)/.test(c)) return "food";
  return "community";
}

// When ONE's reply turns to scheduling, offer tappable quick-replies (days or
// times) so the chat is interactive — pick instead of type. Bilingual heuristic.
function suggestChips(reply: string, lang: "en" | "he"): string[] | undefined {
  const he = lang === "he";
  const scheduling =
    /(when|what time|which day|what day|schedule|appointment|book|slot|available|availab|prefer|remind|deadline|due|מתי|באיזו שעה|איזה יום|לתאם|תור|לקבוע|פנוי|מעדיף|תזכורת|דדליין|תאריך יעד)/i;
  if (!scheduling.test(reply)) return undefined;
  const timeSignal = /(what time|hour|morning|afternoon|evening|באיזו שעה|שעה|בוקר|צהריים|ערב)/i.test(reply);
  const daySignal = /(which day|what day|date|day\b|איזה יום|תאריך|יום)/i.test(reply);
  if (timeSignal && !daySignal) {
    return he ? ["בוקר", "צהריים", "ערב"] : ["Morning", "Afternoon", "Evening"];
  }
  return he
    ? ["היום", "מחר", "השבוע", "אבחר תאריך"]
    : ["Today", "Tomorrow", "This week", "Pick a date"];
}

// Parse the AI's "generate examples" reply into a list of short intents. Tries
// a JSON array first, then falls back to line-splitting so a non-JSON reply
// still works.
function parseIntents(raw: string): string[] {
  const arr = raw.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const parsed = JSON.parse(arr[0]);
      if (Array.isArray(parsed)) {
        const strs = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (strs.length) return strs.slice(0, 4);
      }
    } catch {
      /* fall through to line-splitting */
    }
  }
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s"']+/, "").replace(/["']\s*,?\s*$/, "").trim())
    .filter((l) => l.length > 2 && l.length < 80)
    .slice(0, 3);
}

export default function AppHome() {
  const [plan, setPlan] = useState<PlanTier>("free");
  const [activeIdentityId, setActiveIdentityId] = useState(IDENTITIES[0].id);
  const [openSheet, setOpenSheet] = useState<null | "settings" | "subscription">(null);
  // The main canvas shows one of three "spaces": the ONE home (broadcast +
  // input), the Global marketplace, or the ONE profile — all on-canvas, no
  // popups. A segmented toggle flips Home ⇄ Global; the drawer opens Profile.
  const [space, setSpace] = useState<"home" | "global" | "profile">("home");
  const [world, setWorld] = useState<"all" | WorldKey>("all");
  // Appearance + language. Persisted; dark defaults to the OS preference.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<UILang>("en");
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("one_theme");
      const savedLang = localStorage.getItem("one_lang");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
      if (savedLang === "he" || savedLang === "en") setLang(savedLang);
    } catch {
      /* private mode — defaults are fine */
    }
  }, []);
  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    try { localStorage.setItem("one_theme", t); } catch {}
  };
  const applyLang = (l: UILang) => {
    setLang(l);
    try { localStorage.setItem("one_lang", l); } catch {}
  };
  const t = PRODUCT_UI[lang];
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [stepOverrides, setStepOverrides] = useState<Record<string, boolean>>({});
  const [bi, setBi] = useState(0);
  const [bfade, setBfade] = useState(false);
  // Global surface — a live marketplace. `now` (client-only, avoids hydration
  // mismatch) drives the open/closed status; `feedIdx` cycles a live activity
  // ticker so the place feels alive.
  const [now, setNow] = useState<Date | null>(null);
  const [feedIdx, setFeedIdx] = useState(0);
  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 60_000);
    const ticker = setInterval(() => setFeedIdx((i) => i + 1), 3200);
    return () => {
      clearInterval(clock);
      clearInterval(ticker);
    };
  }, []);

  // Home conversation with ONE.
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  // An open unit is a split: its conversation on one side, a live detail card
  // beside it. The card is drag-resizable (asideW), and a kebab menu holds
  // per-process actions. Typing in the chat updates the card live.
  const [asideW, setAsideW] = useState(384);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [unitShared, setUnitShared] = useState(false);
  const [unitConfirmDelete, setUnitConfirmDelete] = useState(false);
  const unitSplitRef = useRef<HTMLDivElement>(null);
  // The side drawer (off the logo) holds navigation — profiles + processes.
  // It opens on edge-hover (auto) or on click. A click "pins" it so it stays
  // open until clicked again; an edge-hover open auto-closes on mouse-leave.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPinned, setDrawerPinned] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const toggleDrawer = () => {
    const willOpen = !drawerOpen;
    setDrawerOpen(willOpen);
    setDrawerPinned(willOpen);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerPinned(false);
  };
  // On desktop the drawer is a push-panel that shrinks the canvas, so it can
  // stay open beside a unit. On mobile it's a full slide-over, so navigating
  // to a unit/chat must close it or it would hide the content behind it.
  const closeDrawerOnMobile = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches) {
      closeDrawer();
    }
  };
  // Reset the unit menu's transient states whenever it closes, so a reopened
  // menu never shows a stale "Copied ✓" or a primed delete-confirm.
  useEffect(() => {
    if (!unitMenuOpen) {
      setUnitShared(false);
      setUnitConfirmDelete(false);
    }
  }, [unitMenuOpen]);
  // When the drawer was revealed by hover (not pinned by a click), auto-close it
  // once the pointer moves clearly away from it. A global listener is more
  // reliable than onMouseLeave across fast pointer moves.
  useEffect(() => {
    if (!drawerOpen || drawerPinned) return;
    const onMove = (e: MouseEvent) => {
      const r = drawerRef.current?.getBoundingClientRect();
      if (!r) return;
      if (e.clientX > r.right + 48 || e.clientX < r.left - 48) setDrawerOpen(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [drawerOpen, drawerPinned]);
  // Profiles collapse to the active one; the rest reveal on hover or click.
  const [profilesOpen, setProfilesOpen] = useState(false);
  // A temporary chat: a fresh conversation that isn't kept as a process.
  const [tempChat, setTempChat] = useState(false);
  const [unitChat, setUnitChat] = useState<ChatMsg[]>([]);
  const [unitDraft, setUnitDraft] = useState("");
  const [unitThinking, setUnitThinking] = useState(false);
  // A business's ONE "reaches out" at most ONCE per process — otherwise the
  // "the provider got back to me…" line repeats on every follow-up and reads
  // robotic. Track which processes have already had their outreach.
  const outreachDoneRef = useRef<Set<string>>(new Set());
  // The home is a vertical scroll of two surfaces — the ONE surface (rest, top)
  // and Updates (down). Global lives above as a rising overlay sheet, reached by
  // scrolling up at the top (or the ↑ chevron), exactly like the landing hero.
  const homePageRef = useRef<HTMLDivElement>(null);
  const [globalOpen, setGlobalOpen] = useState(false);
  const pgPanelRef = useRef<HTMLDivElement>(null);
  // The capabilities ONE has switched on (persisted locally). Toggled from the
  // profile; enabled from Global's "add a capability".
  const [caps, setCaps] = useState<string[]>(["booking", "reminders"]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_caps");
      if (raw) setCaps(JSON.parse(raw));
    } catch {
      /* first run / blocked storage — keep defaults */
    }
  }, []);
  const persistCaps = (next: string[]) => {
    setCaps(next);
    try {
      localStorage.setItem("one_caps", JSON.stringify(next));
    } catch {
      /* storage blocked — session-only is fine */
    }
  };
  const toggleCap = (key: string) =>
    persistCaps(caps.includes(key) ? caps.filter((k) => k !== key) : [...caps, key]);
  // ONE's memory — personal facts + a per-field permission (open / ask / private).
  // Persisted locally; the user fills the values (ONE never invents them).
  const [memory, setMemory] = useState<Record<string, MemEntry>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_memory");
      if (raw) setMemory(JSON.parse(raw));
    } catch {
      /* first run / blocked storage */
    }
  }, []);
  const persistMemory = (next: Record<string, MemEntry>) => {
    setMemory(next);
    try {
      localStorage.setItem("one_memory", JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const memEntry = (key: string): MemEntry => memory[key] ?? { value: "", perm: "ask" };
  const setMemoryValue = (key: string, value: string) =>
    persistMemory({ ...memory, [key]: { ...memEntry(key), value } });
  const cycleMemoryPerm = (key: string) =>
    persistMemory({ ...memory, [key]: { ...memEntry(key), perm: PERM_CYCLE[memEntry(key).perm] } });
  const cycleToOpen = (key: string) =>
    persistMemory({ ...memory, [key]: { ...memEntry(key), perm: "open" } });
  // Build a one-line context of the facts the user marked "open" (and filled in),
  // to hand ONE so it can personalise without asking. "ask"/"private" facts are
  // NEVER included here — they stay on the device until explicitly shared.
  const memoryContext = (): string | undefined => {
    const open = MEMORY_CATALOG.filter(
      (f) => memory[f.key]?.perm === "open" && memory[f.key]?.value?.trim(),
    ).map((f) => `${f.en}: ${memory[f.key].value.trim()}`);
    if (!open.length) return undefined;
    return lang === "he"
      ? `פרטים שהמשתמש שיתף איתך בחופשיות (השתמש בהם בטבעיות, בלי לבקש שוב): ${open.join("; ")}.`
      : `Facts the user has shared openly (use them naturally, don't re-ask): ${open.join("; ")}.`;
  };
  // Find the existing process a home-chat message most plausibly belongs to, by
  // overlap between the message and the process's title/relation words. Powers
  // the "continue in <process>" routing chip — the home chat is the front door,
  // the process is where scoped, persisted work actually happens.
  const ROUTE_STOP = new Set([
    "the", "a", "an", "for", "to", "my", "me", "on", "of", "and", "is", "in", "with", "about",
    "את", "של", "לי", "על", "עם", "זה", "מה", "איך", "יש",
  ]);
  const matchProcessForText = (text: string): Process | null => {
    const low = text.toLowerCase();
    let best: { p: Process; score: number } | null = null;
    for (const p of processes) {
      const words = `${p.title} ${p.relation ?? ""}`
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2 && !ROUTE_STOP.has(w));
      let score = 0;
      for (const w of words) if (low.includes(w)) score += 1;
      if (score > 0 && (!best || score > best.score)) best = { p, score };
    }
    return best ? best.p : null;
  };
  // Live quiz (the "Quiz teaching" capability). Null when no quiz is running.
  const [quiz, setQuiz] = useState<{
    questions: { q: string; options: string[]; answer: number; explain?: string }[];
    idx: number;
    score: number;
  } | null>(null);
  // While ONE is working, a status line cycles Thinking → Connecting → Searching
  // → Working (like a coding agent), and the ONE face closes its eyes.
  const [statusIdx, setStatusIdx] = useState(0);
  const oneWorking = thinking || unitThinking;
  useEffect(() => {
    if (!oneWorking) return;
    setStatusIdx(0);
    const id = setInterval(() => setStatusIdx((i) => i + 1), 1100);
    return () => clearInterval(id);
  }, [oneWorking]);
  // One unit store. A fresh account starts EMPTY — no hardcoded examples. The
  // user creates real processes by talking to ONE, or taps "Generate examples"
  // to have ONE spin up a few from the AI. Saved units hydrate over this.
  const [units, setUnits] = useState<Process[]>([]);
  const [generating, setGenerating] = useState(false);
  // The process ONE is currently refining, and its latest live broadcast line.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [liveBroadcast, setLiveBroadcast] = useState<string | null>(null);
  const [cloud, setCloud] = useState<CloudStatus>("connecting");
  // The business directory — seeded from BUSINESSES, replaced by the live
  // `providers` table in Supabase once it loads (falls back to the seed).
  const [businesses, setBusinesses] = useState<Business[]>(BUSINESSES);
  // Incoming bookings addressed to the business you're currently viewing —
  // written by other parties' ONEs into the shared `bookings` table.
  const [incomingBookings, setIncomingBookings] = useState<CloudBooking[]>([]);
  // The signed-in account (null = guest / per-device). When present, cloud data
  // is keyed by the account, so it follows you across devices.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  // My capability key — used to tell which businesses I own.
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  // Create-a-business flow.
  const [draftBiz, setDraftBiz] = useState<Business | null>(null);
  const [bizDraftText, setBizDraftText] = useState("");
  // Live follow / followers / customers for the open business.
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<CloudFollower[]>([]);
  const [customers, setCustomers] = useState<CloudCustomer[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const unitEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    myKey().then(setOwnerKey);
  }, [user?.id]);

  // Track the auth session (initial + magic-link / OAuth returns + sign-out).
  useEffect(() => {
    let mounted = true;
    getSessionUser().then((u) => mounted && setUser(u));
    const unsub = onAuthChange((u) => setUser(u));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // On sign-in, hydrate from the account — or, if it's empty, migrate whatever's
  // on screen (guest/device data) up into it so nothing is lost.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const saved = await loadUnits();
      if (cancelled) return;
      if (saved) setUnits(saved);
      else await saveUnits(units);
      setCloud("synced");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;
    setAuthMsg("Sending…");
    const r = await signInWithEmail(email);
    setAuthMsg(r.ok ? `✓ Check ${email} for your sign-in link.` : r.error ?? "Couldn't send the link.");
  };
  const continueWithGoogle = async () => {
    setAuthMsg("Redirecting to Google…");
    const r = await signInWithGoogle();
    if (!r.ok) setAuthMsg(r.error ?? "Google sign-in isn't enabled yet.");
  };
  const doSignOut = async () => {
    await signOut();
    setUser(null);
    setAuthMsg(null);
  };

  const followerName = user?.name ?? user?.email ?? "A customer";

  const startCreateBusiness = () => {
    setDraftBiz({
      id: `biz_${Math.random().toString(36).slice(2, 9)}`,
      name: "",
      emoji: "🏪",
      category: "Local business",
      rating: 0,
      reviews: 0,
      address: "",
      phone: "",
      blurb: "",
      hours: [],
      services: [],
      slots: [],
    });
    setBizDraftText("");
  };

  const applyBizDraftText = () => {
    if (!draftBiz) return;
    const p = parseBusinessFromText(bizDraftText);
    setDraftBiz({
      ...draftBiz,
      name: p.name ?? draftBiz.name,
      emoji: p.emoji ?? draftBiz.emoji,
      category: p.category ?? draftBiz.category,
      hours: p.hours ?? draftBiz.hours,
      services: p.services ?? draftBiz.services,
      blurb: draftBiz.blurb || bizDraftText.slice(0, 120),
    });
  };

  const submitBusiness = async () => {
    if (!draftBiz || !draftBiz.name.trim()) return;
    const biz: Business = {
      ...draftBiz,
      ownerKey: ownerKey ?? undefined,
      slots: draftBiz.slots.length ? draftBiz.slots : ["Tue 10:00", "Wed 16:00", "Thu 12:00"],
    };
    const ok = await saveBusiness(biz);
    if (ok) {
      const list = await fetchProviders();
      if (list) setBusinesses(list);
      setDraftBiz(null);
      openBiz(biz.id);
    }
  };

  // Load the business directory from Supabase (public read, no auth needed).
  useEffect(() => {
    let cancelled = false;
    fetchProviders().then((list) => {
      if (!cancelled && list) setBusinesses(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // When you're the business (ONE01), pull the bookings customers' ONEs sent you.
  useEffect(() => {
    if (activeIdentityId !== "one01") {
      setIncomingBookings([]);
      return;
    }
    let cancelled = false;
    fetchIncomingBookings("one01").then((list) => {
      if (!cancelled) setIncomingBookings(list);
    });
    return () => {
      cancelled = true;
    };
  }, [activeIdentityId]);

  // Cloud sync: sign in (anonymously) and hydrate the last-saved processes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok } = await ensureSession();
      if (cancelled) return;
      if (!ok) {
        setCloud("offline");
        return;
      }
      const saved = await loadUnits();
      if (cancelled) return;
      if (saved) setUnits(saved);
      setCloud("synced");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist processes back to the cloud whenever they change (debounced).
  useEffect(() => {
    if (cloud !== "synced") return;
    const t = setTimeout(() => void saveUnits(units), 800);
    return () => clearTimeout(t);
  }, [units, cloud]);

  // Business profile sheet — its own ONE you can chat with and book through.
  const [bizId, setBizId] = useState<string | null>(null);
  const [bizChat, setBizChat] = useState<ChatMsg[]>([]);
  const [bizDraft, setBizDraft] = useState("");
  const [bizThinking, setBizThinking] = useState(false);
  const [bizService, setBizService] = useState<string | null>(null);

  // When a business opens, load whether I follow it and — if I own it — its
  // followers and customers (the customer cards, derived from bookings).
  useEffect(() => {
    if (!bizId) {
      setFollowing(false);
      setFollowers([]);
      setCustomers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const f = await isFollowing(bizId);
      if (!cancelled) setFollowing(f);
      const biz = businesses.find((b) => b.id === bizId);
      const owned = !!(biz?.ownerKey && ownerKey && biz.ownerKey === ownerKey);
      if (owned) {
        const [fl, cu] = await Promise.all([fetchFollowers(bizId), fetchCustomers(bizId)]);
        if (!cancelled) {
          setFollowers(fl);
          setCustomers(cu);
        }
      } else if (!cancelled) {
        setFollowers([]);
        setCustomers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, businesses, ownerKey]);

  const toggleFollow = async () => {
    if (!bizId) return;
    const next = !following;
    setFollowing(next);
    await followSet(bizId, next, followerName);
    const biz = businesses.find((b) => b.id === bizId);
    if (biz?.ownerKey && ownerKey && biz.ownerKey === ownerKey) setFollowers(await fetchFollowers(bizId));
  };

  const planMeta = PLAN_META[plan];
  const identity = IDENTITIES.find((i) => i.id === activeIdentityId)!;

  const processes = useMemo(() => {
    const own = units.filter((p) => p.identityId === activeIdentityId);
    // Fold in the live cloud bookings addressed to this business (provider side).
    const fromCloud = incomingBookings.map(bookingToProcess);
    return [...fromCloud, ...own].sort((a, b) => b.unread - a.unread);
  }, [activeIdentityId, units, incomingBookings]);

  // The pulse is a LIVE digest, not a static loop: ONE reads the active identity's
  // real units and tells you what's actually waiting — so it updates the moment
  // you resolve something (confirm a booking, mark paid) and speaks in whichever
  // ONE you are right now (personal vs business).
  const broadcastLines = useMemo(() => {
    const he = lang === "he";
    // Time-aware greeting — ONE knows what part of the day it is.
    const hour = now ? now.getHours() : 9;
    const greetEn = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const greetHe = hour < 5 ? "לילה טוב" : hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";
    const greet = `${he ? greetHe : greetEn}, ${identity.name}.`;
    const waiting = processes.filter((p) => p.unread > 0);
    if (waiting.length === 0) {
      return [
        greet,
        he ? "אין דבר שדורש אותך כרגע — ספרו לי מטרה חדשה." : "Nothing needs you right now — tell me a new goal.",
      ];
    }
    const header = he
      ? `${greet} ${waiting.length} ${waiting.length === 1 ? "דבר מחכה" : "דברים מחכים"} לך.`
      : `${greet} ${waiting.length} ${waiting.length === 1 ? "thing needs you" : "things need you"}.`;
    // In English, surface the machine-written next action. In Hebrew that text is
    // English (it's generated), so phrase the line in Hebrew around the process's
    // own title instead of leaking an English sentence into a Hebrew broadcast.
    const items = waiting.slice(0, 4).map((p) =>
      he
        ? `${p.title} — ${p.unread > 1 ? `${p.unread} עדכונים ממתינים` : "עדכון ממתין"}.`
        : (p.nextAction ?? p.summary),
    );
    return [header, ...items];
  }, [processes, identity.name, now, lang]);

  // Announce a live event in the broadcast slot, in the app's language.
  const announce = (en: string, he: string) => setLiveBroadcast(lang === "he" ? he : en);

  // The live process behind the open sheet, so edits show immediately.
  const activeLive = activeProcess ? units.find((u) => u.id === activeProcess.id) ?? activeProcess : null;

  // Replace-or-insert a unit (keyed by id).
  const upsert = (p: Process) =>
    setUnits((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));

  // Quick action → if the unit is tied to a business, Reschedule / Message route
  // straight into that business's ONE; otherwise log it to the unit's timeline.
  const runQuickAction = (p: Process, label: string) => {
    const l = label.toLowerCase();
    if (p.businessId && (l.includes("reschedule") || l.includes("message"))) {
      openBiz(p.businessId);
      return;
    }

    // Provider side: confirm an incoming booking request → resolve it for real,
    // then the client's ONE acknowledges back (the request is a two-way handshake).
    if (l.includes("confirm")) {
      const when = p.metrics?.find((m) => /request|when/i.test(m.label))?.value ?? "the time";
      upsert({
        ...p,
        time: "now",
        unread: 0,
        nextAction: `Send ${p.relation} a reminder 24h before ${when}.`,
        summary: `Confirmed ${when} with ${p.relation}.`,
        metrics: (p.metrics ?? []).map((m) =>
          /status/i.test(m.label) ? { ...m, value: "Confirmed" } : m,
        ),
        steps: p.steps.map((s) => (/confirm/i.test(s.label) ? { ...s, done: true } : s)),
        timeline: [{ at: "now", text: `You confirmed ${when}.` }, ...p.timeline],
      });
      announce(`You confirmed ${p.relation}'s ${when}.`, `אישרת את ${when} של ${p.relation}.`);
      window.setTimeout(() => {
        setUnits((list) =>
          list.map((u) =>
            u.id === p.id
              ? {
                  ...u,
                  unread: u.unread + 1,
                  time: "now",
                  timeline: [
                    { at: "now", text: `${p.relation}'s ONE confirmed back — see you ${when}.` },
                    ...u.timeline,
                  ],
                }
              : u,
          ),
        );
        announce(`${p.relation} is set for ${when}.`, `${p.relation} מסודר ל${when}.`);
      }, 2200);
      return;
    }

    // Provider side: settle an invoice.
    if (l.includes("paid")) {
      upsert({
        ...p,
        time: "now",
        unread: 0,
        nextAction: `Send ${p.relation} a receipt.`,
        summary: `Paid — ${p.relation}.`,
        metrics: (p.metrics ?? []).map((m) =>
          /status/i.test(m.label) ? { ...m, value: "Paid" } : m,
        ),
        steps: p.steps.map((s) => (/payment|paid/i.test(s.label) ? { ...s, done: true } : s)),
        timeline: [{ at: "now", text: "Marked as paid." }, ...p.timeline],
      });
      announce(`${p.relation}'s invoice marked paid.`, `החשבונית של ${p.relation} סומנה כשולמה.`);
      return;
    }

    upsert({ ...p, time: "now", timeline: [{ at: "now", text: `You: ${label}` }, ...p.timeline] });
  };

  // Open a business profile (from a unit's Connections). Its ONE greets you.
  const openBiz = (id: string) => {
    const biz = businesses.find((b) => b.id === id);
    if (!biz) return;
    setActiveProcess(null);
    setBizId(id);
    setBizService(null);
    setBizChat([{ role: "one", text: `Hi! I'm ${biz.name}'s ONE — ask me our hours or prices, or I'll find you a time.` }]);
  };

  // Book a slot with a business → it lands as a unit in your world.
  const book = (biz: Business, slot: string, service?: string) => {
    const label = service ? `${service} — ${biz.name}` : `${biz.name} appointment`;
    const what = service ? `${service} · ${slot}` : slot;
    const metrics = [
      { label: "When", value: slot },
      ...(service ? [{ label: "Service", value: service }] : []),
      { label: "Provider", value: biz.name },
      { label: "Status", value: "Confirmed" },
    ];
    const existing = units.find((u) => u.businessId === biz.id && u.identityId === activeIdentityId);
    const bookedId = existing ? existing.id : `book_${Date.now()}`;
    if (existing) {
      upsert({
        ...existing,
        time: "now",
        unread: existing.unread + 1,
        nextAction: `Confirm 24h before ${slot}.`,
        summary: `Booked ${what} with ${biz.name}.`,
        metrics,
        timeline: [{ at: "now", text: `Booked ${what} via ${biz.name}'s ONE.` }, ...existing.timeline],
      });
      setFocusId(existing.id);
    } else {
      const p: Process = {
        id: bookedId,
        identityId: activeIdentityId,
        emoji: biz.emoji,
        title: label,
        time: "now",
        unread: 1,
        summary: `Booked ${what} with ${biz.name}.`,
        relation: biz.name,
        businessId: biz.id,
        progress: { done: 1, total: 3 },
        people: [biz.name],
        steps: [
          { label: `Booked ${slot}`, done: true },
          { label: "Add to calendar", done: false },
          { label: "Confirm 24h before", done: false },
        ],
        decisions: [],
        timeline: [{ at: "now", text: `Booked ${what} via ${biz.name}'s ONE.` }],
        type: "appointment",
        nextAction: `Confirm 24h before ${slot}.`,
        metrics,
        quickActions: ["Add to calendar", "Reschedule", "Message provider"],
        insights: [`${biz.name}: ${biz.blurb}`],
      };
      upsert(p);
      setFocusId(p.id);
    }
    announce(`Booked ${what} at ${biz.name}.`, `קבעתי ${what} ב${biz.name}.`);
    // Your ONE writes the booking into the shared marketplace (Supabase), so the
    // provider's ONE can see it from its own side.
    void createBooking(biz.id, identity.name, service, slot);
    // The business's ONE follows through — a moment later it confirms back, so a
    // booking reads as a two-way transaction, not a one-way write into your list.
    window.setTimeout(() => {
      setUnits((list) =>
        list.map((u) =>
          u.id === bookedId
            ? {
                ...u,
                time: "now",
                unread: u.unread + 1,
                timeline: [
                  { at: "now", text: `${biz.name}'s ONE confirmed ${what}. I'll remind you 24h before.` },
                  ...u.timeline,
                ],
              }
            : u,
        ),
      );
      announce(`${biz.name} confirmed your ${what}.`, `${biz.name} אישר את ${what} שלך.`);
    }, 2400);
    return `✅ Booked — ${what} at ${biz.name}. It's in your processes now.`;
  };

  const sendBiz = () => {
    const biz = businesses.find((b) => b.id === bizId);
    if (!biz) return;
    const text = bizDraft.trim();
    if (!text) return;
    setBizChat((c) => [...c, { role: "user", text }]);
    setBizDraft("");
    setBizThinking(true);
    const res = bizReply(biz, text, new Date());
    window.setTimeout(() => {
      setBizThinking(false);
      res.lines.forEach((l) => setBizChat((c) => [...c, { role: "one", text: l }]));
      if (res.booking) {
        const confirm = book(biz, res.booking.slot, res.booking.service);
        setBizChat((c) => [...c, { role: "one", text: confirm }]);
      }
    }, 640);
  };

  // When ONE opens a NEW process, it turns the intention into a real multi-stage
  // plan — an AI-generated, time-ordered step list (+ a couple of key metrics)
  // tailored to what the user actually asked for, replacing the generic template.
  const enrichProcessPlan = async (proc: Process, intent: string) => {
    try {
      const he = lang === "he";
      const sys = he
        ? 'הפוך את הכוונה לתכנית פעולה. החזר אך ורק JSON תקין: {"title":"...","emoji":"...","steps":["...","..."],"metrics":[{"label":"...","value":"..."}],"quickActions":["...","..."],"needs":["address","phone"]} — title=שם תהליך קצר וברור (2‑4 מילים) שמתאר את המטרה, emoji=אימוג\'י מתאים אחד, 4 עד 6 צעדים קונקרטיים לפי סדר הזמן, 2 עד 3 מדדים חשובים, 2 עד 3 פעולות מהירות קצרות, ו‑needs=אילו פרטים אישיים התהליך צריך מתוך: name,age,gender,address,phone,email,height,weight,idnum (רק מה שבאמת רלוונטי, יכול להיות ריק). הכול בעברית חוץ מ‑needs. בלי טקסט נוסף ובלי code fences.'
        : 'Turn the intention into an action plan. Return ONLY valid JSON: {"title":"...","emoji":"...","steps":["...","..."],"metrics":[{"label":"...","value":"..."}],"quickActions":["...","..."],"needs":["address","phone"]} — title=a short, clear process name (2-4 words) describing the goal, emoji=one fitting emoji, 4 to 6 concrete time-ordered steps, 2 to 3 key metrics, 2 to 3 short quick-action labels, and needs=which personal facts this process needs, from: name,age,gender,address,phone,email,height,weight,idnum (only what is genuinely relevant, can be empty). No prose, no code fences.';
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: `${proc.title} — ${intent}` },
        ],
        { maxTokens: 320, temperature: 0.4 },
      );
      const body = raw.replace(/```json|```/g, "");
      const start = body.indexOf("{");
      const end = body.lastIndexOf("}");
      if (start < 0 || end <= start) return;
      const parsed = JSON.parse(body.slice(start, end + 1));
      const steps: string[] = Array.isArray(parsed.steps)
        ? parsed.steps.filter((s: unknown) => typeof s === "string" && s.trim()).slice(0, 6)
        : [];
      if (steps.length < 2) return;
      const metrics = Array.isArray(parsed.metrics)
        ? parsed.metrics
            .filter(
              (m: unknown): m is { label: string; value: string } =>
                !!m &&
                typeof (m as { label?: unknown }).label === "string" &&
                typeof (m as { value?: unknown }).value === "string",
            )
            .slice(0, 4)
        : [];
      const quickActions: string[] = Array.isArray(parsed.quickActions)
        ? parsed.quickActions.filter((a: unknown) => typeof a === "string" && a.trim()).slice(0, 4)
        : [];
      // ONE decides a clean process name + emoji from what it understood — the
      // card reads as a real named process, not the raw sentence you typed.
      const cleanTitle =
        typeof parsed?.title === "string" && parsed.title.trim().length >= 2
          ? parsed.title.trim().slice(0, 40)
          : null;
      const cleanEmoji =
        typeof parsed?.emoji === "string" && parsed.emoji.trim() ? parsed.emoji.trim().slice(0, 2) : null;
      setUnits((list) =>
        list.map((u) =>
          u.id === proc.id
            ? {
                ...u,
                title: cleanTitle ?? u.title,
                emoji: cleanEmoji ?? u.emoji,
                steps: steps.map((label) => ({ label, done: false })),
                progress: { done: 0, total: steps.length },
                metrics: metrics.length ? metrics : u.metrics,
                quickActions: quickActions.length ? quickActions : u.quickActions,
              }
            : u,
        ),
      );
      // Reflect back what ONE understood, and invite a confirm / tweak — so a
      // created process reads as "here's my plan, approve it" not a black box.
      setChat((c) =>
        c.length
          ? [
              ...c,
              {
                role: "one",
                text: he
                  ? `הכנתי תכנית ל"${proc.title}": ${steps.length} שלבים, מתחילים ב"${steps[0]}". רוצה לשנות משהו?`
                  : `I've drafted a plan for "${proc.title}": ${steps.length} steps, starting with "${steps[0]}". Want to change anything?`,
                chips: he ? ["מעולה, קדימה", "שנה משהו"] : ["Looks good", "Change something"],
              },
            ]
          : c,
      );
      // Memory pull. ONE looks at the personal facts this process needs and that
      // you've actually filled in: "open" facts it uses right away and tells you
      // it did; "ask" facts it won't touch until you tap "Share for this".
      // (Private facts are never mentioned.) Nothing leaves the device here —
      // this is the selective-disclosure model, in miniature.
      const needs: string[] = Array.isArray(parsed.needs)
        ? parsed.needs.filter((k: unknown): k is string => typeof k === "string")
        : [];
      const wanted = needs
        .map((k) => MEMORY_CATALOG.find((f) => f.key === k))
        .filter((f): f is MemoryFact => !!f && !!memory[f.key]?.value?.trim());
      const pulled = wanted.filter((f) => memory[f.key]?.perm === "open");
      const toAsk = wanted.filter((f) => memory[f.key]?.perm === "ask");
      if (pulled.length) {
        const listing = pulled.map((f) => `${f.emoji} ${he ? f.he : f.en}`).join(he ? "، " : ", ");
        setChat((c) => [...c, { role: "one", text: `🧠 ${t.memPulled}: ${listing}` }]);
      }
      if (toAsk.length) {
        setChat((c) => [
          ...c,
          {
            role: "one",
            text: he
              ? `לתהליך הזה כדאי גם: ${toAsk.map((f) => `${f.emoji} ${f.he}`).join("، ")}. לשתף?`
              : `This one could also use: ${toAsk.map((f) => `${f.emoji} ${f.en}`).join(", ")}. Share them?`,
            actions: toAsk.map((f) => ({
              label: `${f.emoji} ${t.memShare}`,
              kind: "shareMem" as const,
              mem: f.key,
            })),
          },
        ]);
      }
    } catch {
      /* Any failure (offline, bad JSON) — keep the template plan. */
    }
  };

  // ── Quiz teaching capability — turn "quiz me on X" into a real quiz in chat.
  const runQuiz = async (topic: string) => {
    const he = lang === "he";
    try {
      const sys = he
        ? 'צור מבחן אמריקאי קצר על הנושא. החזר JSON תקין בלבד: {"topic":"...","questions":[{"q":"...","options":["","","",""],"answer":0,"explain":"..."}]} — topic=שם הנושא באנגלית בכמה מילים לחיפוש בוויקיפדיה, 3 שאלות, 4 אפשרויות לכל אחת, answer=אינדקס התשובה הנכונה (0‑3), explain=משפט הסבר קצר. השאלות בעברית. בלי code fences.'
        : 'Create a short multiple-choice quiz on the topic. Return ONLY valid JSON: {"topic":"...","questions":[{"q":"...","options":["","","",""],"answer":0,"explain":"..."}]} — topic=the subject as a few-word English Wikipedia title, 3 questions, 4 options each, answer=index of the correct option (0-3), explain=a short explanation. No code fences.';
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: topic },
        ],
        { maxTokens: 700, temperature: 0.5 },
      );
      const body = raw.replace(/```json|```/g, "");
      const s = body.indexOf("{");
      const e = body.lastIndexOf("}");
      const parsed = s >= 0 && e > s ? JSON.parse(body.slice(s, e + 1)) : null;
      const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
        .filter(
          (q: unknown): q is { q: string; options: string[]; answer: number; explain?: string } =>
            !!q &&
            typeof (q as { q?: unknown }).q === "string" &&
            Array.isArray((q as { options?: unknown }).options) &&
            (q as { options: unknown[] }).options.length >= 2 &&
            typeof (q as { answer?: unknown }).answer === "number",
        )
        .slice(0, 5);
      setThinking(false);
      if (questions.length === 0) {
        setChat((c) => [
          ...c,
          { role: "one", text: he ? "לא הצלחתי להכין מבחן כרגע." : "I couldn't build a quiz just now." },
        ]);
        return;
      }
      setQuiz({ questions, idx: 0, score: 0 });
      const q0 = questions[0];
      // Pull an illustrative image for the topic from Wikipedia (an allowed
      // open-reference source). Best-effort — the quiz shows fine without it.
      const topicTitle = typeof parsed?.topic === "string" && parsed.topic.trim() ? parsed.topic.trim() : topic;
      const img = await wikiThumbnail(topicTitle);
      setChat((c) => [
        ...c,
        {
          role: "one",
          text: `❓ ${he ? "שאלה" : "Question"} 1/${questions.length}: ${q0.q}`,
          quiz: { options: q0.options, answer: q0.answer },
          image: img ?? undefined,
        },
      ]);
    } catch {
      setThinking(false);
      setChat((c) => [
        ...c,
        { role: "one", text: he ? "לא הצלחתי להכין מבחן כרגע." : "I couldn't build a quiz just now." },
      ]);
    }
  };
  // Answer the current quiz question (tapping an option chip).
  const answerQuiz = (optionIdx: number) => {
    if (!quiz) return;
    const he = lang === "he";
    const q = quiz.questions[quiz.idx];
    const correct = optionIdx === q.answer;
    const nextIdx = quiz.idx + 1;
    const nextScore = quiz.score + (correct ? 1 : 0);
    const feedback = correct
      ? he
        ? "✅ נכון! "
        : "✅ Correct! "
      : he
        ? `❌ לא בדיוק — התשובה היא "${q.options[q.answer]}". `
        : `❌ Not quite — the answer is "${q.options[q.answer]}". `;
    setChat((c) => [
      ...c,
      { role: "user", text: q.options[optionIdx] },
      { role: "one", text: feedback + (q.explain ?? "") },
    ]);
    if (nextIdx < quiz.questions.length) {
      const nq = quiz.questions[nextIdx];
      setQuiz({ questions: quiz.questions, idx: nextIdx, score: nextScore });
      setChat((c) => [
        ...c,
        {
          role: "one",
          text: `❓ ${he ? "שאלה" : "Question"} ${nextIdx + 1}/${quiz.questions.length}: ${nq.q}`,
          quiz: { options: nq.options, answer: nq.answer },
        },
      ]);
    } else {
      setQuiz(null);
      const pct = nextScore / quiz.questions.length;
      const badge = pct === 1 ? "🏆" : pct >= 0.5 ? "🎉" : "📚";
      setChat((c) => [
        ...c,
        {
          role: "one",
          text: he
            ? `${badge} סיימת! הציון שלך: ${nextScore}/${quiz.questions.length}.`
            : `${badge} Done! You scored ${nextScore}/${quiz.questions.length}.`,
        },
      ]);
    }
  };
  // Run an action chip from a ONE message (enable a capability, or upgrade).
  const runChatAction = (a: {
    label: string;
    kind: "enableCap" | "upgrade" | "shareMem" | "routeProcess";
    cap?: string;
    run?: string;
    mem?: string;
    proc?: string;
  }) => {
    if (a.kind === "upgrade") {
      setOpenSheet("subscription");
      return;
    }
    // Route the ask into the matching process: open it and continue the
    // conversation there, scoped and saved — not lost in the home chat.
    if (a.kind === "routeProcess" && a.proc) {
      const p = processes.find((u) => u.id === a.proc);
      if (p) {
        openUnit(p);
        if (a.run) void sendToUnit(a.run, p);
      }
      return;
    }
    if (a.kind === "enableCap" && a.cap) {
      persistCaps(caps.includes(a.cap) ? caps : [...caps, a.cap]);
      const name = capName(a.cap, lang);
      setChat((c) => [
        ...c,
        { role: "one", text: lang === "he" ? `✅ ״${name}״ פעילה עכשיו.` : `✅ “${name}” is on now.` },
      ]);
      if (a.cap === "quiz" && a.run) void runQuiz(a.run);
      return;
    }
    // Share a "ask-first" memory fact for this process — flip it to open so ONE
    // can use it now. The value stays local; only the permission changes.
    if (a.kind === "shareMem" && a.mem) {
      const fact = MEMORY_CATALOG.find((f) => f.key === a.mem);
      cycleToOpen(a.mem);
      const label = fact ? (lang === "he" ? fact.he : fact.en) : a.mem;
      setChat((c) => [
        ...c,
        {
          role: "one",
          text:
            lang === "he"
              ? `✅ ${fact?.emoji ?? ""} ${label} — אשתמש בזה לתהליך הזה.`
              : `✅ ${fact?.emoji ?? ""} ${label} — I'll use that for this one.`,
        },
      ]);
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text) return;
    const priorChat = chat; // snapshot the transcript for the AI, pre-append
    setChat((c) => [...c, { role: "user", text }]);
    setDraft("");
    setThinking(true);

    // Capabilities gate. If the ask maps to a capability that isn't switched on,
    // ONE offers to add it (or prompts an upgrade for a paid one) instead of just
    // failing silently. Quiz, when on, runs; other enabled caps fall through to
    // the normal flow (which creates/updates a process).
    const capKey = capabilityForText(text);
    if (capKey && !caps.includes(capKey)) {
      setThinking(false);
      const name = capName(capKey, lang);
      const emoji = CAPABILITY_CATALOG.find((c) => c.key === capKey)?.emoji ?? "";
      if (PREMIUM_CAPS.includes(capKey) && plan === "free") {
        setChat((c) => [
          ...c,
          {
            role: "one",
            text:
              lang === "he"
                ? `${emoji} ״${name}״ היא יכולת בתוכנית משודרגת. לשדרג כדי להפעיל?`
                : `${emoji} “${name}” is a Plus capability. Upgrade to switch it on?`,
            actions: [{ label: t.upgrade, kind: "upgrade" }],
          },
        ]);
      } else {
        setChat((c) => [
          ...c,
          {
            role: "one",
            text:
              lang === "he"
                ? `${emoji} אני יכול לעשות את זה עם היכולת ״${name}״ — היא עדיין לא מופעלת.`
                : `${emoji} I can do that with the “${name}” capability — it isn't switched on yet.`,
            actions: [{ label: `${emoji} ${t.capNeedRun}`, kind: "enableCap", cap: capKey, run: text }],
          },
        ]);
      }
      return;
    }
    if (capKey === "quiz" && !quiz) {
      void runQuiz(text);
      return;
    }

    // Business-aware: if I mention a business at home, my ONE consults ITS ONE —
    // so it knows their hours/prices and can even book, without me leaving home.
    const biz = findBusiness(businesses, text);
    if (biz) {
      const res = bizReply(biz, text, new Date());
      window.setTimeout(() => {
        setThinking(false);
        setChat((c) => [...c, { role: "one", text: `I checked with ${biz.name}'s ONE — ${res.lines[0]}` }]);
        res.lines.slice(1).forEach((l) => setChat((c) => [...c, { role: "one", text: l }]));
        if (res.booking) {
          const confirm = book(biz, res.booking.slot, res.booking.service);
          setChat((c) => [...c, { role: "one", text: confirm }]);
        } else if (res.offerSlots) {
          setChat((c) => [...c, { role: "one", text: `Their open times: ${biz.slots.join(", ")}. Say "book <time>" and I'll lock it — or open ${biz.name} to see more.` }]);
        }
      }, 780);
      return;
    }

    const focus = units.find((p) => p.id === focusId) ?? null;
    const res = interpret(text, {
      identityId: activeIdentityId,
      now: Date.now(),
      processes,
      focus,
    });
    // Is this a brand-new process (vs. an update to an existing one)?
    const isNewProcess = !!res.process && !processes.some((p) => p.id === res.process!.id);

    // The structured side (created/updated process, broadcast, ONE-to-ONE
    // outreach) applies whether ONE speaks via the real model or the fallback.
    const applyStructured = () => {
      if (res.process) {
        upsert(res.process);
        setFocusId(res.process.id);
      }
      if (res.broadcast) setLiveBroadcast(res.broadcast);
      // Only let a provider "get back to me" when the process is tied to a REAL
      // connected business. Otherwise the reply is fabricated ("two venues got
      // back to me…") and reads as fake — so we suppress it.
      if (
        res.outreach &&
        res.process &&
        res.process.businessId &&
        !outreachDoneRef.current.has(res.process.id)
      ) {
        const targetId = res.process.id;
        const o = res.outreach;
        outreachDoneRef.current.add(targetId);
        window.setTimeout(() => {
          setUnits((list) => list.map((p) => (p.id === targetId ? o.apply(p) : p)));
          setChat((c) => (c.length ? [...c, { role: "one", text: o.line }] : c));
          setLiveBroadcast(o.broadcast);
        }, o.delayMs);
      }
    };

    try {
      const processExtra = res.process
        ? `You have just opened a process for them: "${res.process.title}". Acknowledge it in one line and say you're on it.`
        : undefined;
      const extra = [processExtra, memoryContext()].filter(Boolean).join(" ") || undefined;
      const messages: AiChatMessage[] = [
        { role: "system", content: oneSystemPrompt(lang, extra) },
        ...priorChat.slice(-8).map((m) => ({
          role: (m.role === "one" ? "assistant" : "user") as AiChatMessage["role"],
          content: m.text,
        })),
        { role: "user", content: text },
      ];
      const reply = await invokeAiChat(messages, { maxTokens: 220 });
      setThinking(false);
      // If the ask wasn't itself a new/updated process but clearly belongs to an
      // existing one, offer to continue it there — scoped and saved — instead of
      // letting the thread live only in the ephemeral home chat.
      const routeTo = !res.process ? matchProcessForText(text) : null;
      setChat((c) => [
        ...c,
        routeTo
          ? {
              role: "one",
              text: reply,
              actions: [
                {
                  label: `▸ ${routeTo.emoji} ${t.routeInto}${routeTo.title}`,
                  kind: "routeProcess" as const,
                  proc: routeTo.id,
                  run: text,
                },
              ],
            }
          : { role: "one", text: reply, chips: suggestChips(reply, lang) },
      ]);
      applyStructured();
      // A brand-new process gets a tailored multi-stage plan a beat later.
      if (isNewProcess && res.process) void enrichProcessPlan(res.process, text);
    } catch {
      // Offline / unconfigured — fall back to the local brain's canned lines.
      window.setTimeout(() => {
        setThinking(false);
        res.lines.forEach((line) => setChat((c) => [...c, { role: "one", text: line }]));
        applyStructured();
      }, 600);
    }
  };

  const endChat = () => {
    setChat([]);
    setThinking(false);
    setTempChat(false);
  };

  // A temporary chat — a clean conversation that ONE won't keep as a process.
  // The drawer stays open (it's a persistent panel now).
  const startTempChat = () => {
    setActiveProcess(null);
    setChat([]);
    setThinking(false);
    setDraft("");
    setTempChat(true);
    closeDrawerOnMobile();
  };
  // The temp-chat control is a toggle — tapping it while a temp chat is open
  // ends it and drops back to the resting home.
  const toggleTempChat = () => {
    if (tempChat) {
      endChat();
      setSpace("home");
      requestAnimationFrame(() => scrollHome(0));
    } else {
      startTempChat();
    }
  };

  // New process — a fresh conversation with ONE. Unlike a temporary chat, ONE
  // keeps it: whatever you ask for becomes a new process. Drops you on the
  // blank ONE home, ready to state the intention.
  const startNewProcess = () => {
    setActiveProcess(null);
    setChat([]);
    setThinking(false);
    setDraft("");
    setTempChat(false);
    setSpace("home");
    closeDrawerOnMobile();
  };

  // Open a unit into the desktop split (detail + its own chat); focus it so the
  // chat updates THIS unit, and greet.
  const openUnit = (p: Process) => {
    setActiveProcess(p);
    setFocusId(p.id);
    setUnitMenuOpen(false);
    // Opening it counts as seeing it — clear the unread badge.
    if (p.unread > 0) {
      setUnits((list) => list.map((u) => (u.id === p.id ? { ...u, unread: 0 } : u)));
    }
    // Restore the saved transcript if this process has one; otherwise greet.
    const stored = units.find((u) => u.id === p.id)?.chat;
    setUnitChat(
      stored && stored.length > 0
        ? stored
        : [
            {
              role: "one",
              text: `Here's ${p.title}.${p.nextAction ? " " + p.nextAction : " Tell me what changed and I'll update it."}`,
            },
          ],
    );
    closeDrawerOnMobile();
  };
  // Open a process straight to its options (⋮ on a drawer row / long-press).
  const openUnitOptions = (p: Process) => {
    openUnit(p);
    setUnitMenuOpen(true);
  };
  const closeUnit = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    setUnitMenuOpen(false);
  };
  // Drag the divider to resize the detail card. Works in both LTR (card on the
  // right) and RTL (card on the left) by measuring from the split's edges.
  const startAsideResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const rtl = lang === "he";
    const onMove = (ev: MouseEvent) => {
      const rect = unitSplitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = rtl ? ev.clientX - rect.left : rect.right - ev.clientX;
      setAsideW(Math.max(300, Math.min(720, w)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  // Kebab-menu actions on the open process.
  const shareUnit = () => {
    if (!activeProcess) return;
    const text = `${activeProcess.emoji} ${activeProcess.title}${activeProcess.nextAction ? " — " + activeProcess.nextAction : ""}`;
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard blocked — no-op */
    }
    // Confirm the copy in place, then dismiss the menu.
    setUnitShared(true);
    setTimeout(() => {
      setUnitShared(false);
      setUnitMenuOpen(false);
    }, 1100);
  };
  // Wipe just the conversation (keep the process). Resets to the opening line.
  const wipeUnitChat = () => {
    if (!activeProcess) return;
    const p = activeProcess;
    const greeting = {
      role: "one" as const,
      text: `Here's ${p.title}.${p.nextAction ? " " + p.nextAction : " Tell me what changed and I'll update it."}`,
    };
    setUnitChat([greeting]);
    setUnits((list) => list.map((u) => (u.id === p.id ? { ...u, chat: [greeting] } : u)));
    setUnitMenuOpen(false);
  };
  const deleteUnit = () => {
    if (!activeProcess) return;
    // Deleting is irreversible — require a confirming second tap.
    if (!unitConfirmDelete) {
      setUnitConfirmDelete(true);
      return;
    }
    const id = activeProcess.id;
    setUnits((u) => u.filter((x) => x.id !== id));
    setUnitConfirmDelete(false);
    setUnitMenuOpen(false);
    closeUnit();
  };
  // Scroll the home to one of its two surfaces: 0 the ONE surface (top, rest),
  // 1 Updates (below). Global is not a scroll target — it rises as an overlay.
  const scrollHome = (dir: 0 | 1) => {
    const page = homePageRef.current;
    if (!page) return;
    page.scrollTo({ top: dir * page.clientHeight, behavior: "smooth" });
  };
  // The ONE mark is "home": drop whatever you're in and return to the hero.
  const goHome = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    endChat();
    closeDrawer();
    setSpace("home");
    setGlobalOpen(false);
    requestAnimationFrame(() => scrollHome(0));
  };
  // Generate examples — ONE asks the AI for a few realistic life intents, then
  // builds a complete process from each (via the local brain, so they're
  // schema-valid). No hardcoded demo data; every example is freshly generated.
  const generateExamples = async () => {
    if (generating) return;
    setGenerating(true);
    const build = (intents: string[]) => {
      intents.forEach((intent, i) => {
        const res = interpret(intent, {
          identityId: activeIdentityId,
          now: Date.now() + i,
          processes,
          focus: null,
        });
        if (res.process) upsert(res.process);
      });
    };
    try {
      const sys =
        lang === "he"
          ? 'החזר אך ורק מערך JSON של 3 כוונות חיים קצרות בגוף ראשון שאדם היה מבקש מנציג אישי לטפל בהן, כל אחת 3–6 מילים. דוגמה: ["לחדש דרכון","למצוא רופא שיניים","לתכנן סוף שבוע ברומא"]. בלי מספור ובלי טקסט נוסף.'
          : 'Return ONLY a JSON array of 3 short first-person life intentions a person would ask a personal representative to handle, each 3-6 words. Example: ["Renew my passport","Find a new dentist","Plan a weekend in Rome"]. No numbering, no extra text.';
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: "Generate 3." },
        ],
        { maxTokens: 140, temperature: 0.9 },
      );
      const intents = parseIntents(raw);
      build(intents.length ? intents : []);
    } catch {
      build(
        lang === "he"
          ? ["לחדש דרכון", "למצוא רופא שיניים", "לתכנן סוף שבוע ברומא"]
          : ["Renew my passport", "Find a new dentist", "Plan a weekend in Rome"],
      );
    } finally {
      setGenerating(false);
    }
  };

  // ONE profile — now a full canvas screen, not a popup.
  const openProfile = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    endChat();
    closeDrawerOnMobile();
    setSpace("profile");
  };

  // Pull a concrete "when" out of a message (a day and/or a real clock time),
  // in English or Hebrew. Returns null when there's no bookable time — so ONE
  // only acts when the user actually names one, not on every message.
  const extractWhen = (text: string): string | null => {
    const day =
      text.match(
        /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i,
      )?.[0] ||
      text.match(
        /מחר|היום|יום ראשון|יום שני|יום שלישי|יום רביעי|יום חמישי|יום שישי|יום שבת|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|השבוע הבא/,
      )?.[0];
    const time =
      text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ||
      text.match(/\b(?:[1-9]|1[0-2])\s?(?:am|pm)\b/i)?.[0] ||
      text.match(/(?:בשעה|ב-?)\s?(?:[01]?\d|2[0-3])(?::[0-5]\d)?/)?.[0];
    const when = [day, time].filter(Boolean).join(" ").trim();
    return when || null;
  };

  // ONE doesn't just reply in a unit — when you name a time it BOOKS it: sets
  // the "when", advances the next open step, moves the next-action forward, logs
  // it, and announces. Returns the booked time (or null when nothing to book).
  const advanceUnitFromChat = (focusId: string, text: string): string | null => {
    const when = extractWhen(text);
    if (!when) return null;
    const he = lang === "he";
    setUnits((list) =>
      list.map((u) => {
        if (u.id !== focusId) return u;
        const firstOpen = u.steps.findIndex((s) => !s.done);
        const steps = u.steps.map((s, i) => (i === firstOpen ? { ...s, done: true } : s));
        const doneCount = steps.filter((s) => s.done).length;
        const whenLabel = he ? "מתי" : "When";
        const metrics = [
          { label: whenLabel, value: when },
          ...(u.metrics ?? []).filter((m) => !/^when$|^מתי$/i.test(m.label)),
        ];
        return {
          ...u,
          time: "now",
          metrics,
          steps,
          progress: {
            done: doneCount,
            total: steps.length || u.progress?.total || doneCount,
          },
          nextAction: he ? `אזכיר לך יום לפני ${when}.` : `I'll remind you a day before ${when}.`,
          timeline: [
            { at: "now", text: he ? `נקבע ל${when}.` : `Set for ${when}.` },
            ...u.timeline,
          ],
        };
      }),
    );
    announce(`Set for ${when}.`, `נקבע ל${when}.`);
    return when;
  };

  // "Write the email / reply / message them / draft a note" — the cue that the
  // user wants ONE to compose an actual outward message, not just chat about it.
  const DRAFT_INTENT =
    /\b(draft|compose|write (a|an|the)?|email|reply|respond|send (a |an )?(message|note|email|letter)|message them|tell them|reach out|follow up)\b|נסח|תנסח|כתוב|תכתוב|מייל|אימייל|לשלוח|תשלח|שלח לה|שלח לו|הודעה|תשובה|תגיב|פנייה|תפנה/i;

  // Draft composer — ONE writes the real outward message for a process (an email
  // to the office, a note to a provider), grounded in what it knows and only the
  // facts you've shared openly. You edit and approve; nothing is sent for you —
  // that stays your move. This is the intention→reality bridge made concrete.
  const composeDraft = async (proc: Process, ask: string): Promise<boolean> => {
    const he = lang === "he";
    const sys = he
      ? 'נסח מסמך פנייה יוצא בשם המשתמש. החזר JSON תקין בלבד: {"kind":"email|message|form","to":"...","subject":"...","body":"..."} — kind=סוג הפנייה, to=הנמען (משרד/עסק/אדם), subject=נושא (למייל בלבד, אחרת ריק), body=גוף ההודעה מנוסח, מנומס וקונקרטי, מוכן לשליחה, בגוף ראשון בשם המשתמש. עברית. בלי code fences.'
      : 'Compose an outward message on the user\'s behalf. Return ONLY valid JSON: {"kind":"email|message|form","to":"...","subject":"...","body":"..."} — kind=the message type, to=the recipient (office/business/person), subject=subject line (email only, else blank), body=a polished, polite, concrete message ready to send, first person as the user. No code fences.';
    try {
      const ctx = [`Process: "${proc.title}" (${proc.relation}).`, memoryContext()]
        .filter(Boolean)
        .join(" ");
      const raw = await invokeAiChat(
        [
          { role: "system", content: `${sys} ${ctx}` },
          { role: "user", content: ask },
        ],
        { maxTokens: 340, temperature: 0.5 },
      );
      const body = raw.replace(/```json|```/g, "");
      const s = body.indexOf("{");
      const e = body.lastIndexOf("}");
      if (s < 0 || e <= s) return false;
      const parsed = JSON.parse(body.slice(s, e + 1));
      if (typeof parsed?.body !== "string" || !parsed.body.trim()) return false;
      const kind: UnitDraft["kind"] =
        parsed.kind === "message" || parsed.kind === "form" ? parsed.kind : "email";
      const draft: UnitDraft = {
        id: `draft_${proc.id}_${Date.now()}`,
        kind,
        to: typeof parsed.to === "string" ? parsed.to.slice(0, 80) : "",
        subject: typeof parsed.subject === "string" ? parsed.subject.slice(0, 120) : "",
        body: parsed.body.trim(),
        status: "draft",
      };
      setUnits((list) =>
        list.map((u) => (u.id === proc.id ? { ...u, drafts: [...(u.drafts ?? []), draft] } : u)),
      );
      return true;
    } catch {
      return false;
    }
  };
  const setDraftBody = (procId: string, draftId: string, body: string) =>
    setUnits((list) =>
      list.map((u) =>
        u.id === procId
          ? {
              ...u,
              // Editing the wording un-approves it — you re-confirm the new text.
              drafts: (u.drafts ?? []).map((d) =>
                d.id === draftId ? { ...d, body, status: "draft" as const } : d,
              ),
            }
          : u,
      ),
    );
  const approveDraft = (procId: string, draftId: string) =>
    setUnits((list) =>
      list.map((u) =>
        u.id === procId
          ? {
              ...u,
              drafts: (u.drafts ?? []).map((d) =>
                d.id === draftId ? { ...d, status: "approved" as const } : d,
              ),
            }
          : u,
      ),
    );
  const removeDraft = (procId: string, draftId: string) =>
    setUnits((list) =>
      list.map((u) =>
        u.id === procId ? { ...u, drafts: (u.drafts ?? []).filter((d) => d.id !== draftId) } : u,
      ),
    );

  // Chat scoped to the open unit — every reply's changes land on the card beside.
  // `target` lets a caller (e.g. home→process routing) send into a specific unit
  // without waiting for setActiveProcess to flush through React state.
  const sendToUnit = async (override?: string, target?: Process) => {
    const proc = target ?? activeProcess;
    if (!proc) return;
    const text = (override ?? unitDraft).trim();
    if (!text) return;
    const priorChat = unitChat; // snapshot the transcript for the AI, pre-append
    setUnitChat((c) => [...c, { role: "user", text }]);
    setUnitDraft("");
    setUnitThinking(true);
    // "Write the email / message them" → ONE composes a real outward draft you
    // can review in the Drafts section, instead of just replying about it.
    if (DRAFT_INTENT.test(text.toLowerCase())) {
      const ok = await composeDraft(proc, text);
      setUnitThinking(false);
      setUnitChat((c) => [
        ...c,
        {
          role: "one",
          text: ok
            ? lang === "he"
              ? "✍️ ניסחתי טיוטה — היא מחכה לך ב״טיוטות״ למטה. תבדוק, תערוך ואשר."
              : "✍️ I've drafted it — it's waiting in Drafts below. Review, edit, and approve."
            : lang === "he"
              ? "לא הצלחתי לנסח כרגע. ננסה שוב?"
              : "I couldn't draft that just now. Want me to try again?",
        },
      ]);
      return;
    }
    const focus = units.find((u) => u.id === proc.id) ?? null;
    const res = interpret(text, { identityId: activeIdentityId, now: Date.now(), processes, focus });

    const applyStructured = () => {
      if (res.process) upsert(res.process);
      if (res.broadcast) setLiveBroadcast(res.broadcast);
      // Outreach ("the provider's ONE got back to me") belongs to the moment a
      // process is CREATED — never on follow-up messages to one that already
      // exists, or it fires the same fake reply again on every turn. In a unit
      // chat `focus` is always the existing process, so it's suppressed here.
      if (!focus && res.outreach && res.process && !outreachDoneRef.current.has(res.process.id)) {
        const targetId = res.process.id;
        const o = res.outreach;
        outreachDoneRef.current.add(targetId);
        window.setTimeout(() => {
          setUnits((list) => list.map((pp) => (pp.id === targetId ? o.apply(pp) : pp)));
          setUnitChat((c) => [...c, { role: "one", text: o.line }]);
          setLiveBroadcast(o.broadcast);
        }, o.delayMs);
      }
    };

    try {
      const done = focus ? focus.steps.filter((_, i) => isStepDone(focus, i)).length : 0;
      const total = focus ? focus.steps.length : 0;
      const scopeExtra = `You are working on this specific process for them: "${proc.title}" (${proc.relation}${total ? `, ${done}/${total} steps done` : ""}). Keep the reply scoped to moving THIS process forward.`;
      const extra = [scopeExtra, memoryContext()].filter(Boolean).join(" ");
      const messages: AiChatMessage[] = [
        { role: "system", content: oneSystemPrompt(lang, extra) },
        ...priorChat.slice(-8).map((m) => ({
          role: (m.role === "one" ? "assistant" : "user") as AiChatMessage["role"],
          content: m.text,
        })),
        { role: "user", content: text },
      ];
      const reply = await invokeAiChat(messages, { maxTokens: 200 });
      setUnitThinking(false);
      setUnitChat((c) => [...c, { role: "one", text: reply, chips: suggestChips(reply, lang) }]);
      applyStructured();
      // Act, don't just talk: if the message named a time, book it into the unit.
      const booked = advanceUnitFromChat(proc.id, text);
      if (booked)
        setUnitChat((c) => [
          ...c,
          {
            role: "one",
            text:
              lang === "he"
                ? `סגור — קבעתי ל${booked} ועדכנתי את התהליך.`
                : `Done — booked for ${booked}. I've moved the process forward.`,
          },
        ]);
    } catch {
      window.setTimeout(() => {
        setUnitThinking(false);
        res.lines.forEach((line) => setUnitChat((c) => [...c, { role: "one", text: line }]));
        applyStructured();
        const booked = advanceUnitFromChat(proc.id, text);
        if (booked)
          setUnitChat((c) => [
            ...c,
            {
              role: "one",
              text:
                lang === "he"
                  ? `סגור — קבעתי ל${booked} ועדכנתי את התהליך.`
                  : `Done — booked for ${booked}. I've moved the process forward.`,
            },
          ]);
      }, 600);
    }
  };

  // Arrived from the landing gateway ("/app?q=…")? ONE starts working on that
  // intention immediately — send it as the first message, then clean the URL.
  // Sent synchronously (no timer) and ref-guarded so it survives React's
  // StrictMode double-invoke in dev and fires exactly once.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    seededRef.current = true;
    window.history.replaceState(null, "", "/app");
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the conversation pinned to the latest line.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking]);
  useEffect(() => {
    unitEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [unitChat, unitThinking]);

  // Persist the unit's transcript back into the process, so closing and
  // reopening it (or a reload) restores the whole conversation.
  useEffect(() => {
    if (!activeProcess || unitChat.length === 0) return;
    setUnits((list) =>
      list.map((u) => (u.id === activeProcess.id ? { ...u, chat: unitChat } : u)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitChat, activeProcess?.id]);

  // Park the home scroll on the ONE surface (top) before first paint, so it
  // never flashes Updates on the way in.
  useLayoutEffect(() => {
    const page = homePageRef.current;
    if (page) page.scrollTop = 0;
  }, [activeProcess, chat.length, tempChat, space]);

  // Global rises as an overlay when you scroll UP at the very top of the home —
  // an accumulator on the wheel (and a touch-drag downward) crosses a threshold,
  // mirroring the landing hero's Global reveal. Only armed on the resting home.
  useEffect(() => {
    const page = homePageRef.current;
    if (!page) return;
    if (globalOpen || space !== "home" || activeProcess || chat.length > 0) return;
    let acc = 0;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (page.scrollTop > 2) {
        acc = 0;
        return;
      }
      if (e.deltaY < 0) {
        acc += -e.deltaY;
        if (acc > 130) {
          acc = 0;
          setGlobalOpen(true);
        }
      } else {
        acc = 0;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (acc = 0), 260);
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (page.scrollTop > 2) return;
      if ((e.touches[0]?.clientY ?? 0) - startY > 90) setGlobalOpen(true);
    };
    page.addEventListener("wheel", onWheel, { passive: true });
    page.addEventListener("touchstart", onTouchStart, { passive: true });
    page.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      page.removeEventListener("wheel", onWheel);
      page.removeEventListener("touchstart", onTouchStart);
      page.removeEventListener("touchmove", onTouchMove);
      window.clearTimeout(timer);
    };
  }, [globalOpen, space, activeProcess, chat.length]);

  // …and scrolling DOWN at the very top of the open panel (or dragging it down)
  // lowers Global back out of view — the natural reverse of the reveal.
  useEffect(() => {
    if (!globalOpen) return;
    const panel = pgPanelRef.current;
    if (!panel) return;
    let acc = 0;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (panel.scrollTop > 0) {
        acc = 0;
        return;
      }
      if (e.deltaY > 0) {
        acc += e.deltaY;
        if (acc > 60) {
          acc = 0;
          setGlobalOpen(false);
        }
      } else {
        acc = 0;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (acc = 0), 260);
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (panel.scrollTop > 0) return;
      if ((e.touches[0]?.clientY ?? 0) - startY > 70) setGlobalOpen(false);
    };
    panel.addEventListener("wheel", onWheel, { passive: true });
    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      panel.removeEventListener("wheel", onWheel);
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      window.clearTimeout(timer);
    };
  }, [globalOpen]);

  // Esc backs out of whatever's open — an overlay, then the unit, then the
  // drawer. The workspace should never trap you.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (globalOpen) setGlobalOpen(false);
      else if (openSheet) setOpenSheet(null);
      else if (activeProcess) closeUnit();
      else if (drawerOpen) closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalOpen, openSheet, activeProcess, drawerOpen]);

  // rotating broadcast line (fade between). Re-keyed on identity so switching
  // ONEs restarts the rotation in that ONE's voice.
  useEffect(() => {
    setBi(0);
    const t = setInterval(() => {
      setBfade(true);
      setTimeout(() => {
        setBi((i) => (i + 1) % broadcastLines.length);
        setBfade(false);
      }, 280);
    }, 4200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdentityId]);

  // A live announcement ("Booked…", "You confirmed…") holds the pulse for a
  // moment, then settles back into the resting digest — announce, then resume.
  useEffect(() => {
    if (!liveBroadcast) return;
    const t = setTimeout(() => setLiveBroadcast(null), 6000);
    return () => clearTimeout(t);
  }, [liveBroadcast]);

  const isStepDone = (p: Process, i: number) => {
    const key = `${p.id}:${i}`;
    return key in stepOverrides ? stepOverrides[key] : p.steps[i].done;
  };
  const toggleStep = (p: Process, i: number) =>
    setStepOverrides((s) => ({ ...s, [`${p.id}:${i}`]: !isStepDone(p, i) }));

  // Global's live activity ticker — a rotating line built from the businesses so
  // the marketplace reads as busy and real-time.
  const feedActs =
    lang === "he"
      ? ["קיבל הזמנה עכשיו", "עונה למישהו כרגע", "נפתח להיום", "הוסיף שירות חדש", "אישר תור"]
      : ["just took a booking", "is answering someone", "opened for the day", "added a new service", "confirmed a slot"];
  const feedList = businesses
    .slice(0, 8)
    .map((b, i) => `${b.emoji}  ${b.name} · ${feedActs[i % feedActs.length]}`);
  const feedLine = feedList.length ? feedList[feedIdx % feedList.length] : "";
  // Global filtered by the selected world.
  const worldBiz =
    world === "all" ? businesses : businesses.filter((b) => worldOf(b.category) === world);
  // Updates surface (scroll down) — processes, the ones needing you first.
  const updatesList = [...processes].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0));
  // Global feed sections — requests waiting on you and news across the network.
  const gRequests =
    lang === "he"
      ? [
          { who: "AllMove", emoji: "📦", text: "שלחו הצעת מחיר — צריך אישור" },
          { who: "Sarah Salon", emoji: "💈", text: "מבקשים לאשר את התור למחר" },
          { who: "Instructor Dana", emoji: "🚗", text: "מציעים שיעור נוסף השבוע" },
        ]
      : [
          { who: "AllMove", emoji: "📦", text: "Sent a quote — needs your OK" },
          { who: "Sarah Salon", emoji: "💈", text: "Asking to confirm tomorrow's slot" },
          { who: "Instructor Dana", emoji: "🚗", text: "Offering another lesson this week" },
        ];
  const gNews =
    lang === "he"
      ? [
          "3 עסקים חדשים נפתחו בעולם הבריאות השבוע",
          "ONE01 עדכן שעות פעילות",
          "פנאי — העולם הכי פעיל היום",
        ]
      : [
          "3 new businesses opened in Health this week",
          "ONE01 updated its opening hours",
          "Leisure — the busiest world today",
        ];

  const STATUS_KEYS = ["statusThinking", "statusConnecting", "statusSearching", "statusWorking"] as const;
  const statusLabel = t[STATUS_KEYS[statusIdx % STATUS_KEYS.length]];

  return (
    <main className="product-root" data-theme={theme} dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
      {/* No splash overlay. The opening IS the home animating in — see the
          awakening effect above: ONE starts as a dot at the centre of the
          screen and grows into place. Same as the landing hero. */}
      {/* Full-bleed canvas — no window chrome, no back-to-site. The product is
          its own place; the ONE orb in the sidebar is the brand anchor. */}
      <div className="app-shell">
        {/* Edge-hover zone — sweep the mouse to the inline-start edge and the
            drawer slides out on its own (desktop only). */}
        <div
          className="app-edge-hover"
          onMouseEnter={() => !drawerOpen && setDrawerOpen(true)}
          aria-hidden="true"
        />
        {/* TOP BAR — the ONE mark (face in the "O", click = home) with the panel
            arrow beside it; the right side is Upgrade and a temporary chat. */}
        <nav className="app-nav">
          <div className="app-nav-left">
            <button
              className="app-brand-btn"
              onClick={() => {
                // From a unit, chat, or any non-home space, the mark backs you
                // out to home; on the home surface it opens/closes the drawer.
                if (activeProcess || chat.length > 0 || tempChat || space !== "home") goHome();
                else toggleDrawer();
              }}
              aria-label={
                activeProcess || chat.length > 0 || tempChat || space !== "home"
                  ? "ONE — home"
                  : drawerOpen
                    ? "Collapse menu"
                    : "Open menu"
              }
            >
              <OneWord className={`app-brand-mark${oneWorking ? " is-working" : ""}`} />
            </button>
            <button
              className={`app-drawer-toggle${drawerOpen ? " is-open" : ""}`}
              onClick={toggleDrawer}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Collapse menu" : "Open menu"}
            >
              <ArrowIcon />
            </button>
          </div>
          <div className="app-nav-right">
            <button
              className="app-nav-btn app-nav-upgrade"
              onClick={() => setOpenSheet("subscription")}
            >
              <span>{t.upgrade}</span>
            </button>
            {/* Temporary chat — a clean incognito glyph, no chrome. Tapping it
                while a temp chat is open turns it into an ✕ that exits. */}
            <button
              className={`app-nav-btn app-nav-temp${tempChat ? " is-active" : ""}`}
              onClick={toggleTempChat}
              aria-label={tempChat ? t.exitTemp : t.tempChat}
              title={tempChat ? t.exitTemp : t.tempChat}
              aria-pressed={tempChat}
            >
              {tempChat ? (
                <i className="fi fi-rr-cross-small" aria-hidden="true" />
              ) : (
                <i className="fi fi-rr-incognito" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {/* SIDE DRAWER — profiles + your process list, profile/settings at the
            foot. On desktop it's a persistent panel that shrinks the canvas;
            on mobile it slides over with a scrim. */}
        {drawerOpen && (
          <div className="app-drawer-scrim" onClick={closeDrawer} />
        )}
        <aside
          ref={drawerRef}
          className={`app-drawer${drawerOpen ? " is-open" : ""}`}
          aria-hidden={!drawerOpen}
        >
          <div className="drawer-scroll">
            <div
              className={`drawer-section drawer-profiles${profilesOpen ? " is-open" : ""}`}
              onMouseLeave={() => setProfilesOpen(false)}
            >
              <div className="drawer-label">{t.profiles}</div>
              {/* Active profile — click to reveal the others (they also reveal
                  on hover, like a little drawer). */}
              <div className="drawer-profile-wrap">
                <button
                  className="drawer-profile active"
                  onClick={() => setProfilesOpen((v) => !v)}
                  aria-expanded={profilesOpen}
                >
                  <span className="drawer-profile-emoji">{identity.emoji}</span>
                  <span className="drawer-profile-text">
                    <span className="drawer-profile-name">{identity.name}</span>
                    <span className="drawer-profile-role">{identity.role}</span>
                  </span>
                  <i className="fi fi-rr-angle-small-down drawer-profile-caret" aria-hidden="true" />
                </button>
                {/* Reveals on hover — jumps straight to the profile canvas. */}
                <button
                  className="drawer-profile-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfile();
                  }}
                  aria-label={t.editProfile}
                  title={t.editProfile}
                >
                  <i className="fi fi-rr-pencil" aria-hidden="true" />
                </button>
              </div>
              <div className="drawer-profiles-more">
                <div className="drawer-profiles-more-inner">
                  {IDENTITIES.filter((id) => id.id !== activeIdentityId).map((id) => (
                    <button
                      key={id.id}
                      className="drawer-profile"
                      onClick={() => {
                        setActiveIdentityId(id.id);
                        setProfilesOpen(false);
                      }}
                    >
                      <span className="drawer-profile-emoji">{id.emoji}</span>
                      <span className="drawer-profile-text">
                        <span className="drawer-profile-name">{id.name}</span>
                        <span className="drawer-profile-role">{id.role}</span>
                      </span>
                    </button>
                  ))}
                  <button className="drawer-row drawer-row-new" onClick={startCreateBusiness}>
                    <i className="fi fi-rr-plus drawer-row-ico" aria-hidden="true" />
                    {t.newProfile}
                  </button>
                </div>
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-label">{t.processes}</div>
              {[...processes]
                .sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0))
                .map((p) => (
                  <div
                    key={p.id}
                    className={`drawer-process${p.unread > 0 ? " has-update" : ""}`}
                    title={`${p.title} · ${p.relation}`}
                  >
                    <button className="drawer-process-open" onClick={() => openUnit(p)}>
                      <span className="drawer-process-emoji">{p.emoji}</span>
                      <span className="drawer-process-main">
                        <span className="drawer-process-title">{p.title}</span>
                        <span className="drawer-process-sub">
                          {p.relation}
                          {p.steps.length > 0 && (
                            <>
                              {" · "}
                              {p.steps.filter((_, i) => isStepDone(p, i)).length}/{p.steps.length}
                            </>
                          )}
                          {p.time && (
                            <>
                              {" · "}
                              {p.time}
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                    {p.unread > 0 && <span className="drawer-process-badge">{p.unread}</span>}
                    <button
                      className="drawer-process-menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUnitOptions(p);
                      }}
                      aria-label={t.options}
                      title={t.options}
                    >
                      <i className="fi fi-rr-menu-dots-vertical" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              {processes.length === 0 && (
                <div className="drawer-empty">
                  <span>{t.nothingHere}</span>
                  <button className="drawer-gen" onClick={generateExamples} disabled={generating}>
                    <span aria-hidden="true">✨</span> {generating ? t.generating : t.genExamples}
                  </button>
                </div>
              )}
            </div>

            {/* New chat sits at the end of the list — above the footer's
                separator line. */}
            <button
              className="drawer-new"
              onClick={startNewProcess}
              title={t.newProcess}
              aria-label={t.newProcess}
            >
              <span className="drawer-new-ico">
                <i className="fi fi-rr-plus" aria-hidden="true" />
              </span>
              <span className="drawer-new-label">{t.newProcess}</span>
            </button>
          </div>

          <div className="drawer-foot">
            <button className="drawer-row" onClick={openProfile}>
              <i className="fi fi-rr-user drawer-row-ico" aria-hidden="true" />
              {t.oneProfile}
            </button>
            <button className="drawer-row" onClick={() => setOpenSheet("settings")}>
              <i className="fi fi-rr-settings-sliders drawer-row-ico" aria-hidden="true" />
              {t.settings}
            </button>
            <div className={`drawer-cloud cloud-${cloud}`}>
              {cloud === "synced" && t.cloudSynced}
              {cloud === "connecting" && t.cloudConnecting}
              {cloud === "offline" && t.cloudOffline}
            </div>
          </div>
        </aside>

        {/* RIGHT — the workspace: broadcast-driven cards or the conversation */}
        <section className="app-main">
          <div className="app-edge top" />
          {activeLive ? (
            // ── UNIT SPLIT — the wide detail card BESIDE its own chat. Typing in
            //    the chat updates the card live. "Full" hides the chat and lets
            //    the card fill the workspace.
            <div className="unit-view">
              {/* A split: the conversation on one side, a live detail card beside
                  it that you can drag wider. The chat carries its own header
                  (title · a kebab menu · close), scoped to the chat's width. */}
              <div className="unit-split" ref={unitSplitRef}>
                <div className="unit-chatpane">
                  <div className="unit-chat-head">
                    <div className="unit-topbar-head">
                      <div className="unit-topbar-title">
                        <span className="unit-topbar-emoji">{activeLive.emoji}</span>
                        <span>{activeLive.title}</span>
                      </div>
                      <div className="unit-topbar-sub">
                        {activeLive.relation}
                        <span className="unit-topbar-dot">·</span>
                        {activeLive.steps.filter((_, i) => isStepDone(activeLive, i)).length}/
                        {activeLive.steps.length} {t.done}
                      </div>
                    </div>
                    <div className="unit-menu-wrap">
                      <button
                        className="unit-tb-icon"
                        onClick={() => setUnitMenuOpen((v) => !v)}
                        aria-label="Options"
                        aria-haspopup="menu"
                        aria-expanded={unitMenuOpen}
                      >
                        <KebabIcon />
                      </button>
                      {unitMenuOpen && (
                        <>
                          <div className="unit-menu-catch" onClick={() => setUnitMenuOpen(false)} />
                          <div className="unit-menu" role="menu">
                            <button
                              className={`unit-menu-item${unitShared ? " ok" : ""}`}
                              onClick={shareUnit}
                              role="menuitem"
                            >
                              <i
                                className={`fi ${unitShared ? "fi-rr-check" : "fi-rr-share"}`}
                                aria-hidden="true"
                              />{" "}
                              {unitShared ? t.copied : t.share}
                            </button>
                            <button
                              className="unit-menu-item"
                              onClick={wipeUnitChat}
                              role="menuitem"
                            >
                              <i className="fi fi-rr-eraser" aria-hidden="true" /> {t.wipeChat}
                            </button>
                            <button
                              className={`unit-menu-item danger${unitConfirmDelete ? " confirm" : ""}`}
                              onClick={deleteUnit}
                              role="menuitem"
                            >
                              <i className="fi fi-rr-trash" aria-hidden="true" />{" "}
                              {unitConfirmDelete ? t.confirmDelete : t.deleteProcess}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <button className="unit-tb-icon" onClick={closeUnit} aria-label="Close unit">
                      ×
                    </button>
                  </div>
                  <div className="unit-chat-scroll">
                    {unitChat.map((m, i) => (
                      <Fragment key={i}>
                        <div className={`chat-msg ${m.role}`}>{m.text}</div>
                        {m.chips && m.chips.length > 0 && (
                          <div className="chat-chips">
                            {m.chips.map((c) => (
                              <button key={c} className="chat-chip" onClick={() => sendToUnit(c)}>
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </Fragment>
                    ))}
                    {unitThinking && (
                      <div className="unit-status" aria-live="polite">
                        <Orb
                          size={22}
                          closed
                          faceColor="var(--p-face)"
                          eyeColor="var(--p-bg)"
                          className="unit-status-orb"
                        />
                        <span className="unit-status-text">{statusLabel}</span>
                      </div>
                    )}
                    <div ref={unitEndRef} />
                  </div>
                  <div className="app-dock unit-dock">
                    <AppInput
                      value={unitDraft}
                      onChange={setUnitDraft}
                      onSend={sendToUnit}
                      placeholder={t.tellChanged}
                    />
                  </div>
                </div>
                <div
                  className="unit-resizer"
                  onMouseDown={startAsideResize}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize details"
                />
                <aside className="unit-aside" style={{ width: asideW }}>
                  <UnitDetail
                    p={activeLive}
                    businesses={businesses}
                    isStepDone={isStepDone}
                    toggleStep={toggleStep}
                    runQuickAction={runQuickAction}
                    openBiz={openBiz}
                    lang={lang}
                    onDraftEdit={setDraftBody}
                    onDraftApprove={approveDraft}
                    onDraftDiscard={removeDraft}
                  />
                </aside>
              </div>
            </div>
          ) : (
            <>
              {(chat.length > 0 || tempChat) && (
                <button className="app-close" onClick={endChat} aria-label="Close chat">
                  ×
                </button>
              )}
              {chat.length === 0 && !tempChat ? (
                space === "profile" ? (
                  // ── PROFILE — a full canvas screen (not a popup): your ONE,
                  //    your identities, plan and connections.
                  <div className="canvas profile-canvas">
                    <div className="canvas-inner">
                      <button className="canvas-back" onClick={goHome}>
                        <span className="canvas-back-ico" aria-hidden="true">‹</span> {t.backHome}
                      </button>
                      <div className="profile-hero">
                        <Orb size={76} />
                        <div className="profile-title">
                          ONE{" "}
                          <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
                        </div>
                        <div className="profile-sub">{t.repSub}</div>
                      </div>

                      {/* Capabilities — the skills ONE has switched on. The
                          headline of the redesigned profile. */}
                      <div className="sheet-section">
                        <div className="prof-sec-head">
                          <h4>{t.capabilities}</h4>
                          <span className="prof-sec-sub">{t.capabilitiesSub}</span>
                        </div>
                        <div className="cap-grid">
                          {CAPABILITY_CATALOG.map((c) => {
                            const on = caps.includes(c.key);
                            return (
                              <button
                                key={c.key}
                                className={`cap-card${on ? " on" : ""}`}
                                onClick={() => toggleCap(c.key)}
                                aria-pressed={on}
                              >
                                <span className="cap-emoji" aria-hidden="true">{c.emoji}</span>
                                <span className="cap-text">
                                  <span className="cap-name">{lang === "he" ? c.he : c.en}</span>
                                  <span className="cap-desc">
                                    {lang === "he" ? c.descHe : c.descEn}
                                  </span>
                                </span>
                                <span className={`cap-toggle${on ? " on" : ""}`} aria-hidden="true">
                                  <span className="cap-knob" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="sheet-pill ghost cap-add-link"
                          onClick={() => {
                            goHome();
                            requestAnimationFrame(() => setGlobalOpen(true));
                          }}
                        >
                          + {t.addCapability}
                        </button>
                      </div>

                      {/* Memory — personal facts as tiles; each has its own
                          permission (open / ask / private) you cycle by tapping. */}
                      <div className="sheet-section">
                        <div className="prof-sec-head">
                          <h4>{t.memory}</h4>
                          <span className="prof-sec-sub">{t.memorySub}</span>
                        </div>
                        <div className="mem-grid">
                          {MEMORY_CATALOG.map((f) => {
                            const e = memEntry(f.key);
                            const permLabel =
                              e.perm === "open" ? t.permOpen : e.perm === "ask" ? t.permAsk : t.permPrivate;
                            return (
                              <div className="mem-tile" key={f.key}>
                                <span className="mem-ico" aria-hidden="true">{f.emoji}</span>
                                <span className="mem-body">
                                  <span className="mem-label">{lang === "he" ? f.he : f.en}</span>
                                  <input
                                    className="mem-input"
                                    value={e.value}
                                    placeholder={t.memAddValue}
                                    onChange={(ev) => setMemoryValue(f.key, ev.target.value)}
                                  />
                                </span>
                                <button
                                  className={`mem-perm ${e.perm}`}
                                  onClick={() => cycleMemoryPerm(f.key)}
                                  title={permLabel}
                                >
                                  {PERM_DOT[e.perm]} {permLabel}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="sheet-section">
                        <h4>{t.account}</h4>
                        {user ? (
                          <>
                            <div className="sheet-row">
                              <span className="r-label">{user.name ?? user.email ?? "Signed in"}</span>
                              <span className="r-value" style={{ color: "var(--p-ok)", fontWeight: 600 }}>{t.synced}</span>
                            </div>
                            {user.email && user.name && (
                              <div className="sheet-row">
                                <span className="r-label" style={{ opacity: 0.6, fontWeight: 400 }}>{user.email}</span>
                              </div>
                            )}
                            <button
                              className="sheet-pill ghost"
                              style={{ width: "100%", marginTop: 6, padding: 11 }}
                              onClick={doSignOut}
                            >
                              {t.signOut}
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="sheet-sub" style={{ marginBottom: 10 }}>{t.signInBlurb}</div>
                            <button className="google-btn" onClick={continueWithGoogle}>
                              <GoogleG /> {t.continueGoogle}
                            </button>
                            <div className="auth-or">
                              <span>{t.orMagic}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                className="app-input"
                                style={{ boxShadow: "none", background: "var(--p-bg)", flex: 1 }}
                                type="email"
                                inputMode="email"
                                placeholder="you@email.com"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                              />
                              <button className="sheet-pill blue" style={{ padding: "0 16px" }} onClick={sendMagicLink}>
                                {t.sendLink}
                              </button>
                            </div>
                            {authMsg && <div className="auth-msg">{authMsg}</div>}
                          </>
                        )}
                      </div>

                      <div className="sheet-section">
                        <h4>{t.identity}</h4>
                        {IDENTITIES.map((id) => (
                          <button
                            key={id.id}
                            className="sheet-row"
                            style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "start" }}
                            onClick={() => setActiveIdentityId(id.id)}
                          >
                            <span className="r-label">
                              {id.emoji} {id.name}
                            </span>
                            <span className="r-value">
                              {id.role}
                              {id.id === activeIdentityId ? ` · ${t.active}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="sheet-section">
                        <h4>{t.plan}</h4>
                        {plan === "free" ? (
                          <>
                            <div className="sheet-row">
                              <span className="r-label">{t.onFree}</span>
                              <span className="r-value">{t.unlockMore}</span>
                            </div>
                            <button
                              className="sheet-pill blue"
                              style={{ width: "100%", marginTop: 4, padding: "12px" }}
                              onClick={() => setOpenSheet("subscription")}
                            >
                              {t.upgrade}
                            </button>
                          </>
                        ) : (
                          <div className="sheet-row">
                            <span className="r-label">{t.activePlan}</span>
                            <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
                          </div>
                        )}
                      </div>

                      <div className="sheet-section">
                        <h4>{t.more}</h4>
                        <div className="sheet-row">
                          <span className="r-label">{t.memory}</span>
                          <span className="r-value">{t.memoryVal.replace("{n}", String(PROCESSES.length))}</span>
                        </div>
                        <div className="sheet-row">
                          <span className="r-label">{t.connections}</span>
                          <span className="r-value">{t.connectionsVal}</span>
                        </div>
                        <button
                          className="sheet-row"
                          style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "start" }}
                          onClick={() => setOpenSheet("settings")}
                        >
                          <span className="r-label">{t.settings}</span>
                          <span className="r-value">›</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // HOME / GLOBAL — one canvas with a segmented toggle at the top
                  // that flips between the ONE surface and the Global worlds.
                  <>
                    {/* GLOBAL — rises as an overlay sheet when you scroll up at
                        the top of the home (or tap the ↑ chevron), exactly like
                        the landing hero's Global reveal. */}
                    <div
                      className={`pg-sheet${globalOpen ? " open" : ""}`}
                      aria-hidden={!globalOpen}
                    >
                      <div
                        className="pg-sheet-scrim"
                        onClick={() => setGlobalOpen(false)}
                      />
                      <div
                        className="pg-sheet-panel"
                        ref={pgPanelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t.global}
                      >
                        <button
                          className="pg-sheet-grab"
                          onClick={() => setGlobalOpen(false)}
                          aria-label="Close"
                        />
                        <button
                          className="pg-sheet-close"
                          onClick={() => setGlobalOpen(false)}
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      <div className="global-pane">
                          <div className="global-head">
                            <div className="global-headtext">
                              <h2 className="global-title">{t.global}</h2>
                              <p className="global-lede">{t.globalLede}</p>
                            </div>
                            <span className="global-live">
                              <span className="global-live-dot" />
                              {t.live} · {businesses.length} {t.onesOnline}
                            </span>
                          </div>
                          {feedLine && (
                            <div className="global-feed" aria-live="polite">
                              <span className="global-feed-pulse" aria-hidden="true" />
                              <span key={feedIdx} className="global-feed-line">{feedLine}</span>
                            </div>
                          )}
                          <div className="global-sec-head">
                            <h3 className="global-sec-title">{t.worlds}</h3>
                          </div>
                          <div className="world-bar" role="tablist" aria-label={t.worlds}>
                            <button
                              className={`world-chip${world === "all" ? " is-active" : ""}`}
                              onClick={() => setWorld("all")}
                            >
                              {t.worldAll}
                            </button>
                            {WORLD_KEYS.map((k) => (
                              <button
                                key={k}
                                className={`world-chip${world === k ? " is-active" : ""}`}
                                onClick={() => setWorld(k)}
                              >
                                <span className="world-chip-emoji" aria-hidden="true">{WORLD_EMOJI[k]}</span>
                                {t[WORLD_LABEL[k]]}
                              </button>
                            ))}
                          </div>
                          <div className="global-grid">
                            {worldBiz.map((b) => {
                              const os = now ? openState(b, now) : null;
                              return (
                                <button key={b.id} className="gcard" onClick={() => openBiz(b.id)}>
                                  <span className="gcard-top">
                                    <span className="gcard-emoji">{b.emoji}</span>
                                    {os && (
                                      <span className={`gcard-status${os.open ? " open" : ""}`}>
                                        <span className="gcard-dot" aria-hidden="true" />
                                        {os.open ? t.openNow : t.closedNow}
                                      </span>
                                    )}
                                  </span>
                                  <span className="gcard-name">
                                    {b.name}
                                    {b.ownerKey && ownerKey && b.ownerKey === ownerKey ? " · yours" : ""}
                                  </span>
                                  <span className="gcard-cat">{b.category}</span>
                                </button>
                              );
                            })}
                            <button className="gcard gcard-new" onClick={startCreateBusiness}>
                              <span className="gcard-emoji">＋</span>
                              <span className="gcard-name">{t.createBiz}</span>
                              <span className="gcard-cat">{t.createBizSub}</span>
                            </button>
                          </div>
                          {worldBiz.length === 0 && (
                            <div className="world-empty">{t.emptyWorld}</div>
                          )}

                          {/* Capabilities — switch on more of what ONE can do. */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.capabilities}</h3>
                            <span className="global-sec-sub">{t.capsGlobalSub}</span>
                          </div>
                          <div className="gcaps">
                            {CAPABILITY_CATALOG.map((c) => {
                              const on = caps.includes(c.key);
                              return (
                                <div key={c.key} className={`gcap${on ? " on" : ""}`}>
                                  <span className="gcap-emoji" aria-hidden="true">{c.emoji}</span>
                                  <span className="gcap-main">
                                    <span className="gcap-name">{lang === "he" ? c.he : c.en}</span>
                                    <span className="gcap-desc">
                                      {lang === "he" ? c.descHe : c.descEn}
                                    </span>
                                  </span>
                                  <button
                                    className={`gcap-add${on ? " added" : ""}`}
                                    onClick={() => !on && persistCaps([...caps, c.key])}
                                    disabled={on}
                                  >
                                    {on ? t.capAdded : t.capAdd}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Official sources — the trusted places ONE draws on.
                              Adding custom channels is role-gated (coming). */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.sources}</h3>
                            <span className="global-sec-sub">{t.sourcesSub}</span>
                          </div>
                          <div className="gsources">
                            {SOURCE_CATALOG.map((s) => (
                              <div key={s.key} className="gsource">
                                <span className="gsource-emoji" aria-hidden="true">{s.emoji}</span>
                                <span className="gsource-main">
                                  <span className="gsource-name">{lang === "he" ? s.he : s.en}</span>
                                  <span className="gsource-host">{s.host}</span>
                                </span>
                                <span className={`gsource-badge ${s.kind}`}>
                                  {s.kind === "official" ? t.official : t.reference}
                                </span>
                              </div>
                            ))}
                            <button className="gsource-add" disabled title={t.addSourceHint}>
                              <span aria-hidden="true">＋</span> {t.addSource}
                              <span className="gsource-add-hint">{t.addSourceHint}</span>
                            </button>
                          </div>

                          {/* Processes — your active engagements across the network */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.processes}</h3>
                            <span className="global-sec-sub">{t.processesSub}</span>
                          </div>
                          <div className="glist">
                            {processes.map((p) => (
                              <button key={p.id} className="grow" onClick={() => openUnit(p)}>
                                <span className="grow-emoji">{p.emoji}</span>
                                <span className="grow-main">
                                  <span className="grow-who">{p.title}</span>
                                  <span className="grow-text">{p.relation}</span>
                                </span>
                                {p.unread > 0 && <span className="grow-badge">{p.unread}</span>}
                              </button>
                            ))}
                            {processes.length === 0 && (
                              <div className="world-empty">
                                <div>{t.emptyProcesses}</div>
                                <button
                                  className="gen-btn"
                                  onClick={generateExamples}
                                  disabled={generating}
                                >
                                  <span aria-hidden="true">✨</span>{" "}
                                  {generating ? t.generating : t.genExamples}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Connections — ONEs you're linked to */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.connections}</h3>
                            <span className="global-sec-sub">{t.connectionsSub}</span>
                          </div>
                          <div className="gconns">
                            {businesses.slice(0, 8).map((b) => (
                              <button key={b.id} className="gconn" onClick={() => openBiz(b.id)}>
                                <span className="gconn-emoji">{b.emoji}</span>
                                <span className="gconn-name">{b.name}</span>
                              </button>
                            ))}
                          </div>

                          {/* Requests — waiting on you */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.requests}</h3>
                            <span className="global-sec-sub">{t.requestsSub}</span>
                          </div>
                          <div className="glist">
                            {gRequests.map((r, i) => (
                              <div key={i} className="grow">
                                <span className="grow-emoji">{r.emoji}</span>
                                <span className="grow-main">
                                  <span className="grow-who">{r.who}</span>
                                  <span className="grow-text">{r.text}</span>
                                </span>
                                <span className="grow-cta" aria-hidden="true">›</span>
                              </div>
                            ))}
                          </div>

                          {/* News — across the network */}
                          <div className="global-sec-head with-top">
                            <h3 className="global-sec-title">{t.news}</h3>
                            <span className="global-sec-sub">{t.newsSub}</span>
                          </div>
                          <div className="glist">
                            {gNews.map((n, i) => (
                              <div key={i} className="gnews">
                                <span className="gnews-dot" aria-hidden="true" />
                                <span className="gnews-text">{n}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="app-page" ref={homePageRef}>
                    {/* ONE surface — rest (top). Scroll down = Updates. */}
                    <section className="home-main">
                      <button
                        type="button"
                        className="home-chev up"
                        onClick={() => setGlobalOpen(true)}
                        aria-label={t.global}
                      >
                        <ChevronUpIcon />
                      </button>
                      <div className="home-center">
                        <div
                          key={liveBroadcast ?? "resting"}
                          className={`home-broadcast${liveBroadcast ? " is-live" : ""}${
                            !liveBroadcast && bfade ? " is-fading" : ""
                          }`}
                        >
                          {liveBroadcast ?? broadcastLines[bi % broadcastLines.length]}
                        </div>
                        <AppInput
                          value={draft}
                          onChange={setDraft}
                          onSend={() => send()}
                          placeholder={t.talkToOne}
                          caret
                        />
                      </div>
                      <button
                        type="button"
                        className="home-chev down"
                        onClick={() => scrollHome(1)}
                        aria-label={t.updates}
                      >
                        <ChevronDownIcon />
                      </button>
                    </section>
                    {/* UPDATES — scroll down. Recent activity across your processes. */}
                    <section className="home-updates">
                      <div className="updates-pane">
                        <div className="global-sec-head">
                          <h3 className="global-sec-title">{t.updates}</h3>
                          <span className="global-sec-sub">{t.updatesSub}</span>
                        </div>
                        <div className="glist">
                          {updatesList.map((p) => (
                            <button key={p.id} className="grow" onClick={() => openUnit(p)}>
                              <span className="grow-emoji">{p.emoji}</span>
                              <span className="grow-main">
                                <span className="grow-who">{p.title}</span>
                                <span className="grow-text">{p.nextAction ?? p.summary}</span>
                              </span>
                              {p.unread > 0 && <span className="grow-badge">{p.unread}</span>}
                            </button>
                          ))}
                          {updatesList.length === 0 && (
                            <div className="world-empty">{t.updatesEmpty}</div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                  </>
                )
              ) : (
                <>
                  <div className="app-chat">
                    {tempChat && (
                      <>
                        <div className="temp-chat-tag">
                          <i className="fi fi-rr-incognito" aria-hidden="true" /> {t.tempTag}
                        </div>
                        {chat.length === 0 && (
                          <div className="temp-chat-anon">{t.tempAnon}</div>
                        )}
                      </>
                    )}
                    {chat.map((m, i) => (
                      <Fragment key={i}>
                        <div className={`chat-msg ${m.role}`}>
                          {m.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="chat-img" src={m.image} alt="" loading="lazy" />
                          )}
                          {m.text}
                        </div>
                        {m.quiz ? (
                          <div className="chat-chips quiz-chips">
                            {m.quiz.options.map((o, oi) => (
                              <button
                                key={oi}
                                className="chat-chip quiz-chip"
                                onClick={() => answerQuiz(oi)}
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        ) : m.actions && m.actions.length > 0 ? (
                          <div className="chat-chips">
                            {m.actions.map((a, ai) => (
                              <button
                                key={ai}
                                className="chat-chip chip-cta"
                                onClick={() => runChatAction(a)}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          m.chips &&
                          m.chips.length > 0 && (
                            <div className="chat-chips">
                              {m.chips.map((c) => (
                                <button key={c} className="chat-chip" onClick={() => send(c)}>
                                  {c}
                                </button>
                              ))}
                            </div>
                          )
                        )}
                      </Fragment>
                    ))}
                    {thinking && (
                      <div className="unit-status" aria-live="polite">
                        <Orb
                          size={22}
                          closed
                          faceColor="var(--p-face)"
                          eyeColor="var(--p-bg)"
                          className="unit-status-orb"
                        />
                        <span className="unit-status-text">{statusLabel}</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="app-edge bottom" />
                  <div className="app-dock">
                    <AppInput
                      value={draft}
                      onChange={setDraft}
                      onSend={() => send()}
                      placeholder={t.talkToOne}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>


      {/* ── SUBSCRIPTION popup ── */}
      <Sheet open={openSheet === "subscription"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">{t.upgradeOne}</div>
            <div className="sheet-sub">{t.choosePlan}</div>
          </div>
          <div className="plan-tiers">
            <div className="plan-tier">
              <div className="t-name" style={{ color: "var(--p-blue)" }}>
                Pro
              </div>
              <div className="t-price">₪29</div>
              <div className="t-per">{t.perMonth}</div>
              <button
                className="sheet-pill blue"
                style={{ width: "100%" }}
                onClick={() => {
                  setPlan("pro");
                  setOpenSheet(null);
                }}
              >
                {t.choosePro}
              </button>
            </div>
            <div className="plan-tier">
              <div className="t-name" style={{ color: "var(--p-purple)" }}>
                Max
              </div>
              <div className="t-price">₪69</div>
              <div className="t-per">{t.perMonth}</div>
              <button
                className="sheet-pill purple"
                style={{ width: "100%" }}
                onClick={() => {
                  setPlan("max");
                  setOpenSheet(null);
                }}
              >
                {t.chooseMax}
              </button>
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-row">
              <span className="r-label">Pro</span>
              <span className="r-value">{t.proFeat}</span>
            </div>
            <div className="sheet-row">
              <span className="r-label">Max</span>
              <span className="r-value">{t.maxFeat}</span>
            </div>
          </div>
        </div>
      </Sheet>

      {/* ── SETTINGS popup ── */}
      <Sheet open={openSheet === "settings"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">{t.settings}</div>
          </div>
          <div className="sheet-section">
            <h4>{t.preferences}</h4>
            <div className="sheet-row">
              <span className="r-label">{t.language}</span>
              <div className="seg2">
                <button className={lang === "en" ? "on" : ""} onClick={() => applyLang("en")}>
                  English
                </button>
                <button className={lang === "he" ? "on" : ""} onClick={() => applyLang("he")}>
                  עברית
                </button>
              </div>
            </div>
            <div className="sheet-row">
              <span className="r-label">{t.theme}</span>
              <div className="seg2">
                <button className={theme === "light" ? "on" : ""} onClick={() => applyTheme("light")}>
                  {t.light}
                </button>
                <button className={theme === "dark" ? "on" : ""} onClick={() => applyTheme("dark")}>
                  {t.dark}
                </button>
              </div>
            </div>
          </div>
          <div className="sheet-section">
            <h4>{t.account}</h4>
            <button
              className="sheet-row"
              style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
              onClick={() => setOpenSheet("subscription")}
            >
              <span className="r-label">{lang === "he" ? "מנוי" : "Subscription"}</span>
              <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
            </button>
            <div className="sheet-row">
              <span className="r-label">{t.exportData}</span>
              <span className="r-value">›</span>
            </div>
            {user && (
              <button
                className="sheet-row"
                style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
                onClick={doSignOut}
              >
                <span className="r-label" style={{ color: "#DC2626" }}>
                  {t.signOut}
                </span>
                <span className="r-value">›</span>
              </button>
            )}
          </div>
          <div className="sheet-section">
            <Link href="/" className="sheet-pill ghost" style={{ display: "inline-block" }}>
              {t.backToSite}
            </Link>
          </div>
        </div>
      </Sheet>

      {/* The unit detail now lives inline in the workspace split (UnitDetail),
          beside its own chat — no modal popup. */}

      {/* ── CREATE A BUSINESS — form + free-text, ONE builds the profile ── */}
      <Sheet open={!!draftBiz} onClose={() => setDraftBiz(null)}>
        {draftBiz && (
          <div className="sheet-body">
            <div className="sheet-hero">
              <div className="sheet-title">
                <span>{draftBiz.emoji}</span> New business ONE
              </div>
              <div className="sheet-sub">Describe it in a sentence, or fill the fields — ONE builds the profile.</div>
            </div>

            <div className="sheet-section">
              <h4>Describe it</h4>
              <textarea
                className="app-input"
                style={{ boxShadow: "none", background: "var(--p-bg)", minHeight: 64, resize: "vertical", width: "100%" }}
                placeholder="e.g. Nadia's Nails — a nail salon, manicure ₪90, gel ₪140, open 9–7"
                value={bizDraftText}
                onChange={(e) => setBizDraftText(e.target.value)}
              />
              <button className="sheet-pill ghost" style={{ marginTop: 8, padding: "9px 14px" }} onClick={applyBizDraftText}>
                ✨ Let ONE fill it in
              </button>
            </div>

            <div className="sheet-section">
              <h4>Details</h4>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  className="app-input"
                  style={{ boxShadow: "none", background: "var(--p-bg)", width: 60, textAlign: "center" }}
                  value={draftBiz.emoji}
                  onChange={(e) => setDraftBiz({ ...draftBiz, emoji: e.target.value.slice(0, 2) })}
                />
                <input
                  className="app-input"
                  style={{ boxShadow: "none", background: "var(--p-bg)", flex: 1 }}
                  placeholder="Business name"
                  value={draftBiz.name}
                  onChange={(e) => setDraftBiz({ ...draftBiz, name: e.target.value })}
                />
              </div>
              <input
                className="app-input"
                style={{ boxShadow: "none", background: "var(--p-bg)", width: "100%", marginBottom: 8 }}
                placeholder="Category"
                value={draftBiz.category}
                onChange={(e) => setDraftBiz({ ...draftBiz, category: e.target.value })}
              />
              <input
                className="app-input"
                style={{ boxShadow: "none", background: "var(--p-bg)", width: "100%" }}
                placeholder="One-line blurb"
                value={draftBiz.blurb}
                onChange={(e) => setDraftBiz({ ...draftBiz, blurb: e.target.value })}
              />
            </div>

            <div className="sheet-section">
              <h4>Services</h4>
              {draftBiz.services.map((s, i) => (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }} key={i}>
                  <input
                    className="app-input"
                    style={{ boxShadow: "none", background: "var(--p-bg)", flex: 1 }}
                    placeholder="Service"
                    value={s.name}
                    onChange={(e) => {
                      const svc = [...draftBiz.services];
                      svc[i] = { ...svc[i], name: e.target.value };
                      setDraftBiz({ ...draftBiz, services: svc });
                    }}
                  />
                  <input
                    className="app-input"
                    style={{ boxShadow: "none", background: "var(--p-bg)", width: 88 }}
                    placeholder="₪0"
                    value={s.price}
                    onChange={(e) => {
                      const svc = [...draftBiz.services];
                      svc[i] = { ...svc[i], price: e.target.value };
                      setDraftBiz({ ...draftBiz, services: svc });
                    }}
                  />
                </div>
              ))}
              <button
                className="sheet-pill ghost"
                style={{ padding: "8px 14px" }}
                onClick={() => setDraftBiz({ ...draftBiz, services: [...draftBiz.services, { name: "", price: "" }] })}
              >
                + Add service
              </button>
            </div>

            <div className="sheet-section">
              <h4>Hours</h4>
              {draftBiz.hours.length ? (
                <div className="biz-hours">
                  {draftBiz.hours.map((h) => (
                    <div className="biz-hour-row" key={h.day}>
                      <span>{h.day}</span>
                      <span className={h.close ? "" : "biz-closed"}>{h.close ? `${h.open}–${h.close}` : "Closed"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sheet-sub">Mention hours in the description (e.g. “open 9–6”) and ONE fills these.</div>
              )}
            </div>

            <button
              className="sheet-pill blue"
              style={{ width: "100%", padding: 13, marginTop: 6, opacity: draftBiz.name.trim() ? 1 : 0.5 }}
              onClick={submitBusiness}
              disabled={!draftBiz.name.trim()}
            >
              Create business ONE
            </button>
          </div>
        )}
      </Sheet>

      {/* ── BUSINESS profile — its own ONE, chat + book ── */}
      {(() => {
        const biz = businesses.find((b) => b.id === bizId);
        const st = biz ? openState(biz, new Date()) : null;
        return (
          <Sheet open={!!bizId} onClose={() => setBizId(null)}>
            {biz && st && (
              <div className="sheet-body">
                <div className="sheet-hero">
                  <div className="sheet-title">
                    <span>{biz.emoji}</span> {biz.name}
                  </div>
                  <div className="biz-meta">
                    <span className="biz-rating">★ {biz.rating}</span>
                    <span>· {biz.category}</span>
                    <span className={`biz-open ${st.open ? "on" : "off"}`}>{st.text}</span>
                  </div>
                  <div className="unit-pulse">{biz.blurb}</div>
                </div>

                {biz.ownerKey && ownerKey && biz.ownerKey === ownerKey ? (
                  <>
                    <div className="sheet-section">
                      <h4>Followers · {followers.length}</h4>
                      {followers.length === 0 ? (
                        <div className="sheet-sub">No followers yet — share your ONE to gather some.</div>
                      ) : (
                        followers.map((f) => (
                          <div className="sheet-row" key={f.follower_key}>
                            <span className="r-label">{f.follower_name}</span>
                            <span className="r-value">following</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="sheet-section">
                      <h4>Customers · {customers.length}</h4>
                      {customers.length === 0 ? (
                        <div className="sheet-sub">Customer cards appear here when people book you.</div>
                      ) : (
                        customers.map((c) => (
                          <div className="sheet-row" key={c.customer_name}>
                            <span className="r-label">{c.customer_name}</span>
                            <span className="r-value">
                              {c.visits} visit{c.visits > 1 ? "s" : ""}
                              {c.last_slot ? ` · ${c.last_slot}` : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="sheet-section">
                    <button
                      className={`sheet-pill ${following ? "ghost" : "blue"}`}
                      style={{ width: "100%", padding: 12 }}
                      onClick={toggleFollow}
                    >
                      {following ? "✓ Following" : "+ Follow this ONE"}
                    </button>
                  </div>
                )}

                <div className="sheet-section">
                  <h4>Hours</h4>
                  <div className="biz-hours">
                    {biz.hours.map((h) => (
                      <div className="biz-hour-row" key={h.day}>
                        <span>{h.day}</span>
                        <span className={h.close ? "" : "biz-closed"}>{h.close ? `${h.open}–${h.close}` : "Closed"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <h4>Services — tap to choose</h4>
                  {biz.services.map((s) => (
                    <button
                      key={s.name}
                      className={`sheet-row biz-service${bizService === s.name ? " selected" : ""}`}
                      style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
                      onClick={() => setBizService((cur) => (cur === s.name ? null : s.name))}
                    >
                      <span className="r-label" style={{ fontWeight: 500 }}>
                        {bizService === s.name ? "✓ " : ""}
                        {s.name}
                      </span>
                      <span className="r-value">{s.price}</span>
                    </button>
                  ))}
                </div>

                <div className="sheet-section">
                  <h4>{bizService ? `Book ${bizService} — pick a time` : "Book a time"}</h4>
                  <div className="qa-row">
                    {biz.slots.map((slot) => (
                      <button key={slot} className="qa-btn" onClick={() => book(biz, slot, bizService ?? undefined)}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sheet-section">
                  <h4>Chat with {biz.name}&apos;s ONE</h4>
                  <div className="biz-chat">
                    {bizChat.map((m, i) => (
                      <div key={i} className={`chat-msg ${m.role}`}>
                        {m.text}
                      </div>
                    ))}
                    {bizThinking && (
                      <div className="chat-msg one thinking">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <input
                      className="app-input"
                      style={{ boxShadow: "none", background: "var(--p-bg)" }}
                      placeholder={`Ask ${biz.name}…`}
                      value={bizDraft}
                      onChange={(e) => setBizDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          sendBiz();
                        }
                      }}
                    />
                    <button className="app-send" aria-label="Send" onClick={sendBiz}>
                      <SendIcon />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Sheet>
        );
      })()}
    </main>
  );
}
