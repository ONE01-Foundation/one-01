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
    // One continuous grid: the heading lives in the grid (a full-width intro
    // cell), followed by the tiles. Add a tile and the grid grows.
    h2: string;
    lede: string;
    points: string[];
    tiles: {
      key: string;
      icon?: string;
      label?: string;
      title: string;
      text?: string;
      span?: "" | "wide";
      variant?: "" | "core" | "accent";
    }[];
  };
  // FAQ accordion below the plans — native <details> drawers.
  faq: { title: string; items: { q: string; a: string }[] };
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
    // Two device buttons, each opening a small menu (see GetOptions in page.tsx):
    // Desktop → open in browser, Mobile → a QR to scan.
    get: {
      desktop: string;
      mobile: string;
      browser: string;
      browserSub: string;
      desktopApp: string;
      soon: string;
      scan: string;
      platforms: string;
    };
  };
  mobileBanner: { title: string; sub: string; cta: string; dismiss: string };
  global: { eyebrow: string; title: string; sub: string; cta: string; hint: string };
  foot: {
    about: string;
    support: string;
    legal: string;
    copy: string;
    tagline: string;
    company: string;
    madeWith: string;
    // Columned link groups — add a column or a link here and the footer grows
    // with it, no markup change needed.
    cols: { title: string; links: { label: string; href: string }[] }[];
  };
  aria: { toLight: string; toDark: string; switchLang: string; langLabel: string; langMenu: string; langSoon: string };
  // Footer accessibility menu — a few genuinely-working display toggles.
  a11y: { label: string; largeText: string; contrast: string; motion: string; underline: string };
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
        line: "Bigger needs? ONE for teams and organizations, tailored to you.",
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
      h2: "Everything ONE does.",
      lede: "One representative for your whole life — it understands what you mean, acts on your behalf, and keeps everything moving.",
      points: ["Understands you", "Acts for you", "Remembers everything", "Talks to other ONEs"],
      tiles: [
        { key: "core", variant: "core", label: "ONE", title: "Your digital representative.", text: "Speak in plain words; it acts on your behalf and discloses only what you allow." },
        { key: "units", icon: "fi-rr-apps", label: "Units", title: "Every intention becomes a living process.", text: "Not a note you revisit — a process ONE opens and carries.", span: "wide" },
        { key: "worlds", variant: "accent", span: "wide", title: "Every world you live in.", text: "Health, money, home, learning, work — one representative across them all." },
        { key: "next", icon: "fi-rr-arrow-progress", title: "Always knows the next step." },
        { key: "drafts", icon: "fi-rr-paper-plane", title: "Writes the real message — ready to send." },
        { key: "memory", icon: "fi-rr-brain", title: "Remembers your people, files & decisions." },
        { key: "network", icon: "fi-rr-link", title: "Your ONE talks to their ONE." },
        { key: "business", icon: "fi-rr-shop", title: "Businesses get a ONE of their own." },
        { key: "templates", icon: "fi-rr-layers", title: "Knows the domain — fills the process in upfront.", span: "wide" },
        { key: "custom", icon: "fi-rr-settings-sliders", title: "A ONE tailored to how you work." },
        { key: "identities", icon: "fi-rr-users", title: "One ONE, separate profiles for life and work." },
      ],
    },
    faq: {
      title: "Questions & answers",
      items: [
        { q: "What is ONE?", a: "ONE is your digital representative. You tell it what you want in plain words, and it turns that into a living process it carries end to end — deciding, arranging, and following through." },
        { q: "Do I need an account to start?", a: "No. You can put a real process in ONE's hands right away. Create an account later to sync across devices and keep your full history." },
        { q: "Is my data private?", a: "ONE discloses only what you allow. You stay in control of what it shares, with whom, and when — selective by design." },
        { q: "Can I use it for my business?", a: "Yes. On Pro, any ONE can become a business — customers reach it through their own ONE, and bookings become shared cards on both sides." },
        { q: "Which devices does it work on?", a: "The browser works today on phone, laptop, and desktop. Native mobile apps are on the way — the same representative, memory, and processes everywhere." },
        { q: "How much does it cost?", a: "Free to start, forever. Plus and Pro add sync, full memory, business tools, and more — see the plans above." },
      ],
    },
    download: {
      titleLead: "Wherever you go,",
      titleRest: "ONE is with you.",
      sub: "In life, at work, and everything in between.",
      get: {
        desktop: "Desktop",
        mobile: "Mobile",
        browser: "Open in browser",
        browserSub: "Works today",
        desktopApp: "Desktop app",
        soon: "Soon",
        scan: "Scan to open ONE on your phone",
        platforms: "iOS & Android",
      },
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
      tagline: "ONE is your digital representative. Say what you want in plain words, and it turns it into a living process it carries to done — across every part of your life and work.",
      company: "ONE01 is building the network of ONEs: one representative for people, businesses, and institutions to get things done together.",
      madeWith: "From intention to reality.",
      cols: [
        {
          title: "Product",
          links: [
            { label: "ONE", href: "#problem" },
            { label: "Life", href: "#identity" },
            { label: "Business", href: "#connections" },
            { label: "Pricing", href: "#pricing" },
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
      langMenu: "Change language",
      langSoon: "Soon",
    },
    a11y: {
      label: "Accessibility",
      largeText: "Bigger text",
      contrast: "High contrast",
      motion: "Reduce motion",
      underline: "Underline links",
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
        line: "צרכים גדולים יותר? ONE לצוותים ולארגונים, מותאם אליכם.",
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
      h2: "כל מה ש-ONE עושה.",
      lede: "נציג אחד לכל החיים שלכם — מבין למה אתם מתכוונים, פועל בשמכם ושומר שהכול זז.",
      points: ["מבין אתכם", "פועל בשבילכם", "זוכר הכול", "מדבר עם ONEs אחרים"],
      tiles: [
        { key: "core", variant: "core", label: "ONE", title: "הנציג הדיגיטלי שלכם.", text: "מדברים במילים פשוטות; הוא פועל בשמכם וחושף רק את מה שאתם מאשרים." },
        { key: "units", icon: "fi-rr-apps", label: "יחידות", title: "כל כוונה הופכת לתהליך חי.", text: "לא פתק שחוזרים אליו — תהליך ש-ONE פותח ומוביל.", span: "wide" },
        { key: "worlds", variant: "accent", span: "wide", title: "כל עולם שאתם חיים בו.", text: "בריאות, כסף, בית, לימודים, עבודה — נציג אחד בכולם." },
        { key: "next", icon: "fi-rr-arrow-progress", title: "תמיד יודע מה הצעד הבא." },
        { key: "drafts", icon: "fi-rr-paper-plane", title: "מנסח את ההודעה עצמה — מוכנה לשליחה." },
        { key: "memory", icon: "fi-rr-brain", title: "זוכר את האנשים, הקבצים וההחלטות שלכם." },
        { key: "network", icon: "fi-rr-link", title: "ה-ONE שלכם מדבר עם ה-ONE שלהם." },
        { key: "business", icon: "fi-rr-shop", title: "גם לעסק יש ONE משלו." },
        { key: "templates", icon: "fi-rr-layers", title: "מכיר את התחום — וממלא את התהליך מראש.", span: "wide" },
        { key: "custom", icon: "fi-rr-settings-sliders", title: "ONE שמותאם לאיך שאתם עובדים." },
        { key: "identities", icon: "fi-rr-users", title: "וואן אחד, פרופילים נפרדים לחיים ולעבודה." },
      ],
    },
    faq: {
      title: "שאלות ותשובות",
      items: [
        { q: "מה זה ONE?", a: "ONE הוא הנציג הדיגיטלי שלכם. אומרים לו מה רוצים במילים פשוטות, והוא הופך את זה לתהליך חי שהוא מוביל מקצה לקצה — מחליט, מארגן ועוקב עד הסוף." },
        { q: "צריך חשבון כדי להתחיל?", a: "לא. אפשר לתת ל-ONE תהליך אמיתי כבר עכשיו. פותחים חשבון בהמשך כדי לסנכרן בין מכשירים ולשמור את כל ההיסטוריה." },
        { q: "הפרטיות שלי נשמרת?", a: "ONE חושף רק את מה שאתם מאשרים. אתם שולטים במה הוא משתף, עם מי ומתי — חשיפה סלקטיבית מעצם התכנון." },
        { q: "אפשר להשתמש בזה לעסק?", a: "כן. בפרו כל ONE יכול להפוך לעסק — לקוחות מגיעים אליו דרך ה-ONE שלהם, והזמנות הופכות לכרטיסים משותפים לשני הצדדים." },
        { q: "באילו מכשירים זה עובד?", a: "הדפדפן עובד כבר היום בטלפון, במחשב הנייד ובמחשב הנייח. אפליקציות מובייל בדרך — אותו נציג, זיכרון ותהליכים בכל מקום." },
        { q: "כמה זה עולה?", a: "התחלה חינם, לתמיד. פלוס ופרו מוסיפים סנכרון, זיכרון מלא, כלים לעסק ועוד — ראו את המסלולים למעלה." },
      ],
    },
    download: {
      titleLead: "בכל מקום,",
      titleRest: "‏ONE איתך.",
      sub: "בחיים, בעבודה, ובכל מה שביניהם.",
      get: {
        desktop: "מחשב",
        mobile: "מובייל",
        browser: "פתחו בדפדפן",
        browserSub: "עובד כבר היום",
        desktopApp: "אפליקציה למחשב",
        soon: "בקרוב",
        scan: "סרקו כדי לפתוח את ONE בטלפון",
        platforms: "אפל ואנדרואיד",
      },
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
      tagline: "ONE הוא הנציג הדיגיטלי שלכם. אומרים מה רוצים במילים פשוטות, והוא הופך את זה לתהליך חי שהוא מוביל עד הסוף — בכל תחום בחיים ובעבודה.",
      company: "‏ONE01 בונה את רשת ה-ONEs: נציג אחד לאנשים, לעסקים ולמוסדות, כדי להשלים דברים ביחד.",
      madeWith: "מרצון למציאות.",
      cols: [
        {
          title: "מוצר",
          links: [
            { label: "ONE", href: "#problem" },
            { label: "חיים", href: "#identity" },
            { label: "עסק", href: "#connections" },
            { label: "מחירים", href: "#pricing" },
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
      langMenu: "שינוי שפה",
      langSoon: "בקרוב",
    },
    a11y: {
      label: "נגישות",
      largeText: "טקסט גדול יותר",
      contrast: "ניגודיות גבוהה",
      motion: "הפחתת תנועה",
      underline: "קו תחתון לקישורים",
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
