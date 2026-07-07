/**
 * ActionMenu — a small dropdown popover of icon + label rows, anchored under a
 * ⋮ button. Matches the native "context menu" look (rounded surface card, quick
 * fade/scale in, hairline row dividers). Reused by the agent profile and the
 * unit sheet; the item list is passed in per-surface (context-aware).
 *
 * Render it as a DIRECT child of the sheet content (a sibling of the scroll
 * view) so it floats over everything. It fills the sheet with a tap-to-close
 * scrim and positions the card at the top, on the leading side (right in RTL).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlRow, rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

export interface ActionMenuItem {
  label: string;
  /** Optional emoji glyph shown on the leading side. */
  icon?: string;
  /** Secondary line under the label (e.g. current value). */
  sub?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function ActionMenu({
  visible,
  onClose,
  items,
  top = 58,
}: {
  visible: boolean;
  onClose: () => void;
  items: ActionMenuItem[];
  /** Distance from the sheet content's top to the menu card. */
  top?: number;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const [mounted, setMounted] = useState(visible);
  const sv = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      sv.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
      return;
    }
    sv.value = withTiming(0, { duration: 130, easing: Easing.in(Easing.cubic) });
    const t = setTimeout(() => setMounted(false), 160);
    return () => clearTimeout(t);
  }, [visible, sv]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [
      { scale: 0.95 + sv.value * 0.05 },
      { translateY: (1 - sv.value) * -8 },
    ],
  }));
  // A slight dim over the content beneath the open menu, fading in with it.
  const scrimStyle = useAnimatedStyle(() => ({ opacity: sv.value * 0.22 }));

  if (!mounted) return null;

  const sideStyle = he ? { right: 14 } : { left: 14 };

  return (
    <View style={[StyleSheet.absoluteFill, styles.host]} pointerEvents="box-none">
      {/* Dim the content beneath the open menu. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      {/* Tap-anywhere-else to dismiss. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View
        style={[styles.card, { backgroundColor: colors.surface, top }, sideStyle, cardStyle]}
      >
        {items.map((it, i) => (
          <Pressable
            key={it.label}
            onPress={() => {
              haptic.select();
              onClose();
              it.onPress();
            }}
            style={({ pressed }) => [
              styles.row,
              rtlRow(lang),
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              { backgroundColor: pressed ? colors.background : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            <View style={styles.iconSlot}>
              {it.icon ? <Text style={styles.iconGlyph}>{it.icon}</Text> : null}
            </View>
            <View style={styles.flex1}>
              <Text
                style={[styles.label, { color: it.destructive ? '#EF4444' : colors.text }, rtlText(lang)]}
                numberOfLines={1}
              >
                {it.label}
              </Text>
              {it.sub ? (
                <Text style={[styles.sub, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                  {it.sub}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { zIndex: 100 },
  scrim: { backgroundColor: '#000' },
  flex1: { flex: 1 },
  card: {
    position: 'absolute',
    minWidth: 232,
    maxWidth: 300,
    borderRadius: 18,
    paddingVertical: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  iconSlot: { width: 24, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 18 },
  label: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 2 },
});
