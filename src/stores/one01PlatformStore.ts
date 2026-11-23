/**
 * one01PlatformStore — persisted state for the ONE01 Platform demo so it behaves
 * like a real app: you onboard once, and a single virtual-credit balance ties
 * the surfaces together (mini-game matches and show bets settle against it,
 * Market purchases debit it, and you can invest it in projects like shares).
 * Every move is recorded as a transaction. Still virtual — no crypto.
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

/** A virtual "share" position in a project (its live price fluctuates). */
export interface Position {
  shares: number;
  /** Average credits paid per share. */
  avgCost: number;
}

/** Something you published from Creator — it earns credits over time. */
export interface UserCreation {
  id: string;
  title: string;
  emoji: string;
  /** Creator pillar id it was built from (e.g. 'agents'). */
  kind: string;
  /** Which product's Creator it was built in (display only). */
  surface: string;
  ts: number;
  /** Last time earnings were collected (accrual anchor). */
  lastCollected: number;
  /** Total credits collected so far. */
  collected: number;
  /** Credits earned per minute (deterministic per creation). */
  rate: number;
  /** Rarity tier (cosmetics only: common/rare/epic/legendary). */
  rarity?: string;
  /** Edition count minted (cosmetics). */
  editions?: number;
}

/** Uncollected earnings a creation has accrued since it was last collected. */
export function pendingEarnings(c: UserCreation, now = Date.now()): number {
  return Math.floor(((now - c.lastCollected) / 60000) * c.rate);
}

/* ───────────────────────── notifications ───────────────────────── */

/** Where tapping a notification or feed post takes you. */
export type NotifNav =
  | { kind: 'home'; homeId: string }
  | { kind: 'wallet' }
  | { kind: 'market' }
  | { kind: 'create' }
  | { kind: 'network' };

export interface Notif { id: string; emoji: string; title: string; body: string; ts: number; nav?: NotifNav; }

/** Infer a navigation target from a transaction/activity label. */
export function labelNav(label: string): NotifNav {
  if (label.startsWith('Market · ')) return { kind: 'market' };
  if (/match|practice/i.test(label)) return { kind: 'home', homeId: 'winzi' };
  if (/bet|vote/i.test(label)) return { kind: 'home', homeId: 'mixstar' };
  if (/earnings|published/i.test(label)) return { kind: 'create' };
  if (/follow/i.test(label)) return { kind: 'network' };
  return { kind: 'wallet' };
}

const NOTIF_T0 = Date.now();
const NOTIF_SEED: Notif[] = [
  { id: 's1', emoji: '🏆', title: 'You reached Level 13', body: 'Keep the streak going', ts: NOTIF_T0 - 2 * 60000 },
  { id: 's2', emoji: '💬', title: 'nova started following you', body: 'Now following your ONE', ts: NOTIF_T0 - 9 * 60000, nav: { kind: 'network' } },
  { id: 's3', emoji: '🎯', title: 'Winzi rank updated', body: 'You climbed to Gold II', ts: NOTIF_T0 - 24 * 60000, nav: { kind: 'home', homeId: 'winzi' } },
  { id: 's4', emoji: '📺', title: 'Episode 4 voting is open', body: 'MixStar · Survive', ts: NOTIF_T0 - 52 * 60000, nav: { kind: 'home', homeId: 'mixstar' } },
  { id: 's5', emoji: '🤝', title: 'A provider replied', body: 'Renew license · step 2', ts: NOTIF_T0 - 95 * 60000, nav: { kind: 'home', homeId: 'one' } },
  { id: 's6', emoji: '⚡', title: 'New on ONE01 Market', body: 'Fresh signals & feeds dropped', ts: NOTIF_T0 - 3 * 3600000, nav: { kind: 'market' } },
];

/** Merge seeded platform updates with the wallet's real transactions, newest first. */
export function buildNotifs(transactions: PlatformTx[]): Notif[] {
  const txn: Notif[] = transactions.map((t) => ({
    id: t.id,
    emoji: t.amount >= 0 ? '💰' : '🧾',
    title: t.label,
    body: `${t.amount >= 0 ? '+' : ''}⟡${t.amount.toLocaleString()}`,
    ts: t.ts,
    nav: labelNav(t.label),
  }));
  return [...txn, ...NOTIF_SEED].sort((a, b) => b.ts - a.ts).slice(0, 40);
}

const START_BALANCE = 3500;
const rid = () => `tx_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;

/* ───────────────────────── live price model (deterministic) ─────────────────────────
 * Each investable project has a base price; the live price gently oscillates over
 * time via a few summed sines, seeded per id, so prices feel alive and a chart can
 * be drawn for any past instant — all without storing a tick history. */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const BASE_PRICE: Record<string, number> = {
  winzi: 128, mixstar: 86, xit: 42, sodex: 24, one: 310, one01: 500,
};

export function basePrice(id: string): number {
  return BASE_PRICE[id] ?? 30 + (hashStr(id) % 140);
}

function wave(id: string, t: number): number {
  const seed = (hashStr(id) % 1000) / 160;
  return (
    Math.sin(t / 6.5 + seed) * 0.06 +
    Math.sin(t / 19 + seed * 1.7) * 0.035 +
    Math.sin(t / 53 + seed * 0.5) * 0.02
  );
}

/** Current live price for a project id, in virtual credits. */
export function livePrice(id: string): number {
  const t = Date.now() / 1000;
  return Math.max(1, Math.round(basePrice(id) * (1 + wave(id, t))));
}

/** A series of recent prices (oldest → newest) for drawing a mini chart. */
export function priceSeries(id: string, n = 28, stepSec = 45): number[] {
  const now = Date.now() / 1000;
  const base = basePrice(id);
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(Math.max(1, Math.round(base * (1 + wave(id, now - i * stepSec)))));
  return out;
}

/** Percent change across the recent series (≈ "today"). */
export function dayChangePct(id: string): number {
  const s = priceSeries(id);
  if (!s.length || s[0] === 0) return 0;
  return ((s[s.length - 1] - s[0]) / s[0]) * 100;
}

interface One01PlatformState {
  /** Platform onboarding (ONE01) completed. */
  entered: boolean;
  /** Product ids whose onboarding was completed. */
  onboarded: string[];
  /** Virtual credit balance (⟡). */
  balance: number;
  transactions: PlatformTx[];
  /** Project id → share position. */
  positions: Record<string, Position>;
  /** Things you published from Creator. */
  creations: UserCreation[];
  /** ONE01 shell appearance (products keep their own dark theme). */
  appearance: 'light' | 'dark';
  /** UI language. */
  lang: 'en' | 'he';
  /** Timestamp notifications were last opened (for the unread badge). */
  notifsSeenAt: number;
  /** Per-person follow overrides (id → following?). Absent = use the seed default. */
  follows: Record<string, boolean>;

  setEntered: (v: boolean) => void;
  setAppearance: (v: 'light' | 'dark') => void;
  setLang: (v: 'en' | 'he') => void;
  markNotifsSeen: () => void;
  /** Follow or unfollow a person by id. */
  setFollow: (id: string, following: boolean) => void;
  markOnboarded: (id: string) => void;
  /** Add credits (e.g. a match won, a bet paid out). */
  credit: (amount: number, label: string) => void;
  /** Spend credits; returns false (and does nothing) if the balance is too low. */
  debit: (amount: number, label: string) => boolean;
  /** Buy `shares` of a project at `price` each; false if balance too low. */
  invest: (id: string, shares: number, price: number, label: string) => boolean;
  /** Sell `shares` of a project at `price` each; false if not enough held. */
  divest: (id: string, shares: number, price: number, label: string) => boolean;
  /** Publish a creation from Creator (starts earning). */
  publishCreation: (input: { title: string; emoji: string; kind: string; surface: string; rarity?: string; editions?: number; rateMult?: number }) => void;
  /** Collect a creation's pending earnings into the balance; returns the amount. */
  collectEarnings: (id: string) => number;
  resetDemo: () => void;
}

export const useOne01PlatformStore = create<One01PlatformState>()(
  persist(
    (set, get) => ({
      entered: false,
      onboarded: [],
      balance: START_BALANCE,
      transactions: [],
      positions: {},
      creations: [],
      appearance: 'light',
      lang: 'en',
      notifsSeenAt: 0,
      follows: {},

      setEntered: (v) => set({ entered: v }),
      setAppearance: (v) => set({ appearance: v }),
      setLang: (v) => set({ lang: v }),
      markNotifsSeen: () => set({ notifsSeenAt: Date.now() }),
      setFollow: (id, following) => set((s) => ({ follows: { ...s.follows, [id]: following } })),
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

      invest: (id, shares, price, label) => {
        const cost = Math.round(shares * price);
        if (shares <= 0 || get().balance < cost) return false;
        set((s) => {
          const prev = s.positions[id] ?? { shares: 0, avgCost: 0 };
          const total = prev.shares + shares;
          const avgCost = total > 0 ? (prev.avgCost * prev.shares + cost) / total : 0;
          return {
            balance: s.balance - cost,
            positions: { ...s.positions, [id]: { shares: total, avgCost } },
            transactions: [{ id: rid(), label, amount: -cost, ts: Date.now() }, ...s.transactions].slice(0, 40),
          };
        });
        return true;
      },

      divest: (id, shares, price, label) => {
        const pos = get().positions[id];
        if (!pos || shares <= 0 || pos.shares < shares) return false;
        const proceeds = Math.round(shares * price);
        set((s) => {
          const prev = s.positions[id]!;
          const remaining = prev.shares - shares;
          const positions = { ...s.positions };
          if (remaining <= 0) delete positions[id];
          else positions[id] = { shares: remaining, avgCost: prev.avgCost };
          return {
            balance: s.balance + proceeds,
            positions,
            transactions: [{ id: rid(), label, amount: proceeds, ts: Date.now() }, ...s.transactions].slice(0, 40),
          };
        });
        return true;
      },

      publishCreation: (input) =>
        set((s) => {
          const now = Date.now();
          const mult = input.rateMult ?? 1;
          const rate = Math.round((30 + (hashStr(input.title + now) % 60)) * mult); // base 30–89 ×rarity
          const c: UserCreation = {
            id: `cr_${now}_${Math.floor(Math.random() * 1e4)}`,
            title: input.title, emoji: input.emoji, kind: input.kind, surface: input.surface,
            ts: now, lastCollected: now, collected: 0, rate,
            rarity: input.rarity, editions: input.editions,
          };
          return { creations: [c, ...s.creations].slice(0, 30) };
        }),

      collectEarnings: (id) => {
        const c = get().creations.find((x) => x.id === id);
        if (!c) return 0;
        const pending = pendingEarnings(c);
        if (pending <= 0) return 0;
        const now = Date.now();
        set((s) => ({
          balance: s.balance + pending,
          creations: s.creations.map((x) => (x.id === id ? { ...x, lastCollected: now, collected: x.collected + pending } : x)),
          transactions: [{ id: rid(), label: `${c.title} earnings`, amount: pending, ts: now }, ...s.transactions].slice(0, 40),
        }));
        return pending;
      },

      resetDemo: () => set({ entered: false, onboarded: [], balance: START_BALANCE, transactions: [], positions: {}, creations: [], notifsSeenAt: 0, follows: {} }),
    }),
    { name: 'one01_platform_v1', version: 1, storage: createJSONStorage(() => platStorage) },
  ),
);
