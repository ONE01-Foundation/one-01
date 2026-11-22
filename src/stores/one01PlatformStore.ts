/**
 * one01PlatformStore — persisted state for the ONE01 Platform demo so it behaves
 * like a real app: you onboard once, and a single virtual-credit balance ties
 * the surfaces together (mini-game wins credit it, Market purchases debit it,
 * every move is recorded as a transaction). Still virtual — no crypto.
 *
 * Separate from mvpStore / one01Store so the consumer ONE app and the venture
 * factory are untouched. Key `one01_platform_v1`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { storage } from '../utils/session';

const platStorage: StateStorage = {
  getItem: async (name) => (await storage.getItem(name)) ?? null,
  setItem: async (name, value) => { await storage.setItem(name, value); },
  removeItem: async (name) => { await storage.removeItem(name); },
};

export interface PlatformTx {
  id: string;
  label: string;
  /** Positive = credit, negative = debit. */
  amount: number;
  ts: number;
}

const START_BALANCE = 3500;
const rid = () => `tx_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;

interface One01PlatformState {
  /** Platform onboarding (ONE01) completed. */
  entered: boolean;
  /** Product ids whose onboarding was completed. */
  onboarded: string[];
  /** Virtual credit balance (⟡). */
  balance: number;
  transactions: PlatformTx[];

  setEntered: (v: boolean) => void;
  markOnboarded: (id: string) => void;
  /** Add credits (e.g. a game win). */
  credit: (amount: number, label: string) => void;
  /** Spend credits; returns false (and does nothing) if the balance is too low. */
  debit: (amount: number, label: string) => boolean;
  resetDemo: () => void;
}

export const useOne01PlatformStore = create<One01PlatformState>()(
  persist(
    (set, get) => ({
      entered: false,
      onboarded: [],
      balance: START_BALANCE,
      transactions: [],

      setEntered: (v) => set({ entered: v }),
      markOnboarded: (id) =>
        set((s) => (s.onboarded.includes(id) ? s : { onboarded: [...s.onboarded, id] })),

      credit: (amount, label) =>
        set((s) => ({
          balance: s.balance + amount,
          transactions: [{ id: rid(), label, amount, ts: Date.now() }, ...s.transactions].slice(0, 40),
        })),

      debit: (amount, label) => {
        if (get().balance < amount) return false;
        set((s) => ({
          balance: s.balance - amount,
          transactions: [{ id: rid(), label, amount: -amount, ts: Date.now() }, ...s.transactions].slice(0, 40),
        }));
        return true;
      },

      resetDemo: () => set({ entered: false, onboarded: [], balance: START_BALANCE, transactions: [] }),
    }),
    { name: 'one01_platform_v1', version: 1, storage: createJSONStorage(() => platStorage) },
  ),
);
