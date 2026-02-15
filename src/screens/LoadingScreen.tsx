/**
 * Loading Screen – Dot grows to 72px, moves up. Uses RN Animated only (no Reanimated)
 * to avoid "runtime not ready" / HostFunction errors on iOS.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useThemeStore } from '../stores/themeStore';

interface LoadingScreenProps {
  onComplete: () => void;
}

const CIRCLE_SIZE = 72;

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const { colors, initialized } = useThemeStore();
  const scale = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!initialized) return;
    // Phase 1: grow (0 -> 1) over 1.2s
    // Phase 2: move up after 2s, over 0.8s; then complete
    const grow = Animated.timing(scale, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    });
    const moveUp = Animated.timing(translateY, {
      toValue: -80,
      duration: 800,
      useNativeDriver: true,
    });
    Animated.sequence([
      grow,
      Animated.delay(800),
      moveUp,
      Animated.delay(400),
    ]).start(() => {
      onComplete();
    });
  }, [initialized, onComplete, scale, translateY]);

  if (!initialized) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.circleWrap,
          {
            transform: [
              { scale },
              { translateY },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.circle,
            {
              backgroundColor: colors.circle,
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {},
});
