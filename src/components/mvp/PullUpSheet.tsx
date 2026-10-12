/**
 * PullUpSheet — a bottom sheet for the home's spaces / processes.
 *
 * CONTROLLED by the parent's `open` flag:
 *   • closed → height 0, nothing shows (no bar peeking). An up-chevron on the
 *     home opens it.
 *   • open   → a WHITE (theme surface) sheet slides up from the very bottom; the
 *     chat behind dims (parent scrim). Drag the grabber down (or tap the scrim)
 *     to close.
 *
 * Animates HEIGHT from 0 → expandedHeight, so it grows up from the bottom edge
 * and never leaves a strip of content behind when closed.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeStore } from '../../stores/themeStore';

interface PullUpSheetProps {
  /** Controlled open flag — the home's chevron/scrim drive this. */
  open: boolean;
  /** Fired when the sheet should close (dragged down past the threshold). */
  onClose: () => void;
  /** Full sheet height when open. */
  expandedHeight: number;
  /** Distance from the screen bottom the sheet's bottom edge sits at. */
  bottomOffset: number;
  /** 0 closed → 1 open, for the parent's backdrop dim. */
  progress?: SharedValue<number>;
  children: React.ReactNode;
}

const SNAP = { damping: 24, stiffness: 220, mass: 0.62 } as const;
// Grabber grey — reads on the white light surface and the dark-theme surface.
const GRABBER = '#C4C7D1';

export function PullUpSheet({ open, onClose, expandedHeight, bottomOffset, progress, children }: PullUpSheetProps) {
  const { colors } = useThemeStore();
  const height = useSharedValue(0);
  const startH = useSharedValue(0);

  // Mirror open fraction to the parent's backdrop progress.
  useDerivedValue(() => {
    if (progress) progress.value = expandedHeight > 0 ? height.value / expandedHeight : 0;
  });

  React.useEffect(() => {
    height.value = withSpring(open ? expandedHeight : 0, SNAP);
  }, [open, expandedHeight, height]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startH.value = height.value;
    })
    .onUpdate((e) => {
      // Drag DOWN (positive translationY) shrinks the sheet toward closed.
      const next = startH.value - e.translationY;
      height.value = next < 0 ? 0 : next > expandedHeight ? expandedHeight : next;
    })
    .onEnd((e) => {
      const stayOpen = e.velocityY < 350 && height.value > expandedHeight * 0.55;
      if (stayOpen) {
        height.value = withSpring(expandedHeight, SNAP);
      } else {
        height.value = withSpring(0, SNAP);
        runOnJS(onClose)();
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        { bottom: bottomOffset, backgroundColor: colors.surface, shadowColor: '#000' },
        sheetStyle,
      ]}
    >
      {/* Grabber — drag down to close. */}
      <GestureDetector gesture={pan}>
        <View style={styles.handle} accessibilityRole="button" accessibilityLabel="Close processes">
          <View style={styles.grabber} />
        </View>
      </GestureDetector>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        scrollEnabled={open}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
    // Above the input dock (30) so the open sheet covers it; it slides up from
    // the very bottom.
    zIndex: 31,
    overflow: 'hidden',
  },
  handle: {
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: GRABBER,
  },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 24,
  },
});
