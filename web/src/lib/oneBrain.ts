/**
 * oneBrain — the (mock) intelligence behind the web ONE.
 *
 * It does three things a dumb echo can't:
 *   1. Builds a COMPLETE, domain-aware process from a single line of intent —
 *      real steps, a first decision, a summary, a timeline — not a 3-step stub.
 *   2. SHARPENS that process turn by turn: each follow-up answer locks in a
 *      detail (date / budget / place), ticks the next step, and advances it.
 *   3. Talks to OTHER profiles: ONE "reaches out" to a business's ONE and, a
 *      beat later, an update lands back on the process (new timeline entry,
 *      fresh summary, unread bump) — the ONE-to-ONE loop, visible.
 *
 * All deterministic-ish mock logic; no network. The page owns time + state and
 * applies whatever this returns.
 */

import type { Process, Metric } from "./mockData";

export type ChatMsg = {
  role: "user" | "one";
  text: string;
  /**
   * Who is speaking, for a multi-party process thread: "you" (the user), "one"
   * (their agent), or "them" (the other side — a business or person the process
   * is with). Defaults from `role` when absent. This is what lets the whole
   * back-and-forth live inside the process instead of scattered across
   * WhatsApp/email, with a filter to show just one side.
   */
  party?: "you" | "one" | "them";
  /** Display name of the "them" speaker (the office / business / person). */
  from?: string;
  /** Optional quick-reply chips ONE offers — tap to answer (times, days, …). */
  chips?: string[];
  /** A multiple-choice quiz question — tapping an option answers it. */
  quiz?: { options: string[]; answer: number };
  /**
   * An intake question ONE asks to tailor a process — tapping a choice answers
   * it (you can also just type). `field` labels what it captures; `procId` is
   * the process being tailored. ONE runs a short interview, then leads.
   */
  intake?: { options: string[]; field: string; procId: string };
  /**
   * Bookable time slots ONE found — tapping one books it into the process
   * (timeline + a "When" metric) and confirms. `topic` labels the booking;
   * `procId` is the process the slot books into (absent = create one).
   */
  booking?: { slots: string[]; topic: string; procId?: string };
  /**
   * Candidate providers ONE found/generated for a need — tapping one adds it to
   * your directory + connections and offers to reach out. `procId` ties them to
   * the process they were found for.
   */
  providers?: {
    need: string;
    procId?: string;
    items: { name: string; category: string; area: string; blurb: string }[];
  };
  /** An illustrative image URL (e.g. a Wikipedia thumbnail) shown in the bubble. */
  image?: string;
  /** Structured result cards (flights, venues, options…) rendered as a clean list
   *  under the bubble instead of a wall of text. `url` makes the card a link. */
  cards?: { title: string; subtitle?: string; meta?: string; url?: string }[];
  /** Set when this message came from (or was synced to) a shared-unit thread —
   *  the id in shared_unit_messages. Marks it so the mirror won't re-post it. */
  sid?: string;
  /** A source ONE drew on when answering a regulated-domain question. */
  cite?: { emoji: string; label: string; host: string };
  /** Action chips — enable a capability, upgrade, share a fact, or route into a process. */
  actions?: {
    label: string;
    kind: "enableCap" | "upgrade" | "shareMem" | "routeProcess" | "routeProfile";
    cap?: string;
    run?: string;
    /** For kind==="shareMem": the MEMORY_CATALOG key this chip grants for the process. */
    mem?: string;
    /** For routeProcess: the process id to open. For routeProfile: the identity id to switch to. */
    proc?: string;
  }[];
};

export interface Outreach {
  /** How long until the business's ONE "replies". */
  delayMs: number;
  /** ONE's chat line when the reply lands. */
  line: string;
  /** New home broadcast line. */
  broadcast: string;
  /** How the focused process changes when the reply lands. */
  apply: (p: Process) => Process;
}

export interface BrainResult {
  /** 1–2 chat lines ONE says now. */
  lines: string[];
  /** A created or updated process to upsert; it becomes the focus. */
  process?: Process;
  /** Optional new home broadcast line. */
  broadcast?: string;
  /** Optional delayed inbound update from a business/party. */
  outreach?: Outreach;
}

export interface BrainContext {
  identityId: string;
  /** Date.now() from the page — the page owns time. */
  now: number;
  /** Visible processes for the active identity. */
  processes: Process[];
  /** The process currently being refined (last created / discussed). */
  focus: Process | null;
  /** App language, so scaffolding text (timeline, etc.) matches the UI. */
  lang?: "en" | "he";
}

interface Domain {
  id: string;
  re: RegExp;
  emoji: string;
  steps: string[];
  people: string[];
  firstDecision?: string;
  summary: string;
  ask: string;
  outreachWho: string;
  outreachBack: string;
}

const DOMAINS: Domain[] = [
  {
    id: "travel",
    re: /\b(trip|travel|vacation|holiday|flight|flights|fly|abroad|getaway|japan|italy|paris|tokyo|europe|thailand|greece)\b/,
    emoji: "✈️",
    steps: ["Set your dates & length", "Set a budget range", "Compare flight options", "Shortlist places to stay", "Draft a day-by-day plan", "Book flights & first nights"],
    people: [],
    summary: "Fresh start — I'm scoping dates, budget and the first bookings.",
    ask: "When are you thinking of going, and a rough budget?",
    outreachWho: "a travel desk",
    outreachBack: "3 flight options under budget, best on your dates.",
  },
  {
    id: "gov",
    re: /\b(passport|licen[sc]e|visa|permit|id card|renew|renewal|government|ministry|dmv|registration)\b/,
    emoji: "📋",
    steps: ["Check status & expiry", "Gather the required documents", "Book an appointment", "Pay the fee", "Submit & track"],
    people: [],
    summary: "Fresh start — I'm checking requirements and the fastest appointment.",
    ask: "Do you have your current document number and expiry handy?",
    outreachWho: "the issuing office",
    outreachBack: "earliest appointment is next Tuesday at 10:00.",
  },
  {
    id: "move",
    re: /\b(move|moving|apartment|relocat|movers|lease|new place|flat|storage)\b/,
    emoji: "📦",
    steps: ["Set a move date", "Give notice to your landlord", "Get 3 mover quotes", "Book the movers", "Transfer utilities", "Update your address"],
    people: [],
    summary: "Fresh start — I'm lining up dates, quotes and the logistics.",
    ask: "What's your target move date, and roughly where to?",
    outreachWho: "3 moving companies",
    outreachBack: "cheapest quote is ₪1,750 for a weekday move.",
  },
  {
    id: "fitness",
    re: /\b(weight|gym|workout|fitness|muscle|diet|lose|gain|run|marathon|strength|nutrition|coach)\b/,
    emoji: "💪",
    steps: ["Set the goal & timeline", "Find a coach", "Plan weekly training", "Set nutrition targets", "Weekly check-in"],
    people: [],
    summary: "Fresh start — I'm setting the goal and finding the right coach.",
    ask: "What's the goal, and by when?",
    outreachWho: "two coaches",
    outreachBack: "Coach Eli has Tue/Thu evening slots open.",
  },
  {
    id: "appointment",
    re: /\b(appointment|salon|haircut|barber|dentist|doctor|clinic|book a|booking|reserve|reservation|table)\b/,
    emoji: "📅",
    steps: ["Pick a provider", "Choose a time", "Confirm the booking", "Add to calendar", "Remind 24h before"],
    people: [],
    summary: "Fresh start — I'm finding a slot and confirming it for you.",
    ask: "Any preferred day or time?",
    outreachWho: "the provider",
    outreachBack: "confirmed for Tuesday at 18:00.",
  },
  {
    id: "business",
    re: /\b(lead|client|deal|proposal|pitch|sales|enterprise|contract|invoice|customer|prospect|pilot|b2b|partnership)\b/,
    emoji: "🤝",
    steps: ["Qualify the lead", "Book a discovery call", "Send the deck", "Scope a pilot", "Send the proposal", "Follow up"],
    people: [],
    summary: "Fresh start — I'm qualifying it and reaching their side.",
    ask: "What's the company, and the rough deal size?",
    outreachWho: "the client's ONE",
    outreachBack: "their ONE shared the procurement contact and a 3-week timeline.",
  },
  {
    id: "learning",
    re: /\b(learn|study|course|class|skill|language|guitar|piano|code|coding|programming|degree|certification)\b/,
    emoji: "📚",
    steps: ["Pick a clear path", "Find a course or tutor", "Set a weekly rhythm", "Hit the first milestone", "Review & adjust"],
    people: [],
    summary: "Fresh start — I'm shaping a path and finding a tutor.",
    ask: "What do you want to be able to do, and by when?",
    outreachWho: "two tutors",
    outreachBack: "one tutor is free Mondays, another does weekends.",
  },
  {
    id: "event",
    re: /\b(wedding|party|birthday|event|celebration|anniversary|host|gathering)\b/,
    emoji: "🎉",
    steps: ["Set date & guest count", "Set a budget", "Pick a venue", "Line up vendors", "Send invites", "Final headcount"],
    people: [],
    summary: "Fresh start — I'm setting the date, budget and venue options.",
    ask: "When is it, and how many guests?",
    outreachWho: "two venues",
    outreachBack: "one venue is open on your date, within budget.",
  },
  {
    id: "finance",
    re: /\b(budget|save|saving|invest|loan|mortgage|insurance|tax|pension|debt|refinanc)\b/,
    emoji: "💰",
    steps: ["Map the numbers", "Set a target", "Compare options", "Pick a plan", "Set a monthly review"],
    people: [],
    summary: "Fresh start — I'm mapping the numbers and comparing options.",
    ask: "What's the target, and your timeframe?",
    outreachWho: "two providers",
    outreachBack: "one provider beats your current rate by 0.4%.",
  },
];

const GENERIC: Domain = {
  id: "generic",
  re: /.^/,
  emoji: "🎯",
  steps: ["Define what 'done' looks like", "Map the moving parts", "Line up the first move", "Set a check-in"],
  people: [],
  summary: "Fresh start — I'm mapping the first moves.",
  ask: "What does a great outcome look like for you?",
  outreachWho: "the right contact",
  outreachBack: "I found the right person to move this forward.",
};

/**
 * Per-type view config — the "smart" part of a unit: which metrics matter, what
 * the pulse (next action) should say given what's known, and which quick actions
 * + insights fit. Metrics recompute from `fields` as the conversation fills them.
 */
type Fields = Record<string, string>;
interface DomainProfile {
  nextAction: (f: Fields) => string;
  metrics: (f: Fields) => Metric[];
  quickActions: string[];
  insights: string[];
}

const dash = (v?: string) => v ?? "—";

const PROFILES: Record<string, DomainProfile> = {
  travel: {
    nextAction: (f) => (f.date && f.budget ? "Compare flights and shortlist stays." : "Lock your dates and a budget to start booking."),
    metrics: (f) => [
      { label: "Destination", value: dash(f.place) },
      { label: "Dates", value: dash(f.date) },
      { label: "Budget", value: dash(f.budget) },
      { label: "Bookings", value: "0 / 2" },
    ],
    quickActions: ["Add a booking", "Set the dates", "Build a packing list"],
    insights: ["Book flights before stays — they swing the budget most.", "Prices climb the closer you get to the date."],
  },
  gov: {
    nextAction: (f) => (f.date ? "Prep your documents for the appointment." : "Book the earliest appointment."),
    metrics: (f) => [
      { label: "Status", value: "In progress" },
      { label: "Appointment", value: dash(f.date) },
      { label: "Fee", value: dash(f.budget) },
      { label: "Documents", value: "0 / 3" },
    ],
    quickActions: ["Book appointment", "Upload a document", "Add the fee"],
    insights: ["Bring originals and copies so you don't need a second trip."],
  },
  move: {
    nextAction: (f) => (f.date ? "Book the movers for your date." : "Set a move date to lock the quotes."),
    metrics: (f) => [
      { label: "Move date", value: dash(f.date) },
      { label: "Quotes", value: "3" },
      { label: "Best quote", value: dash(f.budget) || "₪1,750" },
      { label: "Utilities", value: "Pending" },
    ],
    quickActions: ["Book movers", "Transfer utilities", "Box list"],
    insights: ["Give 30 days' notice before you book the movers."],
  },
  fitness: {
    nextAction: (f) => (f.date ? "Lock a weekly training rhythm." : "Set a goal and a timeline."),
    metrics: (f) => [
      { label: "Goal", value: dash(f.place) },
      { label: "Timeline", value: dash(f.date) },
      { label: "Workouts / wk", value: "3" },
      { label: "Check-in", value: "Weekly" },
    ],
    quickActions: ["Log weight", "Add a meal", "Set a reminder"],
    insights: ["Track 2–3× a week so the trend is real, not noise."],
  },
  appointment: {
    nextAction: (f) => (f.date ? "Confirm 24h before." : "Pick a day and time."),
    metrics: (f) => [
      { label: "When", value: dash(f.date) },
      { label: "Provider", value: "—" },
      { label: "Status", value: f.date ? "Booked" : "Not set" },
    ],
    quickActions: ["Add to calendar", "Reschedule", "Message provider"],
    insights: ["Confirm the day before to avoid a wasted slot."],
  },
  business: {
    nextAction: (f) => (f.budget ? "Scope a pilot and send the proposal." : "Qualify the deal size and timeline."),
    metrics: (f) => [
      { label: "Stage", value: "Qualifying" },
      { label: "Deal size", value: dash(f.budget) },
      { label: "Next touch", value: dash(f.date) },
      { label: "Champion", value: "—" },
    ],
    quickActions: ["Send proposal", "Log a call", "Share deck"],
    insights: ["Reach the client's ONE to shortcut procurement."],
  },
  learning: {
    nextAction: (f) => (f.date ? "Hit the first milestone." : "Pick a path and a weekly rhythm."),
    metrics: (f) => [
      { label: "Goal", value: dash(f.place) },
      { label: "Rhythm", value: f.date ? "Set" : "—" },
      { label: "Milestone", value: "—" },
      { label: "Tutor", value: "—" },
    ],
    quickActions: ["Find a tutor", "Set a schedule", "Log practice"],
    insights: ["A fixed weekly slot beats motivation every time."],
  },
  event: {
    nextAction: (f) => (f.date ? "Lock a venue for your date." : "Set the date and guest count."),
    metrics: (f) => [
      { label: "Date", value: dash(f.date) },
      { label: "Guests", value: "—" },
      { label: "Budget", value: dash(f.budget) },
      { label: "Venue", value: "—" },
    ],
    quickActions: ["Add a vendor", "Set the budget", "Send invites"],
    insights: ["Book the venue first — everything else keys off it."],
  },
  finance: {
    nextAction: (f) => (f.budget ? "Compare options and pick a plan." : "Set a target and a timeframe."),
    metrics: (f) => [
      { label: "Target", value: dash(f.budget) },
      { label: "Timeframe", value: dash(f.date) },
      { label: "Options", value: "—" },
      { label: "Review", value: "Monthly" },
    ],
    quickActions: ["Compare options", "Set a target", "Add a note"],
    insights: ["Small automatic transfers compound fastest."],
  },
  generic: {
    nextAction: (f) => (f.date ? "Line up the next move." : "Tell me what a great outcome looks like."),
    metrics: (f) => [
      { label: "Status", value: "New" },
      { label: "Next", value: dash(f.date) },
      { label: "Owner", value: "You" },
    ],
    quickActions: ["Add a step", "Set a reminder", "Talk to ONE"],
    insights: ["I'll surface what needs you and keep the rest moving."],
  },
};

const INTENT_RE =
  /\b(start|begin|book|plan|buy|sell|move|learn|find|call|email|schedule|renew|open|apply|organi[sz]e|launch|hire|fix|register|get|make|build|arrange|sort|handle|set up|need|want|help)\b|i'?d like|i'?m trying/i;

const TITLE_STOP = new Set(["to", "a", "an", "the", "for", "of", "with", "my", "on", "and", "in", "at", "by", "from", "this", "that"]);

function titleFrom(text: string): string {
  const cleaned = text
    .replace(/^\s*(i\s+)?(want to|need to|would like to|i'?d like to|please|can you|could you|help me|let'?s)\s+/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 6);
  while (words.length > 1 && TITLE_STOP.has(words[words.length - 1].toLowerCase())) words.pop();
  const t = words.join(" ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "New process";
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

function extractDetail(text: string): { date?: string; budget?: string; place?: string } {
  const out: { date?: string; budget?: string; place?: string } = {};
  const budget = text.match(/([₪$€]\s?\d[\d,]*)|(\b\d+\s?k\b)|(\b\d{3,}\s?(ils|nis|usd|eur|shekels?)?\b)/i);
  if (budget) out.budget = budget[0].trim();
  const date = text.match(
    new RegExp(`\\b(next week|next month|this week|tomorrow|tonight|spring|summer|autumn|fall|winter|${MONTHS}|${DAYS}|\\d{1,2}(st|nd|rd|th)?( of)? (${MONTHS})?)\\b`, "i"),
  );
  if (date) out.date = date[0].trim();
  // A capitalised word that isn't the sentence start — a place / proper noun.
  const place = text.match(/(?:to|in|at|near|around)\s+([A-Z][a-zA-Z]{2,})/);
  if (place) out.place = place[1];
  return out;
}

function isSmalltalk(t: string): boolean {
  return t.length < 26 && /^(hi|hey|hello|yo|shalom|thanks|thank you|thx|ty|ok|okay|cool|great|nice|sup|good morning|good evening)\b/.test(t);
}

function looksLikeDetail(t: string): boolean {
  return (
    t.length < 34 ||
    /\b(yes|yeah|yep|no|nope|sure|maybe|next week|tomorrow|spring|summer|autumn|winter|budget)\b/.test(t) ||
    /[₪$€]|\d/.test(t)
  );
}

function namedMatch(t: string, title: string): boolean {
  const lower = title.toLowerCase();
  if (t.includes(lower)) return true;
  const first = lower.split(" ")[0];
  return first.length > 3 && t.includes(first);
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let seq = 0;
function build(domain: Domain, text: string, ctx: BrainContext): Process {
  seq += 1;
  const profile = PROFILES[domain.id] ?? PROFILES.generic;
  const fields: Fields = {};
  return {
    id: `new_${ctx.now}_${seq}`,
    identityId: ctx.identityId,
    emoji: domain.emoji,
    title: titleFrom(text),
    time: "now",
    unread: 1,
    summary: domain.summary,
    relation: "Private",
    progress: { done: 0, total: domain.steps.length },
    people: [...domain.people],
    steps: domain.steps.map((label) => ({ label, done: false })),
    decisions: domain.firstDecision ? [domain.firstDecision] : [],
    timeline: [
      {
        at: "now",
        text: ctx.lang === "he" ? "ביקשת מ‑ONE לקחת את זה על עצמו." : "You asked ONE to take this on.",
      },
    ],
    type: domain.id,
    fields,
    nextAction: profile.nextAction(fields),
    metrics: profile.metrics(fields),
    quickActions: [...profile.quickActions],
    insights: [...profile.insights],
  };
}

function makeOutreach(domain: Domain): Outreach {
  const who = sentenceCase(domain.outreachWho);
  return {
    delayMs: 1500,
    line: `📨 ${who} got back to me — ${domain.outreachBack}`,
    broadcast: `${who} replied — ${domain.outreachBack}`,
    apply: (p) => ({
      ...p,
      unread: p.unread + 1,
      time: "now",
      summary: sentenceCase(domain.outreachBack),
      timeline: [{ at: "now", text: `${who}: ${domain.outreachBack}` }, ...p.timeline],
    }),
  };
}

function refine(focus: Process, text: string, domain: Domain): BrainResult {
  const d = extractDetail(text);
  const fields: Fields = { ...(focus.fields ?? {}) };
  if (d.date) fields.date = d.date;
  if (d.budget) fields.budget = d.budget;
  if (d.place) fields.place = d.place;
  const profile = PROFILES[focus.type ?? "generic"] ?? PROFILES.generic;
  const bits: string[] = [];
  if (d.place) bits.push(`to ${d.place}`);
  if (d.date) bits.push(`for ${d.date}`);
  if (d.budget) bits.push(`budget ${d.budget}`);

  const idx = focus.steps.findIndex((s) => !s.done);
  const steps = focus.steps.map((s, i) => (i === idx ? { ...s, done: true } : s));
  const doneStep = idx >= 0 ? focus.steps[idx].label : null;
  const done = steps.filter((s) => s.done).length;

  const decisions = [...focus.decisions];
  if (d.date && !decisions.some((x) => x.startsWith("Target"))) decisions.unshift(`Target: ${d.date}`);
  if (d.budget && !decisions.some((x) => x.startsWith("Budget"))) decisions.unshift(`Budget: ${d.budget}`);
  if (d.place && !decisions.some((x) => x.startsWith("Destination"))) decisions.unshift(`Destination: ${d.place}`);

  const summary = bits.length
    ? `Locked ${bits.join(", ")}. ${done}/${steps.length} steps done — on the next move.`
    : `${done}/${steps.length} steps done — I'm on the next move.`;

  const updated: Process = {
    ...focus,
    steps,
    decisions,
    summary,
    unread: focus.unread + 1,
    time: "now",
    progress: { done, total: steps.length },
    fields,
    metrics: profile.metrics(fields),
    nextAction: profile.nextAction(fields),
    timeline: [
      { at: "now", text: bits.length ? `You set ${bits.join(", ")}.` : "You added detail; I advanced the plan." },
      ...focus.timeline,
    ],
  };

  const who = sentenceCase(domain.outreachWho);
  const lead = bits.length
    ? `Got it — ${bits.join(", ")}.`
    : `Noted.`;
  const lines = [
    `${lead} I ticked “${doneStep ?? "the first step"}” and I'm reaching out to ${domain.outreachWho} now.`,
  ];

  return {
    lines,
    process: updated,
    broadcast: `${focus.title}: ${done}/${steps.length} done — contacting ${who}.`,
    outreach: makeOutreach(domain),
  };
}

function domainOf(p: Process): Domain {
  const hay = `${p.title} ${p.summary}`.toLowerCase();
  return DOMAINS.find((d) => d.re.test(hay)) ?? GENERIC;
}

const GREETINGS = [
  "I'm here. Tell me what you want to move forward — I'll take it from there.",
  "Ready. What's on your plate — I'll turn it into something that moves itself.",
];

export function interpret(text: string, ctx: BrainContext): BrainResult {
  const t = text.trim().toLowerCase();
  if (!t) return { lines: [GREETINGS[0]] };
  if (isSmalltalk(t)) return { lines: [/thank|thx|ty/.test(t) ? "Anytime. I'll keep everything moving in the background." : GREETINGS[ctx.processes.length % GREETINGS.length]] };

  // Reference an existing (non-focus) process by name — a status question.
  const named = ctx.processes.find((p) => (!ctx.focus || p.id !== ctx.focus.id) && namedMatch(t, p.title));
  if (named && !looksLikeDetail(t)) {
    return { lines: [`On “${named.title}”: ${named.summary} I'll flag you the moment it needs you.`] };
  }

  const domain = DOMAINS.find((d) => d.re.test(t));
  const intent = INTENT_RE.test(t);
  const focusDomain = ctx.focus ? domainOf(ctx.focus) : undefined;

  // A brand-new intent in a DIFFERENT domain than the current focus → new process.
  const isNewIntent = !!domain && intent && (!focusDomain || domain.id !== focusDomain.id);
  if (isNewIntent) {
    const process = build(domain!, text, ctx);
    return {
      lines: [
        `Done — I've opened “${process.title}” and mapped ${process.steps.length} steps to get it moving.`,
        domain!.ask,
      ],
      process,
      broadcast: `Started “${process.title}” — ${process.steps.length} steps queued.`,
      outreach: makeOutreach(domain!),
    };
  }

  // With a focus in play, treat this as sharpening that process.
  if (ctx.focus && focusDomain) {
    return refine(ctx.focus, text, focusDomain);
  }

  // No focus, no matched domain, but a real ask → build a full generic process.
  if (intent || text.trim().length > 8) {
    const dom = domain ?? GENERIC;
    const process = build(dom, text, ctx);
    return {
      lines: [`Done — I've opened “${process.title}” and lined up the first ${process.steps.length} moves.`, dom.ask],
      process,
      broadcast: `Started “${process.title}”.`,
      outreach: makeOutreach(dom),
    };
  }

  return { lines: [GREETINGS[0]] };
}
