/**
 * UnitCard — Process card with swipe-to-action.
 *
 * Card body (no swipe):
 *   💪 Weight Gain                            14:20 ●
 *   Next workout today at 2:00 PM.
 *   ─────────────────────────  (thin green progress)
 *
 * Swipe LEFT → the card slides left to reveal Pin / Share / Delete pills pinned
 * to the RIGHT edge (WhatsApp-style). The reveal is a custom Reanimated `Pan`
 * gesture — NOT RNGH's <Swipeable> — because that component bakes
 * `I18nManager.isRTL` into its action-container flexDirection at import time,
 * which flips the pills to the LEFT and corrupts its width measurement on a
 * Hebrew device. This hand-rolled version is direction-agnostic: pills always
 * sit on the right in both languages.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { RectButton, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { useT, useLanguage } from '../../i18n/useT';
import { rtlRow, rtlText } from '../../utils/rtl';
import { unitStatusLine } from '../../utils/unitStatusLine';
import type { Unit } from '../../core/mvp/types';

// Reveal geometry — 3 pills × 64 + 2 gaps × 6 + an 8px gap from the card = 212.
const PILL_W = 64;
const PILL_GAP = 6;
const ACTIONS_GAP = 8; // breathing room between the card edge and the first pill
const ACTIONS_WIDTH = PILL_W * 3 + PILL_GAP * 2 + ACTIONS_GAP;
// Card + container corner radius. The rounded mask is restored (see
// swipeContainer); the Delete pill's OUTER corners are rounded to this same
// value so the mask's arc lands exactly on the pill's own edge — no cut.
const CARD_RADIUS = 24;

interface UnitCardProps {
  unit: Unit;
  onPress?: () => void;
  /** Long-press (hold) the card → open the process straight into CHAT with the
   *  keyboard up (a fast "talk to this process now" gesture). */
  onLongPress?: () => void;
  onPin?: (unit: Unit) => void;
  onShare?: (unit: Unit) => void;
  onDelete?: (unit: Unit) => void;
  /** When TRUE, the swipe-to-reveal pin/share/delete row is disabled.
   *  Used for onboarding-example cards — those are illustrative, not
   *  real processes, so the actions don't apply. */
  swipeDisabled?: boolean;
}

const PROGRESS_GREEN = '#10B981';

function formatTimestamp(iso: string, yesterdayLabel: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diffH = (now - t) / (1000 * 60 * 60);
  if (diffH < 24) {
    try {
      // Locale-aware: en-US gets "2:20 PM", he/en-GB get "14:20", etc.
      return new Date(t).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      const d = new Date(t);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  if (diffH < 48) return yesterdayLabel;
  return new Date(t).toLocaleDateString();
}

export function UnitCard({
  unit,
  onPress,
  onLongPress,
  onPin,
  onShare,
  onDelete,
  swipeDisabled = false,
}: UnitCardProps) {
  const { colors } = useThemeStore();
  const t = useT();
  const lang = useLanguage();
  const he = lang === 'he';
  const secondary = unit.latestBroadcastText[1];
  const live = unitStatusLine(unit, he);
  const timestamp = formatTimestamp(unit.lastUpdatedAt, t('card_timestamp_yesterday'));
  const hasUnread = unit.unreadUpdates > 0;

  // Visibility caption — private / public / shared (+N). Falls back to the
  // unit's relationLabel for shared processes ("Shared +2" etc.).
  const visibilityLabel =
    unit.visibility === 'public'
      ? he ? 'ציבורי' : 'Public'
      : unit.visibility === 'shared'
        ? unit.relationLabel || (he ? 'משותף' : 'Shared')
        : he ? 'פרטי' : 'Private';

  // Swipe-to-reveal. `tx` is the ROW's horizontal offset: 0 = closed,
  // -ACTIONS_WIDTH = fully open (pills exposed on the RIGHT). Lives on the UI
  // thread, driven by the Pan gesture below.
  const tx = useSharedValue(0);
  const startTx = useSharedValue(0);

  // Fire an action pill (called on the JS thread from a pill's onPress), then
  // snap the row shut. Assigning `tx.value = withSpring(...)` from JS is fine.
  const runAction = (fn?: (u: Unit) => void) => {
    tx.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
    fn?.(unit);
  };

  const panGesture = Gesture.Pan()
    // Only claim HORIZONTAL drags — vertical movement stays with the list scroll.
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .enabled(!swipeDisabled)
    .onStart(() => {
      startTx.value = tx.value;
    })
    .onUpdate((e) => {
      let next = startTx.value + e.translationX;
      if (next > 0) next = 0; // can't drag past the closed position
      if (next < -ACTIONS_WIDTH) {
        // Rubber-band past fully-open so the end feels elastic, not a hard wall.
        next = -ACTIONS_WIDTH + (next + ACTIONS_WIDTH) * 0.25;
      }
      tx.value = next;
    })
    .onEnd((e) => {
      // This callback is a WORKLET (runs on the UI thread) — everything here
      // must be worklet-safe. `withSpring` is; calling a plain JS helper is NOT
      // (that was the crash). So the spring is inlined, not delegated.
      // Hysteresis so CLOSING is easy: if it started open, a small drag-right
      // (or any right-fling) shuts it; a right/left fling always wins.
      const wasOpen = startTx.value < -ACTIONS_WIDTH / 2;
      let open: boolean;
      if (e.velocityX > 500) open = false; // fling right → close
      else if (e.velocityX < -500) open = true; // fling left → open
      else if (wasOpen) open = -tx.value > ACTIONS_WIDTH * 0.72; // drag right ~28% closes
      else open = -tx.value > ACTIONS_WIDTH * 0.35; // drag left ~35% opens
      tx.value = withSpring(open ? -ACTIONS_WIDTH : 0, {
        damping: 22,
        stiffness: 220,
        mass: 0.6,
        velocity: e.velocityX,
      });
    });

  const rowSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  // Tapping the card body (JS thread): if it's swiped open, the tap just closes
  // it; otherwise it opens the process.
  const handlePress = () => {
    if (tx.value !== 0) {
      tx.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      return;
    }
    onPress?.();
  };

  return (
    // One row that slides as a unit: [ card | actions ]. The card is exactly
    // the container's width, so the pills sit just past the right edge —
    // invisible (clipped by `overflow:hidden`) until you swipe left. Nothing to
    // see at rest, and direction-agnostic (works the same in Hebrew + English).
    <View style={styles.swipeContainer}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.row, rowSlideStyle]}>
          <Pressable
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={340}
            accessibilityRole="button"
            accessibilityLabel={live ? `${unit.title}: ${live}` : unit.title}
            style={({ pressed }) => [
              styles.card,
              styles.cardFill,
              {
                // Theme surface — white in light, charcoal lift in dark. Used to
                // be a hardcoded '#FFFFFF' which read as a stark white block on
                // the dark page.
                backgroundColor: colors.surface,
                // Completed processes read as "done" — dimmed back, out of the way.
                opacity: pressed ? 0.94 : unit.status === 'completed' ? 0.62 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
        {/* Header: emoji + title  |  timestamp + unread dot.
            In Hebrew the whole row flips: emoji+title hug the RIGHT edge,
            the timestamp sits on the LEFT. */}
        <View style={[styles.headerRow, rtlRow(lang)]}>
          <View style={[styles.titleSection, rtlRow(lang)]}>
            <Text style={styles.emoji}>{unit.emoji}</Text>
            <Text
              style={[styles.title, { color: colors.text }, rtlText(lang)]}
              numberOfLines={1}
            >
              {unit.title}
            </Text>
          </View>
          <View style={[styles.headerRight, rtlRow(lang)]}>
            <View style={styles.timeRow}>
              {unit.status === 'completed' && (
                <Text style={styles.completedCheck} accessibilityLabel="Completed">✓</Text>
              )}
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                {timestamp}
              </Text>
              {hasUnread && (
                <View
                  style={styles.alertBadge}
                  accessibilityLabel={`${unit.unreadUpdates} unread updates`}
                >
                  <Text style={styles.alertBadgeText}>
                    {unit.unreadUpdates > 99 ? '99+' : unit.unreadUpdates}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.visibility, { color: colors.textSecondary }]} numberOfLines={1}>
              {visibilityLabel}
            </Text>
          </View>
        </View>

        {(!!live || !!secondary) && (
          <View style={styles.body}>
            {!!live && (
              <Text
                style={[styles.broadcast, { color: colors.text }, rtlText(lang)]}
                numberOfLines={1}
              >
                {live}
              </Text>
            )}
            {!!secondary && (
              <Text
                style={[
                  styles.broadcast,
                  styles.broadcastSecondary,
                  { color: colors.textSecondary },
                  rtlText(lang),
                ]}
                numberOfLines={1}
              >
                {secondary}
              </Text>
            )}
          </View>
        )}

          </Pressable>

          {/* Action pills — a fixed-width row to the RIGHT of the card, so they
              sit off-screen until the row slides left. Order Pin · Share ·
              Delete (Delete at the far edge), locked LTR in both languages. */}
          {!swipeDisabled && (
            <View style={styles.actionsRow}>
              <ActionPill glyph="📌" label={t('card_pin')} color="#F59E0B" onPress={() => runAction(onPin)} />
              <ActionPill glyph="↗" label={t('card_share')} color="#3B82F6" onPress={() => runAction(onShare)} />
              <ActionPill
                glyph="🗑"
                label={t('card_delete')}
                color="#EF4444"
                onPress={() => runAction(onDelete)}
                trailingRadius={CARD_RADIUS}
              />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ActionPill({
  glyph,
  label,
  color,
  onPress,
  trailingRadius,
}: {
  glyph: string;
  label: string;
  color: string;
  onPress: () => void;
  /** When set, rounds the pill's OUTER (right) corners to this radius so the
   *  edge pill aligns with the container's rounded mask instead of being cut. */
  trailingRadius?: number;
}) {
  return (
    <RectButton
      onPress={onPress}
      style={[
        styles.actionPill,
        { backgroundColor: color },
        trailingRadius != null && {
          borderTopRightRadius: trailingRadius,
          borderBottomRightRadius: trailingRadius,
        },
      ]}
    >
      <Text style={styles.actionGlyph}>{glyph}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </RectButton>
  );
}

const styles = StyleSheet.create({
  // Swipe container — the rounded MASK is back (borderRadius + overflow:hidden):
  // it clips the card's corners AND the off-screen pills to the card silhouette.
  // The Delete pill (at the right edge) is given matching outer corners via
  // `trailingRadius`, so the mask's arc lands on the pill's own rounded edge
  // instead of biting a chunk out of it.
  swipeContainer: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // The sliding row: [ card | actions ], laid out LTR so the card is always on
  // the left and the pills to its right (off-screen until swiped) — in both
  // languages. Stretched to the container width by the parent; children keep
  // their own widths and overflow to the right (clipped by the container).
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'stretch',
  },
  // Card fills the full container width, so the actions land exactly past the
  // right edge.
  cardFill: {
    width: '100%',
  },
  // Fixed-width action strip sized to exactly ACTIONS_WIDTH. `direction: 'ltr'`
  // locks the order Pin · Share · Delete (Delete at the far edge). `paddingLeft`
  // is the gap between the card and the first pill.
  actionsRow: {
    width: ACTIONS_WIDTH,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: ACTIONS_GAP,
    gap: PILL_GAP,
    direction: 'ltr',
  },
  actionPill: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    gap: 2,
  },
  // ── RTL helpers (Hebrew). The app handles RTL manually (no I18nManager),
  // so cards opt in per-language.
  rowReverse: { flexDirection: 'row-reverse' },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' },
  headerRightRTL: { alignItems: 'flex-start' },
  actionGlyph: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  emoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    lineHeight: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 36,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visibility: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.85,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 14,
  },
  completedCheck: {
    fontSize: 14,
    fontWeight: '800',
    color: PROGRESS_GREEN,
  },
  // Replaces the old empty 8-px dot. A pill-shaped badge that shows the
  // unread-event count for this process. Stays compact for single digits
  // (looks like a circle) and stretches for 2- or 3-digit counts.
  alertBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: PROGRESS_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    includeFontPadding: false as unknown as boolean,
  },
  body: {
    gap: 2,
  },
  broadcast: {
    fontSize: 14,
    lineHeight: 20,
  },
  broadcastSecondary: {
    fontSize: 13,
    lineHeight: 18,
  },
});
