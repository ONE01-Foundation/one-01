// The Global catalog — a curated, Wolt-style seed of canonical Units organized
// by life category. This is what makes Global feel like a real discovery surface
// even before the community DB (global_units) fills: categories to browse,
// "popular" and "new" rows, and rich cards. Real global_units from the DB are
// merged on top of these at render time (deduped by topic key).

export interface UnitCategory {
  key: string;
  emoji: string;
  he: string;
  en: string;
}

export interface CatalogUnit {
  key: string; // stable topic key (also the dedupe key vs. DB units)
  cat: string; // UnitCategory.key
  emoji: string;
  he: string;
  en: string;
  type: string;
  steps: number; // how many steps the ready-made plan has (for the card meta)
  uses: number; // seeded popularity — drives the "Popular now" ordering
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  { key: "health", emoji: "💪", he: "בריאות וכושר", en: "Health & fitness" },
  { key: "learning", emoji: "🎓", he: "לימודים", en: "Learning" },
  { key: "home", emoji: "🏠", he: "בית ומעבר", en: "Home & moving" },
  { key: "events", emoji: "🎉", he: "אירועים", en: "Events" },
  { key: "admin", emoji: "📋", he: "בירוקרטיה", en: "Admin & docs" },
  { key: "business", emoji: "💼", he: "עסקים", en: "Business" },
  { key: "travel", emoji: "✈️", he: "נסיעות", en: "Travel" },
  { key: "money", emoji: "💰", he: "כספים", en: "Money" },
  { key: "family", emoji: "👨‍👩‍👧", he: "משפחה", en: "Family" },
  { key: "pets", emoji: "🐾", he: "חיות", en: "Pets" },
];

export const CATALOG_UNITS: CatalogUnit[] = [
  // Health
  { key: "weight-gain", cat: "health", emoji: "💪", he: "עלייה במשקל", en: "Weight gain", type: "health", steps: 6, uses: 1280 },
  { key: "run-10k", cat: "health", emoji: "🏃", he: "ריצת 10 ק״מ", en: "Run 10K", type: "health", steps: 5, uses: 940 },
  { key: "nutrition", cat: "health", emoji: "🥗", he: "תזונה נכונה", en: "Eat well", type: "health", steps: 5, uses: 760 },
  { key: "quit-smoking", cat: "health", emoji: "🚭", he: "להפסיק לעשן", en: "Quit smoking", type: "health", steps: 6, uses: 610 },
  // Learning
  { key: "driving-license", cat: "learning", emoji: "🚗", he: "רישיון נהיגה", en: "Driving license", type: "learning", steps: 7, uses: 2100 },
  { key: "learn-english", cat: "learning", emoji: "🇬🇧", he: "ללמוד אנגלית", en: "Learn English", type: "learning", steps: 6, uses: 1350 },
  { key: "learn-code", cat: "learning", emoji: "💻", he: "ללמוד תכנות", en: "Learn to code", type: "learning", steps: 8, uses: 1180 },
  { key: "learn-guitar", cat: "learning", emoji: "🎸", he: "ללמוד גיטרה", en: "Learn guitar", type: "learning", steps: 6, uses: 540 },
  // Home & moving
  { key: "moving-home", cat: "home", emoji: "📦", he: "מעבר דירה", en: "Moving home", type: "moving", steps: 8, uses: 1620 },
  { key: "renovation", cat: "home", emoji: "🔧", he: "שיפוץ", en: "Renovation", type: "home", steps: 9, uses: 880 },
  { key: "home-design", cat: "home", emoji: "🛋️", he: "עיצוב הבית", en: "Home design", type: "home", steps: 6, uses: 470 },
  { key: "declutter", cat: "home", emoji: "🧹", he: "סידור הבית", en: "Declutter", type: "home", steps: 5, uses: 360 },
  // Events
  { key: "bachelor-party", cat: "events", emoji: "🍻", he: "מסיבת רווקים", en: "Bachelor party", type: "event", steps: 6, uses: 990 },
  { key: "wedding", cat: "events", emoji: "💍", he: "חתונה", en: "Wedding", type: "event", steps: 12, uses: 1440 },
  { key: "birthday", cat: "events", emoji: "🎂", he: "יום הולדת", en: "Birthday", type: "event", steps: 5, uses: 720 },
  { key: "house-party", cat: "events", emoji: "🥳", he: "מסיבה בבית", en: "House party", type: "event", steps: 5, uses: 430 },
  // Admin & docs
  { key: "renew-passport", cat: "admin", emoji: "🛂", he: "חידוש דרכון", en: "Renew passport", type: "bureaucracy", steps: 5, uses: 1710 },
  { key: "car-test", cat: "admin", emoji: "🚙", he: "טסט לרכב", en: "Car test (MOT)", type: "bureaucracy", steps: 5, uses: 1230 },
  { key: "power-of-attorney", cat: "admin", emoji: "📄", he: "ייפוי כוח מתמשך", en: "Power of attorney", type: "bureaucracy", steps: 6, uses: 380 },
  { key: "social-security", cat: "admin", emoji: "🏛️", he: "ביטוח לאומי", en: "Social security claim", type: "bureaucracy", steps: 6, uses: 520 },
  // Business
  { key: "open-business", cat: "business", emoji: "🏢", he: "פתיחת עסק", en: "Open a business", type: "business", steps: 8, uses: 830 },
  { key: "business-lead", cat: "business", emoji: "📈", he: "ליד עסקי", en: "Chase a business lead", type: "business", steps: 5, uses: 640 },
  { key: "marketing", cat: "business", emoji: "📣", he: "קמפיין שיווק", en: "Marketing campaign", type: "business", steps: 7, uses: 410 },
  { key: "bookkeeping", cat: "business", emoji: "🧾", he: "הנהלת חשבונות", en: "Bookkeeping setup", type: "business", steps: 6, uses: 300 },
  // Travel
  { key: "plan-trip", cat: "travel", emoji: "✈️", he: "תכנון טיול", en: "Plan a trip", type: "travel", steps: 7, uses: 1520 },
  { key: "vacation", cat: "travel", emoji: "🏝️", he: "חופשה", en: "Vacation", type: "travel", steps: 6, uses: 980 },
  { key: "backpacking", cat: "travel", emoji: "🎒", he: "טיול תרמילאים", en: "Backpacking", type: "travel", steps: 8, uses: 540 },
  // Money
  { key: "saving-plan", cat: "money", emoji: "💰", he: "תוכנית חיסכון", en: "Saving plan", type: "finance", steps: 5, uses: 870 },
  { key: "tax-refund", cat: "money", emoji: "📉", he: "החזר מס", en: "Tax refund", type: "finance", steps: 5, uses: 1120 },
  { key: "mortgage", cat: "money", emoji: "🏦", he: "משכנתא", en: "Mortgage", type: "finance", steps: 9, uses: 690 },
  // Family
  { key: "find-daycare", cat: "family", emoji: "👶", he: "מציאת גן", en: "Find daycare", type: "family", steps: 5, uses: 560 },
  { key: "school-registration", cat: "family", emoji: "🎒", he: "רישום לבית ספר", en: "School registration", type: "family", steps: 5, uses: 420 },
  { key: "elder-care", cat: "family", emoji: "👵", he: "טיפול בהורים", en: "Elder care", type: "family", steps: 6, uses: 340 },
  // Pets
  { key: "dog-training", cat: "pets", emoji: "🐕", he: "אילוף כלב", en: "Dog training", type: "pets", steps: 6, uses: 480 },
  { key: "vet-care", cat: "pets", emoji: "🐾", he: "טיפול וטרינרי", en: "Vet care", type: "pets", steps: 4, uses: 260 },
];
