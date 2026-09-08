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

const TXT = {
  en: { live: "now", priv: "Anonymous · aggregated", ph: "What do you need?", clr: "Clear",
    hint: "Drag to explore · scroll to zoom · click a want to grow its path",
    nowLbl: "ONEs on this now", pathH: "The path others took", doneK: "finished this week", avgK: "avg. time",
    days: "days", cta: "Start this with your ONE", matches: (n: number) => n + (n === 1 ? " match" : " matches"),
    nomatch: "Nothing here — try another word.", priv2: "Every figure is an anonymous aggregate — never a person." },
  he: { live: "עכשיו", priv: "אנונימי · מצטבר", ph: "מה אתה צריך?", clr: "נקה",
    hint: "גררו כדי לנוע · גלגלו כדי לזום · לחצו על רצון כדי לפרוש את המסלול",
    nowLbl: "וואנים על זה עכשיו", pathH: "המסלול שאחרים עברו", doneK: "הושלמו השבוע", avgK: "זמן ממוצע",
    days: "ימים", cta: "התחל את זה עם ה‑ONE שלך", matches: (n: number) => n + " תוצאות",
    nomatch: "אין תוצאה — נסו מילה אחרת.", priv2: "כל מספר הוא מצבר אנונימי — לעולם לא אדם." },
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
    const $ = (sel: string) => root.querySelector(sel) as HTMLElement | null;
    const ground = $(".atl-ground")!;
    const qEl = $(".atl-search input") as HTMLInputElement;
    const clrEl = $(".atl-clr")!;
    const panel = $(".atl-panel")!;
    const matchEl = $(".atl-match")!;
    const baseLinks = root.querySelector(".atl-baselinks") as SVGGElement;
    const routePath = root.querySelector(".atl-route") as SVGPathElement;
    const SVGNS = "http://www.w3.org/2000/svg";

    const PW = 7000, PH = 5000, CX = PW / 2, CY = PH / 2;
    D.forEach((d) => { d.x = CX + d.ox * 1.32; d.y = CY + d.oy * 1.32; });
    const TILT = 56, TR = (TILT * Math.PI) / 180, COST = Math.cos(TR);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const sizeFor = (c: number) => 15 + clamp((c - 200) / 1350, 0, 1) * 21;

    let vw = root.clientWidth, vh = root.clientHeight;
    const cam = { px: 0, py: -40, z: vw < 720 ? 0.6 : 0.8, rot: 0 };
    let rotTarget = 0, lastZ = -1, dirty = true;
    let tween: { px0: number; py0: number; z0: number; px1: number; py1: number; z1: number; t: number } | null = null;
    let selected: number | null = null, activeD: number | null = null;
    let raf = 0;
    const cleanups: (() => void)[] = [];

    type WE = { el: HTMLButtonElement; n: Intent; di: number; wx: number; wy: number };
    const wordEls: WE[] = [];
    const anchorEls: HTMLButtonElement[] = [];

    // blobs
    D.forEach((dist) => {
      const b = document.createElement("div"); b.className = "atl-blob"; const R = 460;
      b.style.left = (dist.x! - R / 2) + "px"; b.style.top = (dist.y! - R / 2) + "px"; b.style.width = R + "px"; b.style.height = R + "px";
      b.style.background = "radial-gradient(circle, " + dist.c + " 0%, transparent 66%)"; ground.appendChild(b);
    });
    // anchors + words + base links
    D.forEach((dist, di) => {
      const a = document.createElement("button"); a.className = "atl-anchor";
      a.style.left = dist.x + "px"; a.style.top = dist.y + "px"; a.style.setProperty("--dc", dist.c);
      a.innerHTML = '<span class="atl-emoji" aria-hidden="true">' + dist.em + '</span><span class="atl-alabel"></span>';
      a.addEventListener("click", (e) => { e.stopPropagation(); focusDistrict(di); });
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
        const fs = sizeFor(n.count);
        el.innerHTML = '<span class="atl-float"><span class="atl-inner" style="font-size:' + fs.toFixed(1) + 'px;font-weight:' + (n.count >= 1150 ? 800 : n.count >= 650 ? 700 : 600) + '"></span><span class="atl-count"></span></span>';
        el.setAttribute("data-id", String(idx));
        el.addEventListener("click", (e) => { e.stopPropagation(); openNode(idx); });
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

    function paintText() {
      anchorEls.forEach((a, di) => { (a.querySelector(".atl-alabel") as HTMLElement).textContent = D[di][lang]; });
      wordEls.forEach((o) => {
        (o.el.querySelector(".atl-inner") as HTMLElement).textContent = o.n[lang];
        (o.el.querySelector(".atl-count") as HTMLElement).textContent = Math.round(o.n.count * 0.12).toLocaleString();
      });
    }
    function buildTicker() {
      const tk = $(".atl-track")!; tk.innerHTML = "";
      const top = N.slice().sort((a, b) => b.count - a.count).slice(0, 14);
      const items = top.concat(top);
      items.forEach((n) => {
        const sp = document.createElement("span"); sp.className = "atl-ti";
        sp.innerHTML = '<span class="atl-tidot"></span><span class="atl-tiem">' + D[n.d].em + '</span><b>' + Math.round(n.count * 0.12).toLocaleString() + '</b> ' + TXT[lang].live + ' · ' + n[lang];
        tk.appendChild(sp);
      });
    }

    // ---- expanding route ----
    let stepEls: HTMLElement[] = [];
    function clearRoute() { stepEls.forEach((e) => e.remove()); stepEls = []; routePath.classList.remove("on"); routePath.removeAttribute("d"); }
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
      routePath.style.stroke = dist.c; routePath.classList.add("on");
      requestAnimationFrame(() => stepEls.forEach((e, i) => setTimeout(() => e.classList.add("on"), 90 * i)));
    }

    function apply() {
      cam.z = clamp(cam.z, 0.42, 2.8); cam.px = clamp(cam.px, -2100, 2100); cam.py = clamp(cam.py, -1700, 1700);
      ground.style.transform = "translate(-50%,-50%) rotateX(" + TILT + "deg) rotateZ(" + cam.rot.toFixed(3) + "deg) scale(" + cam.z.toFixed(4) + ") translate(" + cam.px.toFixed(1) + "px," + cam.py.toFixed(1) + "px)";
      if (Math.abs(cam.z - lastZ) > 0.004) { lastZ = cam.z; updateVis(); }
    }
    const flyTo = (px: number, py: number, z: number) => { tween = { px0: cam.px, py0: cam.py, z0: cam.z, px1: px, py1: py, z1: z, t: 0 }; };

    const onWheel = (e: WheelEvent) => { e.preventDefault(); tween = null; cam.z *= Math.pow(1.0016, -e.deltaY); dirty = true; };
    root.addEventListener("wheel", onWheel, { passive: false }); cleanups.push(() => root.removeEventListener("wheel", onWheel));

    const pts: Record<string, { x: number; y: number }> = {};
    let panLast: { x: number; y: number } | null = null;
    let pinchLast: { d: number; mx: number; my: number } | null = null;
    const isChrome = (t: EventTarget | null) => t instanceof Element && t.closest(".atl-core,.atl-ticker,.atl-panel,.atl-priv,.atl-word,.atl-anchor");
    const pinch = () => { const ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
    const onDown = (e: PointerEvent) => {
      if (isChrome(e.target)) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; root.setPointerCapture(e.pointerId); tween = null;
      const ids = Object.keys(pts);
      if (ids.length === 1) { panLast = { x: e.clientX, y: e.clientY }; root.classList.add("drag"); }
      else if (ids.length === 2) { panLast = null; pinchLast = pinch(); }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(pts);
      if (ids.length >= 2) { const p = pinch(); if (pinchLast) { cam.z *= p.d / pinchLast.d; cam.px += (p.mx - pinchLast.mx) / cam.z; cam.py += (p.my - pinchLast.my) / (cam.z * COST); dirty = true; } pinchLast = p; }
      else if (panLast) { const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y; cam.px += dx / cam.z; cam.py += dy / (cam.z * COST); rotTarget = clamp(rotTarget - dx * 0.018, -7, 7); panLast = { x: e.clientX, y: e.clientY }; dirty = true; }
    };
    const onUp = (e: PointerEvent) => { delete pts[e.pointerId]; const ids = Object.keys(pts); if (!ids.length) { panLast = null; pinchLast = null; root.classList.remove("drag"); } else if (ids.length === 1) { panLast = { x: pts[ids[0]].x, y: pts[ids[0]].y }; pinchLast = null; } };
    root.addEventListener("pointerdown", onDown); root.addEventListener("pointermove", onMove); root.addEventListener("pointerup", onUp); root.addEventListener("pointercancel", onUp);
    cleanups.push(() => { root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerup", onUp); root.removeEventListener("pointercancel", onUp); });
    const onDbl = (e: MouseEvent) => { if (isChrome(e.target)) return; tween = null; cam.z *= 1.5; dirty = true; };
    root.addEventListener("dblclick", onDbl); cleanups.push(() => root.removeEventListener("dblclick", onDbl));

    function loop() {
      if (tween) { tween.t = Math.min(1, tween.t + 0.05); const e = 1 - Math.pow(1 - tween.t, 3); cam.px = tween.px0 + (tween.px1 - tween.px0) * e; cam.py = tween.py0 + (tween.py1 - tween.py0) * e; cam.z = tween.z0 + (tween.z1 - tween.z0) * e; dirty = true; if (tween.t >= 1) tween = null; }
      rotTarget *= 0.9; if (Math.abs(cam.rot - rotTarget) > 0.02) { cam.rot += (rotTarget - cam.rot) * 0.12; dirty = true; }
      if (dirty) { apply(); dirty = false; }
      raf = requestAnimationFrame(loop);
    }

    const lodThreshold = () => (cam.z < 0.58 ? 1100 : cam.z < 0.9 ? 620 : 0);
    function updateVis() {
      const q = qEl.value.trim().toLowerCase(), thr = lodThreshold(); let matches = 0;
      wordEls.forEach((o) => {
        let dim = false, hide = false;
        if (q) { const m = o.n.en.toLowerCase().includes(q) || o.n.he.includes(q) || D[o.di].en.toLowerCase().includes(q) || D[o.di].he.includes(q); dim = !m; if (m) matches++; }
        else if (activeD !== null) { dim = o.di !== activeD; } else { hide = o.n.count < thr; }
        o.el.classList.toggle("dim", dim); o.el.classList.toggle("lod", hide);
      });
      anchorEls.forEach((a, di) => a.classList.toggle("dim", q ? true : activeD !== null && activeD !== di));
      matchEl.textContent = q ? (matches ? TXT[lang].matches(matches) : TXT[lang].nomatch) : "";
    }
    const onInput = () => { clrEl.classList.toggle("show", !!qEl.value.trim()); if (qEl.value.trim()) activeD = null; updateVis(); };
    qEl.addEventListener("input", onInput);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return; const q = qEl.value.trim().toLowerCase(); if (!q) return;
      for (let i = 0; i < N.length; i++) if (N[i].en.toLowerCase().includes(q) || N[i].he.includes(q)) { openNode(i); qEl.blur(); return; }
      for (let j = 0; j < D.length; j++) if (D[j].en.toLowerCase().includes(q) || D[j].he.includes(q)) { focusDistrict(j); return; }
    };
    qEl.addEventListener("keydown", onKey);
    const onClr = () => { qEl.value = ""; clrEl.classList.remove("show"); activeD = null; updateVis(); qEl.focus(); };
    clrEl.addEventListener("click", onClr);

    function focusDistrict(di: number) {
      activeD = activeD === di ? null : di; qEl.value = ""; clrEl.classList.remove("show"); updateVis();
      if (activeD !== null) flyTo(-(D[di].x! - CX), -(D[di].y! - CY) - 160, Math.max(cam.z, 1.0));
      else flyTo(0, -40, vw < 720 ? 0.6 : 0.8);
    }
    function openNode(id: number) {
      selected = id; const n = N[id], dist = D[n.d], t = TXT[lang];
      activeD = null; qEl.value = ""; clrEl.classList.remove("show"); updateVis();
      wordEls.forEach((o) => o.el.classList.toggle("sel", +o.el.getAttribute("data-id")! === id));
      growRoute(id);
      const o = wordOf(id); if (o) flyTo(-(o.wx - CX) + (lang === "he" ? -260 : 260), -(o.wy - CY) - 120, Math.max(cam.z, 1.05));
      (panel.querySelector(".atl-tag") as HTMLElement).style.setProperty("--dc", dist.c);
      ($(".atl-em")!).textContent = dist.em;
      ($(".atl-district")!).textContent = dist[lang];
      ($(".atl-title")!).textContent = n[lang];
      ($(".atl-now")!).textContent = Math.round(n.count * 0.12).toLocaleString();
      ($(".atl-nowlbl")!).textContent = t.nowLbl;
      ($(".atl-trend")!).textContent = "↑ " + n.trend + "%";
      ($(".atl-done")!).textContent = n.done.toLocaleString();
      ($(".atl-donek")!).textContent = t.doneK;
      ($(".atl-avg")!).textContent = n.avg + " " + t.days;
      ($(".atl-avgk")!).textContent = t.avgK;
      ($(".atl-pathh")!).textContent = t.pathH;
      const ol = $(".atl-steps")!; ol.innerHTML = "";
      n.steps.forEach((st, i) => { const li = document.createElement("li"); li.setAttribute("data-n", String(i + 1)); const d = document.createElement("div"); d.className = "atl-stxt"; d.textContent = st[lang]; li.appendChild(d); ol.appendChild(li); });
      const cta = $(".atl-cta")!; cta.textContent = t.cta; cta.classList.remove("done"); (cta as HTMLButtonElement).dataset.intent = n[lang];
      ($(".atl-priv2")!).textContent = t.priv2;
      panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    }
    function closePanel() { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); selected = null; wordEls.forEach((o) => o.el.classList.remove("sel")); clearRoute(); }
    ($(".atl-close")!).addEventListener("click", closePanel);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", onEsc); cleanups.push(() => document.removeEventListener("keydown", onEsc));
    ($(".atl-cta")!).addEventListener("click", function (this: HTMLButtonElement) {
      const intent = this.dataset.intent || "";
      if (onStartRef.current) onStartRef.current(intent);
    });
    ($(".atl-orb")!).addEventListener("click", () => { if (onOrbTapRef.current) onOrbTapRef.current(); });

    // live tick
    let tick: ReturnType<typeof setInterval> | null = null;
    if (!reduce) {
      tick = setInterval(() => {
        for (let k = 0; k < 3; k++) { const n = N[Math.floor(Math.random() * N.length)]; n.count += Math.floor(Math.random() * 3); }
        wordEls.forEach((o) => { (o.el.querySelector(".atl-count") as HTMLElement).textContent = Math.round(o.n.count * 0.12).toLocaleString(); });
        if (selected !== null) ($(".atl-now")!).textContent = Math.round(N[selected].count * 0.12).toLocaleString();
      }, 3400);
      cleanups.push(() => { if (tick) clearInterval(tick); });
    }

    // orb idle gaze
    if (!reduce) {
      const eyeL = root.querySelector(".atl-eyeL") as SVGCircleElement;
      const eyeR = root.querySelector(".atl-eyeR") as SVGCircleElement;
      let g = 0, l = 0, tg = 0, tl = 0, next = 0, mx: number | null = null, my: number | null = null, lastMove = 0;
      const mm = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; lastMove = performance.now(); };
      window.addEventListener("mousemove", mm, { passive: true }); cleanups.push(() => window.removeEventListener("mousemove", mm));
      const pick = (now: number) => { if (Math.random() < 0.3) { tg = 0; tl = (Math.random() - 0.5) * 0.5; } else { const d = Math.random() < 0.5 ? -1 : 1, w = Math.random() < 0.22; tg = d * (w ? 0.85 + Math.random() * 0.15 : 0.35 + Math.random() * 0.35); tl = (Math.random() - 0.5) * 0.7; } next = now + 900 + Math.random() * 1900; };
      let graf = 0;
      const fr = () => { const now = performance.now(); const ow = $(".atl-orb"); if (ow && eyeL && eyeR) { const rr = ow.getBoundingClientRect(), ocx = rr.left + rr.width / 2, ocy = rr.top + rr.height / 2; if (mx !== null && now - lastMove < 2200) { tg = clamp((mx - ocx) / 300, -1, 1); tl = clamp((my! - ocy) / 300, -1, 1); next = 0; } else if (now >= next) pick(now); g += (tg - g) * 0.12; l += (tl - l) * 0.12; eyeL.setAttribute("cx", (34 + g * 5).toFixed(2)); eyeR.setAttribute("cx", (66 + g * 5).toFixed(2)); eyeL.setAttribute("cy", (45 + l * 5).toFixed(2)); eyeR.setAttribute("cy", (45 + l * 5).toFixed(2)); } graf = requestAnimationFrame(fr); };
      graf = requestAnimationFrame(fr); cleanups.push(() => cancelAnimationFrame(graf));
    }

    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { vw = root.clientWidth; vh = root.clientHeight; dirty = true; }, 120); };
    window.addEventListener("resize", onResize); cleanups.push(() => window.removeEventListener("resize", onResize));

    paintText(); buildTicker(); updateVis(); apply(); loop();

    return () => {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      // wipe the imperative DOM so a re-mount rebuilds cleanly
      ground.querySelectorAll(".atl-blob,.atl-anchor,.atl-word,.atl-step").forEach((e) => e.remove());
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
        </svg>
      </div>
      <div className="atl-horizon" aria-hidden="true" />
      <div className="atl-floor" aria-hidden="true" />

      <div className="atl-ticker" aria-hidden="true"><div className="atl-track" /></div>

      <div className="atl-core">
        <button className="atl-orb" aria-label="ONE">
          <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
            <circle cx="50" cy="50" r="50" fill="var(--a-orb)" />
            <circle className="atl-blink atl-eyeL" cx="34" cy="45" r="8.5" fill="var(--a-orbeye)" />
            <circle className="atl-blink atl-eyeR" cx="66" cy="45" r="8.5" fill="var(--a-orbeye)" />
          </svg>
        </button>
        <div className="atl-search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input type="text" autoComplete="off" spellCheck={false} placeholder={TXT[lang].ph} aria-label={TXT[lang].ph} />
          <button className="atl-clr">{TXT[lang].clr}</button>
        </div>
        <div className="atl-match" />
      </div>

      <div className="atl-priv">🔒 {TXT[lang].priv}</div>

      <aside className="atl-panel" aria-hidden="true" aria-live="polite">
        <button className="atl-close" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <span className="atl-tag"><span className="atl-em" /><span className="atl-district" /></span>
        <h2 className="atl-title" />
        <div className="atl-nowrow"><span className="atl-now" /><span className="atl-nowlbl" /><span className="atl-trend" /></div>
        <div className="atl-stats"><div className="atl-stat"><div className="atl-v atl-done" /><div className="atl-k atl-donek" /></div><div className="atl-stat"><div className="atl-v atl-avg" /><div className="atl-k atl-avgk" /></div></div>
        <div className="atl-sec"><div className="atl-sech atl-pathh" /><ol className="atl-steps" /></div>
        <button className="atl-cta" />
        <p className="atl-priv2" />
      </aside>

      <style>{ATLAS_CSS}</style>
    </div>
  );
}

const ATLAS_CSS = `
.atl-app{ position:fixed; inset:0; z-index:60; overflow:hidden; cursor:grab; touch-action:none;
  perspective:1200px; perspective-origin:50% 36%; background:var(--bg,#f5f4f0);
  user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent;
  --a-bg:var(--bg,#f5f4f0); --a-card:var(--bg-card,#fff); --a-ink:var(--text,#0a0a0a);
  --a-ink2:var(--text-2,#5b5850); --a-ink3:var(--text-3,#938f85); --a-line:var(--line,rgba(10,10,10,0.1));
  --a-line2:color-mix(in srgb, var(--text,#0a0a0a) 6%, transparent); --a-live:#10b981;
  --a-orb:var(--orb,var(--accent,#0a0a0a)); --a-orbeye:var(--orb-eye,var(--bg,#f5f4f0));
  --a-shadow:0 10px 30px rgba(0,0,0,0.14); --a-shadowlift:0 22px 56px rgba(0,0,0,0.22);
  font-family:inherit; }
.atl-app.drag{ cursor:grabbing; }
.atl-ground{ position:absolute; left:50%; top:50%; width:7000px; height:5000px; transform-origin:50% 50%; transform-style:preserve-3d; will-change:transform; }
.atl-grid{ position:absolute; inset:0; background:
  repeating-linear-gradient(0deg, var(--a-line2) 0 1px, transparent 1px 96px),
  repeating-linear-gradient(90deg, var(--a-line2) 0 1px, transparent 1px 96px);
  -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 42%, transparent 76%); mask-image:radial-gradient(circle at 50% 50%, #000 42%, transparent 76%); }
.atl-blob{ position:absolute; border-radius:50%; filter:blur(55px); opacity:0.5; pointer-events:none; }
.atl-links{ position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.atl-link{ stroke:var(--a-line); stroke-width:1.4; fill:none; }
.atl-xlink{ stroke:var(--a-ink); opacity:0.10; stroke-width:1.6; fill:none; stroke-dasharray:3 12; }
.atl-route{ fill:none; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transition:opacity .4s; }
.atl-route.on{ opacity:0.9; stroke-dasharray:2 14; animation:atlDash 1.1s linear infinite; }
@keyframes atlDash{ to{ stroke-dashoffset:-16; } }
.atl-anchor{ position:absolute; transform:translate(-50%,-50%) translateZ(46px) rotateX(-56deg); display:flex; flex-direction:column; align-items:center; gap:6px; background:none; border:0; cursor:pointer; padding:6px; transition:opacity .35s; }
.atl-emoji{ font-size:46px; line-height:1; filter:drop-shadow(0 12px 16px rgba(10,10,10,0.30)); }
.atl-alabel{ font-size:12px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:var(--a-ink2); white-space:nowrap; }
[dir="rtl"] .atl-alabel{ letter-spacing:0.03em; font-weight:800; }
.atl-anchor.dim{ opacity:0.18; }
.atl-word{ position:absolute; transform:translate(-50%,-50%) translateZ(28px) rotateX(-56deg); background:none; border:0; padding:5px 6px; cursor:pointer; color:var(--a-ink); transition:opacity .4s; }
.atl-float{ display:inline-block; animation:atlFloat var(--fd,7s) ease-in-out infinite; animation-delay:var(--fdl,0s); }
.atl-inner{ display:inline-block; transition:transform .2s cubic-bezier(.2,.7,.2,1),color .2s; letter-spacing:-0.015em; line-height:1.05; text-shadow:0 1px 12px var(--a-bg); }
.atl-count{ display:block; text-align:center; font-size:11px; color:var(--a-ink3); opacity:0; margin-top:3px; font-variant-numeric:tabular-nums; transition:opacity .2s; font-weight:600; }
.atl-word:hover{ z-index:6; } .atl-word:hover .atl-inner, .atl-word:focus-visible .atl-inner{ transform:scale(1.16); }
.atl-word:focus-visible{ outline:none; } .atl-word:hover .atl-count, .atl-word.sel .atl-count{ opacity:1; }
.atl-word.dim{ opacity:0.1; } .atl-word.lod{ opacity:0; pointer-events:none; }
.atl-word.sel .atl-inner{ font-weight:800; text-decoration:underline; text-underline-offset:6px; text-decoration-thickness:3px; text-decoration-color:var(--dc); }
@keyframes atlFloat{ 0%,100%{ transform:translateY(-4px);} 50%{ transform:translateY(4px);} }
.atl-step{ position:absolute; transform:translate(-50%,-50%) translateZ(40px) rotateX(-56deg) scale(.7); opacity:0; transition:opacity .35s, transform .35s cubic-bezier(.2,.8,.2,1); pointer-events:none; }
.atl-step.on{ opacity:1; transform:translate(-50%,-50%) translateZ(40px) rotateX(-56deg) scale(1); }
.atl-stepin{ display:inline-flex; align-items:center; gap:8px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadow); border-radius:999px; padding:6px 13px 6px 7px; max-width:230px; }
[dir="rtl"] .atl-stepin{ padding:6px 7px 6px 13px; }
.atl-stepn{ width:20px; height:20px; border-radius:50%; background:var(--dc,var(--a-ink)); color:#fff; font-size:11px; font-weight:700; display:grid; place-items:center; flex:none; }
.atl-stept{ font-size:12.5px; font-weight:600; color:var(--a-ink); line-height:1.15; }
.atl-horizon{ position:absolute; inset:0 0 auto 0; height:42%; z-index:11; pointer-events:none; background:linear-gradient(var(--a-bg) 12%, rgba(0,0,0,0) 100%); }
.atl-floor{ position:absolute; inset:auto 0 0 0; height:30%; z-index:11; pointer-events:none; background:linear-gradient(rgba(0,0,0,0) 0%, var(--a-bg) 94%); }
.atl-ticker{ position:absolute; z-index:29; top:18px; left:50%; transform:translateX(-50%); width:min(42vw,520px); height:32px; overflow:hidden; -webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); }
.atl-track{ position:absolute; top:0; inset-inline-start:0; display:inline-flex; align-items:center; gap:30px; white-space:nowrap; height:32px; animation:atlCrawl 56s linear infinite; will-change:transform; }
[dir="rtl"] .atl-track{ animation-name:atlCrawlR; }
.atl-ti{ display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:var(--a-ink2); }
.atl-tiem{ font-size:14px; } .atl-ti b{ color:var(--a-ink); font-weight:700; font-variant-numeric:tabular-nums; } .atl-tidot{ width:6px; height:6px; border-radius:50%; background:var(--a-live); }
@keyframes atlCrawl{ from{transform:translateX(0);} to{transform:translateX(-50%);} }
@keyframes atlCrawlR{ from{transform:translateX(-50%);} to{transform:translateX(0);} }
.atl-core{ position:absolute; z-index:26; left:50%; top:46%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:18px; width:min(440px,86vw); }
.atl-orb{ width:86px; height:86px; padding:0; border:0; background:none; cursor:pointer; filter:drop-shadow(0 16px 34px rgba(10,10,10,0.28)); }
.atl-blink{ animation:atlBlink 5.6s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
@keyframes atlBlink{ 0%,92%,100%{transform:scaleY(1);} 96%{transform:scaleY(0.12);} }
.atl-search{ width:100%; display:flex; align-items:center; gap:10px; height:56px; padding:0 8px 0 20px; border-radius:999px; background:var(--a-card); border:1px solid var(--a-line); box-shadow:var(--a-shadowlift); }
[dir="rtl"] .atl-search{ padding:0 20px 0 8px; }
.atl-search svg{ flex:none; color:var(--a-ink3); }
.atl-search input{ flex:1; min-width:0; border:0; outline:0; background:transparent; font:inherit; font-size:16px; color:var(--a-ink); user-select:text; -webkit-user-select:text; }
.atl-search input::placeholder{ color:var(--a-ink3); }
.atl-clr{ flex:none; border:0; background:var(--a-line); color:var(--a-ink2); cursor:pointer; font:inherit; font-size:12px; font-weight:600; height:40px; padding:0 15px; border-radius:999px; opacity:0; transform:scale(.9); transition:opacity .2s,transform .2s; }
.atl-clr.show{ opacity:1; transform:scale(1); }
.atl-match{ font-size:12.5px; color:var(--a-ink3); font-weight:600; height:16px; text-align:center; }
.atl-priv{ position:absolute; z-index:26; bottom:16px; inset-inline-start:20px; display:inline-flex; align-items:center; gap:7px; font-size:11.5px; color:var(--a-ink3); font-weight:600; pointer-events:none; }
.atl-panel{ position:absolute; z-index:64; top:74px; inset-inline-start:20px; width:min(360px,calc(100vw - 40px)); max-height:calc(100dvh - 150px); background:var(--a-card); border:1px solid var(--a-line); border-radius:22px; box-shadow:var(--a-shadowlift); display:flex; flex-direction:column; padding:18px 22px 22px; overflow-y:auto; opacity:0; transform:translateY(-8px) scale(.98); transform-origin:top center; pointer-events:none; transition:opacity .3s, transform .3s cubic-bezier(.2,.8,.2,1); user-select:text; -webkit-user-select:text; }
.atl-panel.open{ opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
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
.atl-cta{ margin-top:22px; width:100%; height:50px; border:0; border-radius:999px; background:var(--a-ink); color:var(--a-bg); cursor:pointer; font:inherit; font-size:15px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:9px; transition:transform .15s,background .3s; }
.atl-cta:hover{ transform:translateY(-2px); } .atl-cta.done{ background:var(--a-live); color:#fff; }
.atl-priv2{ margin-top:14px; font-size:11px; line-height:1.45; color:var(--a-ink3); text-align:center; }
@media (max-width:860px){ .atl-ticker{ display:none; } }
@media (max-width:720px){ .atl-emoji{ font-size:38px; } .atl-priv{ display:none; } .atl-core{ top:44%; } .atl-panel{ inset-inline:12px; inset-inline-end:12px; width:auto; top:auto; bottom:12px; max-height:62dvh; } }
@media (prefers-reduced-motion: reduce){ .atl-float,.atl-blink,.atl-track,.atl-route.on{ animation:none; } }
`;
