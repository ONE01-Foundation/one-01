/** Mock product data for the web ONE — mirrors the mobile app's canonical set. */

export type PlanTier = "free" | "pro" | "max";

export interface Identity {
  id: string;
  name: string;
  role: string;
  emoji: string;
  /**
   * What kind of profile this is. "personal" = you as a private person,
   * "business" = a business you run, "supplier" = the OTHER side (a provider)
   * — used to test a two-sided process from the provider's seat.
   */
  kind?: "personal" | "business" | "supplier";
}

export interface Step {
  label: string;
  done: boolean;
}

/**
 * A request that crossed profiles — the spine of the two-sided loop. When a
 * personal ONE reaches out to a provider, an InboundRequest lands in that
 * supplier profile's inbox; the supplier accepts/declines and replies, and it
 * flows back. Persisted locally in `one_requests`.
 */
/**
 * A reminder ONE holds for you — the "nudges you before anything is due"
 * capability made real. Set from "remind me…", or created automatically when a
 * booking is confirmed. Scoped to a profile, optionally tied to a process.
 * Persisted locally in `one_reminders`.
 */
export interface Reminder {
  id: string;
  /** The identity (profile) this reminder belongs to. */
  identityId: string;
  /** What to be reminded of. */
  text: string;
  /** A human "when" label ("tomorrow 09:00", "24h before Tue 3/8"). */
  at: string;
  /** The process this reminder is attached to (opens it when tapped). */
  procId?: string;
  done: boolean;
}

export interface InboundRequest {
  id: string;
  /** The supplier identity (profile) this request is addressed to. */
  toProfileId: string;
  /** Who it's from (the requester's name/label). */
  fromName: string;
  /** The sending identity (profile) — so a reply can flow back to its home. */
  fromProfileId?: string;
  /** The process on the sender's side this request originated from. */
  procId?: string;
  title: string;
  message: string;
  status: "new" | "accepted" | "declined";
  /** The supplier's reply once they answer. */
  reply?: string;
  /** Set once the sender has seen the supplier's reply (clears the signal). */
  replySeen?: boolean;
  /** A wall-clock stamp string ("now" / a time), for display only. */
  at: string;
}

export interface TimelineEvent {
  at: string;
  text: string;
}

export interface Metric {
  label: string;
  value: string;
}

export interface Process {
  id: string;
  identityId: string;
  emoji: string;
  title: string;
  time: string;
  unread: number;
  summary: string;
  relation: string;
  progress: { done: number; total: number };
  people: string[];
  steps: Step[];
  decisions: string[];
  timeline: TimelineEvent[];
  // ── Type-aware unit profile (domain-specific, not one-size-fits-all) ──
  /** Unit type — drives which metrics / actions / insights the profile shows. */
  type?: string;
  /** One short "what to do next" pulse line (not a repeat of the stats). */
  nextAction?: string;
  /** 3–4 key metrics that matter for THIS kind of unit. */
  metrics?: Metric[];
  /** 3–4 contextual quick-action labels. */
  quickActions?: string[];
  /** ONE's value-add: tips, cautions — never a restatement of the data. */
  insights?: string[];
  /** Raw domain fields captured from the conversation. */
  fields?: Record<string, string>;
  /** The business this process is transacting with (opens its ONE profile). */
  businessId?: string;
  /** Persisted unit-chat transcript — reopening the process restores it. */
  chat?: { role: "user" | "one"; text: string; chips?: string[] }[];
  /** Outward drafts ONE has composed for this process — you review, edit, approve. */
  drafts?: UnitDraft[];
  /** AI-generated cover image (stored as reusable stock), keyed to the topic. */
  coverImage?: string;
  /** Per-step AI-generated images, keyed by step index → stock image URL. */
  stepImages?: Record<number, string>;
  /** Epoch ms of the last real activity — drives live relative time ("5m", "2h"). */
  updatedAt?: number;
  /** When set, this unit is shared: a common code others join to correspond inside. */
  shareCode?: string;
  /** True if this ONE created the share (drives ONE's replies in the shared room). */
  shareOwner?: boolean;
}

/**
 * A draft ONE has written to move a process forward — the actual outward message
 * (an email to the office, a note to a provider, a form answer). This is the
 * intention→reality bridge: ONE turns "renew my passport" into the real email,
 * ready for you to edit and approve. Approving only marks it ready — the app
 * never sends on the user's behalf; the user does that themselves.
 */
export interface UnitDraft {
  id: string;
  /** What kind of outward message this is — drives the icon and framing. */
  kind: "email" | "message" | "form";
  /** Who it's addressed to (a person, office, or business). */
  to: string;
  /** Subject line — emails only; blank for a message/form. */
  subject?: string;
  /** The body ONE wrote; the user can edit it freely before approving. */
  body: string;
  /** "draft" = ONE's proposal; "approved" = the user has okayed the wording. */
  status: "draft" | "approved";
}

// ── Business profiles — each has its own ONE that knows its hours, services and
// open slots, and can be booked through free conversation. ──
export interface BizService {
  name: string;
  price: string;
}
export interface BizHours {
  day: string;
  /** "" + close:null = closed that day. */
  open: string;
  close: string | null;
}
export interface Business {
  id: string;
  name: string;
  emoji: string;
  category: string;
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  blurb: string;
  hours: BizHours[];
  services: BizService[];
  /** Openable appointment slots ONE can book. */
  slots: string[];
  /** Capability key of whoever created this business (set for user-made ones). */
  ownerKey?: string;
}

export const BUSINESSES: Business[] = [
  {
    id: "sarah",
    name: "Sarah Salon",
    emoji: "💈",
    category: "Hair salon",
    rating: 4.8,
    reviews: 214,
    address: "12 Dizengoff St, Tel Aviv",
    phone: "03-555-0199",
    blurb: "Boutique salon — cut, color and styling. Walk-ins welcome midweek.",
    hours: [
      { day: "Sun", open: "09:00", close: "20:00" },
      { day: "Mon", open: "09:00", close: "20:00" },
      { day: "Tue", open: "09:00", close: "20:00" },
      { day: "Wed", open: "09:00", close: "20:00" },
      { day: "Thu", open: "09:00", close: "20:00" },
      { day: "Fri", open: "09:00", close: "14:00" },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "Haircut", price: "₪80" },
      { name: "Cut & blow-dry", price: "₪120" },
      { name: "Color", price: "₪250" },
      { name: "Highlights", price: "₪360" },
    ],
    slots: ["Tue 18:00", "Tue 19:30", "Wed 10:00", "Wed 16:30", "Thu 12:00", "Fri 09:30"],
  },
  {
    id: "dana",
    name: "Instructor Dana",
    emoji: "🚗",
    category: "Driving instructor",
    rating: 4.9,
    reviews: 88,
    address: "Ramat Gan",
    phone: "050-555-0142",
    blurb: "Patient automatic-license instructor. First lesson is a free assessment.",
    hours: [
      { day: "Sun", open: "08:00", close: "18:00" },
      { day: "Mon", open: "08:00", close: "18:00" },
      { day: "Tue", open: "08:00", close: "18:00" },
      { day: "Wed", open: "08:00", close: "18:00" },
      { day: "Thu", open: "08:00", close: "18:00" },
      { day: "Fri", open: "08:00", close: "12:00" },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "Driving lesson (45m)", price: "₪160" },
      { name: "Test-day escort", price: "₪450" },
    ],
    slots: ["Sun 08:00", "Mon 15:00", "Tue 09:00", "Wed 17:00", "Thu 11:00"],
  },
  {
    id: "allmove",
    name: "AllMove",
    emoji: "📦",
    category: "Moving company",
    rating: 4.6,
    reviews: 502,
    address: "Serves Gush Dan",
    phone: "03-555-0300",
    blurb: "Full-service movers — packing, transport and assembly.",
    hours: [
      { day: "Sun", open: "07:00", close: "19:00" },
      { day: "Mon", open: "07:00", close: "19:00" },
      { day: "Tue", open: "07:00", close: "19:00" },
      { day: "Wed", open: "07:00", close: "19:00" },
      { day: "Thu", open: "07:00", close: "19:00" },
      { day: "Fri", open: "07:00", close: "13:00" },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "2-room move", price: "from ₪1,750" },
      { name: "Packing add-on", price: "₪400" },
    ],
    slots: ["The 26th AM", "The 27th AM", "The 28th AM", "The 28th PM"],
  },
  // ── Business-facing listings — these surface in Global only on a business /
  //    supplier profile (Suppliers / Compliance / Marketing worlds).
  {
    id: "packpro",
    name: "PackPro Supplies",
    emoji: "📦",
    category: "Packaging supplier / wholesale",
    rating: 4.7,
    reviews: 138,
    address: "Kiryat Arye, Petah Tikva",
    phone: "03-555-0410",
    blurb: "Wholesale packaging, boxes and labels — next-day delivery on stock items.",
    hours: [
      { day: "Sun", open: "08:00", close: "17:00" },
      { day: "Mon", open: "08:00", close: "17:00" },
      { day: "Tue", open: "08:00", close: "17:00" },
      { day: "Wed", open: "08:00", close: "17:00" },
      { day: "Thu", open: "08:00", close: "17:00" },
      { day: "Fri", open: "08:00", close: "12:00" },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "Bulk carton order", price: "from ₪480" },
      { name: "Custom labels (1k)", price: "₪320" },
    ],
    slots: ["Sun 10:00", "Mon 14:00", "Wed 11:00", "Thu 15:00"],
  },
  {
    id: "ledgerly",
    name: "Ledgerly Accounting",
    emoji: "📋",
    category: "Accounting & compliance",
    rating: 4.9,
    reviews: 96,
    address: "Rothschild Blvd, Tel Aviv",
    phone: "03-555-0420",
    blurb: "Bookkeeping, payroll and VAT filing for small businesses — fixed monthly fee.",
    hours: [
      { day: "Sun", open: "09:00", close: "18:00" },
      { day: "Mon", open: "09:00", close: "18:00" },
      { day: "Tue", open: "09:00", close: "18:00" },
      { day: "Wed", open: "09:00", close: "18:00" },
      { day: "Thu", open: "09:00", close: "18:00" },
      { day: "Fri", open: "", close: null },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "Monthly bookkeeping", price: "from ₪900/mo" },
      { name: "Annual VAT filing", price: "₪1,400" },
    ],
    slots: ["Sun 12:00", "Tue 10:00", "Wed 16:00", "Thu 09:00"],
  },
  {
    id: "brightreach",
    name: "BrightReach Studio",
    emoji: "📣",
    category: "Marketing agency & branding",
    rating: 4.5,
    reviews: 72,
    address: "Sarona, Tel Aviv",
    phone: "03-555-0430",
    blurb: "Branding, social and paid campaigns — a growth partner for small teams.",
    hours: [
      { day: "Sun", open: "09:30", close: "18:30" },
      { day: "Mon", open: "09:30", close: "18:30" },
      { day: "Tue", open: "09:30", close: "18:30" },
      { day: "Wed", open: "09:30", close: "18:30" },
      { day: "Thu", open: "09:30", close: "18:30" },
      { day: "Fri", open: "", close: null },
      { day: "Sat", open: "", close: null },
    ],
    services: [
      { name: "Brand starter kit", price: "₪3,900" },
      { name: "Monthly social", price: "from ₪2,400/mo" },
    ],
    slots: ["Mon 11:00", "Tue 15:00", "Wed 13:00", "Thu 16:30"],
  },
];

export const IDENTITIES: Identity[] = [
  { id: "ariel", name: "Ariel", role: "Personal", emoji: "👤", kind: "personal" },
  { id: "one01", name: "ONE01", role: "Business", emoji: "🏢", kind: "business" },
  // A ready-made provider seat, so you can switch over and test a process from
  // the OTHER side (receiving/answering a request) without building one first.
  { id: "supplier_demo", name: "Test Provider", role: "Supplier", emoji: "🏪", kind: "supplier" },
];

export const PROCESSES: Process[] = [
  {
    id: "weight",
    identityId: "ariel",
    emoji: "💪",
    title: "Weight Gain",
    time: "14:20",
    unread: 2,
    summary: "Next workout today at 2:00 PM. Protein goal reached yesterday.",
    type: "fitness",
    nextAction: "Log today's protein, then hit the 2 PM upper-body session.",
    metrics: [
      { label: "Current", value: "71.4 kg" },
      { label: "Target", value: "75 kg" },
      { label: "Cal / day", value: "3,000" },
      { label: "Workouts / wk", value: "4" },
    ],
    quickActions: ["Log weight", "Add a meal", "Set a reminder"],
    insights: [
      "On tense weeks you drop faster — keep protein steady at 150g.",
      "Weigh in 2–3× a week so the trend is real, not noise.",
    ],
    relation: "Coach Eli +1",
    progress: { done: 21, total: 32 },
    people: ["Coach Eli", "Nutritionist Maya"],
    steps: [
      { label: "Log today's protein (150g)", done: false },
      { label: "Upper-body workout — 2:00 PM", done: false },
      { label: "Weigh in Friday morning", done: false },
      { label: "Send week 3 photos to Eli", done: true },
    ],
    decisions: ["Switched to 4 training days/week", "Creatine — 5g daily"],
    timeline: [
      { at: "Today", text: "Coach Eli adjusted the workout plan." },
      { at: "Yesterday", text: "Protein goal reached (152g)." },
      { at: "Mon", text: "Weighed in at 71.4kg (+0.3)." },
    ],
  },
  {
    id: "hair",
    identityId: "ariel",
    emoji: "💈",
    title: "Hair Appointment",
    time: "Tue 18:00",
    unread: 1,
    summary: "Sarah Salon confirmed your booking for Tuesday at 18:00.",
    type: "appointment",
    nextAction: "Confirm 24h before — Tuesday 18:00 is locked.",
    metrics: [
      { label: "When", value: "Tue 18:00" },
      { label: "Provider", value: "Sarah Salon" },
      { label: "Status", value: "Confirmed" },
    ],
    quickActions: ["Add to calendar", "Reschedule", "Message salon"],
    insights: ["Evening slots book out fast — keep this one held."],
    businessId: "sarah",
    relation: "Sarah Salon",
    progress: { done: 2, total: 3 },
    people: ["Sarah Salon"],
    steps: [
      { label: "Booking confirmed", done: true },
      { label: "Add to calendar", done: true },
      { label: "Confirm 24h before", done: false },
    ],
    decisions: ["Chose the 18:00 slot over 16:30"],
    timeline: [
      { at: "Today", text: "Sarah Salon's ONE confirmed Tuesday 18:00." },
      { at: "Yesterday", text: "Requested an evening slot." },
    ],
  },
  {
    id: "license",
    identityId: "ariel",
    emoji: "📋",
    title: "Driver's License",
    time: "3 left",
    unread: 0,
    summary: "Theory test scheduled. 2 forms still need your signature.",
    type: "gov",
    nextAction: "Sign the medical + consent forms to unlock your first lesson.",
    metrics: [
      { label: "Lessons", value: "0 / 28" },
      { label: "Theory", value: "Scheduled" },
      { label: "Est. cost", value: "₪7,500" },
      { label: "Next lesson", value: "Not set" },
    ],
    quickActions: ["Book a lesson", "Mark theory done", "Add an expense"],
    insights: [
      "At 2 lessons a week you'd reach the test in ~3 months.",
      "Your theory pass must still be valid on test day.",
    ],
    businessId: "dana",
    relation: "Ministry of Transport",
    progress: { done: 5, total: 8 },
    people: ["Instructor Dana"],
    steps: [
      { label: "Eye test", done: true },
      { label: "Register for theory", done: true },
      { label: "Sign medical form", done: false },
      { label: "Sign consent form", done: false },
      { label: "Book first lesson", done: false },
    ],
    decisions: ["Automatic transmission license"],
    timeline: [
      { at: "Today", text: "Theory test date assigned — March 20." },
      { at: "3 days ago", text: "Eye test passed." },
    ],
  },
  {
    id: "move",
    identityId: "ariel",
    emoji: "📦",
    title: "Move Apartment",
    time: "Yesterday",
    unread: 0,
    summary: "3 movers quoted. Cheapest is available on the 28th.",
    type: "move",
    nextAction: "Book the movers for the 28th before the slot is taken.",
    metrics: [
      { label: "Move date", value: "The 28th" },
      { label: "Quotes", value: "3" },
      { label: "Best quote", value: "₪1,850" },
      { label: "Utilities", value: "Pending" },
    ],
    quickActions: ["Book movers", "Transfer utilities", "Add a box list"],
    insights: ["Rates climb near month-end — lock the 28th this week."],
    businessId: "allmove",
    relation: "AllMove +2",
    progress: { done: 4, total: 12 },
    people: ["AllMove", "Landlord Gil"],
    steps: [
      { label: "Compare mover quotes", done: true },
      { label: "Give notice to landlord", done: true },
      { label: "Book movers for the 28th", done: false },
      { label: "Transfer utilities", done: false },
    ],
    decisions: ["Move date: the 28th", "Keep the sofa, sell the desk"],
    timeline: [
      { at: "Yesterday", text: "AllMove quoted ₪1,850 for the 28th." },
      { at: "2 days ago", text: "Gave 30-day notice." },
    ],
  },
  {
    id: "lead",
    identityId: "one01",
    emoji: "🤝",
    title: "Enterprise Lead — Meytar",
    time: "10:05",
    unread: 3,
    summary: "Meytar asked for a pilot proposal. Follow up by Thursday.",
    type: "business",
    nextAction: "Send the pilot proposal before Thursday's follow-up.",
    metrics: [
      { label: "Stage", value: "Proposal" },
      { label: "Deal size", value: "~₪120k" },
      { label: "Next touch", value: "Thursday" },
      { label: "Champion", value: "Noa" },
    ],
    quickActions: ["Send proposal", "Log a call", "Share deck"],
    insights: ["Their ONE flagged a 3-week procurement window — keep pace."],
    relation: "Meytar Ltd.",
    progress: { done: 3, total: 6 },
    people: ["Noa (Meytar)", "Sales — Tom"],
    steps: [
      { label: "Discovery call", done: true },
      { label: "Send deck", done: true },
      { label: "Scope pilot", done: true },
      { label: "Send pilot proposal", done: false },
      { label: "Follow up Thursday", done: false },
    ],
    decisions: ["Offer a 4-week paid pilot"],
    timeline: [
      { at: "Today", text: "Noa requested a pilot proposal." },
      { at: "Mon", text: "Sent the intro deck." },
    ],
  },
  {
    id: "biz_req_yael",
    identityId: "one01",
    emoji: "📅",
    title: "Booking request — Yael R.",
    time: "09:12",
    unread: 2,
    summary: "Yael's ONE requested a haircut for Wed 16:30. Awaiting your confirm.",
    type: "appointment",
    nextAction: "Confirm Wed 16:30 or propose another time.",
    metrics: [
      { label: "Service", value: "Haircut" },
      { label: "Requested", value: "Wed 16:30" },
      { label: "Client", value: "Yael R." },
      { label: "Status", value: "Pending" },
    ],
    quickActions: ["Confirm booking", "Propose another time", "Message client"],
    insights: ["Yael is a returning client — 4 visits this year. Worth a warm hello."],
    relation: "Yael R.",
    progress: { done: 1, total: 3 },
    people: ["Yael R."],
    steps: [
      { label: "Request received", done: true },
      { label: "Confirm the time", done: false },
      { label: "Send calendar hold", done: false },
    ],
    decisions: [],
    timeline: [{ at: "09:12", text: "Yael's ONE requested Wed 16:30." }],
  },
  {
    id: "biz_invoice_303",
    identityId: "one01",
    emoji: "🧾",
    title: "Invoice #303 — Studio Nova",
    time: "Yesterday",
    unread: 1,
    summary: "₪4,200 invoice sent. Due in 6 days; their ONE marked it 'in approval'.",
    type: "finance",
    nextAction: "Nudge Studio Nova's ONE two days before the due date.",
    metrics: [
      { label: "Amount", value: "₪4,200" },
      { label: "Due", value: "In 6 days" },
      { label: "Status", value: "In approval" },
      { label: "Client", value: "Studio Nova" },
    ],
    quickActions: ["Send reminder", "Mark as paid", "View invoice"],
    insights: ["Studio Nova pays ~3 days early on average — likely on track."],
    relation: "Studio Nova",
    progress: { done: 2, total: 3 },
    people: ["Studio Nova — Amit"],
    steps: [
      { label: "Invoice sent", done: true },
      { label: "Approved by client", done: true },
      { label: "Payment received", done: false },
    ],
    decisions: [],
    timeline: [{ at: "Yesterday", text: "Invoice #303 sent to Studio Nova." }],
  },
];

export const BROADCAST_LINES = [
  "Good evening, Ariel. 2 things are waiting.",
  "Your workout is in 40 minutes.",
  "Sarah Salon confirmed Tuesday at 18:00.",
  "2 forms need signing for your license.",
  "Meytar is waiting on the pilot proposal.",
];

// The pulse reads differently depending on who you are right now — your
// personal ONE surfaces your life admin; your business ONE surfaces the work
// waiting on you. Switching identity switches the whole voice.
export const BROADCAST_BY_IDENTITY: Record<string, string[]> = {
  ariel: BROADCAST_LINES,
  one01: [
    "2 things need you at ONE01.",
    "Yael's ONE requested Wed 16:30 — confirm or propose a time.",
    "Invoice #303 is in approval with Studio Nova.",
    "Meytar is waiting on the pilot proposal.",
  ],
};

export const PLAN_META: Record<PlanTier, { word: string; className: string }> = {
  free: { word: "FREE", className: "free" },
  pro: { word: "PRO", className: "pro" },
  max: { word: "MAX", className: "max" },
};
