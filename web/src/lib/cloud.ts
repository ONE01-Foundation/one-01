"use client";

/**
 * cloud — the web app's bridge to Supabase. It keeps your processes in the
 * cloud so they survive reloads.
 *
 * Auth-free by design: the browser generates a random `device_id` (a capability
 * token stored in localStorage) and reaches ONLY its own row through two
 * SECURITY DEFINER RPCs (`web_load` / `web_save`). Anon has no direct table
 * access, so rows aren't enumerable. This works with no dashboard setup; when
 * real accounts are added later, this swaps for an auth.uid()-scoped table.
 */

import { getSupabase } from "./supabase";
import type { Process, Business } from "./mockData";

export type CloudStatus = "connecting" | "synced" | "offline";

const DEVICE_KEY = "one_web_device_id";

function deviceId(): string | null {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Confirm the backend is reachable for this device (a cheap load round-trip). */
export async function ensureSession(): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "no-env" };
  const id = deviceId();
  if (!id) return { ok: false, reason: "no-window" };
  const { error } = await sb.rpc("web_load", { p_device_id: id });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/**
 * The persistence key: a signed-in user's `auth.uid()` (so data follows the
 * account across devices), else the per-device id (guest mode).
 */
async function storageKey(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? deviceId();
}

/** Persist the current processes under the active key (account or device). */
export async function saveUnits(units: Process[]): Promise<boolean> {
  const sb = getSupabase();
  const key = await storageKey();
  if (!sb || !key) return false;
  const { error } = await sb.rpc("web_save", { p_device_id: key, p_units: units });
  return !error;
}

/** Load previously-saved processes (or null if none yet). */
export async function loadUnits(): Promise<Process[] | null> {
  const sb = getSupabase();
  const key = await storageKey();
  if (!sb || !key) return null;
  const { data, error } = await sb.rpc("web_load", { p_device_id: key });
  if (error || !data) return null;
  return Array.isArray(data) && data.length > 0 ? (data as Process[]) : null;
}

/**
 * Load the business directory (Nearby ONEs) from the public `providers` table.
 * Each row stores the full Business object in `metadata`; we keep only complete
 * records, so any sparse/legacy provider rows are ignored.
 */
export async function fetchProviders(): Promise<Business[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("providers").select("metadata");
  if (error || !data) return null;
  const list = data
    .map((r) => {
      const m = (r as { metadata?: Record<string, unknown> }).metadata;
      if (!m) return undefined;
      // The owner key lives as `owner_key` in metadata; expose it as ownerKey.
      return { ...m, ownerKey: (m.owner_key as string) ?? undefined } as Business;
    })
    .filter(
      (b): b is Business =>
        !!b &&
        typeof b === "object" &&
        typeof b.id === "string" &&
        typeof b.emoji === "string" &&
        Array.isArray(b.services) &&
        Array.isArray(b.slots) &&
        Array.isArray(b.hours),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return list.length > 0 ? list : null;
}

/** The current capability key (auth uid if signed in, else device id). */
export async function myKey(): Promise<string | null> {
  return storageKey();
}

/** Create or update a business you own (in the shared `providers` table). */
export async function saveBusiness(biz: Business): Promise<boolean> {
  const sb = getSupabase();
  const owner = await storageKey();
  if (!sb || !owner) return false;
  const { error } = await sb.rpc("provider_upsert", {
    p_id: biz.id,
    p_owner: owner,
    p_metadata: biz as unknown as Record<string, unknown>,
  });
  return !error;
}

/** Follow / unfollow a business. */
export async function followSet(providerId: string, on: boolean, name: string): Promise<boolean> {
  const sb = getSupabase();
  const key = await storageKey();
  if (!sb || !key) return false;
  const { error } = await sb.rpc("follow_set", {
    p_provider_id: providerId,
    p_follower_key: key,
    p_follower_name: name,
    p_on: on,
  });
  return !error;
}

/** Am I following this business? */
export async function isFollowing(providerId: string): Promise<boolean> {
  const sb = getSupabase();
  const key = await storageKey();
  if (!sb || !key) return false;
  const { data } = await sb.rpc("is_following", { p_provider_id: providerId, p_follower_key: key });
  return data === true;
}

export interface CloudFollower {
  provider_id: string;
  follower_key: string;
  follower_name: string;
  created_at: string;
}

/** The people following a business. */
export async function fetchFollowers(providerId: string): Promise<CloudFollower[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("followers_for", { p_provider_id: providerId });
  return error || !data ? [] : (data as CloudFollower[]);
}

export interface CloudCustomer {
  customer_name: string;
  visits: number;
  last_slot: string | null;
  last_at: string;
}

/** A business's customers, derived from who has booked it. */
export async function fetchCustomers(providerId: string): Promise<CloudCustomer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("customers_for", { p_provider_id: providerId });
  return error || !data ? [] : (data as CloudCustomer[]);
}

export interface CloudBooking {
  id: string;
  provider_id: string;
  customer_name: string;
  service: string | null;
  slot: string;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
}

/** A customer's ONE writes a booking into the shared marketplace. */
export async function createBooking(
  providerId: string,
  customer: string,
  service: string | undefined,
  slot: string,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc("book_create", {
    p_provider_id: providerId,
    p_customer: customer,
    p_service: service ?? "",
    p_slot: slot,
  });
  return !error;
}

/** A provider's ONE reads the bookings addressed to it. */
export async function fetchIncomingBookings(providerId: string): Promise<CloudBooking[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("bookings_for", { p_provider_id: providerId });
  if (error || !data) return [];
  return data as CloudBooking[];
}

/* ─────────────────────────── Auth ─────────────────────────── */

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

function toAuthUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!u) return null;
  const m = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: (m.full_name as string) ?? (m.name as string) ?? null,
    avatar: (m.avatar_url as string) ?? (m.picture as string) ?? null,
  };
}

/** The redirect target auth flows return to (this same /app page). */
function authRedirect(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/app`;
}

/** Send a passwordless magic link to `email`. */
export async function signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured." };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirect(), shouldCreateUser: true },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Start the Google OAuth flow (redirects the browser to Google). */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured." };
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirect() },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/** Current signed-in user (null if guest). */
export async function getSessionUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return toAuthUser(data.session?.user ?? null);
}

/** Subscribe to sign-in / sign-out; returns an unsubscribe fn. */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    cb(toAuthUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}


