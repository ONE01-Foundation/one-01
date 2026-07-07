/**
 * MvpStack — the new minimal navigation for the rebuilt ONE MVP.
 *
 * Splash + onboarding (Welcome / FirstConversation / SaveYourONE) were
 * removed: Home is the entry point. HomeScreen itself adapts to the
 * user's state (first-time / signed-in / not-signed-in) via the
 * persisted `hasCompletedOnboarding` flag. Sign-in is a bottom sheet
 * triggered by the "Already have ONE? Sign in" link under the Home
 * input bar (no longer a separate stack route).
 *
 * Overlays mounted on Home:
 *   • UnitProfileSheet       (tap on a Unit card)
 *   • IdentitySwitchSheet    (long-press on the Orb / tap on the top header)
 *   • OneProfileSheet        (tap on the Orb)
 *   • SettingsSheet          (from inside OneProfileSheet)
 *   • CreateProcessSheet     (+ icon in the input capsule)
 *   • CreateIdentitySheet    (+ Add Identity inside IdentitySwitchSheet)
 *   • SignInSheet            ("Already have ONE? Sign in")
 */

import React, { useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInSheet } from '../screens/mvp/SignInSheet';
import { HomeScreen } from '../screens/mvp/HomeScreen';
import { UnitProfileSheet } from '../screens/mvp/UnitProfileSheet';
import { IdentitySwitchSheet } from '../screens/mvp/IdentitySwitchSheet';
import { OneProfileSheet } from '../screens/mvp/OneProfileSheet';
import { GlobalSheet } from '../screens/mvp/GlobalSheet';
import { BusinessSheet } from '../screens/mvp/BusinessSheet';
import { CreateBusinessSheet } from '../screens/mvp/CreateBusinessSheet';
import { DIRECTORY } from '../utils/businessDirectory';
import { useBusinessStore } from '../stores/businessStore';
import { SettingsSheet } from '../screens/mvp/SettingsSheet';
import { CreateProcessSheet } from '../screens/mvp/CreateProcessSheet';
import { CreateIdentitySheet } from '../screens/mvp/CreateIdentitySheet';
import { QuickActionsSheet } from '../screens/mvp/QuickActionsSheet';
import { DeleteAccountSheet } from '../screens/mvp/DeleteAccountSheet';
import { LegalSheet, type LegalDoc } from '../screens/mvp/LegalSheet';
import { useMvpStore } from '../stores/mvpStore';
import { NotificationToast } from '../components/mvp/NotificationToast';
import { CompletionCelebration } from '../components/mvp/CompletionCelebration';
import { useDueReminderWatcher } from '../hooks/useDueReminderWatcher';

export type MvpStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<MvpStackParamList>();

export function MvpStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Home">
        {() => <HomeWithOverlays />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

/**
 * Overlay state shared by Home. Keeps all sheets co-located so they can
 * chain (e.g. ONE Profile → Settings, IdentitySwitch → CreateIdentity).
 */
function useOverlayState() {
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [oneProfileOpen, setOneProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createProcessOpen, setCreateProcessOpen] = useState(false);
  const [createIdentityOpen, setCreateIdentityOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false);

  return {
    openUnitId, setOpenUnitId,
    identityOpen, setIdentityOpen,
    oneProfileOpen, setOneProfileOpen,
    settingsOpen, setSettingsOpen,
    createProcessOpen, setCreateProcessOpen,
    createIdentityOpen, setCreateIdentityOpen,
    quickActionsOpen, setQuickActionsOpen,
    deleteOpen, setDeleteOpen,
    legalDoc, setLegalDoc,
    signInOpen, setSignInOpen,
    globalOpen, setGlobalOpen,
    businessId, setBusinessId,
    createBusinessOpen, setCreateBusinessOpen,
  };
}

// Sheet identifiers we may want to "open next" after closing the current one.
type PendingSheet =
  | 'settings'
  | 'identity'
  | 'createIdentity'
  | 'createProcess'
  | 'createBusiness'
  | 'delete'
  | { legal: NonNullable<LegalDoc> }
  | { unit: string }
  | { business: string };

function HomeWithOverlays() {
  const s = useOverlayState();

  // ONE's heartbeat: surface reminders the moment they come due (toast +
  // timeline + badge), on launch, on foreground, and on a slow interval.
  useDueReminderWatcher();

  // Live cloud businesses (created on this device or on the web). Refresh once
  // on mount so the BusinessSheet + chat discovery see the shared directory.
  const cloudBiz = useBusinessStore((st) => st.cloud);
  const activeIdentityName = useMvpStore(
    (st) => st.identities.find((i) => i.id === st.activeIdentityId)?.name ?? '',
  );
  React.useEffect(() => {
    void useBusinessStore.getState().refresh();
  }, []);

  // Live animated index of the ONE profile sheet, shared between the sheet
  // (which writes it as it slides) and HomeScreen (which reads it to bring
  // the home orb back in sync with the close drag). -1 = closed … 1 = full.
  const profileSheetIndex = useSharedValue(-1);

  // Demo: fire a small SEQUENCE of unit events so the user sees the toast
  // → card badge → home-aggregate flow naturally without a real backend.
  // Each entry: delay in ms (from Home mount), unit id, message. Skips
  // Demo toast sequence (Instructor Eli / Workout / Movers) was removed
  // once the AI-driven attention broadcast went live. The Home broadcast
  // now surfaces what's hot/stuck/waiting based on real unit state, and
  // notifications fire from real intent events (extract_task, decision,
  // update_process). When a real backend event stream lands, push
  // straight from there into useMvpStore.pushUnitNotification.

  // ── Daily digest ────────────────────────────────────────────────────
  // First open of the day for a signed-in user with at least one unit:
  // ONE drops a "Here's what's waiting" message into the home chat as
  // its first turn. Uses invokeAttentionLines so the digest is
  // grounded in real state. Fires at most once per calendar day.
  React.useEffect(() => {
    const fire = async () => {
      const state = useMvpStore.getState();
      if (!state.hasCompletedOnboarding) return;
      const today = new Date().toISOString().slice(0, 10);
      if (state.lastDigestDate === today) return;
      const activeId = state.activeIdentityId;
      const activeUnits = state.units.filter(
        (u) => u.identityId === activeId,
      );
      if (activeUnits.length === 0) return;
      try {
        const { invokeAttentionLines } = await import('../services/aiChat');
        const { useLocaleStore } = await import('../stores/localeStore');
        const lang = useLocaleStore.getState().language;
        const lines = await invokeAttentionLines({
          identityName: state.identities.find((i) => i.id === activeId)?.name,
          lang,
          units: activeUnits.slice(0, 8).map((u) => ({
            title: u.title,
            emoji: u.emoji,
            latest: u.latestBroadcastText?.[0],
          })),
        });
        if (lines.length === 0) return;
        const top = lines.slice(0, 3).map((l, i) => `${i + 1}. ${l}`).join('\n');
        const header =
          lang === 'he'
            ? `הינה מה שמחכה לך:\n${top}`
            : `Here's what's waiting:\n${top}`;
        const ts = Date.now();
        state.appendHomeChat({
          id: `o_digest_${ts}`,
          from: 'one',
          text: header,
          ts,
        });
        state.markDigestDelivered(today);
      } catch {
        /* network / parse fail — skip, will retry tomorrow */
      }
    };
    // Wait ~1.5s after mount so the home cascade finishes first.
    const t = setTimeout(fire, 1500);
    return () => clearTimeout(t);
  }, []);

  // iOS allows only ONE RN Modal at a time. When the user chains "open
  // Settings from inside OneProfile", we can't just close OneProfile and
  // open Settings — iOS silently drops the second present if it lands while
  // the first Modal is still releasing. The previous fix used a fixed
  // setTimeout, but the actual close duration is non-deterministic
  // (gorhom spring + Modal cleanup), so it was unreliable.
  //
  // Pattern: callers set a `pendingSheet` and close the current sheet. The
  // current sheet's onClose handler then opens the pending one — one frame
  // after the Modal has actually unmounted. A short setTimeout (40ms)
  // lets RN settle before mounting the next Modal.
  const [pendingSheet, setPendingSheet] = React.useState<PendingSheet | null>(null);
  // TRUE when the currently-open unit was reached via a card LONG-PRESS → the
  // sheet opens straight into chat with the keyboard up. A normal tap clears it.
  const [unitForceChat, setUnitForceChat] = React.useState(false);

  const openPending = React.useCallback(() => {
    if (!pendingSheet) return;
    const which = pendingSheet;
    setPendingSheet(null);
    setTimeout(() => {
      if (which === 'settings') s.setSettingsOpen(true);
      else if (which === 'identity') s.setIdentityOpen(true);
      else if (which === 'createIdentity') s.setCreateIdentityOpen(true);
      else if (which === 'delete') s.setDeleteOpen(true);
      else if (which === 'createProcess') s.setCreateProcessOpen(true);
      else if (which === 'createBusiness') s.setCreateBusinessOpen(true);
      else if (typeof which === 'object' && 'legal' in which) s.setLegalDoc(which.legal);
      else if (typeof which === 'object' && 'business' in which) s.setBusinessId(which.business);
      else if (typeof which === 'object' && 'unit' in which) {
        s.setOpenUnitId(which.unit);
        setTimeout(() => useMvpStore.getState().markUnitOpened(which.unit), 0);
      }
    }, 40);
  }, [pendingSheet, s]);

  return (
    <>
      <HomeScreen
        onTapUnit={(id) => {
          setUnitForceChat(false);
          s.setOpenUnitId(id);
          // Opening a unit "consumes" its unread updates (clears the card + Home
          // badge) — but DEFER it one tick so the sheet can still read the unread
          // flag and open straight into CHAT when there was an unseen update.
          setTimeout(() => useMvpStore.getState().markUnitOpened(id), 0);
        }}
        onLongPressUnit={(id) => {
          // Long-press → open the process straight into CHAT with the keyboard up.
          setUnitForceChat(true);
          s.setOpenUnitId(id);
          setTimeout(() => useMvpStore.getState().markUnitOpened(id), 0);
        }}
        // During onboarding, the Orb / identity row would open sheets full
        // of mock data (Ariel's identities, processes, etc.) — those make
        // no sense for a fresh visitor. Funnel them into SignIn instead.
        onTapHeader={() => {
          if (!useMvpStore.getState().hasCompletedOnboarding) {
            s.setSignInOpen(true);
          } else {
            s.setIdentityOpen(true);
          }
        }}
        onTapOrb={() => {
          if (!useMvpStore.getState().hasCompletedOnboarding) {
            s.setSignInOpen(true);
          } else {
            s.setOneProfileOpen(true);
          }
        }}
        onLongPressOrb={() => {
          if (!useMvpStore.getState().hasCompletedOnboarding) {
            s.setSignInOpen(true);
          } else {
            // Long-press the orb → ONE's Settings (identity switch still lives
            // on the identity-name chevron and inside ONE Profile).
            s.setSettingsOpen(true);
          }
        }}
        onCreateProcess={() => s.setQuickActionsOpen(true)}
        onSignIn={() => s.setSignInOpen(true)}
        // When ONE creates a process via the home chat, open it
        // immediately so the next turn happens inside the unit.
        onCreatedFromChat={(unitId) => {
          useMvpStore.getState().markUnitOpened(unitId);
          s.setOpenUnitId(unitId);
        }}
        signInOpen={s.signInOpen}
        profileOpen={s.oneProfileOpen}
        quickActionsOpen={s.quickActionsOpen}
        // A process sheet is open over Home → HomeScreen drops the chat keyboard
        // on open and brings it back on close.
        unitOpen={!!s.openUnitId}
        // ANY overlay up → ONE won't doze off behind it.
        anySheetOpen={
          !!s.openUnitId ||
          s.identityOpen ||
          s.oneProfileOpen ||
          s.settingsOpen ||
          s.createProcessOpen ||
          s.createIdentityOpen ||
          s.quickActionsOpen ||
          s.deleteOpen ||
          !!s.legalDoc ||
          s.signInOpen ||
          s.globalOpen ||
          !!s.businessId ||
          s.createBusinessOpen
        }
        profileSheetIndex={profileSheetIndex}
        onOpenGlobal={() => s.setGlobalOpen(true)}
        onOpenBusiness={(id) => s.setBusinessId(id)}
      />
      <GlobalSheet visible={s.globalOpen} onClose={() => s.setGlobalOpen(false)} />
      <BusinessSheet
        visible={!!s.businessId}
        // Prefer the live cloud record (carries cloudId → follow + owner
        // dashboard); fall back to the built-in static directory.
        biz={
          cloudBiz.find((b) => b.id === s.businessId) ??
          DIRECTORY.find((b) => b.id === s.businessId) ??
          null
        }
        identityName={activeIdentityName}
        onClose={() => s.setBusinessId(null)}
        onBook={(phrase) => {
          // Hand the booking to the home ONE (same path as typing it) → it
          // creates the appointment process and confirms in chat.
          s.setBusinessId(null);
          useMvpStore.getState().setPendingHomeInput(phrase);
        }}
      />
      <CreateBusinessSheet
        visible={s.createBusinessOpen}
        onClose={() => {
          s.setCreateBusinessOpen(false);
          openPending();
        }}
        // After creating, queue opening the new business sheet — openPending
        // fires it once this Modal has actually released (iOS one-modal rule).
        onCreated={(id) => setPendingSheet({ business: id })}
      />
      <UnitProfileSheet
        unitId={s.openUnitId}
        // onClose flushes any queued sheet (e.g. CreateProcess from the + panel's
        // "New process") once the unit Modal has actually released.
        onClose={() => {
          s.setOpenUnitId(null);
          openPending();
        }}
        onOpenIdentitySwitch={() => s.setIdentityOpen(true)}
        // "New process" from the unit's + panel: close the unit, then open the
        // CreateProcess sheet once the unit Modal has released (pendingSheet).
        onNewProcess={() => {
          setPendingSheet('createProcess');
          s.setOpenUnitId(null);
        }}
      />
      <IdentitySwitchSheet
        visible={s.identityOpen}
        onClose={() => {
          s.setIdentityOpen(false);
          openPending();
        }}
        onAddIdentity={() => {
          setPendingSheet('createIdentity');
          s.setIdentityOpen(false);
        }}
      />
      <OneProfileSheet
        visible={s.oneProfileOpen}
        onClose={() => {
          s.setOneProfileOpen(false);
          // openPending fires the queued sheet (e.g. Settings) AFTER the
          // current sheet has actually slid down + the Modal has released.
          openPending();
        }}
        onOpenIdentitySwitch={() => {
          setPendingSheet('identity');
          s.setOneProfileOpen(false);
        }}
        onOpenSettings={() => {
          setPendingSheet('settings');
          s.setOneProfileOpen(false);
        }}
        onOpenUnit={(unitId) => {
          setPendingSheet({ unit: unitId });
          s.setOneProfileOpen(false);
        }}
        onAddIdentity={() => {
          setPendingSheet('createIdentity');
          s.setOneProfileOpen(false);
        }}
        onCreateBusiness={() => {
          setPendingSheet('createBusiness');
          s.setOneProfileOpen(false);
        }}
        animatedIndex={profileSheetIndex}
      />
      <SettingsSheet
        visible={s.settingsOpen}
        onClose={() => {
          s.setSettingsOpen(false);
          // Settings also participates in the pendingSheet queue: if the
          // user tapped a sub-sheet trigger (Delete / Legal), open it now
          // that Settings has finished sliding down.
          openPending();
        }}
        onOpenDelete={() => {
          setPendingSheet('delete');
          s.setSettingsOpen(false);
        }}
        onOpenLegal={(doc) => {
          setPendingSheet({ legal: doc });
          s.setSettingsOpen(false);
        }}
      />
      <DeleteAccountSheet
        visible={s.deleteOpen}
        onClose={() => s.setDeleteOpen(false)}
        onConfirmed={() => {
          useMvpStore.getState().reset();
          s.setDeleteOpen(false);
        }}
      />
      <LegalSheet doc={s.legalDoc} onClose={() => s.setLegalDoc(null)} />
      <CreateProcessSheet
        visible={s.createProcessOpen}
        onClose={() => s.setCreateProcessOpen(false)}
        onCreated={(unit) => {
          // After creating, jump straight into the new Unit's profile.
          s.setOpenUnitId(unit.id);
        }}
      />
      <CreateIdentitySheet
        visible={s.createIdentityOpen}
        onClose={() => s.setCreateIdentityOpen(false)}
      />
      <QuickActionsSheet
        visible={s.quickActionsOpen}
        onClose={() => s.setQuickActionsOpen(false)}
        onNewProcess={() => s.setCreateProcessOpen(true)}
      />
      <SignInSheet
        visible={s.signInOpen}
        onClose={() => s.setSignInOpen(false)}
        onSignedIn={() => {
          useMvpStore.getState().markOnboardingComplete();
          s.setSignInOpen(false);
        }}
      />
      {/* Top-of-screen toast: drops in when something happens in a unit
          (instructor confirmed, payment received, etc). Tapping the toast
          opens the related unit's profile sheet. Sits ABOVE all home chrome
          but BELOW modal sheets (they have their own Modal layer). */}
      <NotificationToast
        onPress={(n) => {
          // Open into the unit; defer clearing unread so the sheet opens into
          // CHAT to show the update the toast was about.
          s.setOpenUnitId(n.unitId);
          setTimeout(() => useMvpStore.getState().markUnitOpened(n.unitId), 0);
        }}
      />
      {/* The payoff moment: when a process is marked complete, ONE beams +
          confetti bursts + a warm line names what just became real. It's its
          own Modal so it overlays everything (home and any open sheet). */}
      <CompletionCelebration />
    </>
  );
}

