/**
 * תוכן לנדינג (שורת הדיבור המתחלפת) לפי גרסת הצגה.
 * classic — הקיים במוצר · composer — הסבר מאוחד על ערך המוצר והזרימה (לצפייה והשוואה).
 */

export type OnboardingPresentationVariant = 'classic' | 'composer';

export const ONBOARD_VOICE_STEPS_BY_VARIANT: Record<
  OnboardingPresentationVariant,
  { he: readonly string[]; en: readonly string[] }
> = {
  classic: {
    he: [
      'שלום, אני ONE',
      'אתה לא צריך לחפש, להשוות או לתאם\nפשוט תגיד מה אתה רוצה',
      'אני בונה את הדרך\nמחבר אנשים, כלים ושלבים — בשבילך',
      'מה תרצה להגשים עכשיו?',
    ],
    en: [
      "Hello, I'm ONE",
      "You don't need to search, compare, or coordinate.\nJust say what you want.",
      'I build the path.\nConnecting people, tools, and steps—for you.',
      'What do you want to achieve right now?',
    ],
  },
  composer: {
    he: [
      'שלום, אני ONE',
      'אתה לא צריך לחפש, להשוות או לתאם\nפשוט תגיד מה אתה רוצה',
      'אני בונה את הדרך\nמחבר אנשים, כלים ושלבים — בשבילך',
      'מה תרצה להגשים עכשיו?',
    ],
    en: [
      "Hello, I'm ONE",
      "You don't need to search, compare, or coordinate.\nJust say what you want.",
      'I build the path.\nConnecting people, tools, and steps—for you.',
      'What do you want to achieve right now?',
    ],
  },
};

export function getVoiceStepsForVariant(
  variant: OnboardingPresentationVariant,
  languageHe: boolean
): readonly string[] {
  const block = ONBOARD_VOICE_STEPS_BY_VARIANT[variant];
  return languageHe ? block.he : block.en;
}
