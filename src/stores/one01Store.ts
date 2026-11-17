/**
 * one01Store — the ONE01 "company" / venture-factory demo (separate from
 * mvpStore so the consumer ONE app is untouched).
 *
 * ONE01 is the company that MAKES ventures. Each venture is a product that
 * gets its own page (one01.io/<slug>, optional custom domain) and is spun up
 * from a reusable TEMPLATE — a website (a product page) or an app (a clone of
 * ONE's structure, or a subsystem like market / matching / profiles). ONE
 * itself is a venture here too, marked `isCore` (set aside, never deleted).
 *
 * Money is VIRTUAL for now (tokens) — no crypto until regulation is sorted;
 * the shape leaves room to connect real settlement later. Local/persisted,
 * demo-grade; a real backend (Supabase) is a follow-up.
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { storage } from '../utils/session';

const one01Storage: StateStorage = {
  getItem: async (name) => (await storage.getItem(name)) ?? null,
  setItem: async (name, value) => { await storage.setItem(name, value); },
  removeItem: async (name) => { await storage.removeItem(name); },
};

export type VentureKind = 'app' | 'website';
export type VentureStatus = 'idea' | 'building' | 'live';

/** A reusable "wrapper of an idea" the factory can replicate — the thing you
 *  buy/pick when you create a venture. */
export interface VentureTemplate {
  id: string;
  kind: VentureKind;
  name: [string, string]; // [he, en]
  emoji: string;
  /** One line of what it gives you. [he, en] */
  blurb: [string, string];
  /** Virtual token cost to spin it up. */
  priceTokens: number;
}

export const TEMPLATES: VentureTemplate[] = [
  // ── Websites (a product page on the main site) ───────────────────────────
  { id: 'landing', kind: 'website', name: ['דף נחיתה', 'Landing page'], emoji: '🪧', blurb: ['עמוד שיווקי למיזם עם קריאה לפעולה.', 'A marketing page with a call to action.'], priceTokens: 150 },
  { id: 'product-page', kind: 'website', name: ['דף מוצר', 'Product page'], emoji: '🧾', blurb: ['עמוד מוצר ב-one01.io/<slug>.', 'A product page at one01.io/<slug>.'], priceTokens: 200 },
  { id: 'store', kind: 'website', name: ['חנות', 'Storefront'], emoji: '🛍️', blurb: ['קטלוג + עגלת קניות וירטואלית.', 'A catalog with a virtual cart.'], priceTokens: 400 },
  // ── Apps (a clone of ONE's structure, or a subsystem) ────────────────────
  { id: 'one-clone', kind: 'app', name: ['שכפול של ONE', 'ONE clone'], emoji: '◉', blurb: ['אפליקציה על המבנה של ONE — פרופיל, תהליכים, גלובל.', "An app on ONE's structure — profile, processes, Global."], priceTokens: 900 },
  { id: 'market', kind: 'app', name: ['מערכת מרקט', 'Market system'], emoji: '🏪', blurb: ['רשימות, קנייה/מכירה והתחשבנות וירטואלית.', 'Listings, buy/sell and virtual settlement.'], priceTokens: 600 },
  { id: 'matching', kind: 'app', name: ['מערכת מאצ׳ינג', 'Matching system'], emoji: '🔗', blurb: ['חיבור בין ביקוש להיצע לפי כללים.', 'Connect demand to supply by rules.'], priceTokens: 600 },
  { id: 'profiles', kind: 'app', name: ['פרופילים והרשאות', 'Profiles & permissions'], emoji: '🪪', blurb: ['זהויות, תפקידים והרשאות משותפות.', 'Identities, roles and shared permissions.'], priceTokens: 350 },
];

export function templateById(id: string): VentureTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export interface Venture {
  id: string;
  name: string;
  /** one01.io/<slug> */
  slug: string;
  kind: VentureKind;
  templateId: string;
  status: VentureStatus;
  emoji: string;
  accent: string;
  /** Optional connected custom domain. */
  domain?: string;
  /** Virtual balances/metrics — demo stubs, no crypto. */
  tokens: number;
  users: number;
  revenue: number;
  createdAt: string;
  /** ONE itself — set aside, not deletable. */
  isCore?: boolean;
}

const nowIso = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-+|-+$/g, '');
  return base || `v${Math.floor(Math.random() * 1e4)}`;
}

const SEED_VENTURES: Venture[] = [
  {
    id: 'vt_one', name: 'ONE', slug: 'one', kind: 'app', templateId: 'one-clone',
    status: 'live', emoji: '◉', accent: '#10B981', tokens: 1200, users: 1, revenue: 0,
    createdAt: nowIso(), isCore: true,
  },
  {
    id: 'vt_winzi', name: 'Winzi', slug: 'winzi', kind: 'app', templateId: 'market',
    status: 'building', emoji: '👑', accent: '#F9D800', tokens: 300, users: 0, revenue: 0,
    createdAt: nowIso(),
  },
];

interface One01State {
  companyName: string;
  /** Company-level virtual token treasury. */
  companyTokens: number;
  ventures: Venture[];

  createVenture: (input: { name: string; kind: VentureKind; templateId: string }) => string | null;
  updateVenture: (id: string, patch: Partial<Venture>) => void;
  cycleStatus: (id: string) => void;
  connectDomain: (id: string, domain: string | undefined) => void;
  removeVenture: (id: string) => void;
  addCompanyTokens: (n: number) => void;
  resetDemo: () => void;
}

export const useOne01Store = create<One01State>()(
  persist(
    (set, get) => ({
      companyName: 'ONE01',
      companyTokens: 5000,
      ventures: SEED_VENTURES,

      createVenture: ({ name, kind, templateId }) => {
        const tpl = templateById(templateId);
        if (!tpl) return null;
        const price = tpl.priceTokens;
        if (get().companyTokens < price) return null; // not enough virtual tokens
        const id = rid('vt');
        const existing = new Set(get().ventures.map((v) => v.slug));
        let slug = slugify(name);
        while (existing.has(slug)) slug = `${slug}-${Math.floor(Math.random() * 90 + 10)}`;
        const venture: Venture = {
          id, name: name.trim() || 'Untitled', slug, kind, templateId,
          status: 'building', emoji: tpl.emoji, accent: '#6366F1',
          tokens: 0, users: 0, revenue: 0, createdAt: nowIso(),
        };
        set((s) => ({ ventures: [venture, ...s.ventures], companyTokens: s.companyTokens - price }));
        return id;
      },

      updateVenture: (id, patch) =>
        set((s) => ({ ventures: s.ventures.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

      cycleStatus: (id) =>
        set((s) => ({
          ventures: s.ventures.map((v) => {
            if (v.id !== id) return v;
            const next: VentureStatus = v.status === 'idea' ? 'building' : v.status === 'building' ? 'live' : 'idea';
            return { ...v, status: next };
          }),
        })),

      connectDomain: (id, domain) =>
        set((s) => ({ ventures: s.ventures.map((v) => (v.id === id ? { ...v, domain: domain?.trim() || undefined } : v)) })),

      // Remove a venture, unless it's the core ONE (set aside, never deleted).
      removeVenture: (id) =>
        set((s) => ({ ventures: s.ventures.filter((v) => !(v.id === id && !v.isCore)) })),

      addCompanyTokens: (n) => set((s) => ({ companyTokens: Math.max(0, s.companyTokens + n) })),

      resetDemo: () => set({ companyName: 'ONE01', companyTokens: 5000, ventures: SEED_VENTURES }),
    }),
    {
      name: 'one01_v1',
      version: 1,
      storage: createJSONStorage(() => one01Storage),
    },
  ),
);
