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
  thesis: { eyebrow: string; line1: string; line2pre: string; accent: string; line2post: string; lede: string };
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
    connectedLabel: string;
    providerName: string;
    providerRole: string;
    providerStatus: string;
  };
  pricing: {
    eyebrow: string;
    h2: string;
    perForever: string;
    perMonth: string;
    plans: { name: string; price: string; blurb: string; feats: string[]; cta: string }[];
  };
  status: { eyebrow: string; h2: string; lede: string };
  bento: {
    eyebrow: string;
    h2: string;
    core: { label: string; title: string; text: string };
    tiles: { key: string; label?: string; emoji?: string; title: string; span: "" | "wide" | "full" }[];
  };
  download: {
    soon: string;
    appStoreSmall: string;
    appStoreName: string;
    googlePlaySmall: string;
    googlePlayName: string;
  };
  mobileBanner: { title: string; sub: string; cta: string; dismiss: string };
  final: { pre: string; accent: string; post: string; lede: string; cta: string };
  foot: { about: string; support: string; legal: string };
  aria: { toLight: string; toDark: string; switchLang: string; langLabel: string };
}

export const LANDING_COPY: Record<Lang, LandingCopy> = {
  en: {
    dir: "ltr",
    nav: { one: "ONE", life: "Life", business: "Business", pricing: "Pricing", enter: "Enter" },
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
        "What's been sitting on your list too long?",
        "Point me at something big — I'll break it into a plan.",
        "Say it once. I'll carry it to done.",
        "Tell me the outcome. I'll work out the steps.",
        "Big or small — what should we start with?",
      ],
      noAccount: "No account needed to start",
      haveOne: "Already have ONE?",
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
      eyebrow: "Why ONE",
      line1: "One for everything.",
      line2pre: "Everything in ",
      accent: "one",
      line2post: ".",
      lede:
        "Getting anything done today means becoming your own integration layer — juggling apps, forms, threads, and people, holding the whole picture in your head. ONE takes that weight. It's a single representative that turns what you want into motion, and keeps it moving until it's done.",
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
      yourProcess: "🏦 Mortgage approval",
      connectedLabel: "connected around the process",
      providerName: "Meridian Bank's ONE",
      providerRole: "Institution",
      providerStatus: "📄 In review · docs received",
    },
    pricing: {
      eyebrow: "Plans",
      h2: "Start free. Grow when you're ready.",
      perForever: " / forever",
      perMonth: " / month",
      plans: [
        {
          name: "ONE Free",
          price: "$0",
          blurb: "Put your first real process in ONE's hands — no account needed.",
          feats: ["Unlimited processes", "One personal identity", "Runs on this device"],
          cta: "Start free",
        },
        {
          name: "ONE Plus",
          price: "$8",
          blurb: "Your whole life in one place — synced, remembered, everywhere you are.",
          feats: [
            "Everything in Free",
            "Sync across all your devices",
            "Full memory & history",
            "Connect calendar, email, files",
          ],
          cta: "Start with Plus",
        },
        {
          name: "ONE Business",
          price: "$29",
          blurb: "Give your business a representative customers can reach.",
          feats: [
            "Everything in Plus",
            "Business identity + bookings",
            "Followers & customer list",
            "Team access",
          ],
          cta: "Add Business",
        },
      ],
    },
    status: {
      eyebrow: "Where we are",
      h2: "Open preview.",
      lede: "Every screen, gesture, and flow is real and complete — you can use it today. The intelligence that acts on your behalf and the network that connects ONEs are rolling out next. No account needed to try it.",
    },
    bento: {
      eyebrow: "The idea",
      h2: "Three words. One system.",
      core: {
        label: "ONE",
        title: "Your digital representative.",
        text: "Speak in plain words; ONE understands what you mean and acts on your behalf — deciding, arranging, and following through until it's done.",
      },
      tiles: [
        { key: "units", label: "Units", title: "Every intention becomes a living process.", span: "wide" },
        { key: "global", label: "Global", title: "It talks to other ONEs.", span: "" },
        { key: "memory", emoji: "🧠", title: "Remembers your people, files & decisions.", span: "" },
        { key: "next", emoji: "➡️", title: "Always knows the next step — and takes it.", span: "full" },
      ],
    },
    download: {
      soon: "Mobile apps coming soon — iOS & Android",
      appStoreSmall: "Download on the",
      appStoreName: "App Store",
      googlePlaySmall: "Get it on",
      googlePlayName: "Google Play",
    },
    mobileBanner: {
      title: "Get ONE on your phone",
      sub: "Open the app and start in seconds.",
      cta: "Open ONE",
      dismiss: "Dismiss",
    },
    final: {
      pre: "Start with ",
      accent: "one thing",
      post: ".",
      lede: "Hand ONE a single intention. Watch it become a process that moves.",
      cta: "Start with ONE →",
    },
    foot: { about: "About", support: "Support", legal: "Legal" },
    aria: {
      toLight: "Switch to light",
      toDark: "Switch to dark",
      switchLang: "Switch to Hebrew",
      langLabel: "EN",
    },
  },

  he: {
    dir: "rtl",
    nav: { one: "ONE", life: "חיים", business: "עסק", pricing: "מחירים", enter: "כניסה" },
    hero: {
      greetings: {
        morning: "בוקר טוב.",
        afternoon: "צהריים טובים.",
        evening: "ערב טוב.",
        hello: "שלום.",
      },
      prompts: [
        "מה תרצה לקדם?",
        "תן לי דבר אחד שאתה רוצה שיטופל.",
        "מה יושב לך ברשימה כבר יותר מדי זמן?",
        "כוון אותי למשהו גדול — ואני אפרק אותו לתוכנית.",
        "אמור את זה פעם אחת. אני אקח את זה עד הסוף.",
        "תגיד לי את התוצאה. אני אבנה את הצעדים.",
        "גדול או קטן — במה נתחיל?",
      ],
      noAccount: "אפשר להתחיל בלי חשבון",
      haveOne: "כבר יש לך ONE?",
      inputAria: "ספר ל-ONE מה תרצה לקדם",
    },
    signin: {
      title: "להמשיך עם ONE",
      sub: "שמור את התהליכים שלך והמשך מכל מכשיר.",
      google: "המשך עם Google",
      or: "או",
      emailPlaceholder: "you@email.com",
      send: "שלח קישור",
      sending: "שולח…",
      sent: "בדוק את תיבת הדואר שלך.",
      failed: "לא הצלחנו לשלוח את הקישור.",
    },
    thesis: {
      eyebrow: "למה ONE",
      line1: "אחד לכל דבר.",
      line2pre: "הכול במקום ",
      accent: "אחד",
      line2post: ".",
      lede:
        "כדי לקדם משהו היום אתה הופך בעצמך לשכבת החיבור — מלהטט בין אפליקציות, טפסים, התכתבויות ואנשים, ומחזיק את כל התמונה בראש. ONE לוקח את המשקל הזה. נציג אחד שהופך את מה שאתה רוצה לתנועה, וממשיך לדחוף עד שזה נסגר.",
    },
    duo: {
      eyebrow: "נציג אחד, זהויות רבות",
      h2: "ONE לחיים. ONE לעסק.",
      lede: "אותו נציג, בכל עולם שאתה חי בו — עבור ביניהם בלי להחליף כלים.",
      life: {
        tag: "👤 ONE לחיים",
        h3: "כל העולם האישי שלך, מיוצג",
        p: "כל מה שאתה אחראי עליו מחוץ לעבודה — הבריאות, הבית, הכסף, המערכות שאתה נאלץ לנווט בהן. הצב מטרה ו-ONE הופך אותה לתהליך שהוא מוביל, לא לתזכורת שאתה צריך לרדוף אחריה.",
        list: [
          "הופך מטרה לתוכנית עם צעד הבא אמיתי",
          "מנווט עבורך את ההזמנות, הביורוקרטיה והלוגיסטיקה",
          "זוכר את האנשים, הקבצים וההחלטות מאחורי כל תהליך",
        ],
      },
      business: {
        tag: "🏢 ONE לעסק",
        h3: "גם לעסק שלך יש ONE משלו",
        p: "תן לעסק שלך נציג שתמיד זמין. לקוחות מגיעים אליו דרך ה-ONE שלהם — הוא עונה, מתזמן ומנהל רשימה חיה של מי הם. נוכחות ותפעול, בלי דלפק קבלה.",
        list: [
          "ה-ONEs של הלקוחות מגיעים ישירות לשלך",
          "הזמנות הופכות לכרטיסים משותפים לשני הצדדים",
          "תצוגה חיה של העוקבים והלקוחות שלך",
        ],
      },
    },
    network: {
      eyebrow: "הרשת",
      h2pre: "ה-ONE שלך מדבר עם ה-ONE ",
      h2accent: "שלהם",
      h2post: ".",
      lede: "כשתהליך מערב מישהו אחר — עסק, שירות, מוסד — ה-ONE שלך מתחבר לשלהם סביב התהליך עצמו. הם מסדרים את הפרטים; כל צד מקבל כרטיס אחד וברור. בלי טפסים, בלי ריצות טלפוניות, בלי חוטים אבודים.",
      yourOne: "ה-ONE שלך",
      yourRole: "אישי",
      yourProcess: "🏦 אישור משכנתא",
      connectedLabel: "מחוברים סביב התהליך",
      providerName: "ה-ONE של בנק מרידיאן",
      providerRole: "מוסד",
      providerStatus: "📄 בבדיקה · מסמכים התקבלו",
    },
    pricing: {
      eyebrow: "תוכניות",
      h2: "התחל בחינם. גדל כשתהיה מוכן.",
      perForever: " / לתמיד",
      perMonth: " / לחודש",
      plans: [
        {
          name: "ONE חינם",
          price: "$0",
          blurb: "תן ל-ONE את התהליך האמיתי הראשון שלך — בלי חשבון.",
          feats: ["תהליכים ללא הגבלה", "זהות אישית אחת", "עובד במכשיר הזה"],
          cta: "התחל בחינם",
        },
        {
          name: "ONE פלוס",
          price: "$8",
          blurb: "כל החיים שלך במקום אחד — מסונכרנים, זכורים, בכל מקום.",
          feats: [
            "כל מה שבחינם",
            "סנכרון בכל המכשירים",
            "זיכרון והיסטוריה מלאים",
            "חבר יומן, אימייל וקבצים",
          ],
          cta: "התחל עם פלוס",
        },
        {
          name: "ONE עסקי",
          price: "$29",
          blurb: "תן לעסק שלך נציג שהלקוחות יכולים להגיע אליו.",
          feats: [
            "כל מה שבפלוס",
            "זהות עסקית + הזמנות",
            "עוקבים ורשימת לקוחות",
            "גישת צוות",
          ],
          cta: "הוסף עסק",
        },
      ],
    },
    status: {
      eyebrow: "איפה אנחנו",
      h2: "תצוגה פתוחה.",
      lede: "כל מסך, מחווה ותהליך אמיתיים ומלאים — אפשר להשתמש כבר היום. הבינה שפועלת בשמך והרשת שמחברת בין ה-ONEs מגיעות בשלב הבא. אין צורך בחשבון כדי לנסות.",
    },
    bento: {
      eyebrow: "הרעיון",
      h2: "שלוש מילים. מערכת אחת.",
      core: {
        label: "ONE",
        title: "הנציג הדיגיטלי שלך.",
        text: "אמור מה אתה רוצה במילים פשוטות; ONE מבין למה אתה מתכוון ופועל בשבילך — מחליט, מארגן ועוקב עד שזה נסגר.",
      },
      tiles: [
        { key: "units", label: "יחידות", title: "כל כוונה הופכת לתהליך חי.", span: "wide" },
        { key: "global", label: "גלובל", title: "הוא מדבר עם ONEs אחרים.", span: "" },
        { key: "memory", emoji: "🧠", title: "זוכר את האנשים, הקבצים וההחלטות שלך.", span: "" },
        { key: "next", emoji: "➡️", title: "תמיד יודע מה הצעד הבא — ולוקח אותו.", span: "full" },
      ],
    },
    download: {
      soon: "אפליקציות המובייל בקרוב — iOS ואנדרואיד",
      appStoreSmall: "הורידו דרך",
      appStoreName: "App Store",
      googlePlaySmall: "זמין ב־",
      googlePlayName: "Google Play",
    },
    mobileBanner: {
      title: "קבלו את ONE בטלפון",
      sub: "פתחו את האפליקציה והתחילו בשניות.",
      cta: "פתח את ONE",
      dismiss: "סגור",
    },
    final: {
      pre: "התחל עם ",
      accent: "דבר אחד",
      post: ".",
      lede: "מסור ל-ONE כוונה אחת. וראה אותה הופכת לתהליך שזז.",
      cta: "התחל עם ONE ←",
    },
    foot: { about: "אודות", support: "תמיכה", legal: "משפטי" },
    aria: {
      toLight: "עבור למצב בהיר",
      toDark: "עבור למצב כהה",
      switchLang: "החלף לאנגלית",
      langLabel: "עב",
    },
  },
};
