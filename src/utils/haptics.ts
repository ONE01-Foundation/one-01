/**
 * haptics — a thin, crash-proof wrapper over expo-haptics.
 *
 * Every call is wrapped so a missing native module (web, an old Expo Go, a
 * simulator without the Taptic Engine) degrades to a silent no-op instead of
 * throwing. Import these named helpers rather than expo-haptics directly so
 * the call sites read as intent ("this is a success", "this is a light tap")
 * and we have ONE place to retune the whole app's feel.
 *
 * Usage: `import { haptic } from '../utils/haptics'; haptic.tap();`
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<unknown>) {
  if (!enabled) return;
  // Fire-and-forget; never let a haptics failure surface to the UI.
  fn().catch(() => {});
}

export const haptic = {
  /** A light tap — sending a message, advancing the broadcast, tapping the orb. */
  tap() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** A firmer press — opening a sheet, confirming a primary action. */
  press() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  /** A discrete tick — toggling a control on/off (call buttons, switches). */
  select() {
    safe(() => Haptics.selectionAsync());
  },
  /** Positive resolution — a step completed, a process created, intent → reality. */
  success() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** A warning — a destructive or attention-needed moment. */
  warning() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
};
