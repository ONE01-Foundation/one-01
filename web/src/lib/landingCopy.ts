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
  concepts: {
    eyebrow: string;
    h2: string;
    items: { key: string; h3: string; p: string }[];
  };
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
    personal: string;
    hairAppt: string;
    connectedLabel: string;
    salonOne: string;
    business: string;
    booking: string;
  };
  pricing: {
    eyebrow: string;
    h2: string;
    perForever: string;
    perMonth: string;
    plans: { name: string; price: string; blurb: string; feats: string[]; cta: string }[];
  };
  status: { eyebrow: string; h2: string; lede: string };
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
        "Tell me one thing you want to get done.",
        "What's been sitting on your list too long?",
        "A trip, a booking, a license — where do we start?",
        "Name it. I'll carry it to done.",
        "Say it once. I'll turn it into a process that moves.",
        "Big or small — what should we handle first?",
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
        "Your goals, chats, files, and appointments live in a dozen places — held together by your memory. ONE gives every intention one place to live, and quietly moves it forward.",
    },
    concepts: {
      eyebrow: "The idea",
      h2: "Three words. One system.",
      items: [
        {
          key: "ONE",
          h3: "Digital representative",
          p: "Your agent. You speak in plain words; ONE understands what you mean and acts on your behalf.",
        },
        {
          key: "Units",
          h3: "Living processes",
          p: "Each goal becomes a Unit — a small living process holding its steps, files, people, and next move.",
        },
        {
          key: "Global",
          h3: "The network",
          p: "Units connect to other ONEs — people and businesses — so things move between you, not inside one app.",
        },
      ],
    },
    duo: {
      eyebrow: "One agent, many identities",
      h2: "ONE for Life. ONE for Business.",
      lede: "The same ONE, in different worlds — switch identities without switching apps.",
      life: {
        tag: "👤 ONE for Life",
        h3: "Your personal life, handled",
        p: "Health, learning, home, family, errands, legal. Say what you want to move forward — ONE keeps every process alive and shows you the next step.",
        list: [
          "Book appointments and track them to done",
          "Licenses, moving, travel, health goals",
          "Remembers your people, files, and decisions",
        ],
      },
      business: {
        tag: "🏢 ONE for Business",
        h3: "Your business has a ONE, too",
        p: "Give your business its own ONE. Customers' ONEs talk to it — bookings, followers, and a customer list, without a call centre.",
        list: [
          "Bookings become cards for both sides",
          "See your followers and customers",
          "Describe your business once — it's live",
        ],
      },
    },
    network: {
      eyebrow: "The network",
      h2pre: "Your ONE talks to ",
      h2accent: "their",
      h2post: " ONE.",
      lede: "Book a haircut, a driving lesson, a move — your ONE connects to the business's ONE around the process itself, and the booking becomes a card for both of you.",
      yourOne: "Your ONE",
      personal: "Personal",
      hairAppt: "💈 Hair Appointment",
      connectedLabel: "connected around the process",
      salonOne: "Sarah Salon's ONE",
      business: "Business",
      booking: "📅 Booking · Tuesday 18:00",
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
          blurb: "Move your first things forward — no account needed.",
          feats: ["Unlimited processes", "One personal identity", "Works on this device"],
          cta: "Start free",
        },
        {
          name: "ONE Plus",
          price: "$8",
          blurb: "Your whole life, synced and remembered everywhere.",
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
          blurb: "Give your business a ONE customers can reach.",
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
      lede: "The interface is real and complete — every screen, gesture, and flow. The intelligence and the connected network are shipping next. No account needed to try it today.",
    },
    final: {
      pre: "Start with ",
      accent: "one thing",
      post: ".",
      lede: "Tell ONE what matters. It will help move it forward.",
      cta: "Start with ONE →",
    },
    foot: { about: "About", support: "Support", legal: "Legal" },
    aria: {
      toLight: "Switch to light",
      toDark: "Switch to dark",
      switchLang: "Switch to Hebrew",
      langLabel: "עב",
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
        "ספר לי דבר אחד שאתה רוצה לסגור.",
        "מה יושב לך ברשימה כבר יותר מדי זמן?",
        "טיול, הזמנה, רישיון — במה נתחיל?",
        "רק תגיד. אני אקח את זה עד הסוף.",
        "תגיד את זה פעם אחת. אני אהפוך את זה לתהליך שזז.",
        "גדול או קטן — במה נטפל קודם?",
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
        "המטרות, השיחות, הקבצים והפגישות שלך מפוזרים בעשרה מקומות — ומוחזקים יחד רק בזיכרון שלך. ONE נותן לכל כוונה מקום אחד לחיות בו, ומקדם אותה בשקט.",
    },
    concepts: {
      eyebrow: "הרעיון",
      h2: "שלוש מילים. מערכת אחת.",
      items: [
        {
          key: "ONE",
          h3: "נציג דיגיטלי",
          p: "הסוכן שלך. אתה מדבר במילים פשוטות; ONE מבין למה אתה מתכוון ופועל בשמך.",
        },
        {
          key: "יחידות",
          h3: "תהליכים חיים",
          p: "כל מטרה הופכת ליחידה — תהליך חי קטן שמחזיק את הצעדים, הקבצים, האנשים והמהלך הבא שלו.",
        },
        {
          key: "גלובל",
          h3: "הרשת",
          p: "יחידות מתחברות ל-ONEs אחרים — אנשים ועסקים — כך שדברים זזים בינך לבינם, לא בתוך אפליקציה אחת.",
        },
      ],
    },
    duo: {
      eyebrow: "סוכן אחד, זהויות רבות",
      h2: "ONE לחיים. ONE לעסק.",
      lede: "אותו ONE, בעולמות שונים — החלף זהות בלי להחליף אפליקציה.",
      life: {
        tag: "👤 ONE לחיים",
        h3: "החיים האישיים שלך, מטופלים",
        p: "בריאות, לימודים, בית, משפחה, סידורים, בירוקרטיה. תגיד מה אתה רוצה לקדם — ONE שומר כל תהליך חי ומראה לך את הצעד הבא.",
        list: [
          "קבע תורים ועקוב אחריהם עד הסוף",
          "רישיונות, מעבר דירה, טיולים, יעדי בריאות",
          "זוכר את האנשים, הקבצים וההחלטות שלך",
        ],
      },
      business: {
        tag: "🏢 ONE לעסק",
        h3: "גם לעסק שלך יש ONE",
        p: "תן לעסק שלך ONE משלו. ה-ONEs של הלקוחות מדברים איתו — הזמנות, עוקבים ורשימת לקוחות, בלי מוקד טלפוני.",
        list: [
          "הזמנות הופכות לכרטיסים לשני הצדדים",
          "ראה את העוקבים והלקוחות שלך",
          "תאר את העסק שלך פעם אחת — והוא באוויר",
        ],
      },
    },
    network: {
      eyebrow: "הרשת",
      h2pre: "ה-ONE שלך מדבר עם ה-ONE ",
      h2accent: "שלהם",
      h2post: ".",
      lede: "הזמן תספורת, שיעור נהיגה, הובלה — ה-ONE שלך מתחבר ל-ONE של העסק סביב התהליך עצמו, וההזמנה הופכת לכרטיס לשניכם.",
      yourOne: "ה-ONE שלך",
      personal: "אישי",
      hairAppt: "💈 תור לתספורת",
      connectedLabel: "מחוברים סביב התהליך",
      salonOne: "ה-ONE של מספרת שרה",
      business: "עסק",
      booking: "📅 הזמנה · שלישי 18:00",
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
          blurb: "קדם את הדברים הראשונים שלך — בלי חשבון.",
          feats: ["תהליכים ללא הגבלה", "זהות אישית אחת", "עובד במכשיר הזה"],
          cta: "התחל בחינם",
        },
        {
          name: "ONE פלוס",
          price: "$8",
          blurb: "כל החיים שלך, מסונכרנים וזכורים בכל מקום.",
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
          blurb: "תן לעסק שלך ONE שהלקוחות יכולים להגיע אליו.",
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
      lede: "הממשק אמיתי ומלא — כל מסך, מחווה ותהליך. הבינה והרשת המחוברת מגיעות בהמשך. אין צורך בחשבון כדי לנסות היום.",
    },
    final: {
      pre: "התחל עם ",
      accent: "דבר אחד",
      post: ".",
      lede: "תגיד ל-ONE מה חשוב. הוא יעזור לקדם את זה.",
      cta: "התחל עם ONE ←",
    },
    foot: { about: "אודות", support: "תמיכה", legal: "משפטי" },
    aria: {
      toLight: "עבור למצב בהיר",
      toDark: "עבור למצב כהה",
      switchLang: "החלף לאנגלית",
      langLabel: "EN",
    },
  },
};
