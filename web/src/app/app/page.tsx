"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Orb } from "@/components/Orb";
import { Splash } from "@/components/Splash";
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
      <Splash bg="var(--p-bg)" />
      <div className="app-shell">
        {/* LEFT rail — a sidebar on desktop, a compact top header on mobile */}
        <aside className="app-side">
          <button className="app-orb" onClick={() => setOpenSheet("profile")} aria-label="Open profile">
            <Orb size={78} />
          </button>
          <div className="app-name">
            ONE <span className={`app-plan ${planMeta.className}`}>{planMeta.word}</span>
          </div>
          <div className="app-broadcast" style={{ opacity: liveBroadcast ? 1 : bfade ? 0 : 1 }}>
            {liveBroadcast ?? broadcastLines[bi % broadcastLines.length]}
          </div>
          <div className={`cloud-status cloud-${cloud}`} title="Where your processes are saved">
            {cloud === "synced" && "☁ Synced to cloud"}
            {cloud === "connecting" && "☁ Connecting…"}
            {cloud === "offline" && "• Local only"}
          </div>

          {/* Identity switcher — shown in the sidebar on desktop; on mobile the
              identities live in the profile popup, so this is hidden. */}
          <nav className="side-ids">
            <div className="side-label">Identities</div>
            {IDENTITIES.map((id) => (
              <button
                key={id.id}
                className={`side-id${id.id === activeIdentityId ? " active" : ""}`}
                onClick={() => setActiveIdentityId(id.id)}
              >
                <span className="side-id-emoji">{id.emoji}</span>
                <span className="side-id-text">
                  <span className="side-id-name">{id.name}</span>
                  <span className="side-id-role">{id.role}</span>
                </span>
              </button>
            ))}
          </nav>

          {/* Discover — walk into any business's ONE (chat, ask, book) */}
          <nav className="side-ids">
            <div className="side-label">Nearby ONEs</div>
            {businesses.map((b) => (
              <button key={b.id} className="side-id" onClick={() => openBiz(b.id)}>
                <span className="side-id-emoji">{b.emoji}</span>
                <span className="side-id-text">
                  <span className="side-id-name">
                    {b.name}
                    {b.ownerKey && ownerKey && b.ownerKey === ownerKey ? " · yours" : ""}
                  </span>
                  <span className="side-id-role">{b.category}</span>
                </span>
              </button>
            ))}
            <button className="side-id side-id-new" onClick={startCreateBusiness}>
              <span className="side-id-emoji">＋</span>
              <span className="side-id-text">
                <span className="side-id-name">Create a business ONE</span>
                <span className="side-id-role">Set hours, services — or just describe it</span>
              </span>
            </button>
          </nav>

          <button className="side-gear" onClick={() => setOpenSheet("settings")} aria-label="Settings">
            <GearIcon />
            <span className="side-gear-label">Settings</span>
          </button>
        </aside>

        {/* RIGHT — the workspace: broadcast-driven cards or the conversation */}
        <section className="app-main">
          <div className="app-edge top" />
          {chat.length > 0 && (
            <button className="app-close" onClick={endChat} aria-label="Close chat">
              ×
            </button>
          )}

        {chat.length === 0 ? (
        <div className="app-cards">
          {processes.map((p) => {
            const done = p.steps.filter((_, i) => isStepDone(p, i)).length;
            const total = p.steps.length;
            return (
              <div
                key={p.id}
                className="ucard"
                onClick={() => setActiveProcess(p)}
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
          <input
            className="app-input"
            placeholder="Talk to ONE"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="app-send" aria-label="Send" onClick={() => send()}>
            <SendIcon />
          </button>
        </div>
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

      {/* ── PROCESS popup — a type-aware unit profile ── */}
      <Sheet open={!!activeProcess} onClose={() => setActiveProcess(null)}>
        {activeLive && (
          <div className="sheet-body">
            {/* Header + pulse (one short "what's next", not a repeat of the stats) */}
            <div className="sheet-hero">
              <div className="sheet-title">
                <span>{activeLive.emoji}</span> {activeLive.title}
              </div>
              {activeLive.nextAction && <div className="unit-pulse">{activeLive.nextAction}</div>}
            </div>

            {/* Key metrics — chosen per unit type */}
            {activeLive.metrics && activeLive.metrics.length > 0 && (
              <div className="metric-grid">
                {activeLive.metrics.map((m) => (
                  <div className="metric" key={m.label}>
                    <div className="metric-value">{m.value}</div>
                    <div className="metric-label">{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick actions — contextual */}
            {activeLive.quickActions && activeLive.quickActions.length > 0 && (
              <div className="qa-row">
                {activeLive.quickActions.map((a) => (
                  <button key={a} className="qa-btn" onClick={() => runQuickAction(activeLive, a)}>
                    {a}
                  </button>
                ))}
              </div>
            )}

            <div className="sheet-section">
              <h4>Next steps</h4>
              {activeLive.steps.map((s, i) => {
                const done = isStepDone(activeLive, i);
                return (
                  <button
                    key={i}
                    className={`step-item${done ? " done" : ""}`}
                    style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                    onClick={() => toggleStep(activeLive, i)}
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
                {(activeLive.people.length ? activeLive.people : [activeLive.relation])
                  .filter(Boolean)
                  .map((person) => {
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

            {activeLive.insights && activeLive.insights.length > 0 && (
              <div className="sheet-section">
                <h4>Insights</h4>
                <div className="insight-list">
                  {activeLive.insights.map((t, i) => (
                    <div className="insight" key={i}>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeLive.decisions.length > 0 && (
              <div className="sheet-section">
                <h4>Decisions</h4>
                {activeLive.decisions.map((d) => (
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
              {activeLive.timeline.map((ev, i) => (
                <div className="timeline-item" key={i}>
                  <span className="timeline-dot" />
                  <span>
                    <b style={{ fontWeight: 600 }}>{ev.at}</b> — {ev.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Sources — where ONE pulls this unit's reality from. */}
            {unitSources(activeLive).length > 0 && (
              <div className="sheet-section">
                <h4>Sources</h4>
                <div className="source-list">
                  {unitSources(activeLive).map((s) => (
                    <div className="source-item" key={s.label}>
                      <span className="source-dot" />
                      <span className="source-label">{s.label}</span>
                      <span className="source-detail">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <input
                className="app-input"
                style={{ boxShadow: "none", background: "var(--p-bg)" }}
                placeholder={`Ask ONE about ${activeLive.title}…`}
              />
              <button className="app-send" aria-label="Send">
                <SendIcon />
              </button>
            </div>
          </div>
        )}
      </Sheet>

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
