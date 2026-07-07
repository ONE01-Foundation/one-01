/**
 * businessStore — the live directory of cloud (Supabase-backed) businesses.
 *
 * Home reads it to make user-created businesses discoverable in chat and to
 * open them in the BusinessSheet; the create flow refreshes it after a save.
 * Kept tiny and network-tolerant: an empty list just means "no cloud yet".
 */

import { create } from 'zustand';
import {
  fetchCloudProviders,
  cloudToDirectory,
  type CloudBusiness,
} from '../services/cloudBusiness';
import type { DirectoryBusiness } from '../utils/businessDirectory';

type BusinessStore = {
  /** Display shape for the BusinessSheet + chat discovery. */
  cloud: DirectoryBusiness[];
  /** Raw shape (for editing your own business). */
  raw: CloudBusiness[];
  loading: boolean;
  loadedOnce: boolean;
  refresh: () => Promise<void>;
  /** Optimistically add/replace a business right after a local save. */
  upsertLocal: (biz: CloudBusiness) => void;
};

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  cloud: [],
  raw: [],
  loading: false,
  loadedOnce: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const raw = await fetchCloudProviders();
      set({
        raw,
        cloud: raw.map(cloudToDirectory),
        loading: false,
        loadedOnce: true,
      });
    } catch {
      set({ loading: false, loadedOnce: true });
    }
  },

  upsertLocal: (biz) => {
    const raw = [biz, ...get().raw.filter((b) => b.id !== biz.id)];
    set({ raw, cloud: raw.map(cloudToDirectory) });
  },
}));
