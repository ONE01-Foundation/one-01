/**
 * mvpStore — canonical store for the new ONE MVP flow.
 *
 * Types come from src/core/mvp/types.ts (mapped directly from ONE_DATA_MODEL_AND_EXAMPLES).
 * Seeded with the mock data in src/data/mvp/ for instant visible progress without backend.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from 'zustand/middleware';
import type { Identity, Unit, IdentityType, UnitTimelineItem } from '../core/mvp/types';
import { MOCK_IDENTITIES, DEFAULT_IDENTITY_ID, MOCK_UNITS } from '../data/mvp';
import { sortByAttention } from '../core/mvp/attentionScore';
import { storage } from '../utils/session';
import { inferGenderFromName, type Gender } from '../utils/gender';

// Re-export so existing imports of `IdentityId`/`TagId` from this file keep working
// during the migration. New code should import from src/core/mvp/types directly.
export type IdentityId = IdentityType;
export type { TagId, Unit, Identity } from '../core/mvp/types';

// Legacy alias kept ONLY because a few not-yet-migrated screens still import this
// symbol. New code uses `Unit`. Remove once UnitProfileSheet/OneChatScreen/etc.
// are aligned to the new shape.
export type MvpUnit = Unit;

/**
 * A queued top-of-screen toast. The HomeScreen renders the head of
 * `notifications` and calls `dismissNotification(id)` when its animation
 * finishes. Bump-as-event: push also increments the target unit's
 * `unreadUpdates` so the card badge + Home total stay in sync.
 */
export interface UnitNotification {
  id: string;
  unitId: string;
  /** Headline shown on the toast (e.g. "Instructor Eli confirmed Tuesday"). */
  text: string;
  /** Emoji to render on the left of the toast — falls back to the unit's emoji. */
  emoji?: string;
  /** Epoch ms when pushed — used for ordering. */
  at: number;
  /**
   * Visual kind. Drives the small coloured tag at the left of the
   * banner so the user can distinguish "ONE held a task" from
   * "ONE saved a decision" from a generic event.
   *   • event   — default; ambient activity ("Instructor confirmed…")
   *   • capture — ONE pulled a task out of speech
   *   • decision — ONE recorded a decision
   *   • update  — ONE wrote a numeric/string update into a unit
   *   • created — ONE created a new process from an intention
   *   • completed — the process reached reality and was closed out
   *   • reminder — a reminder hit its due moment; ONE surfaced it on its own
   */
  kind?: 'event' | 'capture' | 'decision' | 'update' | 'created' | 'completed' | 'reminder';
  /** For 'reminder' notifications: the source reminder's id, so the toast can
   *  offer to snooze it inline without opening the process first. */
  reminderId?: string;
}

/**
 * A persisted chat message in the home-level conversation with ONE.
 * Stored in the store (not just component state) so the conversation
 * survives reloads + syncs across devices via the same Supabase bridge
 * as the rest of the MVP state.
 */
export interface ChatMessageStored {
  id: string;
  from: 'one' | 'user';
  text: string;
  /** Epoch ms. */
  ts: number;
}

/** Subscription tiers. 'free' is the default; 'pro' and 'max' are paid. */
export type PlanTier = 'free' | 'pro' | 'max';

interface MvpStore {
  /** Optional name the user chose; spec puts the name question post-value, so this can be empty. */
  name: string;
  /**
   * The user's grammatical gender, so ONE addresses them correctly in Hebrew
   * (which conjugates by gender). 'unknown' → ONE uses gender-neutral phrasing.
   * Inferred conservatively from the name (see utils/gender) and overridable.
   */
  userGender: Gender;
  /** Chosen Orb "skin" id (see data/mvp/agentAppearance) — drives ONE's face
   *  colour app-wide. */
  agentSkin: string;
  /** Chosen agent personality id — shapes ONE's tone in AI replies. */
  agentPersonality: string;
  identities: Identity[];
  activeIdentityId: string;
  units: Unit[];
  /**
   * True once the user explicitly completed the first-time flow (FirstConversation
   * or SignIn). Pre-seeded mock data does NOT flip this — that way fresh visitors
   * always land on Welcome and can experience the full flow.
   */
  hasCompletedOnboarding: boolean;
  /**
   * Toast queue. Head of the list is rendered as a banner under the status
   * bar. Auto-dismissed by the Toast component when its slide-out finishes.
   */
  notifications: UnitNotification[];
  /**
   * Persisted chat history with ONE from the Home surface. Capped at a
   * sliding window of 50 messages so the JSON blob stays small.
   */
  homeChat: ChatMessageStored[];
  /**
   * Persisted per-unit chat history. Capped at 50 per unit.
   */
  unitChats: Record<string, ChatMessageStored[]>;
  /**
   * ISO date (YYYY-MM-DD) on which we last greeted the user with the
   * "what's waiting" digest. Prevents the welcome message from firing
   * on every reload.
   */
  lastDigestDate?: string;
  /**
   * Transient (NOT persisted) one-shot message that another surface
   * (e.g. the ONE Profile sheet's input bar) wants the Home chat to
   * send. HomeScreen watches this; when it goes non-null it runs the
   * full AI pipeline on it and clears it back to null. This is how
   * "talk to ONE" inputs that live OUTSIDE Home hand off to Home's
   * single chat brain without each surface re-implementing sendChat.
   */
  pendingHomeInput: string | null;
  /**
   * Transient (NOT persisted) one-shot signal that a process JUST reached
   * "reality" — set by completeUnit, consumed by the CompletionCelebration
   * overlay which beams ONE + bursts confetti, then calls clearCelebration().
   * The whole point of ONE is carrying a process from intent to done, so the
   * finish deserves a moment.
   */
  celebration: { id: string; title: string; emoji: string } | null;
  /**
   * The user's subscription tier. 'free' by default; 'pro' / 'max' are the
   * paid tiers. We're in Israel and NOT wiring Stripe yet, so upgrading is a
   * local (mock) state flip today — the real IL payment flow slots in later
   * behind the same `setPlan`.
   */
  plan: PlanTier;
  /**
   * Connected sources (email / calendar / bank / …), keyed by connector id →
   * connected boolean. Mock for now (no real OAuth); it's what makes ONE a
   * "digital intermediary" tangible. Persisted.
   */
  connections: Record<string, boolean>;

  setName: (name: string) => void;
  /** Set the subscription tier (mock upgrade for now — see `plan`). */
  setPlan: (plan: PlanTier) => void;
  /** Connect / disconnect a source by connector id. */
  setConnection: (id: string, connected: boolean) => void;
  /** Set the user's grammatical gender explicitly (e.g. from Settings). */
  setUserGender: (gender: Gender) => void;
  /** Pick ONE's Orb skin / personality (from Settings). */
  setAgentSkin: (id: string) => void;
  setAgentPersonality: (id: string) => void;
  setActiveIdentity: (id: string) => void;
  addUnits: (units: Unit[]) => void;
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, patch: Partial<Unit>) => void;
  /**
   * Lifecycle: close a process out — from intent to reality. Sets status →
   * 'completed', stamps completedAt, clears its badge, writes a ONE-voiced
   * broadcast line, and logs a 'completed' entry to the timeline + recent feed.
   * Centralised here so every surface (kebab, finish-line, etc.) closes a
   * process the same way, in the user's language.
   */
  completeUnit: (id: string, lang: 'en' | 'he') => void;
  /** Lifecycle: reopen a completed process — back to active. */
  reopenUnit: (id: string, lang: 'en' | 'he') => void;
  /** Dismiss the completion celebration overlay. */
  clearCelebration: () => void;
  /**
   * Reschedule a reminder forward ("later today" / "tomorrow" / "next week").
   * Reschedules in place: rewrites dueAt + dueLabel, keeps it open, and drops a
   * small ONE-voiced toast so it reads as "I'll bring this back then" rather
   * than the reminder silently vanishing. The caller computes dueAt/dueLabel
   * via utils/snooze so the date math stays pure + testable.
   */
  snoozeReminder: (
    unitId: string,
    reminderId: string,
    dueAt: string,
    dueLabel: string,
    lang: 'en' | 'he',
  ) => void;
  /**
   * Proactive engine: scan every active process for reminders whose `dueAt`
   * has arrived and haven't fired yet, and for each one surface a ONE-voiced
   * toast + a timeline entry + a card badge, then mark it `notified` so it
   * never re-fires. This is what turns ONE from a passive note-keeper into an
   * intermediary that reaches out at the right moment. Called on app launch,
   * on foreground, and on a slow interval while the app is open. Pure-ish:
   * pass `now` in so it stays deterministic.
   */
  fireDueReminders: (now: number, lang: 'en' | 'he') => void;
  /** Delete a unit by id — used by swipe-to-delete on UnitCard. */
  removeUnit: (id: string) => void;
  /**
   * Reset a unit's `unreadUpdates` to 0. Called when the user opens the
   * UnitProfileSheet — at that point they've "seen" the new activity, so
   * the badge on the card and the aggregate count on Home should clear.
   */
  markUnitOpened: (id: string) => void;
  /**
   * Record a new event on a unit: appends a toast to the queue AND
   * increments `unreadUpdates` on that unit. The Home toast layer
   * renders the head of the queue; once dismissed it calls
   * `dismissNotification` to pop it.
   */
  pushUnitNotification: (n: Omit<UnitNotification, 'id' | 'at'>) => void;
  /** Remove the toast with this id from the queue. */
  dismissNotification: (id: string) => void;
  /** Append a message to the home chat. Caps the list at 50. */
  appendHomeChat: (msg: ChatMessageStored) => void;
  /** Wipe the home chat (e.g. when user closes the chat with X). */
  clearHomeChat: () => void;
  /**
   * Queue a message for the Home chat to send (from a non-Home surface).
   * Pass null to clear after Home has consumed it.
   */
  setPendingHomeInput: (text: string | null) => void;
  /** Append a message to a specific unit's chat. Caps the list at 50. */
  appendUnitChat: (unitId: string, msg: ChatMessageStored) => void;
  /** Wipe a unit's chat. */
  clearUnitChat: (unitId: string) => void;
  /** Mark today's digest as delivered (stores YYYY-MM-DD). */
  markDigestDelivered: (isoDate: string) => void;
  markOnboardingComplete: () => void;
  /** Reset back to seeded mock data — used by "clear state" dev affordance. */
  reset: () => void;
  /** Replace units with an empty list — used to demo the empty broadcast state. */
  clearUnits: () => void;
  /**
   * Replace persisted slice with one fetched from Supabase
   * (`profiles.one_user.mvp`). Used by the auth-state listener after
   * SIGNED_IN. Does not touch ephemeral state (notifications).
   */
  hydrateFromSync: (payload: {
    name: string;
    identities: Identity[];
    activeIdentityId: string;
    units: Unit[];
    hasCompletedOnboarding: boolean;
    homeChat?: ChatMessageStored[];
    unitChats?: Record<string, ChatMessageStored[]>;
  }) => void;
}

// Bridge our existing storage utility (SecureStore native / localStorage web)
// to zustand's StateStorage interface so persistence Just Works without
// installing AsyncStorage.
const mvpStorage: StateStorage = {
  getItem: async (name) => {
    const v = await storage.getItem(name);
    return v ?? null;
  },
  setItem: async (name, value) => {
    await storage.setItem(name, value);
  },
  removeItem: async (name) => {
    await storage.removeItem(name);
  },
};

export const useMvpStore = create<MvpStore>()(
  persist(
    (set, get) => ({
      name: 'Ariel',
      userGender: 'unknown',
      agentSkin: 'classic',
      agentPersonality: 'balanced',
      identities: MOCK_IDENTITIES,
      activeIdentityId: DEFAULT_IDENTITY_ID,
      units: sortByAttention(MOCK_UNITS),
      hasCompletedOnboarding: false,
      notifications: [],
      homeChat: [],
      unitChats: {},
      pendingHomeInput: null,
      celebration: null,
      plan: 'free',
      connections: {},

      // Setting the name also (re)infers gender — but only OVERWRITES the
      // stored gender when the name is confidently gendered, so an explicit
      // choice (setUserGender) is never silently undone by a later name edit.
      setName: (name) =>
        set((s) => {
          const inferred = inferGenderFromName(name);
          return { name, userGender: inferred === 'unknown' ? s.userGender : inferred };
        }),
      setUserGender: (userGender) => set({ userGender }),
      setPlan: (plan) => set({ plan }),
      setConnection: (id, connected) =>
        set((s) => ({ connections: { ...s.connections, [id]: connected } })),
      setAgentSkin: (agentSkin) => set({ agentSkin }),
      setAgentPersonality: (agentPersonality) => set({ agentPersonality }),
      setActiveIdentity: (activeIdentityId) => set({ activeIdentityId }),
      addUnits: (incoming) =>
        set((s) => ({ units: sortByAttention([...s.units, ...incoming]) })),
      addUnit: (unit) => set((s) => ({ units: sortByAttention([...s.units, unit]) })),
      updateUnit: (id, patch) =>
        set((s) => ({
          units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),
      completeUnit: (id, lang) =>
        set((s) => {
          const now = Date.now();
          const ts = new Date(now).toISOString();
          const he = lang === 'he';
          const unit = s.units.find((u) => u.id === id);
          const title = unit?.title ?? '';
          const line = he ? 'הושלם — מכוונה למציאות.' : 'Completed — from intent to reality.';
          const headline = he ? `הושלם: ${title}` : `Completed: ${title}`;
          const timelineEntry: UnitTimelineItem = {
            id: `tl_${now}_${Math.floor(Math.random() * 1e6)}`,
            title: headline,
            date: ts,
            kind: 'completed',
          };
          const note: UnitNotification = {
            id: `n_${now}_${Math.floor(Math.random() * 1e6)}`,
            at: now,
            unitId: id,
            text: headline,
            emoji: '🎉',
            kind: 'completed',
          };
          return {
            notifications: [...s.notifications, note],
            celebration: { id: `cel_${now}`, title, emoji: unit?.emoji ?? '🎉' },
            units: sortByAttention(
              s.units.map((u) =>
                u.id === id
                  ? {
                      ...u,
                      status: 'completed' as const,
                      completedAt: ts,
                      unreadUpdates: 0,
                      latestBroadcastText: [line] as [string, string?],
                      lastUpdatedAt: ts,
                      updatedAt: ts,
                      timeline: [timelineEntry, ...(u.timeline ?? [])].slice(0, 40),
                    }
                  : u,
              ),
            ),
          };
        }),
      reopenUnit: (id, lang) =>
        set((s) => {
          const ts = new Date().toISOString();
          const he = lang === 'he';
          const line = he ? 'חזרנו לתנועה.' : 'Back in motion.';
          return {
            units: sortByAttention(
              s.units.map((u) =>
                u.id === id
                  ? {
                      ...u,
                      status: 'active' as const,
                      completedAt: undefined,
                      latestBroadcastText: [line] as [string, string?],
                      lastUpdatedAt: ts,
                      updatedAt: ts,
                    }
                  : u,
              ),
            ),
          };
        }),
      clearCelebration: () => set({ celebration: null }),
      snoozeReminder: (unitId, reminderId, dueAt, dueLabel, lang) =>
        set((s) => {
          const now = Date.now();
          const ts = new Date(now).toISOString();
          const he = lang === 'he';
          const unit = s.units.find((u) => u.id === unitId);
          const rem = unit?.reminders?.find((r) => r.id === reminderId);
          if (!unit || !rem) return {};
          const note: UnitNotification = {
            id: `n_${now}_${Math.floor(Math.random() * 1e6)}`,
            at: now,
            unitId,
            text: he ? `נדחה ל${dueLabel}: ${rem.text}` : `Snoozed to ${dueLabel}: ${rem.text}`,
            emoji: '⏰',
            kind: 'update',
          };
          return {
            notifications: [...s.notifications, note],
            units: s.units.map((u) =>
              u.id === unitId
                ? {
                    ...u,
                    reminders: (u.reminders ?? []).map((r) =>
                      r.id === reminderId
                        ? { ...r, dueAt, dueLabel, done: false, notified: false }
                        : r,
                    ),
                    lastUpdatedAt: ts,
                    updatedAt: ts,
                  }
                : u,
            ),
          };
        }),
      fireDueReminders: (now, lang) => {
        // Cheap pre-check first: an idle scan (nothing due) must NOT call set(),
        // because the Supabase-sync subscriber fires on every set — a no-op
        // would push identical state to the network every interval.
        const anyDue = get().units.some(
          (u) =>
            u.status !== 'completed' &&
            (u.reminders ?? []).some((r) => {
              if (r.done || r.notified || !r.dueAt) return false;
              const t = Date.parse(r.dueAt);
              return !Number.isNaN(t) && t <= now;
            }),
        );
        if (!anyDue) return;
        set((s) => {
          const he = lang === 'he';
          const iso = new Date(now).toISOString();
          const newNotes: UnitNotification[] = [];
          let fired = false;
          const units = s.units.map((u) => {
            // Finished processes don't nag.
            if (u.status === 'completed' || !u.reminders?.length) return u;
            const fresh: UnitTimelineItem[] = [];
            let bumped = 0;
            const reminders = u.reminders.map((r) => {
              if (r.done || r.notified || !r.dueAt) return r;
              const due = Date.parse(r.dueAt);
              if (Number.isNaN(due) || due > now) return r;
              // Due now (or overdue) and never surfaced — ONE speaks up.
              fired = true;
              bumped += 1;
              newNotes.push({
                id: `n_${now}_${Math.floor(Math.random() * 1e6)}`,
                at: now,
                unitId: u.id,
                text: he ? `הגיע הזמן: ${r.text}` : `It's time: ${r.text}`,
                emoji: '⏰',
                kind: 'reminder',
                reminderId: r.id,
              });
              fresh.push({
                id: `tl_${now}_${Math.floor(Math.random() * 1e6)}`,
                title: he ? `תזכורת: ${r.text}` : `Reminder: ${r.text}`,
                date: iso,
                kind: 'reminder',
              });
              return { ...r, notified: true };
            });
            if (!bumped) return u;
            return {
              ...u,
              reminders,
              unreadUpdates: (u.unreadUpdates ?? 0) + bumped,
              lastUpdatedAt: iso,
              timeline: [...fresh, ...(u.timeline ?? [])].slice(0, 40),
            };
          });
          if (!fired) return {};
          return { units, notifications: [...s.notifications, ...newNotes] };
        });
      },
      removeUnit: (id) =>
        set((s) => ({ units: s.units.filter((u) => u.id !== id) })),
      markUnitOpened: (id) =>
        set((s) => ({
          units: s.units.map((u) =>
            u.id === id ? { ...u, unreadUpdates: 0 } : u,
          ),
          // Also drop any queued toasts that target this unit — if you've
          // just opened the process, the toast for it is stale.
          notifications: s.notifications.filter((n) => n.unitId !== id),
        })),
      pushUnitNotification: (n) =>
        set((s) => {
          const now = Date.now();
          const note: UnitNotification = {
            id: `n_${now}_${Math.floor(Math.random() * 1e6)}`,
            at: now,
            ...n,
          };
          // Every notification is also a PERMANENT record of work ONE did on the
          // process. We prepend it to the unit's timeline (newest-first, capped)
          // so the Process → Timeline section and the cross-process "recent
          // activity" feed populate automatically — ONE remembers, and can show,
          // everything it has done. This is the durable counterpart to the
          // ephemeral toast.
          const timelineEntry: UnitTimelineItem = {
            id: `tl_${now}_${Math.floor(Math.random() * 1e6)}`,
            title: n.text,
            date: new Date(now).toISOString(),
            kind: n.kind,
          };
          return {
            notifications: [...s.notifications, note],
            units: s.units.map((u) =>
              u.id === n.unitId
                ? {
                    ...u,
                    unreadUpdates: (u.unreadUpdates ?? 0) + 1,
                    // A notification IS an update — bump lastUpdatedAt so the
                    // card floats to the top of the list (chat-app behaviour).
                    lastUpdatedAt: new Date(now).toISOString(),
                    timeline: [timelineEntry, ...(u.timeline ?? [])].slice(0, 40),
                  }
                : u,
            ),
          };
        }),
      dismissNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
      appendHomeChat: (msg) =>
        set((s) => ({ homeChat: [...s.homeChat, msg].slice(-50) })),
      clearHomeChat: () => set({ homeChat: [] }),
      setPendingHomeInput: (text) => set({ pendingHomeInput: text }),
      appendUnitChat: (unitId, msg) =>
        set((s) => {
          const cur = s.unitChats[unitId] ?? [];
          const iso = new Date().toISOString();
          return {
            unitChats: { ...s.unitChats, [unitId]: [...cur, msg].slice(-50) },
            // A message in a process is activity — float its card to the top.
            units: s.units.map((u) => (u.id === unitId ? { ...u, lastUpdatedAt: iso } : u)),
          };
        }),
      clearUnitChat: (unitId) =>
        set((s) => {
          const next = { ...s.unitChats };
          delete next[unitId];
          return { unitChats: next };
        }),
      markDigestDelivered: (isoDate) => set({ lastDigestDate: isoDate }),
      markOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
      reset: () =>
        set({
          name: 'Ariel',
          identities: MOCK_IDENTITIES,
          activeIdentityId: DEFAULT_IDENTITY_ID,
          units: sortByAttention(MOCK_UNITS),
          hasCompletedOnboarding: false,
          notifications: [],
          homeChat: [],
          unitChats: {},
        }),
      clearUnits: () => set({ units: [], unitChats: {} }),
      hydrateFromSync: (payload) =>
        set({
          name: payload.name,
          identities: payload.identities,
          activeIdentityId: payload.activeIdentityId,
          units: sortByAttention(payload.units),
          hasCompletedOnboarding: payload.hasCompletedOnboarding,
          ...(payload.homeChat ? { homeChat: payload.homeChat } : {}),
          ...(payload.unitChats ? { unitChats: payload.unitChats } : {}),
        }),
    }),
    {
      name: 'one_mvp_v1',
      storage: createJSONStorage(() => mvpStorage),
      // Persist user-facing state. Methods/functions are skipped automatically.
      partialize: (state) => ({
        name: state.name,
        agentSkin: state.agentSkin,
        agentPersonality: state.agentPersonality,
        identities: state.identities,
        activeIdentityId: state.activeIdentityId,
        units: state.units,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        homeChat: state.homeChat,
        unitChats: state.unitChats,
        lastDigestDate: state.lastDigestDate,
        plan: state.plan,
        connections: state.connections,
      }),
    },
  ),
);

// ─── Supabase sync (debounced, no-op when offline / not signed in) ──────
// Wired as a top-level subscribe on the persisted slice. We import the
// helper lazily inside the listener to avoid a require cycle (mvpStore
// imports types, sync imports supabaseService which imports types).
import('./mvpSupabaseSync').then(({ pushMvpToSupabase }) => {
  useMvpStore.subscribe((state) => {
    pushMvpToSupabase({
      name: state.name,
      identities: state.identities,
      activeIdentityId: state.activeIdentityId,
      units: state.units,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      homeChat: state.homeChat,
      unitChats: state.unitChats,
    });
  });
});

// ─── Selectors ───────────────────────────────────────────────────────────────
//
// IMPORTANT: useActiveUnits / useActiveIdentity derive arrays/objects from store
// state. A naive `useMvpStore(s => s.units.filter(...))` returns a fresh array
// on every render, which crashes React's getSnapshot caching with an infinite
// loop. Pull the raw primitives via `useShallow`, then derive with useMemo.

/** Units visible under the currently active identity, ordered chat-app style:
 *  most-recently-updated first (completed sink to the bottom). Sorting here (at
 *  render) — not just on store writes — is what makes a card visibly float to
 *  the top the moment its `lastUpdatedAt` bumps, even mid-session. */
export function useActiveUnits(): Unit[] {
  const { units, activeIdentityId } = useMvpStore(
    useShallow((s) => ({ units: s.units, activeIdentityId: s.activeIdentityId })),
  );
  return useMemo(
    () =>
      units
        .filter((u) => u.identityId === activeIdentityId)
        .sort((a, b) => {
          const aDone = a.status === 'completed' ? 1 : 0;
          const bDone = b.status === 'completed' ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          const ta = Date.parse(a.lastUpdatedAt) || 0;
          const tb = Date.parse(b.lastUpdatedAt) || 0;
          return tb - ta;
        }),
    [units, activeIdentityId],
  );
}

export function useActiveIdentity(): Identity | undefined {
  const { identities, activeIdentityId } = useMvpStore(
    useShallow((s) => ({
      identities: s.identities,
      activeIdentityId: s.activeIdentityId,
    })),
  );
  return useMemo(
    () => identities.find((i) => i.id === activeIdentityId),
    [identities, activeIdentityId],
  );
}
