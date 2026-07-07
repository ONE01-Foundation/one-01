/**
 * Unit emoji with a lightweight pulse when centered / chat / profile opens.
 * Uses RN Animated only (no Reanimated/Moti/Lottie) for iOS dev-client stability.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type AnimatedUnitEmojiProps = {
  emoji: string;
  size: number;
  /** Increment to replay the pulse (center / chat / profile). */
  playKey?: number;
  textStyle?: TextStyle;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedUnitEmoji({
  emoji,
  size,
  playKey = 0,
  textStyle,
  style,
}: AnimatedUnitEmojiProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.86);
    opacity.setValue(0.75);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [playKey, emoji, opacity, scale]);

  const fontSize = textStyle?.fontSize ?? Math.round(size * 0.78);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          opacity,
        },
        style,
      ]}
    >
      <Text style={[{ fontSize, lineHeight: fontSize + 4, textAlign: 'center' }, textStyle]}>
        {emoji}
      </Text>
    </Animated.View>
  );
}
