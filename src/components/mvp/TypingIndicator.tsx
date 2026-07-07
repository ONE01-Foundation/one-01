/**
 * TypingIndicator — three dots that fade in/out in sequence, styled to match
 * an ONE bubble. Used inside chat surfaces while waiting for a reply.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';

interface TypingIndicatorProps {
  /** Bubble background. Defaults to colors.surface. */
  bubbleStyle?: StyleProp<ViewStyle>;
  /** Wrapper style — usually flex alignment. */
  containerStyle?: StyleProp<ViewStyle>;
}

const DOT_DURATION = 360;

function Dot({ delay }: { delay: number }) {
  const { colors } = useThemeStore();
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_DURATION, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: DOT_DURATION, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.textSecondary }, style]} />;
}

export function TypingIndicator({ bubbleStyle, containerStyle }: TypingIndicatorProps) {
  const { colors } = useThemeStore();
  return (
    <View style={[styles.row, containerStyle]}>
      <View style={[styles.bubble, { backgroundColor: colors.surface }, bubbleStyle]}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderTopLeftRadius: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
