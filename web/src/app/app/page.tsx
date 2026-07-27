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
function DashedRingIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeDasharray="2.4 3.4" />
    </svg>
  );
}
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

function UnitDetail({
  p,
  businesses,
  isStepDone,
  toggleStep,
  runQuickAction,
  openBiz,
}: {
  p: Process;
  businesses: Business[];
  isStepDone: (p: Process, i: number) => boolean;
  toggleStep: (p: Process, i: number) => void;
  runQuickAction: (p: Process, label: string) => void;
  openBiz: (id: string) => void;
}) {
  const sources = unitSources(p);
  return (
    <div className="unit-detail-body">
      {p.nextAction && <div className="unit-pulse unit-detail-pulse">{p.nextAction}</div>}

      {p.metrics && p.metrics.length > 0 && (
        <div className="metric-grid">
          {p.metrics.map((m) => (
            <div className="metric" key={m.label}>
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {p.quickActions && p.quickActions.length > 0 && (
        <div className="qa-row">
          {p.quickActions.map((a) => (
            <button key={a} className="qa-btn" onClick={() => runQuickAction(p, a)}>
              {a}
            </button>
          ))}
        </div>
      )}

      <div className="sheet-section">
        <h4>Next steps</h4>
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
        <h4>Connections</h4>
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
          <h4>Insights</h4>
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
          <h4>Decisions</h4>
          {p.decisions.map((d) => (
            <div className="sheet-row" key={d}>
              <span className="r-label" style={{ fontWeight: 500 }}>
                {d}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="sheet-section">
        <h4>Timeline</h4>
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
          <h4>Sources</h4>
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
    const items = waiting.slice(0, 4).map((p) => p.nextAction ?? p.summary);
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

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text) return;
    const priorChat = chat; // snapshot the transcript for the AI, pre-append
    setChat((c) => [...c, { role: "user", text }]);
    setDraft("");
    setThinking(true);

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

    // The structured side (created/updated process, broadcast, ONE-to-ONE
    // outreach) applies whether ONE speaks via the real model or the fallback.
    const applyStructured = () => {
      if (res.process) {
        upsert(res.process);
        setFocusId(res.process.id);
      }
      if (res.broadcast) setLiveBroadcast(res.broadcast);
      if (res.outreach && res.process && !outreachDoneRef.current.has(res.process.id)) {
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
      const extra = res.process
        ? `You have just opened a process for them: "${res.process.title}". Acknowledge it in one line and say you're on it.`
        : undefined;
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
      setChat((c) => [...c, { role: "one", text: reply, chips: suggestChips(reply, lang) }]);
      applyStructured();
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
    setUnitChat([
      { role: "one", text: `Here's ${p.title}.${p.nextAction ? " " + p.nextAction : " Tell me what changed and I'll update it."}` },
    ]);
    closeDrawerOnMobile();
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

  // Chat scoped to the open unit — every reply's changes land on the card beside.
  const sendToUnit = async (override?: string) => {
    if (!activeProcess) return;
    const text = (override ?? unitDraft).trim();
    if (!text) return;
    const priorChat = unitChat; // snapshot the transcript for the AI, pre-append
    setUnitChat((c) => [...c, { role: "user", text }]);
    setUnitDraft("");
    setUnitThinking(true);
    const focus = units.find((u) => u.id === activeProcess.id) ?? null;
    const res = interpret(text, { identityId: activeIdentityId, now: Date.now(), processes, focus });

    const applyStructured = () => {
      if (res.process) upsert(res.process);
      if (res.broadcast) setLiveBroadcast(res.broadcast);
      if (res.outreach && res.process && !outreachDoneRef.current.has(res.process.id)) {
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
      const extra = `You are working on this specific process for them: "${activeProcess.title}" (${activeProcess.relation}${total ? `, ${done}/${total} steps done` : ""}). Keep the reply scoped to moving THIS process forward.`;
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
    } catch {
      window.setTimeout(() => {
        setUnitThinking(false);
        res.lines.forEach((line) => setUnitChat((c) => [...c, { role: "one", text: line }]));
        applyStructured();
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
            {/* Temporary chat — icon only, the dashed ring from the app. */}
            <button
              className="app-nav-btn app-nav-icon"
              onClick={startTempChat}
              aria-label={t.tempChat}
              title={t.tempChat}
            >
              <DashedRingIcon />
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
              {processes.map((p) => (
                <button
                  key={p.id}
                  className="drawer-row drawer-process"
                  onClick={() => openUnit(p)}
                  title={`${p.title} · ${p.relation}`}
                >
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
                    </span>
                  </span>
                  {p.unread > 0 && <span className="drawer-process-badge">{p.unread}</span>}
                </button>
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
                      <div className="temp-chat-tag">
                        <i className="fi fi-rr-incognito" aria-hidden="true" /> Temporary chat · not
                        kept as a process
                      </div>
                    )}
                    {chat.map((m, i) => (
                      <Fragment key={i}>
                        <div className={`chat-msg ${m.role}`}>{m.text}</div>
                        {m.chips && m.chips.length > 0 && (
                          <div className="chat-chips">
                            {m.chips.map((c) => (
                              <button key={c} className="chat-chip" onClick={() => send(c)}>
                                {c}
                              </button>
                            ))}
                          </div>
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
