"use client";

/**
 * AtlasHome — the experimental "Atlas" home mode: a 2.5D, pannable/zoomable map
 * of human intention (Global made spatial). Wants float as words on a tilted,
 * infinite line-grid, clustered into topic "districts" with an emoji marker;
 * opening a want grows its route (the path others took) into the space, and the
 * Start button hands the intent to ONE (fork-and-run). Self-contained: all of
 * its classes are `atl-` prefixed and it themes off the app's own CSS tokens,
 * so it never collides with the rest of the app.
 *
 * Rendered as a full-screen overlay when Settings → Home is set to "Atlas"
 * (mirrors the "live" home). Tapping the ONE face opens the profile (the way
 * back to Settings), matching the live home's escape.
 */

import { useEffect, useRef } from "react";

type Lang = "en" | "he";
type Step = { en: string; he: string };
type Intent = {
  d: number; en: string; he: string; count: number; trend: number;
  done: number; avg: number; steps: Step[];
};
type District = { en: string; he: string; c: string; em: string; ox: number; oy: number; x?: number; y?: number };

const s = (en: string, he: string): Step => ({ en, he });

const D: District[] = [
  { en: "Learning", he: "למידה", c: "#7f9a6f", em: "📚", ox: -980, oy: 420 },
  { en: "Health", he: "בריאות", c: "#5f9e8c", em: "🩺", ox: -1000, oy: -420 },
  { en: "Money", he: "כסף", c: "#a08f5f", em: "💰", ox: 900, oy: -60 },
  { en: "Travel", he: "טיולים", c: "#5f95a5", em: "✈️", ox: -140, oy: 520 },
  { en: "Admin", he: "בירוקרטיה", c: "#a0846a", em: "📋", ox: 980, oy: 520 },
  { en: "Home", he: "בית", c: "#8b87a8", em: "🏠", ox: -80, oy: -460 },
  { en: "Work", he: "עבודה", c: "#5f84a8", em: "💼", ox: 1140, oy: -480 },
  { en: "Relationships", he: "זוגיות", c: "#a67f8d", em: "❤️", ox: -620, oy: 60 },
  { en: "Everyday", he: "יומיום", c: "#8a94a0", em: "🛒", ox: 460, oy: 600 },
  { en: "Wellbeing", he: "רווחה", c: "#8f9b74", em: "🧘", ox: -1140, oy: -20 },
];

const N: Intent[] = [
  { d: 0, en: "Learn a language", he: "ללמוד שפה", count: 903, trend: 6, done: 214, avg: 30, steps: [s("Tell ONE the language & goal", "לספר ל‑ONE איזו שפה והמטרה"), s("It builds a daily plan", "הוא בונה תוכנית יומית"), s("Books a tutor & tracks streaks", "קובע מורה ועוקב אחרי הרצף")] },
  { d: 0, en: "Psychometric prep", he: "הכנה לפסיכומטרי", count: 641, trend: 4, done: 132, avg: 84, steps: [s("Set target score & date", "להגדיר ציון יעד ותאריך"), s("ONE builds a study plan", "ONE בונה לוח למידה"), s("Weekly mock tests", "מבחני דמה שבועיים")] },
  { d: 0, en: "Driving license", he: "רישיון נהיגה", count: 558, trend: 3, done: 97, avg: 60, steps: [s("Book the theory test", "לקבוע מבחן תיאוריה"), s("Find an instructor", "למצוא מורה נהיגה"), s("Track lessons to the test", "לעקוב עד הטסט")] },
  { d: 0, en: "Read more", he: "לקרוא יותר", count: 388, trend: 5, done: 150, avg: 14, steps: [s("Say what you're into", "להגיד מה מעניין"), s("ONE curates a shelf", "ONE בונה מדף"), s("Nudges a few pages a day", "דוחף כמה עמודים ביום")] },
  { d: 1, en: "Find a therapist", he: "למצוא מטפל", count: 1244, trend: 9, done: 288, avg: 5, steps: [s("Describe what's hard", "לתאר מה קשה"), s("ONE shortlists 3 in-plan", "ONE מסנן 3 בביטוח שלך"), s("Checks price & books", "בודק מחיר וקובע")] },
  { d: 1, en: "Book a dentist", he: "תור לרופא שיניים", count: 864, trend: 2, done: 203, avg: 3, steps: [s("Say what's due", "להגיד מה בתור"), s("Find an open slot", "למצוא תור פנוי"), s("Book & add to calendar", "לקבוע ולהוסיף ליומן")] },
  { d: 1, en: "Understand a diagnosis", he: "להבין אבחון", count: 512, trend: 7, done: 141, avg: 1, steps: [s("Share the result", "לשתף את התוצאה"), s("ONE explains it plainly", "ONE מסביר בפשטות"), s("Lists what to ask", "מרכז מה לשאול")] },
  { d: 1, en: "Book a checkup", he: "לקבוע צ׳קאפ", count: 430, trend: 4, done: 171, avg: 6, steps: [s("ONE checks what's overdue", "ONE בודק מה מתעכב"), s("Finds a clinic & slot", "מוצא מרפאה ותור"), s("Books the panel", "קובע את הבדיקות")] },
  { d: 2, en: "Refinance the mortgage", he: "למחזר משכנתא", count: 691, trend: 5, done: 88, avg: 21, steps: [s("Pull current terms", "למשוך תנאים נוכחיים"), s("Compare bank offers", "להשוות הצעות בנקים"), s("Prep the switch", "להכין את המעבר")] },
  { d: 2, en: "Compare insurance", he: "להשוות ביטוח", count: 723, trend: 4, done: 176, avg: 4, steps: [s("Point at your policy", "להפנות לפוליסה"), s("Find the same for less", "למצוא זהה בפחות"), s("Switch end to end", "לעבור מקצה לקצה")] },
  { d: 2, en: "Register a business", he: "לפתוח עוסק", count: 543, trend: 8, done: 119, avg: 7, steps: [s("Answer a few questions", "לענות על כמה שאלות"), s("ONE files it", "ONE מגיש"), s("Sets up invoicing", "מקים חשבוניות")] },
  { d: 2, en: "Build a budget", he: "לבנות תקציב", count: 512, trend: 6, done: 230, avg: 2, steps: [s("Connect your accounts", "לחבר חשבונות"), s("ONE finds the leaks", "ONE מאתר דליפות"), s("Sets limits & alerts", "קובע תקרות והתראות")] },
  { d: 3, en: "Plan a trip", he: "לתכנן טיול", count: 1187, trend: 11, done: 261, avg: 14, steps: [s("Where, when & the vibe", "לאן, מתי והאווירה"), s("ONE drafts route & stays", "ONE בונה מסלול ולינה"), s("One live itinerary", "יומן מסע חי אחד")] },
  { d: 3, en: "Find a flight", he: "למצוא טיסה", count: 981, trend: 3, done: 240, avg: 1, steps: [s("Dates & budget", "תאריכים ותקציב"), s("ONE watches fares", "ONE עוקב אחרי מחירים"), s("Books at the right time", "מזמין בזמן הנכון")] },
  { d: 3, en: "Sort a visa", he: "להסדיר ויזה", count: 352, trend: 6, done: 61, avg: 18, steps: [s("Country & purpose", "מדינה ומטרה"), s("Lists what's needed", "מפרט מה צריך"), s("Fills forms & books", "ממלא וקובע")] },
  { d: 4, en: "Renew a passport", he: "לחדש דרכון", count: 774, trend: 2, done: 198, avg: 12, steps: [s("Check expiry & rules", "לבדוק תוקף ודרישות"), s("Book nearest slot", "לקבוע תור קרוב"), s("Prep photos & forms", "להכין תמונות וטפסים")] },
  { d: 4, en: "Appeal a fine", he: "לערער על קנס", count: 331, trend: 5, done: 74, avg: 9, steps: [s("Share the ticket", "לשתף את הדוח"), s("Check grounds", "לבדוק עילות"), s("Write & submit", "לכתוב ולהגיש")] },
  { d: 4, en: "Small claim", he: "תביעה קטנה", count: 214, trend: 3, done: 39, avg: 30, steps: [s("Describe what went wrong", "לתאר מה השתבש"), s("Assemble evidence", "לרכז ראיות"), s("Draft & file", "לנסח ולהגיש")] },
  { d: 5, en: "Move apartment", he: "מעבר דירה", count: 1523, trend: 12, done: 342, avg: 21, steps: [s("Lease end & budget", "סוף חוזה ותקציב"), s("Listings & 3 viewings", "דירות ו‑3 צפיות"), s("Movers & address change", "מובילים ושינוי כתובת")] },
  { d: 5, en: "Renovate", he: "שיפוץ", count: 612, trend: 4, done: 71, avg: 45, steps: [s("Describe the dream", "לתאר את החלום"), s("3 contractor quotes", "3 הצעות קבלנים"), s("Track the work", "לעקוב אחרי העבודה")] },
  { d: 5, en: "Find a handyman", he: "למצוא הנדימן", count: 487, trend: 2, done: 158, avg: 2, steps: [s("Photo of what's broken", "לצלם את התקלה"), s("Match a rated pro", "להתאים בעל מקצוע"), s("Book & confirm price", "לקבוע ולאשר מחיר")] },
  { d: 6, en: "Find a job", he: "חיפוש עבודה", count: 1312, trend: 8, done: 176, avg: 35, steps: [s("The role you want", "התפקיד הרצוי"), s("Match & tailor CV", "להתאים ולכוון קו\"ח"), s("Apply & prep interviews", "להגיש ולהתכונן")] },
  { d: 6, en: "Refresh my CV", he: "לרענן קורות חיים", count: 703, trend: 5, done: 221, avg: 1, steps: [s("Point at your old CV", "להפנות לקו\"ח ישנים"), s("Rewrite for the role", "לכתוב מחדש לתפקיד"), s("Export a clean version", "לייצא גרסה נקייה")] },
  { d: 6, en: "Switch careers", he: "להסב מקצוע", count: 414, trend: 9, done: 47, avg: 120, steps: [s("Where you want to go", "לאן רוצים להגיע"), s("Map the gap & a course", "למפות פער וקורס"), s("A step-by-step plan", "תוכנית צעד־צעד")] },
  { d: 7, en: "Plan a wedding", he: "לתכנן חתונה", count: 821, trend: 7, done: 64, avg: 90, steps: [s("Date, size & budget", "תאריך, גודל ותקציב"), s("Checklist & vendors", "צ'קליסט וספקים"), s("Track bookings", "לעקוב אחרי הזמנות")] },
  { d: 7, en: "Anniversary gift", he: "מתנה ליום נישואים", count: 462, trend: 4, done: 187, avg: 1, steps: [s("Tell ONE about them", "לספר עליהם"), s("3 thoughtful ideas", "3 רעיונות"), s("Order & time delivery", "להזמין ולתזמן")] },
  { d: 7, en: "Plan a birthday", he: "לתכנן יום הולדת", count: 520, trend: 6, done: 210, avg: 7, steps: [s("Who & the vibe", "למי והאווירה"), s("Venue, cake & invites", "מקום, עוגה והזמנות"), s("Runs the RSVPs", "מנהל אישורי הגעה")] },
  { d: 8, en: "Weekly groceries", he: "קניות שבועיות", count: 960, trend: 3, done: 540, avg: 1, steps: [s("ONE learns your basket", "ONE לומד את הסל"), s("Builds the list", "בונה את הרשימה"), s("Orders the cheapest", "מזמין בזול ביותר")] },
  { d: 8, en: "Cancel a subscription", he: "לבטל מנוי", count: 388, trend: 7, done: 250, avg: 1, steps: [s("Spot what you don't use", "לאתר מה לא בשימוש"), s("ONE cancels for you", "ONE מבטל בשבילך"), s("Confirms it's gone", "מוודא שבוטל")] },
  { d: 8, en: "Return a package", he: "להחזיר חבילה", count: 333, trend: 2, done: 198, avg: 2, steps: [s("Snap the item & order", "לצלם פריט והזמנה"), s("ONE opens the return", "ONE פותח החזרה"), s("Books the pickup", "קובע איסוף")] },
  { d: 9, en: "Start a gym routine", he: "להתחיל כושר", count: 742, trend: 8, done: 190, avg: 2, steps: [s("Your goal & schedule", "מטרה ולו\"ז"), s("ONE builds a plan", "ONE בונה תוכנית"), s("Books & tracks it", "קובע ועוקב")] },
  { d: 9, en: "Fix my sleep", he: "לתקן שינה", count: 611, trend: 9, done: 160, avg: 21, steps: [s("Log a few nights", "לתעד כמה לילות"), s("ONE finds the pattern", "ONE מוצא את הדפוס"), s("A wind-down plan", "תוכנית הרגעה")] },
  { d: 9, en: "Quit a habit", he: "להיגמל מהרגל", count: 433, trend: 7, done: 96, avg: 30, steps: [s("Name the habit", "לנקוב בהרגל"), s("ONE sets the ladder", "ONE בונה סולם"), s("Daily check-ins", "צ'ק־אין יומי")] },
];

// Cross-topic links — a faint "this connects to that" web across districts, so
// the field reads as one graph, not isolated islands.
const XLINKS: [string, string][] = [
  ["Move apartment", "Compare insurance"], ["Move apartment", "Find a handyman"], ["Move apartment", "Weekly groceries"],
  ["Find a job", "Refresh my CV"], ["Refresh my CV", "Switch careers"], ["Find a job", "Build a budget"],
  ["Find a therapist", "Fix my sleep"], ["Fix my sleep", "Quit a habit"], ["Find a therapist", "Start a gym routine"],
  ["Plan a wedding", "Anniversary gift"], ["Plan a wedding", "Plan a birthday"],
  ["Plan a trip", "Find a flight"], ["Find a flight", "Sort a visa"],
  ["Register a business", "Build a budget"], ["Refinance the mortgage", "Compare insurance"],
];

// The current user's own live intentions (simulated here) — surfaced in "Mine".
const MINE = new Set(["Move apartment", "Find a job", "Plan a trip", "Fix my sleep"]);

// Time-of-day rhythm: each district peaks at a different hour, so the field
// breathes as you scrub the clock (work by day, groceries at dusk, gym at dawn).
const PEAK = [20, 11, 13, 21, 11, 19, 10, 20, 18, 7]; // by district index
function timeWeight(hour: number, di: number) {
  const p = PEAK[di] ?? 13;
  let d = Math.abs(hour - p); d = Math.min(d, 24 - d);
  return 0.5 + 0.8 * Math.exp(-(d * d) / (2 * 4.5 * 4.5));
}
function hourIcon(h: number) { return h < 6 ? "🌙" : h < 12 ? "🌅" : h < 18 ? "☀️" : h < 21 ? "🌆" : "🌙"; }
// Steps ONE drafts for a brand-new, unmapped intention typed by the user.
const GEN_STEPS: Step[] = [
  s("ONE breaks it into clear steps", "ONE מפרק את זה לצעדים ברורים"),
  s("Finds who or what can help", "מוצא מי או מה יכול לעזור"),
  s("Starts the first move for you", "מתחיל בשבילך את הצעד הראשון"),
];

// Other ONEs on the map — businesses & professionals (like the cars/POIs in
// Waze). Scattered ambiently in World view; in a journey the ones for the
// want's topic become the "who can help" providers wired to the goal.
type Agent = { di: number; en: string; he: string; em: string };
const AGENTS: Agent[] = [
  { di: 1, en: "Clinic ONE", he: "וואן מרפאה", em: "🏥" },
  { di: 1, en: "Therapist ONE", he: "וואן מטפל", em: "🧠" },
  { di: 5, en: "Movers ONE", he: "וואן הובלות", em: "📦" },
  { di: 5, en: "Handyman ONE", he: "וואן הנדימן", em: "🔧" },
  { di: 2, en: "Bank ONE", he: "וואן בנק", em: "🏦" },
  { di: 6, en: "Recruiter ONE", he: "וואן גיוס", em: "🧑‍💼" },
  { di: 3, en: "Travel ONE", he: "וואן טיולים", em: "🧳" },
  { di: 7, en: "Venue ONE", he: "וואן אולם", em: "🎉" },
  { di: 9, en: "Coach ONE", he: "וואן מאמן", em: "🏋️" },
  { di: 8, en: "Store ONE", he: "וואן חנות", em: "🛒" },
  { di: 0, en: "Tutor ONE", he: "וואן מורה", em: "📖" },
  { di: 4, en: "Agent ONE", he: "וואן סוכן", em: "🗂️" },
];
// The ONE face, reused for the driving navigator and the agent markers.
const FACE = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="var(--a-orb)"/><circle cx="36" cy="46" r="9" fill="var(--a-orbeye)"/><circle cx="64" cy="46" r="9" fill="var(--a-orbeye)"/></svg>';

// What a specific want actually involves — the sub-needs & providers that
// appear around it (wedding → photographer, dress, venue…). Wants without an
// entry fall back to their topic's ambient ONEs.
type Need = { em: string; en: string; he: string };
const NEEDS: Record<string, Need[]> = {
  "Plan a wedding": [{ em: "📸", en: "Photographer", he: "צלם" }, { em: "👰", en: "Dress", he: "שמלת כלה" }, { em: "🏛️", en: "Venue", he: "אולם" }, { em: "🍽️", en: "Catering", he: "קייטרינג" }, { em: "🎵", en: "Band", he: "הרכב" }],
  "Move apartment": [{ em: "📦", en: "Movers", he: "מובילים" }, { em: "🧹", en: "Cleaning", he: "ניקיון" }, { em: "🔧", en: "Handyman", he: "הנדימן" }, { em: "🏦", en: "Address change", he: "שינוי כתובת" }],
  "Plan a trip": [{ em: "✈️", en: "Flights", he: "טיסות" }, { em: "🏨", en: "Stays", he: "לינה" }, { em: "🚗", en: "Car", he: "רכב" }, { em: "🗺️", en: "Route", he: "מסלול" }],
  "Find a job": [{ em: "📄", en: "CV", he: "קו״ח" }, { em: "🔎", en: "Openings", he: "משרות" }, { em: "🎤", en: "Interviews", he: "ראיונות" }, { em: "💬", en: "Negotiation", he: "מו״מ" }],
  "Find a therapist": [{ em: "🧠", en: "Therapist", he: "מטפל" }, { em: "📋", en: "Intake", he: "אינטייק" }, { em: "🗓️", en: "Sessions", he: "פגישות" }],
  "Renovate": [{ em: "👷", en: "Contractor", he: "קבלן" }, { em: "🎨", en: "Design", he: "עיצוב" }, { em: "🚪", en: "Materials", he: "חומרים" }, { em: "🧾", en: "Permits", he: "היתרים" }],
  "Plan a birthday": [{ em: "🎂", en: "Cake", he: "עוגה" }, { em: "📍", en: "Venue", he: "מקום" }, { em: "✉️", en: "Invites", he: "הזמנות" }, { em: "🎈", en: "Decor", he: "קישוטים" }],
  "Refinance the mortgage": [{ em: "🏦", en: "Banks", he: "בנקים" }, { em: "📊", en: "Rates", he: "ריביות" }, { em: "🧾", en: "Paperwork", he: "מסמכים" }],
};

const TXT = {
  en: { live: "now", priv: "Anonymous · aggregated", ph: "What do you need?", clr: "Clear",
    hint: "Drag to explore · scroll to zoom · click a want to grow its path",
    nowLbl: "ONEs on this now", pathH: "The path others took", doneK: "finished this week", avgK: "avg. time",
    days: "days", cta: "Start this with your ONE", matches: (n: number) => n + (n === 1 ? " match" : " matches"),
    nomatch: "Nothing here — try another word.", priv2: "Every figure is an anonymous aggregate — never a person.",
    world: "World", mine: "Mine", inProgress: (n: number) => n + " in progress",
    provH: "Who can help", journeying: "ONE is on the way", arrived: "Arrived",
    stepsH: "The path others took", stepsHgo: "Your steps with ONE", cont: "Continue", stepPh: "reply, or just continue…", allDone: "Done — it's in motion", openIn: "Open in ONE", startJ: "Start this with your ONE",
    rating: "rating", jobs: "jobs / mo", reply: "avg reply", connect: "Connect with this ONE", idxLive: "active here now", idxIntents: "intentions", idxProviders: "service ONEs", idxVolume: "circulated", idxDemand: "weekly demand", idxChart: "Activity · 24h", pvChart: "Jobs · 12 wk", idxTop: "Busiest right now", idxEnter: "Explore this world", needsH: "What this involves", signinPre: "No account needed to start", signinLink: "Connect", prompts: ["What do you need?", "What can ONE do for you?", "Just say it — ONE takes it from here"], tipHint: "Click to open →", mapThis: "Map", myOne: "Your ONE", myOneSub: "Your representative across the map", manage: "Open full profile", relatedH: "Often paired with", inMotion: "in motion", completed: "completed", worlds: "worlds", meWorlds: "Your worlds", meResume: "Resume", profileTab: "Profile", chatTab: "Chat", chatHi: "Hey — I'm your ONE. What should we get moving?", chatPh: "Message your ONE…", chatAck: "On it — mapping that now.", mineEmpty: "Your space — the processes you start live here." },
  he: { live: "עכשיו", priv: "אנונימי · מצטבר", ph: "מה אתה צריך?", clr: "נקה",
    hint: "גררו כדי לנוע · גלגלו כדי לזום · לחצו על רצון כדי לפרוש את המסלול",
    nowLbl: "וואנים על זה עכשיו", pathH: "המסלול שאחרים עברו", doneK: "הושלמו השבוע", avgK: "זמן ממוצע",
    days: "ימים", cta: "התחל את זה עם ה‑ONE שלך", matches: (n: number) => n + " תוצאות",
    nomatch: "אין תוצאה — נסו מילה אחרת.", priv2: "כל מספר הוא מצבר אנונימי — לעולם לא אדם.",
    world: "עולם", mine: "שלי", inProgress: (n: number) => n + " בתהליך",
    provH: "מי יכול לעזור", journeying: "ה‑ONE בדרך", arrived: "הגעת",
    stepsH: "המסלול שאחרים עברו", stepsHgo: "הצעדים שלך עם ONE", cont: "המשך", stepPh: "תשובה, או פשוט המשך…", allDone: "בוצע — זה בתנועה", openIn: "פתח ב‑ONE", startJ: "התחל את זה עם ה‑ONE שלך",
    rating: "דירוג", jobs: "עבודות / חודש", reply: "מענה ממוצע", connect: "התחבר ל‑ONE הזה", idxLive: "פעילים כאן עכשיו", idxIntents: "כוונות", idxProviders: "נותני שירות", idxVolume: "התגלגל", idxDemand: "ביקוש שבועי", idxChart: "פעילות · 24ש׳", pvChart: "עבודות · 12ש׳", idxTop: "העמוסים עכשיו", idxEnter: "היכנס לעולם הזה", needsH: "מה צריך בשביל זה", signinPre: "לא צריך חשבון כדי להתחיל", signinLink: "התחברות", prompts: ["מה אתה צריך?", "מה ONE יכול לעשות בשבילך?", "רק תגיד — ONE ממשיך מכאן"], tipHint: "לחצו לפתיחה →", mapThis: "מפו את", myOne: "ה‑ONE שלך", myOneSub: "הנציג שלך על המפה", manage: "פתח פרופיל מלא", relatedH: "לרוב יחד עם", inMotion: "בתהליך", completed: "הושלמו", worlds: "עולמות", meWorlds: "העולמות שלך", meResume: "המשך", profileTab: "פרופיל", chatTab: "צ'אט", chatHi: "היי — אני ה‑ONE שלך. מה נזיז?", chatPh: "כתבו ל‑ONE…", chatAck: "על זה — ממפה את זה עכשיו.", mineEmpty: "המרחב שלך — התהליכים שתתחיל יופיעו כאן." },
};

export function AtlasHome({
  lang,
  onStart,
  onOrbTap,
}: {
  lang: Lang;
  /** Hand the chosen intention to ONE (fork-and-run). */
  onStart?: (text: string) => void;
  /** Tapping the ONE face — the way back to the profile / Settings. */
  onOrbTap?: () => void;
}) {
  const appRef = useRef<HTMLDivElement>(null);
  const onStartRef = useRef(onStart); onStartRef.current = onStart;
  const onOrbTapRef = useRef(onOrbTap); onOrbTapRef.current = onOrbTap;

  useEffect(() => {
    const root = appRef.current;
    if (!root || typeof window === "undefined") return;
    const R: HTMLDivElement = root; // non-null alias for use inside hoisted fns
    const $ = (sel: string) => R.querySelector(sel) as HTMLElement | null;
    const ground = $(".atl-ground")!;
    const qEl = $(".atl-search input") as HTMLInputElement;
    const coreEl = $(".atl-core");
    const clrEl = $(".atl-clr")!;
    const panel = $(".atl-panel")!;
    const customEl = $(".atl-custom")!;
    const sugEl = $(".atl-suggest")!;
    const matchEl = $(".atl-match")!;
    const baseLinks = R.querySelector(".atl-baselinks") as SVGGElement;
    const routePath = R.querySelector(".atl-route") as SVGPathElement;
    const SVGNS = "http://www.w3.org/2000/svg";

    const PW = 7000, PH = 5000, CX = PW / 2, CY = PH / 2;
    D.forEach((d) => { d.x = CX + d.ox * 1.32; d.y = CY + d.oy * 1.32; });
    let COST = Math.cos((56 * Math.PI) / 180); // updated live as the tilt eases with zoom
    const tiltFor = (z: number) => 16 + 40 * Math.max(0, Math.min(1, (z - 0.5) / 0.9));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); // no auto-pan on touch
    const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const sizeFor = (c: number) => 15 + clamp((c - 200) / 1350, 0, 1) * 21;

    let vw = R.clientWidth, vh = R.clientHeight;
    const cam = { px: 0, py: -40, z: vw < 720 ? 0.6 : 0.8, rot: 0 };
    let rotTarget = 0, lastZ = -1, dirty = true;
    let mpx = R.clientWidth / 2, mpy = R.clientHeight / 2; // live pointer position
    let parX = 0, parY = 0; // eased map parallax toward the pointer direction
    let mouseInside = true, overChrome = false; // auto-pan stops when either fails
    let glideTo: { x: number; y: number } | null = null; // soft drift target (a hovered topic)
    let hour = new Date().getHours();
    const displayCount = (n: Intent) => Math.max(1, Math.round(n.count * timeWeight(hour, n.d)));
    const tipEl = $(".atl-tip")!;
    let focusText: string | null = null;
    let meMode = false; // the companion has risen into the profile card as its avatar
    let focusPrompts: string[] = [], focusPromptI = 0; // rotating contextual placeholders while a card is open
    const setLive = (s: string) => { const l = $(".atl-status-live"); if (l) l.textContent = s; };
    const showTip = (n: Intent, e: MouseEvent) => {
      const t = TXT[lang], live = Math.round(displayCount(n) * 0.12).toLocaleString();
      const nd = (NEEDS[n.en] || AGENTS.filter((a) => a.di === n.d).map((a) => ({ em: a.em, en: a.en, he: a.he }))).slice(0, 4);
      tipEl.innerHTML =
        '<div class="atl-tip-top"><span class="atl-tip-em">' + D[n.d].em + '</span>' + D[n.d][lang] + '</div>' +
        '<div class="atl-tip-title">' + n[lang] + '</div>' +
        '<div class="atl-tip-now"><b>' + live + '</b> ' + t.live + ' <span class="atl-tip-trend">↑ ' + n.trend + '%</span></div>' +
        '<div class="atl-tip-stats"><span><b>' + n.done.toLocaleString() + '</b> ' + t.doneK + '</span><span><b>' + n.avg + ' ' + t.days + '</b> ' + t.avgK + '</span></div>' +
        (nd.length ? '<div class="atl-tip-needs">' + nd.map((x) => '<span class="atl-tip-need">' + x.em + ' ' + x[lang] + '</span>').join("") + '</div>' : "") +
        '<div class="atl-tip-hint">' + t.tipHint + '</div>';
      const w = 250, ex = Math.min(Math.max(e.clientX, w / 2 + 8), vw - w / 2 - 8);
      tipEl.style.left = ex + "px"; tipEl.classList.add("show");
      const h = tipEl.offsetHeight || 260; // flip below the cursor if there's no room above
      if (e.clientY - h - 24 > 8) { tipEl.style.top = (e.clientY - 14) + "px"; tipEl.classList.remove("below"); }
      else { tipEl.style.top = (e.clientY + 22) + "px"; tipEl.classList.add("below"); }
      focusText = D[n.d].em + " " + n[lang] + " · " + live + " " + t.live; setLive(focusText);
      qEl.setAttribute("placeholder", n[lang]); // the input invites acting on what you're near
    };
    const hideTip = () => { tipEl.classList.remove("show", "below"); focusText = null; qEl.setAttribute("placeholder", TXT[lang].prompts[rotI % TXT[lang].prompts.length]); };
    // hover a ONE on the map → a compact preview of that service ONE
    const showAgentTip = (agent: Agent, e: MouseEvent) => {
      const t = TXT[lang], r = rng(agent.en.length * 131 + agent.di);
      const rating = (4.2 + r() * 0.7).toFixed(1), jobs = 40 + Math.floor(r() * 200), reply = 5 + Math.floor(r() * 40) + "m";
      tipEl.innerHTML =
        '<div class="atl-tip-top"><span class="atl-tip-em">' + agent.em + '</span>' + D[agent.di][lang] + '</div>' +
        '<div class="atl-tip-title">' + agent[lang] + '</div>' +
        '<div class="atl-tip-now"><span class="atl-tip-star">★ ' + rating + '</span> <span class="atl-tip-onelbl">ONE</span></div>' +
        '<div class="atl-tip-stats"><span><b>' + jobs + '</b> ' + t.jobs + '</span><span><b>' + reply + '</b> ' + t.reply + '</span></div>' +
        '<div class="atl-tip-hint">' + t.connect + ' →</div>';
      const w = 250, ex = Math.min(Math.max(e.clientX, w / 2 + 8), vw - w / 2 - 8);
      tipEl.style.left = ex + "px"; tipEl.classList.add("show");
      const h = tipEl.offsetHeight || 210;
      if (e.clientY - h - 24 > 8) { tipEl.style.top = (e.clientY - 14) + "px"; tipEl.classList.remove("below"); }
      else { tipEl.style.top = (e.clientY + 22) + "px"; tipEl.classList.add("below"); }
    };
    let tween: { px0: number; py0: number; z0: number; px1: number; py1: number; z1: number; t: number } | null = null;
    let selected: number | null = null, activeD: number | null = null;
    let view: "world" | "mine" = "world";
    let journey = false, curStep = 0;
    let drivePos: number[] = [0, 0]; let driveTarget: number[] | null = null;
    let driveEl: HTMLDivElement | null = null, driveArrow: HTMLDivElement | null = null;
    let cur: { id: number; n: Intent; dist: District; needs: Need[]; goal: number[] } | null = null;
    const agentEls: { el: HTMLElement; di: number }[] = [];
    const blobEls: { el: HTMLElement; di: number }[] = [];
    const providerEls: HTMLElement[] = [];
    const plinkEls: SVGLineElement[] = [];
    let raf = 0;
    const cleanups: (() => void)[] = [];

    type WE = { el: HTMLButtonElement; n: Intent; di: number; wx: number; wy: number };
    const wordEls: WE[] = [];
    const anchorEls: HTMLButtonElement[] = [];

    // blobs
    D.forEach((dist, di) => {
      const b = document.createElement("div"); b.className = "atl-blob";
      b.style.background = "radial-gradient(circle, " + dist.c + " 0%, transparent 66%)"; ground.appendChild(b);
      blobEls.push({ el: b, di });
    });
    // anchors + words + base links
    D.forEach((dist, di) => {
      const a = document.createElement("button"); a.className = "atl-anchor";
      a.style.left = dist.x + "px"; a.style.top = dist.y + "px"; a.style.setProperty("--dc", dist.c);
      a.innerHTML = '<div class="atl-asum"></div><span class="atl-emoji" aria-hidden="true">' + dist.em + '</span><span class="atl-alabel"></span><span class="atl-astat"></span>';
      a.addEventListener("click", (e) => { e.stopPropagation(); openIndex(di); });
      // (index opens on click; hover shows the .atl-asum summary tab)
      ground.appendChild(a); anchorEls.push(a);
      const r = rng(di * 131 + 7);
      const mine: { n: Intent; idx: number }[] = [];
      N.forEach((n, idx) => { if (n.d === di) mine.push({ n, idx }); });
      const base = r() * Math.PI * 2;
      mine.forEach((m, k) => {
        const n = m.n, idx = m.idx;
        const ang = base + k * ((2 * Math.PI) / mine.length) + (r() - 0.5) * 0.32;
        const rad = 200 + (k % 2 ? 110 : 0) + r() * 45;
        const wx = dist.x! + Math.cos(ang) * rad, wy = dist.y! + Math.sin(ang) * rad * 0.82;
        const el = document.createElement("button"); el.className = "atl-word";
        el.style.left = wx + "px"; el.style.top = wy + "px"; el.style.setProperty("--dc", dist.c);
        el.style.setProperty("--fd", (6 + r() * 4).toFixed(2) + "s"); el.style.setProperty("--fdl", (-r() * 6).toFixed(2) + "s");
        const fs = sizeFor(displayCount(n));
        el.innerHTML = '<span class="atl-float"><span class="atl-inner" style="font-size:' + fs.toFixed(1) + 'px;font-weight:' + (n.count >= 1150 ? 800 : n.count >= 650 ? 700 : 600) + '"></span><span class="atl-count"></span></span>';
        el.setAttribute("data-id", String(idx));
        el.addEventListener("click", (e) => { e.stopPropagation(); openNode(idx); });
      el.addEventListener("mouseenter", (e) => showTip(n, e));
      el.addEventListener("mousemove", (e) => { tipEl.style.left = e.clientX + "px"; tipEl.style.top = e.clientY - 16 + "px"; });
      el.addEventListener("mouseleave", hideTip);
        ground.appendChild(el); wordEls.push({ el, n, di, wx, wy });
        const ln = document.createElementNS(SVGNS, "line");
        ln.setAttribute("class", "atl-link"); ln.setAttribute("x1", String(dist.x)); ln.setAttribute("y1", String(dist.y));
        ln.setAttribute("x2", String(wx)); ln.setAttribute("y2", String(wy)); baseLinks.appendChild(ln);
      });
    });
    const findWord = (en: string) => wordEls.find((o) => o.n.en === en);
    const wordOf = (id: number) => wordEls.find((o) => +o.el.getAttribute("data-id")! === id) || null;
    // cross-topic curves
    XLINKS.forEach(([a, b]) => {
      const A = findWord(a), B = findWord(b); if (!A || !B) return;
      const mx = (A.wx + B.wx) / 2, my = (A.wy + B.wy) / 2;
      const dx = B.wx - A.wx, dy = B.wy - A.wy, len = Math.hypot(dx, dy) || 1;
      const cx = mx + (-dy / len) * len * 0.16, cy = my + (dx / len) * len * 0.16;
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("class", "atl-xlink");
      p.setAttribute("d", `M ${A.wx} ${A.wy} Q ${cx} ${cy} ${B.wx} ${B.wy}`);
      baseLinks.appendChild(p);
    });

    function addAgent(agent: Agent, wx: number, wy: number, provider: boolean) {
      const el = document.createElement("div");
      el.className = "atl-agent" + (provider ? " provider" : "");
      el.style.left = wx + "px"; el.style.top = wy + "px";
      el.innerHTML = '<span class="atl-agent-face">' + FACE + '<span class="atl-agent-em">' + agent.em + '</span></span><span class="atl-agent-lbl">' + agent[lang] + '</span>';
      el.addEventListener("click", (e) => { e.stopPropagation(); openProvider(agent); });
      el.addEventListener("mouseenter", (e) => { if (!meMode && !R.classList.contains("atl-compose")) showAgentTip(agent, e as MouseEvent); });
      el.addEventListener("mouseleave", hideTip);
      ground.appendChild(el);
      return el;
    }
    AGENTS.forEach((ag, i) => {
      const dist = D[ag.di]; const r2 = rng(1000 + i * 57);
      const ang = r2() * Math.PI * 2, rad = 320 + r2() * 90;
      agentEls.push({ el: addAgent(ag, dist.x! + Math.cos(ang) * rad, dist.y! + Math.sin(ang) * rad * 0.8, false), di: ag.di });
    });

    function paintText() {
      anchorEls.forEach((a, di) => { (a.querySelector(".atl-alabel") as HTMLElement).textContent = D[di][lang]; });
      wordEls.forEach((o) => {
        (o.el.querySelector(".atl-inner") as HTMLElement).textContent = o.n[lang];
        (o.el.querySelector(".atl-count") as HTMLElement).textContent = Math.round(displayCount(o.n) * 0.12).toLocaleString();
      });
    }
    // Recompute the field to the current hour: word sizes + live counts breathe.
    function refreshCounts() {
      wordEls.forEach((o) => {
        const dc = displayCount(o.n);
        (o.el.querySelector(".atl-inner") as HTMLElement).style.fontSize = sizeFor(dc).toFixed(1) + "px";
        (o.el.querySelector(".atl-count") as HTMLElement).textContent = Math.round(dc * 0.12).toLocaleString();
      });
      if (selected !== null) ($(".atl-now")!).textContent = Math.round(displayCount(N[selected]) * 0.12).toLocaleString();
      updateHeat();
    }
    // Busier topics swell and glow like higher ground — a soft demand terrain.
    // a soft ring where a ONE just acted — the map pulsing with live activity
    function spawnRipple(wx: number, wy: number, color: string) {
      const rp = document.createElement("div"); rp.className = "atl-ripple";
      rp.style.left = wx + "px"; rp.style.top = wy + "px"; rp.style.borderColor = color;
      ground.appendChild(rp); setTimeout(() => rp.remove(), 1500);
    }
    // a want that's surging gets a brief "↑N%" flare that pops above it — the map feels live
    function spawnFlare(wx: number, wy: number, color: string, trend: number) {
      const fl = document.createElement("div"); fl.className = "atl-flare";
      fl.style.left = wx + "px"; fl.style.top = wy + "px"; fl.style.setProperty("--dc", color);
      fl.textContent = "↑ " + trend + "%";
      ground.appendChild(fl); setTimeout(() => fl.remove(), 2200);
    }
    function updateHeat() {
      const totals = D.map((_, di) => N.filter((n) => n.d === di).reduce((a, n) => a + Math.round(displayCount(n) * 0.12), 0));
      let max = 1; totals.forEach((v) => { if (v > max) max = v; });
      blobEls.forEach(({ el, di }) => {
        const t = totals[di] / max, Rr = 340 + t * 380, dist = D[di];
        el.style.width = Rr + "px"; el.style.height = Rr + "px";
        el.style.left = dist.x! - Rr / 2 + "px"; el.style.top = dist.y! - Rr / 2 + "px";
        el.style.opacity = (0.28 + t * 0.42).toFixed(2);
        const a = anchorEls[di];
        if (a) {
          const st = a.querySelector(".atl-astat") as HTMLElement | null; if (st) st.textContent = totals[di].toLocaleString() + " " + TXT[lang].live;
          const su = a.querySelector(".atl-asum") as HTMLElement | null;
          if (su) { const items = N.filter((x) => x.d === di); const tr = Math.round(items.reduce((s, x) => s + x.trend, 0) / (items.length || 1)); su.innerHTML = '<b>' + totals[di].toLocaleString() + '</b> ' + TXT[lang].live + ' · ' + items.length + ' ' + TXT[lang].idxIntents + ' · <span class="atl-asum-up">↑' + tr + '%</span>'; }
        }
      });
    }
    // Top status line: date · weather · time, plus a running feed that reflects
    // whatever you're focused on (else it cycles the busiest wants).
    const IC = (p: string) => '<svg class="atl-si" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
    const IC_CAL = IC('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/>');
    const IC_SUN = IC('<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M18.4 5.6l-1 1M6.6 17.4l-1 1"/>');
    const IC_MOON = IC('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"/>');
    function updateStatus() {
      const day = hour >= 7 && hour < 19, temp = 15 + Math.round(9 * Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)));
      const date = new Date().toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { weekday: "short", month: "short", day: "numeric" });
      const hh = (hour < 10 ? "0" + hour : String(hour)) + ":00";
      const m = $(".atl-status-main"); if (m) m.innerHTML = IC_CAL + "<span class='atl-status-d'>" + date + "</span><b class='atl-status-t'>" + hh + "</b><i class='atl-sdot'></i>" + (day ? IC_SUN : IC_MOON) + "<span>" + temp + "°</span>";
    }
    let rotI = 0;
    function tickStatus() {
      if (focusText) { setLive("·  " + focusText); return; }
      const top = N.slice().sort((a, b) => displayCount(b) - displayCount(a)).slice(0, 12);
      const n = top[rotI++ % top.length];
      setLive("·  " + D[n.d].em + " " + Math.round(displayCount(n) * 0.12).toLocaleString() + " " + TXT[lang].live + " · " + n[lang]);
      // placeholder cycles: contextual sentences while a card is open, generic prompts on the map
      if (R.classList.contains("atl-compose")) { /* typing — keep it clear */ }
      else if (R.classList.contains("atl-focus") && focusPrompts.length) { focusPromptI = (focusPromptI + 1) % focusPrompts.length; qEl.setAttribute("placeholder", focusPrompts[focusPromptI]); }
      else qEl.setAttribute("placeholder", TXT[lang].prompts[rotI % TXT[lang].prompts.length]);
    }

    // ---- expanding route + flowing particles ----
    let stepEls: HTMLElement[] = [];
    let routePts: number[][] = [], routeSeg: number[] = [], routeTotal = 0, flowT = 0, particlesOn = false;
    const flows = Array.from(R.querySelectorAll(".atl-flow")) as unknown as SVGCircleElement[];
    const pointAt = (u: number): number[] => {
      if (routePts.length < 2) return routePts[0] || [0, 0];
      let d = u * routeTotal;
      for (let i = 0; i < routeSeg.length; i++) {
        if (d <= routeSeg[i] || i === routeSeg.length - 1) {
          const f = routeSeg[i] ? d / routeSeg[i] : 0;
          return [routePts[i][0] + (routePts[i + 1][0] - routePts[i][0]) * f, routePts[i][1] + (routePts[i + 1][1] - routePts[i][1]) * f];
        }
        d -= routeSeg[i];
      }
      return routePts[routePts.length - 1];
    };
    function clearRoute() { stepEls.forEach((e) => e.remove()); stepEls = []; routePath.classList.remove("on", "preview"); routePath.removeAttribute("d"); particlesOn = false; flows.forEach((f) => (f.style.opacity = "0")); }
    // a faint line of the path others took, drawn on the map while the card is open
    function previewRoute(id: number) {
      const o = wordOf(id); if (!o) return; const n = o.n, dist = D[n.d];
      let dx = o.wx - dist.x!, dy = o.wy - dist.y!; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const pxp = -dy, pyp = dx; const pts = [[o.wx, o.wy]];
      for (let i = 0; i < n.steps.length; i++) { const d = 150 + i * 150, off = (i % 2 ? 1 : -1) * 70; pts.push([o.wx + dx * d + pxp * off, o.wy + dy * d + pyp * off]); }
      routePts = pts; routeSeg = []; routeTotal = 0;
      for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); routeSeg.push(s); routeTotal += s; }
      routePath.setAttribute("d", "M " + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L "));
      routePath.style.stroke = dist.c; routePath.classList.add("on", "preview");
      flows.forEach((f) => f.setAttribute("fill", dist.c)); flowT = 0; particlesOn = !reduce; // dots stream along the path
      // waypoint pins — a light trace of the steps ahead, like markers on your route
      pts.forEach((p, i) => { if (i === 0) return; const mk = document.createElement("div"); mk.className = "atl-wp"; mk.style.left = p[0] + "px"; mk.style.top = p[1] + "px"; mk.style.setProperty("--dc", dist.c); mk.style.setProperty("--i", String(i)); ground.appendChild(mk); stepEls.push(mk); });
    }
    function clearProviders() { providerEls.forEach((e) => e.remove()); providerEls.length = 0; plinkEls.forEach((e) => e.remove()); plinkEls.length = 0; }
    function growRoute(id: number) {
      clearRoute();
      const o = wordOf(id); if (!o) return; const n = o.n, dist = D[n.d];
      let dx = o.wx - dist.x!, dy = o.wy - dist.y!; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const pxp = -dy, pyp = dx; const pts = [[o.wx, o.wy]];
      for (let i = 0; i < n.steps.length; i++) {
        const d = 150 + i * 150, off = (i % 2 ? 1 : -1) * 70;
        const sx = o.wx + dx * d + pxp * off, sy = o.wy + dy * d + pyp * off;
        pts.push([sx, sy]);
        const st = document.createElement("div"); st.className = "atl-step"; st.style.left = sx + "px"; st.style.top = sy + "px"; st.style.setProperty("--dc", dist.c);
        st.innerHTML = '<span class="atl-stepin"><span class="atl-stepn">' + (i + 1) + '</span><span class="atl-stept"></span></span>';
        (st.querySelector(".atl-stept") as HTMLElement).textContent = n.steps[i][lang];
        ground.appendChild(st); stepEls.push(st);
      }
      routePath.setAttribute("d", "M " + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L "));
      routePath.style.stroke = dist.c; routePath.classList.add("on"); routePath.classList.remove("preview");
      // particle track (arc-length along the polyline) — dots stream to the goal
      routePts = pts; routeSeg = []; routeTotal = 0;
      for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); routeSeg.push(s); routeTotal += s; }
      flows.forEach((f) => f.setAttribute("fill", dist.c));
      flowT = 0; particlesOn = !reduce;
      requestAnimationFrame(() => stepEls.forEach((e, i) => setTimeout(() => e.classList.add("on"), 90 * i)));
    }

    function apply() {
      cam.z = clamp(cam.z, 0.5, 2.8); cam.px = clamp(cam.px, -2100, 2100); cam.py = clamp(cam.py, -1700, 1700);
      const tilt = tiltFor(cam.z); COST = Math.cos((tilt * Math.PI) / 180);
      ground.style.setProperty("--tilt", tilt.toFixed(2) + "deg");
      ground.style.transform = "translate(" + parX.toFixed(1) + "px," + parY.toFixed(1) + "px) translate(-50%,-50%) rotateX(" + tilt.toFixed(2) + "deg) rotateZ(" + cam.rot.toFixed(3) + "deg) scale(" + cam.z.toFixed(4) + ") translate(" + cam.px.toFixed(1) + "px," + cam.py.toFixed(1) + "px)";
      if (Math.abs(cam.z - lastZ) > 0.004) { lastZ = cam.z; updateVis(); R.classList.toggle("atl-zoomed", cam.z > 1.3); }
    }
    const flyTo = (px: number, py: number, z: number) => { tween = { px0: cam.px, py0: cam.py, z0: cam.z, px1: px, py1: py, z1: z, t: 0 }; };

    const onWheel = (e: WheelEvent) => { if (meMode || isChrome(e.target)) return; e.preventDefault(); tween = null; cam.z *= Math.pow(1.0016, -e.deltaY); dirty = true; }; // no zoom while the profile is open, and let card content scroll
    R.addEventListener("wheel", onWheel, { passive: false }); cleanups.push(() => R.removeEventListener("wheel", onWheel));

    const pts: Record<string, { x: number; y: number }> = {};
    let panLast: { x: number; y: number } | null = null;
    let pinchLast: { d: number; mx: number; my: number } | null = null;
    let tapActive = false, tapMoved = 0; // an empty-space tap (not a drag) closes an open card
    const isChrome = (t: EventTarget | null) => t instanceof Element && t.closest(".atl-core,.atl-ticker,.atl-topbar,.atl-toasts,.atl-tset,.atl-botbar,.atl-timepop,.atl-panel,.atl-priv,.atl-word,.atl-anchor,.atl-agent,.atl-cursor");
    const pinch = () => { const ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
    const onDown = (e: PointerEvent) => {
      if (isChrome(e.target)) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; R.setPointerCapture(e.pointerId); tween = null;
      tapActive = true; tapMoved = 0;
      const ids = Object.keys(pts);
      if (ids.length === 1) { panLast = { x: e.clientX, y: e.clientY }; R.classList.add("drag"); }
      else if (ids.length === 2) { panLast = null; pinchLast = pinch(); }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(pts);
      if (ids.length >= 2) { const p = pinch(); if (pinchLast) { cam.z *= p.d / pinchLast.d; cam.px += (p.mx - pinchLast.mx) / cam.z; cam.py += (p.my - pinchLast.my) / (cam.z * COST); dirty = true; } pinchLast = p; }
      else if (panLast) { const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y; tapMoved += Math.abs(dx) + Math.abs(dy); cam.px += dx / cam.z; cam.py += dy / (cam.z * COST); rotTarget = clamp(rotTarget - dx * 0.018, -7, 7); panLast = { x: e.clientX, y: e.clientY }; dirty = true; }
    };
    const onUp = (e: PointerEvent) => {
      delete pts[e.pointerId]; const ids = Object.keys(pts); if (!ids.length) { panLast = null; pinchLast = null; R.classList.remove("drag"); } else if (ids.length === 1) { panLast = { x: pts[ids[0]].x, y: pts[ids[0]].y }; pinchLast = null; }
      if (tapActive) { tapActive = false; if (tapMoved < 6 && panel.classList.contains("open")) closePanel(); } // tap in empty space → close the card
    };
    R.addEventListener("pointerdown", onDown); R.addEventListener("pointermove", onMove); R.addEventListener("pointerup", onUp); R.addEventListener("pointercancel", onUp);
    cleanups.push(() => { R.removeEventListener("pointerdown", onDown); R.removeEventListener("pointermove", onMove); R.removeEventListener("pointerup", onUp); R.removeEventListener("pointercancel", onUp); });
    const onDbl = (e: MouseEvent) => { if (isChrome(e.target)) return; tween = null; cam.z *= 1.5; dirty = true; };
    R.addEventListener("dblclick", onDbl); cleanups.push(() => R.removeEventListener("dblclick", onDbl));

    function loop() {
      if (tween) { tween.t = Math.min(1, tween.t + 0.05); const e = 1 - Math.pow(1 - tween.t, 3); cam.px = tween.px0 + (tween.px1 - tween.px0) * e; cam.py = tween.py0 + (tween.py1 - tween.py0) * e; cam.z = tween.z0 + (tween.z1 - tween.z0) * e; dirty = true; if (tween.t >= 1) tween = null; }
      rotTarget *= 0.9; if (Math.abs(cam.rot - rotTarget) > 0.02) { cam.rot += (rotTarget - cam.rot) * 0.12; dirty = true; }
      // auto-movement is fully off when the pointer left the window, sits on a
      // card, or a card/journey is open — no runaway panning.
      // gentle drift toward a hovered topic (soft, not a snap)
      if (glideTo && !panLast && !pinchLast && !journey && !tween && !meMode && !R.classList.contains("atl-focus")) {
        const tpx = (CX - glideTo.x) + (lang === "he" ? -200 : 200) / cam.z, tpy = (CY - glideTo.y) - 60 / cam.z;
        cam.px += (tpx - cam.px) * 0.03; cam.py += (tpy - cam.py) * 0.03; dirty = true;
      }
      const autoOk = !isTouch && mouseInside && !overChrome && !panLast && !pinchLast && !journey && !focusText && !meMode && !tween && !glideTo && !R.classList.contains("atl-focus") && Object.keys(pts).length === 0;
      // map drifts toward wherever the pointer is (whole-screen parallax)
      const ptX = autoOk ? -(mpx - vw / 2) * 0.04 : 0, ptY = autoOk ? -(mpy - vh / 2) * 0.04 : 0;
      if (Math.abs(ptX - parX) > 0.1 || Math.abs(ptY - parY) > 0.1) { parX += (ptX - parX) * 0.06; parY += (ptY - parY) * 0.06; dirty = true; }
      // hold the pointer off-centre and the map keeps scrolling that way (eager,
      // starts well before the edge).
      if (autoOk) {
        const dz = 0.2, spd = 7;
        let ex = (mpx - vw / 2) / (vw / 2), ey = (mpy - vh / 2) / (vh / 2);
        const ax = Math.abs(ex) > dz ? (ex - Math.sign(ex) * dz) / (1 - dz) : 0;
        const ay = Math.abs(ey) > dz ? (ey - Math.sign(ey) * dz) / (1 - dz) : 0;
        if (ax || ay) { cam.px -= (ax * spd) / cam.z; cam.py -= (ay * spd) / cam.z; dirty = true; }
      }
      if (particlesOn) {
        flowT = (flowT + 0.006) % 1;
        flows.forEach((f, i) => { const u = (flowT + i / flows.length) % 1; const p = pointAt(u); f.setAttribute("cx", p[0].toFixed(1)); f.setAttribute("cy", p[1].toFixed(1)); f.style.opacity = (0.9 * Math.sin(u * Math.PI)).toFixed(2); });
      }
      if (journey && driveEl && driveTarget) {
        drivePos[0] += (driveTarget[0] - drivePos[0]) * 0.12; drivePos[1] += (driveTarget[1] - drivePos[1]) * 0.12;
        driveEl.style.left = drivePos[0].toFixed(1) + "px"; driveEl.style.top = drivePos[1].toFixed(1) + "px";
        if (driveArrow) { driveArrow.style.left = drivePos[0].toFixed(1) + "px"; driveArrow.style.top = drivePos[1].toFixed(1) + "px"; const hx = driveTarget[0] - drivePos[0], hy = driveTarget[1] - drivePos[1]; if (Math.abs(hx) + Math.abs(hy) > 1) driveArrow.style.setProperty("--hd", (Math.atan2(hy, hx) * 180 / Math.PI).toFixed(1) + "deg"); }
      }
      if (dirty) { apply(); dirty = false; }
      raf = requestAnimationFrame(loop);
    }

    const lodThreshold = () => (cam.z < 0.58 ? 1100 : cam.z < 0.9 ? 620 : 0);
    function updateVis() {
      const q = qEl.value.trim().toLowerCase(), thr = lodThreshold(); let matches = 0;
      wordEls.forEach((o) => {
        let dim = false, hide = false;
        const isMine = MINE.has(o.n.en);
        if (q) { const m = o.n.en.toLowerCase().includes(q) || o.n.he.includes(q) || D[o.di].en.toLowerCase().includes(q) || D[o.di].he.includes(q); dim = !m; if (m) matches++; }
        else if (view === "mine") { hide = !isMine; }
        else if (activeD !== null) { dim = o.di !== activeD; } else { hide = o.n.count < thr; }
        o.el.classList.toggle("dim", dim); o.el.classList.toggle("lod", hide);
        o.el.classList.toggle("mine", isMine && view === "mine" && !q);
      });
      anchorEls.forEach((a, di) => a.classList.toggle("dim", q || view === "mine" ? true : activeD !== null && activeD !== di));
      matchEl.textContent = q ? (matches ? TXT[lang].matches(matches) : TXT[lang].nomatch) : (view === "mine" ? TXT[lang].inProgress(MINE.size) : "");
    }
    const vwWorld = $(".atl-vw-world")!, vwMine = $(".atl-vw-mine")!;
    const setView = (v: "world" | "mine") => {
      view = v; vwWorld.classList.toggle("on", v === "world"); vwMine.classList.toggle("on", v === "mine");
      R.classList.toggle("view-mine", v === "mine");
      activeD = null; qEl.value = ""; clrEl.classList.remove("show"); updateVis();
      if (v === "mine") {
        const mw = wordEls.filter((o) => MINE.has(o.n.en));
        if (mw.length) {
          let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
          mw.forEach((o) => { mnx = Math.min(mnx, o.wx); mny = Math.min(mny, o.wy); mxx = Math.max(mxx, o.wx); mxy = Math.max(mxy, o.wy); });
          const cxp = (mnx + mxx) / 2, cyp = (mny + mxy) / 2;
          const span = Math.max(mxx - mnx, (mxy - mny) * 1.4, 400);
          flyTo(-(cxp - CX), -(cyp - CY) - 60, clamp(Math.min(vw, vh) * 0.9 / span, 0.55, 1.1));
        } else flyTo(0, -40, 0.7);
      } else flyTo(0, -40, vw < 720 ? 0.6 : 0.8);
    };
    vwWorld.addEventListener("click", () => setView("world"));
    vwMine.addEventListener("click", () => setView("mine"));

    // time-of-day scrubber — the field breathes as you move it
    const timeRange = $(".atl-time-range") as HTMLInputElement;
    const timeIco = $(".atl-time-ico")!, timeLbl = $(".atl-time-lbl")!;
    const setHour = (h: number) => { hour = h; timeIco.textContent = hourIcon(h); timeLbl.textContent = (h < 10 ? "0" + h : String(h)) + ":00"; R.classList.toggle("atl-night", h < 6 || h >= 19); refreshCounts(); updateStatus(); };
    timeRange.value = String(hour);
    timeRange.addEventListener("input", () => setHour(+timeRange.value));
    setHour(hour);
    function buildSuggest() {
      const q = qEl.value.trim().toLowerCase();
      if (!q) { sugEl.classList.remove("show"); sugEl.innerHTML = ""; return; }
      const ms: number[] = [];
      for (let i = 0; i < N.length && ms.length < 6; i++) { if (N[i].en.toLowerCase().includes(q) || N[i].he.includes(q)) ms.push(i); }
      if (!ms.length) {
        // nothing on the map matches — offer to map it as a new intention
        sugEl.innerHTML = "";
        const b = document.createElement("button"); b.className = "atl-sug atl-sug-new";
        const em = document.createElement("span"); em.className = "atl-sug-em"; em.textContent = "＋";
        const nm = document.createElement("span"); nm.className = "atl-sug-name"; nm.textContent = TXT[lang].mapThis + " “" + qEl.value.trim() + "”";
        b.appendChild(em); b.appendChild(nm);
        b.addEventListener("click", () => { generateArea(qEl.value.trim()); qEl.blur(); });
        sugEl.appendChild(b); sugEl.classList.add("show"); return;
      }
      sugEl.innerHTML = ms.map((i) => { const n = N[i]; return '<button class="atl-sug" data-id="' + i + '"><span class="atl-sug-em">' + D[n.d].em + '</span><span class="atl-sug-name">' + n[lang] + '</span><span class="atl-sug-n">' + Math.round(displayCount(n) * 0.12).toLocaleString() + '</span></button>'; }).join("");
      sugEl.querySelectorAll(".atl-sug").forEach((b) => b.addEventListener("click", () => openNode(+(b.getAttribute("data-id") || 0))));
      sugEl.classList.add("show");
    }
    // As you type, the map clears and only what relates to your words lights up
    // (name, its topic, or its needs — plus wants people pair it with).
    function buildRelevant() {
      const q = qEl.value.trim().toLowerCase(); const relevant = new Set<number>();
      if (q) {
        N.forEach((n, i) => { const nd = NEEDS[n.en] || []; if (n.en.toLowerCase().includes(q) || n.he.includes(q) || D[n.d].en.toLowerCase().includes(q) || D[n.d].he.includes(q) || nd.some((x) => x.en.toLowerCase().includes(q) || x.he.includes(q))) relevant.add(i); });
        const names = new Set<string>(); relevant.forEach((i) => names.add(N[i].en));
        XLINKS.forEach(([a, b]) => { if (names.has(a)) { const j = N.findIndex((x) => x.en === b); if (j >= 0) relevant.add(j); } if (names.has(b)) { const j = N.findIndex((x) => x.en === a); if (j >= 0) relevant.add(j); } });
      }
      wordEls.forEach((o) => o.el.classList.toggle("match", relevant.has(+o.el.getAttribute("data-id")!)));
    }
    function exitCompose() { R.classList.remove("atl-compose"); qEl.setAttribute("placeholder", TXT[lang].ph); wordEls.forEach((o) => o.el.classList.remove("match")); sugEl.classList.remove("show"); }
    qEl.addEventListener("focus", () => { qEl.setAttribute("placeholder", ""); R.classList.add("atl-compose"); buildRelevant(); });
    qEl.addEventListener("blur", () => { if (!qEl.value.trim()) exitCompose(); });
    const onInput = () => { clrEl.classList.toggle("show", !!qEl.value.trim()); if (qEl.value.trim()) activeD = null; updateVis(); buildSuggest(); buildRelevant(); };
    qEl.addEventListener("input", onInput);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return; const raw = qEl.value.trim();
      // a card is open: the input talks to ONE about this thing (context) — no separate Start button
      if (R.classList.contains("atl-focus")) { if (onStartRef.current) onStartRef.current(raw || (cur ? cur.n[lang] : "")); return; }
      const q = raw.toLowerCase(); if (!q) return;
      for (let i = 0; i < N.length; i++) if (N[i].en.toLowerCase().includes(q) || N[i].he.includes(q)) { openNode(i); qEl.blur(); return; }
      for (let j = 0; j < D.length; j++) if (D[j].en.toLowerCase().includes(q) || D[j].he.includes(q)) { focusDistrict(j); return; }
      generateArea(raw); qEl.blur(); // nothing matched — map the new need
    };
    qEl.addEventListener("keydown", onKey);
    const onClr = () => { qEl.value = ""; clrEl.classList.remove("show"); sugEl.classList.remove("show"); activeD = null; updateVis(); qEl.focus(); };
    clrEl.addEventListener("click", onClr);
    const plusEl = $(".atl-plus"), voiceEl = $(".atl-voice");
    if (plusEl) plusEl.addEventListener("click", () => { qEl.value = ""; clrEl.classList.remove("show"); activeD = null; updateVis(); qEl.focus(); });
    if (voiceEl) voiceEl.addEventListener("click", () => { voiceEl.classList.toggle("on"); qEl.focus(); });

    function focusDistrict(di: number) {
      activeD = activeD === di ? null : di; qEl.value = ""; clrEl.classList.remove("show"); updateVis();
      if (activeD !== null) flyTo(-(D[di].x! - CX), -(D[di].y! - CY) - 160, Math.max(cam.z, 1.0));
      else flyTo(0, -40, vw < 720 ? 0.6 : 0.8);
    }
    // A brand-new, unmapped need: ONE spawns a fresh area near the view centre
    // with a drafted route, so the space grows to the person.
    function generateArea(text: string) {
      if (!text) return;
      const di = D.length;
      const wx0 = CX - cam.px, wy0 = CY - cam.py;
      const dist: District = { en: lang === "he" ? "חדש" : "New", he: "חדש", c: "#8a8a86", em: "✨", ox: 0, oy: 0, x: wx0 + 40, y: wy0 - 40 };
      D.push(dist);
      const n: Intent = { d: di, en: text, he: text, count: 60, trend: 0, done: 0, avg: 7, steps: GEN_STEPS };
      N.push(n); const idx = N.length - 1;
      const a = document.createElement("button"); a.className = "atl-anchor";
      a.style.left = dist.x! + "px"; a.style.top = dist.y! + "px"; a.style.setProperty("--dc", dist.c);
      a.innerHTML = '<span class="atl-emoji" aria-hidden="true">' + dist.em + '</span><span class="atl-alabel"></span>';
      a.addEventListener("click", (e) => { e.stopPropagation(); openIndex(di); });
      // (index opens on click; hover shows the .atl-asum summary tab)
      ground.appendChild(a); anchorEls.push(a);
      const wx = dist.x! + 20, wy = dist.y! + 150;
      const el = document.createElement("button"); el.className = "atl-word gen";
      el.style.left = wx + "px"; el.style.top = wy + "px"; el.style.setProperty("--dc", dist.c);
      el.style.setProperty("--fd", "7s"); el.style.setProperty("--fdl", "0s");
      const fs = sizeFor(displayCount(n));
      el.innerHTML = '<span class="atl-float"><span class="atl-inner" style="font-size:' + fs.toFixed(1) + 'px;font-weight:700"></span><span class="atl-count"></span></span>';
      el.setAttribute("data-id", String(idx));
      el.addEventListener("click", (e) => { e.stopPropagation(); openNode(idx); });
      el.addEventListener("mouseenter", (e) => showTip(n, e));
      el.addEventListener("mousemove", (e) => { tipEl.style.left = e.clientX + "px"; tipEl.style.top = e.clientY - 16 + "px"; });
      el.addEventListener("mouseleave", hideTip);
      ground.appendChild(el); wordEls.push({ el, n, di, wx, wy });
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("class", "atl-link"); ln.setAttribute("x1", String(dist.x)); ln.setAttribute("y1", String(dist.y));
      ln.setAttribute("x2", String(wx)); ln.setAttribute("y2", String(wy)); baseLinks.appendChild(ln);
      paintText();
      openNode(idx);
    }
    // Clicking a want = PREVIEW: draw its route + fill the card. The active
    // journey (ONE driving, providers on the map, progress) only begins on Start.
    function openNode(id: number) {
      selected = id; const n = N[id], dist = D[n.d], t = TXT[lang];
      hideTip(); panel.classList.remove("is-custom", "center"); exitCompose();
      activeD = null; qEl.value = ""; clrEl.classList.remove("show"); updateVis();
      wordEls.forEach((o) => o.el.classList.toggle("sel", +o.el.getAttribute("data-id")! === id));
      journey = false; R.classList.remove("atl-journey"); R.classList.add("atl-focus"); // drill into this topic
      if (driveEl) { driveEl.remove(); driveEl = null; } if (driveArrow) { driveArrow.remove(); driveArrow = null; }
      clearProviders(); clearRoute();
      const o = wordOf(id);
      const wx0 = o ? o.wx : dist.x!, wy0 = o ? o.wy : dist.y!;
      const needs = NEEDS[n.en] || AGENTS.filter((ag) => ag.di === n.d).slice(0, 3).map((ag) => ({ em: ag.em, en: ag.en, he: ag.he }));
      cur = { id, n, dist, needs, goal: [wx0, wy0] };
      curStep = 0;
      // the want's specific needs appear around it (photographer, dress, venue…),
      // wired to it — added on click, cleared when you switch or close.
      needs.forEach((nd, k) => {
        const ang = (k / Math.max(1, needs.length)) * Math.PI * 2 + 0.4;
        const px = wx0 + Math.cos(ang) * 240, py = wy0 + Math.sin(ang) * 240 * 0.8;
        providerEls.push(addAgent({ di: n.d, em: nd.em, en: nd.en, he: nd.he }, px, py, true));
        const ln = document.createElementNS(SVGNS, "line"); ln.setAttribute("class", "atl-plink");
        ln.setAttribute("x1", String(wx0)); ln.setAttribute("y1", String(wy0)); ln.setAttribute("x2", String(px)); ln.setAttribute("y2", String(py));
        ln.style.stroke = dist.c; baseLinks.appendChild(ln); plinkEls.push(ln);
      });
      previewRoute(id); // the path others took, faint on the map
      if (o) flyTo(-(o.wx - CX) + (lang === "he" ? -260 : 260), -(o.wy - CY) - 120, Math.max(cam.z, 1.25));
      (panel.querySelector(".atl-tag") as HTMLElement).style.setProperty("--dc", dist.c);
      ($(".atl-em")!).textContent = dist.em;
      ($(".atl-district")!).textContent = dist[lang];
      ($(".atl-title")!).textContent = n[lang];
      ($(".atl-now")!).textContent = Math.round(displayCount(n) * 0.12).toLocaleString();
      ($(".atl-nowlbl")!).textContent = t.nowLbl;
      ($(".atl-trend")!).textContent = "↑ " + n.trend + "%";
      ($(".atl-done")!).textContent = n.done.toLocaleString();
      ($(".atl-donek")!).textContent = t.doneK;
      ($(".atl-avg")!).textContent = n.avg + " " + t.days;
      ($(".atl-avgk")!).textContent = t.avgK;
      ($(".atl-pathh")!).textContent = t.stepsH;
      renderSteps();
      ($(".atl-provh")!).textContent = t.needsH;
      const pl = $(".atl-provlist")!; pl.innerHTML = "";
      needs.forEach((nd) => { const c = document.createElement("span"); c.className = "atl-prov"; c.innerHTML = '<span class="atl-prov-em">' + nd.em + '</span>' + nd[lang]; pl.appendChild(c); });
      (R.querySelector(".atl-providers") as HTMLElement).style.display = needs.length ? "" : "none";
      // related wants (things people usually pair with this one)
      const rel = new Set<string>();
      XLINKS.forEach(([a, b]) => { if (a === n.en) rel.add(b); else if (b === n.en) rel.add(a); });
      const relArr = Array.from(rel).slice(0, 4);
      ($(".atl-relh")!).textContent = t.relatedH;
      const rl = $(".atl-relatedlist")!; rl.innerHTML = "";
      relArr.forEach((en) => { const idx2 = N.findIndex((x) => x.en === en); if (idx2 < 0) return; const rn = N[idx2]; const b = document.createElement("button"); b.className = "atl-rel"; b.innerHTML = '<span class="atl-rel-em">' + D[rn.d].em + '</span>' + rn[lang]; b.addEventListener("click", () => openNode(idx2)); rl.appendChild(b); });
      (R.querySelector(".atl-related-sec") as HTMLElement).style.display = relArr.length ? "" : "none";
      const cta = $(".atl-cta")!; cta.textContent = t.startJ; cta.classList.remove("done");
      ($(".atl-priv2")!).textContent = t.priv2;
      // the input becomes the call to action — rotating, contextual to this want
      const nm = n[lang];
      focusPrompts = lang === "he"
        ? ["ספרו ל‑ONE מה צריך ל" + nm, "מאיפה מתחילים עם " + nm + "?", "מה הכי חשוב לכם כאן?", "פשוט תגידו — ONE ממשיך מכאן"]
        : ["Tell ONE what you need for " + nm.toLowerCase(), "Where should ONE start with " + nm.toLowerCase() + "?", "What matters most to you here?", "Just say it — ONE takes it from here"];
      focusPromptI = 0; qEl.setAttribute("placeholder", focusPrompts[0]);
      panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    }
    function renderSteps() {
      if (!cur) return; const ol = $(".atl-steps")!; ol.innerHTML = "";
      cur.n.steps.forEach((st, i) => {
        const li = document.createElement("li"); li.setAttribute("data-n", String(i + 1));
        if (journey) li.className = i < curStep ? "done" : i === curStep ? "current" : "todo";
        const d = document.createElement("div"); d.className = "atl-stxt";
        d.innerHTML = (journey && i === curStep ? '<span class="atl-onetag">ONE</span> ' : "") + st[lang];
        li.appendChild(d);
        if (journey && i === curStep) {
          const act = document.createElement("div"); act.className = "atl-stepact";
          const inp = document.createElement("input"); inp.className = "atl-stepq"; inp.type = "text"; inp.placeholder = TXT[lang].stepPh;
          const go = document.createElement("button"); go.className = "atl-stepgo"; go.textContent = TXT[lang].cont;
          act.appendChild(inp); act.appendChild(go); li.appendChild(act);
          go.addEventListener("click", advanceStep);
          inp.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") advanceStep(); });
          setTimeout(() => { try { inp.focus(); } catch { /* focus can fail */ } }, 60);
        }
        ol.appendChild(li);
      });
    }
    function setProgress() {
      if (!cur) return; const total = cur.n.steps.length, pct = total ? Math.round((curStep / total) * 100) : 100;
      const pf = R.querySelector(".atl-progress-fill") as HTMLElement | null; if (pf) pf.style.width = pct + "%";
      const pp = $(".atl-progress-pct"); if (pp) pp.textContent = pct + "%";
      const lb = $(".atl-progress-lbl"); if (lb) lb.textContent = curStep >= total ? TXT[lang].arrived : TXT[lang].journeying;
    }
    function advanceStep() {
      if (!cur) return; const total = cur.n.steps.length; if (curStep >= total) return;
      curStep++;
      driveTarget = (routePts[Math.min(curStep, routePts.length - 1)] || cur.goal).slice();
      if (reduce && driveEl && driveArrow) { drivePos = driveTarget.slice(); driveEl.style.left = drivePos[0] + "px"; driveEl.style.top = drivePos[1] + "px"; driveArrow.style.left = drivePos[0] + "px"; driveArrow.style.top = drivePos[1] + "px"; }
      renderSteps(); setProgress();
      if (curStep >= total) { const c = $(".atl-cta")!; c.textContent = TXT[lang].openIn; c.classList.add("done"); }
    }
    // Clicking the companion opens YOUR ONE — an Atlas-native profile card in the
    // same style, listing what you've got in motion.
    function openMe() {
      hideTip(); const t = TXT[lang];
      const mine = wordEls.filter((o) => MINE.has(o.n.en));
      const doneTotal = mine.reduce((s, o) => s + o.n.done, 0);
      const worlds = Array.from(new Set(mine.map((o) => o.n.d)));
      customEl.innerHTML =
        '<div class="atl-me"><div class="atl-me-facegap" aria-hidden="true"></div>' +
        '<div class="atl-me-name">' + t.myOne + '</div><div class="atl-me-sub">' + t.myOneSub + '</div>' +
        '<div class="atl-me-stats"><div><b>' + mine.length + '</b><span>' + t.inMotion + '</span></div><div><b>' + doneTotal.toLocaleString() + '</b><span>' + t.completed + '</span></div><div><b>' + worlds.length + '</b><span>' + t.worlds + '</span></div></div>' +
        '<div class="atl-sech" style="margin-top:22px">' + t.inProgress(mine.length) + '</div>' +
        '<div class="atl-me-list">' + mine.map((o) => { const dc = displayCount(o.n); const pc = Math.min(90, 20 + (o.n.done % 70)); return '<button class="atl-me-item" data-id="' + o.el.getAttribute("data-id") + '"><span class="atl-me-em">' + D[o.n.d].em + '</span><span class="atl-me-it-b"><span class="atl-me-it-name">' + o.n[lang] + '</span><span class="atl-me-bar"><span style="width:' + pc + '%"></span></span></span><span class="atl-me-it-n">' + Math.round(dc * 0.12).toLocaleString() + '</span></button>'; }).join("") + '</div>' +
        '<div class="atl-sech" style="margin-top:20px">' + t.meWorlds + '</div>' +
        '<div class="atl-me-worlds">' + worlds.map((di) => '<span class="atl-me-world"><span>' + D[di].em + '</span>' + D[di][lang] + '</span>').join("") + '</div>' +
        '<button class="atl-cta atl-me-manage">' + t.manage + '</button>' +
        '<p class="atl-priv2">' + t.priv2 + '</p></div>';
      customEl.querySelectorAll(".atl-me-item").forEach((b) => b.addEventListener("click", () => openNode(+(b.getAttribute("data-id") || 0))));
      const mg = customEl.querySelector(".atl-me-manage"); if (mg) mg.addEventListener("click", () => { if (onOrbTapRef.current) onOrbTapRef.current(); });
      panel.classList.remove("open"); panel.classList.add("is-custom", "center"); R.classList.add("atl-meopen");
      panel.setAttribute("aria-hidden", "false");
      meMode = true; // the real companion rises into the card as the avatar
      // paint the below-and-scaled closed state, then rise — mirrors the close exactly
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("open")));
    }
    // Start = the journey actually begins: field clears, ONE drives, providers appear.
    function startJourney() {
      if (!cur || journey) return; const dist = cur.dist;
      growRoute(cur.id); // draw the route now, as the journey begins
      cur.goal = routePts[routePts.length - 1] || cur.goal;
      journey = true; R.classList.add("atl-journey");
      if (driveEl) driveEl.remove(); if (driveArrow) driveArrow.remove();
      driveArrow = document.createElement("div"); driveArrow.className = "atl-drive-arrow"; ground.appendChild(driveArrow);
      driveEl = document.createElement("div"); driveEl.className = "atl-drive"; driveEl.innerHTML = FACE; ground.appendChild(driveEl);
      const startPt = routePts[0] || cur.goal;
      drivePos = startPt.slice(); driveTarget = startPt.slice();
      driveEl.style.left = startPt[0] + "px"; driveEl.style.top = startPt[1] + "px";
      driveArrow.style.left = startPt[0] + "px"; driveArrow.style.top = startPt[1] + "px";
      // (the need markers already surround the want from the preview)
      void dist;
      ($(".atl-pathh")!).textContent = TXT[lang].stepsHgo;
      curStep = 0; renderSteps(); setProgress();
      const cta = $(".atl-cta")!; cta.textContent = TXT[lang].openIn; cta.classList.remove("done");
    }
    function closePanel() {
      panel.classList.remove("open"); R.classList.remove("atl-meopen"); panel.setAttribute("aria-hidden", "true");
      selected = null; cur = null; meMode = false; journey = false;
      wordEls.forEach((o) => o.el.classList.remove("sel")); clearRoute();
      if (driveEl) { driveEl.remove(); driveEl = null; } if (driveArrow) { driveArrow.remove(); driveArrow = null; }
      clearProviders();
      // Keep the whole open-card layout — hidden Start button, in-card composer, dimmed map —
      // through the fade-out, THEN reset. Otherwise the old layout (with the button) flashes as it closes.
      setTimeout(() => { if (!panel.classList.contains("open")) { panel.classList.remove("is-custom", "center"); R.classList.remove("atl-focus", "atl-journey"); } }, 340);
      flyTo(0, -30, vw < 720 ? 0.6 : 0.8); // pull back out to the full map
    }
    // A tiny market-style area chart (line + gradient fill + "now" dot), reused by
    // the world card and the service-ONE card.
    let chartN = 0;
    const marketChart = (series: number[], dc: string, label: string, deltaPct: number): string => {
      const W = 300, H = 84, pad = 6, mn = Math.min(...series), mx = Math.max(...series) || 1;
      const xs = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
      const ys = (v: number) => H - pad - ((v - mn) / ((mx - mn) || 1)) * (H - 2 * pad);
      const line = series.map((v, i) => (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1)).join(" ");
      const area = "M " + xs(0).toFixed(1) + " " + (H - pad) + " " + series.map((v, i) => "L " + xs(i).toFixed(1) + " " + ys(v).toFixed(1)).join(" ") + " L " + xs(series.length - 1).toFixed(1) + " " + (H - pad) + " Z";
      const gid = "spk" + (chartN++), up = deltaPct >= 0;
      return '<div class="atl-idx-chtop"><span>' + label + '</span><span class="atl-idx-chd' + (up ? "" : " dn") + '">' + (up ? "↑ " : "↓ ") + Math.abs(deltaPct) + '%</span></div>' +
        '<div class="atl-idx-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + dc + '" stop-opacity="0.26"/><stop offset="1" stop-color="' + dc + '" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
          '<path d="' + line + '" fill="none" stroke="' + dc + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
          '<circle cx="' + xs(series.length - 1).toFixed(1) + '" cy="' + ys(series[series.length - 1]).toFixed(1) + '" r="3.4" fill="' + dc + '"/>' +
        '</svg></div>';
    };
    // Clicking a business/pro ONE opens its profile card.
    function openProvider(ag: Agent) {
      hideTip(); const t = TXT[lang], dc = D[ag.di].c, r = rng(ag.en.length * 131 + ag.di);
      const rating = (4.2 + r() * 0.7).toFixed(1), jobs = 40 + Math.floor(r() * 200), reply = 5 + Math.floor(r() * 40) + "m";
      const trendP = Math.round(r() * 22 - 4); // mostly rising
      const s2 = rng(ag.en.length * 71 + ag.di * 13 + 5);
      const series = Array.from({ length: 12 }, (_, i) => { const up = 1 + (trendP / 100) * (i / 11); return Math.max(1, (jobs / 4) * (0.68 + s2() * 0.64) * up); });
      customEl.innerHTML =
        '<div class="atl-pv" style="--dc:' + dc + '"><div class="atl-pv-head"><span class="atl-pv-face">' + FACE + '<span class="atl-pv-em">' + ag.em + '</span></span>' +
        '<div><div class="atl-pv-name">' + ag[lang] + '</div><div class="atl-pv-sub">' + D[ag.di][lang] + ' · ★ ' + rating + '</div></div></div>' +
        '<div class="atl-pv-stats"><div><b>' + jobs + '</b><span>' + t.jobs + '</span></div><div><b>' + reply + '</b><span>' + t.reply + '</span></div><div><b>★ ' + rating + '</b><span>' + t.rating + '</span></div></div>' +
        marketChart(series, dc, t.pvChart, trendP) +
        '<button class="atl-cta atl-pv-cta">' + t.connect + '</button><p class="atl-priv2">' + t.priv2 + '</p></div>';
      const c = customEl.querySelector(".atl-pv-cta") as HTMLButtonElement | null;
      if (c) c.addEventListener("click", () => { if (onStartRef.current) onStartRef.current(ag[lang]); });
      panel.classList.remove("center"); panel.classList.add("is-custom", "open"); panel.setAttribute("aria-hidden", "false");
    }
    // Clicking a topic marker opens its "human index" — a basket of that world.
    // format a big money figure with the local currency and K/M suffix
    const money = (v: number) => { const c = lang === "he" ? "₪" : "$"; return v >= 1e6 ? c + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? c + Math.round(v / 1e3) + "K" : c + Math.round(v); };
    function openIndex(di: number) {
      hideTip(); const t = TXT[lang], dist = D[di], dc = dist.c;
      const items = N.filter((n) => n.d === di);
      const liveTotal = items.reduce((a, n) => a + Math.round(displayCount(n) * 0.12), 0);
      const provCount = AGENTS.filter((a) => a.di === di).length;
      const avgTrend = Math.round(items.reduce((a, n) => a + n.trend, 0) / (items.length || 1));
      const top = items.slice().sort((a, b) => displayCount(b) - displayCount(a)).slice(0, 4);
      const maxv = (top[0] ? Math.round(displayCount(top[0]) * 0.12) : 1) || 1;
      const rows = top.map((n) => { const v = Math.round(displayCount(n) * 0.12); return '<div class="atl-idx-row"><span class="atl-idx-bar" style="width:' + Math.max(8, Math.round((v / maxv) * 100)) + '%"></span><span class="atl-idx-name">' + n[lang] + '</span><span class="atl-idx-v">' + v.toLocaleString() + '</span></div>'; }).join("");
      // market-style figures: money that moved through this world, weekly demand, its curve
      const rr = rng(di * 131 + 7); const dealSize = 150 + Math.floor(rr() * 1500);
      const circulated = liveTotal * dealSize; const weekly = items.reduce((s, n) => s + n.done, 0);
      const rc = rng(di * 57 + 3);
      const series = Array.from({ length: 24 }, (_, i) => { const day = 0.62 + 0.38 * Math.sin(((i - 6) / 24) * Math.PI * 2); const noise = 0.86 + rc() * 0.28; const up = 1 + (avgTrend / 100) * (i / 23); return Math.max(1, liveTotal * day * noise * up); });
      const chart = marketChart(series, dc, t.idxChart, avgTrend);
      customEl.innerHTML =
        '<div class="atl-idx" style="--dc:' + dc + '"><div class="atl-pv-head"><span class="atl-idx-em">' + dist.em + '</span><div><div class="atl-pv-name">' + dist[lang] + '</div><div class="atl-pv-sub">' + t.idxLive + '</div></div><span class="atl-idx-trend">↑ ' + avgTrend + '%</span></div>' +
        '<div class="atl-idx-big">' + liveTotal.toLocaleString() + '</div>' +
        chart +
        '<div class="atl-idx-metrics"><div><b>' + money(circulated) + '</b><span>' + t.idxVolume + '</span></div><div><b>' + weekly.toLocaleString() + '</b><span>' + t.idxDemand + '</span></div><div><b>' + provCount + '</b><span>' + t.idxProviders + '</span></div></div>' +
        '<div class="atl-sech" style="margin-top:18px">' + t.idxTop + '</div>' + rows +
        '<button class="atl-cta atl-idx-cta">' + t.idxEnter + '</button></div>';
      const c = customEl.querySelector(".atl-idx-cta") as HTMLButtonElement | null;
      if (c) c.addEventListener("click", () => { panel.classList.remove("open", "is-custom"); panel.setAttribute("aria-hidden", "true"); focusDistrict(di); });
      panel.classList.remove("center"); panel.classList.add("is-custom", "open"); panel.setAttribute("aria-hidden", "false");
    }
    ($(".atl-close")!).addEventListener("click", closePanel);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", onEsc); cleanups.push(() => document.removeEventListener("keydown", onEsc));
    ($(".atl-cta")!).addEventListener("click", () => {
      if (!journey) { startJourney(); return; }               // first press = begin the journey
      if (cur && onStartRef.current) onStartRef.current(cur.n[lang]); // once underway = hand to ONE
    });
    { const sc = $(".atl-scrim"); if (sc) sc.addEventListener("click", closePanel); }
    { const openP = () => { if (onOrbTapRef.current) onOrbTapRef.current(); };
      const lg = $(".atl-logo"); if (lg) lg.addEventListener("click", openP);
      const sl = $(".atl-signin-link"); if (sl) sl.addEventListener("click", openP); }
    { const ck = $(".atl-status-main"), pop = $(".atl-timepop");
      if (ck && pop) { ck.addEventListener("click", (e) => { e.stopPropagation(); pop.classList.toggle("show"); });
        R.addEventListener("pointerdown", (e) => { if (!(e.target as Element).closest(".atl-timepop,.atl-status-main")) pop.classList.remove("show"); }); } }

    // live tick
    let tick: ReturnType<typeof setInterval> | null = null;
    let flareTick = 0;
    if (!reduce) {
      tick = setInterval(() => {
        for (let k = 0; k < 3; k++) { const n = N[Math.floor(Math.random() * N.length)]; n.count += Math.floor(Math.random() * 3); }
        refreshCounts(); tickStatus();
        const clear = !R.classList.contains("atl-focus") && !R.classList.contains("atl-compose") && !meMode;
        if (wordEls.length && clear) { const o = wordEls[Math.floor(Math.random() * wordEls.length)]; if (o && !o.el.classList.contains("lod") && !o.el.classList.contains("dim")) spawnRipple(o.wx, o.wy, D[o.di].c); }
        // every other tick, flare a surging want — a live "trending now" pulse
        if (clear && flareTick++ % 2 === 0) {
          const risers = wordEls.filter((o) => !o.el.classList.contains("lod") && !o.el.classList.contains("dim") && o.n.trend >= 6);
          if (risers.length) { const o = risers[Math.floor(Math.random() * risers.length)]; spawnFlare(o.wx, o.wy - 34, D[o.di].c, o.n.trend); }
        }
      }, 3400);
      cleanups.push(() => { if (tick) clearInterval(tick); });
    }

    // Top-of-screen toasts — live updates & tips that pop and can be dismissed.
    {
      const toastsEl = $(".atl-toasts")!;
      const L = lang === "he";
      const IC_INFO = IC('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>');
      const IC_BULB = IC('<path d="M9 18h6M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.1 1 2.1h5c.1-1 .4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>');
      const IC_X = IC('<path d="M6 6l12 12M18 6L6 18"/>');
      const IC_GEAR = IC('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
      const tips = L
        ? [["טיפ", "גררו את השעון כדי לראות את היום מתחלף"], ["טיפ", "הקלידו רצון וה‑ONE ימפה אותו"], ["טיפ", "לחצו על נושא לפירוט המלא"]]
        : [["Tip", "Scrub the clock to watch the day shift"], ["Tip", "Type a need — ONE maps it for you"], ["Tip", "Click a topic for the full picture"]];
      // toast preferences: where they sit, whether they're silenced, which kinds show
      type TPrefs = { pos: "top" | "bottom"; muted: boolean; upd: boolean; tip: boolean };
      const DEFP: TPrefs = { pos: "top", muted: false, upd: true, tip: true };
      let prefs: TPrefs = DEFP;
      try { const raw = localStorage.getItem("one_atlas_toastprefs"); if (raw) prefs = { ...DEFP, ...JSON.parse(raw) }; } catch { /* first run */ }
      const saveP = () => { try { localStorage.setItem("one_atlas_toastprefs", JSON.stringify(prefs)); } catch { /* private mode */ } };
      const applyPos = () => { toastsEl.classList.toggle("pos-bottom", prefs.pos === "bottom"); };
      applyPos();
      // the settings card — opens centred from any toast's gear
      const setEl = document.createElement("div"); setEl.className = "atl-tset"; setEl.setAttribute("aria-hidden", "true");
      setEl.innerHTML =
        '<div class="atl-tset-card" role="dialog" aria-modal="true">' +
          '<div class="atl-tset-head"><b>' + (L ? "הגדרות התראות" : "Notifications") + '</b><button class="atl-tset-x" aria-label="Close">' + IC_X + '</button></div>' +
          '<div class="atl-tset-lbl">' + (L ? "מיקום" : "Position") + '</div>' +
          '<div class="atl-tset-seg" data-k="pos"><button data-v="top">' + (L ? "למעלה" : "Top") + '</button><button data-v="bottom">' + (L ? "למטה" : "Bottom") + '</button></div>' +
          '<div class="atl-tset-lbl">' + (L ? "התראות" : "Alerts") + '</div>' +
          '<div class="atl-tset-row"><span>' + (L ? "השתקה מלאה" : "Silence all") + '</span><button class="atl-tset-sw" data-k="muted" role="switch"></button></div>' +
          '<div class="atl-tset-lbl">' + (L ? "סוגים" : "Show") + '</div>' +
          '<div class="atl-tset-row"><span>' + (L ? "עדכונים" : "Updates") + '</span><button class="atl-tset-sw" data-k="upd" role="switch"></button></div>' +
          '<div class="atl-tset-row"><span>' + (L ? "טיפים" : "Tips") + '</span><button class="atl-tset-sw" data-k="tip" role="switch"></button></div>' +
        '</div>';
      R.appendChild(setEl); cleanups.push(() => setEl.remove());
      const syncSet = () => {
        setEl.querySelectorAll('.atl-tset-seg[data-k="pos"] button').forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.v === prefs.pos));
        (["muted", "upd", "tip"] as const).forEach((k) => { const sw = setEl.querySelector('.atl-tset-sw[data-k="' + k + '"]'); if (sw) sw.classList.toggle("on", prefs[k]); });
      };
      setEl.querySelectorAll('.atl-tset-seg[data-k="pos"] button').forEach((b) => b.addEventListener("click", () => { prefs.pos = ((b as HTMLElement).dataset.v as "top" | "bottom"); applyPos(); saveP(); syncSet(); }));
      setEl.querySelectorAll(".atl-tset-sw").forEach((sw) => sw.addEventListener("click", () => { const k = ((sw as HTMLElement).dataset.k as "muted" | "upd" | "tip"); prefs[k] = !prefs[k]; saveP(); syncSet(); }));
      const openSet = () => { syncSet(); setEl.classList.add("show"); setEl.setAttribute("aria-hidden", "false"); };
      const closeSet = () => { setEl.classList.remove("show"); setEl.setAttribute("aria-hidden", "true"); };
      (setEl.querySelector(".atl-tset-x") as HTMLElement).addEventListener("click", closeSet);
      setEl.addEventListener("click", (e) => { if (e.target === setEl) closeSet(); });
      // newest in front, older cards peeking behind it — a little stack
      const restack = () => {
        const kids = Array.from(toastsEl.children) as HTMLElement[]; const n = kids.length;
        kids.forEach((el, i) => {
          if (el.classList.contains("out")) return;
          const depth = n - 1 - i; el.style.zIndex = String(200 - depth);
          el.style.transform = "translate(-50%," + depth * 10 + "px) scale(" + (1 - depth * 0.05).toFixed(3) + ")";
          el.style.opacity = String(Math.max(0.25, 1 - depth * 0.18));
        });
      };
      const pushToast = (icon: string, title: string, body: string) => {
        if (prefs.muted) return; // silenced
        const el = document.createElement("div"); el.className = "atl-toast";
        el.innerHTML = '<span class="atl-toast-ic">' + icon + '</span><div class="atl-toast-b"><b>' + title + '</b><span>' + body + '</span></div><button class="atl-toast-gear" aria-label="' + (L ? "הגדרות" : "Settings") + '">' + IC_GEAR + '</button><button class="atl-toast-x" aria-label="Dismiss">' + IC_X + '</button>';
        let t = 0; const kill = () => { clearTimeout(t); el.classList.add("out"); el.style.opacity = "0"; el.style.transform = "translate(-50%,-12px) scale(.92)"; setTimeout(() => { el.remove(); restack(); }, 300); };
        (el.querySelector(".atl-toast-x") as HTMLElement).addEventListener("click", kill);
        (el.querySelector(".atl-toast-gear") as HTMLElement).addEventListener("click", (e) => { e.stopPropagation(); openSet(); });
        el.style.opacity = "0"; el.style.transform = "translate(-50%,-12px) scale(.96)";
        toastsEl.appendChild(el);
        while (toastsEl.children.length > 4) { const f = toastsEl.firstElementChild as HTMLElement | null; if (f) f.remove(); }
        requestAnimationFrame(restack);
        t = window.setTimeout(kill, 7000);
      };
      let tn = 0;
      const ti = setInterval(() => {
        if (document.hidden || prefs.muted) return;
        const kinds: ("upd" | "tip")[] = []; if (prefs.upd) kinds.push("upd"); if (prefs.tip) kinds.push("tip");
        if (!kinds.length) return; const kind = kinds[tn++ % kinds.length];
        if (kind === "upd") { const n = N[Math.floor(Math.random() * N.length)]; pushToast(IC_INFO, n[lang], n.done.toLocaleString() + " " + TXT[lang].doneK); }
        else { const tp = tips[Math.floor(Math.random() * tips.length)]; pushToast(IC_BULB, tp[0], tp[1]); }
      }, 9000);
      cleanups.push(() => clearInterval(ti));
    }

    // ONE rests centred above the input and stays put — it only leaves home for
    // a REASON: it glances at you when you move, startles when you press, and
    // drifts over to a want while you're inspecting it, then eases back home.
    {
      const curEl = $(".atl-cursor");
      const eL = curEl ? (curEl.querySelector(".atl-cur-l") as SVGCircleElement) : null;
      const eR = curEl ? (curEl.querySelector(".atl-cur-r") as SVGCircleElement) : null;
      const homeX = () => vw / 2, homeY = () => vh * 0.33; // big & centred, just above the input
      let px = homeX(), py = homeY();
      let gx = 0, gy = 0, tgx = 0, tgy = 0, nextGaze = 0;
      let lastMove = -9999;
      const mv = (e: MouseEvent) => { mpx = e.clientX; mpy = e.clientY; lastMove = performance.now(); mouseInside = true; const el = e.target as Element | null; overChrome = !!(el && el.closest && el.closest(".atl-topbar,.atl-core,.atl-panel,.atl-priv")); };
      window.addEventListener("mousemove", mv, { passive: true }); cleanups.push(() => window.removeEventListener("mousemove", mv));
      const onLeaveWin = () => { mouseInside = false; }, onEnterWin = () => { mouseInside = true; };
      document.addEventListener("mouseleave", onLeaveWin); document.addEventListener("mouseenter", onEnterWin);
      cleanups.push(() => { document.removeEventListener("mouseleave", onLeaveWin); document.removeEventListener("mouseenter", onEnterWin); });
      const react = () => { lastMove = performance.now(); if (curEl) { curEl.classList.add("react"); setTimeout(() => curEl.classList.remove("react"), 340); } };
      window.addEventListener("pointerdown", react); cleanups.push(() => window.removeEventListener("pointerdown", react));
      if (curEl) curEl.addEventListener("click", openMe); // tap ONE → your profile
      const pickGaze = (now: number) => { const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.45; tgx = Math.cos(a) * r; tgy = Math.sin(a) * r; nextGaze = now + 2400 + Math.random() * 2600; };
      let craf = 0;
      const fr = () => {
        const now = performance.now();
        // home unless there's a reason to move: a want under inspection pulls it over
        let tx = homeX(), ty = homeY(), aside = false, big = false;
        if (meMode) { const r = panel.getBoundingClientRect(); tx = r.left + r.width / 2; ty = r.top + 60; big = true; } // rise into the profile card as its avatar
        else if (R.classList.contains("atl-focus")) { const r = panel.getBoundingClientRect(); tx = clamp((lang === "he" ? r.left - 42 : r.right + 42), 44, vw - 44); ty = clamp(r.bottom - 60, 120, vh - 96); } // stand just outside the card, beside the input it speaks to
        else if (focusText) { tx = mpx + (mpx > vw / 2 ? -170 : 170); ty = mpy - 40; aside = true; } // beside the hover card, not behind it
        px += (tx - px) * (meMode ? 0.14 : 0.05); py += (ty - py) * (meMode ? 0.14 : 0.05);
        if (meMode) { tgx = 0; tgy = 0; } // look straight ahead as the avatar
        else if (now - lastMove < 1600) { tgx = clamp((mpx - px) / 220, -1, 1); tgy = clamp((mpy - py) / 220, -1, 1); } // glance at you
        else if (now >= nextGaze) pickGaze(now);                                                                  // else a slow look around
        gx += (tgx - gx) * 0.07; gy += (tgy - gy) * 0.07;
        if (curEl) {
          curEl.classList.toggle("aside", aside); // small & to the side only next to a hover card
          curEl.classList.toggle("big", big);     // grown into the profile avatar
          curEl.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px) translate(-50%,-50%)";
        }
        // the composer lives INSIDE the open card, pinned to its bottom (pure focus only)
        if (coreEl) {
          if (R.classList.contains("atl-focus") && !R.classList.contains("atl-journey")) {
            const r = panel.getBoundingClientRect();
            coreEl.style.left = r.left + "px"; coreEl.style.width = r.width + "px"; coreEl.style.top = (r.bottom - coreEl.offsetHeight) + "px";
          } else if (coreEl.style.left) { coreEl.style.left = ""; coreEl.style.top = ""; coreEl.style.width = ""; }
          if (!reduce && eL && eR) { eL.setAttribute("cx", (34 + gx * 6).toFixed(1)); eR.setAttribute("cx", (66 + gx * 6).toFixed(1)); eL.setAttribute("cy", (45 + gy * 6).toFixed(1)); eR.setAttribute("cy", (45 + gy * 6).toFixed(1)); }
        }
        craf = requestAnimationFrame(fr);
      };
      craf = requestAnimationFrame(fr); cleanups.push(() => cancelAnimationFrame(craf));
    }

    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { vw = R.clientWidth; vh = R.clientHeight; dirty = true; }, 120); };
    window.addEventListener("resize", onResize); cleanups.push(() => window.removeEventListener("resize", onResize));

    paintText(); updateStatus(); tickStatus(); setView("world"); apply(); loop();

    return () => {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      // wipe the imperative DOM so a re-mount rebuilds cleanly
      ground.querySelectorAll(".atl-blob,.atl-anchor,.atl-word,.atl-step,.atl-agent,.atl-drive,.atl-drive-arrow,.atl-ripple").forEach((e) => e.remove());
      baseLinks.innerHTML = "";
    };
  }, [lang]);

  return (
    <div className="atl-app" ref={appRef} dir={lang === "he" ? "rtl" : "ltr"} aria-label="Atlas">
      <div className="atl-ground">
        <div className="atl-grid" />
        <svg className="atl-links" width={7000} height={5000} viewBox="0 0 7000 5000" aria-hidden="true">
          <g className="atl-baselinks" />
          <path className="atl-route" />
          <circle className="atl-flow" r={5} />
          <circle className="atl-flow" r={5} />
          <circle className="atl-flow" r={5} />
        </svg>
      </div>
      <div className="atl-stars" aria-hidden="true" />
      <div className="atl-horizon" aria-hidden="true" />
      <div className="atl-floor" aria-hidden="true" />
      <div className="atl-lens" aria-hidden="true" />

      <div className="atl-topbar">
        <button className="atl-logo" aria-label="ONE01">
          <svg viewBox="0 0 128 32" height="19" fill="currentColor" aria-hidden="true">
            <path opacity="0.98" d="M64.8281 30.1769V2.43359H83.5224V7.26971H70.6938V13.8804H82.5606V18.7165H70.6938V25.3408H83.5765V30.1769H64.8281Z" />
            <path opacity="0.98" d="M59.2189 2.43359V30.1769H54.1525L42.0825 12.7154H41.8793V30.1769H36.0137V2.43359H41.1614L53.1365 19.8815H53.3804V2.43359H59.2189Z" />
            <path opacity="0.98" d="M30.9042 16.3057C30.9042 19.3311 30.3307 21.9049 29.1837 24.0272C28.0458 26.1495 26.4925 27.7706 24.5237 28.8904C22.564 30.0012 20.3604 30.5566 17.913 30.5566C15.4475 30.5566 13.2349 29.9967 11.2752 28.8769C9.31547 27.757 7.76665 26.1359 6.62874 24.0136C5.49083 21.8913 4.92188 19.322 4.92188 16.3057C4.92188 13.2803 5.49083 10.7064 6.62874 8.58413C7.76665 6.46183 9.31547 4.84528 11.2752 3.73446C13.2349 2.61461 15.4475 2.05469 17.913 2.05469C20.3604 2.05469 22.564 2.61461 24.5237 3.73446C26.4925 4.84528 28.0458 6.46183 29.1837 8.58413C30.3307 10.7064 30.9042 13.2803 30.9042 16.3057ZM24.9572 16.3057C24.9572 14.3459 24.6637 12.6932 24.0767 11.3476C23.4987 10.002 22.6814 8.98149 21.6248 8.2861C20.5681 7.59071 19.3309 7.24302 17.913 7.24302C16.4951 7.24302 15.2579 7.59071 14.2013 8.2861C13.1446 8.98149 12.3228 10.002 11.7358 11.3476C11.1578 12.6932 10.8688 14.3459 10.8688 16.3057C10.8688 18.2654 11.1578 19.9181 11.7358 21.2637C12.3228 22.6093 13.1446 23.6298 14.2013 24.3252C15.2579 25.0206 16.4951 25.3683 17.913 25.3683C19.3309 25.3683 20.5681 25.0206 21.6248 24.3252C22.6814 23.6298 23.4987 22.6093 24.0767 21.2637C24.6637 19.9181 24.9572 18.2654 24.9572 16.3057Z" />
            <path d="M30.9301 15.9805C30.9301 24.8063 24.0061 31.9611 15.465 31.9611C6.92393 31.9611 0 24.8063 0 15.9805C0 7.15473 6.92393 0 15.465 0C24.0061 0 30.9301 7.15473 30.9301 15.9805Z" />
            <path opacity="0.36" d="M127.487 2.42969V30.1765H121.62V7.99801H121.458L115.104 11.9812V6.77867L121.972 2.42969H127.487Z" />
            <path opacity="0.36" d="M100.097 30.7866C97.7668 30.7776 95.7617 30.204 94.0817 29.066C92.4107 27.9279 91.1237 26.2795 90.2204 24.1209C89.3263 21.9622 88.8837 19.3654 88.8927 16.3306C88.8927 13.3048 89.3398 10.7262 90.234 8.59458C91.1372 6.46299 92.4243 4.84172 94.0952 3.73076C95.7752 2.61078 97.7758 2.05078 100.097 2.05078C102.418 2.05078 104.414 2.61078 106.085 3.73076C107.765 4.85075 109.057 6.47654 109.96 8.60813C110.863 10.7307 111.311 13.3048 111.301 16.3306C111.301 19.3745 110.85 21.9757 109.947 24.1344C109.052 26.2931 107.77 27.9415 106.099 29.0795C104.428 30.2176 102.427 30.7866 100.097 30.7866ZM100.097 25.9228C101.687 25.9228 102.956 25.1234 103.904 23.5247C104.853 21.926 105.322 19.528 105.313 16.3306C105.313 14.2261 105.096 12.4739 104.663 11.0739C104.238 9.67392 103.633 8.62167 102.847 7.91717C102.071 7.21266 101.154 6.86041 100.097 6.86041C98.5165 6.86041 97.252 7.65072 96.3036 9.23135C95.3552 10.812 94.8765 13.1784 94.8675 16.3306C94.8675 18.4622 95.0797 20.2415 95.5043 21.6686C95.9378 23.0867 96.5475 24.1525 97.3333 24.866C98.1191 25.5705 99.0403 25.9228 100.097 25.9228Z" />
          </svg>
        </button>
        <div className="atl-toasts" />
        <span className="atl-view" role="group" aria-label="View">
          <button className="atl-vw atl-vw-world">{TXT[lang].world}</button>
          <button className="atl-vw atl-vw-mine">{TXT[lang].mine}</button>
        </span>
        <div className="atl-timepop">
          <span className="atl-time-ico" aria-hidden="true">☀️</span>
          <input className="atl-time-range" type="range" min={0} max={23} step={1} aria-label="Time of day" />
          <span className="atl-time-lbl" />
        </div>
      </div>

      <div className="atl-cursor" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="50" r="50" fill="var(--a-orb)" />
          <circle className="atl-cur-eye atl-cur-l" cx="34" cy="45" r="9" fill="var(--a-orbeye)" />
          <circle className="atl-cur-eye atl-cur-r" cx="66" cy="45" r="9" fill="var(--a-orbeye)" />
        </svg>
      </div>

      <div className="atl-core">
        <div className="atl-suggest" />
        <div className="atl-search">
          <button className="atl-plus" aria-label={lang === "he" ? "התחלה חדשה" : "Start fresh"}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input type="text" dir={lang === "he" ? "rtl" : "ltr"} autoComplete="off" spellCheck={false} placeholder={TXT[lang].ph} aria-label={TXT[lang].ph} />
          <button className="atl-clr">{TXT[lang].clr}</button>
          <button className="atl-voice" aria-label={lang === "he" ? "דברו עם ONE" : "Talk to ONE"}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" /></svg>
          </button>
        </div>
        <div className="atl-match" />
        <p className="atl-signin">{TXT[lang].signinPre} · <button className="atl-signin-link">{TXT[lang].signinLink}</button></p>
      </div>

      <div className="atl-priv">🔒 {TXT[lang].priv}</div>

      <div className="atl-botbar">
        <div className="atl-status">
          <button className="atl-status-main" aria-label="Date and time" />
          <span className="atl-status-live" />
        </div>
      </div>

      <div className="atl-tip" aria-hidden="true" />
      <div className="atl-scrim" aria-hidden="true" />

      <aside className="atl-panel" aria-hidden="true" aria-live="polite">
        <button className="atl-close" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="atl-body">
          <span className="atl-tag"><span className="atl-em" /><span className="atl-district" /></span>
          <h2 className="atl-title" />
          <div className="atl-nowrow"><span className="atl-now" /><span className="atl-nowlbl" /><span className="atl-trend" /></div>
          <div className="atl-stats"><div className="atl-stat"><div className="atl-v atl-done" /><div className="atl-k atl-donek" /></div><div className="atl-stat"><div className="atl-v atl-avg" /><div className="atl-k atl-avgk" /></div></div>
          <div className="atl-sec"><div className="atl-sech atl-pathh" /><ol className="atl-steps" /></div>
          <div className="atl-sec atl-providers"><div className="atl-sech atl-provh" /><div className="atl-provlist" /></div>
          <div className="atl-sec atl-related-sec"><div className="atl-sech atl-relh" /><div className="atl-relatedlist" /></div>
          <div className="atl-progress"><div className="atl-progress-top"><span className="atl-progress-lbl" /><span className="atl-progress-pct" /></div><div className="atl-progress-bar"><div className="atl-progress-fill" /></div></div>
          <button className="atl-cta" />
          <p className="atl-priv2" />
        </div>
        <div className="atl-custom" />
      </aside>

      <style>{ATLAS_CSS}</style>
    </div>
  );
}

const ATLAS_CSS = `
.atl-app{ position:fixed; inset:0; z-index:60; overflow:hidden; cursor:grab; touch-action:none;
  perspective:1200px; perspective-origin:50% 36%; background:var(--a-bg);
  user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent;
  /* Day palette (the map has its OWN day/night driven by the time scrubber,
     independent of the app theme). */
  --a-bg:#f5f4f0; --a-card:#ffffff; --a-ink:#0a0a0a; --a-ink2:#5b5850; --a-ink3:#938f85;
  --a-line:rgba(10,10,10,0.10); --a-line2:rgba(10,10,10,0.06); --a-live:#10b981;
  --a-orb:#0a0a0a; --a-orbeye:#f5f4f0;
  --a-shadow:0 10px 30px rgba(0,0,0,0.14); --a-shadowlift:0 22px 56px rgba(0,0,0,0.22);
  font-family:inherit; transition:background-color .9s ease; }
/* Night — deep blue, like a map after dark. */
.atl-app.atl-night{ --a-bg:#111722; --a-card:#1a2130; --a-ink:#eef2f8; --a-ink2:#aab4c4; --a-ink3:#6b7688;
  --a-line:rgba(255,255,255,0.13); --a-line2:color-mix(in srgb,#ffffff 7%,transparent); --a-live:#34d399;
  --a-orb:#eef2f8; --a-orbeye:#111722; --a-shadow:0 10px 30px rgba(0,0,0,0.5); --a-shadowlift:0 22px 56px rgba(0,0,0,0.62); }
.atl-search, .atl-panel, .atl-time, .atl-view, .atl-agent-lbl, .atl-prov, .atl-clr{ transition:background-color .9s ease, color .9s ease, border-color .9s ease; }
.atl-app.drag{ cursor:grabbing; }
.atl-search input{ cursor:text; }
.atl-plus, .atl-voice, .atl-clr, .atl-vw, .atl-cta, .atl-close, .atl-time-range, .atl-stepgo, .atl-agent, .atl-menu, .atl-logo, .atl-status-main, .atl-word, .atl-anchor{ cursor:pointer; }
/* the ONE companion — trails the pointer from a distance, never the cursor */
.atl-cursor{ position:fixed; left:0; top:0; z-index:71; pointer-events:auto; cursor:pointer; width:60px; height:60px; opacity:0.95; filter:drop-shadow(0 12px 24px rgba(10,10,10,0.30)); will-change:transform; transition:width .3s cubic-bezier(.2,.8,.2,1), height .3s cubic-bezier(.2,.8,.2,1); }
.atl-cursor.aside{ width:38px; height:38px; }
.atl-cursor.big{ width:72px; height:72px; opacity:1; filter:drop-shadow(0 14px 28px rgba(10,10,10,0.34)); }
.atl-cursor svg{ display:block; transition:transform .32s cubic-bezier(.2,.8,.2,1); }
.atl-cursor.react svg{ transform:scale(1.32); }
.atl-scrim{ position:absolute; inset:0; z-index:62; background:color-mix(in srgb, var(--a-bg) 52%, transparent); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); opacity:0; pointer-events:none; transition:opacity .34s; }
/* the ONE profile pulls all focus: the map dims deeply toward the sides behind the centred card */
.atl-app.atl-meopen .atl-scrim{ opacity:1; pointer-events:auto; background:radial-gradient(120% 120% at 50% 50%, color-mix(in srgb, var(--a-bg) 32%, transparent) 24%, color-mix(in srgb, var(--a-bg) 80%, transparent) 76%, var(--a-bg) 100%); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); }
/* dim disabled — the card sits to the side, map stays lit */
.atl-ground{ position:absolute; left:50%; top:50%; width:7000px; height:5000px; transform-origin:50% 50%; transform-style:preserve-3d; will-change:transform; }
.atl-grid{ position:absolute; inset:0; background:
  radial-gradient(circle, color-mix(in srgb, var(--a-line2) 62%, transparent) 0 1.5px, transparent 1.7px) 0 0 / 96px 96px,
  repeating-linear-gradient(0deg, var(--a-line2) 0 1.4px, transparent 1.4px 192px),
  repeating-linear-gradient(90deg, var(--a-line2) 0 1.4px, transparent 1.4px 192px),
  repeating-linear-gradient(0deg, color-mix(in srgb, var(--a-line2) 55%, transparent) 0 1px, transparent 1px 48px),
  repeating-linear-gradient(90deg, color-mix(in srgb, var(--a-line2) 55%, transparent) 0 1px, transparent 1px 48px),
  repeating-linear-gradient(45deg, color-mix(in srgb, var(--a-line2) 35%, transparent) 0 1px, transparent 1px 384px);
  -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 42%, transparent 76%); mask-image:radial-gradient(circle at 50% 50%, #000 42%, transparent 76%); }
.atl-blob{ position:absolute; border-radius:50%; filter:blur(55px); opacity:0.5; pointer-events:none; }
.atl-ripple{ position:absolute; transform:translate(-50%,-50%); border:2px solid var(--a-ink); border-radius:50%; pointer-events:none; animation:atlRipple 1.5s ease-out forwards; }
@keyframes atlRipple{ from{ width:10px; height:10px; opacity:0.55; } to{ width:160px; height:160px; opacity:0; } }
@media (prefers-reduced-motion: reduce){ .atl-ripple{ display:none; } }
.atl-flare{ position:absolute; transform:translate(-50%,-50%) translateZ(16px) rotateX(calc(var(--tilt,56deg) * -1)); pointer-events:none; font-size:12px; font-weight:800; color:#fff; background:var(--dc,#888); padding:3px 9px; border-radius:999px; white-space:nowrap; box-shadow:0 6px 15px rgba(10,10,10,0.32); font-variant-numeric:tabular-nums; opacity:0; animation:atlFlare 2.2s ease-out forwards; }
@keyframes atlFlare{ 0%{ opacity:0; } 14%{ opacity:1; } 68%{ opacity:1; } 100%{ opacity:0; } }
@media (prefers-reduced-motion: reduce){ .atl-flare{ display:none; } }
.atl-links{ position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.atl-link{ stroke:var(--a-line); stroke-width:1.4; fill:none; }
.atl-xlink{ stroke:var(--a-ink); opacity:0.10; stroke-width:1.6; fill:none; stroke-dasharray:3 12; animation:atlDash 4s linear infinite; }
.atl-route{ fill:none; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transition:opacity .4s; }
.atl-route.on{ opacity:0.9; stroke-dasharray:2 14; animation:atlDash 1.1s linear infinite; }
.atl-route.preview{ opacity:0.45; stroke-width:3; stroke-dasharray:1 12; animation:atlDash 2.4s linear infinite; }
@keyframes atlDash{ to{ stroke-dashoffset:-16; } }
/* waypoint pins along a route — location markers on your path */
.atl-wp{ position:absolute; width:11px; height:11px; transform:translate(-50%,-50%) translateZ(6px) rotateX(calc(var(--tilt,56deg) * -1)); pointer-events:none; opacity:0; animation:atlWpIn .45s ease forwards; animation-delay:calc(var(--i,1) * 80ms); }
.atl-wp::before{ content:""; position:absolute; inset:0; border-radius:50%; background:var(--dc,#888); box-shadow:0 0 0 3px color-mix(in srgb, var(--dc,#888) 20%, transparent), 0 2px 6px rgba(10,10,10,0.32); }
.atl-wp::after{ content:""; position:absolute; inset:-5px; border-radius:50%; border:1.5px solid var(--dc,#888); opacity:0; animation:atlWpPulse 2.6s ease-out infinite; animation-delay:calc(var(--i,1) * 80ms); }
@keyframes atlWpIn{ from{ opacity:0; } to{ opacity:1; } }
@keyframes atlWpPulse{ 0%{ transform:scale(.55); opacity:.6; } 100%{ transform:scale(1.7); opacity:0; } }
@media (prefers-reduced-motion: reduce){ .atl-wp{ animation:none; opacity:1; } .atl-wp::after{ animation:none; } }
.atl-flow{ opacity:0; }
.atl-topbar{ position:absolute; z-index:28; top:0; inset-inline:0; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 20px; pointer-events:none; }
.atl-topbar > *{ pointer-events:auto; }
.atl-botbar{ position:absolute; z-index:26; bottom:10px; inset-inline:0; display:flex; align-items:center; justify-content:center; padding:0 20px; pointer-events:none; }
.atl-botbar > *{ pointer-events:auto; }
.atl-status{ display:flex; align-items:center; gap:12px; min-width:0; overflow:hidden; }
.atl-status-main{ display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:700; color:var(--a-ink2); white-space:nowrap; background:none; border:0; padding:0; border-radius:8px; transition:color .2s; }
.atl-status-main:hover{ color:var(--a-ink); }
.atl-status-t{ color:var(--a-ink); font-weight:800; font-variant-numeric:tabular-nums; }
.atl-sdot{ width:3px; height:3px; border-radius:50%; background:var(--a-ink3); display:inline-block; margin:0 3px; }
.atl-si{ width:13px; height:13px; opacity:0.85; flex:none; }
.atl-timepop{ position:absolute; z-index:30; bottom:56px; left:50%; transform:translateX(-50%) translateY(6px); display:inline-flex; align-items:center; gap:10px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); border-radius:999px; padding:9px 15px; opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; }
.atl-timepop.show{ opacity:1; pointer-events:auto; transform:translateX(-50%) translateY(0); }
.atl-toasts{ position:absolute; z-index:29; top:52px; left:50%; pointer-events:none; }
.atl-toast{ position:absolute; top:0; left:50%; width:max-content; max-width:min(360px,80vw); pointer-events:auto; display:flex; align-items:center; gap:11px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); border-radius:14px; padding:9px 8px 9px 14px; transform:translate(-50%,0); transition:transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s; }
.atl-toast-ic{ color:var(--a-ink2); display:grid; place-items:center; flex:none; } .atl-toast-ic svg{ width:16px; height:16px; }
.atl-toast-b{ display:flex; flex-direction:column; min-width:0; } .atl-toast-b b{ font-size:12.5px; font-weight:700; color:var(--a-ink); } .atl-toast-b span{ font-size:11.5px; color:var(--a-ink3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atl-toast-x{ margin-inline-start:6px; background:none; border:0; color:var(--a-ink3); cursor:pointer; display:grid; place-items:center; padding:4px; border-radius:8px; flex:none; } .atl-toast-x:hover{ background:var(--a-line); } .atl-toast-x svg{ width:13px; height:13px; }
.atl-toast-gear{ margin-inline-start:2px; background:none; border:0; color:var(--a-ink3); cursor:pointer; display:grid; place-items:center; padding:4px; border-radius:8px; flex:none; opacity:0; transform:scale(.8); transition:opacity .2s, transform .2s, background .2s; } .atl-toast:hover .atl-toast-gear{ opacity:1; transform:scale(1); } .atl-toast-gear:hover{ background:var(--a-line); color:var(--a-ink2); } .atl-toast-gear svg{ width:13px; height:13px; }
.atl-toasts.pos-bottom{ top:auto; bottom:78px; }
/* toast settings — a small centred modal opened from any toast's gear */
.atl-tset{ position:absolute; inset:0; z-index:80; display:grid; place-items:center; padding:20px; background:color-mix(in srgb, var(--a-bg) 52%, transparent); opacity:0; pointer-events:none; transition:opacity .2s; }
.atl-tset.show{ opacity:1; pointer-events:auto; }
.atl-tset-card{ width:min(340px, calc(100vw - 40px)); background:var(--a-card); border:1px solid var(--a-line); border-radius:20px; box-shadow:var(--a-shadowlift); padding:18px 20px 20px; transform:translateY(14px) scale(.97); transition:transform .28s cubic-bezier(.2,.9,.25,1); }
.atl-tset.show .atl-tset-card{ transform:translateY(0) scale(1); }
.atl-tset-head{ display:flex; align-items:center; justify-content:space-between; }
.atl-tset-head b{ font-size:16px; font-weight:800; letter-spacing:-0.01em; color:var(--a-ink); }
.atl-tset-x{ background:var(--a-bg); border:1px solid var(--a-line); width:30px; height:30px; border-radius:50%; display:grid; place-items:center; cursor:pointer; color:var(--a-ink2); flex:none; } .atl-tset-x svg{ width:13px; height:13px; }
.atl-tset-lbl{ font-size:10.5px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--a-ink3); margin:16px 0 9px; } [dir="rtl"] .atl-tset-lbl{ letter-spacing:0.03em; }
.atl-tset-seg{ display:flex; gap:5px; background:var(--a-line); border-radius:12px; padding:4px; }
.atl-tset-seg button{ flex:1; height:34px; border:0; background:none; border-radius:9px; font:inherit; font-size:13px; font-weight:700; color:var(--a-ink3); cursor:pointer; transition:color .2s; }
.atl-tset-seg button.on{ background:var(--a-card); color:var(--a-ink); box-shadow:var(--a-shadow); }
.atl-tset-row{ display:flex; align-items:center; justify-content:space-between; padding:9px 2px; font-size:13.5px; font-weight:600; color:var(--a-ink); }
.atl-tset-sw{ width:42px; height:24px; border-radius:999px; border:0; background:var(--a-line); cursor:pointer; position:relative; flex:none; transition:background .2s; }
.atl-tset-sw::after{ content:""; position:absolute; top:3px; inset-inline-start:3px; width:18px; height:18px; border-radius:50%; background:var(--a-card); box-shadow:var(--a-shadow); transition:transform .2s; }
.atl-tset-sw.on{ background:var(--a-live); }
.atl-tset-sw.on::after{ transform:translateX(18px); } [dir="rtl"] .atl-tset-sw.on::after{ transform:translateX(-18px); }
.atl-logo{ flex:none; background:none; border:0; padding:0; color:var(--a-ink); display:grid; place-items:center; }
.atl-status-live{ font-size:12.5px; font-weight:500; color:var(--a-ink2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.atl-menu{ flex:none; width:38px; height:38px; border-radius:50%; border:1px solid var(--a-line); background:var(--a-card); box-shadow:var(--a-shadow); display:grid; place-items:center; cursor:pointer; padding:0; }
.atl-view{ display:inline-flex; flex:none; background:var(--a-card); border:1px solid var(--a-line); border-radius:999px; box-shadow:var(--a-shadow); overflow:hidden; }
.atl-vw{ border:0; background:none; cursor:pointer; font:inherit; font-size:12.5px; font-weight:700; letter-spacing:0.02em; color:var(--a-ink3); padding:7px 16px; }
.atl-vw.on{ background:var(--a-ink); color:var(--a-bg); }
.atl-anchor{ position:absolute; transform:translate(-50%,-50%) translateZ(46px) rotateX(calc(var(--tilt,56deg) * -1)); display:flex; flex-direction:column; align-items:center; gap:6px; background:none; border:0; cursor:pointer; padding:6px; transition:opacity .35s; }
.atl-emoji{ font-size:46px; line-height:1; filter:drop-shadow(0 12px 16px rgba(10,10,10,0.30)); }
.atl-alabel{ font-size:12px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:var(--a-ink2); white-space:nowrap; }
[dir="rtl"] .atl-alabel{ letter-spacing:0.03em; font-weight:800; }
.atl-astat{ font-size:10.5px; font-weight:700; color:var(--a-ink3); font-variant-numeric:tabular-nums; background:var(--a-card); border:1px solid var(--a-line); border-radius:999px; padding:1px 8px; box-shadow:var(--a-shadow); }
.atl-asum{ position:absolute; bottom:100%; left:50%; margin-bottom:9px; transform:translate(-50%,-4px) scale(.96); white-space:nowrap; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); border-radius:12px; padding:7px 13px; font-size:11.5px; font-weight:600; color:var(--a-ink2); opacity:0; pointer-events:none; transition:opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1); z-index:5; }
.atl-asum b{ color:var(--a-ink); font-weight:800; font-variant-numeric:tabular-nums; }
.atl-asum-up{ color:var(--a-live); font-weight:700; }
.atl-anchor:hover .atl-asum{ opacity:1; transform:translate(-50%,0) scale(1); }
.atl-anchor.dim{ opacity:0.18; }
.atl-word{ position:absolute; transform:translate(-50%,-50%) translateZ(28px) rotateX(calc(var(--tilt,56deg) * -1)); background:none; border:0; padding:5px 6px; cursor:pointer; color:var(--a-ink); transition:opacity .4s; }
.atl-float{ display:inline-block; animation:atlFloat var(--fd,7s) ease-in-out infinite; animation-delay:var(--fdl,0s); }
.atl-inner{ display:inline-block; transition:transform .2s cubic-bezier(.2,.7,.2,1),color .2s; letter-spacing:-0.015em; line-height:1.05; text-shadow:0 1px 12px var(--a-bg); }
.atl-count{ display:block; text-align:center; font-size:11px; color:var(--a-ink3); opacity:0; margin-top:3px; font-variant-numeric:tabular-nums; transition:opacity .2s; font-weight:600; }
.atl-word:hover{ z-index:6; } .atl-word:hover .atl-inner, .atl-word:focus-visible .atl-inner{ transform:scale(1.16); }
.atl-word:focus-visible{ outline:none; } .atl-word:hover .atl-count, .atl-word.sel .atl-count{ opacity:1; }
.atl-word.dim{ opacity:0.1; } .atl-word.lod{ opacity:0; pointer-events:none; }
.atl-word.sel .atl-inner{ font-weight:800; text-decoration:underline; text-underline-offset:6px; text-decoration-thickness:3px; text-decoration-color:var(--dc); }
.atl-word.mine .atl-inner{ text-decoration:underline; text-decoration-color:var(--a-live); text-underline-offset:5px; text-decoration-thickness:2px; }
.atl-word.mine .atl-inner::before{ content:"\\25CF  "; color:var(--a-live); font-size:0.6em; vertical-align:middle; }
@keyframes atlFloat{ 0%,100%{ transform:translateY(-4px);} 50%{ transform:translateY(4px);} }
.atl-step{ position:absolute; transform:translate(-50%,-50%) translateZ(40px) rotateX(calc(var(--tilt,56deg) * -1)) scale(.7); opacity:0; transition:opacity .35s, transform .35s cubic-bezier(.2,.8,.2,1); pointer-events:none; }
.atl-step.on{ opacity:1; transform:translate(-50%,-50%) translateZ(40px) rotateX(calc(var(--tilt,56deg) * -1)) scale(1); }
.atl-stepin{ display:inline-flex; align-items:center; gap:8px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadow); border-radius:999px; padding:6px 13px 6px 7px; max-width:230px; }
[dir="rtl"] .atl-stepin{ padding:6px 7px 6px 13px; }
.atl-stepn{ width:20px; height:20px; border-radius:50%; background:var(--dc,var(--a-ink)); color:#fff; font-size:11px; font-weight:700; display:grid; place-items:center; flex:none; }
.atl-stept{ font-size:12.5px; font-weight:600; color:var(--a-ink); line-height:1.15; }
.atl-stars{ position:absolute; inset:0; z-index:1; pointer-events:none; opacity:0; transition:opacity 1.2s ease; background-image:
  radial-gradient(1.2px 1.2px at 15% 25%, rgba(255,255,255,.85), transparent 60%), radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,.6), transparent 60%),
  radial-gradient(1.4px 1.4px at 42% 72%, rgba(255,255,255,.75), transparent 60%), radial-gradient(1px 1px at 86% 82%, rgba(255,255,255,.5), transparent 60%),
  radial-gradient(1px 1px at 26% 88%, rgba(255,255,255,.6), transparent 60%), radial-gradient(1.2px 1.2px at 62% 14%, rgba(255,255,255,.7), transparent 60%),
  radial-gradient(1px 1px at 8% 60%, rgba(255,255,255,.5), transparent 60%), radial-gradient(1px 1px at 92% 30%, rgba(255,255,255,.55), transparent 60%);
  background-size:320px 320px; }
.atl-app.atl-night .atl-stars{ opacity:0.55; }
.atl-horizon{ position:absolute; inset:0 0 auto 0; height:42%; z-index:11; pointer-events:none; background:linear-gradient(var(--a-bg) 12%, rgba(0,0,0,0) 100%); }
.atl-floor{ position:absolute; inset:auto 0 0 0; height:30%; z-index:11; pointer-events:none; background:linear-gradient(rgba(0,0,0,0) 0%, var(--a-bg) 94%); }
/* soft lens vignette — the map fades cleanly toward every edge (sides too), like looking through glass */
.atl-lens{ position:absolute; inset:0; z-index:12; pointer-events:none; background:
  linear-gradient(to right, var(--a-bg) 0%, rgba(0,0,0,0) 17%, rgba(0,0,0,0) 83%, var(--a-bg) 100%),
  radial-gradient(102% 108% at 50% 45%, rgba(0,0,0,0) 40%, color-mix(in srgb, var(--a-bg) 55%, transparent) 74%, var(--a-bg) 100%); }
.atl-ticker{ position:absolute; z-index:29; top:18px; left:50%; transform:translateX(-50%); width:min(42vw,520px); height:32px; overflow:hidden; -webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); }
.atl-track{ position:absolute; top:0; inset-inline-start:0; display:inline-flex; align-items:center; gap:30px; white-space:nowrap; height:32px; animation:atlCrawl 56s linear infinite; will-change:transform; }
[dir="rtl"] .atl-track{ animation-name:atlCrawlR; }
.atl-ti{ display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:var(--a-ink2); }
.atl-tiem{ font-size:14px; } .atl-ti b{ color:var(--a-ink); font-weight:700; font-variant-numeric:tabular-nums; } .atl-tidot{ width:6px; height:6px; border-radius:50%; background:var(--a-live); }
@keyframes atlCrawl{ from{transform:translateX(0);} to{transform:translateX(-50%);} }
@keyframes atlCrawlR{ from{transform:translateX(-50%);} to{transform:translateX(0);} }
.atl-core{ position:absolute; z-index:26; left:50%; top:47%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:12px; width:min(440px,86vw); }
.atl-orb{ width:86px; height:86px; padding:0; border:0; background:none; cursor:pointer; filter:drop-shadow(0 16px 34px rgba(10,10,10,0.28)); }
.atl-blink{ animation:atlBlink 5.6s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
@keyframes atlBlink{ 0%,92%,100%{transform:scaleY(1);} 96%{transform:scaleY(0.12);} }
.atl-search{ width:100%; direction:ltr; display:flex; align-items:center; gap:8px; height:58px; padding:0 8px; border-radius:999px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); }
.atl-signin{ margin:0; font-size:13px; color:var(--a-ink3); text-align:center; }
.atl-signin-link{ background:none; border:0; padding:0; color:var(--a-ink); font:inherit; font-weight:700; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.atl-search input{ flex:1; min-width:0; border:none !important; outline:none !important; box-shadow:none !important; -webkit-appearance:none; appearance:none; background:transparent; font:inherit; font-size:16px; color:var(--a-ink); padding:0 6px; user-select:text; -webkit-user-select:text; }
.atl-search input:focus{ outline:none !important; box-shadow:none !important; border:none !important; }
.atl-search input::placeholder{ color:var(--a-ink3); }
.atl-plus{ flex:none; width:42px; height:42px; border-radius:50%; border:0; background:transparent; color:var(--a-ink2); cursor:pointer; display:grid; place-items:center; transition:background .2s; }
.atl-plus:hover{ background:var(--a-line); }
.atl-voice{ flex:none; width:44px; height:44px; border-radius:50%; border:0; background:var(--a-orb); color:var(--a-orbeye); cursor:pointer; display:grid; place-items:center; transition:transform .15s; }
.atl-voice:hover{ transform:scale(1.06); }
.atl-voice.on{ background:var(--a-live); }
.atl-clr{ flex:none; border:0; background:var(--a-line); color:var(--a-ink2); cursor:pointer; font:inherit; font-size:12px; font-weight:600; height:38px; padding:0 13px; border-radius:999px; opacity:0; width:0; padding-inline:0; overflow:hidden; transition:opacity .2s; }
.atl-clr.show{ opacity:1; width:auto; padding-inline:13px; }
.atl-match{ font-size:12.5px; color:var(--a-ink3); font-weight:600; height:16px; text-align:center; }
.atl-suggest{ position:absolute; bottom:calc(100% + 12px); left:50%; transform:translateX(-50%); width:min(440px,86vw); max-height:280px; overflow-y:auto; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); border-radius:16px; padding:6px; display:none; }
.atl-suggest.show{ display:block; }
.atl-sug{ display:flex; align-items:center; gap:10px; width:100%; text-align:start; background:none; border:0; border-radius:11px; padding:9px 12px; font:inherit; cursor:pointer; color:var(--a-ink); }
.atl-sug:hover{ background:var(--a-line); }
.atl-sug-em{ font-size:16px; } .atl-sug-name{ flex:1; font-size:14px; font-weight:600; } .atl-sug-n{ font-size:12px; color:var(--a-ink3); font-variant-numeric:tabular-nums; }
.atl-sug-new .atl-sug-em{ color:var(--a-live); font-weight:800; } .atl-sug-new .atl-sug-name{ font-weight:700; }
.atl-priv{ position:absolute; z-index:26; bottom:16px; inset-inline-start:20px; display:inline-flex; align-items:center; gap:7px; font-size:11.5px; color:var(--a-ink3); font-weight:600; pointer-events:none; }
.atl-time{ flex:none; display:inline-flex; align-items:center; gap:9px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadow); border-radius:999px; height:38px; padding:0 14px; }
.atl-time-ico{ font-size:15px; line-height:1; }
.atl-time-range{ width:180px; accent-color:var(--a-ink); cursor:pointer; }
.atl-time-lbl{ font-size:12.5px; font-weight:700; color:var(--a-ink2); font-variant-numeric:tabular-nums; min-width:44px; text-align:center; }
.atl-word.gen .atl-inner{ text-decoration:underline dotted; text-decoration-color:var(--a-ink3); text-underline-offset:5px; }
.atl-panel{ position:absolute; z-index:64; top:50%; inset-inline-start:20px; width:min(380px,calc(100vw - 40px)); max-height:calc(100dvh - 48px); background:var(--a-card); border:1px solid var(--a-line); border-radius:22px; box-shadow:var(--a-shadowlift); display:flex; flex-direction:column; padding:18px 22px 22px; overflow-y:auto; opacity:0; transform:translateY(calc(-50% - 8px)) scale(.98); transform-origin:center; pointer-events:none; transition:opacity .3s, transform .3s cubic-bezier(.2,.8,.2,1); user-select:text; -webkit-user-select:text; }
.atl-panel.open{ opacity:1; transform:translateY(-50%) scale(1); pointer-events:auto; }
.atl-panel.center{ inset-inline-start:50%; inset-inline-end:auto; width:min(440px,calc(100vw - 40px)); transform:translate(-50%,calc(-50% + 38px)) scale(.96); transition:opacity .32s, transform .42s cubic-bezier(.2,.9,.25,1); }
.atl-panel.center.open{ transform:translate(-50%,-50%) scale(1); }
.atl-close{ align-self:flex-end; border:1px solid var(--a-line); background:var(--a-bg); width:32px; height:32px; border-radius:50%; cursor:pointer; color:var(--a-ink2); display:grid; place-items:center; flex:none; }
.atl-tag{ display:inline-flex; align-items:center; gap:8px; align-self:flex-start; margin-top:4px; padding:5px 12px; border-radius:999px; background:var(--a-line); font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--a-ink2); }
[dir="rtl"] .atl-tag{ letter-spacing:0.02em; } .atl-em{ font-size:14px; }
.atl-title{ font-weight:800; font-size:25px; line-height:1.08; letter-spacing:-0.025em; margin:12px 0 0; text-wrap:balance; color:var(--a-ink); }
.atl-nowrow{ display:flex; align-items:baseline; gap:8px; margin-top:10px; flex-wrap:wrap; }
.atl-now{ font-weight:800; font-size:30px; letter-spacing:-0.03em; font-variant-numeric:tabular-nums; color:var(--a-ink); }
.atl-nowlbl{ font-size:12.5px; color:var(--a-ink3); font-weight:500; } .atl-trend{ color:var(--a-live); font-weight:700; font-size:13px; }
.atl-stats{ display:flex; gap:9px; margin-top:16px; }
.atl-stat{ flex:1; background:var(--a-line); border-radius:13px; padding:11px 13px; }
.atl-v{ font-weight:700; font-size:17px; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; color:var(--a-ink); } .atl-k{ font-size:11px; color:var(--a-ink3); margin-top:3px; }
.atl-sec{ margin-top:20px; } .atl-sech{ font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--a-ink3); margin-bottom:13px; }
[dir="rtl"] .atl-sech{ letter-spacing:0.03em; }
.atl-steps{ list-style:none; margin:0; padding:0; } .atl-steps li{ position:relative; padding-inline-start:32px; padding-bottom:14px; } .atl-steps li:last-child{ padding-bottom:0; }
.atl-steps li::before{ content:attr(data-n); position:absolute; inset-inline-start:0; top:-1px; width:21px; height:21px; border-radius:50%; background:var(--a-ink); color:var(--a-bg); font-size:11px; font-weight:700; display:grid; place-items:center; font-variant-numeric:tabular-nums; }
.atl-steps li:not(:last-child)::after{ content:""; position:absolute; inset-inline-start:10px; top:23px; bottom:3px; width:1px; background:var(--a-line); }
.atl-stxt{ font-size:13.5px; line-height:1.4; padding-top:1px; color:var(--a-ink); }
.atl-steps li.done::before{ content:"✓"; background:var(--a-live); }
.atl-steps li.current::before{ background:var(--a-ink); box-shadow:0 0 0 4px color-mix(in srgb, var(--a-ink) 14%, transparent); }
.atl-steps li.todo{ opacity:0.5; } .atl-steps li.todo::before{ background:var(--a-ink3); }
.atl-onetag{ display:inline-block; font-size:10px; font-weight:800; letter-spacing:0.06em; color:#fff; background:var(--a-ink); border-radius:5px; padding:1px 5px; margin-inline-end:6px; vertical-align:middle; }
.atl-stepact{ display:flex; gap:7px; margin-top:9px; }
.atl-stepq{ flex:1; min-width:0; height:38px; border:1px solid var(--a-line); border-radius:10px; background:var(--a-bg); color:var(--a-ink); font:inherit; font-size:13px; padding:0 11px; outline:none; }
.atl-stepgo{ flex:none; height:38px; border:0; border-radius:10px; background:var(--a-ink); color:var(--a-bg); font:inherit; font-size:13px; font-weight:700; padding:0 15px; cursor:pointer; }
.atl-tip{ position:fixed; z-index:70; transform:translate(-50%,-100%); width:250px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); border-radius:16px; padding:13px 15px; pointer-events:none; opacity:0; transition:opacity .15s; display:flex; flex-direction:column; gap:4px; }
.atl-tip.show{ opacity:1; }
.atl-tip.below{ transform:translate(-50%,0); }
.atl-tip-top{ display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--a-ink3); }
[dir="rtl"] .atl-tip-top{ letter-spacing:0.02em; }
.atl-tip-em{ font-size:14px; }
.atl-tip-title{ font-weight:800; font-size:17px; letter-spacing:-0.02em; color:var(--a-ink); line-height:1.1; margin-top:2px; }
.atl-tip-now{ font-size:12.5px; color:var(--a-ink2); margin-top:3px; } .atl-tip-now b{ color:var(--a-ink); font-weight:800; font-variant-numeric:tabular-nums; } .atl-tip-trend{ color:var(--a-live); font-weight:700; }
.atl-tip-star{ color:var(--a-ink); font-weight:800; font-variant-numeric:tabular-nums; }
.atl-tip-onelbl{ display:inline-block; font-size:9px; font-weight:800; letter-spacing:0.06em; color:#fff; background:var(--a-ink); border-radius:5px; padding:1px 5px; vertical-align:middle; margin-inline-start:4px; }
.atl-tip-stats{ display:flex; gap:14px; margin-top:6px; font-size:11px; color:var(--a-ink3); } .atl-tip-stats b{ color:var(--a-ink2); font-weight:700; }
.atl-tip-needs{ display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
.atl-tip-need{ font-size:11px; font-weight:600; color:var(--a-ink2); background:var(--a-line); border-radius:999px; padding:3px 9px; }
.atl-tip-hint{ margin-top:10px; font-size:11px; font-weight:700; color:var(--a-ink); opacity:0.7; }
/* custom card (provider profile / world index) */
.atl-custom{ display:none; }
.atl-panel.is-custom .atl-body{ display:none; }
.atl-panel.is-custom .atl-custom{ display:block; }
.atl-pv-head{ display:flex; align-items:center; gap:12px; margin-top:4px; }
.atl-pv-face{ position:relative; width:52px; height:52px; flex:none; filter:drop-shadow(0 8px 16px rgba(10,10,10,0.28)); }
.atl-pv-em{ position:absolute; inset-inline-end:-6px; bottom:-4px; font-size:18px; }
.atl-idx-em{ font-size:40px; flex:none; }
.atl-pv-name{ font-weight:800; font-size:19px; letter-spacing:-0.02em; color:var(--a-ink); }
.atl-pv-sub{ font-size:12.5px; color:var(--a-ink3); margin-top:2px; }
.atl-pv-stats{ display:flex; gap:9px; margin-top:18px; }
.atl-pv-stats > div{ flex:1; background:var(--a-line); border-radius:13px; padding:12px 10px; text-align:center; }
.atl-pv-stats b{ display:block; font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; }
.atl-pv-stats span{ font-size:10.5px; color:var(--a-ink3); }
.atl-idx-trend{ margin-inline-start:auto; color:var(--a-live); font-weight:700; font-size:13px; }
.atl-idx-big{ font-weight:800; font-size:44px; letter-spacing:-0.03em; font-variant-numeric:tabular-nums; margin-top:12px; color:var(--a-ink); }
.atl-idx-chtop{ display:flex; align-items:baseline; justify-content:space-between; margin-top:14px; }
.atl-idx-chtop > span:first-child{ font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--a-ink3); }
[dir="rtl"] .atl-idx-chtop > span:first-child{ letter-spacing:0.02em; }
.atl-idx-chd{ font-size:13px; font-weight:700; color:var(--a-live); font-variant-numeric:tabular-nums; }
.atl-idx-chd.dn{ color:var(--a-ink3); }
.atl-idx-chart{ margin-top:8px; border-radius:12px; background:color-mix(in srgb, var(--dc,var(--a-ink)) 6%, var(--a-line)); padding:6px 4px 0; overflow:hidden; }
.atl-idx-chart svg{ display:block; }
.atl-idx-metrics{ display:flex; gap:9px; margin-top:14px; }
.atl-idx-metrics > div{ flex:1; background:var(--a-line); border-radius:13px; padding:12px 10px; }
.atl-idx-metrics b{ font-size:17px; font-weight:700; font-variant-numeric:tabular-nums; }
.atl-idx-metrics span{ display:block; font-size:11px; color:var(--a-ink3); margin-top:2px; }
.atl-idx-row{ position:relative; display:flex; align-items:center; gap:8px; padding:9px 10px; margin-top:6px; border-radius:9px; overflow:hidden; font-size:13px; }
.atl-idx-bar{ position:absolute; inset-inline-start:0; top:0; bottom:0; background:color-mix(in srgb, var(--dc, var(--a-ink)) 20%, transparent); z-index:0; }
.atl-idx-name{ position:relative; z-index:1; flex:1; color:var(--a-ink); font-weight:600; }
.atl-idx-v{ position:relative; z-index:1; color:var(--a-ink2); font-weight:700; font-variant-numeric:tabular-nums; }
.atl-idx-cta, .atl-pv-cta{ margin-top:20px; }
.atl-me{ display:flex; flex-direction:column; align-items:center; text-align:center; }
.atl-me-facegap{ width:72px; height:72px; margin-top:4px; flex:none; } /* the real companion rises to fill this slot */
.atl-me-name{ font-weight:800; font-size:22px; letter-spacing:-0.02em; color:var(--a-ink); margin-top:12px; }
.atl-me-sub{ font-size:13px; color:var(--a-ink3); margin-top:3px; }
.atl-me .atl-sech{ align-self:flex-start; }
.atl-me-stats{ display:flex; gap:9px; width:100%; margin-top:18px; }
.atl-me-stats > div{ flex:1; background:var(--a-line); border-radius:14px; padding:13px 8px; }
.atl-me-stats b{ display:block; font-size:21px; font-weight:800; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; color:var(--a-ink); }
.atl-me-stats span{ display:block; font-size:10.5px; color:var(--a-ink3); margin-top:3px; }
.atl-me-list{ width:100%; display:flex; flex-direction:column; gap:7px; }
.atl-me-item{ display:flex; align-items:center; gap:11px; width:100%; text-align:start; background:var(--a-line); border:0; border-radius:12px; padding:10px 13px; font:inherit; color:var(--a-ink); cursor:pointer; transition:transform .15s; }
.atl-me-item:hover{ transform:translateX(2px); } [dir="rtl"] .atl-me-item:hover{ transform:translateX(-2px); }
.atl-me-em{ font-size:16px; flex:none; }
.atl-me-it-b{ flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
.atl-me-it-name{ font-size:13.5px; font-weight:600; color:var(--a-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.atl-me-bar{ height:4px; border-radius:999px; background:color-mix(in srgb, var(--a-ink) 12%, transparent); overflow:hidden; }
.atl-me-bar > span{ display:block; height:100%; border-radius:999px; background:var(--a-live); }
.atl-me-it-n{ flex:none; font-size:12px; font-weight:700; color:var(--a-ink2); font-variant-numeric:tabular-nums; }
.atl-me-worlds{ display:flex; flex-wrap:wrap; gap:7px; width:100%; }
.atl-me-world{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--a-ink2); background:var(--a-line); border-radius:999px; padding:6px 12px; }
.atl-me-world span{ font-size:14px; }
.atl-me-manage{ margin-top:18px; }
/* my space (Mine): clear the world, keep only my things */
.atl-app.view-mine .atl-anchor, .atl-app.view-mine .atl-agent, .atl-app.view-mine .atl-xlink, .atl-app.view-mine .atl-link, .atl-app.view-mine .atl-blob{ opacity:0 !important; pointer-events:none; }
/* the ONE breathes — a gentle free float */
.atl-orb{ animation:atlOrbBob 6.5s ease-in-out infinite; }
@keyframes atlOrbBob{ 0%,100%{ transform:translateY(-3px); } 50%{ transform:translateY(4px); } }
.atl-cta{ margin-top:22px; width:100%; height:50px; border:0; border-radius:999px; background:var(--a-ink); color:var(--a-bg); cursor:pointer; font:inherit; font-size:15px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:9px; transition:transform .15s,background .3s; }
.atl-cta:hover{ transform:translateY(-2px); } .atl-cta.done{ background:var(--a-live); color:#fff; }
.atl-priv2{ margin-top:14px; font-size:11px; line-height:1.45; color:var(--a-ink3); text-align:center; }
/* other ONEs on the map (businesses / pros) */
.atl-agent{ position:absolute; transform:translate(-50%,-50%) translateZ(30px) rotateX(calc(var(--tilt,56deg) * -1)); display:flex; flex-direction:column; align-items:center; gap:5px; pointer-events:auto; cursor:pointer; transition:opacity .35s, transform .2s; background:none; border:0; }
.atl-agent:hover{ transform:translate(-50%,-50%) translateZ(30px) rotateX(calc(var(--tilt,56deg) * -1)) scale(1.08); }
.atl-agent-face{ position:relative; width:34px; height:34px; display:block; filter:drop-shadow(0 6px 12px rgba(10,10,10,0.28)); transition:width .25s, height .25s; }
.atl-agent-em{ position:absolute; inset-inline-end:-6px; bottom:-4px; font-size:15px; line-height:1; transition:opacity .25s; }
.atl-agent-lbl{ font-size:10.5px; font-weight:700; color:var(--a-ink2); white-space:nowrap; background:var(--a-card); border:1px solid var(--a-line); border-radius:999px; padding:2px 8px; box-shadow:var(--a-shadow); transition:opacity .25s; }
/* zoomed-out / unfocused: other ONEs are just small living dots. Full faces
   appear only on deep zoom (.atl-zoomed) or as a want's providers (.provider). */
.atl-app:not(.atl-zoomed) .atl-agent:not(.provider) .atl-agent-face{ width:11px; height:11px; animation:atlDot 3.4s ease-in-out infinite; }
.atl-app:not(.atl-zoomed) .atl-agent:not(.provider) .atl-agent-lbl,
.atl-app:not(.atl-zoomed) .atl-agent:not(.provider) .atl-agent-em{ opacity:0; }
@keyframes atlDot{ 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.4); } }
.atl-app.view-mine .atl-agent{ opacity:0.14; }
/* ONE driving the route like a Waze arrow */
.atl-drive{ position:absolute; transform:translate(-50%,-50%) translateZ(64px) rotateX(calc(var(--tilt,56deg) * -1)); width:58px; height:58px; pointer-events:none; filter:drop-shadow(0 14px 26px rgba(10,10,10,0.36)); }
.atl-drive-arrow{ position:absolute; transform:translate(-50%,-50%) rotate(calc(var(--hd,0deg) + 90deg)); width:0; height:0; pointer-events:none; border-left:15px solid transparent; border-right:15px solid transparent; border-bottom:26px solid var(--a-live); opacity:0.9; }
.atl-plink{ stroke-width:3; fill:none; opacity:0.5; stroke-dasharray:4 9; }
/* process profile — providers + progress in the card */
.atl-providers{ display:block; margin-top:20px; }
.atl-provlist{ display:flex; flex-wrap:wrap; gap:7px; }
.atl-relatedlist{ display:flex; flex-wrap:wrap; gap:7px; }
.atl-rel{ display:inline-flex; align-items:center; gap:6px; background:none; border:1px solid var(--a-line); border-radius:999px; padding:6px 12px; font:inherit; font-size:12.5px; font-weight:600; color:var(--a-ink2); cursor:pointer; transition:background .2s,color .2s; }
.atl-rel:hover{ background:var(--a-line); color:var(--a-ink); }
.atl-rel-em{ font-size:14px; }
.atl-app.atl-zoomed .atl-word .atl-count{ opacity:0.65; }
.atl-prov{ display:inline-flex; align-items:center; gap:6px; background:var(--a-line); border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:600; color:var(--a-ink); }
.atl-prov-em{ font-size:14px; }
.atl-progress{ display:none; margin-top:20px; }
.atl-progress-top{ display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:var(--a-ink3); margin-bottom:7px; }
.atl-progress-bar{ height:7px; border-radius:999px; background:var(--a-line); overflow:hidden; }
.atl-progress-fill{ height:100%; width:0; background:var(--a-live); border-radius:999px; transition:width .3s linear; }
/* journey mode: clear the field, drop the input, expand the card */
.atl-app.atl-journey .atl-progress{ display:block; }
.atl-app.atl-journey .atl-orb{ display:none; }
.atl-app.atl-journey .atl-core{ top:auto; bottom:58px; left:auto; inset-inline-start:20px; transform:none; width:min(456px, calc(100vw - 40px)); align-items:stretch; gap:10px; } /* composer docks to the card's side column during a journey */
/* pure focus: the composer lives INSIDE the card, pinned to its bottom (position set per-frame in JS) */
.atl-app.atl-focus:not(.atl-journey) .atl-core{ position:fixed; z-index:66; top:0; left:0; transform:none; box-sizing:border-box; align-items:stretch; gap:8px; padding:16px 20px 18px; background:linear-gradient(to top, var(--a-card) 68%, color-mix(in srgb, var(--a-card) 0%, transparent)); border-radius:0 0 22px 22px; }
.atl-app.atl-focus:not(.atl-journey) .atl-signin, .atl-app.atl-focus:not(.atl-journey) .atl-match, .atl-app.atl-focus:not(.atl-journey) .atl-suggest{ display:none; } /* keep the in-card composer minimal — just the input */
.atl-app.atl-focus:not(.atl-journey) .atl-cta{ display:none; } /* the input is the call to action now, not a Start button */
.atl-app.atl-focus:not(.atl-journey) .atl-panel{ padding-bottom:94px; } /* reserve room so content scrolls above the in-card input */
.atl-app.atl-journey .atl-ticker, .atl-app.atl-journey .atl-view, .atl-app.atl-journey .atl-time{ opacity:0; pointer-events:none; }
.atl-app.atl-journey .atl-word:not(.sel), .atl-app.atl-journey .atl-anchor, .atl-app.atl-journey .atl-agent:not(.provider), .atl-app.atl-journey .atl-xlink, .atl-app.atl-journey .atl-link, .atl-app.atl-journey .atl-blob{ opacity:0 !important; pointer-events:none; }
/* focus (a click drills into the topic): the rest of the field recedes, leaving
   the want + its needs. Lighter than a journey — the world is still faintly there. */
.atl-app.atl-focus .atl-word:not(.sel), .atl-app.atl-focus .atl-anchor, .atl-app.atl-focus .atl-agent:not(.provider), .atl-app.atl-focus .atl-xlink, .atl-app.atl-focus .atl-link, .atl-app.atl-focus .atl-blob{ opacity:0.06 !important; pointer-events:none; transition:opacity .45s ease; }
/* compose: typing clears the map; only what relates to your words lights up */
.atl-app.atl-compose .atl-word{ opacity:0.05; transition:opacity .35s ease; }
.atl-app.atl-compose .atl-word.match{ opacity:1 !important; pointer-events:auto; }
.atl-app.atl-compose .atl-anchor, .atl-app.atl-compose .atl-agent, .atl-app.atl-compose .atl-blob, .atl-app.atl-compose .atl-xlink, .atl-app.atl-compose .atl-link{ opacity:0.04 !important; pointer-events:none; transition:opacity .35s ease; }
.atl-app.atl-journey .atl-panel, .atl-app.atl-focus .atl-panel{ width:min(456px, calc(100vw - 40px)); max-height:calc(100dvh - 130px); }
@media (max-width:860px){ .atl-ticker{ display:none; } }
@media (max-width:720px){ .atl-emoji{ font-size:38px; } .atl-priv{ display:none; } .atl-time-range{ width:120px; } .atl-panel{ left:12px; right:12px; top:auto; bottom:12px; width:auto; max-height:64dvh; transform:translateY(16px); } .atl-panel.open{ transform:translateY(0); } }
/* on touch the companion just rests above the input; it steps aside while a card is open */
@media (max-width:720px){ .atl-app.atl-focus .atl-cursor, .atl-app.atl-meopen .atl-cursor{ display:none; } }
@media (max-width:720px){ .atl-status-d{ display:none; } .atl-time-range{ width:88px; } .atl-topbar{ padding:10px 12px; gap:8px; } }
@media (max-width:720px){ .atl-toasts{ top:74px; } .atl-toast{ max-width:min(340px, 92vw); } }
@media (prefers-reduced-motion: reduce){ .atl-float,.atl-blink,.atl-track,.atl-route.on,.atl-orb,.atl-agent-face{ animation:none; } }
`;
