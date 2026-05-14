import { create } from 'zustand';
import { storage } from '../utils/session';

const DEV_PROFILE_KEY = 'one_dev_preview_profile';
const DEV_ALL_WORLDS_EXAMPLES_KEY = 'one_dev_all_worlds_examples';
const DEV_AI_RUNTIME_KEY = 'one_dev_ai_runtime';

export type DevPreviewProfile =
  | 'new_user'
  | 'consumer'
  | 'student'
  | 'creator'
  | 'teacher_business'
  | 'pro_user'
  | 'max_user';

type DevModeStore = {
  previewProfile: DevPreviewProfile;
  showAllWorldsExamples: boolean;
  useAiRuntime: boolean;
  syntheticHomeApplyNonce: number;
  initialized: boolean;
  initialize: () => Promise<void>;
  setPreviewProfile: (profile: DevPreviewProfile) => Promise<void>;
  setShowAllWorldsExamples: (value: boolean) => Promise<void>;
  toggleAiRuntime: () => void;
  requestSyntheticHomeProfile: () => void;
};

const isPreviewProfile = (value: unknown): value is DevPreviewProfile =>
  value === 'new_user' ||
  value === 'consumer' ||
  value === 'student' ||
  value === 'creator' ||
  value === 'teacher_business' ||
  value === 'pro_user' ||
  value === 'max_user';

export const useDevModeStore = create<DevModeStore>((set, get) => ({
  previewProfile: 'new_user',
  showAllWorldsExamples: false,
  useAiRuntime: false,
  syntheticHomeApplyNonce: 0,
  initialized: false,
  initialize: async () => {
    try {
      const raw = await storage.getItem(DEV_PROFILE_KEY);
      const profile = isPreviewProfile(raw) ? raw : 'new_user';
      let allWorlds = false;
      try {
        const rawAll = await storage.getItem(DEV_ALL_WORLDS_EXAMPLES_KEY);
        allWorlds = rawAll === '1' || rawAll === 'true';
      } catch {
        allWorlds = false;
      }
      let aiRuntime = false;
      try {
        const rawAi = await storage.getItem(DEV_AI_RUNTIME_KEY);
        aiRuntime = rawAi === '1' || rawAi === 'true';
      } catch {
        aiRuntime = false;
      }
      set({ previewProfile: profile, showAllWorldsExamples: allWorlds, useAiRuntime: aiRuntime, initialized: true });
    } catch {
      set({ previewProfile: 'new_user', showAllWorldsExamples: false, useAiRuntime: false, initialized: true });
    }
  },
  setPreviewProfile: async (profile) => {
    try {
      await storage.setItem(DEV_PROFILE_KEY, profile);
    } catch {
      // ignore persistence failure in dev preview mode
    }
    set({ previewProfile: profile });
  },
  setShowAllWorldsExamples: async (value) => {
    try {
      await storage.setItem(DEV_ALL_WORLDS_EXAMPLES_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ showAllWorldsExamples: value });
  },
  toggleAiRuntime: () => {
    const next = !get().useAiRuntime;
    storage.setItem(DEV_AI_RUNTIME_KEY, next ? '1' : '0').catch(() => {});
    set({ useAiRuntime: next });
  },
  requestSyntheticHomeProfile: () =>
    set((s) => ({ syntheticHomeApplyNonce: s.syntheticHomeApplyNonce + 1 })),
}));
