/**
 * Per-product onboarding config for the shared 3-screen skeleton
 * (Splash → Welcome carousel → Connect). Consumed by
 * `components/one01/ProductOnboarding.tsx`.
 *
 * The skeleton is identical for every product; only this config changes:
 *   • mode  — 'light' (white bg) or 'dark' (black bg)
 *   • glow  — the rounded gradient glow color at the bottom (per product)
 *   • mark  — the centered brand mark
 *   • slides — the Welcome carousel (title + subtitle + two floating emoji)
 *   • connect — logo style + tagline for the sign-in screen
 */
import type { MarkId, ProductId } from './platform';

export type OnboardMode = 'light' | 'dark';

export interface OnboardSlide {
  title: string;
  subtitle: string;
  emojiTop: string;
  emojiBottom: string;
}

export interface OnboardConfig {
  id: ProductId | 'one01';
  name: string;
  mode: OnboardMode;
  /** Brand accent (name color on the Connect screen, dots, focus rings). */
  accent: string;
  /** Rounded gradient glow color anchored at the bottom. */
  glow: string;
  mark: MarkId;
  /** Connect logo layout: 'horizontal' uses the ONE01 wordmark; 'vertical' is mark-over-name. */
  logo: 'horizontal' | 'vertical';
  /** Uppercase tagline under the Connect logo. */
  connectTagline: string;
  /** CTA label on the LAST welcome slide (earlier slides say "Next"). */
  ctaLabel: string;
  /** Dismiss affordance on Welcome: '✕' icon or a "Skip" text link. */
  dismiss: 'close' | 'skip';
  slides: OnboardSlide[];
}

export const ONBOARDING: Record<OnboardConfig['id'], OnboardConfig> = {
  one01: {
    id: 'one01',
    name: 'ONE01',
    mode: 'light',
    accent: '#111318',
    glow: '#6366F1',
    mark: 'one01',
    logo: 'horizontal',
    connectTagline: 'START YOUR VENTURE',
    ctaLabel: 'Connect',
    dismiss: 'close',
    slides: [
      { title: 'Realize your ideas', subtitle: 'a unified system for founders and ventures', emojiTop: '🚀', emojiBottom: '🧠' },
      { title: 'Buy a template', subtitle: 'websites and apps, spun up in one flow', emojiTop: '🧩', emojiBottom: '🛍️' },
      { title: 'Manage everything', subtitle: 'one wallet, one identity, every venture', emojiTop: '📈', emojiBottom: '◉' },
    ],
  },
  one: {
    id: 'one',
    name: 'ONE',
    mode: 'dark',
    accent: '#2ED8A7',
    glow: '#10B981',
    mark: 'one',
    logo: 'vertical',
    connectTagline: 'YOUR DIGITAL SELF',
    ctaLabel: 'Connect',
    dismiss: 'skip',
    slides: [
      { title: 'Your representative', subtitle: 'ONE speaks for you — and reveals only what you allow', emojiTop: '🤝', emojiBottom: '🪪' },
      { title: 'Intent becomes action', subtitle: 'ONE turns what you need into living processes', emojiTop: '◎', emojiBottom: '✨' },
    ],
  },
  winzi: {
    id: 'winzi',
    name: 'WINZI',
    mode: 'dark',
    accent: '#F9D800',
    glow: '#3B5BDB',
    mark: 'winzi',
    logo: 'vertical',
    connectTagline: 'PLAY TO WIN',
    ctaLabel: 'Next',
    dismiss: 'close',
    slides: [
      { title: 'Play your favorite games', subtitle: 'Turn your skills into cash', emojiTop: '⚽', emojiBottom: '🕹️' },
      { title: 'Climb the ranks', subtitle: 'Battles, brackets and real stakes', emojiTop: '🏆', emojiBottom: '🎮' },
    ],
  },
  mixstar: {
    id: 'mixstar',
    name: 'MIXSTAR',
    mode: 'dark',
    accent: '#A98BFF',
    glow: '#8B5CF6',
    mark: 'mixstar',
    logo: 'vertical',
    connectTagline: 'RUN THE SHOW',
    ctaLabel: 'Connect',
    dismiss: 'skip',
    slides: [
      { title: 'Watch your favorite stars', subtitle: 'interact with AI reality TV shows', emojiTop: '🎥', emojiBottom: '🍿' },
      { title: 'Vote and change the show', subtitle: 'your calls move the story', emojiTop: '🗳️', emojiBottom: '✨' },
    ],
  },
};

export function onboardingFor(id: OnboardConfig['id']): OnboardConfig {
  return ONBOARDING[id];
}
