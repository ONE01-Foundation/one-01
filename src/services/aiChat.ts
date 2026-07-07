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
export async function invokeAiChat(
  messages: AiChatMessage[],
  options: AiChatOptions = {},
): Promise<string> {
  const client = supabaseService.getClient();
  if (!client) throw new AiChatNotConfiguredError();
  // No session check — the function accepts anon-key calls. supabase-js
  // attaches the publishable anon key as Authorization when no session
  // exists, which satisfies verify_jwt.

  const { data, error } = await client.functions.invoke<{
    text: string;
    model: string;
    usage: unknown;
    error?: string;
  }>('ai-chat', {
    body: {
      messages,
      model: options.model ?? 'gpt-4o-mini',
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 240,
    },
  });

  if (error) {
    console.warn('[aiChat] invoke error:', error.message ?? error);
    throw new Error(`ai-chat invoke failed: ${error.message}`);
  }
  if (!data || typeof data.text !== 'string') {
    console.warn('[aiChat] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data?.error ?? 'unknown'}`);
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
  • The "reply" stays one short sentence. Do NOT list the auto-fill back to the user — they will see it in the unit. End with a concrete next step ("Want to schedule the first lesson?") or nothing.
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
  • ה-"reply" נשאר משפט אחד קצר. אל תפרט את המילוי האוטומטי בחזרה — המשתמש רואה אותו ביחידה. תסיים בצעד הבא הקונקרטי ("נקבע את השיעור הראשון?") או בלי שאלה.
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
    | 'update_process';   // Update inside an existing process.
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
  } = {},
): Promise<OneIntent> {
  const client = supabaseService.getClient();
  if (!client) throw new AiChatNotConfiguredError();
  // Anon-key calls accepted by ai-chat v2 — no session required.

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
  const schemaInstructions = lang === 'he'
    ? `החזר JSON בלבד עם השדות הבאים:
{
  "kind": "chat" | "create_process" | "decision" | "extract_task" | "add_reminder" | "missing_info" | "update_process",
  "reply": "תשובה במשפט אחד, מקסימום שניים, בעברית, מסתיימת בצעד הבא הברור או בשאלה אחת.",
  "process": { "title": "...", "emoji": "💪", "broadcast": "...", "nextSteps": ["..."], "metrics": [{"label":"עלות משוערת","value":"≈4,000","unit":"₪"},{"label":"זמן רישום","value":"7–14","unit":"ימים"}], "quickActions": ["..."], "tags": ["health"] },
  "task": { "action": "...", "contact": "...", "when": "...", "processHint": "..." },
  "decision": { "text": "...", "processHint": "..." },
  "reminder": { "text": "להתקשר למורה", "when": "מחר ב-9", "processHint": "..." },
  "missing": { "field": "...", "processHint": "..." },
  "updates": [{"metricLabel":"משקל","value":"72","unit":"ק\"ג"}]
}
- אל תחזיר טקסט מחוץ ל-JSON.
- שדות לא רלוונטיים — השמט.
- "create_process" רק אם זה משהו שיתנהל לאורך זמן (לא שאלה חד-פעמית).
- כשאתה יוצר תהליך: תן תשובות אמיתיות. מלא ב-metrics ערכי "value" עם האומדן הכי טוב שלך מהעולם האמיתי (עלות טיפוסית, משך זמן טיפוסי, מה שצריך) — בדיוק כמו שעוזר חכם היה עונה. אל תשאיר ריק אלא אם זה באמת אישי ולא ניתן לדעת.
- "add_reminder" כשהמשתמש מבקש להזכיר לו משהו ("תזכיר לי…", "אל תיתן לי לשכוח…", "תזכורת ל…"). מלא "reminder" עם הטקסט וה-when (כפי שנאמר). שייך ל-processHint הרלוונטי אם יש.
- "update_process" כשהמשתמש מצהיר ערך עדכני בתוך תהליך קיים (שם, עלות, זמן, משקל, תקציב, וכו'). תמיד תוסיף "updates". חשוב: כש-metricLabel תואם מדד קיים בתהליך — השתמש בדיוק באותו הטקסט של המדד הקיים (לדוגמה אם קיים "עלות משוערת" והמשתמש אמר עלות — השתמש ב-"עלות משוערת"), כדי שהערך יעדכן את המדד הקיים ולא יוסיף כפילות.`
    : `Return JSON ONLY with these fields:
{
  "kind": "chat" | "create_process" | "decision" | "extract_task" | "add_reminder" | "missing_info" | "update_process",
  "reply": "1–2 short sentences, ends with the next concrete step or a single clarifying question.",
  "process": { "title": "...", "emoji": "💪", "broadcast": "...", "nextSteps": ["..."], "metrics": [{"label":"Est. cost","value":"≈$1,200","unit":""},{"label":"Time to file","value":"7–14","unit":"days"}], "quickActions": ["..."], "tags": ["health"] },
  "task": { "action": "...", "contact": "...", "when": "...", "processHint": "..." },
  "decision": { "text": "...", "processHint": "..." },
  "reminder": { "text": "Call the instructor", "when": "tomorrow 9am", "processHint": "..." },
  "missing": { "field": "...", "processHint": "..." },
  "updates": [{"metricLabel":"Weight","value":"72","unit":"kg"}]
}
- No text outside the JSON.
- Omit irrelevant fields.
- "create_process" ONLY if it's something that lives over time (not a one-shot question).
- When you create a process: give REAL answers. Fill each metric's "value" with your best real-world estimate (typical cost, typical duration, what's needed) — exactly like a knowledgeable assistant would. Leave a value blank only when it's genuinely user-specific and unknowable.
- "add_reminder" when the user asks to be reminded ("remind me to…", "don't let me forget…", "set a reminder for…"). Fill "reminder" with the text and when (as said). Attach to the relevant processHint when there is one.
- "update_process" when the user declares a current value inside an existing process (name, cost, time, weight, budget, etc.). Always include "updates". IMPORTANT: when a metricLabel matches an EXISTING metric in the process, reuse that metric's exact label text (e.g. if "Est. cost" exists and the user states a cost, use "Est. cost") so the value updates the existing metric instead of adding a duplicate.`;

  const messages: AiChatMessage[] = [
    { role: 'system', content: baseSys + '\n\n' + ctxBits.join('\n') + '\n\n' + schemaInstructions },
    ...(context.history ?? []).slice(-6),
    { role: 'user', content: userText },
  ];

  const { data, error } = await client.functions.invoke<{
    text: string;
    model: string;
    usage: unknown;
    error?: string;
  }>('ai-chat', {
    body: {
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      // Auto-fill expects a populated process — title, emoji, broadcast,
      // 4–7 nextSteps, 2–4 metrics, 3–5 quickActions, 1–2 tags. In
      // Hebrew the token cost roughly doubles vs English. 700 leaves
      // comfortable headroom without inviting drift.
      max_tokens: 700,
      // Force JSON mode so we don't have to defend against markdown
      // fences, prose preambles, or trailing notes. If the model
      // produces something other than JSON, OpenAI itself errors and
      // we surface a useful message instead of crashing on JSON.parse.
      response_format: { type: 'json_object' },
    },
  });

  if (error) {
    console.warn('[invokeOneIntent] invoke error:', error.message ?? error);
    throw new Error(`ai-chat invoke failed: ${error.message}`);
  }
  if (!data?.text) {
    console.warn('[invokeOneIntent] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data?.error ?? 'unknown'}`);
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
}): Promise<string[]> {
  const client = supabaseService.getClient();
  if (!client) throw new AiChatNotConfiguredError();
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
          : corpus),
    },
  ];

  const { data, error } = await client.functions.invoke<{ text: string; error?: string }>(
    'ai-chat',
    {
      body: {
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 360,
        response_format: { type: 'json_object' },
      },
    },
  );
  if (error) {
    console.warn('[invokeAttentionLines] invoke error:', error.message ?? error);
    throw new Error(`ai-chat invoke failed: ${error.message}`);
  }
  if (!data?.text) {
    console.warn('[invokeAttentionLines] no text in response:', data);
    throw new Error(`ai-chat returned no text: ${data?.error ?? 'unknown'}`);
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
