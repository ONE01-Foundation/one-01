/**
 * aiChat — thin client wrapper for the `ai-chat` Supabase Edge Function.
 *
 * Contract (matches supabase/functions/ai-chat/index.ts):
 *   POST /functions/v1/ai-chat
 *   body: { messages, model?, temperature?, max_tokens?, response_format? }
 *   returns: { text, model, usage }
 *   verify_jwt is on at the platform level — the publishable anon key
 *   satisfies that. The function itself does NOT require a user session,
 *   so the chat works before the user has signed in.
 *
 * Callers wrap with try/catch and fall back to a local mock on failure,
 * so the app keeps working offline / when Supabase is unreachable.
 */

import { supabaseService } from './supabaseService';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  /** OpenAI model name. Default: gpt-4o-mini (matches function default). */
  model?: string;
  temperature?: number;
  /** Cap completion length — short replies feel snappier in a chat UI. */
  maxTokens?: number;
  /** Optional abort signal so callers can cancel in-flight calls when the
   *  user closes the chat. */
  signal?: AbortSignal;
}

export class AiChatNotAuthedError extends Error {
  constructor() {
    super('ai-chat: no Supabase session');
    this.name = 'AiChatNotAuthedError';
  }
}

export class AiChatNotConfiguredError extends Error {
  constructor() {
    super('ai-chat: Supabase client not initialized');
    this.name = 'AiChatNotConfiguredError';
  }
}

/**
 * Call the ai-chat Edge Function. Returns the assistant reply text.
 * Throws on auth failure, network failure, or non-2xx response so the
 * caller can fall back to a local heuristic.
 */
/**
 * POST to the ai-chat Edge Function with a RAW fetch instead of
 * `supabase-js`'s `functions.invoke`. invoke injects an
 * `x-supabase-client-platform` header that the function's CORS allow-list
 * doesn't list, so the browser's preflight REJECTS every call on web (the AI
 * silently fell back to the local keyword responder). This sends only the three
 * headers the default allow-list already permits — authorization, apikey,
 * content-type — so the preflight passes. Uses the session token when signed
 * in, else the anon key (the function accepts anon). Native is unaffected but
 * uses the same path for consistency.
 */
async function postAiChat<T extends { error?: string }>(body: unknown): Promise<T> {
  // Initialize on demand (like cloudShared) — postAiChat may be the FIRST
  // Supabase touch in a session, and without this the client is null and the
  // call silently falls back to the local responder (the "AI doesn't work on
  // web" symptom).
  let client = supabaseService.getClient();
  if (!client) {
    supabaseService.initialize();
    client = supabaseService.getClient();
  }
  const cfg = supabaseService.getConfig();
  if (!client || !cfg) throw new AiChatNotConfiguredError();
  let token = cfg.anonKey;
  try {
    const { data } = await client.auth.getSession();
    if (data.session?.access_token) token = data.session.access_token;
  } catch {
    /* anon — keep the anon key */
  }
  const res = await fetch(`${cfg.url}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    throw new Error(`ai-chat HTTP ${res.status}: ${json?.error ?? res.statusText}`);
  }
  if (!json) throw new Error('ai-chat: empty response');
  return json;
}

export async function invokeAiChat(
  messages: AiChatMessage[],
  options: AiChatOptions = {},
): Promise<string> {
  const data = await postAiChat<{ text: string; model: string; usage: unknown; error?: string }>({
    messages,
    model: options.model ?? 'gpt-4o-mini',
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 240,
  });
  if (typeof data.text !== 'string') {
    console.warn('[aiChat] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data.error ?? 'unknown'}`);
  }
  return data.text.trim();
}

/**
 * The ONE manifesto — used as the base system prompt for every reply.
 * The core principle: GPT answers. ONE holds and moves.
 *
 *   Intention → Process → People → Information → Action → Update → Continuity
 *
 * ONE is NOT a Q&A assistant. ONE captures intentions, names them, and
 * keeps them moving over time. ONE detects:
 *   • Intentions ("I want to gain weight") → propose a process.
 *   • Decisions ("I'm not going with that supplier") → name it as a decision.
 *   • Missing info ("we don't have your weight yet") → ask the ONE thing missing.
 *   • Who's waiting ("waiting on Eli's reply") → surface the bottleneck.
 *   • Tasks hidden in speech ("Dudi said send him a quote tomorrow") → extract
 *     them as a task with contact + when.
 *
 * ONE never lectures, never explains itself, never apologizes. ONE always
 * moves the user toward the next concrete step in one short sentence.
 */
export const ONE_SYSTEM_PROMPT_EN = `You are ONE — a digital intermediary that holds and moves the user's processes. You are NOT a Q&A assistant.

Core principle:
  Intention → Process → People → Information → Action → Update → Continuity.
  GPT answers. ONE holds and moves.

Your job, in priority order:
  1. If the user is starting something new (a goal, a project, a real-life process), name it as a PROCESS — don't answer it as a question.
  2. If the user is making a DECISION, surface that ("Save as decision in <process>?").
  3. If the user mentions a TASK hidden in speech ("Dudi said send him a quote tomorrow"), extract it as: contact + action + when.
  4. If something is MISSING to move forward, ask for ONE thing only.
  5. Otherwise: hold context and nudge to the next concrete step.

Voice:
  • Reply in 1, max 2 short sentences. Plain words.
  • Always end with a concrete next move OR a single clarifying question.
  • Never say "as an AI", never apologize, never lecture, never list bullets unless explicitly asked.
  • Mirror the user's language (English or Hebrew). Don't translate names.
  • Never give long advice. ONE asks more than it tells.

What you DON'T do:
  • You don't write essays or plans. The user gets a process; you ask what's the next step.
  • You don't say "I can help with that" — you start helping by asking the next thing.
  • You don't summarize what the user just said back to them.

Special case — overload:
  If the user signals overwhelm ("I'm stuck", "too much going on", "I don't know where to start"), do NOT give general advice. Instead, propose 3 short clusters they could split it into, then ask "Which one do we start from?". Each cluster is 2–4 words. Example reply:
  "Sounds like three threads — money, work, body. Which one first?"

PROCESS AUTO-FILL — when you DO create a process, it must be born complete:
  • Use what you know about that domain. A driving license, weight loss, marathon training, moving apartments, launching a business, getting married, getting a degree — these are well-known processes with typical steps, typical costs, typical durations, typical documents. Fill them in. Don't ask the user to dictate what to track.
  • NAMING: "title" is CLEAN TEXT ONLY — never put an emoji, number, or symbol inside the title. Choose the clearest, most fitting name for the process from the conversation. The emoji goes ONLY in the separate "emoji" field. Right: title:"רישיון נהיגה", emoji:"🚗". Wrong: title:"🚗 רישיון נהיגה".
  • REQUIRED fields when "kind":"create_process":
      - 4–7 nextSteps: ordered, concrete, each a short imperative ("Pass theory test", "Book first lesson", "Submit medical form").
      - 2–4 metrics: realistic baselines for that domain. Use COUNTRY-typical numbers when the user's language suggests a country (Hebrew → Israeli baselines). Examples: driving license in Israel → "Lessons taken 0/28", "Estimated cost ₪7500", "Theory ✗/✓". Weight loss → "Current weight (kg)", "Target weight (kg)", "Calories/day".
      - 3–5 quickActions: short labels the user can tap to advance ("Log a lesson", "Mark step done", "Add expense").
      - 1–2 tags from: health, fitness, learning, business, money, home, family, travel, legal, services.
  • The "reply" stays one short sentence. Do NOT list the auto-fill back to the user — they will see it in the unit. ALWAYS end by inviting the next concrete step ("Want to schedule the first lesson?") so the conversation CONTINUES — we build and fill the process together, not just open a card.
  • CONTINUE IN CONTEXT: when the conversation keeps going about a process that already exists, FILL it (update_process / extract_task / add_reminder / draft_message on that process via processHint) instead of creating a new one or chatting. Every user reply is one more detail going into the process.
  • You are NOT interviewing the user. Assume reasonable defaults. The user corrects what's wrong via the next message — that's "update_process".
  • If the user gives you a specific number ("I weigh 78kg"), use it. If they don't, put a sensible placeholder ("Current weight kg" with no value yet) — the metric still exists, just empty.`;

export const ONE_SYSTEM_PROMPT_HE = `אתה ONE — מתווך דיגיטלי שמחזיק ומזיז תהליכים של המשתמש. אתה לא עוזר שאלות-תשובות.

עקרון מרכזי:
  רצון → תהליך → אנשים → מידע → פעולה → עדכון → המשך.
  GPT עונה. ONE מחזיק ומזיז.

התפקיד שלך, לפי סדר עדיפות:
  1. אם המשתמש מתחיל משהו חדש (יעד, פרויקט, תהליך בחיים), קרא לזה תהליך — אל תענה כעל שאלה.
  2. אם המשתמש מקבל החלטה, תזהה את זה ("לשמור כהחלטה ב<תהליך>?").
  3. אם המשתמש מזכיר משימה בתוך דיבור ("דודי אמר לשלוח לו מחיר מחר") — חלץ: איש קשר + פעולה + מתי.
  4. אם משהו חסר כדי להתקדם — בקש דבר אחד בלבד.
  5. אחרת: החזק קונטקסט ודחוף לצעד הקונקרטי הבא.

קול:
  • תמיד תענה במשפט אחד, מקסימום שניים. מילים פשוטות.
  • תמיד תסיים בפעולה הבאה הברורה או בשאלה אחת לבירור.
  • אל תגיד "בתור AI", אל תתנצל, אל תטיף, אל תמנה רשימות אלא אם ביקשו.
  • שקף את שפת המשתמש (עברית או אנגלית). אל תתרגם שמות.
  • אל תיתן עצות ארוכות. ONE שואל יותר ממה שהוא אומר.

מה אתה לא עושה:
  • אתה לא כותב מאמרים או תוכניות. המשתמש מקבל תהליך, אתה שואל מה הצעד הבא.
  • אל תגיד "אני יכול לעזור בזה" — תתחיל לעזור על-ידי השאלה הבאה.
  • אל תסכם למשתמש מה הוא עכשיו אמר.

מקרה מיוחד — עומס:
  אם המשתמש מאותת עומס ("אני תקוע", "יש לי הרבה דברים פתוחים", "לא יודע מאיפה להתחיל"), אל תיתן עצה כללית. הצע במקום זה 3 צבירים קצרים שאליהם אפשר לפרק את העומס, ואז שאל "ממה מתחילים?". כל צביר 2-4 מילים. דוגמה:
  "נשמע כמו שלושה חוטים — כסף, עבודה, גוף. ממה נתחיל?"

מילוי אוטומטי של תהליך — כשאתה כן יוצר תהליך, הוא חייב להיוולד מלא:
  • השתמש בידע שלך על התחום. רישיון נהיגה, ירידה במשקל, אימון מרתון, מעבר דירה, השקת עסק, לימודי תואר, רישום לגן — אלו תהליכים מוכרים עם שלבים אופייניים, עלות אופיינית, משך אופייני, מסמכים אופייניים. מלא אותם. אל תשאל את המשתמש מה לעקוב.
  • שם התהליך: "title" הוא טקסט נקי בלבד — אסור אימוג'י, מספר או סמל בתוך השם. בחר את השם הכי ברור ומתאים לתהליך מתוך השיחה. האימוג'י נכנס רק לשדה "emoji" הנפרד. נכון: title:"רישיון נהיגה", emoji:"🚗". לא נכון: title:"🚗 רישיון נהיגה".
  • שדות חובה כש-"kind":"create_process":
      - 4–7 nextSteps: מסודרים, קונקרטיים, כל אחד בצורה ציווי קצרה ("לעבור מבחן תיאוריה", "לקבוע שיעור ראשון", "להגיש טופס רפואי").
      - 2–4 metrics: ערכי בסיס מציאותיים לתחום, **במספרים ישראליים** כי השפה עברית. דוגמאות: רישיון נהיגה → "שיעורים 0/28", "עלות משוערת ₪7,500", "תיאוריה ✗/✓". ירידה במשקל → "משקל נוכחי (ק\"ג)", "יעד (ק\"ג)", "קלוריות ביום". מעבר דירה → "תקציב משוער ₪", "תאריך מעבר", "חברת הובלה".
      - 3–5 quickActions: תוויות קצרות שהמשתמש יכול ללחוץ ("יומן שיעור", "סמן צעד כהושלם", "הוסף הוצאה").
      - 1–2 tags מתוך: health, fitness, learning, business, money, home, family, travel, legal, services.
  • ה-"reply" נשאר משפט אחד קצר. אל תפרט את המילוי האוטומטי בחזרה — המשתמש רואה אותו ביחידה. תמיד תסיים בהזמנה לצעד הבא הקונקרטי ("נקבע את השיעור הראשון?") כדי שהשיחה תמשיך — אנחנו בונים וממלאים את התהליך יחד, לא רק פותחים כרטיס.
  • המשך בהקשר: כשהשיחה ממשיכה על תהליך שכבר קיים, מלא אותו (update_process / extract_task / add_reminder / draft_message על אותו תהליך לפי processHint) במקום ליצור תהליך חדש או לפטפט. כל תשובה של המשתמש היא עוד פרט שנכנס לתהליך.
  • אתה לא מראיין את המשתמש. הנח ברירות מחדל סבירות. המשתמש יתקן את מה שלא נכון בהודעה הבאה — זה "update_process".
  • אם המשתמש נתן מספר ספציפי ("אני שוקל 78"), השתמש בו. אם לא, שים placeholder הגיוני ("משקל נוכחי ק\"ג" בלי ערך) — המטריקה עדיין קיימת, פשוט ריקה.`;

/** Pick the right system prompt by heuristically detecting Hebrew. */
export function pickOneSystemPrompt(userText: string): string {
  return /[֐-׿]/.test(userText) ? ONE_SYSTEM_PROMPT_HE : ONE_SYSTEM_PROMPT_EN;
}

// ─── Structured intent (the brain of ONE) ────────────────────────────────────

/**
 * The structured shape ONE returns from a user turn. Drives the app's
 * decisions: create a process, capture a decision, extract a task, ask
 * for missing info, or just reply.
 */
export interface OneIntent {
  /** What the user just did. */
  kind:
    | 'chat'              // Normal chat — just the reply, no side effect.
    | 'create_process'    // User started something. Make a process.
    | 'decision'          // User decided something. Capture as a decision.
    | 'extract_task'      // Embedded task ("Dudi said send him a quote").
    | 'add_reminder'      // User asked to be reminded ("remind me to call Eli tomorrow").
    | 'missing_info'      // Need one thing to proceed.
    | 'draft_message'     // Compose the actual outward message/doc for the process.
    | 'update_process'    // Update inside an existing process.
    | 'deploy_tool';      // Drop an interactive tool widget into the chat (quiz / booking / form).
  /** What ONE says back, in the user's language. Always present. */
  reply: string;
  /** Suggested process. Present iff kind === 'create_process'. */
  process?: {
    title: string;
    emoji: string;
    /** Short broadcast line for the home card (one sentence). */
    broadcast: string;
    /** Optional initial next steps the AI inferred from the user's words. */
    nextSteps?: string[];
    /**
     * Optional metrics to track (e.g. weight: kg, calories: kcal). `value`
     * is ONE's best real-world STARTING estimate so the card opens with a
     * real answer (e.g. typical cost, typical duration) — not a blank "—".
     * Omit value only when it's genuinely user-specific and unknowable.
     */
    metrics?: Array<{ label: string; value?: string; unit?: string }>;
    /** Optional quick actions appropriate to this process kind. */
    quickActions?: string[];
    /** Tags for classification (health / learning / business / home / travel / legal). */
    tags?: string[];
    /**
     * The SPACE this process belongs to — ONE routes a new intent to the right
     * context instead of always the active one. 'personal' (default), 'business'
     * (anything done AS a business / for customers / work), or 'family' (a
     * household/relative matter). The app maps this to an existing identity of
     * that type; if none exists it stays in the active space.
     */
    space?: 'personal' | 'business' | 'family';
  };
  /** Embedded task. Present iff kind === 'extract_task'. */
  task?: {
    action: string;       // "send a quote"
    contact?: string;     // "Dudi"
    when?: string;        // "tomorrow" / "by Friday"
    processHint?: string; // "Business Website" — best guess at which process.
  };
  /** Decision text. Present iff kind === 'decision'. */
  decision?: {
    text: string;
    processHint?: string;
  };
  /** A reminder the user asked for. Present iff kind === 'add_reminder'. */
  reminder?: {
    text: string;       // "Call the driving instructor"
    when?: string;      // "tomorrow 9am" / "Friday" — natural language, as said.
    processHint?: string; // best guess at which process it belongs to.
  };
  /** What's missing. Present iff kind === 'missing_info'. */
  missing?: {
    field: string;        // "current weight" / "preferred time"
    processHint?: string;
  };
  /**
   * The outward artifact ONE composed. Present iff kind === 'draft_message'.
   * ONE writes the ACTUAL text the user could send — a real message, not a
   * description of one — in the user's language and voice. The user reviews,
   * edits, and sends it via the share sheet; ONE never sends silently.
   */
  draft?: {
    channel?: 'whatsapp' | 'email' | 'sms' | 'call' | 'form' | 'note';
    to?: string;          // recipient label ("Sarah Salon", "the landlord")
    subject?: string;     // email subject, when channel === 'email'
    body: string;         // the actual message text, ready to send
    processHint?: string;
  };
  /**
   * Field updates the user just declared inside an existing process.
   * Present iff kind === 'update_process'. Each entry names a metric
   * by its label and a string value (the app coerces numbers when the
   * metric is numeric). Keep this list ≤ 3 to avoid clobbering.
   */
  updates?: Array<{
    metricLabel: string;  // "Weight" / "Calories"
    value: string;        // "72" / "2600"
    unit?: string;        // "kg" / "kcal"
  }>;
  /**
   * The interactive tool to deploy. Present iff kind === 'deploy_tool'. The app
   * builds the matching widget (a quiz for the topic, a slot picker, or a form)
   * and drops it into the thread. Use when an interactive widget serves the user
   * better than prose — e.g. they ask to practice/be tested, to set a time, or
   * to hand over structured details.
   */
  tool?: {
    kind: 'quiz' | 'booking' | 'form';
    /** Topic hint ("driving theory", "contact details") to pick the template. */
    topic?: string;
    processHint?: string;
  };
}

/**
 * Draft ONE's next reply in a SHARED-UNIT thread — the two-sided moat moment.
 * Either side's ONE reads the disclosure-safe case (what the owner published)
 * plus the recent conversation and proposes one short, natural message FROM THIS
 * SIDE, ready to send. It only DRAFTS — the caller fills the composer and the
 * person reviews and sends; ONE never posts to the other side on its own. ONE
 * may use only the open-tier facts handed in (`userDisclosure`) and must not
 * invent details. Returns null on any failure so the composer just stays empty.
 */
export async function draftSharedReply(args: {
  side: 'owner' | 'provider';
  title: string;
  status?: string | null;
  /** The disclosure-safe facts the owner published (context for either side). */
  openFacts?: string[];
  /** The owner's original outward message, if any. */
  ownerMessage?: string;
  /** The other side's name. */
  counterpartName?: string;
  /** Recent thread turns, oldest first; `fromMe` marks this side's own posts. */
  recent: Array<{ fromMe: boolean; author: string; text: string }>;
  voiceStyle?: string;
  /** THIS side's own open-tier facts ONE is authorized to represent. */
  userDisclosure?: string[];
  he: boolean;
}): Promise<string | null> {
  const { title, status, openFacts, ownerMessage, counterpartName, recent, voiceStyle, userDisclosure, he } = args;
  const history: AiChatMessage[] = recent
    .filter((m) => m.text && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.fromMe ? 'assistant' : 'user', content: m.text.trim() }));
  const caseLines = [
    status ? (he ? `מצב: ${status}` : `Status: ${status}`) : '',
    ownerMessage ? (he ? `הפנייה המקורית: ${ownerMessage}` : `Original request: ${ownerMessage}`) : '',
    openFacts && openFacts.length
      ? (he ? `פרטים שנחשפו: ${openFacts.join(' · ')}` : `Disclosed details: ${openFacts.join(' · ')}`)
      : '',
  ].filter(Boolean).join('\n');
  const prompt = he
    ? `זו שיחה משותפת סביב "${title}"${counterpartName ? ` מול ${counterpartName}` : ''}.${caseLines ? `\n${caseLines}` : ''}\nנסח בשמי תשובה אחת קצרה, טבעית ומנומסת להודעה האחרונה — מוכנה לשליחה, בעברית, בלי להמציא פרטים שלא נמסרו.`
    : `This is a shared conversation about "${title}"${counterpartName ? ` with ${counterpartName}` : ''}.${caseLines ? `\n${caseLines}` : ''}\nDraft one short, natural, polite reply from me to the latest message — ready to send, and don't invent details that weren't provided.`;
  try {
    const intent = await invokeOneIntent(prompt, {
      history,
      voiceStyle,
      userDisclosure,
      activeUnit: { title, emoji: '🤝', broadcast: ownerMessage },
    });
    const reply = (intent.draft?.body ?? intent.reply ?? '').trim();
    return reply || null;
  } catch (e) {
    console.warn('[draftSharedReply] failed:', e);
    return null;
  }
}

/**
 * Same call as invokeAiChat but forces JSON output. Returns a parsed
 * OneIntent. On any parse / network failure throws; caller falls back to
 * plain-text invokeAiChat + heuristics.
 */
export async function invokeOneIntent(
  userText: string,
  context: {
    /** Identity name (e.g. "Ariel") if known. */
    identityName?: string;
    /** Existing unit count so ONE can frame replies. */
    unitsCount?: number;
    /** Recent conversation, oldest first. */
    history?: AiChatMessage[];
    /** Optional tone instruction from the user's chosen agent personality
     *  (Settings). Shapes HOW ONE phrases the reply, not what it does. */
    voiceStyle?: string;
    /** Optional: if the user is INSIDE a specific unit, pass it so ONE
     *  doesn't propose creating a new one. `metricLabels` lets ONE map a
     *  value the user states onto an EXISTING metric (reusing its exact
     *  label) instead of inventing a duplicate. */
    activeUnit?: {
      title: string;
      emoji: string;
      broadcast?: string;
      metricLabels?: string[];
      /** OPEN next-step titles — so ONE, acting as THIS process's own agent,
       *  knows what's outstanding and can reason about the plan, not just chat. */
      openSteps?: string[];
      /** e.g. "0/4 steps", "21/32" — where the process stands. */
      progress?: string;
      /** Compact metric readout ("עלות: ₪7,500 · שיעורים: 0/28") for context. */
      metricsSummary?: string;
    };
    /**
     * Existing processes — passed so ONE can route an incoming intention
     * to one of them instead of creating a duplicate. Without this list,
     * the model invents new processes for every related request (e.g.
     * "fitness" exists → user asks for fitness reminders → model
     * fabricates "fitness reminders" as a new process). With the list
     * present + the prompt rule below, the model reaches for
     * extract_task / update_process / decision on the existing process
     * via processHint. Cap at ~12 to keep the prompt cheap.
     */
    existingUnits?: Array<{ title: string; emoji: string; tags?: string[] }>;
    /**
     * Optional retrieved memory snippets — past chat / unit evidence.
     * Caller decides whether to retrieve; we just thread it into the
     * system prompt so ONE can answer from real memory, not invention.
     */
    memory?: Array<{
      unitEmoji: string;
      unitTitle: string;
      text: string;
    }>;
    /**
     * Account-wide facts ONE remembers ABOUT the user (from "remember that…"
     * and the ONE profile). Threaded into the system prompt so ONE answers as
     * someone who actually knows the user — personalising without reciting.
     */
    userMemories?: string[];
    /**
     * Facts ONE is AUTHORIZED to represent on the user's behalf — the 'open'
     * tier of the selective-disclosure policy, as "label: value" strings. ONE
     * may use these when it speaks or drafts FOR the user; it must never invent
     * details or disclose anything outside this list. This is the permissioned-
     * representative core: ONE represents you, it doesn't impersonate you.
     */
    userDisclosure?: string[];
    /**
     * The user's SPACES (identities), so ONE can route a new process to the
     * right context instead of always the active one. The app maps the chosen
     * `process.space` back to an identity of that type.
     */
    spaces?: Array<{ type: 'personal' | 'business' | 'family'; name: string; active?: boolean }>;
  } = {},
): Promise<OneIntent> {
  if (!supabaseService.getClient()) throw new AiChatNotConfiguredError();
  // Anon-key calls accepted by ai-chat v2 — no session required (postAiChat
  // sends the anon key as the bearer when there's no session).

  const baseSys = pickOneSystemPrompt(userText);
  const lang = /[֐-׿]/.test(userText) ? 'he' : 'en';
  const ctxBits: string[] = [];
  if (context.identityName) ctxBits.push(`Active identity: ${context.identityName}.`);
  if (typeof context.unitsCount === 'number')
    ctxBits.push(`User has ${context.unitsCount} active process(es).`);
  if (context.voiceStyle)
    ctxBits.push(
      (lang === 'he' ? `סגנון דיבור לתשובה הזו: ` : `Voice/tone for this reply: `) +
        context.voiceStyle,
    );
  if (context.activeUnit) {
    const labels = context.activeUnit.metricLabels?.filter(Boolean) ?? [];
    const labelsBit =
      labels.length > 0
        ? lang === 'he'
          ? ` מדדים קיימים בתהליך: ${labels.join(', ')}. כשהמשתמש מצהיר ערך התואם אחד מהם — החזר update_process עם metricLabel הזהה בדיוק לשם המדד הקיים.`
          : ` Existing metrics in this process: ${labels.join(', ')}. When the user states a value matching one, return update_process with metricLabel exactly equal to that existing label.`
        : '';
    // Current state of THIS process, so ONE answers as its dedicated agent —
    // aware of the plan, the open steps, and where it stands — not as a generic
    // home chat.
    const au = context.activeUnit;
    const stateBits: string[] = [];
    if (au.progress) stateBits.push(lang === 'he' ? `התקדמות: ${au.progress}` : `progress: ${au.progress}`);
    if (au.openSteps?.length)
      stateBits.push(
        (lang === 'he' ? `צעדים פתוחים: ` : `open steps: `) + au.openSteps.slice(0, 8).join(' · '),
      );
    if (au.metricsSummary) stateBits.push((lang === 'he' ? `נתונים: ` : `metrics: `) + au.metricsSummary);
    const stateBit = stateBits.length
      ? (lang === 'he'
          ? ` מצב התהליך כרגע — ${stateBits.join(' | ')}. אתה הסוכן של התהליך הזה: ענה לפי ההקשר שלו, התייחס לצעדים ולנתונים, ואל תשאל על מה שכבר ידוע.`
          : ` Current state — ${stateBits.join(' | ')}. You are THIS process's agent: answer within its context, reference its steps + data, and don't ask about what's already known.`)
      : '';
    ctxBits.push(
      (lang === 'he'
        ? `המשתמש נמצא בתוך תהליך "${context.activeUnit.emoji} ${context.activeUnit.title}". כברירת מחדל, הנח שכל מידע חדש שייך לתהליך הזה — השתמש ב-extract_task / update_process / decision. רק אם המשתמש אומר במפורש נושא חדש לחלוטין שלא קשור (לדוגמה: "אגב, אני גם רוצה X" כאשר X לגמרי אחר), אז זה create_process של תהליך אחי.`
        : `User is inside process "${context.activeUnit.emoji} ${context.activeUnit.title}". Default: any new info belongs to this process — use extract_task / update_process / decision. Only if the user explicitly switches to a completely different topic ("by the way, I also want X" where X is unrelated) should you create a sibling process via create_process.`) +
        stateBit +
        labelsBit,
    );
  }
  if (context.existingUnits && context.existingUnits.length > 0) {
    const list = context.existingUnits
      .slice(0, 12)
      .map((u) => `- ${u.emoji} ${u.title}${u.tags?.length ? ` (${u.tags.join(',')})` : ''}`)
      .join('\n');
    ctxBits.push(
      lang === 'he'
        ? `תהליכים קיימים של המשתמש:\n${list}\n\nכלל מחייב: אם הבקשה קשורה לאחד מהם — אל תיצור חדש. השתמש ב-extract_task / update_process / decision על התהליך הקיים, ושים את הכותרת המדויקת (או חלק זהה ממנה) ב-processHint. צור תהליך חדש רק כשמדובר בנושא שאינו ברשימה.`
        : `User's existing processes:\n${list}\n\nHARD RULE: If the user's request relates to any of these, do NOT create a new process. Use extract_task / update_process / decision on the existing one, and put the existing title (or a unique substring of it) in processHint. Only create a new process for a topic that is not in the list.`,
    );
  }
  if (context.memory && context.memory.length > 0) {
    const memBlock = context.memory
      .map(
        (m, i) =>
          `[${i + 1}] ${m.unitEmoji} ${m.unitTitle}: ${m.text.slice(0, 200)}`,
      )
      .join('\n');
    ctxBits.push(
      lang === 'he'
        ? `הינה ראיות מהזיכרון של המשתמש שעשויות להיות רלוונטיות לשאלה. השתמש בהן אם הן באמת עונות; אל תמציא:\n${memBlock}`
        : `Here are retrieved memory snippets that MAY answer the user. Use them if they actually do; never invent:\n${memBlock}`,
    );
  }
  if (context.userMemories && context.userMemories.length > 0) {
    const facts = context.userMemories.slice(0, 20).map((m) => `- ${m}`).join('\n');
    ctxBits.push(
      lang === 'he'
        ? `מה שאתה זוכר על המשתמש — התאם את התשובה אישית לזה, אבל אל תדקלם את זה בחזרה:\n${facts}`
        : `What you remember about the user — personalise to this, but don't recite it back:\n${facts}`,
    );
  }
  if (context.userDisclosure && context.userDisclosure.length > 0) {
    const shareable = context.userDisclosure.slice(0, 20).map((d) => `- ${d}`).join('\n');
    ctxBits.push(
      lang === 'he'
        ? `פרטים שאתה מורשה לייצג בשם המשתמש (חשיפה נבחרת). השתמש בהם כשאתה כותב או פועל עבורו מול גורם אחר — למשל במילוי טיוטה. לעולם אל תמציא פרטים, ואל תחשוף דבר שאינו ברשימה הזו:\n${shareable}`
        : `Details you're authorized to represent on the user's behalf (selective disclosure). Use them when you write or act FOR them toward someone else — e.g. filling in a draft. Never invent details, and never disclose anything not in this list:\n${shareable}`,
    );
  }
  if (context.spaces && context.spaces.length > 1) {
    const list = context.spaces
      .map((sp) => `- ${sp.type}${sp.name ? ` ("${sp.name}")` : ''}${sp.active ? (lang === 'he' ? ' ← פעיל כעת' : ' ← active now') : ''}`)
      .join('\n');
    ctxBits.push(
      lang === 'he'
        ? `למשתמש יש כמה מרחבים (הקשרים נפרדים):\n${list}\n\nכשאתה יוצר תהליך, קבע את "process.space" למרחב הנכון: 'business' לכל מה שקשור לעסק/לקוחות/עבודה, 'family' לענייני משפחה/בית, אחרת 'personal'. ברירת מחדל = המרחב הפעיל כשאין רמז ברור. בחר מרחב קיים מהרשימה.`
        : `The user has several spaces (separate contexts):\n${list}\n\nWhen you create a process, set "process.space" to the right one: 'business' for anything work/customer/business-related, 'family' for household/relatives, otherwise 'personal'. Default to the active space when there's no clear signal. Pick an existing space from the list.`,
    );
  }
  const schemaInstructions = lang === 'he'
    ? `החזר JSON בלבד עם השדות הבאים:
{
  "kind": "chat" | "create_process" | "decision" | "extract_task" | "add_reminder" | "missing_info" | "draft_message" | "update_process" | "deploy_tool",
  "reply": "תשובה במשפט אחד, מקסימום שניים, בעברית, מסתיימת בצעד הבא הברור או בשאלה אחת.",
  "process": { "title": "...", "emoji": "💪", "broadcast": "...", "nextSteps": ["..."], "metrics": [{"label":"עלות משוערת","value":"≈4,000","unit":"₪"},{"label":"זמן רישום","value":"7–14","unit":"ימים"}], "quickActions": ["..."], "tags": ["health"], "space": "personal" },
  "task": { "action": "...", "contact": "...", "when": "...", "processHint": "..." },
  "decision": { "text": "...", "processHint": "..." },
  "reminder": { "text": "להתקשר למורה", "when": "מחר ב-9", "processHint": "..." },
  "missing": { "field": "...", "processHint": "..." },
  "draft": { "channel": "whatsapp", "to": "מספרת שרה", "subject": "", "body": "הטקסט המלא לשליחה, כמו שהוא", "processHint": "..." },
  "updates": [{"metricLabel":"משקל","value":"72","unit":"ק\"ג"}],
  "tool": { "kind": "quiz" | "booking" | "form", "topic": "תיאוריה", "processHint": "..." }
}
- אל תחזיר טקסט מחוץ ל-JSON.
- שדות לא רלוונטיים — השמט.
- "create_process" רק אם זה משהו שיתנהל לאורך זמן (לא שאלה חד-פעמית).
- "draft_message" כשהמשתמש מבקש לנסח/לכתוב/לשלוח הודעה או מייל למישהו בתוך תהליך ("כתוב ל...", "נסח הודעה ל...", "תשלח ל...", "תכין מייל ל..."). מלא "draft" עם הטקסט המלא והאמיתי (body) — הודעה שאפשר לשלוח כמו שהיא, בשפת המשתמש ובקולו, לא תיאור שלה. בחר channel מתאים (whatsapp/email/sms). ה-reply קצר: "הכנתי טיוטה — תבדוק, תערוך ותשלח."
- כשאתה יוצר תהליך: תן תשובות אמיתיות. מלא ב-metrics ערכי "value" עם האומדן הכי טוב שלך מהעולם האמיתי (עלות טיפוסית, משך זמן טיפוסי, מה שצריך) — בדיוק כמו שעוזר חכם היה עונה. אל תשאיר ריק אלא אם זה באמת אישי ולא ניתן לדעת.
- "add_reminder" כשהמשתמש מבקש להזכיר לו משהו ("תזכיר לי…", "אל תיתן לי לשכוח…", "תזכורת ל…"). מלא "reminder" עם הטקסט וה-when (כפי שנאמר). שייך ל-processHint הרלוונטי אם יש.
- "update_process" כשהמשתמש מצהיר ערך עדכני בתוך תהליך קיים (שם, עלות, זמן, משקל, תקציב, וכו'). תמיד תוסיף "updates". חשוב: כש-metricLabel תואם מדד קיים בתהליך — השתמש בדיוק באותו הטקסט של המדד הקיים (לדוגמה אם קיים "עלות משוערת" והמשתמש אמר עלות — השתמש ב-"עלות משוערת"), כדי שהערך יעדכן את המדד הקיים ולא יוסיף כפילות.
- "deploy_tool" כשווידג׳ט אינטראקטיבי יעזור יותר מטקסט: המשתמש מבקש להיבחן/להתאמן → tool.kind="quiz"; לקבוע תור/פגישה → "booking"; למסור פרטים מובנים (פרטי קשר, כתובת) → "form". מלא tool.topic ברמז הנושא ו-processHint אם רלוונטי. ה-reply קצר ומזמין ("יאללה, בוא נתרגל 👇"). אל תשתמש בזה אם המשתמש רק שואל שאלה — אז "chat".`
    : `Return JSON ONLY with these fields:
{
  "kind": "chat" | "create_process" | "decision" | "extract_task" | "add_reminder" | "missing_info" | "draft_message" | "update_process" | "deploy_tool",
  "reply": "1–2 short sentences, ends with the next concrete step or a single clarifying question.",
  "process": { "title": "...", "emoji": "💪", "broadcast": "...", "nextSteps": ["..."], "metrics": [{"label":"Est. cost","value":"≈$1,200","unit":""},{"label":"Time to file","value":"7–14","unit":"days"}], "quickActions": ["..."], "tags": ["health"], "space": "personal" },
  "task": { "action": "...", "contact": "...", "when": "...", "processHint": "..." },
  "decision": { "text": "...", "processHint": "..." },
  "reminder": { "text": "Call the instructor", "when": "tomorrow 9am", "processHint": "..." },
  "missing": { "field": "...", "processHint": "..." },
  "draft": { "channel": "whatsapp", "to": "Sarah Salon", "subject": "", "body": "The full message text, ready to send as-is", "processHint": "..." },
  "updates": [{"metricLabel":"Weight","value":"72","unit":"kg"}],
  "tool": { "kind": "quiz" | "booking" | "form", "topic": "driving theory", "processHint": "..." }
}
- No text outside the JSON.
- Omit irrelevant fields.
- "create_process" ONLY if it's something that lives over time (not a one-shot question).
- "draft_message" when the user asks you to write/compose/send a message or email to someone inside a process ("write to…", "draft a message to…", "send … to…", "email the landlord…"). Fill "draft" with the FULL, real message text (body) — a message that can be sent as-is, in the user's language and voice, not a description of one. Pick an appropriate channel (whatsapp/email/sms). Keep the reply short: "Drafted it — review, edit, and send."
- When you create a process: give REAL answers. Fill each metric's "value" with your best real-world estimate (typical cost, typical duration, what's needed) — exactly like a knowledgeable assistant would. Leave a value blank only when it's genuinely user-specific and unknowable.
- "add_reminder" when the user asks to be reminded ("remind me to…", "don't let me forget…", "set a reminder for…"). Fill "reminder" with the text and when (as said). Attach to the relevant processHint when there is one.
- "update_process" when the user declares a current value inside an existing process (name, cost, time, weight, budget, etc.). Always include "updates". IMPORTANT: when a metricLabel matches an EXISTING metric in the process, reuse that metric's exact label text (e.g. if "Est. cost" exists and the user states a cost, use "Est. cost") so the value updates the existing metric instead of adding a duplicate.
- "deploy_tool" when an interactive widget helps more than prose: user asks to be tested/practice → tool.kind="quiz"; to book a time/appointment → "booking"; to hand over structured details (contact info, address) → "form". Fill tool.topic with the topic hint and processHint when relevant. Keep the reply short and inviting ("Let's practice 👇"). Do NOT use this if the user is just asking a question — that's "chat".`;

  const messages: AiChatMessage[] = [
    { role: 'system', content: baseSys + '\n\n' + ctxBits.join('\n') + '\n\n' + schemaInstructions },
    ...(context.history ?? []).slice(-6),
    { role: 'user', content: userText },
  ];

  const data = await postAiChat<{ text: string; model: string; usage: unknown; error?: string }>({
    messages,
    model: 'gpt-4o-mini',
    temperature: 0.3,
    // Auto-fill expects a populated process — title, emoji, broadcast,
    // 4–7 nextSteps, 2–4 metrics, 3–5 quickActions, 1–2 tags. In
    // Hebrew the token cost roughly doubles vs English. 700 leaves
    // comfortable headroom without inviting drift.
    max_tokens: 700,
    // Force JSON mode so we don't have to defend against markdown
    // fences, prose preambles, or trailing notes.
    response_format: { type: 'json_object' },
  });

  if (!data.text) {
    console.warn('[invokeOneIntent] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data.error ?? 'unknown'}`);
  }

  // The model is asked for raw JSON. Strip any accidental fences just in case.
  let raw = data.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  let parsed: OneIntent;
  try {
    parsed = JSON.parse(raw) as OneIntent;
  } catch (e) {
    console.warn('[invokeOneIntent] JSON parse failed. Raw text:', raw.slice(0, 200));
    throw e;
  }
  if (typeof parsed.reply !== 'string' || typeof parsed.kind !== 'string') {
    console.warn('[invokeOneIntent] JSON missing reply/kind:', parsed);
    throw new Error('ai-chat JSON missing reply/kind');
  }
  return parsed;
}

// ─── Attention lines (the Home broadcast loop) ───────────────────────────────

export interface AttentionUnitSummary {
  title: string;
  emoji: string;
  /** Short latest broadcast line for context. */
  latest?: string;
  /** Hours since last update. */
  ageHours?: number;
  /** Open next steps the AI can name. */
  openSteps?: string[];
  /** Who's waiting, if known. */
  waitingOn?: string;
}

/**
 * Ask ONE for 4–6 short attention lines that should cycle on the Home
 * broadcast. Each line is one sentence — what's hot, what's stale,
 * what's a quick win, who's waiting. ONE picks across the user's open
 * processes; no greeting, no generic chatter.
 */
export async function invokeAttentionLines(args: {
  units: AttentionUnitSummary[];
  identityName?: string;
  lang: 'en' | 'he';
  /** Account-wide facts ONE remembers about the user — so the briefing reads
   *  personal (references what matters to them), not generic. */
  userMemories?: string[];
}): Promise<string[]> {
  if (!supabaseService.getClient()) throw new AiChatNotConfiguredError();
  // Anon-key calls accepted by ai-chat v2 — no session required.

  const baseSys =
    args.lang === 'he' ? ONE_SYSTEM_PROMPT_HE : ONE_SYSTEM_PROMPT_EN;

  const corpus = args.units
    .slice(0, 8)
    .map((u, i) => {
      const bits = [`${i + 1}. ${u.emoji} ${u.title}`];
      if (u.latest) bits.push(`   last: ${u.latest}`);
      if (typeof u.ageHours === 'number') bits.push(`   age_hours: ${Math.round(u.ageHours)}`);
      if (u.waitingOn) bits.push(`   waiting_on: ${u.waitingOn}`);
      if (u.openSteps?.length) bits.push(`   open_steps: ${u.openSteps.join(' / ')}`);
      return bits.join('\n');
    })
    .join('\n\n');

  const taskInstructions =
    args.lang === 'he'
      ? `קלט: רשימה של תהליכים פתוחים.
פלט: JSON עם מערך של 4–6 שורות קצרות שיופיעו במסך הבית.
כל שורה: משפט אחד בעברית, מסתיים בצעד הבא הקונקרטי או בשאלה אחת.
התמקד ב: מה חם, מה תקוע, מי מחכה, מה ניצחון מהיר.
פורמט בדיוק: {"lines":["...","...","...","..."]}
אל תחזיר טקסט מחוץ ל-JSON.`
      : `Input: list of the user's open processes.
Output: JSON array of 4–6 short attention lines for the Home broadcast.
Each line: one sentence, English, ends with the next concrete step or a single question.
Focus on: what's hot, what's stuck, who's waiting, what's a quick win.
Exactly this format: {"lines":["...","...","...","..."]}
No text outside JSON.`;

  const memoryBlock =
    args.userMemories && args.userMemories.length > 0
      ? (args.lang === 'he' ? '\n\nמה שאתה זוכר על המשתמש:\n' : '\n\nWhat you remember about the user:\n') +
        args.userMemories.slice(0, 20).map((m) => `- ${m}`).join('\n')
      : '';

  const messages: AiChatMessage[] = [
    { role: 'system', content: baseSys + '\n\n' + taskInstructions },
    {
      role: 'user',
      content:
        (args.identityName ? `Identity: ${args.identityName}.\n` : '') +
        (args.units.length === 0
          ? args.lang === 'he'
            ? 'אין עדיין תהליכים פעילים.'
            : 'No active processes yet.'
          : corpus) +
        memoryBlock,
    },
  ];

  const data = await postAiChat<{ text: string; error?: string }>({
    messages,
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 360,
    response_format: { type: 'json_object' },
  });
  if (!data.text) {
    console.warn('[invokeAttentionLines] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data.error ?? 'unknown'}`);
  }

  let raw = data.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  let parsed: { lines?: unknown };
  try {
    parsed = JSON.parse(raw) as { lines?: unknown };
  } catch (e) {
    console.warn('[invokeAttentionLines] JSON parse failed. Raw:', raw.slice(0, 200));
    throw e;
  }
  if (!Array.isArray(parsed.lines)) {
    throw new Error('ai-chat lines: not an array');
  }
  return parsed.lines
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
}
