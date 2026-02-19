/**
 * EdgeGradientBars – Top and bottom bars with progressive gradient (background → transparent).
 * Stronger / darker near the edge, fades to transparent toward the content.
 * Works in both light and dark theme.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../stores/themeStore';

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/.{2}/g);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

const BAR_HEIGHT = 72;
const GRADIENT_STOPS: number[] = [0, 0.25, 0.5, 0.75, 1];
const ALPHAS = [1, 0.85, 0.5, 0.2, 0];

export function EdgeGradientBars() {
  const { colors } = useThemeStore();
  const gradientColors = GRADIENT_STOPS.map((_, i) => hexToRgba(colors.background, ALPHAS[i]));

  return (
    <>
      <View style={[styles.bar, styles.topBar]} pointerEvents="none">
        <LinearGradient
          colors={gradientColors}
          locations={GRADIENT_STOPS}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
      <View style={[styles.bar, styles.bottomBar]} pointerEvents="none">
        <LinearGradient
          colors={gradientColors}
          locations={GRADIENT_STOPS}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    overflow: 'hidden',
  },
  topBar: {
    top: 0,
  },
  bottomBar: {
    bottom: 0,
  },
});
