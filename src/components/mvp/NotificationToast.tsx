/**
 * NotificationToast — top-of-screen banner for incoming unit events.
 *
 * Watches the store's `notifications` queue and renders the HEAD as a
 * floating banner just under the status bar / time indicator. Slides in
 * from above, holds for a few seconds, slides out, then calls
 * `dismissNotification` to pop it from the queue. The next item (if any)
 * animates in on the following render.
 *
 * Mounted near the root of HomeScreen so it sits above the hero / cards
 * but below modal sheets — exactly like iOS-style notification banners.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore, type UnitNotification } from '../../stores/mvpStore';
import { useLanguage } from '../../i18n/useT';
import { SNOOZE_OPTIONS, snoozeOptionLabel, snoozeTarget } from '../../utils/snooze';

const VISIBLE_HOLD_MS = 3200;
const SLIDE_DURATION = 260;

interface NotificationToastProps {
  /** Optional tap handler — e.g. open the related unit's sheet. */
  onPress?: (n: UnitNotification) => void;
}

export function NotificationToast({ onPress }: NotificationToastProps) {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  const he = lang === 'he';
  const notifications = useMvpStore((s) => s.notifications);
  const dismiss = useMvpStore((s) => s.dismissNotification);
  const snoozeReminder = useMvpStore((s) => s.snoozeReminder);
  // Look up the source unit so the toast can fall back to that unit's
  // emoji when the event itself didn't carry one.
  const units = useMvpStore((s) => s.units);

  const head = notifications[0];
  const headId = head?.id ?? null;

  // Slide / fade values. translateY < 0 sits above the screen edge.
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  // Track which id is currently being shown so the auto-dismiss timer
  // doesn't fire against a stale notification (e.g. user opened the unit
  // before the hold elapsed and that drops the head from the queue).
  const showingIdRef = useRef<string | null>(null);

  const onHidden = (id: string) => {
    // Only dismiss if THIS id is still the one we expected to hide; the
    // user may have manually removed it (markUnitOpened) before the timer.
    if (showingIdRef.current === id) {
      dismiss(id);
      showingIdRef.current = null;
    }
  };

  // Snooze a due-reminder toast inline — ONE nudged you, and you can push it
  // forward without opening anything. Offers the three quick choices, then
  // pops this banner from the queue.
  const handleSnooze = (n: UnitNotification) => {
    if (!n.reminderId) return;
    Alert.alert(
      he ? 'דחיית תזכורת' : 'Snooze reminder',
      n.text,
      [
        ...SNOOZE_OPTIONS.map((o) => ({
          text: snoozeOptionLabel(o, lang),
          onPress: () => {
            const { dueAt, dueLabel } = snoozeTarget(o, Date.now(), lang);
            snoozeReminder(n.unitId, n.reminderId!, dueAt, dueLabel, lang);
          },
        })),
        { text: he ? 'ביטול' : 'Cancel', style: 'cancel' as const },
      ],
    );
    dismiss(n.id);
    showingIdRef.current = null;
  };

  useEffect(() => {
    if (!head) {
      // No queued items — keep banner off-screen.
      translateY.value = withTiming(-80, { duration: SLIDE_DURATION });
      opacity.value = withTiming(0, { duration: SLIDE_DURATION });
      return;
    }
    showingIdRef.current = head.id;
    const id = head.id;
    // Due-reminder toasts are actionable (tap to open, or Snooze) — hold them
    // longer so the user has time to reach for the button.
    const holdMs = head.kind === 'reminder' ? VISIBLE_HOLD_MS * 2 : VISIBLE_HOLD_MS;
    // Slide in.
    translateY.value = withTiming(0, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: SLIDE_DURATION });
    // Hold, then slide out and pop from queue.
    translateY.value = withDelay(
      SLIDE_DURATION + holdMs,
      withTiming(-80, {
        duration: SLIDE_DURATION,
        easing: Easing.in(Easing.cubic),
      }),
    );
    opacity.value = withDelay(
      SLIDE_DURATION + holdMs,
      withTiming(
        0,
        { duration: SLIDE_DURATION },
        (finished) => {
          'worklet';
          if (finished) runOnJS(onHidden)(id);
        },
      ),
    );
    // Re-run when the head item changes (queue advanced).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headId]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!head) return null;

  const unit = units.find((u) => u.id === head.unitId);
  const emoji = head.emoji ?? unit?.emoji ?? '🔔';
  // Visual kind tag — small coloured pill on the leading edge of the
  // banner. Distinguishes ONE's signal events (capture / decision /
  // update / created) from a generic ambient event.
  const kindTag = (() => {
    switch (head.kind) {
      case 'capture':  return { label: 'Captured',  color: '#10B981' };
      case 'decision': return { label: 'Decision',  color: '#6366F1' };
      case 'update':   return { label: 'Updated',   color: '#F59E0B' };
      case 'created':  return { label: 'New',       color: '#0EA5E9' };
      case 'completed': return { label: 'Done',     color: '#22C55E' };
      case 'reminder': return { label: 'Reminder', color: '#F97316' };
      default:         return null;
    }
  })();

  return (
    <Animated.View
      // Anchored just under the status bar; insets.top accounts for the
      // notch / Dynamic Island.
      style={[
        styles.wrap,
        { top: insets.top + 6 },
        containerStyle,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          if (onPress) onPress(head);
          // Dismiss immediately on tap — the user has acknowledged it.
          dismiss(head.id);
          showingIdRef.current = null;
        }}
        style={[
          styles.banner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={head.text}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            {kindTag && (
              <View style={[styles.kindTag, { backgroundColor: kindTag.color }]}>
                <Text style={styles.kindTagText}>{kindTag.label}</Text>
              </View>
            )}
            {!!unit?.title && (
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
              >
                {unit.title}
              </Text>
            )}
          </View>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {head.text}
          </Text>
        </View>
        {/* Reminder toasts are actionable: snooze without opening the process.
            The nested Pressable captures the tap so the banner's open-unit
            onPress doesn't also fire. */}
        {head.kind === 'reminder' && !!head.reminderId && (
          <Pressable
            onPress={() => handleSnooze(head)}
            hitSlop={8}
            style={[styles.snoozeBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={he ? 'דחה תזכורת' : 'Snooze reminder'}
          >
            <Text style={[styles.snoozeBtnText, { color: colors.textSecondary }]}>
              {he ? 'דחה' : 'Snooze'}
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    // Sits above orb / broadcast / cards. Below modal sheets — those
    // mount their own RN Modal so they always cover this anyway.
    zIndex: 100,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 28,
    width: 32,
    textAlign: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  /** Coloured pill that names ONE's signal kind on the toast. */
  kindTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kindTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Inline "Snooze" action on a due-reminder toast.
  snoozeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  snoozeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
