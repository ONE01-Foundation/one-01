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
  type Identity,
  type InboundRequest,
  type Reminder,
} from "@/lib/mockData";
import { interpret, type ChatMsg } from "@/lib/oneBrain";
import { bizReply, openState, findBusiness } from "@/lib/bizBrain";
import { invokeAiChat, oneSystemPrompt, type AiChatMessage } from "@/lib/aiChat";
import { generateImage } from "@/lib/aiImage";
import {
  publishGlobalUnit,
  searchGlobalUnits,
  forkGlobalUnit,
  type GlobalUnit,
} from "@/lib/globalUnits";
import { transcribeAudio, startRealtime, type RealtimeHandle } from "@/lib/voice";
import { searchWeb } from "@/lib/webSearch";
import {
  createSharedUnit,
  joinSharedUnit,
  getSharedMessages,
  postSharedMessage,
  listSharedMembers,
} from "@/lib/sharedUnits";
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
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  // Three rounded waveform bars — identical geometry to the mobile app's
  // VoiceIcon (src/components/mvp/icons.tsx), so the "talk to ONE" mark reads
  // the same on web and phone.
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="14.107" y="3.885" width="3.786" height="24.23" rx="1.893" fill="currentColor" />
      <rect x="21.214" y="8.272" width="3.786" height="15.144" rx="1.893" fill="currentColor" />
      <rect x="7.101" y="11.342" width="3.786" height="9.086" rx="1.893" fill="currentColor" />
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
  lang = "en",
  onVoiceTap,
  voiceOn = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  /** Quick tap on the (empty) voice button → start a live voice call. */
  onVoiceTap?: () => void;
  /** When false, the mic (record + call) is disabled — cost switch. */
  voiceOn?: boolean;
  /** Home: no placeholder copy at all — just a resting caret, so ONE looks
   *  ready to be spoken to rather than instructing you. (Same as the hero.) */
  caret?: boolean;
  /** App language — sets which side the empty caret rests on (Hebrew → right).
   *  Once you type, `dir="auto"` follows the language you're actually typing. */
  lang?: "en" | "he";
}) {
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false); // hold-to-record
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micRef = useRef<MediaStream | null>(null);
  const holdingRef = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const hasText = value.trim().length > 0;
  const he = lang === "he";

  // HOLD the voice button → record; on release → Whisper transcribes into the
  // input. TAP it → open a live spoken conversation with ONE (Realtime). Both
  // degrade silently where mic / APIs aren't available.
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        micRef.current?.getTracks().forEach((t) => t.stop());
        micRef.current = null;
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 800) {
          const text = await transcribeAudio(blob);
          if (text) onChange((value.trim() ? value.trim() + " " : "") + text);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };
  const onVoiceDown = () => {
    if (!voiceOn) return;
    holdingRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdingRef.current = true;
      void startRecording();
    }, 220);
  };
  const onVoiceUp = () => {
    if (!voiceOn) return;
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      stopRecording();
    } else {
      onVoiceTap?.();
    }
  };
  const onVoiceCancel = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      stopRecording();
    }
  };

  return (
    <div className="app-bar">
      <button className="app-bar-plus" aria-label="Add" type="button">
        <PlusIcon />
      </button>
      <span className="app-bar-wrap" dir={he ? "rtl" : "ltr"}>
        {caret && !value && !focused && <span className="app-bar-caret" aria-hidden="true" />}
        <input
          className="app-bar-input"
          // Empty → rest the caret on the app-language side (Hebrew right, English
          // left). Once you type, `auto` follows the language you're typing in.
          dir={value ? "auto" : he ? "rtl" : "ltr"}
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
        className={`app-bar-go${listening ? " is-listening" : ""}`}
        aria-label={hasText ? "Send" : listening ? "Recording" : "Voice — tap to call, hold to record"}
        type="button"
        onClick={hasText ? () => onSend() : undefined}
        onPointerDown={hasText ? undefined : onVoiceDown}
        onPointerUp={hasText ? undefined : onVoiceUp}
        onPointerLeave={hasText ? undefined : onVoiceCancel}
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
    key: "providers",
    emoji: "🧭",
    en: "Find providers",
    he: "איתור ספקים",
    descEn: "Finds providers for a need — adds them and reaches out.",
    descHe: "מאתר ספקים לצורך — מוסיף אותם ופונה אליהם.",
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
  { key: "forms", re: /\bfill\b[^.?!]*\bform\b|\bform\b[^.?!]*\bfill\b|application form|form for\b|למלא[^.?!]*טופס|טופס[^.?!]*למלא|תמלא[^.?!]*טופס|בקשה רשמית/i },
  { key: "reminders", re: /remind me|set a reminder|תזכיר לי|קבע תזכורת|תזכורת/i },
  { key: "translate", re: /translate|תרגם|תתרגם|תרגום ל/i },
  { key: "travel", re: /plan (a )?trip|itinerary|תכנן(?: לי)? טיול|מסלול טיול|לתכנן חופשה/i },
  { key: "negotiate", re: /negotiate|haggle|get a better (price|deal)|תנהל מו"מ|להתמקח|לנהל משא ומתן/i },
  { key: "providers", re: /\b(find|get|get me|find me)\b(?: me)?(?: a| an| some)?(?: [\w'-]+){0,4} (providers?|suppliers?|vendors?|instructors?|teachers?|coach(?:es)?|tutors?|trainers?|contractors?|professionals?|experts?|compan(?:y|ies)|business(?:es)?|specialists?|agenc(?:y|ies)|freelancers?|pros?)\b|\bwho can\b|\brecommend( me)? (a|an|some)|\bneed (a|an|some)(?: [\w'-]+){0,4} (provider|supplier|instructor|teacher|coach|tutor|contractor|professional|expert|specialist)|תמצא(?: לי)? (ספק|מורה|מדריך|מאמן|בעל מקצוע|חברה|נותן שירות)|מצא(?: לי)? (ספק|מורה|מדריך|מאמן|בעל מקצוע)|תמליץ(?: לי)? על|מי יכול/i },
  { key: "research", re: /research|compare|which is better|תשווה|השוואה בין|מה עדיף|תחקור/i },
];
function capabilityForText(text: string): string | null {
  for (const c of CAP_INTENT) if (c.re.test(text)) return c.key;
  return null;
}

// Question vs. intent. A "pure question" asks for information ("how long does a
// passport take?") — it should get a straight answer, not spawn a process. We
// treat it as a question when it opens with an interrogative or ends with "?",
// AND carries no action/goal verb (which would make it an actual intent).
const QUESTION_OPENERS =
  /^(how|what|when|where|why|who|which|is|are|do|does|can|could|should|will|would)\b|^(כמה|מתי|איפה|למה|מדוע|מי|איך|האם|מה|כיצד)\b/i;
const ACTION_VERBS =
  /\b(book|schedule|reserve|remind|renew|apply|register|cancel|order|buy|pay|plan|set ?up|find me|get me|help me|open|start|create|sign ?up|send|email|call|track|manage)\b|תזמ|קבע|תזכיר|לחדש|להגיש|להירשם|לבטל|להזמין|לקנות|לשלם|לתכנן|תמצא|תפתח|תתחיל|תיצור|תשלח|תתקשר|אני רוצה|אני צריך|תעזור|תטפל/i;
function isPureQuestion(text: string): boolean {
  const t = text.trim();
  const looksLikeQuestion = QUESTION_OPENERS.test(t) || /\?\s*$/.test(t);
  return looksLikeQuestion && !ACTION_VERBS.test(t);
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
// Map a regulated-domain question to the official source ONE should answer from.
const SOURCE_INTENT: { key: string; re: RegExp }[] = [
  {
    key: "licensing",
    re: /\b(driv|licen[sc]e|theory test|road test|vehicle|car registration)\b|רישיון נהיגה|רשיון נהיגה|תאוריה|טסט|רכב|רישוי/i,
  },
  {
    key: "nii",
    re: /\b(national insurance|social security|child allowance|disability|unemployment|maternity)\b|ביטוח לאומי|קצבה|דמי לידה|אבטלה|נכות|הבטחת הכנסה/i,
  },
  {
    key: "health",
    re: /\b(vaccin|health fund|kupat|prescription|medical exemption|ministry of health)\b|קופת חולים|חיסון|מרשם|משרד הבריאות|ועדה רפואית/i,
  },
  {
    key: "gov",
    re: /\b(passport|id card|teudat|population registry|residency|visa|apostille)\b|דרכון|תעודת זהות|מרשם אוכלוסין|תושבות|אשרה|אפוסטיל|משרד הפנים/i,
  },
];
function sourceForText(text: string): Source | null {
  for (const s of SOURCE_INTENT)
    if (s.re.test(text)) return SOURCE_CATALOG.find((c) => c.key === s.key) ?? null;
  return null;
}

// ── Forms — templates ONE fills WITH you (you type your own details; ONE never
//    invents PII). The filled form becomes a reviewable draft in the process.
interface FormField {
  key: string;
  en: string;
  he: string;
}
interface FormTemplate {
  key: string;
  en: string;
  he: string;
  re: RegExp;
  fields: FormField[];
}
const CONTACT_FIELDS: FormField[] = [
  { key: "fullName", en: "Full name", he: "שם מלא" },
  { key: "id", en: "ID number", he: "תעודת זהות" },
  { key: "address", en: "Address", he: "כתובת" },
  { key: "phone", en: "Phone", he: "טלפון" },
];
const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: "license",
    en: "Driving licence renewal",
    he: "חידוש רישיון נהיגה",
    re: /driv|licen[sc]e|רישיון נהיגה|רשיון נהיגה/i,
    fields: [...CONTACT_FIELDS, { key: "licenseNo", en: "Licence number", he: "מספר רישיון" }],
  },
  {
    key: "passport",
    en: "Passport application",
    he: "בקשה לדרכון",
    re: /passport|דרכון/i,
    fields: [...CONTACT_FIELDS, { key: "birthDate", en: "Date of birth", he: "תאריך לידה" }],
  },
  {
    key: "nii",
    en: "National Insurance claim",
    he: "תביעה לביטוח לאומי",
    re: /national insurance|allowance|claim|ביטוח לאומי|קצבה|תביעה/i,
    fields: [...CONTACT_FIELDS, { key: "claimType", en: "Claim type", he: "סוג התביעה" }],
  },
];
function formForText(text: string): { en: string; he: string; fields: FormField[] } {
  return (
    FORM_TEMPLATES.find((f) => f.re.test(text)) ?? {
      en: "Form",
      he: "טופס",
      fields: [...CONTACT_FIELDS, { key: "email", en: "Email", he: "אימייל" }],
    }
  );
}

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

// Candidate topics to illustrate a unit with — the title (minus its leading
// verb), its last words, and its type. UnitDetail fetches a Wikipedia image for
// each and rotates through whichever resolve, so a "Trip to Santorini" shows
// Santorini and a "Learn Krav Maga" shows Krav Maga.
function unitImageTerms(p: Process): string[] {
  const cleaned = p.title
    .replace(
      /^(learn|study|plan(?:ning)?|book|get|find|renew|apply(?: for)?|buy|sell|start|open|move(?: to)?|trip to|travel to|fly to|visit|organi[sz]e|prepare(?: for)?)\s+/i,
      "",
    )
    .replace(/["'?!.]/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const terms = [
    cleaned,
    words.slice(-2).join(" "),
    words[words.length - 1] ?? "",
    p.type ?? "",
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return Array.from(new Set(terms)).slice(0, 4);
}

// A broad, image-friendly topic for a unit — Wikipedia rarely has an article for
// a ONE-written action title like "Organize Apartment Move", but Wikimedia
// Commons has thousands of photos for the KIND of thing it is. Map the process
// to a category keyword so the cover always has something on-topic to show.
const UNIT_IMAGE_CATEGORY: { re: RegExp; q: string }[] = [
  { re: /\b(mov(e|ing)|relocat|apartment|flat|tenant|lease)\b|דיר|מעבר|שכיר/i, q: "living room interior" },
  { re: /\b(trip|travel|flight|vacation|holiday|tour|abroad|hotel)\b|טיול|חופש|נסיע|טיס/i, q: "tropical beach coastline" },
  { re: /\b(learn|stud|course|class|lesson|tutor|exam|skill|language)\b|למד|קורס|שיעור|מבחן|תרגול/i, q: "open book library" },
  { re: /\b(driv|licen[cs]e|car|vehicle)\b|רישיון|נהיג|רכב|מכונית/i, q: "highway car sunset" },
  { re: /\b(fitness|weight|gym|workout|run|diet|muscle|health goal)\b|כושר|משקל|אימון|דיאט|שריר/i, q: "gym dumbbell training" },
  { re: /\b(wedding|marri|engag|bride|groom)\b|חתונ|נישואי|אירוסי/i, q: "wedding bride bouquet" },
  { re: /\b(job|career|cv|resume|interview|hir|employ)\b|עבוד|קריירה|ראיון|קורות חיים/i, q: "modern office desk laptop" },
  { re: /\b(passport|visa|immigrat|citizen)\b|דרכון|ויזה|הגיר|אזרח/i, q: "passport airport departure" },
  { re: /\b(doctor|medical|clinic|hospital|dentist|surg|therap)\b|רופא|בריאות|מרפאה|בית חולים|טיפול/i, q: "stethoscope medical clinic" },
  { re: /\b(tax|account|budget|invoice|loan|mortgage|financ|salary)\b|מס|חשבונ|תקציב|הלווא|משכנת|כספ/i, q: "calculator coins desk" },
  { re: /\b(renovat|remodel|home improve|furnitur|kitchen|bathroom)\b|שיפוץ|ריהוט|מטבח/i, q: "modern kitchen interior" },
  { re: /\b(baby|newborn|child|kid|nursery|parent)\b|תינוק|ילד|הורות/i, q: "baby nursery crib" },
  { re: /\b(pet|dog|cat|puppy|kitten|vet)\b|חיית מחמד|כלב|חתול/i, q: "dog park outdoor" },
  { re: /\b(event|party|celebrat|birthday|conference)\b|אירוע|מסיב|כנס|יום הולדת/i, q: "birthday balloons celebration" },
  { re: /\b(business|client|lead|startup|company|market)\b|עסק|לקוח|חברה|שיווק/i, q: "business meeting office table" },
  { re: /\b(food|restaurant|cook|recipe|meal|cater)\b|אוכל|מסעד|בישול|מתכון/i, q: "restaurant food plate" },
];
function unitCategoryQuery(p: Process): string {
  const hay = `${p.title} ${p.type ?? ""} ${p.summary ?? ""}`;
  const hit = UNIT_IMAGE_CATEGORY.find((c) => c.re.test(hay));
  if (hit) return hit.q;
  // No category — fall back to the cleaned title as a plain search.
  return unitImageTerms(p)[0] ?? p.title;
}

// Wikimedia Commons image search — keyless + CORS-friendly (origin=*), with far
// broader coverage than an article summary. Returns up to `limit` landscape
// thumbnails for a topic. Silent (empty) on any miss.
async function commonsImages(query: string, limit = 3): Promise<string[]> {
  // Skip scanned artwork / diagrams / heraldry that read as "old" not "photo".
  const NON_PHOTO =
    /painting|drawing|sketch|engrav|lithograph|etching|portrait of|\bmap\b|diagram|chart|logo|icon|coat[_ ]of[_ ]arms|\bseal\b|\bflag\b|stamp|poster|illustration|manuscript|fresco|mural/i;
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=" +
      encodeURIComponent(`filetype:bitmap ${query}`) +
      "&prop=imageinfo&iiprop=url&iiurlwidth=1000";
    const res = await fetch(url);
    if (!res.ok) return [];
    const j = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string }[] }> };
    };
    const pages = j.query?.pages ? Object.values(j.query.pages) : [];
    const photos = pages
      .filter((pg) => !NON_PHOTO.test(pg.title ?? ""))
      .map((pg) => pg.imageinfo?.[0]?.thumburl)
      .filter((u): u is string => typeof u === "string");
    // Fall back to unfiltered if the filter left us with nothing.
    const all = pages
      .map((pg) => pg.imageinfo?.[0]?.thumburl)
      .filter((u): u is string => typeof u === "string");
    return (photos.length ? photos : all).slice(0, limit);
  } catch {
    return [];
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
  current: "נוכחי",
  target: "יעד",
  progress: "התקדמות",
  "cal / day": "קלוריות ליום",
  "cal/day": "קלוריות ליום",
  "workouts / wk": "אימונים בשבוע",
  "workouts/wk": "אימונים בשבוע",
  weight: "משקל",
  amount: "סכום",
  quote: "הצעת מחיר",
  slot: "משבצת",
  lesson: "שיעור",
  test: "מבחן",
  next: "הבא",
  "next session": "מפגש הבא",
  activities: "פעילויות",
  "total cost": "עלות כוללת",
  "days until departure": "ימים ליציאה",
  "number of activities planned": "פעילויות מתוכננות",
  "activities planned": "פעילויות מתוכננות",
  distance: "מרחק ליעד",
  style: "סגנון",
  guests: "אורחים",
  age: "גיל",
  venue: "מקום",
  size: "גודל",
  level: "רמה",
  goal: "מטרה",
  frequency: "תדירות",
  duration: "משך",
  theme: "נושא",
  count: "כמות",
};
const VALUE_HE: Record<string, string> = {
  "in progress": "בתהליך",
  confirmed: "מאושר",
  paid: "שולם",
  pending: "ממתין",
  done: "הושלם",
  booked: "נקבע",
  "not started": "טרם התחיל",
  scheduled: "מתוזמן",
  ready: "מוכן",
  "on track": "במסלול",
  active: "פעיל",
  completed: "הושלם",
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

// The join link for a shared unit + a one-tap copy. Anyone who opens it lands in
// the same room and can correspond there alongside ONE.
function ShareLink({ code, lang }: { code: string; lang: "en" | "he" }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://one01.io";
  const link = `${origin}/app?join=${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="sr-link">
      <code className="sr-link-code">{link}</code>
      <button className="sr-copy" onClick={copy}>
        {copied ? (lang === "he" ? "הועתק" : "Copied") : lang === "he" ? "העתק" : "Copy"}
      </button>
    </div>
  );
}

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
  onWorkStep,
  onAddConnection,
  onCover,
  onStepImage,
  imagesOn = true,
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
  /** Tap a next-step → ONE works on it with you in the chat (not a checkbox). */
  onWorkStep: (p: Process, label: string) => void;
  /** "+ add connection" → ONE suggests relevant people/providers in the chat. */
  onAddConnection: (p: Process) => void;
  /** Persist a generated cover image onto the unit (reusable stock). */
  onCover?: (procId: string, url: string) => void;
  /** Persist a generated image for a specific step (reusable stock). */
  onStepImage?: (procId: string, stepIndex: number, url: string) => void;
  /** When false, no AI image generation happens (cost switch). */
  imagesOn?: boolean;
}) {
  const sources = unitSources(p);
  const he = lang === "he";
  const S = UNIT_SECTION[lang];
  const locMetric = (s: string) => (he ? METRIC_LABEL_HE[s.trim().toLowerCase()] ?? s : s);
  const locValue = (s: string) => (he ? VALUE_HE[s.trim().toLowerCase()] ?? s : s);
  const locAction = (s: string) => (he ? ACTION_HE[s.trim().toLowerCase()] ?? s : s);
  // Timeline stamps ("now" / "Today" / "3 days ago" / weekday) → Hebrew.
  const locTime = (at: string): string => {
    if (!he) return at;
    const s = at.trim().toLowerCase();
    const direct: Record<string, string> = {
      now: "עכשיו",
      today: "היום",
      yesterday: "אתמול",
      tomorrow: "מחר",
      sun: "א׳",
      mon: "ב׳",
      tue: "ג׳",
      wed: "ד׳",
      thu: "ה׳",
      fri: "ו׳",
      sat: "ש׳",
    };
    if (direct[s]) return direct[s];
    let m = s.match(/^(\d+)\s*days?\s*ago$/);
    if (m) return `לפני ${m[1]} ימים`;
    m = s.match(/^(\d+)\s*(?:h|hours?|hrs?)\s*ago$/);
    if (m) return `לפני ${m[1]} שעות`;
    m = s.match(/^(\d+)\s*min(?:ute)?s?\s*ago$/);
    if (m) return `לפני ${m[1]} דקות`;
    m = s.match(/^(\d+)\s*weeks?\s*ago$/);
    if (m) return `לפני ${m[1]} שבועות`;
    return at;
  };
  // A tiny emoji that matches what the action DOES — so chips read at a glance.
  const qaEmoji = (label: string): string => {
    const l = label.toLowerCase();
    if (/theor|תאורי|מבחן|quiz|למד|learn|study|תרגול|practice/.test(l)) return "📖";
    if (/book|schedul|appointment|תור|לקבוע|reschedul|slot/.test(l)) return "📅";
    if (/pay|תשלום|שלם|invoice|חשבונית|fee|אגרה/.test(l)) return "💳";
    if (/messag|email|מייל|הודעה|reply|תגוב|send|שלח|פנ/.test(l)) return "✉️";
    if (/call|phone|התקשר|טלפון/.test(l)) return "📞";
    if (/doc|upload|form|טופס|מסמך|העלה|scan|סרוק/.test(l)) return "📄";
    if (/remind|תזכור|תזכורת/.test(l)) return "⏰";
    if (/lesson|driv|שיעור|נהיג/.test(l)) return "🚗";
    if (/log|track|רשום|מעקב|weigh|משקל/.test(l)) return "📊";
    return "⚡";
  };
  const sig = (s: string) =>
    s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  // Quick actions whose work is already DONE (a matching step is ticked) drop
  // off — e.g. once "theory" is passed, "practice theory" disappears.
  const doneWords = new Set(p.steps.flatMap((s, i) => (isStepDone(p, i) ? sig(s.label) : [])));
  const liveQuickActions = (p.quickActions ?? []).filter(
    (a) => !sig(a).some((w) => doneWords.has(w)),
  );
  // The unit's own little broadcast — tips / news / what-to-know for THIS
  // process — rotating above the metrics.
  const brief = [p.nextAction, ...(p.insights ?? [])].filter(Boolean) as string[];
  // Progress toward done — the card's emotional core. Prefer the curated
  // done/total when present, else count ticked steps live.
  const stepsDone = p.steps.filter((_, i) => isStepDone(p, i)).length;
  const prog = p.progress ?? { done: stepsDone, total: p.steps.length };
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  const [briefIdx, setBriefIdx] = useState(0);
  useEffect(() => {
    if (brief.length < 2) return;
    const id = window.setInterval(() => setBriefIdx((i) => (i + 1) % brief.length), 4200);
    return () => window.clearInterval(id);
  }, [brief.length]);

  // Contextual cover — fetch a few Wikipedia images for this unit's topic and
  // cross-fade between whichever resolve. Silent + graceful: no band if none.
  const [covers, setCovers] = useState<string[]>(p.coverImage ? [p.coverImage] : []);
  const [coverIdx, setCoverIdx] = useState(0);
  useEffect(() => {
    let alive = true;
    // Already have a generated stock image? Use it, no work.
    if (p.coverImage) {
      setCovers([p.coverImage]);
      setCoverIdx(0);
      return;
    }
    setCovers([]);
    setCoverIdx(0);
    (async () => {
      // ONE draws the unit's cover: it asks the AI to GENERATE a clean, on-topic
      // image (stored once as canonical "stock" and reused instantly next time).
      // If image generation isn't available, fall back to a Wikipedia / Wikimedia
      // photo so there's always a cover.
      const topicKey = `unit:${(p.type ?? "").toLowerCase()}:${p.title.trim().toLowerCase()}`;
      const genPrompt = `A clean, modern, minimal editorial cover image that visually represents the goal: "${p.title}". Calm, tasteful, magazine-quality. No text, no words, no letters, no logos, no watermark.`;
      const gen = imagesOn ? await generateImage(genPrompt, topicKey) : null;
      if (!alive) return;
      if (gen) {
        setCovers([gen]);
        onCover?.(p.id, gen); // persist to the unit → becomes reusable stock
        return;
      }
      const wiki = (await Promise.all(unitImageTerms(p).map((tm) => wikiThumbnail(tm)))).filter(
        Boolean,
      ) as string[];
      let urls = wiki;
      if (urls.length === 0) urls = await commonsImages(unitCategoryQuery(p));
      if (!alive) return;
      setCovers(Array.from(new Set(urls)).slice(0, 3));
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // onCover is a stable persist callback; keying on the unit's identity/cover
    // is what should re-run generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, p.title, p.type, p.coverImage]);
  useEffect(() => {
    if (covers.length < 2) return;
    const id = window.setInterval(() => setCoverIdx((i) => (i + 1) % covers.length), 5200);
    return () => window.clearInterval(id);
  }, [covers.length]);

  // Mouse parallax — the metric row drifts toward the pointer, each metric with
  // its own depth, so the stats feel like they float over the cover.
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  const onParallax = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMx(((e.clientX - r.left) / r.width) * 2 - 1);
    setMy(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const resetParallax = () => {
    setMx(0);
    setMy(0);
  };
  // Generate a picture for a specific step, on demand — stored as reusable stock
  // (same ai-image function + topic-keyed cache as the cover).
  const [stepBusy, setStepBusy] = useState<number | null>(null);
  const genStepImage = async (i: number, label: string) => {
    if (!imagesOn || stepBusy !== null) return;
    setStepBusy(i);
    const key = `step:${(p.type ?? "").toLowerCase()}:${p.title.trim().toLowerCase()}:${label.trim().toLowerCase()}`;
    const prompt = `A clean, minimal illustrative image for the task "${label}" (part of "${p.title}"). Tasteful, no text, no words, no letters, no logos.`;
    const url = await generateImage(prompt, key);
    setStepBusy(null);
    if (url) onStepImage?.(p.id, i, url);
  };
  return (
    <div className="unit-detail-body" onMouseMove={onParallax} onMouseLeave={resetParallax}>
      {covers.length > 0 && (
        <div className="unit-cover" aria-hidden="true">
          {covers.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              className={`unit-cover-img${i === coverIdx ? " is-on" : ""}`}
              src={src}
              alt=""
              loading="lazy"
              style={{ transform: `translate(${mx * -10}px, ${my * -6}px) scale(1.08)` }}
            />
          ))}
          <span className="unit-cover-fade" />
        </div>
      )}

      {prog.total > 0 && (
        <div className="unit-progress">
          <div className="unit-progress-head">
            <span className="unit-progress-pct">{pct}%</span>
            <span className="unit-progress-sub">
              {he
                ? `${prog.done} מתוך ${prog.total} שלבים${pct >= 100 ? " · הושלם" : ""}`
                : `${prog.done} of ${prog.total} steps${pct >= 100 ? " · done" : ""}`}
            </span>
          </div>
          <div className="unit-progress-track">
            <span className="unit-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {brief.length > 0 && (
        <div className="unit-broadcast" aria-live="polite" key={briefIdx}>
          <span className="unit-live-dot" aria-hidden="true" />
          {brief[briefIdx % brief.length]}
        </div>
      )}

      {p.metrics && p.metrics.length > 0 && (
        <div className="metric-row">
          {p.metrics.map((m, i) => {
            const depth = 4 + i * 3;
            return (
              <div
                className="metric"
                key={m.label}
                style={{ transform: `translate(${mx * depth}px, ${my * (depth * 0.4)}px)` }}
              >
                <div className="metric-value">{locValue(m.value)}</div>
                <div className="metric-label">{locMetric(m.label)}</div>
              </div>
            );
          })}
        </div>
      )}

      {liveQuickActions.length > 0 && (
        <div className="qa-row">
          {liveQuickActions.map((a) => (
            <button key={a} className="qa-btn" onClick={() => runQuickAction(p, a)}>
              <span aria-hidden="true">{qaEmoji(a)}</span> {locAction(a)}
            </button>
          ))}
        </div>
      )}

      <div className="sheet-section">
        <h4>{S.nextSteps}</h4>
        {p.steps.map((s, i) => {
          const done = isStepDone(p, i);
          return (
            // The row is not a checklist — tapping it puts ONE to work on that
            // step with you in the chat. The circle on the left is the manual
            // "mark done" toggle (kept for when you finished it yourself).
            <div key={i} className={`step-item${done ? " done" : ""}`}>
              <button
                className={`step-check${done ? " done" : ""}`}
                onClick={() => toggleStep(p, i)}
                aria-label={done ? "Mark not done" : "Mark done"}
              >
                {done ? "✓" : ""}
              </button>
              <button
                className="step-work"
                onClick={() => onWorkStep(p, s.label)}
                disabled={done}
              >
                <span className="step-text">{s.label}</span>
                {!done && <span className="step-go" aria-hidden="true">→</span>}
              </button>
              {p.stepImages?.[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="step-img" src={p.stepImages[i]} alt="" loading="lazy" />
              ) : imagesOn ? (
                <button
                  className="step-img-btn"
                  onClick={() => void genStepImage(i, s.label)}
                  disabled={stepBusy !== null}
                  aria-label={he ? "צור תמונה לשלב" : "Generate an image for this step"}
                  title={he ? "צור תמונה" : "Generate image"}
                >
                  {stepBusy === i ? (
                    <span className="step-img-spin" aria-hidden="true" />
                  ) : (
                    <i className="fi fi-rr-picture" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sheet-section">
        <div className="prof-sec-head">
          <h4>{S.connections}</h4>
          <button className="conn-add-btn" onClick={() => onAddConnection(p)}>
            + {he ? "הוסף חיבור" : "Add connection"}
          </button>
        </div>
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
              <b style={{ fontWeight: 600 }}>{locTime(ev.at)}</b> — {ev.text}
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
    connectionsNav: "Connections",
    connectionsNavSub: "Everyone your ONE is dealing with — businesses, people, contacts you keep.",
    connBusinesses: "Businesses",
    connBizEmpty: "No connected businesses yet — they appear here once a process is with one.",
    connPeople: "People in your processes",
    connPeopleEmpty: "People show up here as your processes gather them.",
    connMine: "My contacts",
    connAddPlaceholder: "Add a name",
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
    wSuppliers: "Suppliers",
    wCompliance: "Compliance",
    wMarketing: "Marketing",
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
    connectionsNav: "חיבורים",
    connectionsNavSub: "כל מי שה‑ONE שלך מתעסק איתו — עסקים, אנשים, ואנשי קשר שאתה שומר.",
    connBusinesses: "עסקים",
    connBizEmpty: "עדיין אין עסקים מחוברים — הם יופיעו כאן ברגע שתהליך מתנהל מול אחד.",
    connPeople: "אנשים בתהליכים שלך",
    connPeopleEmpty: "אנשים יופיעו כאן ככל שהתהליכים שלך אוספים אותם.",
    connMine: "אנשי הקשר שלי",
    connAddPlaceholder: "הוסף שם",
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
    wSuppliers: "ספקים",
    wCompliance: "רגולציה",
    wMarketing: "שיווק",
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
  "suppliers",
  "compliance",
  "marketing",
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
  suppliers: "📦",
  compliance: "📋",
  marketing: "📣",
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
  suppliers: "wSuppliers",
  compliance: "wCompliance",
  marketing: "wMarketing",
};
function worldOf(category: string): WorldKey {
  const c = category.toLowerCase();
  // Business-facing worlds first — a supplier/accountant/agency shouldn't be
  // mislabelled a consumer "community" business.
  if (/(supplier|wholesale|manufactur|distribut|logistics|packaging|materials|parts|inventory)/.test(c))
    return "suppliers";
  if (/(account|bookkeep|legal|lawyer|compliance|audit|payroll|regulat|licens|permit|tax advisor)/.test(c))
    return "compliance";
  if (/(marketing|advertis|agency|branding|design|seo|social media|pr|content|studio\b)/.test(c))
    return "marketing";
  if (/(gym|fitness|health|clinic|doctor|dentist|wellness|therap|medic|pharma|nutrition)/.test(c)) return "health";
  if (/(instructor|teacher|school|course|tutor|driving|lesson|academ|learn)/.test(c)) return "learning";
  if (/(salon|hair|nail|beauty|spa|barber|entertain|game|sport|travel|tour|leisure|event)/.test(c)) return "leisure";
  if (/(bank|finance|insur|invest|loan|mortgage)/.test(c)) return "finance";
  if (/(mov|clean|repair|plumb|electr|renov|construct|handyman|home|garden)/.test(c)) return "home";
  if (/(restaurant|cafe|food|bakery|cater|grocery|deli|coffee)/.test(c)) return "food";
  return "community";
}
// Each world is consumer-facing, business-facing, or both. A business profile
// shouldn't be shown consumer worlds like Health — different hat, different net.
type WorldScope = "consumer" | "business" | "both";
const WORLD_SCOPE: Record<WorldKey, WorldScope> = {
  health: "consumer",
  learning: "consumer",
  leisure: "consumer",
  food: "consumer",
  finance: "both",
  home: "both",
  community: "both",
  suppliers: "business",
  compliance: "business",
  marketing: "business",
};
// The lens each profile kind sees the app through — which Global worlds show,
// and how "home" reads. One source of truth; the UI reads from it.
const PROFILE_LENS: Record<
  "personal" | "business" | "supplier",
  { worldScopes: WorldScope[]; homeMode: "compose" | "inbox" }
> = {
  personal: { worldScopes: ["consumer", "both"], homeMode: "compose" },
  business: { worldScopes: ["business", "both"], homeMode: "compose" },
  supplier: { worldScopes: ["business", "both"], homeMode: "inbox" },
};

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
  // Profiles ("identities") are stateful so you can add your own — personal,
  // business, or a supplier (provider) seat for two-sided testing. Persisted.
  const [identities, setIdentities] = useState<Identity[]>(IDENTITIES);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_identities");
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length) setIdentities(saved);
    } catch {
      /* first run / blocked storage */
    }
  }, []);
  const persistIdentities = (next: Identity[]) => {
    setIdentities(next);
    try {
      localStorage.setItem("one_identities", JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const [newProfileName, setNewProfileName] = useState("");
  const createIdentity = (kind: "personal" | "business" | "supplier", name: string) => {
    const n = name.trim();
    if (!n) return;
    const emoji = kind === "business" ? "🏢" : kind === "supplier" ? "🏪" : "👤";
    const role = kind === "business" ? "Business" : kind === "supplier" ? "Supplier" : "Personal";
    const id = `id_${Date.now()}`;
    persistIdentities([...identities, { id, name: n, role, emoji, kind }]);
    setActiveIdentityId(id);
    setNewProfileName("");
    setOpenSheet(null);
    setProfilesOpen(false);
  };
  const [activeIdentityId, setActiveIdentityId] = useState(IDENTITIES[0].id);
  const [openSheet, setOpenSheet] = useState<null | "settings" | "subscription" | "newProfile">(
    null,
  );
  // The two-sided loop: requests that crossed profiles, landing in a supplier
  // profile's inbox. Persisted; seeded once so a supplier seat has something to
  // answer the first time you switch to it.
  const [requests, setRequests] = useState<InboundRequest[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_requests");
      if (raw) {
        setRequests(JSON.parse(raw));
        return;
      }
    } catch {
      /* fall through to seed */
    }
    setRequests([
      {
        id: "req_seed",
        toProfileId: "supplier_demo",
        fromName: "Ariel",
        title: "Appointment request",
        message: "Hi — I'd like to book a first session this week. Mornings work best. What have you got?",
        status: "new",
        at: "now",
      },
    ]);
  }, []);
  const persistRequests = (next: InboundRequest[]) => {
    setRequests(next);
    try {
      localStorage.setItem("one_requests", JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const sendRequest = (
    toProfileId: string,
    title: string,
    message: string,
    fromName: string,
    opts?: { fromProfileId?: string; procId?: string },
  ) =>
    persistRequests([
      {
        id: `req_${Date.now()}`,
        toProfileId,
        fromName,
        fromProfileId: opts?.fromProfileId,
        procId: opts?.procId,
        title,
        message,
        status: "new",
        at: "now",
      },
      ...requests,
    ]);
  const updateRequest = (id: string, patch: Partial<InboundRequest>) =>
    persistRequests(requests.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  // Per-request reply text the supplier is composing in the inbox.
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Reminders ONE holds for you — set from "remind me…" or created when a
  // booking is confirmed. Persisted; surfaced on Home when pending.
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_reminders");
      if (raw) setReminders(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persistReminders = (next: Reminder[]) => {
    setReminders(next);
    try {
      localStorage.setItem("one_reminders", JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const addReminder = (identityId: string, text: string, at: string, procId?: string) =>
    persistReminders([
      { id: `rem_${Date.now()}_${Math.round(performance.now())}`, identityId, text, at, procId, done: false },
      ...reminders,
    ]);
  const toggleReminder = (id: string) =>
    persistReminders(reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  const dismissReminder = (id: string) => persistReminders(reminders.filter((r) => r.id !== id));
  // The main canvas shows one of three "spaces": the ONE home (broadcast +
  // input), the Global marketplace, or the ONE profile — all on-canvas, no
  // popups. A segmented toggle flips Home ⇄ Global; the drawer opens Profile.
  const [space, setSpace] = useState<"home" | "global" | "profile" | "connections" | "inbox">(
    "home",
  );
  const [world, setWorld] = useState<"all" | WorldKey>("all");
  // Switching profile resets the Global world tab — a consumer tab shouldn't
  // linger when you flip to a business hat that can't see it.
  useEffect(() => {
    setWorld("all");
  }, [activeIdentityId]);
  // Appearance + language. Persisted; dark defaults to the OS preference.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<UILang>("en");
  // Cost switches — turn the paid AI extras off during testing so they don't
  // burn credits. Default on; persisted. (Chat text always works.)
  const [aiImages, setAiImages] = useState(true);
  const [aiVoice, setAiVoice] = useState(true);
  const [aiWeb, setAiWeb] = useState(true);
  // ONE mirrors the language the user actually wrote in — not the app's UI
  // setting. So every line ONE composes locally (greetings, plan confirmations,
  // offline fallbacks) follows the message, and never replies in English to a
  // Hebrew message. Falls back to the UI language when the text has no letters.
  const msgLang = (text: string): UILang =>
    /[֐-׿]/.test(text) ? "he" : /[A-Za-z]/.test(text) ? "en" : lang;
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("one_theme");
      const savedLang = localStorage.getItem("one_lang");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
      if (savedLang === "he" || savedLang === "en") setLang(savedLang);
      if (localStorage.getItem("one_ai_images") === "0") setAiImages(false);
      if (localStorage.getItem("one_ai_voice") === "0") setAiVoice(false);
      if (localStorage.getItem("one_ai_web") === "0") setAiWeb(false);
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
  const applyAiImages = (v: boolean) => {
    setAiImages(v);
    try { localStorage.setItem("one_ai_images", v ? "1" : "0"); } catch {}
  };
  const applyAiVoice = (v: boolean) => {
    setAiVoice(v);
    try { localStorage.setItem("one_ai_voice", v ? "1" : "0"); } catch {}
  };
  const applyAiWeb = (v: boolean) => {
    setAiWeb(v);
    try { localStorage.setItem("one_ai_web", v ? "1" : "0"); } catch {}
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
  // ── Live voice call with ONE (Realtime) — a full-screen call view ──────────
  const [voiceCall, setVoiceCall] = useState<RealtimeHandle | null>(null);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceCaption, setVoiceCaption] = useState("");
  const voiceCallRef = useRef<RealtimeHandle | null>(null);
  // The call rides along as a movable bubble (not a full-screen takeover) so ONE
  // keeps working in the product WHILE you talk — drag it anywhere, or collapse
  // it to just the orb. `voicePos` is null until the first drag (CSS-anchored).
  const [voicePos, setVoicePos] = useState<{ x: number; y: number } | null>(null);
  const [voiceMini, setVoiceMini] = useState(false);
  const voiceBubbleRef = useRef<HTMLDivElement | null>(null);
  const voiceDragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  // A voice-call turn (yours or ONE's) becomes a real, persisted chat message —
  // routed to the open unit's thread, or the home chat if none is open.
  const pushCallMsg = (role: "user" | "one", text: string) => {
    const t = text.trim();
    if (!t) return;
    const msg: ChatMsg = { role, text: t };
    setVoiceCaption(t);
    const uid = activeUnitRef.current;
    if (uid) {
      setUnitChat((c) => [...c, msg]);
      setUnits((list) =>
        list.map((u) => (u.id === uid ? { ...u, chat: [...(u.chat ?? []), msg] } : u)),
      );
    } else {
      setChat((c) => [...c, msg]);
    }
  };
  const startVoiceCall = async () => {
    if (!aiVoice || voiceCallRef.current || voiceConnecting) return;
    setVoiceConnecting(true);
    setVoiceMuted(false);
    setVoiceSpeaking(false);
    setVoiceCaption("");
    const h = await startRealtime({
      instructions:
        "You are ONE — a warm, concise personal representative on a live voice call. " +
        "Keep replies short and natural. Match the user's language: reply in Hebrew when they speak Hebrew and English when they speak English, and switch fluidly. " +
        "You are actively setting up and running the user's processes as you talk: when they state a goal, briefly confirm you're on it, then ask ONE short tailoring question at a time (budget, date, who's involved) — don't lecture or repeat back everything. Open with a brief spoken hello.",
      // Your spoken turn runs through the SAME pipeline as a typed message, so
      // ONE actually builds/fills a process while you talk (routed to the open
      // unit, or the home flow if none). ONE's own spoken words show as the live
      // caption only — the structured reply lands in the thread from the pipeline.
      onUserText: (t) => {
        const clean = t.trim();
        if (!clean) return;
        setVoiceCaption(clean);
        if (activeUnitRef.current) void sendToUnit(clean);
        else void send(clean);
      },
      onAssistantText: (t) => setVoiceCaption(t.trim()),
      onSpeaking: (s) => setVoiceSpeaking(s),
      onClose: () => {
        voiceCallRef.current = null;
        setVoiceCall(null);
        setVoiceConnecting(false);
        setVoiceSpeaking(false);
      },
    });
    if (!h) {
      setVoiceConnecting(false);
      return;
    }
    voiceCallRef.current = h;
    setVoiceCall(h);
    setVoiceConnecting(false);
  };
  const endVoiceCall = () => {
    voiceCallRef.current?.stop();
    voiceCallRef.current = null;
    setVoiceCall(null);
    setVoiceConnecting(false);
    setVoiceSpeaking(false);
    setVoiceCaption("");
    setVoicePos(null);
    setVoiceMini(false);
  };
  const toggleVoiceMute = () => {
    const next = !voiceMuted;
    setVoiceMuted(next);
    voiceCallRef.current?.setMuted(next);
  };
  // ── Drag the call bubble anywhere on screen (pointer-based, corner-clamped) ──
  const onBubbleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start a drag from a control — let the button do its job.
    if ((e.target as HTMLElement).closest("button")) return;
    const el = voiceBubbleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    voiceDragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onBubbleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = voiceDragRef.current;
    if (!d) return;
    d.moved = true;
    const el = voiceBubbleRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 120;
    const x = Math.min(Math.max(8, e.clientX - d.dx), window.innerWidth - w - 8);
    const y = Math.min(Math.max(8, e.clientY - d.dy), window.innerHeight - h - 8);
    setVoicePos({ x, y });
  };
  const onBubbleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    voiceDragRef.current = null;
    voiceBubbleRef.current?.releasePointerCapture?.(e.pointerId);
  };
  // Which side of the process thread to show — the whole back-and-forth lives
  // here (you ⇄ ONE ⇄ the other party), and this filters it to one voice.
  const [threadFilter, setThreadFilter] = useState<"all" | "you" | "one" | "them">("all");
  // Your connections — people you add by hand. Businesses & process-people are
  // derived live from your data; these are the extra contacts you keep yourself.
  const [contacts, setContacts] = useState<string[]>([]);
  const [contactDraft, setContactDraft] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("one_contacts");
      if (raw) setContacts(JSON.parse(raw));
    } catch {
      /* first run / blocked storage */
    }
  }, []);
  const persistContacts = (next: string[]) => {
    setContacts(next);
    try {
      localStorage.setItem("one_contacts", JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const addContact = (name: string) => {
    const n = name.trim();
    if (!n || contacts.includes(n)) return;
    persistContacts([...contacts, n]);
    setContactDraft("");
  };
  const removeContact = (name: string) => persistContacts(contacts.filter((c) => c !== name));
  // A business's ONE "reaches out" at most ONCE per process — otherwise the
  // "the provider got back to me…" line repeats on every follow-up and reads
  // robotic. Track which processes have already had their outreach.
  const outreachDoneRef = useRef<Set<string>>(new Set());
  // Which unit is open right now — read by delayed work (e.g. the process plan)
  // so a late message lands on the unit only if you're still in it.
  const activeUnitRef = useRef<string | null>(null);
  // The home is a vertical scroll of two surfaces — the ONE surface (rest, top)
  // and Updates (down). Global lives above as a rising overlay sheet, reached by
  // scrolling up at the top (or the ↑ chevron), exactly like the landing hero.
  const homePageRef = useRef<HTMLDivElement>(null);
  const [globalOpen, setGlobalOpen] = useState(false);
  const pgPanelRef = useRef<HTMLDivElement>(null);
  // The capabilities ONE has switched on (persisted locally). Toggled from the
  // profile; enabled from Global's "add a capability".
  const [caps, setCaps] = useState<string[]>(["booking", "reminders", "providers"]);
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
    /** When set, the quiz runs INSIDE this process's thread (not the home chat),
     *  and passing it updates the process (ticks a learning step, logs it). */
    procId?: string;
  } | null>(null);
  // A running intake interview — ONE asks the user to tailor a process, one
  // question at a time, with tappable choices (they can also type). Answers
  // accumulate; when ONE has enough it writes a tailored plan and starts leading.
  const [intake, setIntake] = useState<{
    procId: string;
    topic: string;
    field: string;
    question: string;
    answers: { field: string; question: string; answer: string }[];
    asked: number;
  } | null>(null);
  const intakeRef = useRef<typeof intake>(null);
  useEffect(() => {
    intakeRef.current = intake;
  }, [intake]);
  // The chat figure "pumps" — a quick scale pop on every keystroke, so ONE feels
  // alive and reacting to you letter by letter. Uses the Web Animations API on a
  // ref so it never remounts the Orb (which would kill its blink).
  const unitPresenceRef = useRef<HTMLSpanElement>(null);
  const homePresenceRef = useRef<HTMLSpanElement>(null);
  const pumpPresence = (ref: { current: HTMLSpanElement | null }) => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
      { duration: 200, easing: "cubic-bezier(.34,1.4,.5,1)" },
    );
  };
  // Live form the user is filling (the "Form filling" capability). You type your
  // own values; ONE never invents them. Singular, like the quiz.
  const [activeForm, setActiveForm] = useState<{
    title: string;
    fields: { key: string; label: string }[];
    values: Record<string, string>;
    procId?: string;
  } | null>(null);
  // While ONE is working, a status line cycles Thinking → Connecting → Searching
  // → Working (like a coding agent), and the ONE face closes its eyes.
  const [statusIdx, setStatusIdx] = useState(0);
  const oneWorking = thinking || unitThinking;
  // A conversation is open (home chat, temp chat, or inside a unit). The living
  // ONE moves into the chat then, so the top brand mark holds still + closes.
  const chatFocused = chat.length > 0 || tempChat || !!activeProcess;
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
  // Global Units library — canonical, forkable units (the "TikTok sound /
  // Wikipedia page" model). Pull one → a personalized copy lands in your
  // processes and the canonical unit's aggregate `uses` ticks up.
  const [gUnits, setGUnits] = useState<GlobalUnit[]>([]);
  const [gUnitQ, setGUnitQ] = useState("");
  useEffect(() => {
    void searchGlobalUnits("").then(setGUnits).catch(() => {});
  }, []);
  const runGUnitSearch = (q: string) => {
    setGUnitQ(q);
    void searchGlobalUnits(q).then(setGUnits).catch(() => {});
  };
  const pullGlobalUnit = async (gu: GlobalUnit) => {
    const src = (await forkGlobalUnit(gu.id)) ?? gu;
    const proc: Process = {
      id: `unit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      identityId: activeIdentityId,
      emoji: src.emoji || "📌",
      title: src.title,
      time: "now",
      unread: 1,
      summary: src.next_action ?? src.title,
      relation: "Private",
      progress: { done: 0, total: (src.steps ?? []).length },
      people: [],
      steps: (src.steps ?? []).map((s) => ({ label: s.label, done: false })),
      decisions: [],
      timeline: [
        {
          at: "now",
          text:
            lang === "he"
              ? `נמשך מהגלובל — ${src.uses} כבר השתמשו בזה.`
              : `Pulled from Global — ${src.uses} already used it.`,
        },
      ],
      type: src.type ?? undefined,
      nextAction: src.next_action ?? undefined,
      metrics: src.metrics ?? [],
      insights: src.insights ?? [],
      coverImage: src.cover_image ?? undefined,
    };
    upsert(proc);
    setSpace("home");
    openUnit(proc);
  };
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
    setAuthMsg(lang === "he" ? "שולח…" : "Sending…");
    const r = await signInWithEmail(email);
    setAuthMsg(
      r.ok
        ? lang === "he"
          ? `✓ שלחתי קישור כניסה ל-${email}. בדוק את המייל.`
          : `✓ Check ${email} for your sign-in link.`
        : r.error ?? (lang === "he" ? "לא הצלחתי לשלוח את הקישור." : "Couldn't send the link."),
    );
  };
  const continueWithGoogle = async () => {
    setAuthMsg(lang === "he" ? "מעביר לגוגל…" : "Redirecting to Google…");
    const r = await signInWithGoogle();
    if (!r.ok) setAuthMsg(r.error ?? (lang === "he" ? "כניסה עם גוגל עדיין לא מופעלת." : "Google sign-in isn't enabled yet."));
  };
  const doSignOut = async () => {
    await signOut();
    setUser(null);
    setAuthMsg(null);
  };

  // Remove a profile and everything scoped to it. Safe by design: never delete
  // the last profile, and confirm first since it drops that profile's
  // processes, requests and reminders.
  const deleteIdentity = (id: string) => {
    if (identities.length <= 1) return;
    const target = identities.find((i) => i.id === id);
    const label = target ? `${target.emoji} ${target.name}` : "";
    const ok =
      typeof window === "undefined" ||
      window.confirm(
        lang === "he"
          ? `למחוק את הפרופיל ${label}? כל התהליכים, הבקשות והתזכורות שלו יימחקו.`
          : `Delete the ${label} profile? Its processes, requests and reminders are removed.`,
      );
    if (!ok) return;
    const next = identities.filter((i) => i.id !== id);
    persistIdentities(next);
    setUnits((list) => list.filter((u) => u.identityId !== id));
    persistRequests(requests.filter((r) => r.fromProfileId !== id && r.toProfileId !== id));
    persistReminders(reminders.filter((r) => r.identityId !== id));
    if (activeIdentityId === id) setActiveIdentityId(next[0].id);
  };

  // Start over: clear the demo profiles + all local workspace data, leaving one
  // clean personal profile (named after the signed-in account when there is
  // one). Keeps your preferences (language, theme) and saved memory facts.
  const startFresh = () => {
    const ok =
      typeof window === "undefined" ||
      window.confirm(
        lang === "he"
          ? "להתחיל מחדש? כל הפרופילים, התהליכים והחיבורים המקומיים יימחקו ותישאר עם פרופיל אישי אחד נקי."
          : "Start fresh? All local profiles, processes and connections are cleared, leaving one clean personal profile.",
      );
    if (!ok) return;
    const nm = user?.name || user?.email?.split("@")[0] || (lang === "he" ? "אני" : "Me");
    const fresh: Identity = {
      id: `id_${Date.now()}`,
      name: nm,
      role: "Personal",
      emoji: "👤",
      kind: "personal",
    };
    persistIdentities([fresh]);
    setActiveIdentityId(fresh.id);
    setUnits([]);
    persistRequests([]);
    persistReminders([]);
    persistContacts([]);
    setChat([]);
    setOpenSheet(null);
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

  // Load the business directory from Supabase (public read, no auth needed) and
  // MERGE it over the local seed — the cloud wins on shared ids, but the seeded
  // demo listings (incl. the business-facing ones) stay in the directory.
  useEffect(() => {
    let cancelled = false;
    fetchProviders().then((list) => {
      if (!cancelled && list)
        setBusinesses([...list, ...BUSINESSES.filter((b) => !list.some((x) => x.id === b.id))]);
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
  const identity = identities.find((i) => i.id === activeIdentityId) ?? identities[0];

  const processes = useMemo(() => {
    const own = units.filter((p) => p.identityId === activeIdentityId);
    // Fold in the live cloud bookings addressed to this business (provider side).
    const fromCloud = incomingBookings.map(bookingToProcess);
    return [...fromCloud, ...own].sort((a, b) => b.unread - a.unread);
  }, [activeIdentityId, units, incomingBookings]);

  // Live incoming-reply signal — a request YOU sent (from this profile) that the
  // other side has now answered, and you haven't seen the answer yet. This is
  // the return leg of the two-sided loop, surfaced on Home as a banner.
  const incomingReplies = useMemo(
    () =>
      requests.filter(
        (r) => r.fromProfileId === activeIdentityId && r.reply && !r.replySeen,
      ),
    [requests, activeIdentityId],
  );

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
    // Supplier lens: ONE leads with the inbox, not "start a process".
    if ((identity.kind ?? "personal") === "supplier") {
      const newCount = requests.filter(
        (r) => r.toProfileId === activeIdentityId && r.status === "new",
      ).length;
      return newCount > 0
        ? [
            he
              ? `${greet} ${newCount} ${newCount === 1 ? "פנייה חדשה מחכה" : "פניות חדשות מחכות"} לך.`
              : `${greet} ${newCount} new request${newCount > 1 ? "s" : ""} waiting on you.`,
            he ? "פתח את תיבת הפניות כדי לענות." : "Open your inbox to answer.",
          ]
        : [
            greet,
            he ? "אין פניות חדשות כרגע." : "No new requests right now.",
          ];
    }
    const waiting = processes.filter((p) => p.unread > 0);
    // Pending reminders feed the pulse too — ONE says what's coming up.
    const remCount = reminders.filter(
      (r) => r.identityId === activeIdentityId && !r.done,
    ).length;
    const remLine =
      remCount > 0
        ? he
          ? `⏰ ${remCount} ${remCount === 1 ? "תזכורת" : "תזכורות"} ממתינות.`
          : `⏰ ${remCount} reminder${remCount > 1 ? "s" : ""} coming up.`
        : null;
    if (waiting.length === 0) {
      return [
        greet,
        remLine ??
          (he
            ? "אין דבר שדורש אותך כרגע — ספרו לי מטרה חדשה."
            : "Nothing needs you right now — tell me a new goal."),
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
    return remLine ? [header, remLine, ...items] : [header, ...items];
  }, [processes, identity.name, identity.kind, requests, reminders, activeIdentityId, now, lang]);

  // Announce a live event in the broadcast slot, in the app's language.
  const announce = (en: string, he: string) => setLiveBroadcast(lang === "he" ? he : en);

  // Real relative time from an epoch stamp ("now", "5m", "2h", "3d") — recomputed
  // as `now` ticks, so the side list and timelines show live, honest times.
  const relTime = (ms?: number): string => {
    if (!ms) return "";
    const ref = typeof now === "number" ? now : Date.now();
    const diff = Math.max(0, ref - ms);
    const m = Math.floor(diff / 60000);
    if (m < 1) return lang === "he" ? "עכשיו" : "now";
    if (m < 60) return lang === "he" ? `לפני ${m} ד׳` : `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return lang === "he" ? `לפני ${h} ש׳` : `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return lang === "he" ? `לפני ${d} י׳` : `${d}d`;
    const w = Math.floor(d / 7);
    return lang === "he" ? `לפני ${w} שב׳` : `${w}w`;
  };

  // The live process behind the open sheet, so edits show immediately.
  const activeLive = activeProcess ? units.find((u) => u.id === activeProcess.id) ?? activeProcess : null;

  // ── Shared units — a unit turns from private to SHARED, and its own chat
  //    becomes a group thread (like a WhatsApp group): you, ONE, and the people
  //    you share it with, all in the unit's conversation, live on both sides.
  //    The participants come from your connections (the driving instructor, the
  //    coach…). No separate room — the unit's chat IS the group.
  const myName = (identity?.name || "").trim() || (lang === "he" ? "אני" : "You");
  const [sharedMembers, setSharedMembers] = useState<Record<string, string[]>>({});
  const [shareBusy, setShareBusy] = useState(false);
  // Per-code set of shared-message ids already reflected in the unit chat (so the
  // poll never double-appends, and our own posts don't echo back as new).
  const sharedSeenRef = useRef<Record<string, Set<string>>>({});
  const seenSet = (code: string) => (sharedSeenRef.current[code] ??= new Set());
  const sharedAnsweredRef = useRef<Set<string>>(new Set());
  const sharedOpenedRef = useRef<Record<string, string>>({});
  // Mirror bookkeeping: how far into unitChat we've pushed to the server, and for
  // which code — so we mirror new local turns exactly once.
  const mirroredCountRef = useRef(0);
  const mirroredCodeRef = useRef<string | null>(null);
  const startSharedRoom = async (proc: Process) => {
    if (proc.shareCode || shareBusy) return;
    setShareBusy(true);
    const snap: Record<string, unknown> = { ...proc };
    delete snap.chat;
    delete snap.drafts;
    const su = await createSharedUnit({
      title: proc.title,
      emoji: proc.emoji,
      type: proc.type ?? null,
      unit: snap,
      author: myName,
    });
    if (!su) {
      setShareBusy(false);
      return;
    }
    // Seed the room with your connections on this unit (they show as members).
    const people = (proc.people ?? []).filter((p) => p && p.trim() && p !== myName);
    for (const p of people) void joinSharedUnit(su.code, p);
    setShareBusy(false);
    setUnits((list) =>
      list.map((u) => (u.id === proc.id ? { ...u, shareCode: su.code, shareOwner: true } : u)),
    );
    setSharedMembers((m) => ({ ...m, [su.code]: [myName, ...people] }));
    sharedOpenedRef.current[su.code] = new Date().toISOString();
  };
  // Owner's ONE answers a question a participant raised — live web first, then
  // AI — appended into the unit chat (which mirrors it out to everyone).
  const answerInRoom = async (prompt: string) => {
    let text = "";
    const l = msgLang(prompt);
    if (aiWeb && isPureQuestion(prompt)) {
      const web = await searchWeb(prompt, l);
      if (web) text = web.text;
    }
    if (!text) {
      try {
        text = await invokeAiChat(
          [
            { role: "system", content: oneSystemPrompt(l, memoryContext()) },
            { role: "user", content: prompt },
          ],
          { maxTokens: 200 },
        );
      } catch {
        text = "";
      }
    }
    if (text.trim()) setUnitChat((c) => [...c, { role: "one", party: "one", text: text.trim() }]);
  };
  // Land in a shared unit from a ?join=CODE link — the unit becomes yours too.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code) return;
    let cancelled = false;
    (async () => {
      const su = await joinSharedUnit(code, myName);
      if (cancelled || !su) return;
      const snap = (su.unit ?? {}) as Partial<Process>;
      const proc: Process = {
        id: `shared-${su.code}`,
        identityId: activeIdentityId,
        emoji: su.emoji || snap.emoji || "📌",
        title: su.title || snap.title || "Shared unit",
        time: snap.time || "now",
        unread: 0,
        summary: snap.summary || "",
        relation: snap.relation || (lang === "he" ? "משותף" : "Shared"),
        progress: snap.progress || { done: 0, total: snap.steps?.length ?? 0 },
        people: snap.people || [],
        steps: snap.steps || [],
        decisions: snap.decisions || [],
        timeline: snap.timeline || [],
        type: (su.type as string | undefined) || snap.type,
        nextAction: snap.nextAction,
        metrics: snap.metrics,
        insights: snap.insights,
        quickActions: snap.quickActions,
        fields: snap.fields,
        coverImage: snap.coverImage,
        stepImages: snap.stepImages,
        shareCode: su.code,
        shareOwner: false,
      };
      sharedOpenedRef.current[su.code] = new Date().toISOString();
      setUnits((list) => (list.some((u) => u.shareCode === su.code) ? list : [proc, ...list]));
      openUnit(proc);
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.toString());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Mirror new LOCAL turns (yours + ONE's) out to the shared thread, once each.
  useEffect(() => {
    const code = activeLive?.shareCode;
    if (!code) {
      mirroredCodeRef.current = null;
      return;
    }
    if (mirroredCodeRef.current !== code) {
      // Switched into this shared unit — don't re-send pre-share history.
      mirroredCodeRef.current = code;
      mirroredCountRef.current = unitChat.length;
      return;
    }
    const from = mirroredCountRef.current;
    if (unitChat.length <= from) return;
    const slice = unitChat.slice(from);
    mirroredCountRef.current = unitChat.length;
    void (async () => {
      for (const m of slice) {
        if (m.sid) continue; // came from the server already
        const party = m.party ?? (m.role === "user" ? "you" : "one");
        if (party === "them") continue; // not ours to mirror
        const role: "human" | "one" = party === "one" ? "one" : "human";
        const posted = await postSharedMessage(code, role === "one" ? "ONE" : myName, role, m.text);
        if (posted) seenSet(code).add(posted.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitChat, activeLive?.shareCode]);
  // Poll the shared thread + members; append everyone else's turns into the unit
  // chat (as a group), and let the owner's ONE answer questions raised there.
  useEffect(() => {
    const code = activeLive?.shareCode;
    if (!code) return;
    if (!sharedOpenedRef.current[code]) sharedOpenedRef.current[code] = new Date().toISOString();
    const owner = !!activeLive?.shareOwner;
    let stop = false;
    const tick = async () => {
      const [msgs, mems] = await Promise.all([
        getSharedMessages(code, null),
        listSharedMembers(code),
      ]);
      if (stop) return;
      const seen = seenSet(code);
      const fresh = msgs.filter((m) => !seen.has(m.id));
      for (const m of fresh) {
        seen.add(m.id);
        if (m.role === "human" && m.author === myName) continue; // our own echo
        const party: "one" | "them" = m.role === "one" ? "one" : "them";
        setUnitChat((c) => [
          ...c,
          {
            role: m.role === "one" ? "one" : "user",
            party,
            from: party === "them" ? m.author : undefined,
            text: m.text,
            sid: m.id,
          },
        ]);
      }
      if (mems.length) setSharedMembers((m) => ({ ...m, [code]: mems.map((x) => x.name) }));
      if (owner) {
        const openedAt = sharedOpenedRef.current[code] ?? "";
        for (const m of fresh) {
          if (m.role !== "human" || m.author === myName) continue;
          if (sharedAnsweredRef.current.has(m.id)) continue;
          if (m.created_at <= openedAt) {
            sharedAnsweredRef.current.add(m.id);
            continue;
          }
          if (!(/\?\s*$/.test(m.text) || /\bone\b|וואן/i.test(m.text))) continue;
          sharedAnsweredRef.current.add(m.id);
          void answerInRoom(m.text);
        }
      }
    };
    void tick();
    const iv = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLive?.shareCode, activeLive?.shareOwner]);

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
  const enrichProcessPlan = async (proc: Process, intent: string, toUnit = false) => {
    // Route a follow-up line to the right thread: the unit (if we handed off to
    // it and you're still there), the process's saved transcript (if you left),
    // or the home chat (the classic flow).
    const postFollowUp = (m: ChatMsg) => {
      if (!toUnit) {
        setChat((c) => (c.length ? [...c, m] : c));
        return;
      }
      if (activeUnitRef.current === proc.id) setUnitChat((c) => [...c, m]);
      else
        setUnits((list) =>
          list.map((u) => (u.id === proc.id ? { ...u, chat: [...(u.chat ?? []), m] } : u)),
        );
    };
    try {
      // Mirror the language the user wrote the intent in, not the app setting.
      const he = msgLang(intent) === "he";
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
      postFollowUp({
        role: "one",
        text: he
          ? `הכנתי תכנית ל"${proc.title}": ${steps.length} שלבים, מתחילים ב"${steps[0]}". רוצה לשנות משהו?`
          : `I've drafted a plan for "${proc.title}": ${steps.length} steps, starting with "${steps[0]}". Want to change anything?`,
        chips: he ? ["מעולה, קדימה", "שנה משהו"] : ["Looks good", "Change something"],
      });
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
        postFollowUp({ role: "one", text: `🧠 ${t.memPulled}: ${listing}` });
      }
      if (toAsk.length) {
        postFollowUp({
          role: "one",
          text: he
            ? `לתהליך הזה כדאי גם: ${toAsk.map((f) => `${f.emoji} ${f.he}`).join("، ")}. לשתף?`
            : `This one could also use: ${toAsk.map((f) => `${f.emoji} ${f.en}`).join(", ")}. Share them?`,
          actions: toAsk.map((f) => ({
            label: `${f.emoji} ${t.memShare}`,
            kind: "shareMem" as const,
            mem: f.key,
          })),
        });
      }
      // …then ONE takes the lead: a short, choice-driven interview to tailor the
      // plan to THIS person, before it starts driving it forward. Only in the
      // unit flow, so the questions land in the open thread you're looking at.
      if (toUnit) {
        postFollowUp({
          role: "one",
          text: he
            ? "כדי להתאים את זה בול אליך, כמה שאלות קצרות — אפשר להקיש בחירה או לכתוב 👇"
            : "To tailor this to you, a few quick questions — tap a choice or just type 👇",
        });
        void askIntake({ ...proc, title: cleanTitle ?? proc.title }, intent, [], 0);
      }
    } catch {
      /* Any failure (offline, bad JSON) — keep the template plan. */
    }
  };

  // ── Intake interview — ONE becomes the expert for a goal: it asks the user a
  //    few tailoring questions (tappable choices, or type), gathers the answers
  //    into the process, then writes a personalised plan and starts leading.
  const MAX_INTAKE = 4;
  // Route a chat line into the right place for a process (open unit vs saved).
  const postToProc = (proc: Process, m: ChatMsg) => {
    if (activeUnitRef.current === proc.id) setUnitChat((c) => [...c, m]);
    else
      setUnits((list) =>
        list.map((u) => (u.id === proc.id ? { ...u, chat: [...(u.chat ?? []), m] } : u)),
      );
  };
  const setProcThinking = (proc: Process, v: boolean) =>
    activeUnitRef.current === proc.id ? setUnitThinking(v) : setThinking(v);
  // Close the interview: a dedicated AI call that turns the answers into a
  // tailored plan + a first-person "here's what we're doing, starting now" lead,
  // then writes it into the process. This is ONE taking the wheel.
  const finishIntake = async (
    proc: Process,
    topic: string,
    answers: { field: string; question: string; answer: string }[],
  ) => {
    const he = msgLang(`${proc.title} ${topic}`) === "he";
    const prior = answers.map((a) => `- ${a.question} → ${a.answer}`).join("\n");
    setProcThinking(proc, true);
    let lead = he
      ? "יש לי תמונה מלאה. אני לוקח מכאן — מתחילים."
      : "I've got the full picture. I'll take it from here — let's start.";
    let steps: string[] = [];
    let metrics: { label: string; value: string }[] = [];
    let firstAction = "";
    try {
      const sys = he
        ? `אתה ONE — המומחה האישי של המשתמש למטרה "${proc.title}". על סמך התשובות שלו בנה תכנית מותאמת אישית והתחל להוביל. החזר JSON תקין בלבד: {"lead":"","firstAction":"","steps":["",""],"metrics":[{"label":"","value":""}]} — lead=פסקה קצרה בגוף ראשון שמסכמת את הכיוון המותאם, firstAction=משפט אחד קצר ויוזם שבו אתה מציע לקחת את המהלך הראשון בעצמך עכשיו (למשל למצוא מורה, לקבוע זמן, להכין תכנית שבועית) ומסתיים בשאלה קצרה, steps=3‑5 צעדים מותאמים לפי סדר, metrics=1‑3 מדדים למעקב. הכל בעברית. בלי code fences.`
        : `You are ONE — the user's personal expert for the goal "${proc.title}". Using their answers, build a tailored plan and start leading. Return ONLY valid JSON: {"lead":"","firstAction":"","steps":["",""],"metrics":[{"label":"","value":""}]} — lead=a short first-person paragraph summarising the tailored direction, firstAction=one short proactive sentence where YOU offer to take the first move yourself right now (e.g. find a coach, book a slot, draft the week's plan) ending in a brief question, steps=3‑5 tailored ordered steps, metrics=1‑3 metrics to track. No code fences.`;
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: `Goal: ${proc.title} — ${topic}\nAnswers:\n${prior || "(none)"}` },
        ],
        { maxTokens: 520, temperature: 0.5 },
      );
      const body = raw.replace(/```json|```/g, "");
      const s = body.indexOf("{");
      const e = body.lastIndexOf("}");
      const parsed = s >= 0 && e > s ? JSON.parse(body.slice(s, e + 1)) : null;
      if (parsed) {
        if (typeof parsed.lead === "string" && parsed.lead.trim()) lead = parsed.lead.trim();
        if (typeof parsed.firstAction === "string" && parsed.firstAction.trim())
          firstAction = parsed.firstAction.trim();
        if (Array.isArray(parsed.steps))
          steps = parsed.steps.filter((x: unknown) => typeof x === "string" && !!(x as string).trim()).slice(0, 6);
        if (Array.isArray(parsed.metrics))
          metrics = parsed.metrics
            .filter(
              (m: unknown): m is { label: string; value: string } =>
                !!m &&
                typeof (m as { label?: unknown }).label === "string" &&
                typeof (m as { value?: unknown }).value === "string",
            )
            .slice(0, 4);
      }
    } catch {
      /* keep the fallback lead + existing plan */
    }
    setProcThinking(proc, false);
    setIntake(null);
    setUnits((list) =>
      list.map((u) =>
        u.id === proc.id
          ? {
              ...u,
              fields: {
                ...(u.fields ?? {}),
                ...Object.fromEntries(answers.map((a) => [a.field, a.answer])),
              },
              steps: steps.length ? steps.map((label) => ({ label, done: false })) : u.steps,
              progress: steps.length ? { done: 0, total: steps.length } : u.progress,
              metrics: metrics.length ? metrics : u.metrics,
              decisions: [he ? "סוכם כיוון מותאם אישית" : "Locked a tailored direction", ...u.decisions],
            }
          : u,
      ),
    );
    // The unit is now built "to the highest level" → publish it as the canonical
    // Global entry for its topic, so anyone can pull a personalized fork.
    void publishGlobalUnit({
      ...proc,
      steps: steps.length ? steps.map((label) => ({ label, done: false })) : proc.steps,
      metrics: metrics.length ? metrics : proc.metrics,
      nextAction: firstAction || proc.nextAction,
    });
    postToProc(proc, { role: "one", text: lead });
    // ONE doesn't just name the first step — it offers to TAKE it, and the
    // "yes" chip actually puts ONE to work on it (routes through the same
    // in-unit work flow as tapping a step).
    const firstStep = (steps.length ? steps : proc.steps.map((sp) => sp.label))[0];
    const goChip = he ? "קדימה, תתחיל" : "Go ahead, start";
    postToProc(proc, {
      role: "one",
      text:
        firstAction ||
        (firstStep
          ? he
            ? `מתחילים מ: ${firstStep}. שאקח את זה?`
            : `We start with: ${firstStep}. Want me to take it on?`
          : he
            ? "מוכן להתחיל?"
            : "Ready to start?"),
      chips: [goChip, he ? "שנה משהו בתכנית" : "Adjust the plan"],
    });
  };
  const askIntake = async (
    proc: Process,
    topic: string,
    answers: { field: string; question: string; answer: string }[],
    asked: number,
  ) => {
    // Hit the cap? Skip straight to the tailored close.
    if (asked >= MAX_INTAKE) {
      await finishIntake(proc, topic, answers);
      return;
    }
    const he = msgLang(`${proc.title} ${topic}`) === "he";
    setProcThinking(proc, true);
    try {
      const prior = answers.map((a) => `- ${a.question} → ${a.answer}`).join("\n");
      const sys = he
        ? `אתה ONE — הנציג והמומחה האישי של המשתמש למטרה "${proc.title}". אתה מראיין אותו בקצרה כדי לבנות תכנית מותאמת. שאל את השאלה הבאה הכי מועילה (אחת בלבד). החזר JSON תקין בלבד: {"question":"","options":["","",""],"field":"","done":false} — question=שאלה אחת קצרה, options=3‑4 בחירות קונקרטיות קצרות (המשתמש יכול גם לכתוב), field=מילה שמתארת מה נאסף, done=true רק אם כבר יש לך מספיק לתכנית טובה. הכל בעברית חוץ מ‑field. בלי code fences.`
        : `You are ONE — the user's personal representative and expert for the goal "${proc.title}". You briefly interview them to build a tailored plan. Ask the single most useful next question. Return ONLY valid JSON: {"question":"","options":["","",""],"field":"","done":false} — question=one short question, options=3‑4 concrete short choices (the user may also type), field=a word for what it captures, done=true only if you already have enough for a good plan. No code fences.`;
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          {
            role: "user",
            content: `Goal: ${proc.title} — ${topic}\nAnswers so far:\n${prior || "(none yet)"}`,
          },
        ],
        { maxTokens: 320, temperature: 0.5 },
      );
      const body = raw.replace(/```json|```/g, "");
      const s = body.indexOf("{");
      const e = body.lastIndexOf("}");
      const parsed = s >= 0 && e > s ? JSON.parse(body.slice(s, e + 1)) : null;
      const options = (Array.isArray(parsed?.options) ? parsed.options : [])
        .filter((o: unknown): o is string => typeof o === "string" && !!o.trim())
        .map((o: string) => o.trim().slice(0, 60))
        .slice(0, 4);
      // No usable question, or the model says it's done → close + lead.
      if (
        !parsed ||
        parsed.done ||
        typeof parsed.question !== "string" ||
        !parsed.question.trim() ||
        options.length < 2
      ) {
        await finishIntake(proc, topic, answers);
        return;
      }
      setProcThinking(proc, false);
      const question = parsed.question.trim().slice(0, 220);
      const field =
        typeof parsed.field === "string" && parsed.field.trim()
          ? parsed.field.trim().slice(0, 30)
          : `q${asked + 1}`;
      setIntake({ procId: proc.id, topic, field, question, answers, asked });
      postToProc(proc, { role: "one", text: question, intake: { options, field, procId: proc.id } });
    } catch {
      setProcThinking(proc, false);
      setIntake(null);
    }
  };
  // Record an intake answer (a tapped choice OR typed text) and move on.
  const answerIntake = (answerText: string) => {
    const cur = intakeRef.current;
    if (!cur) return;
    const proc = units.find((u) => u.id === cur.procId);
    const toUnit = activeUnitRef.current === cur.procId;
    const echo = (m: ChatMsg) => {
      if (toUnit) setUnitChat((c) => [...c, m]);
      else
        setUnits((list) =>
          list.map((u) => (u.id === cur.procId ? { ...u, chat: [...(u.chat ?? []), m] } : u)),
        );
    };
    echo({ role: "user", text: answerText });
    setIntake(null);
    if (!proc) return;
    // Write the answer into the unit NOW — so the card visibly BUILDS during the
    // interview (a growing metric row + saved fields), not only at the end.
    const he = msgLang(`${proc.title} ${cur.topic}`) === "he";
    setUnits((list) =>
      list.map((u) => {
        if (u.id !== cur.procId) return u;
        const key = cur.field.trim().toLowerCase();
        const metrics = u.metrics ?? [];
        const nextMetrics = metrics.some((m) => m.label.trim().toLowerCase() === key)
          ? metrics.map((m) => (m.label.trim().toLowerCase() === key ? { ...m, value: answerText } : m))
          : [...metrics, { label: cur.field, value: answerText }];
        return {
          ...u,
          fields: { ...(u.fields ?? {}), [cur.field]: answerText },
          metrics: nextMetrics,
          time: "now",
          timeline: [
            { at: "now", text: he ? `סיפרת: ${answerText}.` : `You told me: ${answerText}.` },
            ...u.timeline,
          ],
        };
      }),
    );
    const answers = [
      ...cur.answers,
      { field: cur.field, question: cur.question, answer: answerText },
    ];
    void askIntake(proc, cur.topic, answers, cur.asked + 1);
  };

  // ── Quiz teaching capability — turn "quiz me on X" into a real quiz in chat.
  const runQuiz = async (topic: string, proc?: Process) => {
    const he = lang === "he";
    // Route quiz output to the process thread when we're teaching inside a unit.
    const post = (m: ChatMsg) => (proc ? setUnitChat((c) => [...c, m]) : setChat((c) => [...c, m]));
    const stopThinking = () => (proc ? setUnitThinking(false) : setThinking(false));
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
      stopThinking();
      if (questions.length === 0) {
        post({ role: "one", text: he ? "לא הצלחתי להכין מבחן כרגע." : "I couldn't build a quiz just now." });
        return;
      }
      setQuiz({ questions, idx: 0, score: 0, procId: proc?.id });
      const q0 = questions[0];
      // Pull an illustrative image for the topic from Wikipedia (an allowed
      // open-reference source). Best-effort — the quiz shows fine without it.
      const topicTitle = typeof parsed?.topic === "string" && parsed.topic.trim() ? parsed.topic.trim() : topic;
      const img = await wikiThumbnail(topicTitle);
      post({
        role: "one",
        text: `❓ ${he ? "שאלה" : "Question"} 1/${questions.length}: ${q0.q}`,
        quiz: { options: q0.options, answer: q0.answer },
        image: img ?? undefined,
      });
    } catch {
      stopThinking();
      post({ role: "one", text: he ? "לא הצלחתי להכין מבחן כרגע." : "I couldn't build a quiz just now." });
    }
  };
  // Answer the current quiz question (tapping an option chip). Routes to the
  // home chat or, when the quiz is running inside a process, that process's
  // thread — and on completion updates the unit (ticks a learning step, logs it).
  const answerQuiz = (optionIdx: number) => {
    if (!quiz) return;
    const he = lang === "he";
    const inUnit = !!quiz.procId;
    const post = (...ms: ChatMsg[]) =>
      inUnit ? setUnitChat((c) => [...c, ...ms]) : setChat((c) => [...c, ...ms]);
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
    post(
      { role: "user", text: q.options[optionIdx] },
      { role: "one", text: feedback + (q.explain ?? "") },
    );
    if (nextIdx < quiz.questions.length) {
      const nq = quiz.questions[nextIdx];
      setQuiz({ questions: quiz.questions, idx: nextIdx, score: nextScore, procId: quiz.procId });
      post({
        role: "one",
        text: `❓ ${he ? "שאלה" : "Question"} ${nextIdx + 1}/${quiz.questions.length}: ${nq.q}`,
        quiz: { options: nq.options, answer: nq.answer },
      });
    } else {
      const total = quiz.questions.length;
      const pct = nextScore / total;
      const passed = pct >= 0.5;
      const badge = pct === 1 ? "🏆" : passed ? "🎉" : "📚";
      post({
        role: "one",
        text: he
          ? `${badge} סיימת! הציון שלך: ${nextScore}/${total}.`
          : `${badge} Done! You scored ${nextScore}/${total}.`,
      });
      // Inside a process, a passing score is real progress: tick the learning
      // step, log it to the timeline, and drop the "practice" quick-action.
      if (quiz.procId && passed) {
        const pid = quiz.procId;
        setUnits((list) =>
          list.map((u) =>
            u.id === pid
              ? {
                  ...u,
                  steps: u.steps.map((sp) =>
                    /theor|practice|study|quiz|תאורי|תרגול|מבחן|לימוד/i.test(sp.label)
                      ? { ...sp, done: true }
                      : sp,
                  ),
                  quickActions: (u.quickActions ?? []).filter(
                    (a) => !/theor|practice|quiz|תאורי|תרגול|מבחן/i.test(a),
                  ),
                  decisions: [
                    he ? `עברת תרגול (${nextScore}/${total})` : `Passed practice (${nextScore}/${total})`,
                    ...u.decisions,
                  ],
                  timeline: [
                    {
                      at: "now",
                      text: he
                        ? `תרגלת ועברת: ${nextScore}/${total}.`
                        : `You practiced and passed: ${nextScore}/${total}.`,
                    },
                    ...u.timeline,
                  ],
                }
              : u,
          ),
        );
      }
      setQuiz(null);
    }
  };
  // ── Booking capability — turn "book me X" into real, tappable time slots that
  //    land in a process (timeline + a "When" metric + a confirmation), the way
  //    Quiz lands a score. Slots come from the clock, skipping the Israeli weekend.
  const bookingSlots = (): string[] => {
    const he = lang === "he";
    const base = now ?? new Date();
    const dHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const dEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const times = ["09:00", "11:30", "14:00", "16:30"];
    const out: string[] = [];
    for (let off = 1; off < 16 && out.length < 4; off++) {
      const d = new Date(base.getTime() + off * 86400000);
      const dow = d.getDay();
      if (dow === 5 || dow === 6) continue; // skip Fri/Sat
      const day = he
        ? `יום ${dHe[dow]} ${d.getDate()}/${d.getMonth() + 1}`
        : `${dEn[dow]} ${d.getDate()}/${d.getMonth() + 1}`;
      out.push(`${day} · ${times[out.length]}`);
    }
    return out;
  };
  // A short label for the thing being booked (strip the "book me a…" scaffolding).
  const bookingLabel = (text: string): string => {
    const he = /[֐-׿]/.test(text);
    const s = he
      ? text
          .replace(/קבע(?:ו|י|ה)?\s*(?:לי)?|לקבוע|תזמ(?:ן|ני)|להזמין|תור|בבקשה|אצל/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : text
          .replace(
            /\b(book|schedule|reserve|set ?up|make|arrange|get|me|an?|the|please|appointment|slot|for|with|to)\b/gi,
            " ",
          )
          .replace(/\s+/g, " ")
          .trim();
    return s || (he ? "הפגישה" : "the appointment");
  };
  // Offer bookable slots in a chat (the home chat, or a specific process's thread).
  const runBooking = (text: string, proc?: Process) => {
    const he = lang === "he";
    const topic = bookingLabel(text);
    const msg: ChatMsg = {
      role: "one",
      text: he
        ? `מצאתי כמה זמנים פנויים ל${topic}. בחר אחד ואקבע אותו:`
        : `I found open times for ${topic}. Tap one and I'll lock it in:`,
      booking: { slots: bookingSlots(), topic, procId: proc?.id },
    };
    if (proc) {
      setUnitThinking(false);
      setUnitChat((c) => [...c, msg]);
    } else {
      setThinking(false);
      setChat((c) => [...c, msg]);
    }
  };
  // Reminders capability — "remind me…" becomes a real, held reminder (surfaced
  // on Home when pending), scoped to a process when we're inside one.
  const runReminder = (text: string, proc?: Process) => {
    const he = /[֐-׿]/.test(text) || lang === "he";
    const when = extractWhen(text) ?? (he ? "בקרוב" : "soon");
    const what =
      (he
        ? text.replace(/תזכיר לי\s*(?:ל|ש)?|קבע תזכורת\s*(?:ל)?|תזכורת\s*(?:ל)?/g, " ")
        : text.replace(
            /\b(remind me(?: to| that| about)?|set a reminder(?: to| for| about)?|reminder)\b/gi,
            " ",
          )
      )
        .replace(/\s+/g, " ")
        .trim() || (he ? "התזכורת" : "the reminder");
    addReminder(proc?.identityId ?? activeIdentityId, what, when, proc?.id);
    const msg: ChatMsg = {
      role: "one",
      text: he ? `⏰ אזכיר לך: ${what} — ${when}.` : `⏰ I'll remind you: ${what} — ${when}.`,
    };
    if (proc) {
      setUnitThinking(false);
      setUnitChat((c) => [...c, msg]);
    } else {
      setThinking(false);
      setChat((c) => [...c, msg]);
    }
  };
  // ── Providers capability — ONE finds candidate providers for a need (it
  //    generates realistic options when it has none on file), you add the ones
  //    you like, and it drops an outreach draft to reach them.
  const runProviders = async (text: string, proc?: Process) => {
    const he = /[֐-׿]/.test(text) || lang === "he";
    const post = (m: ChatMsg) => (proc ? setUnitChat((c) => [...c, m]) : setChat((c) => [...c, m]));
    const stop = () => (proc ? setUnitThinking(false) : setThinking(false));
    const need = proc ? `${proc.title} — ${text}` : text;
    try {
      const sys = he
        ? 'הצע 4 ספקים/נותני שירות ריאליסטיים בישראל לצורך שניתן. החזר JSON תקין בלבד: {"items":[{"name":"","category":"","area":"","blurb":""}]} — name=שם העסק, category=תחום, area=אזור/עיר, blurb=משפט קצר. בלי code fences.'
        : 'Suggest 4 realistic providers for the given need (in Israel). Return ONLY valid JSON: {"items":[{"name":"","category":"","area":"","blurb":""}]} — name=business name, category=field, area=city/area, blurb=one short line. No code fences.';
      const raw = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: need },
        ],
        { maxTokens: 420, temperature: 0.6 },
      );
      const body = raw.replace(/```json|```/g, "");
      const s = body.indexOf("{");
      const e = body.lastIndexOf("}");
      const parsed = s >= 0 && e > s ? JSON.parse(body.slice(s, e + 1)) : null;
      const items = (Array.isArray(parsed?.items) ? parsed.items : [])
        .filter(
          (x: unknown): x is { name: string; category?: string; area?: string; blurb?: string } =>
            !!x && typeof (x as { name?: unknown }).name === "string" && !!(x as { name: string }).name.trim(),
        )
        .slice(0, 4)
        .map((x: { name: string; category?: string; area?: string; blurb?: string }) => ({
          name: x.name.slice(0, 60),
          category: (x.category ?? "").slice(0, 50),
          area: (x.area ?? "").slice(0, 40),
          blurb: (x.blurb ?? "").slice(0, 120),
        }));
      stop();
      if (!items.length) {
        post({ role: "one", text: he ? "לא מצאתי ספקים כרגע." : "I couldn't find providers just now." });
        return;
      }
      post({
        role: "one",
        text: he
          ? "מצאתי כמה ספקים אפשריים. הוסף אחד ואטפל בפנייה:"
          : "I found a few providers. Add one and I'll handle the outreach:",
        providers: { need: text, procId: proc?.id, items },
      });
    } catch {
      stop();
      post({ role: "one", text: he ? "לא מצאתי ספקים כרגע." : "I couldn't find providers just now." });
    }
  };
  const createProvider = (
    item: { name: string; category: string; area: string; blurb: string },
    procId?: string,
  ) => {
    const he = lang === "he";
    const biz: Business = {
      id: `prov_${Date.now()}`,
      name: item.name,
      emoji: "🏢",
      category: item.category || (he ? "ספק" : "Provider"),
      rating: 0,
      reviews: 0,
      address: item.area || "",
      phone: "",
      blurb: item.blurb || "",
      hours: [],
      services: [],
      slots: [],
    };
    setBusinesses((list) => [biz, ...list]);
    const proc = procId ? units.find((u) => u.id === procId) : null;
    const confirm: ChatMsg = {
      role: "one",
      text: proc
        ? he
          ? `✅ הוספתי את ${biz.name} לספקים ולתהליך "${proc.title}". מכין פנייה בטיוטות.`
          : `✅ Added ${biz.name} to your providers and to "${proc.title}". Preparing an outreach draft in Drafts.`
        : he
          ? `✅ הוספתי את ${biz.name} לאנשי הקשר שלך.`
          : `✅ Added ${biz.name} to your connections.`,
    };
    if (proc) {
      setUnits((list) =>
        list.map((u) =>
          u.id === proc.id
            ? {
                ...u,
                people: Array.from(new Set([...(u.people ?? []), biz.name])),
                businessId: u.businessId ?? biz.id,
              }
            : u,
        ),
      );
      setUnitChat((c) => [...c, confirm]);
      void composeDraft(proc, he ? `פנה אל ${biz.name} בנוגע ל${proc.title}` : `Reach out to ${biz.name} about ${proc.title}`);
    } else {
      addContact(biz.name);
      setChat((c) => [...c, confirm]);
    }
  };
  // Book a chosen slot into a process — creating a lightweight one if needed —
  // writing the time to the timeline, a "When" metric, and a confirmation line.
  const bookSlot = (slot: string, topic: string, procId?: string) => {
    const he = lang === "he";
    const existing = procId ? units.find((u) => u.id === procId) : null;
    const target: Process =
      existing ?? {
        id: `book_${Date.now()}`,
        identityId: activeIdentityId,
        emoji: "📅",
        title: he ? `תור — ${topic}` : `Appointment — ${topic}`,
        time: "now",
        unread: 0,
        summary: "",
        relation: he ? "קביעת תור" : "Booking",
        progress: { done: 0, total: 2 },
        people: [],
        steps: [
          { label: he ? "לבחור זמן" : "Pick a time", done: false },
          { label: he ? "לאשר את התור" : "Confirm the appointment", done: false },
        ],
        decisions: [],
        timeline: [],
        type: "booking",
        metrics: [],
      };
    const whenLabel = he ? "מועד" : "When";
    const metrics = target.metrics ?? [];
    const nextMetrics = metrics.some((m) => m.label === whenLabel)
      ? metrics.map((m) => (m.label === whenLabel ? { ...m, value: slot } : m))
      : [...metrics, { label: whenLabel, value: slot }];
    const booked: Process = {
      ...target,
      time: "now",
      unread: 0,
      summary: he ? `נקבע: ${slot}.` : `Booked: ${slot}.`,
      nextAction: he ? `אשלח תזכורת 24 שעות לפני ${slot}.` : `I'll remind you 24h before ${slot}.`,
      metrics: nextMetrics,
      steps: target.steps.map((s) =>
        /book|confirm|time|schedul|זמן|תור|לאשר|לבחור/i.test(s.label) ? { ...s, done: true } : s,
      ),
      timeline: [
        { at: "now", text: he ? `קבעת ל${slot}.` : `You booked ${slot}.` },
        ...target.timeline,
      ],
      decisions: [he ? `מועד נבחר: ${slot}` : `Time chosen: ${slot}`, ...target.decisions],
    };
    const confirm: ChatMsg = {
      role: "one",
      text: he
        ? `✅ קבעתי — ${slot}. הוספתי את זה לתהליך והכנתי תזכורת 24 שעות לפני.`
        : `✅ Locked in — ${slot}. Added to the process, with a reminder 24h before.`,
    };
    // Booking always leaves a real reminder behind — the promise made concrete.
    addReminder(
      booked.identityId,
      he ? `לפני ${topic}` : `Before ${topic}`,
      he ? `24 שעות לפני ${slot}` : `24h before ${slot}`,
      booked.id,
    );
    // Collapse the tapped slot-picker back to plain text so it isn't left
    // re-tappable (the effect that persists the thread would keep it otherwise).
    const settle = (m: ChatMsg): ChatMsg => (m.booking ? { ...m, booking: undefined } : m);
    if (existing && procId) {
      // Booking inside an open process — stay put, append to its thread.
      upsert(booked);
      setUnitChat((c) => [...c.map(settle), { role: "user", text: slot }, confirm]);
    } else {
      // Booking from home — create the process, seed its thread, and open it.
      upsert({ ...booked, chat: [confirm] });
      setChat((c) => c.map(settle));
      announce(`Booked: ${slot}`, `נקבע: ${slot}`);
      openUnit(booked);
      setUnitChat([confirm]);
    }
  };
  // ── Forms capability — ONE sets up the right form; YOU fill your own values
  //    (never auto-filled with PII), and the completed form lands as a draft in
  //    a process, ready to review + approve.
  const runForm = (text: string, proc?: Process) => {
    const he = lang === "he";
    const tpl = formForText(text);
    const title = he ? tpl.he : tpl.en;
    setActiveForm({
      title,
      fields: tpl.fields.map((f) => ({ key: f.key, label: he ? f.he : f.en })),
      values: {},
      procId: proc?.id,
    });
    const msg: ChatMsg = {
      role: "one",
      text: he
        ? `📝 הכנתי את הטופס «${title}». מלא את השדות למטה — אתה ממלא, אני לא ממציא פרטים.`
        : `📝 I've set up the "${title}" form. Fill the fields below — you fill it in, I never invent your details.`,
    };
    if (proc) {
      setUnitThinking(false);
      setUnitChat((c) => [...c, msg]);
    } else {
      setThinking(false);
      setChat((c) => [...c, msg]);
    }
  };
  const submitForm = () => {
    if (!activeForm) return;
    const he = lang === "he";
    const af = activeForm;
    const body = af.fields
      .map((f) => `${f.label}: ${(af.values[f.key] || "").trim() || "—"}`)
      .join("\n");
    const draft: UnitDraft = {
      id: `draft_form_${Date.now()}`,
      kind: "form",
      to: he ? "הרשות הרלוונטית" : "the relevant authority",
      subject: af.title,
      body,
      status: "draft",
    };
    const confirm: ChatMsg = {
      role: "one",
      text: he
        ? `✅ הטופס «${af.title}» מוכן ונשמר כטיוטה בתהליך — תבדוק ותאשר.`
        : `✅ The "${af.title}" form is ready and saved as a draft in the process — review and approve.`,
    };
    const existing = af.procId ? units.find((u) => u.id === af.procId) : null;
    if (existing) {
      setUnits((list) =>
        list.map((u) =>
          u.id === existing.id
            ? {
                ...u,
                unread: 0,
                drafts: [...(u.drafts ?? []), draft],
                timeline: [
                  { at: "now", text: he ? `מילאת את הטופס «${af.title}».` : `You filled the "${af.title}" form.` },
                  ...u.timeline,
                ],
              }
            : u,
        ),
      );
      setUnitChat((c) => [
        ...c,
        { role: "user", text: he ? `מילאתי את «${af.title}»` : `Filled "${af.title}"` },
        confirm,
      ]);
    } else {
      const proc: Process = {
        id: `form_${Date.now()}`,
        identityId: activeIdentityId,
        emoji: "🗂️",
        title: af.title,
        time: "now",
        unread: 0,
        summary: he ? `הטופס «${af.title}» מוכן.` : `"${af.title}" form ready.`,
        relation: he ? "טופס" : "Form",
        progress: { done: 1, total: 2 },
        people: [],
        steps: [
          { label: he ? "למלא את הטופס" : "Fill the form", done: true },
          { label: he ? "להגיש" : "Submit", done: false },
        ],
        decisions: [],
        timeline: [{ at: "now", text: he ? `מילאת את הטופס «${af.title}».` : `You filled the "${af.title}" form.` }],
        type: "form",
        drafts: [draft],
        chat: [confirm],
      };
      upsert(proc);
      openUnit(proc);
      setUnitChat([confirm]);
    }
    setActiveForm(null);
  };
  // Run an action chip from a ONE message (enable a capability, or upgrade).
  const runChatAction = (a: {
    label: string;
    kind: "enableCap" | "upgrade" | "shareMem" | "routeProcess" | "routeProfile";
    cap?: string;
    run?: string;
    mem?: string;
    proc?: string;
  }) => {
    if (a.kind === "upgrade") {
      setOpenSheet("subscription");
      return;
    }
    // Route a personal ask off a business seat: switch to the personal profile
    // (or open the new-profile chooser) and re-arm the message so you just re-send.
    if (a.kind === "routeProfile") {
      if (a.proc) setActiveIdentityId(a.proc);
      else setOpenSheet("newProfile");
      if (a.run) setDraft(a.run);
      setProfilesOpen(false);
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
      // If the ask clearly belongs to an existing process (e.g. "practice the
      // theory test" ↔ the driving-licence process), run the quiz INSIDE it so
      // the learning lands on the unit — not in the ephemeral home chat.
      const target = matchProcessForText(text);
      if (target) {
        setThinking(false); // hand off from the home chat to the process thread
        openUnit(target);
        setUnitThinking(true);
        void runQuiz(text, target);
      } else {
        void runQuiz(text);
      }
      return;
    }

    // Profile-aware guard: on a business / supplier seat, a clearly personal
    // request (dentist, doctor, haircut, passport…) shouldn't spawn a business
    // process. ONE flags the mismatch and offers to handle it on your personal
    // profile instead — the right ONE for the right hat.
    const PERSONAL_RE =
      /\b(dentist|dental|doctor|clinic|gp|therapist|haircut|barber|salon|passport|driver'?s? licen[sc]e|gym|personal train)\b|רופא שיניים|שיניים|רופא|מרפאה|תספורת|מספרה|דרכון|רישיון נהיגה|רשיון נהיגה|חדר כושר|כושר|פיזיותרפ/i;
    if (
      (identity.kind ?? "personal") !== "personal" &&
      PERSONAL_RE.test(text) &&
      !activeProcess
    ) {
      setThinking(false);
      const personal = identities.find((i) => (i.kind ?? "personal") === "personal");
      setChat((c) => [
        ...c,
        {
          role: "one",
          text:
            lang === "he"
              ? `זה נשמע אישי, ואתה עכשיו על פרופיל ${identity.role}. לטפל בזה תחת פרופיל אישי?`
              : `That sounds personal, and you're on your ${identity.role} profile. Handle it on a personal profile instead?`,
          actions: [
            personal
              ? {
                  label: (lang === "he" ? "👤 עבור ל" : "👤 Switch to ") + personal.name,
                  kind: "routeProfile" as const,
                  proc: personal.id,
                  run: text,
                }
              : {
                  label: lang === "he" ? "👤 צור פרופיל אישי" : "👤 Create a personal profile",
                  kind: "routeProfile" as const,
                  run: text,
                },
          ],
        },
      ]);
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

    // Booking capability (switched on, no specific business named): ONE proposes
    // real time slots as chips; tapping one books it into a process.
    if (capKey === "booking") {
      runBooking(text);
      return;
    }
    // Reminders capability: "remind me…" becomes a real held reminder.
    if (capKey === "reminders") {
      runReminder(text);
      return;
    }
    // Forms capability: ONE sets up the form for you to fill (never auto-filled).
    if (capKey === "forms" && !activeForm) {
      runForm(text);
      return;
    }
    // Providers capability: ONE finds candidate providers you can add + reach.
    if (capKey === "providers") {
      void runProviders(text);
      return;
    }

    // Question vs. intent — a pure question gets a straight answer, not a new
    // process. (Skipped when a business is named, above, so ONE still consults
    // that business's ONE for "how much is X at <biz>?".)
    if (isPureQuestion(text)) {
      // Live web first — for a factual question ONE pulls the CURRENT internet
      // (prices, dates, availability) with real source links, instead of relying
      // on stale model knowledge. Off (cost switch) or unavailable → falls
      // through to ONE's ordinary answer below.
      if (aiWeb) {
        const web = await searchWeb(text, msgLang(text));
        if (web) {
          setThinking(false);
          const top = web.citations[0];
          let host = "";
          if (top) {
            try {
              host = new URL(top.url).hostname.replace(/^www\./, "");
            } catch {
              /* keep empty */
            }
          }
          setChat((c) => [
            ...c,
            {
              role: "one",
              text: web.text,
              cite: {
                emoji: "🌐",
                label: top ? top.title.slice(0, 44) : msgLang(text) === "he" ? "מהאינטרנט" : "From the web",
                host,
              },
            },
          ]);
          return;
        }
      }
      // Regulated domain? Answer FROM the official source and cite it.
      const src = sourceForText(text);
      const srcHint = src
        ? lang === "he"
          ? `זו שאלה בתחום מוסדר. ענה על סמך המקור הרשמי "${src.he}" (${src.host}); אם פרט מסוים משתנה או לא ודאי, אמור לבדוק מול המקור.`
          : `This is a regulated-domain question. Answer based on the official source "${src.en}" (${src.host}); if a detail varies or is uncertain, say to verify with the source.`
        : undefined;
      try {
        const reply = await invokeAiChat(
          [
            {
              role: "system",
              content: oneSystemPrompt(lang, [memoryContext(), srcHint].filter(Boolean).join(" ")),
            },
            ...priorChat.slice(-8).map((m) => ({
              role: (m.role === "one" ? "assistant" : "user") as AiChatMessage["role"],
              content: m.text,
            })),
            { role: "user", content: text },
          ],
          { maxTokens: 240 },
        );
        setThinking(false);
        setChat((c) => [
          ...c,
          {
            role: "one",
            text: reply,
            cite: src
              ? { emoji: src.emoji, label: lang === "he" ? src.he : src.en, host: src.host }
              : undefined,
          },
        ]);
      } catch {
        setThinking(false);
        setChat((c) => [
          ...c,
          {
            role: "one",
            text: lang === "he" ? "לא הצלחתי לענות על זה כרגע." : "I couldn't answer that just now.",
          },
        ]);
      }
      return;
    }

    const focus = units.find((p) => p.id === focusId) ?? null;
    const res = interpret(text, {
      identityId: activeIdentityId,
      now: Date.now(),
      processes,
      focus,
      lang,
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
      if (isNewProcess && res.process) {
        // The home chat BECOMES the unit chat: seed the new unit's thread with
        // this exchange, open it there, and clear the home chat so the whole
        // conversation (and everything that follows) lives in the process — not
        // orphaned on the home canvas.
        const seed: ChatMsg[] = [
          { role: "user", text },
          { role: "one", text: reply },
        ];
        upsert({ ...res.process, chat: seed });
        if (res.broadcast) setLiveBroadcast(res.broadcast);
        // Only hand the user INTO the new unit once it's a real, recognisable
        // one — its title + emoji are ready. Never open a bare shell.
        if (res.process.title?.trim() && res.process.emoji?.trim()) {
          openUnit({ ...res.process, chat: seed });
          setUnitChat(seed);
          setChat([]);
        }
        void enrichProcessPlan(res.process, text, true);
      } else {
        // A plain reply, or an update to an existing process — stays in the home
        // chat. If it clearly belongs to a process, offer to continue it there.
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
      }
    } catch {
      // AI unreachable — degrade gracefully with an HONEST, message-mirrored
      // line (never the local brain's fabricated "reaching out to N companies").
      window.setTimeout(() => {
        setThinking(false);
        const he = msgLang(text) === "he";
        const line = res.process
          ? he
            ? `פתחתי את "${res.process.title}" ואני על זה. לא הצלחתי להתחבר כרגע — נסה שוב עוד רגע ואתן לך תשובה מלאה.`
            : `I've opened "${res.process.title}" and I'm on it. I couldn't connect just now — try again in a moment for a full reply.`
          : he
            ? "רשמתי — אני על זה. לא הצלחתי להתחבר כרגע, נסה שוב עוד רגע."
            : "Noted — I'm on it. I couldn't connect just now; try again in a moment.";
        if (isNewProcess && res.process) {
          const seed: ChatMsg[] = [
            { role: "user", text },
            { role: "one", text: line },
          ];
          upsert({ ...res.process, chat: seed });
          if (res.broadcast) setLiveBroadcast(res.broadcast);
          if (res.process.title?.trim() && res.process.emoji?.trim()) {
            openUnit({ ...res.process, chat: seed });
            setUnitChat(seed);
            setChat([]);
          }
        } else {
          setChat((c) => [...c, { role: "one", text: line }]);
          applyStructured();
        }
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
    setThreadFilter("all");
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
              text:
                lang === "he"
                  ? `הנה "${p.title}".${p.nextAction ? " " + p.nextAction : " ספר לי מה השתנה ואעדכן."}`
                  : `Here's "${p.title}".${p.nextAction ? " " + p.nextAction : " Tell me what changed and I'll update it."}`,
            },
          ],
    );
    closeDrawerOnMobile();
  };
  // Answer the return leg of the two-sided loop: mark the reply seen, fold it
  // into the originating process's thread (as the other side speaking), and open
  // that process so you land right where the conversation continues.
  const openReplySignal = (req: InboundRequest) => {
    updateRequest(req.id, { replySeen: true });
    const proc = units.find((u) => u.id === req.procId);
    if (proc) {
      const supplierName =
        identities.find((i) => i.id === req.toProfileId)?.name ??
        (lang === "he" ? "הצד השני" : "the other side");
      const replyMsg: ChatMsg = {
        role: "one",
        party: "them",
        from: supplierName,
        text: req.reply ?? "",
      };
      setUnits((list) =>
        list.map((u) =>
          u.id === proc.id
            ? { ...u, unread: 0, chat: [...(u.chat ?? []), replyMsg] }
            : u,
        ),
      );
      openUnit({ ...proc, chat: [...(proc.chat ?? []), replyMsg] });
    } else {
      openInbox();
    }
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
    // A shared unit copies its JOIN LINK (others land in the same group); an
    // unshared one copies a plain summary.
    const origin = typeof window !== "undefined" ? window.location.origin : "https://one01.io";
    const text = activeProcess.shareCode
      ? `${origin}/app?join=${activeProcess.shareCode}`
      : `${activeProcess.emoji} ${activeProcess.title}${activeProcess.nextAction ? " — " + activeProcess.nextAction : ""}`;
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
  useEffect(() => {
    activeUnitRef.current = activeProcess?.id ?? null;
  }, [activeProcess]);
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
          lang,
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
  const openConnections = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    endChat();
    closeDrawerOnMobile();
    setSpace("connections");
  };
  const openInbox = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    endChat();
    closeDrawerOnMobile();
    setSpace("inbox");
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
  // The other side answers — for real. ONE hands the outreach to an AI playing
  // the recipient (office / business / person) so the reply reads like a genuine
  // response, still inside the thread. Falls back to a polite ack if offline.
  const counterpartReply = async (fromName: string, gist: string): Promise<string> => {
    const he = lang === "he";
    const fallback = he
      ? "קיבלנו את הפנייה, תודה. נחזור אליך עם פרטים בהקדם."
      : "Got your message, thank you. We'll come back to you with details shortly.";
    try {
      const sys = he
        ? `אתה "${fromName}" — הנמען של פנייה מלקוח. השב בקצרה (1‑2 משפטים), אמין ומנומס, בגוף ראשון מטעם ${fromName}, כאילו קיבלת את הפנייה עכשיו. עברית. בלי הקדמות ובלי חתימה.`
        : `You are "${fromName}", the recipient of a customer's outreach. Reply briefly (1-2 sentences), realistic and polite, first person as ${fromName}, as if you just received it. No preamble, no signature.`;
      const reply = await invokeAiChat(
        [
          { role: "system", content: sys },
          { role: "user", content: gist },
        ],
        { maxTokens: 120, temperature: 0.6 },
      );
      return reply.trim() || fallback;
    } catch {
      return fallback;
    }
  };
  const approveDraft = (procId: string, draftId: string) => {
    const proc = units.find((u) => u.id === procId);
    const draft = proc?.drafts?.find((d) => d.id === draftId);
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
    // Approving sends the message into the process thread (not off to WhatsApp/
    // email) — ONE delivers it to the other side, who then replies right here.
    if (draft && activeProcess?.id === procId) {
      const to = draft.to || (lang === "he" ? "הצד השני" : "the other side");
      setUnitChat((c) => [
        ...c,
        {
          role: "one",
          party: "one",
          text:
            lang === "he"
              ? `📨 שלחתי ל${to}${draft.subject ? ` בנושא "${draft.subject}"` : ""}. אעדכן ברגע שתהיה תשובה.`
              : `📨 Sent to ${to}${draft.subject ? ` re "${draft.subject}"` : ""}. I'll update you the moment they reply.`,
        },
      ]);
      // If the recipient IS one of your supplier profiles, drop a real request
      // into that profile's inbox — the actual two-sided handshake. (Otherwise
      // the AI-played counterpart answers in-thread as before.)
      const toLc = to.toLowerCase();
      const supplier = identities.find(
        (i) =>
          i.kind === "supplier" &&
          (toLc.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(toLc)),
      );
      if (supplier) {
        sendRequest(
          supplier.id,
          draft.subject || (lang === "he" ? "פנייה חדשה" : "New request"),
          draft.body,
          identity.name,
          { fromProfileId: activeIdentityId, procId: activeProcess?.id },
        );
      }
      // The other side answers — an AI plays the recipient, inside the thread.
      void counterpartReply(to, `${draft.subject ? draft.subject + " — " : ""}${draft.body}`).then(
        (reply) => {
          setUnitChat((c) => [...c, { role: "one", party: "them", from: to, text: reply }]);
        },
      );
    }
  };
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
    // Mid-interview? A typed line answers ONE's current tailoring question (the
    // choices are optional — you can always just write). ONE then continues the
    // interview or, when it has enough, writes your plan and leads.
    if (intakeRef.current && intakeRef.current.procId === proc.id) {
      setUnitDraft("");
      answerIntake(text);
      return;
    }
    const priorChat = unitChat; // snapshot the transcript for the AI, pre-append
    setUnitChat((c) => [...c, { role: "user", text }]);
    setUnitDraft("");
    setUnitThinking(true);
    // "Write the email / message them" → ONE composes a real outward draft you
    // can review in the Drafts section, instead of just replying about it.
    if (DRAFT_INTENT.test(text.toLowerCase())) {
      // If the other side is already in this thread, don't draft a fresh card —
      // just relay the follow-up to them and surface their reply, keeping the
      // back-and-forth flowing inside the process.
      const priorThem = [...priorChat].reverse().find((m) => m.party === "them");
      if (priorThem) {
        const to = priorThem.from || (lang === "he" ? "הצד השני" : "the other side");
        setUnitThinking(false);
        setUnitChat((c) => [
          ...c,
          {
            role: "one",
            party: "one",
            text: lang === "he" ? `📨 העברתי ל${to}.` : `📨 Passed that to ${to}.`,
          },
        ]);
        const reply = await counterpartReply(to, text);
        setUnitChat((c) => [...c, { role: "one", party: "them", from: to, text: reply }]);
        return;
      }
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
    // Booking inside a process — ONE proposes real slots that book straight into
    // THIS process's timeline (the "into the process" half of the capability).
    if (caps.includes("booking") && capabilityForText(text) === "booking") {
      runBooking(text, proc);
      return;
    }
    // Reminders inside a process — a held reminder attached to THIS process.
    if (caps.includes("reminders") && capabilityForText(text) === "reminders") {
      runReminder(text, proc);
      return;
    }
    // Quiz inside a process — teach/practice runs in THIS thread and passing it
    // ticks the learning step + logs it (the capability executing in the unit).
    if (caps.includes("quiz") && !quiz && capabilityForText(text) === "quiz") {
      void runQuiz(text, proc);
      return;
    }
    // Forms inside a process — fill a form straight into THIS process's drafts.
    if (caps.includes("forms") && !activeForm && capabilityForText(text) === "forms") {
      runForm(text, proc);
      return;
    }
    // Providers inside a process — find + add providers for THIS process.
    if (caps.includes("providers") && capabilityForText(text) === "providers") {
      void runProviders(text, proc);
      return;
    }
    const focus = units.find((u) => u.id === proc.id) ?? null;
    const res = interpret(text, { identityId: activeIdentityId, now: Date.now(), processes, focus, lang });

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
      // Everything already gathered about this process (intake answers in
      // `fields` + curated `metrics`). Feed it so ONE builds on what it knows
      // and never re-asks something already answered (e.g. it's a pool party).
      const known = [
        ...Object.entries((focus ?? proc).fields ?? {}).map(([k, v]) => `${k}: ${v}`),
        ...((focus ?? proc).metrics ?? []).map((m) => `${m.label}: ${m.value}`),
      ].filter((s) => s && !/:\s*$/.test(s));
      const factsExtra = known.length
        ? `Known details for this process — treat as decided, do NOT ask about any of these again, build on them: ${known.join("; ")}.`
        : "";
      const extra = [scopeExtra, factsExtra, memoryContext()].filter(Boolean).join(" ");
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
        // Act on anything concrete first (a named time still gets booked)…
        applyStructured();
        const booked = advanceUnitFromChat(proc.id, text);
        const he = msgLang(text) === "he";
        // …then a single honest, message-mirrored line — never the local brain's
        // fabricated English "I'm reaching out to N companies".
        setUnitChat((c) => [
          ...c,
          {
            role: "one",
            text: booked
              ? he
                ? `סגור — קבעתי ל${booked} ועדכנתי את התהליך.`
                : `Done — booked for ${booked}. I've moved the process forward.`
              : he
                ? "רשמתי ועדכנתי את התהליך. לא הצלחתי להתחבר כרגע — נסה שוב עוד רגע."
                : "Noted and updated the process. I couldn't connect just now — try again in a moment.",
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
  // reopening it (or a reload) restores the whole conversation. Any change to
  // the transcript is real activity, so we stamp `updatedAt` here — that's what
  // drives the live relative time in the side list.
  useEffect(() => {
    if (!activeProcess || unitChat.length === 0) return;
    const stamp = Date.now();
    setUnits((list) =>
      list.map((u) => (u.id === activeProcess.id ? { ...u, chat: unitChat, updatedAt: stamp } : u)),
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

  // Broadcast pulse — instead of ticking through the lines forever (which reads
  // as a nagging loop), ONE rests on the opening line most of the time and only
  // sweeps through what's waiting now and then. So: long dwell on line 0, a brisk
  // pass across the rest, then settle back and pause. Re-runs when the lines
  // actually change (new process/reminder) or the ONE switches.
  useEffect(() => {
    setBi(0);
    setBfade(false);
    const n = broadcastLines.length;
    if (n < 2) return; // nothing to sweep — hold the single line
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      setBfade(true);
      timer = setTimeout(() => {
        idx = (idx + 1) % n;
        setBi(idx);
        setBfade(false);
        schedule();
      }, 300);
    };
    const schedule = () => {
      // Settled on the opening line → a long, calm pause; mid-sweep → brisk.
      timer = setTimeout(advance, idx === 0 ? 13000 : 4400);
    };
    schedule();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdentityId, broadcastLines]);

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
  // The active profile's lens — which Global worlds this hat is allowed to see.
  const lens = PROFILE_LENS[identity.kind ?? "personal"];
  const allowedWorlds = WORLD_KEYS.filter((k) => lens.worldScopes.includes(WORLD_SCOPE[k]));
  const worldAllowed = (b: Business) => allowedWorlds.includes(worldOf(b.category));
  // Supplier lens leads with the inbox: how many requests are waiting on you.
  const inboxNew = requests.filter(
    (r) => r.toProfileId === activeIdentityId && r.status === "new",
  ).length;
  const inboxTotal = requests.filter((r) => r.toProfileId === activeIdentityId).length;
  // Global filtered by profile lens first, then by the selected world tab.
  const worldBiz = (world === "all" ? businesses : businesses.filter((b) => worldOf(b.category) === world)).filter(
    worldAllowed,
  );
  // Updates surface (scroll down) — processes, the ones needing you first.
  const updatesList = [...processes].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0));
  // Pending reminders for this profile — surfaced atop Updates ("what's waiting").
  const pendingReminders = reminders.filter(
    (r) => r.identityId === activeIdentityId && !r.done,
  );
  // The live form card (Forms capability) — rendered in whichever chat it belongs
  // to. Fields start empty; the user types their own values (no PII auto-fill).
  const formCard = activeForm ? (
    <div className="chat-form">
      <div className="chat-form-title">🗂️ {activeForm.title}</div>
      {activeForm.fields.map((f) => (
        <label className="chat-form-row" key={f.key}>
          <span className="chat-form-label">{f.label}</span>
          <input
            className="chat-form-input"
            value={activeForm.values[f.key] ?? ""}
            onChange={(e) =>
              setActiveForm((af) =>
                af ? { ...af, values: { ...af.values, [f.key]: e.target.value } } : af,
              )
            }
          />
        </label>
      ))}
      <div className="chat-form-actions">
        <button className="sheet-pill" onClick={submitForm}>
          {lang === "he" ? "הכן טופס" : "Prepare form"}
        </button>
        <button className="chat-form-cancel" onClick={() => setActiveForm(null)}>
          {lang === "he" ? "בטל" : "Cancel"}
        </button>
      </div>
    </div>
  ) : null;
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
      {(voiceCall || voiceConnecting) && (
        <div
          ref={voiceBubbleRef}
          className={`voice-bubble${voiceSpeaking ? " speaking" : ""}${voiceConnecting ? " connecting" : ""}${voiceMini ? " mini" : ""}`}
          style={voicePos ? { left: voicePos.x, top: voicePos.y, right: "auto", bottom: "auto" } : undefined}
          onPointerDown={onBubbleDown}
          onPointerMove={onBubbleMove}
          onPointerUp={onBubbleUp}
          role="dialog"
          aria-label={lang === "he" ? "שיחה עם ONE" : "Call with ONE"}
        >
          <div className="vb-grip" aria-hidden="true" />
          <div className="vb-main">
            <div className="vb-orb">
              <Orb size={voiceMini ? 40 : 54} alive faceColor="var(--p-face)" eyeColor="var(--p-bg)" />
            </div>
            {!voiceMini && (
              <div className="vb-body">
                <div className="vb-status">
                  {voiceConnecting
                    ? lang === "he"
                      ? "מתחבר…"
                      : "Connecting…"
                    : voiceSpeaking
                      ? "ONE"
                      : lang === "he"
                        ? "מקשיב…"
                        : "Listening…"}
                </div>
                {voiceCaption && !voiceConnecting && (
                  <div className="vb-caption" dir="auto">
                    {voiceCaption}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="vb-controls">
            <button
              className={`vb-btn${voiceMuted ? " off" : ""}`}
              onClick={toggleVoiceMute}
              disabled={!voiceCall}
              aria-label={voiceMuted ? (lang === "he" ? "בטל השתקה" : "Unmute") : lang === "he" ? "השתק" : "Mute"}
            >
              <i className={`fi ${voiceMuted ? "fi-rr-microphone-slash" : "fi-rr-microphone"}`} aria-hidden="true" />
            </button>
            <button
              className="vb-btn"
              onClick={() => setVoiceMini((m) => !m)}
              aria-label={voiceMini ? (lang === "he" ? "הרחב" : "Expand") : lang === "he" ? "מזער" : "Minimize"}
            >
              <i className={`fi ${voiceMini ? "fi-rr-angle-up" : "fi-rr-angle-down"}`} aria-hidden="true" />
            </button>
            <button
              className="vb-btn vb-end"
              onClick={endVoiceCall}
              aria-label={lang === "he" ? "סיים שיחה" : "End call"}
            >
              <i className="fi fi-rr-cross" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
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
              <OneWord
                className={`app-brand-mark${
                  oneWorking && !chatFocused ? " is-working" : ""
                }${chatFocused ? " chat-focused" : ""}`}
              />
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
                  {identities.filter((id) => id.id !== activeIdentityId).map((id) => (
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
                  <button
                    className="drawer-row drawer-row-new"
                    onClick={() => setOpenSheet("newProfile")}
                  >
                    <i className="fi fi-rr-plus drawer-row-ico" aria-hidden="true" />
                    {t.newProfile}
                  </button>
                </div>
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-label">{t.processes}</div>
              {/* Stable order — never reshuffle just because you opened one (which
                  clears its unread). New units are prepended, so recent stays on top. */}
              {processes.map((p) => {
                const when = p.updatedAt ? relTime(p.updatedAt) : "";
                return (
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
                          {when && (
                            <>
                              {" · "}
                              {when}
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
                );
              })}
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
            <button className="drawer-row" onClick={openConnections}>
              <i className="fi fi-rr-users-alt drawer-row-ico" aria-hidden="true" />
              {t.connectionsNav}
            </button>
            {identity.kind === "supplier" && (
              <button className="drawer-row" onClick={openInbox}>
                <i className="fi fi-rr-inbox drawer-row-ico" aria-hidden="true" />
                {lang === "he" ? "תיבת פניות" : "Inbox"}
                {(() => {
                  const unread = requests.filter(
                    (r) => r.toProfileId === activeIdentityId && r.status === "new",
                  ).length;
                  return unread > 0 ? <span className="drawer-badge">{unread}</span> : null;
                })()}
              </button>
            )}
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
                        {activeLive.shareCode ? (
                          <span className="unit-shared-tag">
                            <i className="fi fi-rr-users" aria-hidden="true" />{" "}
                            {lang === "he" ? "משותף" : "Shared"}
                            {" · "}
                            {(sharedMembers[activeLive.shareCode] ?? [myName]).length}
                          </span>
                        ) : (
                          activeLive.relation
                        )}
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
                            {activeLive.shareCode ? (
                              <button
                                className={`unit-menu-item${unitShared ? " ok" : ""}`}
                                onClick={shareUnit}
                                role="menuitem"
                              >
                                <i
                                  className={`fi ${unitShared ? "fi-rr-check" : "fi-rr-link"}`}
                                  aria-hidden="true"
                                />{" "}
                                {unitShared
                                  ? t.copied
                                  : lang === "he"
                                    ? "העתק קישור שיתוף"
                                    : "Copy share link"}
                              </button>
                            ) : (
                              <button
                                className="unit-menu-item"
                                onClick={() => {
                                  setUnitMenuOpen(false);
                                  void startSharedRoom(activeLive);
                                }}
                                role="menuitem"
                                disabled={shareBusy}
                              >
                                <i className="fi fi-rr-share" aria-hidden="true" />{" "}
                                {shareBusy
                                  ? lang === "he"
                                    ? "משתף…"
                                    : "Sharing…"
                                  : lang === "he"
                                    ? "שתף יחידה (הפוך לקבוצה)"
                                    : "Share unit (make it a group)"}
                              </button>
                            )}
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
                  {activeLive.shareCode && (
                    <div className="unit-shared-bar">
                      <div className="usb-members">
                        {(sharedMembers[activeLive.shareCode] ?? [myName]).map((n) => (
                          <span key={n} className="usb-chip">
                            {n}
                          </span>
                        ))}
                      </div>
                      <ShareLink code={activeLive.shareCode} lang={lang} />
                    </div>
                  )}
                  <div className="unit-chat-scroll">
                    {/* Once the other side is in the thread, let you filter the
                        conversation down to one voice — you / ONE / them. */}
                    {unitChat.some((mm) => mm.party === "them") && (
                      <div className="thread-filter">
                        {(["all", "you", "one", "them"] as const).map((f) => (
                          <button
                            key={f}
                            className={`thread-chip${threadFilter === f ? " is-on" : ""}`}
                            onClick={() => setThreadFilter(f)}
                          >
                            {f === "all"
                              ? lang === "he"
                                ? "הכל"
                                : "All"
                              : f === "you"
                                ? lang === "he"
                                  ? "אני"
                                  : "You"
                                : f === "one"
                                  ? "ONE"
                                  : lang === "he"
                                    ? "הצד השני"
                                    : "Them"}
                          </button>
                        ))}
                      </div>
                    )}
                    {unitChat.map((m, i) => {
                      const party = m.party ?? (m.role === "user" ? "you" : "one");
                      if (threadFilter !== "all" && party !== threadFilter) return null;
                      const cls = party === "you" ? "user" : party === "them" ? "them" : "one";
                      return (
                        <Fragment key={i}>
                          {party === "them" && m.from && <div className="chat-from">{m.from}</div>}
                          {m.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="chat-img" src={m.image} alt="" loading="lazy" />
                          )}
                          <div className={`chat-msg ${cls}`}>{m.text}</div>
                          {/* Answer chips belong only to the CURRENT question —
                              the last message. Once you answer (and ONE moves on),
                              older chips disappear instead of lingering. */}
                          {m.intake && i === unitChat.length - 1 ? (
                            <div className="chat-chips intake-chips">
                              {m.intake.options.map((o, oi) => (
                                <button
                                  key={oi}
                                  className="chat-chip intake-chip"
                                  onClick={() => answerIntake(o)}
                                >
                                  {o}
                                </button>
                              ))}
                              <span className="intake-hint">
                                {lang === "he" ? "או כתוב תשובה משלך" : "or type your own"}
                              </span>
                            </div>
                          ) : m.quiz ? (
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
                          ) : m.booking ? (
                            <div className="chat-chips booking-chips">
                              {m.booking.slots.map((s) => (
                                <button
                                  key={s}
                                  className="chat-chip booking-chip"
                                  onClick={() => bookSlot(s, m.booking!.topic, m.booking!.procId)}
                                >
                                  📅 {s}
                                </button>
                              ))}
                            </div>
                          ) : m.providers ? (
                            <div className="prov-list">
                              {m.providers.items.map((p, pi) => (
                                <button
                                  key={pi}
                                  className="prov-card"
                                  onClick={() => createProvider(p, m.providers!.procId)}
                                >
                                  <span className="prov-avatar" aria-hidden="true">🏢</span>
                                  <span className="prov-body">
                                    <span className="prov-name">{p.name}</span>
                                    <span className="prov-meta">
                                      {[p.category, p.area].filter(Boolean).join(" · ")}
                                    </span>
                                    {p.blurb && <span className="prov-blurb">{p.blurb}</span>}
                                  </span>
                                  <span className="prov-add" aria-hidden="true">＋</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            m.chips &&
                            m.chips.length > 0 && (
                              <div className="chat-chips">
                                {m.chips.map((c) => (
                                  <button key={c} className="chat-chip" onClick={() => sendToUnit(c)}>
                                    {c}
                                  </button>
                                ))}
                              </div>
                            )
                          )}
                        </Fragment>
                      );
                    })}
                    {/* ONE's living presence in the unit thread — same figure as
                        home: blinks at rest, wakes while you type, concentrates
                        (eyes shut) while it works. */}
                    <div className="chat-presence-row" aria-live="polite">
                      <span ref={unitPresenceRef} className="chat-presence-pump">
                        <Orb
                          size={30}
                          alive
                          look={unitDraft.trim() && !unitThinking ? -0.28 : 0}
                          faceColor="var(--p-face)"
                          eyeColor="var(--p-bg)"
                          className={`chat-presence${unitDraft.trim() && !unitThinking ? " awake" : ""}${unitThinking ? " thinking" : ""}`}
                        />
                      </span>
                      {unitThinking && (
                        <span className="chat-presence-hint">
                          {statusLabel}
                          <span className="think-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        </span>
                      )}
                    </div>
                    {activeForm && activeForm.procId === activeProcess?.id && formCard}
                    <div ref={unitEndRef} />
                  </div>
                  <div className="app-dock unit-dock">
                    <AppInput
                      value={unitDraft}
                      onChange={(v) => {
                        setUnitDraft(v);
                        pumpPresence(unitPresenceRef);
                      }}
                      onSend={sendToUnit}
                      onVoiceTap={startVoiceCall}
                      voiceOn={aiVoice}
                      placeholder={t.tellChanged}
                      lang={lang}
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
                    onWorkStep={(proc, label) =>
                      sendToUnit(
                        lang === "he"
                          ? `בוא נתקדם עם: "${label}". מאיפה מתחילים?`
                          : `Let's move "${label}" forward — where do we start?`,
                        proc,
                      )
                    }
                    onAddConnection={(proc) =>
                      sendToUnit(
                        lang === "he"
                          ? "הצע לי אנשי קשר או ספקים רלוונטיים לתהליך הזה שאוכל להוסיף."
                          : "Suggest people or providers relevant to this process that I could add.",
                        proc,
                      )
                    }
                    onCover={(procId, url) =>
                      setUnits((list) =>
                        list.map((u) => (u.id === procId ? { ...u, coverImage: url } : u)),
                      )
                    }
                    onStepImage={(procId, i, url) =>
                      setUnits((list) =>
                        list.map((u) =>
                          u.id === procId
                            ? { ...u, stepImages: { ...(u.stepImages ?? {}), [i]: url } }
                            : u,
                        ),
                      )
                    }
                    imagesOn={aiImages}
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
                        {identities.map((id) => (
                          <div
                            key={id.id}
                            className="sheet-row"
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <button
                              style={{
                                flex: 1,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                textAlign: "start",
                                padding: 0,
                                font: "inherit",
                                color: "inherit",
                              }}
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
                            {identities.length > 1 && (
                              <button
                                aria-label={lang === "he" ? "מחק פרופיל" : "Delete profile"}
                                title={lang === "he" ? "מחק פרופיל" : "Delete profile"}
                                onClick={() => deleteIdentity(id.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#DC2626",
                                  padding: 6,
                                  borderRadius: 8,
                                  lineHeight: 0,
                                  flexShrink: 0,
                                }}
                              >
                                <i className="fi fi-rr-trash" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          className="sheet-pill ghost"
                          style={{ width: "100%", marginTop: 6, padding: 10 }}
                          onClick={() => setOpenSheet("newProfile")}
                        >
                          + {t.newProfile}
                        </button>
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
                ) : space === "inbox" ? (
                  // ── INBOX (supplier seat) — incoming requests addressed to
                  //    this profile. Accept / decline + reply, closing the
                  //    two-sided loop with the personal side that sent them.
                  <div className="canvas profile-canvas">
                    <div className="canvas-inner">
                      <button className="canvas-back" onClick={goHome}>
                        <span className="canvas-back-ico" aria-hidden="true">‹</span> {t.backHome}
                      </button>
                      <div className="prof-sec-head" style={{ marginTop: 4 }}>
                        <h4 style={{ fontSize: 22 }}>
                          {lang === "he" ? "תיבת פניות" : "Inbox"}
                        </h4>
                        <span className="prof-sec-sub">
                          {lang === "he"
                            ? `פניות שהגיעו אל ${identity.name}`
                            : `Requests addressed to ${identity.name}`}
                        </span>
                      </div>

                      {(() => {
                        const mine = requests
                          .filter((r) => r.toProfileId === activeIdentityId)
                          .sort((a, b) =>
                            a.status === "new" && b.status !== "new"
                              ? -1
                              : a.status !== "new" && b.status === "new"
                                ? 1
                                : 0,
                          );
                        if (mine.length === 0) {
                          return (
                            <p className="conn-empty" style={{ marginTop: 18 }}>
                              {lang === "he"
                                ? "אין פניות עדיין. כשמישהו יפנה אל הפרופיל הזה, זה יופיע כאן."
                                : "No requests yet. When someone reaches this profile, it lands here."}
                            </p>
                          );
                        }
                        return (
                          <div className="inbox-list">
                            {mine.map((r) => (
                              <div className={`inbox-card is-${r.status}`} key={r.id}>
                                <div className="inbox-head">
                                  <span className="inbox-from">
                                    <span className="inbox-avatar">🧑</span>
                                    {r.fromName}
                                  </span>
                                  <span className={`inbox-status st-${r.status}`}>
                                    {r.status === "new"
                                      ? lang === "he"
                                        ? "חדש"
                                        : "New"
                                      : r.status === "accepted"
                                        ? lang === "he"
                                          ? "התקבל"
                                          : "Accepted"
                                        : lang === "he"
                                          ? "נדחה"
                                          : "Declined"}
                                  </span>
                                </div>
                                <div className="inbox-title">{r.title}</div>
                                <p className="inbox-msg">{r.message}</p>

                                {r.reply && (
                                  <div className="inbox-reply-sent">
                                    <span className="inbox-reply-label">
                                      {lang === "he" ? "התשובה שלך" : "Your reply"}
                                    </span>
                                    {r.reply}
                                  </div>
                                )}

                                {r.status === "new" ? (
                                  <>
                                    <div className="inbox-actions">
                                      <button
                                        className="inbox-btn accept"
                                        onClick={() => updateRequest(r.id, { status: "accepted" })}
                                      >
                                        {lang === "he" ? "קבל" : "Accept"}
                                      </button>
                                      <button
                                        className="inbox-btn decline"
                                        onClick={() => updateRequest(r.id, { status: "declined" })}
                                      >
                                        {lang === "he" ? "דחה" : "Decline"}
                                      </button>
                                    </div>
                                    <div className="inbox-reply">
                                      <input
                                        className="mem-input"
                                        value={replyDrafts[r.id] ?? ""}
                                        placeholder={
                                          lang === "he" ? "כתוב תשובה…" : "Write a reply…"
                                        }
                                        onChange={(e) =>
                                          setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && (replyDrafts[r.id] ?? "").trim()) {
                                            updateRequest(r.id, {
                                              reply: replyDrafts[r.id].trim(),
                                              status: "accepted",
                                            });
                                            setReplyDrafts((d) => ({ ...d, [r.id]: "" }));
                                          }
                                        }}
                                      />
                                      <button
                                        className="sheet-pill"
                                        disabled={!(replyDrafts[r.id] ?? "").trim()}
                                        onClick={() => {
                                          updateRequest(r.id, {
                                            reply: (replyDrafts[r.id] ?? "").trim(),
                                            status: "accepted",
                                          });
                                          setReplyDrafts((d) => ({ ...d, [r.id]: "" }));
                                        }}
                                      >
                                        {lang === "he" ? "שלח" : "Send"}
                                      </button>
                                    </div>
                                  </>
                                ) : !r.reply ? (
                                  <div className="inbox-reply">
                                    <input
                                      className="mem-input"
                                      value={replyDrafts[r.id] ?? ""}
                                      placeholder={
                                        lang === "he" ? "הוסף תשובה…" : "Add a reply…"
                                      }
                                      onChange={(e) =>
                                        setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                                      }
                                    />
                                    <button
                                      className="sheet-pill"
                                      disabled={!(replyDrafts[r.id] ?? "").trim()}
                                      onClick={() => {
                                        updateRequest(r.id, { reply: (replyDrafts[r.id] ?? "").trim() });
                                        setReplyDrafts((d) => ({ ...d, [r.id]: "" }));
                                      }}
                                    >
                                      {lang === "he" ? "שלח" : "Send"}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : space === "connections" ? (
                  // ── CONNECTIONS — your network: the businesses your processes
                  //    are with, the people across them, and contacts you add.
                  <div className="canvas profile-canvas">
                    <div className="canvas-inner">
                      <button className="canvas-back" onClick={goHome}>
                        <span className="canvas-back-ico" aria-hidden="true">‹</span> {t.backHome}
                      </button>
                      <div className="prof-sec-head" style={{ marginTop: 4 }}>
                        <h4 style={{ fontSize: 22 }}>{t.connectionsNav}</h4>
                        <span className="prof-sec-sub">{t.connectionsNavSub}</span>
                      </div>

                      {(() => {
                        const connBiz = businesses.filter((b) =>
                          units.some((p) => p.businessId === b.id),
                        );
                        const people = Array.from(
                          new Set(units.flatMap((p) => p.people ?? [])),
                        ).map((name) => ({
                          name,
                          from: units.find((p) => (p.people ?? []).includes(name))?.title ?? "",
                        }));
                        return (
                          <>
                            <div className="sheet-section">
                              <h4>{t.connBusinesses}</h4>
                              {connBiz.length === 0 ? (
                                <p className="conn-empty">{t.connBizEmpty}</p>
                              ) : (
                                <div className="conn-grid">
                                  {connBiz.map((b) => (
                                    <button
                                      className="conn-card"
                                      key={b.id}
                                      onClick={() => openBiz(b.id)}
                                    >
                                      <span className="conn-avatar">{b.emoji}</span>
                                      <span className="conn-body">
                                        <span className="conn-name">{b.name}</span>
                                        <span className="conn-rel">{b.category}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="sheet-section">
                              <h4>{t.connPeople}</h4>
                              {people.length === 0 ? (
                                <p className="conn-empty">{t.connPeopleEmpty}</p>
                              ) : (
                                <div className="conn-grid">
                                  {people.map((p) => (
                                    <div className="conn-card" key={p.name}>
                                      <span className="conn-avatar">🧑</span>
                                      <span className="conn-body">
                                        <span className="conn-name">{p.name}</span>
                                        {p.from && <span className="conn-rel">{p.from}</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="sheet-section">
                              <h4>{t.connMine}</h4>
                              <div className="conn-add">
                                <input
                                  className="mem-input conn-add-input"
                                  value={contactDraft}
                                  placeholder={t.connAddPlaceholder}
                                  onChange={(e) => setContactDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addContact(contactDraft);
                                  }}
                                />
                                <button
                                  className="sheet-pill"
                                  onClick={() => addContact(contactDraft)}
                                  disabled={!contactDraft.trim()}
                                >
                                  {t.memAddValue}
                                </button>
                              </div>
                              {contacts.length > 0 && (
                                <div className="conn-grid" style={{ marginTop: 10 }}>
                                  {contacts.map((name) => (
                                    <div className="conn-card" key={name}>
                                      <span className="conn-avatar">👤</span>
                                      <span className="conn-body">
                                        <span className="conn-name">{name}</span>
                                      </span>
                                      <button
                                        className="conn-remove"
                                        onClick={() => removeContact(name)}
                                        aria-label="Remove"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
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
                            {allowedWorlds.map((k) => (
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
                          {/* Live metrics for the current world — they shift as you
                              switch category, so Global reads as a living network. */}
                          <div className="global-metrics">
                            <div className="gm-stat">
                              <span className="gm-num">{worldBiz.length}</span>
                              <span className="gm-label">{lang === "he" ? "🏪 עסקים" : "🏪 Businesses"}</span>
                            </div>
                            <div className="gm-stat">
                              <span className="gm-num">
                                {worldBiz.filter((b) => (now ? openState(b, now)?.open : false)).length}
                              </span>
                              <span className="gm-label">{lang === "he" ? "🟢 פתוחים עכשיו" : "🟢 Open now"}</span>
                            </div>
                            <div className="gm-stat">
                              <span className="gm-num">{processes.length}</span>
                              <span className="gm-label">{lang === "he" ? "📋 תהליכים שלך" : "📋 Your processes"}</span>
                            </div>
                          </div>

                          {/* ── Units library — canonical, forkable processes ──── */}
                          <div className="global-sec">
                            <h3 className="global-sec-title">
                              {lang === "he" ? "📦 יחידות" : "📦 Units"}
                            </h3>
                            <span className="global-sec-sub">
                              {lang === "he"
                                ? "תהליכים מוכנים — משוך אחד וקבל גרסה אישית"
                                : "Ready-made processes — pull one for a personalized copy"}
                            </span>
                          </div>
                          <div className="gunit-search">
                            <input
                              className="app-input"
                              style={{ boxShadow: "none", background: "var(--p-bg)", width: "100%" }}
                              value={gUnitQ}
                              dir="auto"
                              placeholder={lang === "he" ? "חפש יחידה…" : "Search units…"}
                              onChange={(e) => runGUnitSearch(e.target.value)}
                            />
                          </div>
                          {gUnits.length > 0 ? (
                            <div className="gunit-list">
                              {gUnits.map((gu) => (
                                <div className="gunit-row" key={gu.id}>
                                  {gu.cover_image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img className="gunit-thumb" src={gu.cover_image} alt="" loading="lazy" />
                                  ) : (
                                    <span className="gunit-emoji" aria-hidden="true">{gu.emoji}</span>
                                  )}
                                  <span className="gunit-body">
                                    <span className="gunit-name">{gu.title}</span>
                                    <span className="gunit-meta">
                                      {(gu.steps ?? []).length}{" "}
                                      {lang === "he" ? "שלבים" : "steps"} · {gu.uses}{" "}
                                      {lang === "he" ? "השתמשו" : "used"}
                                    </span>
                                  </span>
                                  <button className="gunit-pull" onClick={() => void pullGlobalUnit(gu)}>
                                    {lang === "he" ? "משוך" : "Pull"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="gunit-empty">
                              {lang === "he"
                                ? "עוד אין יחידות בגלובל — צור תהליך והוא יתפרסם כאן."
                                : "No units in Global yet — build a process and it publishes here."}
                            </div>
                          )}

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
                        {lens.homeMode === "inbox" && inboxTotal > 0 && (
                          <button className="reply-signal inbox-lead" onClick={openInbox}>
                            <span className="reply-signal-dot" aria-hidden="true" />
                            <span className="reply-signal-body">
                              <span className="reply-signal-title">
                                {inboxNew > 0
                                  ? lang === "he"
                                    ? `${inboxNew} פניות חדשות ממתינות לך`
                                    : `${inboxNew} new request${inboxNew > 1 ? "s" : ""} waiting`
                                  : lang === "he"
                                    ? "תיבת הפניות"
                                    : "Your inbox"}
                              </span>
                              <span className="reply-signal-text">
                                {lang === "he"
                                  ? "פתח כדי לענות ולתאם"
                                  : "Open to answer and coordinate"}
                              </span>
                            </span>
                            <span className="reply-signal-cta" aria-hidden="true">›</span>
                          </button>
                        )}
                        {incomingReplies.length > 0 && (
                          <button
                            className="reply-signal"
                            onClick={() => openReplySignal(incomingReplies[0])}
                          >
                            <span className="reply-signal-dot" aria-hidden="true" />
                            <span className="reply-signal-body">
                              <span className="reply-signal-title">
                                {lang === "he"
                                  ? `${identities.find((i) => i.id === incomingReplies[0].toProfileId)?.name ?? "הצד השני"} ענה`
                                  : `${identities.find((i) => i.id === incomingReplies[0].toProfileId)?.name ?? "The other side"} replied`}
                                {incomingReplies.length > 1
                                  ? ` · +${incomingReplies.length - 1}`
                                  : ""}
                              </span>
                              <span className="reply-signal-text">
                                {incomingReplies[0].reply}
                              </span>
                            </span>
                            <span className="reply-signal-cta" aria-hidden="true">›</span>
                          </button>
                        )}
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
                          onVoiceTap={startVoiceCall}
                      voiceOn={aiVoice}
                          placeholder={t.talkToOne}
                          caret
                          lang={lang}
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
                        {pendingReminders.length > 0 && (
                          <div className="rem-band">
                            <div className="rem-band-head">
                              <span className="rem-band-title">
                                ⏰ {lang === "he" ? "תזכורות" : "Reminders"}
                              </span>
                              <span className="rem-band-count">{pendingReminders.length}</span>
                            </div>
                            {pendingReminders.map((r) => (
                              <div className="rem-row" key={r.id}>
                                <button
                                  className="rem-check"
                                  onClick={() => toggleReminder(r.id)}
                                  aria-label={lang === "he" ? "סמן כבוצע" : "Mark done"}
                                />
                                <button
                                  className="rem-body"
                                  onClick={() => {
                                    const proc = r.procId
                                      ? units.find((u) => u.id === r.procId)
                                      : null;
                                    if (proc) openUnit(proc);
                                  }}
                                >
                                  <span className="rem-text">{r.text}</span>
                                  <span className="rem-when">{r.at}</span>
                                </button>
                                <button
                                  className="rem-dismiss"
                                  onClick={() => dismissReminder(r.id)}
                                  aria-label={lang === "he" ? "מחק" : "Dismiss"}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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
                        {m.cite && (
                          <div className="chat-cite" title={m.cite.host}>
                            <span className="chat-cite-emoji" aria-hidden="true">{m.cite.emoji}</span>
                            {lang === "he" ? "לפי" : "per"} {m.cite.label}
                            <span className="chat-cite-host">{m.cite.host}</span>
                          </div>
                        )}
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
                        ) : m.booking ? (
                          <div className="chat-chips booking-chips">
                            {m.booking.slots.map((s) => (
                              <button
                                key={s}
                                className="chat-chip booking-chip"
                                onClick={() => bookSlot(s, m.booking!.topic, m.booking!.procId)}
                              >
                                📅 {s}
                              </button>
                            ))}
                          </div>
                        ) : m.providers ? (
                          <div className="prov-list">
                            {m.providers.items.map((p, pi) => (
                              <button
                                key={pi}
                                className="prov-card"
                                onClick={() => createProvider(p, m.providers!.procId)}
                              >
                                <span className="prov-avatar" aria-hidden="true">🏢</span>
                                <span className="prov-body">
                                  <span className="prov-name">{p.name}</span>
                                  <span className="prov-meta">
                                    {[p.category, p.area].filter(Boolean).join(" · ")}
                                  </span>
                                  {p.blurb && <span className="prov-blurb">{p.blurb}</span>}
                                </span>
                                <span className="prov-add" aria-hidden="true">＋</span>
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
                    {/* ONE's living presence, pinned at the end of the thread —
                        blinks at rest, wakes (leans in, eyes forward) while you
                        type, closes its eyes while it works. */}
                    <div className="chat-presence-row" aria-live="polite">
                      <span ref={homePresenceRef} className="chat-presence-pump">
                        <Orb
                          size={30}
                          alive
                          look={draft.trim() && !thinking ? -0.28 : 0}
                          faceColor="var(--p-face)"
                          eyeColor="var(--p-bg)"
                          className={`chat-presence${draft.trim() && !thinking ? " awake" : ""}${thinking ? " thinking" : ""}`}
                        />
                      </span>
                      {thinking && (
                        <span className="chat-presence-hint">
                          {statusLabel}
                          <span className="think-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        </span>
                      )}
                    </div>
                    {activeForm && !activeForm.procId && formCard}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="app-edge bottom" />
                  <div className="app-dock">
                    <AppInput
                      value={draft}
                      onChange={(v) => {
                        setDraft(v);
                        pumpPresence(homePresenceRef);
                      }}
                      onSend={() => send()}
                      onVoiceTap={startVoiceCall}
                      voiceOn={aiVoice}
                      placeholder={t.talkToOne}
                      lang={lang}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>


      {/* ── SUBSCRIPTION popup ── */}
      {/* New profile — pick a TYPE (not only business): a personal ONE, a
          business ONE, or a supplier (provider) seat you can switch to and
          answer from, to test a process from the other side. */}
      <Sheet open={openSheet === "newProfile"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">{lang === "he" ? "פרופיל חדש" : "New profile"}</div>
            <div className="sheet-sub">
              {lang === "he"
                ? "בחר סוג ותן שם — ONE נפרד לכל כובע שאתה לובש."
                : "Pick a type and name it — a separate ONE for each hat you wear."}
            </div>
          </div>
          <input
            className="mem-input np-name"
            value={newProfileName}
            placeholder={lang === "he" ? "שם הפרופיל" : "Profile name"}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
          <div className="np-types">
            {(
              [
                { k: "personal", emoji: "👤", en: "Personal", he: "אישי", dEn: "You, as a private person", dHe: "אתה, כאדם פרטי" },
                { k: "business", emoji: "🏢", en: "Business", he: "עסק", dEn: "A business you run", dHe: "עסק שאתה מנהל" },
                { k: "supplier", emoji: "🏪", en: "Supplier", he: "ספק", dEn: "A provider seat — test the other side of a process", dHe: "מושב ספק — לבדוק את הצד השני של תהליך" },
              ] as const
            ).map((ty) => (
              <button
                key={ty.k}
                className="np-type"
                disabled={!newProfileName.trim()}
                onClick={() => createIdentity(ty.k, newProfileName)}
              >
                <span className="np-type-emoji">{ty.emoji}</span>
                <span className="np-type-body">
                  <span className="np-type-name">{lang === "he" ? ty.he : ty.en}</span>
                  <span className="np-type-desc">{lang === "he" ? ty.dHe : ty.dEn}</span>
                </span>
                <span className="np-type-go" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={openSheet === "subscription"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">{t.upgradeOne}</div>
            <div className="sheet-sub">{t.choosePlan}</div>
          </div>
          <div className="plan-tiers rich">
            {(
              [
                {
                  key: "free",
                  name: "Free",
                  price: "₪0",
                  accent: "var(--p-text-3)",
                  feats:
                    lang === "he"
                      ? ["צ׳אט ותהליכים ללא הגבלה", "פרופיל אחד", "יכולת מבחנים", "זיכרון בסיסי"]
                      : ["Unlimited chat & processes", "1 profile", "Quiz capability", "Basic memory"],
                },
                {
                  key: "pro",
                  name: "Pro",
                  price: "₪29",
                  accent: "var(--p-blue)",
                  rec: true,
                  feats:
                    lang === "he"
                      ? ["כל מה שב‑Free", "פרופילים מרובים", "קביעת תורים · תזכורות · טפסים", "טיוטות + חיבורים", "עדיפות בתשובות"]
                      : ["Everything in Free", "Multiple profiles", "Booking · reminders · forms", "Drafts + connections", "Priority replies"],
                },
                {
                  key: "max",
                  name: "Max",
                  price: "₪69",
                  accent: "var(--p-purple)",
                  feats:
                    lang === "he"
                      ? ["כל מה שב‑Pro", "פרימיום: מחקר · נסיעות · מו״מ", "מושב ספק + מקורות רשמיים", "הצד השני עונה מהר יותר", "תמיכה מועדפת"]
                      : ["Everything in Pro", "Premium: research · travel · negotiate", "Supplier seat + official sources", "Faster counterpart replies", "Priority support"],
                },
              ] as { key: PlanTier; name: string; price: string; accent: string; rec?: boolean; feats: string[] }[]
            ).map((tier) => {
              const current = plan === tier.key;
              return (
                <div key={tier.key} className={`plan-card${current ? " is-current" : ""}${tier.rec ? " is-rec" : ""}`}>
                  {tier.rec && <span className="plan-badge">{lang === "he" ? "הכי פופולרי" : "Most popular"}</span>}
                  <div className="t-name" style={{ color: tier.accent }}>{tier.name}</div>
                  <div className="t-price">
                    {tier.price}
                    <span className="t-per">{lang === "he" ? " /חודש" : " /mo"}</span>
                  </div>
                  <ul className="plan-feats">
                    {tier.feats.map((f) => (
                      <li key={f}>
                        <span className="pf-check" aria-hidden="true">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`sheet-pill${tier.key === "pro" ? " blue" : tier.key === "max" ? " purple" : ""}`}
                    style={{ width: "100%" }}
                    disabled={current}
                    onClick={() => {
                      setPlan(tier.key);
                      setOpenSheet(null);
                    }}
                  >
                    {current
                      ? lang === "he"
                        ? "התוכנית שלך ✓"
                        : "Your plan ✓"
                      : lang === "he"
                        ? `בחר ${tier.name}`
                        : `Choose ${tier.name}`}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="plan-foot">
            {lang === "he"
              ? "אפשר לבטל בכל רגע. המחירים לפרופיל; פרופיל עסקי/ספק כלול ב‑Pro ומעלה."
              : "Cancel anytime. Prices are per profile; business/supplier seats are included from Pro up."}
          </p>
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
            <h4>{lang === "he" ? "בינה ועלויות" : "AI & cost"}</h4>
            <p className="settings-hint">
              {lang === "he"
                ? "כבה כדי לחסוך בעלויות בזמן בדיקות — טקסט ממשיך לעבוד."
                : "Turn off to save cost while testing — text still works."}
            </p>
            <div className="sheet-row">
              <span className="r-label">{lang === "he" ? "תמונות שנוצרות" : "Generated images"}</span>
              <div className="seg2">
                <button className={aiImages ? "on" : ""} onClick={() => applyAiImages(true)}>
                  {lang === "he" ? "פעיל" : "On"}
                </button>
                <button className={!aiImages ? "on" : ""} onClick={() => applyAiImages(false)}>
                  {lang === "he" ? "כבוי" : "Off"}
                </button>
              </div>
            </div>
            <div className="sheet-row">
              <span className="r-label">{lang === "he" ? "שיחת קול" : "Voice call"}</span>
              <div className="seg2">
                <button className={aiVoice ? "on" : ""} onClick={() => applyAiVoice(true)}>
                  {lang === "he" ? "פעיל" : "On"}
                </button>
                <button className={!aiVoice ? "on" : ""} onClick={() => applyAiVoice(false)}>
                  {lang === "he" ? "כבוי" : "Off"}
                </button>
              </div>
            </div>
            <div className="sheet-row">
              <span className="r-label">{lang === "he" ? "מידע חי מהאינטרנט" : "Live web info"}</span>
              <div className="seg2">
                <button className={aiWeb ? "on" : ""} onClick={() => applyAiWeb(true)}>
                  {lang === "he" ? "פעיל" : "On"}
                </button>
                <button className={!aiWeb ? "on" : ""} onClick={() => applyAiWeb(false)}>
                  {lang === "he" ? "כבוי" : "Off"}
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
            <button
              className="sheet-row"
              style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
              onClick={startFresh}
            >
              <span className="r-label" style={{ color: "#DC2626" }}>
                {lang === "he" ? "התחל מחדש — מחק פרופילים ונתונים" : "Start fresh — clear profiles & data"}
              </span>
              <span className="r-value">›</span>
            </button>
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
