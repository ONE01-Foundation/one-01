// Landing-page copy in both languages. ONE is Hebrew-first, so the site can
// switch to Hebrew (RTL) from the nav. Headings that carry inline markup (an
// accent word, a line break) are stored as parts so the JSX can rebuild them.

export type Lang = "en" | "he";

export interface LandingCopy {
  dir: "ltr" | "rtl";
  nav: { one: string; life: string; business: string; pricing: string; enter: string };
  hero: {
    greetings: { morning: string; afternoon: string; evening: string; hello: string };
    prompts: string[];
    noAccount: string;
    haveOne: string;
    inputAria: string;
  };
  signin: {
    title: string;
    sub: string;
    google: string;
    or: string;
    emailPlaceholder: string;
    send: string;
    sending: string;
    sent: string;
    failed: string;
  };
  /** "Why ONE" — the film IS the section: copy sits on a scrim over it. */
  thesis: { title: string; lede: string; playAria: string };
  duo: {
    eyebrow: string;
    h2: string;
    lede: string;
    life: { tag: string; h3: string; p: string; list: string[] };
    business: { tag: string; h3: string; p: string; list: string[] };
  };
  network: {
    eyebrow: string;
    h2pre: string;
    h2accent: string;
    h2post: string;
    lede: string;
    yourOne: string;
    yourRole: string;
    yourProcess: string;
    yourProcessIcon: string;
    connectedLabel: string;
    providerName: string;
    providerRole: string;
    providerStatus: string;
    providerStatusIcon: string;
  };
  pricing: {
    eyebrow: string;
    h2: string;
    perForever: string;
    perMonth: string;
    plans: { name: string; price: string; blurb: string; feats: string[]; cta: string }[];
    // The tailored/enterprise tier — not a card, just a line + link below.
    enterprise: { line: string; cta: string };
  };
  /** DEMO — see src/lib/demoPulse.ts. Delete this block with the section. */
  pulse: {
    eyebrow: string;
    demoTag: string;
    h2: string;
    lede: string;
    stats: { key: string; label: string }[];
    timelineTitle: string;
    liveLabel: string;
    justNow: string;
    minsAgo: string;
    events: Record<string, string>;
  };
  bento: {
    eyebrow: string;
    h2: string;
    core: { label: string; title: string; text: string };
    tiles: { key: string; label?: string; emoji?: string; icon?: string; title: string; span: "" | "wide" | "full" }[];
  };
  /**
   * The closing screen: one sentence, a subtitle, three buttons. The sentence
   * breaks across two lines — `titleLead` is muted, `titleRest` carries the
   * weight — so it reads as one statement with the emphasis landing at the end.
   * No rotation here on purpose: this is the CTA, and it should be still.
   */
  download: {
    titleLead: string;
    titleRest: string;
    sub: string;
    soon: string;
    appStoreSmall: string;
    appStoreName: string;
    googlePlaySmall: string;
    googlePlayName: string;
    browserSmall: string;
    browserName: string;
  };
  mobileBanner: { title: string; sub: string; cta: string; dismiss: string };
  global: { eyebrow: string; title: string; sub: string; cta: string; hint: string };
  foot: {
    about: string;
    support: string;
    legal: string;
    copy: string;
    tagline: string;
    madeWith: string;
    // Columned link groups — add a column or a link here and the footer grows
    // with it, no markup change needed.
    cols: { title: string; links: { label: string; href: string }[] }[];
  };
  aria: { toLight: string; toDark: string; switchLang: string; langLabel: string };
  // Newsroom marquee — add an item and the moving row grows with it.
  news: {
    eyebrow: string;
    title: string;
    items: { tag: string; title: string; date: string }[];
  };
}

export const LANDING_COPY: Record<Lang, LandingCopy> = {
  en: {
    dir: "ltr",
    nav: { one: "ONE", life: "Solutions", business: "Network", pricing: "Plans", enter: "Enter" },
    hero: {
      greetings: {
        morning: "Good morning.",
        afternoon: "Good afternoon.",
        evening: "Good evening.",
        hello: "Hello.",
      },
      prompts: [
        "What would you like to move forward?",
        "Name one thing you want handled.",
        "Scroll down and watch me fold into a dot.",
        "Point me at something big — I'll break it into a plan.",
        "Say it once. I'll carry it to done.",
        "Scroll up to open Global — the network of ONEs.",
        "Big or small — what should we start with?",
      ],
      noAccount: "No account needed to start",
      haveOne: "Connect",
      inputAria: "Tell ONE what you want to move forward",
    },
    signin: {
      title: "Continue with ONE",
      sub: "Save your processes and pick up on any device.",
      google: "Continue with Google",
      or: "or",
      emailPlaceholder: "you@email.com",
      send: "Send link",
      sending: "Sending…",
      sent: "Check your inbox for the link.",
      failed: "Couldn't send the link.",
    },
    thesis: {
      title: "Meet ONE",
      lede: "Your digital representative. Tell it what you want, and it carries the process end to end — speaking on your behalf, holding every detail in one place, and disclosing only what you allow.",
      playAria: "Play the film",
    },
    duo: {
      eyebrow: "One representative, many identities",
      h2: "ONE for Life. ONE for Business.",
      lede: "The same representative, in every world you live in — switch between them without switching tools.",
      life: {
        tag: "👤 ONE for Life",
        h3: "Your whole personal world, represented",
        p: "Everything you're responsible for outside of work — your health, your home, your money, the systems you're forced to navigate. State a goal and ONE turns it into a process it will carry, not a reminder you have to chase.",
        list: [
          "Turns a goal into a plan with a real next step",
          "Navigates the bookings, bureaucracy, and logistics for you",
          "Remembers the people, files, and decisions behind each one",
        ],
      },
      business: {
        tag: "🏢 ONE for Business",
        h3: "Your business gets a ONE of its own",
        p: "Give your business a representative that's always on. Customers reach it through their own ONE — it answers, schedules, and keeps a living list of who they are. Presence and operations, without a front desk.",
        list: [
          "Customers' ONEs reach yours directly",
          "Bookings become shared cards on both sides",
          "A living view of your followers and customers",
        ],
      },
    },
    network: {
      eyebrow: "The network",
      h2pre: "Your ONE talks to ",
      h2accent: "their",
      h2post: " ONE.",
      lede: "When a process involves someone else — a business, a service, an institution — your ONE connects to theirs around the process itself. They work out the details; each side gets one clear card. No forms, no phone tag, no lost threads.",
      yourOne: "Your ONE",
      yourRole: "Personal",
      yourProcess: "Mortgage approval",
      yourProcessIcon: "fi-rr-bank",
      connectedLabel: "connected around the process",
      providerName: "Meridian Bank's ONE",
      providerRole: "Institution",
      providerStatus: "In review · docs received",
      providerStatusIcon: "fi-rr-document",
    },
    pricing: {
      eyebrow: "Plans",
      h2: "Your ONE grows with you.",
      perForever: " / forever",
      perMonth: " / month",
      plans: [
        {
          name: "Free",
          price: "$0",
          blurb: "Put your first real process in ONE's hands — no account needed.",
          feats: ["Unlimited processes", "One identity", "Runs on this device"],
          cta: "Start free",
        },
        {
          name: "Plus",
          price: "$8",
          blurb: "Your whole life in one place — synced, remembered, everywhere you are.",
          feats: [
            "Everything in Free",
            "Sync across all your devices",
            "Full memory & history",
            "Connect calendar, email, files",
          ],
          cta: "Choose Plus",
        },
        {
          name: "Pro",
          price: "$19",
          blurb: "Turn any ONE into a business — become an owner, no company required.",
          feats: [
            "Everything in Plus",
            "Open a business — its ONE is free",
            "Bookings & a customer list",
            "Followers & a public profile",
          ],
          cta: "Go Pro",
        },
      ],
      enterprise: {
        line: "Bigger needs? Max — ONE for teams and organizations, tailored to you.",
        cta: "Let's talk",
      },
    },
    pulse: {
      eyebrow: "Your data, live",
      demoTag: "Demo data",
      h2: "The system, breathing.",
      lede: "ONEs, processes, and the businesses they talk to — moving in real time.",
      stats: [
        { key: "ones", label: "ONEs" },
        { key: "processes", label: "Processes" },
        { key: "businesses", label: "Businesses" },
        { key: "handled", label: "Handled this week" },
      ],
      timelineTitle: "Happening now",
      liveLabel: "Live",
      justNow: "just now",
      minsAgo: "{n}m ago",
      events: {
        process_opened: "A ONE opened a new process",
        draft_written: "A ONE drafted a message to send",
        business_connected: "A business connected to a ONE",
        step_done: "A ONE checked off the next step",
        booking_made: "A ONE booked an appointment",
        process_closed: "A process reached done",
      },
    },
    bento: {
      eyebrow: "The idea",
      h2: "Everything ONE does — one grid.",
      core: {
        label: "ONE",
        title: "Your digital representative.",
        text: "Speak in plain words; ONE understands what you mean and acts on your behalf — deciding, arranging, and following through until it's done.",
      },
      tiles: [
        { key: "units", label: "Units", title: "Every intention becomes a living process.", span: "wide" },
        { key: "global", label: "Global", title: "It talks to other ONEs.", span: "" },
        { key: "memory", icon: "fi-rr-brain", title: "Remembers your people, files & decisions.", span: "" },
        { key: "drafts", icon: "fi-rr-paper-plane", title: "Writes the real message — ready for you to send.", span: "wide" },
        { key: "next", icon: "fi-rr-arrow-progress", title: "Always knows the next step.", span: "" },
        { key: "templates", icon: "fi-rr-layers", title: "Knows the domain, so it fills the process in upfront.", span: "" },
        { key: "identities", icon: "fi-rr-users", title: "One ONE, separate profiles for life and work.", span: "wide" },
        { key: "booking", icon: "fi-rr-calendar", title: "Books the appointment with the business.", span: "wide" },
      ],
    },
    download: {
      titleLead: "ONE for",
      titleRest: "everyone.",
      sub: "Same representative, same memory, same processes — phone, laptop, or browser.",
      soon: "Mobile apps coming soon — the browser works today",
      appStoreSmall: "Download on the",
      appStoreName: "App Store",
      googlePlaySmall: "Get it on",
      googlePlayName: "Google Play",
      browserSmall: "Open it in your",
      browserName: "Browser",
    },
    mobileBanner: {
      title: "Get ONE on your phone",
      sub: "Open the app and start in seconds.",
      cta: "Open ONE",
      dismiss: "Dismiss",
    },
    global: {
      eyebrow: "Global",
      title: "The network of ONEs.",
      sub: "Your ONE doesn't work alone. It connects to the ONEs of people, businesses, and institutions — so things move between representatives, around the process itself.",
      cta: "Step into the network →",
      hint: "Scroll up for Global",
    },
    foot: {
      about: "About",
      support: "Support",
      legal: "Legal",
      copy: "© 2026 ONE01",
      tagline: "One representative for everything you need to get done — in life and in business.",
      madeWith: "From intention to reality.",
      cols: [
        {
          title: "Product",
          links: [
            { label: "ONE", href: "#problem" },
            { label: "Life", href: "#identity" },
            { label: "Business", href: "#connections" },
            { label: "Pricing", href: "#pricing" },
            { label: "Launch app", href: "/app" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", href: "/about" },
            { label: "Support", href: "/support" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Blog", href: "/about" },
            { label: "Help center", href: "/support" },
            { label: "Status", href: "/support" },
          ],
        },
        {
          title: "Legal",
          links: [
            { label: "Privacy", href: "/legal" },
            { label: "Terms", href: "/legal" },
            { label: "Cookies", href: "/legal" },
          ],
        },
      ],
    },
    aria: {
      toLight: "Switch to light",
      toDark: "Switch to dark",
      switchLang: "Switch to Hebrew",
      langLabel: "EN",
    },
    news: {
      eyebrow: "Newsroom",
      title: "What's new at ONE01",
      items: [
        { tag: "Product", title: "ONE for Business goes live", date: "Jul 2026" },
        { tag: "Update", title: "Drafts — ONE writes the message for you", date: "Jul 2026" },
        { tag: "Partnership", title: "Bringing local service providers on board", date: "Jun 2026" },
        { tag: "Product", title: "Now on web, phone, and browser", date: "Jun 2026" },
        { tag: "Milestone", title: "On the way to the App Store & Google Play", date: "Soon" },
        { tag: "Update", title: "A first look at your data, live", date: "May 2026" },
      ],
    },
  },

  he: {
    dir: "rtl",
    nav: { one: "ONE", life: "פתרונות", business: "רשת", pricing: "מסלולים", enter: "כניסה" },
    hero: {
      greetings: {
        morning: "בוקר טוב.",
        afternoon: "צהריים טובים.",
        evening: "ערב טוב.",
        hello: "שלום.",
      },
      prompts: [
        "מה תרצו לקדם?",
        "תנו לי דבר אחד שאתם רוצים שיטופל.",
        "גללו למטה וראו איך אני מתקפל לנקודה.",
        "כוון אותי למשהו גדול — ואני אפרק אותו לתוכנית.",
        "אמרו את זה פעם אחת. אני אקח את זה עד הסוף.",
        "גלול למעלה כדי לפתוח את גלובל — רשת ה-ONEs.",
        "גדול או קטן — במה נתחיל?",
      ],
      noAccount: "אפשר להתחיל בלי חשבון",
      haveOne: "התחבר",
      inputAria: "ספרו ל-ONE מה תרצו לקדם",
    },
    signin: {
      title: "להמשיך עם ONE",
      sub: "שמרו את התהליכים שלכם והמשיכו מכל מכשיר.",
      google: "המשיכו עם Google",
      or: "או",
      emailPlaceholder: "you@email.com",
      send: "שלח קישור",
      sending: "שולח…",
      sent: "בדקו את תיבת הדואר שלכם.",
      failed: "לא הצלחנו לשלוח את הקישור.",
    },
    thesis: {
      title: "הכירו את וואן",
      lede: "הנציג הדיגיטלי שלכם. אתם אומרים מה אתם רוצים, והוא מוביל את התהליך מקצה לקצה — מדבר בשמכם, שומר כל פרט במקום אחד, וחושף רק מה שאתם מאשרים.",
      playAria: "נגן את הסרטון",
    },
    duo: {
      eyebrow: "נציג אחד, זהויות רבות",
      h2: "ONE לחיים. ONE לעסק.",
      lede: "אותו נציג, בכל עולם שאתם חיים בו — עברו ביניהם בלי להחליף כלים.",
      life: {
        tag: "👤 ONE לחיים",
        h3: "כל העולם האישי שלכם, מיוצג",
        p: "כל מה שאתם אחראים עליו מחוץ לעבודה — הבריאות, הבית, הכסף, המערכות שאתם נאלצים לנווט בהן. הציבו מטרה ו-ONE הופך אותה לתהליך שהוא מוביל, לא לתזכורת שאתם צריכים לרדוף אחריה.",
        list: [
          "הופך מטרה לתוכנית עם צעד הבא אמיתי",
          "מנווט עבורכם את ההזמנות, הביורוקרטיה והלוגיסטיקה",
          "זוכר את האנשים, הקבצים וההחלטות מאחורי כל תהליך",
        ],
      },
      business: {
        tag: "🏢 ONE לעסק",
        h3: "גם לעסק שלכם יש ONE משלו",
        p: "תנו לעסק שלכם נציג שתמיד זמין. לקוחות מגיעים אליו דרך ה-ONE שלהם — הוא עונה, מתזמן ומנהל רשימה חיה של מי הם. נוכחות ותפעול, בלי דלפק קבלה.",
        list: [
          "ה-ONEs של הלקוחות מגיעים ישירות לשלכם",
          "הזמנות הופכות לכרטיסים משותפים לשני הצדדים",
          "תצוגה חיה של העוקבים והלקוחות שלכם",
        ],
      },
    },
    network: {
      eyebrow: "הרשת",
      h2pre: "ה-ONE שלכם מדבר עם ה-ONE ",
      h2accent: "שלהם",
      h2post: ".",
      lede: "כשתהליך מערב מישהו אחר — עסק, שירות, מוסד — ה-ONE שלכם מתחבר לשלהם סביב התהליך עצמו. הם מסדרים את הפרטים; כל צד מקבל כרטיס אחד וברור. בלי טפסים, בלי ריצות טלפוניות, בלי חוטים אבודים.",
      yourOne: "ה-ONE שלכם",
      yourRole: "אישי",
      yourProcess: "אישור משכנתא",
      yourProcessIcon: "fi-rr-bank",
      connectedLabel: "מחוברים סביב התהליך",
      providerName: "ה-ONE של בנק מרידיאן",
      providerRole: "מוסד",
      providerStatus: "בבדיקה · מסמכים התקבלו",
      providerStatusIcon: "fi-rr-document",
    },
    pricing: {
      eyebrow: "תוכניות",
      h2: "ה-ONE שלכם גדל יחד אתכם.",
      perForever: " / לתמיד",
      perMonth: " / לחודש",
      plans: [
        {
          name: "חינם",
          price: "$0",
          blurb: "תנו ל-ONE את התהליך האמיתי הראשון שלכם — בלי חשבון.",
          feats: ["תהליכים ללא הגבלה", "זהות אחת", "עובד במכשיר הזה"],
          cta: "התחילו בחינם",
        },
        {
          name: "פלוס",
          price: "$8",
          blurb: "כל החיים שלכם במקום אחד — מסונכרנים, זכורים, בכל מקום.",
          feats: [
            "כל מה שבחינם",
            "סנכרון בכל המכשירים",
            "זיכרון והיסטוריה מלאים",
            "חברו יומן, אימייל וקבצים",
          ],
          cta: "בחרו פלוס",
        },
        {
          name: "פרו",
          price: "$19",
          blurb: "הפכו כל ONE לעסק — היו בעלי עסק, בלי צורך בחברה.",
          feats: [
            "כל מה שבפלוס",
            "פתחו עסק — ה-ONE שלו חינם",
            "הזמנות ורשימת לקוחות",
            "עוקבים ופרופיל ציבורי",
          ],
          cta: "עברו לפרו",
        },
      ],
      enterprise: {
        line: "צרכים גדולים יותר? מקס — ONE לצוותים ולארגונים, מותאם אליכם.",
        cta: "דברו איתנו",
      },
    },
    pulse: {
      eyebrow: "הנתונים שלכם, חיים",
      demoTag: "נתוני דמו",
      h2: "המערכת, נושמת.",
      lede: "וואנים, תהליכים והעסקים שהם מדברים איתם — בתנועה, בזמן אמת.",
      stats: [
        { key: "ones", label: "וואנים" },
        { key: "processes", label: "תהליכים" },
        { key: "businesses", label: "עסקים" },
        { key: "handled", label: "טופלו השבוע" },
      ],
      timelineTitle: "קורה עכשיו",
      liveLabel: "חי",
      justNow: "עכשיו",
      minsAgo: "לפני {n} דק׳",
      events: {
        process_opened: "וואן פתח תהליך חדש",
        draft_written: "וואן ניסח הודעה לשליחה",
        business_connected: "עסק התחבר לוואן",
        step_done: "וואן סימן את הצעד הבא כבוצע",
        booking_made: "וואן קבע תור",
        process_closed: "תהליך הגיע לסיום",
      },
    },
    bento: {
      eyebrow: "הרעיון",
      h2: "כל מה ש-ONE עושה — גריד אחד.",
      core: {
        label: "ONE",
        title: "הנציג הדיגיטלי שלכם.",
        text: "אמרו מה אתם רוצים במילים פשוטות; ONE מבין למה אתם מתכוונים ופועל בשבילכם — מחליט, מארגן ועוקב עד שזה נסגר.",
      },
      tiles: [
        { key: "units", label: "יחידות", title: "כל כוונה הופכת לתהליך חי.", span: "wide" },
        { key: "global", label: "גלובל", title: "הוא מדבר עם ONEs אחרים.", span: "" },
        { key: "memory", icon: "fi-rr-brain", title: "זוכר את האנשים, הקבצים וההחלטות שלכם.", span: "" },
        { key: "drafts", icon: "fi-rr-paper-plane", title: "מנסח את ההודעה עצמה — מוכנה לשליחה.", span: "wide" },
        { key: "next", icon: "fi-rr-arrow-progress", title: "תמיד יודע מה הצעד הבא.", span: "" },
        { key: "templates", icon: "fi-rr-layers", title: "מכיר את התחום, ולכן ממלא את התהליך מראש.", span: "" },
        { key: "identities", icon: "fi-rr-users", title: "וואן אחד, פרופילים נפרדים לחיים ולעבודה.", span: "wide" },
        { key: "booking", icon: "fi-rr-calendar", title: "קובע את התור מול העסק.", span: "wide" },
      ],
    },
    download: {
      titleLead: "ONE",
      titleRest: "לכולם.",
      sub: "אותו נציג, אותו זיכרון, אותם תהליכים — בטלפון, במחשב או בדפדפן.",
      soon: "אפליקציות המובייל בקרוב — בדפדפן זה עובד כבר היום",
      appStoreSmall: "הורידו דרך",
      appStoreName: "App Store",
      googlePlaySmall: "זמין ב־",
      googlePlayName: "Google Play",
      browserSmall: "פתחו ב־",
      browserName: "דפדפן",
    },
    mobileBanner: {
      title: "קבלו את ONE בטלפון",
      sub: "פתחו את האפליקציה והתחילו בשניות.",
      cta: "פתח את ONE",
      dismiss: "סגור",
    },
    global: {
      eyebrow: "גלובל",
      title: "רשת ה-ONEs.",
      sub: "ה-ONE שלכם לא עובד לבד. הוא מתחבר ל-ONEs של אנשים, עסקים ומוסדות — כך שדברים זזים בין נציגים, סביב התהליך עצמו.",
      cta: "היכנס לרשת ←",
      hint: "גלול למעלה לגלובל",
    },
    foot: {
      about: "אודות",
      support: "תמיכה",
      legal: "משפטי",
      copy: "© 2026 ONE01",
      tagline: "נציג אחד לכל מה שצריך להשלים — בחיים ובעסק.",
      madeWith: "מרצון למציאות.",
      cols: [
        {
          title: "מוצר",
          links: [
            { label: "ONE", href: "#problem" },
            { label: "חיים", href: "#identity" },
            { label: "עסק", href: "#connections" },
            { label: "מחירים", href: "#pricing" },
            { label: "פתחו את האפליקציה", href: "/app" },
          ],
        },
        {
          title: "החברה",
          links: [
            { label: "אודות", href: "/about" },
            { label: "תמיכה", href: "/support" },
          ],
        },
        {
          title: "משאבים",
          links: [
            { label: "בלוג", href: "/about" },
            { label: "מרכז עזרה", href: "/support" },
            { label: "סטטוס", href: "/support" },
          ],
        },
        {
          title: "משפטי",
          links: [
            { label: "פרטיות", href: "/legal" },
            { label: "תנאים", href: "/legal" },
            { label: "עוגיות", href: "/legal" },
          ],
        },
      ],
    },
    aria: {
      toLight: "עבור למצב בהיר",
      toDark: "עבור למצב כהה",
      switchLang: "החלף לאנגלית",
      langLabel: "עב",
    },
    news: {
      eyebrow: "חדשות",
      title: "מה חדש ב-ONE01",
      items: [
        { tag: "מוצר", title: "ONE for Business יוצא לדרך", date: "יולי 2026" },
        { tag: "עדכון", title: "טיוטות — ONE כותב בשבילכם את ההודעה", date: "יולי 2026" },
        { tag: "שותפות", title: "מחברים נותני שירות מקומיים", date: "יוני 2026" },
        { tag: "מוצר", title: "עכשיו באתר, בטלפון ובדפדפן", date: "יוני 2026" },
        { tag: "אבן דרך", title: "בדרך ל-App Store ול-Google Play", date: "בקרוב" },
        { tag: "עדכון", title: "הצצה ראשונה לנתונים שלכם, בזמן אמת", date: "מאי 2026" },
      ],
    },
  },
};
