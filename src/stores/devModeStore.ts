import { create } from 'zustand';
import { storage } from '../utils/session';

const DEV_PROFILE_KEY = 'one_dev_preview_profile';

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
  initialized: boolean;
  initialize: () => Promise<void>;
  setPreviewProfile: (profile: DevPreviewProfile) => Promise<void>;
};

const isPreviewProfile = (value: unknown): value is DevPreviewProfile =>
  value === 'new_user' ||
  value === 'consumer' ||
  value === 'student' ||
  value === 'creator' ||
  value === 'teacher_business' ||
  value === 'pro_user' ||
  value === 'max_user';

export const useDevModeStore = create<DevModeStore>((set) => ({
  previewProfile: 'new_user',
  initialized: false,
  initialize: async () => {
    try {
      const raw = await storage.getItem(DEV_PROFILE_KEY);
      const profile = isPreviewProfile(raw) ? raw : 'new_user';
      set({ previewProfile: profile, initialized: true });
    } catch {
      set({ previewProfile: 'new_user', initialized: true });
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
}));

