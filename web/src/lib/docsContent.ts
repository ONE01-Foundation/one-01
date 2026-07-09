// Content for the footer doc panel (About / Support / Legal) — a GitBook-style
// floating side panel. One dictionary per language; each group holds a few
// short "pages" rendered as a title + paragraphs.

import type { Lang } from "./landingCopy";

export type DocGroupId = "about" | "support" | "legal";

export interface DocPage {
  id: string;
  title: string;
  body: string[];
}
export interface DocGroup {
  id: DocGroupId;
  title: string;
  pages: DocPage[];
}
export interface DocsCopy {
  panelTitle: string;
  close: string;
  groups: DocGroup[];
}

export const DOCS: Record<Lang, DocsCopy> = {
  en: {
    panelTitle: "ONE",
    close: "Close",
    groups: [
      {
        id: "about",
        title: "About",
        pages: [
          {
            id: "what",
            title: "What ONE is",
            body: [
              "ONE is a digital representative — a single intelligent layer that stands between your intentions and the systems you have to deal with to make them real.",
              "You state what you want in plain language. ONE turns it into a living process: it knows the steps, gathers the relevant information, talks to the other parties involved, and carries the whole thing toward done.",
              "One representative, across every part of your life and your business. The same ONE, different worlds — you switch identities without switching tools.",
            ],
          },
          {
            id: "why",
            title: "Why we're building it",
            body: [
              "Today, getting anything meaningful done means becoming your own integration layer — chasing apps, forms, threads, and people, and holding the whole picture in your head.",
              "We think that's backwards. Software should represent you, not add to the pile you have to manage. ONE is our attempt to build the layer that finally does.",
              "It's early, and honest: the interface is real and complete today. The intelligence that acts for you, and the network that connects ONEs to each other, are rolling out next.",
            ],
          },
        ],
      },
      {
        id: "support",
        title: "Support",
        pages: [
          {
            id: "start",
            title: "Getting started",
            body: [
              "You don't need an account to begin. Open ONE, tell it a single thing you want to move forward, and it starts turning that intention into a process.",
              "Sign in whenever you're ready — with Google or a magic link — and your processes sync and follow you across every device.",
            ],
          },
          {
            id: "contact",
            title: "Contact us",
            body: [
              "Questions, feedback, or something not working? Email us at hello@one01.io and a real person will get back to you.",
              "We read everything — early feedback shapes what we build next.",
            ],
          },
          {
            id: "faq",
            title: "FAQ",
            body: [
              "Is it free? — Yes. You can put unlimited processes in ONE's hands on the free plan, no account required.",
              "Does my data sync? — Once you sign in, your processes are saved to the cloud and follow you across devices.",
              "Is the AI live? — The interface is fully real today; the intelligence that acts on your behalf is rolling out in stages.",
            ],
          },
        ],
      },
      {
        id: "legal",
        title: "Legal",
        pages: [
          {
            id: "privacy",
            title: "Privacy Policy",
            body: [
              "We collect only what ONE needs to work for you: your email address when you sign in, and the processes and messages you create so we can save them and sync them across your devices.",
              "We don't sell your data, and we don't share it with advertisers. Your processes are yours.",
              "You can export or delete your data at any time from Settings. Questions about privacy? Email hello@one01.io.",
            ],
          },
          {
            id: "terms",
            title: "Terms of Service",
            body: [
              "ONE is currently an open preview, provided as-is while we build. Features may change, and you should keep your own copy of anything critical.",
              "You own the content you create in ONE. You agree to use the service lawfully and not to misuse it or attempt to disrupt it for others.",
              "Continued use means you accept these terms. We'll post material changes here before they take effect.",
            ],
          },
          {
            id: "cookies",
            title: "Cookie Policy",
            body: [
              "We keep things minimal. ONE uses local storage on your device to remember your theme, language, and sign-in session — nothing more.",
              "We don't use third-party advertising or cross-site tracking cookies.",
            ],
          },
        ],
      },
    ],
  },

  he: {
    panelTitle: "ONE",
    close: "סגור",
    groups: [
      {
        id: "about",
        title: "אודות",
        pages: [
          {
            id: "what",
            title: "מה זה ONE",
            body: [
              "ONE הוא נציג דיגיטלי — שכבה חכמה אחת שעומדת בין הכוונות שלך לבין המערכות שאתה נאלץ להתמודד איתן כדי להפוך אותן למציאות.",
              "אתה אומר מה אתה רוצה במילים פשוטות. ONE הופך את זה לתהליך חי: הוא יודע את הצעדים, אוסף את המידע הרלוונטי, מדבר עם הצדדים המעורבים, ומקדם את כל העניין עד הסוף.",
              "נציג אחד, בכל חלק בחיים שלך ובעסק שלך. אותו ONE, עולמות שונים — אתה מחליף זהות בלי להחליף כלים.",
            ],
          },
          {
            id: "why",
            title: "למה אנחנו בונים את זה",
            body: [
              "היום, כדי לקדם משהו משמעותי אתה הופך בעצמך לשכבת החיבור — רודף אחרי אפליקציות, טפסים, התכתבויות ואנשים, ומחזיק את כל התמונה בראש.",
              "אנחנו חושבים שזה הפוך. תוכנה צריכה לייצג אותך, לא להוסיף לערימה שאתה צריך לנהל. ONE הוא הניסיון שלנו לבנות סוף סוף את השכבה הזאת.",
              "זה מוקדם, וזה כן: הממשק אמיתי ומלא כבר היום. הבינה שפועלת בשבילך, והרשת שמחברת בין ה-ONEs, מגיעות בשלב הבא.",
            ],
          },
        ],
      },
      {
        id: "support",
        title: "תמיכה",
        pages: [
          {
            id: "start",
            title: "איך מתחילים",
            body: [
              "לא צריך חשבון כדי להתחיל. פתח את ONE, תגיד לו דבר אחד שאתה רוצה לקדם, והוא מתחיל להפוך את הכוונה הזאת לתהליך.",
              "התחבר מתי שנוח לך — עם Google או קישור קסם — והתהליכים שלך מסתנכרנים ונשארים איתך בכל מכשיר.",
            ],
          },
          {
            id: "contact",
            title: "צור קשר",
            body: [
              "שאלות, משוב, או משהו לא עובד? כתוב לנו ל-hello@one01.io ואדם אמיתי יחזור אליך.",
              "אנחנו קוראים הכול — משוב מוקדם מעצב את מה שנבנה בהמשך.",
            ],
          },
          {
            id: "faq",
            title: "שאלות נפוצות",
            body: [
              "זה בחינם? — כן. אפשר לשים תהליכים ללא הגבלה בידיים של ONE בתוכנית החינמית, בלי חשבון.",
              "המידע שלי מסתנכרן? — ברגע שאתה מתחבר, התהליכים שלך נשמרים בענן ונשארים איתך בכל מכשיר.",
              "הבינה כבר פעילה? — הממשק אמיתי לגמרי היום; הבינה שפועלת בשמך מגיעה בשלבים.",
            ],
          },
        ],
      },
      {
        id: "legal",
        title: "משפטי",
        pages: [
          {
            id: "privacy",
            title: "מדיניות פרטיות",
            body: [
              "אנחנו אוספים רק את מה ש-ONE צריך כדי לעבוד בשבילך: את כתובת האימייל שלך כשאתה מתחבר, ואת התהליכים וההודעות שאתה יוצר כדי שנוכל לשמור ולסנכרן אותם בין המכשירים שלך.",
              "אנחנו לא מוכרים את המידע שלך, ולא משתפים אותו עם מפרסמים. התהליכים שלך שייכים לך.",
              "אפשר לייצא או למחוק את המידע שלך בכל רגע מההגדרות. שאלות על פרטיות? כתוב ל-hello@one01.io.",
            ],
          },
          {
            id: "terms",
            title: "תנאי שימוש",
            body: [
              "ONE נמצא כרגע בתצוגה פתוחה, ומסופק כמו שהוא בזמן שאנחנו בונים. תכונות עשויות להשתנות, וכדאי לשמור עותק משלך לכל דבר קריטי.",
              "התוכן שאתה יוצר ב-ONE שייך לך. אתה מסכים להשתמש בשירות באופן חוקי ולא לנצל אותו לרעה או לשבש אותו עבור אחרים.",
              "המשך השימוש מהווה הסכמה לתנאים האלה. נפרסם כאן שינויים מהותיים לפני שייכנסו לתוקף.",
            ],
          },
          {
            id: "cookies",
            title: "מדיניות עוגיות",
            body: [
              "אנחנו שומרים על המינימום. ONE משתמש באחסון מקומי במכשיר שלך כדי לזכור את ערכת הנושא, השפה והתחברות — לא יותר מזה.",
              "אנחנו לא משתמשים בעוגיות פרסום של צד שלישי או במעקב חוצה-אתרים.",
            ],
          },
        ],
      },
    ],
  },
};
