/**
 * Minimal i18n for the ONE01 Platform demo. `tr(lang, en)` returns the Hebrew
 * string for the English key when lang==='he', else the English text unchanged.
 * Brand names (Winzi, MixStar, …) are intentionally left untranslated.
 */
export type Lang = 'en' | 'he';

const HE: Record<string, string> = {
  // nav / tabs
  Home: 'בית', Market: 'שוק', Creator: 'יוצר', Create: 'יצירה',
  // section + drawer titles
  Projects: 'פרויקטים', Games: 'משחקים', Shows: 'תוכניות', Processes: 'תהליכים',
  Makers: 'יוצרים', 'Top players': 'שחקנים מובילים', Contestants: 'מתמודדים', Providers: 'ספקים',
  Launches: 'השקות', Tournaments: 'טורנירים', 'Airing now': 'משודר עכשיו', 'Coming up': 'בקרוב',
  'Platform stats': 'נתוני פלטפורמה', 'Winzi stats': 'נתוני Winzi', 'Show stats': 'נתוני התוכנית', 'Your ONE': 'ה-ONE שלך',
  'Across ONE01': 'ברחבי ONE01', 'Live on Winzi': 'חי ב-Winzi', 'Live on MixStar': 'חי ב-MixStar', Live: 'חי',
  'Your creations': 'היצירות שלך',
  // stat labels
  'Credits flowing': 'קרדיטים בתנועה', Accounts: 'חשבונות', 'Active now': 'פעילים כעת', 'Live products': 'מוצרים פעילים',
  'Credits in play': 'קרדיטים במשחק', Players: 'שחקנים', 'Live matches': 'משחקים חיים', 'Pots today': 'קופות היום',
  'Watching now': 'צופים כעת', 'Votes cast': 'הצבעות', 'Prize pool': 'קופת פרסים', 'Live shows': 'תוכניות חיות',
  'Active processes': 'תהליכים פעילים', 'Providers reached': 'ספקים שנוצרו', 'Saved via ONE': 'נחסך דרך ONE', 'Kept private': 'נשמר פרטי',
  // CTAs
  Open: 'פתח', Play: 'שחק', Watch: 'צפה', Continue: 'המשך', Get: 'קבל', Build: 'בנה', Collect: 'אסוף',
  Buy: 'קנה', Sell: 'מכור', Invest: 'השקע',
  // wallet
  Wallet: 'ארנק', 'Total balance': 'יתרה כוללת', Send: 'שלח', Receive: 'קבל', 'Top up': 'טען', Swap: 'המר',
  Holdings: 'אחזקות', Activity: 'פעילות', 'Cash balance': 'יתרת מזומן', 'per share': 'למניה', 'Balance': 'יתרה',
  // profile
  Profile: 'פרופיל', 'Edit profile': 'ערוך פרופיל', Friends: 'חברים', Posts: 'פוסטים', Level: 'דרגה',
  About: 'אודות', 'Log out': 'התנתק', '← ONE01 home': '← בית ONE01',
  // network
  Network: 'רשת', Followers: 'עוקבים', Following: 'נעקבים', Follow: 'עקוב', 'Follow back': 'עקוב בחזרה',
  'No one here yet': 'אין כאן אף אחד עדיין',
  'Follows you': 'עוקב אחריך', Creations: 'יצירות', 'on ONE01': 'ב-ONE01',
  // settings
  Settings: 'הגדרות', Preferences: 'העדפות', Account: 'חשבון',
  Notifications: 'התראות', 'Face ID': 'זיהוי פנים', 'Sounds & haptics': 'צלילים ורטט',
  Appearance: 'מראה', Light: 'בהיר', Dark: 'כהה', Language: 'שפה',
  'Privacy & disclosure': 'פרטיות וחשיפה', 'Connected accounts': 'חשבונות מקושרים', Legal: 'משפטי', Support: 'תמיכה',
  'Reset demo': 'אפס דמו',
  // misc copy
  'Updates from your ONE and apps': 'עדכונים מה-ONE והאפליקציות שלך',
  'Unlock the wallet with Face ID': 'פתיחת הארנק עם זיהוי פנים',
  'Taps, confirmations, alerts': 'הקשות, אישורים, התראות',
  'Light or dark ONE01': 'ONE01 בהיר או כהה',
  'Interface language': 'שפת הממשק',
  'In‑app · virtual': 'באפליקציה · וירטואלי',
  'virtual credits · 30d': 'קרדיטים וירטואליים · 30 ימים',
  // fresh creator listings (Creator → Market loop)
  'Fresh from creators': 'חדש מהיוצרים', You: 'אתה', 'Listed · live': 'מפורסם · פעיל', earned: 'הורווח',
  Owned: 'ברשותך', 'Nothing to collect yet': 'אין מה לאסוף עדיין',
  'Publish in Creator — your work lists here': 'פרסם ב-Creator — העבודה שלך תופיע כאן',
  // creation studio (chat-style Creator) — 'Creations' already defined in the network section
  'Make on': 'צור ב-', From: 'מ-', 'Rarity · editions': 'נדירות · מהדורות',
  'Name it…': 'תן שם…', 'Surprise me': 'הפתע אותי', 'Not enough credits': 'אין מספיק קרדיטים',
  Change: 'שנה', 'Make another': 'צור עוד', 'Make your first creation': 'צור את היצירה הראשונה שלך',
  'Describe it, or pick below…': 'תאר, או בחר למטה…', New: 'חדש', Mine: 'שלי', Done: 'סיום',
  'Nothing yet — make your first creation above.': 'עדיין כלום — צור את היצירה הראשונה שלך למעלה.',
  'Pick above, or type…': 'בחר למעלה, או הקלד…', 'Tap a button above': 'הקש על כפתור למעלה',
  'Sure — change it.': 'בטח — בוא נשנה.',
  // ventures (ONE01 factory)
  Stage: 'שלב', Funding: 'גיוס', 'raised of': 'גויס מתוך', 'At final stage': 'בשלב האחרון',
  'Advance to': 'קדם ל-', 'Pitch deck kit': 'ערכת מצגת', 'Buy in the Market': 'קנה בשוק',
  'View in Projects': 'צפה בפרויקטים', 'No ventures yet — launch one above.': 'אין עדיין מיזמים — השק אחד למעלה.',
  'Your ventures': 'המיזמים שלך', 'View venture': 'צפה במיזם',
  // search
  Search: 'חיפוש', Cancel: 'ביטול', 'No results': 'אין תוצאות',
  'Search games, projects, listings…': 'חיפוש משחקים, פרויקטים, פריטים…',
  // notifications ('Notifications' already defined above)
  'Nothing new': 'אין חדש',
};

export function tr(lang: Lang, en: string): string {
  return lang === 'he' ? (HE[en] ?? en) : en;
}
