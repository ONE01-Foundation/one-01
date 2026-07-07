/**
 * Agent appearance + personality — user-chosen "skins" for ONE's Orb face and
 * a voice/character that shapes how ONE talks. Both are picked in Settings and
 * persisted.
 *
 * Skins are ACCESSORIES + EYE-SHAPE, not colour swaps: ONE's face stays its
 * central black (the theme's `colors.circle`) always. A skin can add glasses or
 * a beanie and switch the eyes between round and square — small touches of
 * character that keep the brand face recognisable.
 */

export type EyeShape = 'round' | 'square';
export type Accessory = 'none' | 'glasses' | 'hat';

export interface OrbSkin {
  id: string;
  labelHe: string;
  labelEn: string;
  eyeShape: EyeShape;
  accessory: Accessory;
  /** Accent colour for the accessory (glasses frame / beanie). The FACE stays
   *  the theme's central black — accents only tint the accessory. */
  accent?: string;
  /** Optional face colour override. Omitted = keep the theme's black face.
   *  Reserved; current skins all keep the face black per design. */
  face?: string;
}

/** "classic" is the default — round eyes, no accessory, black face. */
export const ORB_SKINS: OrbSkin[] = [
  { id: 'classic', labelHe: 'קלאסי', labelEn: 'Classic', eyeShape: 'round', accessory: 'none' },
  { id: 'square', labelHe: 'מרובע', labelEn: 'Square', eyeShape: 'square', accessory: 'none' },
  { id: 'glasses', labelHe: 'משקפיים', labelEn: 'Glasses', eyeShape: 'round', accessory: 'glasses', accent: '#7DD3FC' },
  { id: 'scholar', labelHe: 'מלומד', labelEn: 'Scholar', eyeShape: 'square', accessory: 'glasses', accent: '#FCD34D' },
  { id: 'beanie', labelHe: 'כובע', labelEn: 'Beanie', eyeShape: 'round', accessory: 'hat', accent: '#F87171' },
];

const DEFAULT_SKIN = ORB_SKINS[0];

/** Resolve a persisted skin id — including the legacy 'graphite'/colour ids from
 *  the earlier colour-based model — to a full skin. Unknown ids fall back to
 *  Classic so the face is always valid. */
export function resolveSkin(id: string | undefined): OrbSkin {
  if (!id || id === 'graphite') return DEFAULT_SKIN;
  return ORB_SKINS.find((x) => x.id === id) ?? DEFAULT_SKIN;
}

export interface AgentPersonality {
  id: string;
  labelHe: string;
  labelEn: string;
  /** One-line tone instruction injected into the AI prompt. */
  promptHe: string;
  promptEn: string;
}

/** "balanced" is the default — no extra instruction, ONE's baseline voice. */
export const AGENT_PERSONALITIES: AgentPersonality[] = [
  {
    id: 'balanced',
    labelHe: 'מאוזן',
    labelEn: 'Balanced',
    promptHe: '',
    promptEn: '',
  },
  {
    id: 'calm',
    labelHe: 'רגוע',
    labelEn: 'Calm',
    promptHe: 'דבר בטון רגוע ומרגיע, משפטים קצרים, בלי לחץ ובלי דחיפות.',
    promptEn: 'Speak in a calm, reassuring tone; short sentences; never pushy or urgent.',
  },
  {
    id: 'direct',
    labelHe: 'ישיר',
    labelEn: 'Direct',
    promptHe: 'היה ישיר ותמציתי — בלי מילים מיותרות, ישר לעניין ולצעד הבא.',
    promptEn: 'Be direct and concise — no fluff, straight to the point and the next step.',
  },
  {
    id: 'warm',
    labelHe: 'חם',
    labelEn: 'Warm',
    promptHe: 'היה חם ומעודד, אישי, והכר במאמץ של המשתמש.',
    promptEn: "Be warm and encouraging, personal, and acknowledge the user's effort.",
  },
  {
    id: 'witty',
    labelHe: 'שנון',
    labelEn: 'Witty',
    promptHe: 'הוסף קלילות ושנינות עדינה מדי פעם, בלי להגזים — עדיין מקצועי ומועיל.',
    promptEn: 'Add a light, occasionally witty touch — never overdone, still professional and useful.',
  },
];

/** Resolve a personality id to its tone instruction, or undefined for the
 *  default (balanced) voice. */
export function personalityPrompt(id: string | undefined, lang: 'he' | 'en'): string | undefined {
  const p = AGENT_PERSONALITIES.find((x) => x.id === id);
  if (!p || p.id === 'balanced') return undefined;
  const line = lang === 'he' ? p.promptHe : p.promptEn;
  return line || undefined;
}
