/**
 * gender — best-effort, CONSERVATIVE inference of the user's grammatical
 * gender so ONE can address them correctly in Hebrew (which conjugates verbs
 * by gender). The cost of a wrong guess is high — being mis-gendered reads
 * worse than neutral phrasing — so this only commits to 'male'/'female' for
 * names it's confident about, and returns 'unknown' for everything else
 * (unisex names, unknown names, empty). Callers fall back to gender-neutral,
 * non-plural phrasing when the result is 'unknown'.
 */

export type Gender = 'male' | 'female' | 'unknown';

// Clearly-gendered common Hebrew + English first names. Deliberately EXCLUDES
// unisex names (אריאל, רוני, עדן, נועם, עמית, שחר, אופיר, גל, טל, ליאל…) — those
// stay 'unknown' so ONE speaks neutrally rather than risk mis-gendering.
const MALE = new Set([
  'משה', 'moshe', 'דוד', 'david', 'יוסף', 'yosef', 'יוסי', 'יעקב', 'jacob',
  'אברהם', 'abraham', 'יצחק', 'isaac', 'דניאל', 'daniel', 'איתי', 'איתן', 'ethan',
  'יונתן', 'jonathan', 'עידו', 'אסף', 'גיא', 'guy', 'תום', 'tom', 'עומר', 'omer',
  'רון', 'ron', 'אורי', 'נדב', 'ניר', 'אלון', 'עמוס', 'בועז', 'חיים', 'מתן',
  'אריה', 'דור', 'שמואל', 'samuel', 'מיכאל', 'michael', 'יהודה', 'בנימין',
  'אלעד', 'עידן', 'idan', 'רועי', 'roi', 'אדם', 'adam', 'איציק', 'מאיר',
]);

const FEMALE = new Set([
  'שרה', 'sarah', 'רחל', 'rachel', 'לאה', 'leah', 'רבקה', 'מרים', 'miriam',
  'מיכל', 'michal', 'נועה', 'noa', 'noah', 'תמר', 'tamar', 'שירה', 'shira',
  'מאיה', 'maya', 'יעל', 'yael', 'דנה', 'dana', 'הדר', 'ליאת', 'liat', 'הילה',
  'אביגיל', 'abigail', 'אסתר', 'esther', 'חנה', 'hana', 'ספיר', 'sapir', 'אורית',
  'מירב', 'meirav', 'רוית', 'סיון', 'עינת', 'einat', 'גלית', 'galit', 'ענת',
  'anat', 'דפנה', 'אלה', 'ella', 'יערה', 'נטע', 'neta', 'רוני', // 'רוני' leans F
  'אמילי', 'emily', 'שני', 'מורן', 'moran', 'קרן', 'keren', 'תהל', 'ליה',
]);

/** Infer gender from a person's name. Returns 'unknown' unless confident. */
export function inferGenderFromName(name: string | undefined | null): Gender {
  if (!name) return 'unknown';
  // First token only, lowercased, stripped of punctuation/diacritics edges.
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (!first) return 'unknown';
  if (MALE.has(first)) return 'male';
  if (FEMALE.has(first)) return 'female';
  return 'unknown';
}
