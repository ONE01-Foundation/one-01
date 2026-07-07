/**
 * useDueReminderWatcher — makes ONE act on time, on its own.
 *
 * Reminders carry a resolved `dueAt`, but data sitting in the store doesn't
 * help anyone. This watcher is the heartbeat that turns that data into action:
 * while the app is open it periodically — and the instant the app returns to
 * the foreground — asks the store to surface any reminder whose moment has
 * arrived (a ONE-voiced toast + a timeline entry + a card badge). Each reminder
 * fires once; snoozing re-arms it for the new time.
 *
 * Scope note: this is the *in-app* layer. Real OS-level notifications (so the
 * phone buzzes while the app is closed) would schedule off the same `dueAt`
 * via expo-notifications — this engine is the foundation that sits under it.
 *
 * Mounted once, near the root of the signed-in app (MvpStack).
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMvpStore } from '../stores/mvpStore';
import { useLocaleStore } from '../stores/localeStore';

/** How often to re-check while the app is foregrounded. */
const SCAN_INTERVAL_MS = 60 * 1000;
/** Small delay after mount so persisted state has hydrated first. */
const INITIAL_DELAY_MS = 2500;

export function useDueReminderWatcher(): void {
  useEffect(() => {
    const scan = () => {
      const store = useMvpStore.getState();
      // Don't nag during onboarding — the mock preview units carry their own
      // reminders and the user hasn't actually committed to anything yet.
      if (!store.hasCompletedOnboarding) return;
      const lang = useLocaleStore.getState().language;
      store.fireDueReminders(Date.now(), lang);
    };

    const initial = setTimeout(scan, INITIAL_DELAY_MS);
    const interval = setInterval(scan, SCAN_INTERVAL_MS);
    const onAppStateChange = (state: AppStateStatus) => {
      // Coming back to the app is the most important moment to catch up —
      // anything that came due while it was backgrounded surfaces right away.
      if (state === 'active') scan();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      sub.remove();
    };
  }, []);
}
