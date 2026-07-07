/**
 * cloudBusiness — mobile's bridge to the SHARED business marketplace on Supabase.
 *
 * It talks to the exact same SECURITY DEFINER RPCs the web product uses, so a
 * business created on the web shows up on mobile (and vice-versa), follows are
 * mutual, and a booking made on either surface lands in the owner's customer
 * list. No dashboard setup: anon reaches only its own capability-scoped rows.
 *
 * Capability key: a signed-in user's auth.uid() (so a business follows the
 * account across devices), else a per-device id kept in secure storage.
 *
 * Pure data layer — no React, no throwing. Every call degrades to a safe
 * default when Supabase isn't configured or a request fails.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';
import { storage } from '../utils/session';
import type { DirectoryBusiness } from '../utils/businessDirectory';

/** The business shape stored in providers.metadata (mirrors the web `Business`). */
export interface CloudBusiness {
  id: string;
  name: string;
  emoji: string;
  category: string;
  rating?: number;
  reviews?: number;
  address?: string;
  phone?: string;
  blurb?: string;
  hours: { day: string; open: string; close: string | null }[];
  services: { name: string; price: string }[];
  slots: string[];
  ownerKey?: string;
}

const DEVICE_KEY = 'one_biz_device_id';

/** A live client, initializing lazily on first use (mirrors providersApi). */
function client(): SupabaseClient | null {
  let c = supabaseService.getClient();
  if (!c) {
    supabaseService.initialize();
    c = supabaseService.getClient();
  }
  return c;
}

/** A stable per-device capability id (generated once, kept in secure storage). */
async function deviceId(): Promise<string> {
  let id = await storage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await storage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** The current capability key: auth.uid() if signed in, else the device id. */
export async function myBusinessKey(): Promise<string> {
  const c = client();
  if (c) {
    try {
      const { data } = await c.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) return uid;
    } catch {
      /* fall through to device id */
    }
  }
  return deviceId();
}

/* ─────────────────────────── Directory ─────────────────────────── */

/** Load every business in the shared directory (complete records only). */
export async function fetchCloudProviders(): Promise<CloudBusiness[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.from('providers').select('metadata');
  if (error || !data) return [];
  return data
    .map((r) => {
      const m = (r as { metadata?: Record<string, unknown> }).metadata;
      if (!m) return undefined;
      return { ...m, ownerKey: (m.owner_key as string) ?? undefined } as CloudBusiness;
    })
    .filter(
      (b): b is CloudBusiness =>
        !!b &&
        typeof b === 'object' &&
        typeof b.id === 'string' &&
        typeof b.name === 'string' &&
        typeof b.emoji === 'string' &&
        Array.isArray(b.services) &&
        Array.isArray(b.slots) &&
        Array.isArray(b.hours),
    );
}

/** Create or update a business you own. */
export async function saveBusiness(biz: CloudBusiness): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const owner = await myBusinessKey();
  // provider_upsert injects owner_key = p_owner into metadata itself.
  const { error } = await c.rpc('provider_upsert', {
    p_id: biz.id,
    p_owner: owner,
    p_metadata: biz as unknown as Record<string, unknown>,
  });
  return !error;
}

/* ─────────────────────────── Follows ─────────────────────────── */

export interface CloudFollower {
  provider_id: string;
  follower_key: string;
  follower_name: string;
  created_at: string;
}

/** Follow / unfollow a business as the current identity. */
export async function followSet(providerId: string, on: boolean, name: string): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const key = await myBusinessKey();
  const { error } = await c.rpc('follow_set', {
    p_provider_id: providerId,
    p_follower_key: key,
    p_follower_name: name,
    p_on: on,
  });
  return !error;
}

/** Am I following this business? */
export async function isFollowing(providerId: string): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const key = await myBusinessKey();
  const { data } = await c.rpc('is_following', {
    p_provider_id: providerId,
    p_follower_key: key,
  });
  return data === true;
}

/** The people following a business. */
export async function fetchFollowers(providerId: string): Promise<CloudFollower[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.rpc('followers_for', { p_provider_id: providerId });
  return error || !data ? [] : (data as CloudFollower[]);
}

/* ─────────────────────────── Bookings / customers ─────────────────────────── */

export interface CloudCustomer {
  customer_name: string;
  visits: number;
  last_slot: string | null;
  last_at: string;
}

/** A booking a customer's ONE writes into the shared marketplace. */
export async function createBooking(
  providerId: string,
  customer: string,
  service: string | undefined,
  slot: string,
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c.rpc('book_create', {
    p_provider_id: providerId,
    p_customer: customer,
    p_service: service ?? '',
    p_slot: slot,
  });
  return !error;
}

/** A business's customers, derived from who has booked it. */
export async function fetchCustomers(providerId: string): Promise<CloudCustomer[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.rpc('customers_for', { p_provider_id: providerId });
  return error || !data ? [] : (data as CloudCustomer[]);
}

/* ─────────────────────────── Adapter ─────────────────────────── */

/* ─────────────────────────── Create-from-text ─────────────────────────── */

export interface BusinessDraft {
  emoji: string;
  name: string;
  category: string;
  blurb: string;
  services: { name: string; price: string }[];
  hours: { day: string; open: string; close: string | null }[];
  slots: string[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A standard week: Sun–Thu full, Fri short, Sat closed. */
export function defaultHours(open = '09:00', close = '18:00'): BusinessDraft['hours'] {
  return DAYS.map((d) =>
    d === 'Sat'
      ? { day: d, open: '', close: null }
      : d === 'Fri'
        ? { day: d, open, close: '14:00' }
        : { day: d, open, close },
  );
}

/** Three sensible bookable slots derived from the first open day's opening. */
export function slotsFromHours(hours: BusinessDraft['hours']): string[] {
  const firstOpen = hours.find((h) => h.close)?.open || '10:00';
  return [`Sun ${firstOpen}`, `Tue ${firstOpen}`, `Thu ${firstOpen}`];
}

export function emptyDraft(): BusinessDraft {
  const hours = defaultHours();
  return {
    emoji: '🏪',
    name: '',
    category: 'Local business',
    blurb: '',
    services: [],
    hours,
    slots: slotsFromHours(hours),
  };
}

/**
 * Turn a free-text description ("Bella Nails — a nail salon, manicure ₪90, open
 * 9–7") into a partial business draft. Ported from the web so both surfaces
 * parse identically. Category order matters: more-specific rules come first.
 */
export function parseBusinessText(text: string): Partial<BusinessDraft> {
  const t = text.trim();
  const out: Partial<BusinessDraft> = {};

  const catMap: [RegExp, string, string][] = [
    [/nail|manicure|pedicure|spa|beauty|makeup|lash|wax/i, 'Beauty studio', '💅'],
    [/salon|hair|barber|styl/i, 'Hair salon', '💈'],
    [/driv/i, 'Driving instructor', '🚗'],
    [/mov(e|ing)/i, 'Moving company', '📦'],
    [/clinic|doctor|dentist|dental|medical/i, 'Clinic', '🩺'],
    [/gym|fitness|train|yoga|pilates/i, 'Fitness studio', '🏋️'],
    [/cafe|coffee|restaurant|food|bakery|kitchen/i, 'Café', '☕'],
    [/photo/i, 'Photographer', '📷'],
    [/law|legal|account/i, 'Professional services', '💼'],
    [/clean/i, 'Cleaning service', '🧽'],
    [/tutor|lesson|teacher|course/i, 'Tutor', '📚'],
  ];
  out.emoji = '🏪';
  out.category = 'Local business';
  for (const [re, cat, emoji] of catMap) {
    if (re.test(t)) {
      out.category = cat;
      out.emoji = emoji;
      break;
    }
  }

  const nameM =
    t.match(/\b(?:called|named)\s+([A-Za-z֐-׿][\w '&-]{1,30})/) ||
    t.match(/^([A-Za-z֐-׿][\w '&-]{1,28}?)\s+(?:is|—|-|,|offers|provides|does)/);
  if (nameM) out.name = nameM[1].trim();

  const services: { name: string; price: string }[] = [];
  for (const c of t.split(/[,.;\n·—]|(?:\band\b)/i)) {
    const pm = c.match(/([₪$€]\s?\d[\d,]*)/);
    if (pm) {
      const n = c
        .replace(pm[0], '')
        .replace(/\b(costs?|is|are|for|price[ds]?|at|about|only|from)\b/gi, ' ')
        .replace(/[-:–]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(a|an|the)\s+/i, '');
      if (n.length >= 2) services.push({ name: n.slice(0, 40), price: pm[1].replace(/\s/g, '') });
    }
  }
  if (services.length) out.services = services;

  const timeM = t.match(/(\d{1,2})(?::(\d{2}))?\s?(?:-|–|to|until|till)\s?(\d{1,2})(?::(\d{2}))?/i);
  if (timeM) {
    const open = `${timeM[1].padStart(2, '0')}:${timeM[2] ?? '00'}`;
    const close = `${timeM[3].padStart(2, '0')}:${timeM[4] ?? '00'}`;
    out.hours = defaultHours(open, close);
  }
  return out;
}

/** Assemble a full CloudBusiness from a draft + a fresh id. */
export function draftToCloud(draft: BusinessDraft, id: string): CloudBusiness {
  const slots = draft.slots.length ? draft.slots : slotsFromHours(draft.hours);
  return {
    id,
    name: draft.name.trim() || 'New business',
    emoji: draft.emoji || '🏪',
    category: draft.category || 'Local business',
    rating: 0,
    reviews: 0,
    address: '',
    phone: '',
    blurb: draft.blurb,
    hours: draft.hours,
    services: draft.services.filter((s) => s.name.trim()),
    slots,
  };
}

/** A short, url-safe business id (e.g. biz_9263f2l). */
export function newBusinessId(): string {
  return `biz_${Math.random().toString(36).slice(2, 9)}`;
}

/** Render a stored hours[] array as one readable line. */
function hoursLine(hours: CloudBusiness['hours']): string {
  return hours
    .map((h) => (h.close ? `${h.day} ${h.open}–${h.close}` : `${h.day} closed`))
    .join(' · ');
}

/**
 * Map a cloud business into the mobile BusinessSheet's shape. Cloud businesses
 * carry a single language string; we mirror it into both he/en. `cloudId` +
 * `ownerKey` mark it as Supabase-backed so the sheet can offer follow + the
 * owner dashboard.
 */
export function cloudToDirectory(biz: CloudBusiness): DirectoryBusiness {
  const line = hoursLine(biz.hours);
  const nameWords = biz.name.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  return {
    id: biz.id,
    emoji: biz.emoji,
    name: { he: biz.name, en: biz.name },
    category: { he: biz.category, en: biz.category },
    hoursText: { he: line, en: line },
    services: biz.services.map((s) => ({ label: { he: s.name, en: s.name }, price: s.price })),
    slots: biz.slots,
    aliases: Array.from(new Set([biz.name.toLowerCase(), ...nameWords])),
    cloudId: biz.id,
    ownerKey: biz.ownerKey,
  };
}
