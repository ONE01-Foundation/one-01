"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
/** Voice bars — the resting state of the dock's action button, as in the app's
    hero. It flips to the send arrow the moment there's something to send. */
function VoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 9v6M12 5v14M16 9v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
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

export default function AppHome() {
  const [plan, setPlan] = useState<PlanTier>("free");
  const [activeIdentityId, setActiveIdentityId] = useState(IDENTITIES[0].id);
  const [openSheet, setOpenSheet] = useState<null | "profile" | "settings" | "subscription">(null);
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [stepOverrides, setStepOverrides] = useState<Record<string, boolean>>({});
  const [bi, setBi] = useState(0);
  const [bfade, setBfade] = useState(false);

  // Home conversation with ONE.
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  // Desktop split: a unit open BESIDE its own chat, plus a full-screen toggle.
  const [unitFull, setUnitFull] = useState(false);
  // Top-bar menus (open on hover, like the site's). The ONE mark holds what ONE
  // owns; the avatar holds who you are.
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Width of the unit's detail rail — the user drags its edge to resize.
  const [asideW, setAsideW] = useState(340);
  // The home hero uses the landing's exact collapse model: --p (0…1) where 1 is
  // ONE collapsed to a plain black dot at the centre of the screen. Scroll
  // drives it toward the processes; the opening plays it in reverse.
  const homePageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const introDoneRef = useRef(false);
  const [unitChat, setUnitChat] = useState<ChatMsg[]>([]);
  const [unitDraft, setUnitDraft] = useState("");
  const [unitThinking, setUnitThinking] = useState(false);
  // One unit store — seeds + anything ONE creates, so every surface stays in sync.
  const [units, setUnits] = useState<Process[]>(PROCESSES);
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
    const waiting = processes.filter((p) => p.unread > 0);
    if (waiting.length === 0) {
      return [
        `You're all caught up, ${identity.name}.`,
        "Tell me a new goal and I'll start a process.",
      ];
    }
    const header = `${waiting.length} ${waiting.length === 1 ? "thing needs" : "things need"} you, ${identity.name}.`;
    const items = waiting.slice(0, 4).map((p) => p.nextAction ?? p.summary);
    return [header, ...items];
  }, [processes, identity.name]);

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
      setLiveBroadcast(`You confirmed ${p.relation}'s ${when}.`);
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
        setLiveBroadcast(`${p.relation} is set for ${when}.`);
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
      setLiveBroadcast(`${p.relation}'s invoice marked paid.`);
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
    setLiveBroadcast(`Booked ${what} at ${biz.name}.`);
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
      setLiveBroadcast(`${biz.name} confirmed your ${what}.`);
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

  const send = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text) return;
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

    window.setTimeout(() => {
      setThinking(false);
      res.lines.forEach((line) => setChat((c) => [...c, { role: "one", text: line }]));
      if (res.process) {
        upsert(res.process);
        setFocusId(res.process.id);
      }
      if (res.broadcast) setLiveBroadcast(res.broadcast);

      // A business's ONE "replies" a beat later — the update lands on the card.
      if (res.outreach && res.process) {
        const targetId = res.process.id;
        const o = res.outreach;
        window.setTimeout(() => {
          setUnits((list) => list.map((p) => (p.id === targetId ? o.apply(p) : p)));
          setChat((c) => (c.length ? [...c, { role: "one", text: o.line }] : c));
          setLiveBroadcast(o.broadcast);
        }, o.delayMs);
      }
    }, 780);
  };

  const endChat = () => {
    setChat([]);
    setThinking(false);
  };

  // Open a unit into the desktop split (detail + its own chat); focus it so the
  // chat updates THIS unit, and greet.
  const openUnit = (p: Process) => {
    setActiveProcess(p);
    setFocusId(p.id);
    setUnitFull(false);
    setUnitChat([
      { role: "one", text: `Here's ${p.title}.${p.nextAction ? " " + p.nextAction : " Tell me what changed and I'll update it."}` },
    ]);
  };
  const closeUnit = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
  };
  // The ONE mark is "home": drop whatever you're in and return to the hero.
  const goHome = () => {
    setActiveProcess(null);
    setUnitChat([]);
    setUnitDraft("");
    setUnitThinking(false);
    endChat();
    setMenuOpen(false);
    // Back to the hero — the MIDDLE screen, not the top of the scroller.
    requestAnimationFrame(() => scrollHome(0));
  };

  // Drag the rail's inner edge to resize it. Pointer capture keeps the drag
  // alive even when the cursor outruns the 6px handle.
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const startW = asideW;
    const dir = document.documentElement.dir === "rtl" ? -1 : 1;
    const onMove = (ev: PointerEvent) => {
      const next = startW - (ev.clientX - startX) * dir;
      setAsideW(Math.max(260, Math.min(560, next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  // Chat scoped to the open unit — every reply's changes land on the card beside.
  const sendToUnit = () => {
    if (!activeProcess) return;
    const text = unitDraft.trim();
    if (!text) return;
    setUnitChat((c) => [...c, { role: "user", text }]);
    setUnitDraft("");
    setUnitThinking(true);
    const focus = units.find((u) => u.id === activeProcess.id) ?? null;
    const res = interpret(text, { identityId: activeIdentityId, now: Date.now(), processes, focus });
    window.setTimeout(() => {
      setUnitThinking(false);
      res.lines.forEach((line) => setUnitChat((c) => [...c, { role: "one", text: line }]));
      if (res.process) upsert(res.process);
      if (res.broadcast) setLiveBroadcast(res.broadcast);
      if (res.outreach && res.process) {
        const targetId = res.process.id;
        const o = res.outreach;
        window.setTimeout(() => {
          setUnits((list) => list.map((pp) => (pp.id === targetId ? o.apply(pp) : pp)));
          setUnitChat((c) => [...c, { role: "one", text: o.line }]);
          setLiveBroadcast(o.broadcast);
        }, o.delayMs);
      }
    }, 700);
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

  // The hero is the MIDDLE of three screens — Global above, processes below —
  // so its resting scroll position is one screen down, not zero.
  const heroTop = () => homePageRef.current?.clientHeight ?? 0;
  const scrollHome = (dir: -1 | 0 | 1) => {
    const page = homePageRef.current;
    if (!page) return;
    page.scrollTo({ top: page.clientHeight * (1 + dir), behavior: "smooth" });
  };

  // Park on the hero before the first paint (so the app never flashes the
  // Global on the way down), then measure how far the dock has to travel
  // between its seat in the hero and its resting place at the bottom. That
  // distance depends on the viewport, so it's measured rather than guessed —
  // and re-measured on resize.
  useLayoutEffect(() => {
    const page = homePageRef.current;
    const host = mainRef.current;
    if (!page || !host) return;
    page.scrollTop = page.clientHeight;
    const measure = () => {
      const slot = page.querySelector<HTMLElement>(".home-hero-dockslot");
      const dock = host.querySelector<HTMLElement>(".app-dock");
      if (!slot || !dock) return;
      // Neutralise the transform to read the dock's untransformed seat. No
      // paint happens inside a layout effect, so this can't flicker.
      const prev = dock.style.transform;
      dock.style.transform = "none";
      const d = dock.getBoundingClientRect();
      const s = slot.getBoundingClientRect();
      dock.style.transform = prev;
      const lift = Math.round(d.top + d.height / 2 - (s.top + s.height / 2));
      host.style.setProperty("--dock-lift", `${Math.max(0, lift)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeProcess, chat.length]);

  // Scroll-collapse: pulling the processes up collapses ONE into a plain black
  // dot at the centre of the screen. Measured FROM the hero, so scrolling up to
  // the Global leaves the hero whole (the clamp floors it at 0). Pure CSS var —
  // it tracks frame-for-frame with no re-render, and the dock rides it too, so
  // --p lives on the shared ancestor rather than the hero.
  useEffect(() => {
    const page = homePageRef.current;
    const host = mainRef.current;
    if (!page || !host) return;
    let raf = 0;
    const onScroll = () => {
      if (raf || !introDoneRef.current) return; // let the awakening own --p first
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = Math.max(1, page.clientHeight);
        const p = Math.max(0, Math.min(1, (page.scrollTop - h) / h));
        host.style.setProperty("--p", p.toFixed(4));
      });
    };
    page.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      page.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeProcess, chat.length]);

  // ONE's awakening — the opening IS the home animating in, the exact reverse of
  // the scroll-collapse: ONE starts as a dot at the centre of the screen, then
  // grows/rises into place while its eyes open and the broadcast, input and cue
  // fade in. No splash overlay — it's the home's own elements. Identical timing
  // and easing to the landing hero's.
  useEffect(() => {
    const host = mainRef.current;
    const page = homePageRef.current;
    if (!host || !page) return;
    const h = Math.max(1, page.clientHeight);
    const syncToScroll = () => {
      introDoneRef.current = true;
      const p = Math.max(0, Math.min(1, (page.scrollTop - h) / h));
      host.style.setProperty("--p", p.toFixed(4));
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Only awaken when we're parked on the hero; if we're already elsewhere (or
    // reduced-motion is on), hand --p straight to the scroll position.
    if (reduce || Math.abs(page.scrollTop - h) > 4) {
      syncToScroll();
      return;
    }
    host.style.setProperty("--p", "1"); // start collapsed: a dot at screen centre
    const DURATION = 1050;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION);
      host.style.setProperty("--p", (1 - ease(t)).toFixed(4));
      if (t < 1) raf = requestAnimationFrame(step);
      else introDoneRef.current = true; // ended at the top → --p=0 is correct
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Esc backs out of the open unit — the workspace should never trap you.
  useEffect(() => {
    if (!activeProcess) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeUnit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProcess]);

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

  return (
    <main className="product-root">
      {/* No splash overlay. The opening IS the home animating in — see the
          awakening effect above: ONE starts as a dot at the centre of the
          screen and grows into place. Same as the landing hero. */}
      {/* Full-bleed canvas — no window chrome, no back-to-site. The product is
          its own place; the ONE orb in the sidebar is the brand anchor. */}
      <div className="app-shell">
        {/* TOP BAR — the site's shape. The ONE mark is home (and its menu holds
            what ONE itself owns); the round avatar on the right is you, and
            holds the profiles you can be. */}
        <nav className="app-nav">
          <div
            className="app-nav-brand"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setMenuOpen(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setMenuOpen(false);
            }}
          >
            <button
              className="app-brand-btn"
              onClick={goHome}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="ONE — home"
            >
              <OneWord className="app-brand-mark" />
            </button>
            {menuOpen && (
              <div className="app-menu" role="menu">
                <button className="app-menu-item" onClick={goHome} role="menuitem">
                  <i className="fi fi-rr-home app-menu-ico" aria-hidden="true" />
                  Home
                </button>
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setOpenSheet("profile");
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <i className="fi fi-rr-user app-menu-ico" aria-hidden="true" />
                  ONE profile
                </button>
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setOpenSheet("subscription");
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <i className="fi fi-rr-wallet app-menu-ico" aria-hidden="true" />
                  Plan
                  <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
                </button>
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setOpenSheet("settings");
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <i className="fi fi-rr-settings-sliders app-menu-ico" aria-hidden="true" />
                  Settings
                </button>
              </div>
            )}
          </div>
          <div
            className="app-nav-right"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setProfilesOpen(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setProfilesOpen(false);
            }}
          >
            <button
              className="app-avatar"
              onClick={() => setProfilesOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={profilesOpen}
              aria-label={`${identity.name} — switch profile`}
            >
              <span className="app-avatar-emoji">{identity.emoji}</span>
            </button>
            {profilesOpen && (
              <div className="app-profiles" role="menu">
                <div className="app-profiles-label">Profiles</div>
                {IDENTITIES.map((id) => (
                  <button
                    key={id.id}
                    className={`app-profile${id.id === activeIdentityId ? " active" : ""}`}
                    onClick={() => {
                      setActiveIdentityId(id.id);
                      setProfilesOpen(false);
                    }}
                    role="menuitem"
                  >
                    <span className="app-profile-emoji">{id.emoji}</span>
                    <span className="app-profile-text">
                      <span className="app-profile-name">{id.name}</span>
                      <span className="app-profile-role">{id.role}</span>
                    </span>
                  </button>
                ))}
                <button
                  className="app-profile app-profile-new"
                  onClick={startCreateBusiness}
                  role="menuitem"
                >
                  <span className="app-profile-emoji">＋</span>
                  <span className="app-profile-text">
                    <span className="app-profile-name">New profile</span>
                    <span className="app-profile-role">A ONE for a business or a side of life</span>
                  </span>
                </button>
                {/* Where this ONE is kept — it belongs with the profile, not
                    floating in the chrome. */}
                <div className={`app-profiles-cloud cloud-${cloud}`}>
                  {cloud === "synced" && "☁ Synced to cloud"}
                  {cloud === "connecting" && "☁ Connecting…"}
                  {cloud === "offline" && "• Saved on this device"}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* RIGHT — the workspace: broadcast-driven cards or the conversation */}
        <section className="app-main" ref={mainRef}>
          <div className="app-edge top" />
          {activeLive ? (
            // ── UNIT SPLIT — the wide detail card BESIDE its own chat. Typing in
            //    the chat updates the card live. "Full" hides the chat and lets
            //    the card fill the workspace.
            <div className={`unit-view${unitFull ? " is-full" : ""}`}>
              {/* The conversation is the room — bare on the canvas, no card
                  around it. The unit's details sit as a narrow rail you can
                  drag wider when you actually want to read them. */}
              <div className="unit-chatpane">
                <div className="unit-topbar">
                  <div className="unit-topbar-head">
                    <div className="unit-topbar-title">
                      <span className="unit-topbar-emoji">{activeLive.emoji}</span>
                      <span>{activeLive.title}</span>
                    </div>
                    <div className="unit-topbar-sub">
                      {activeLive.relation}
                      <span className="unit-topbar-dot">·</span>
                      {activeLive.steps.filter((_, i) => isStepDone(activeLive, i)).length}/
                      {activeLive.steps.length} done
                    </div>
                  </div>
                  <div className="unit-topbar-actions">
                    <button className="unit-tb-btn" onClick={() => setUnitFull((f) => !f)}>
                      {unitFull ? "◑ Details" : "⛶ Hide details"}
                    </button>
                    <button className="unit-tb-btn unit-tb-close" onClick={closeUnit} aria-label="Close unit">
                      ×
                    </button>
                  </div>
                </div>
                <div className="unit-chat-scroll">
                  {unitChat.map((m, i) => (
                    <div key={i} className={`chat-msg ${m.role}`}>
                      {m.text}
                    </div>
                  ))}
                  {unitThinking && (
                    <div className="chat-msg one thinking" aria-label="ONE is thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  <div ref={unitEndRef} />
                </div>
                <div className="app-dock unit-dock">
                  <AppInput
                    value={unitDraft}
                    onChange={setUnitDraft}
                    onSend={sendToUnit}
                    placeholder="Tell ONE what changed…"
                  />
                </div>
              </div>
              {!unitFull && (
                <aside className="unit-aside" style={{ width: asideW }}>
                  <div
                    className="unit-resizer"
                    onPointerDown={startResize}
                    role="separator"
                    aria-label="Resize details"
                  />
                  <div className="unit-aside-scroll">
                    <UnitDetail
                      p={activeLive}
                      businesses={businesses}
                      isStepDone={isStepDone}
                      toggleStep={toggleStep}
                      runQuickAction={runQuickAction}
                      openBiz={openBiz}
                    />
                  </div>
                </aside>
              )}
            </div>
          ) : (
            <>
              {chat.length > 0 && (
                <button className="app-close" onClick={endChat} aria-label="Close chat">
                  ×
                </button>
              )}
              {chat.length === 0 ? (
                // HOME — one column, the hero in the middle of it, exactly as on
                // the site: UP is the Global (the world outside your ONE), DOWN
                // is your own processes. The page opens parked on the hero.
                <div className="app-page" ref={homePageRef}>
                  {/* GLOBAL — one screen up. This is where the businesses list
                      moved to; it was never sidebar furniture, it's a place. */}
                  <section className="home-global">
                    <div className="global-pane">
                      <h2 className="global-title">Global</h2>
                      <p className="global-lede">
                        Every ONE out here can be talked to. Walk in, ask, book — your ONE
                        handles the rest.
                      </p>
                      <div className="global-grid">
                        {businesses.map((b) => (
                          <button key={b.id} className="gcard" onClick={() => openBiz(b.id)}>
                            <span className="gcard-emoji">{b.emoji}</span>
                            <span className="gcard-name">
                              {b.name}
                              {b.ownerKey && ownerKey && b.ownerKey === ownerKey ? " · yours" : ""}
                            </span>
                            <span className="gcard-cat">{b.category}</span>
                          </button>
                        ))}
                        <button className="gcard gcard-new" onClick={startCreateBusiness}>
                          <span className="gcard-emoji">＋</span>
                          <span className="gcard-name">Create a business ONE</span>
                          <span className="gcard-cat">Set hours, services — or just describe it</span>
                        </button>
                      </div>
                    </div>
                  </section>
                  <section className="home-hero" ref={heroRef}>
                    <button
                      type="button"
                      className="home-chev up"
                      onClick={() => scrollHome(-1)}
                      aria-label="Global"
                    >
                      <ChevronUpIcon />
                    </button>
                    <button
                      className="home-hero-orb"
                      onClick={() => setOpenSheet("profile")}
                      aria-label="Open profile"
                    >
                      <Orb size={92} alive />
                    </button>
                    {/* The rotating broadcast's own cross-fade rides a CLASS,
                        not an inline style — inline would beat the --p fade
                        declared in CSS and the line would never reach zero. */}
                    <div className={`home-hero-line${!liveBroadcast && bfade ? " is-fading" : ""}`}>
                      {liveBroadcast ?? broadcastLines[bi % broadcastLines.length]}
                    </div>
                    {/* A spacer the size of the dock: the input is fixed to the
                        page (it has to survive the scroll), so the hero group
                        reserves its seat here and the dock parks in it. */}
                    <div className="home-hero-dockslot" aria-hidden="true" />
                    <button
                      type="button"
                      className="home-chev down"
                      onClick={() => scrollHome(1)}
                      aria-label="Your processes"
                    >
                      <ChevronDownIcon />
                    </button>
                  </section>
                    <section className="home-processes">
                      <div className="app-cards">
                        {processes.map((p) => {
                    const done = p.steps.filter((_, i) => isStepDone(p, i)).length;
                    const total = p.steps.length;
                    return (
                      <div
                        key={p.id}
                        className="ucard"
                        onClick={() => openUnit(p)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="ucard-head">
                          <div className="ucard-title">
                            <span className="ucard-emoji">{p.emoji}</span>
                            <span>{p.title}</span>
                          </div>
                          <div className="ucard-time">
                            {p.time}
                            {p.unread > 0 && <span className="ucard-badge">{p.unread}</span>}
                          </div>
                        </div>
                        <div className="ucard-sub">{p.summary}</div>
                        <div className="ucard-foot">
                          <span className="ucard-relation">{p.relation}</span>
                          <div className="ucard-progress">
                            <div className="ucard-track">
                              <div
                                className="ucard-fill"
                                style={{ width: `${Math.round((done / total) * 100)}%` }}
                              />
                            </div>
                            <span className="ucard-count">
                              {done}/{total}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                        {processes.length === 0 && (
                          <div className="app-empty">Nothing here yet for {identity.name}.</div>
                        )}
                      </div>
                    </section>
                </div>
              ) : (
                <div className="app-chat">
                  {chat.map((m, i) => (
                    <div key={i} className={`chat-msg ${m.role}`}>
                      {m.text}
                    </div>
                  ))}
                  {thinking && (
                    <div className="chat-msg one thinking" aria-label="ONE is thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
              <div className="app-edge bottom" />
              <div className="app-dock">
                <AppInput
                  value={draft}
                  onChange={setDraft}
                  onSend={() => send()}
                  placeholder="Talk to ONE"
                  caret
                />
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── PROFILE popup ── */}
      <Sheet open={openSheet === "profile"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <Orb size={72} />
            <div className="sheet-title">
              ONE <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
            </div>
            <div className="sheet-sub">Your representative across every identity.</div>
          </div>

          <div className="sheet-section">
            <h4>Account</h4>
            {user ? (
              <>
                <div className="sheet-row">
                  <span className="r-label">{user.name ?? user.email ?? "Signed in"}</span>
                  <span className="r-value" style={{ color: "var(--p-ok)", fontWeight: 600 }}>☁ synced</span>
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
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="sheet-sub" style={{ marginBottom: 10 }}>
                  Sign in so your processes follow you across every device.
                </div>
                <button className="google-btn" onClick={continueWithGoogle}>
                  <GoogleG /> Continue with Google
                </button>
                <div className="auth-or">
                  <span>or a magic link</span>
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
                    Send link
                  </button>
                </div>
                {authMsg && <div className="auth-msg">{authMsg}</div>}
              </>
            )}
          </div>

          <div className="sheet-section">
            <h4>Identity</h4>
            {IDENTITIES.map((id) => (
              <button
                key={id.id}
                className="sheet-row"
                style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
                onClick={() => {
                  setActiveIdentityId(id.id);
                  setOpenSheet(null);
                }}
              >
                <span className="r-label">
                  {id.emoji} {id.name}
                </span>
                <span className="r-value">
                  {id.role}
                  {id.id === activeIdentityId ? " · active" : ""}
                </span>
              </button>
            ))}
          </div>

          <div className="sheet-section">
            <h4>Plan</h4>
            {plan === "free" ? (
              <>
                <div className="sheet-row">
                  <span className="r-label">You&apos;re on FREE</span>
                  <span className="r-value">Unlock more with Pro / Max</span>
                </div>
                <button
                  className="sheet-pill blue"
                  style={{ width: "100%", marginTop: 4, padding: "12px" }}
                  onClick={() => setOpenSheet("subscription")}
                >
                  Upgrade
                </button>
              </>
            ) : (
              <div className="sheet-row">
                <span className="r-label">Active plan</span>
                <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
              </div>
            )}
          </div>

          <div className="sheet-section">
            <h4>More</h4>
            <div className="sheet-row">
              <span className="r-label">Memory</span>
              <span className="r-value">{PROCESSES.length} processes remembered</span>
            </div>
            <div className="sheet-row">
              <span className="r-label">Connections</span>
              <span className="r-value">1 of 6 connected</span>
            </div>
            <button
              className="sheet-row"
              style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
              onClick={() => setOpenSheet("settings")}
            >
              <span className="r-label">Settings</span>
              <span className="r-value">›</span>
            </button>
          </div>
        </div>
      </Sheet>

      {/* ── SUBSCRIPTION popup ── */}
      <Sheet open={openSheet === "subscription"} onClose={() => setOpenSheet("profile")}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">Upgrade ONE</div>
            <div className="sheet-sub">Choose the plan that fits how much you move.</div>
          </div>
          <div className="plan-tiers">
            <div className="plan-tier">
              <div className="t-name" style={{ color: "var(--p-blue)" }}>
                Pro
              </div>
              <div className="t-price">₪29</div>
              <div className="t-per">per month</div>
              <button
                className="sheet-pill blue"
                style={{ width: "100%" }}
                onClick={() => {
                  setPlan("pro");
                  setOpenSheet("profile");
                }}
              >
                Choose Pro
              </button>
            </div>
            <div className="plan-tier">
              <div className="t-name" style={{ color: "var(--p-purple)" }}>
                Max
              </div>
              <div className="t-price">₪69</div>
              <div className="t-per">per month</div>
              <button
                className="sheet-pill purple"
                style={{ width: "100%" }}
                onClick={() => {
                  setPlan("max");
                  setOpenSheet("profile");
                }}
              >
                Choose Max
              </button>
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-row">
              <span className="r-label">Pro</span>
              <span className="r-value">Unlimited identities · advanced model</span>
            </div>
            <div className="sheet-row">
              <span className="r-label">Max</span>
              <span className="r-value">Everything in Pro · proactive ONE</span>
            </div>
          </div>
        </div>
      </Sheet>

      {/* ── SETTINGS popup ── */}
      <Sheet open={openSheet === "settings"} onClose={() => setOpenSheet(null)}>
        <div className="sheet-body">
          <div className="sheet-hero">
            <div className="sheet-title">Settings</div>
          </div>
          <div className="sheet-section">
            <h4>Preferences</h4>
            <div className="sheet-row">
              <span className="r-label">Language</span>
              <span className="r-value">English</span>
            </div>
            <div className="sheet-row">
              <span className="r-label">Theme</span>
              <span className="r-value">Light</span>
            </div>
          </div>
          <div className="sheet-section">
            <h4>Account</h4>
            <button
              className="sheet-row"
              style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
              onClick={() => setOpenSheet("subscription")}
            >
              <span className="r-label">Subscription</span>
              <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
            </button>
            <div className="sheet-row">
              <span className="r-label">Export my data</span>
              <span className="r-value">›</span>
            </div>
            <div className="sheet-row">
              <span className="r-label" style={{ color: "#DC2626" }}>
                Sign out
              </span>
              <span className="r-value">›</span>
            </div>
          </div>
          <div className="sheet-section">
            <Link href="/" className="sheet-pill ghost" style={{ display: "inline-block" }}>
              ← Back to site
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
