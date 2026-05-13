import { create } from 'zustand';
import { storage } from '../utils/session';
import type { OnboardingPresentationVariant } from '../onboarding/onboardingPresentationCopy';

const STORAGE_KEY = 'one_onboarding_presentation_variant';

const isVariant = (v: unknown): v is OnboardingPresentationVariant => v === 'classic' || v === 'composer';

type OnboardingPresentationStore = {
  variant: OnboardingPresentationVariant;
  initialized: boolean;
  initialize: () => Promise<void>;
  setVariant: (variant: OnboardingPresentationVariant) => Promise<void>;
};

export const useOnboardingPresentationStore = create<OnboardingPresentationStore>((set) => ({
  variant: 'classic',
  initialized: false,

  initialize: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      const variant = isVariant(raw) ? raw : 'classic';
      set({ variant, initialized: true });
    } catch {
      set({ variant: 'classic', initialized: true });
    }
  },

  setVariant: async (variant) => {
    try {
      await storage.setItem(STORAGE_KEY, variant);
    } catch {
      /* ignore */
    }
    set({ variant });
  },
}));
