/**
 * SplashScreen.
 *
 * The dot stays at vertical screen-centre throughout, and goes through three
 * phases:
 *
 *   1. GROW — scale 0 → 1.6 with an easing-out "back" curve. The dot
 *      balloons to a size noticeably bigger than the home orb (84 px), so
 *      it feels like a deliberate brand moment rather than just an avatar.
 *   2. HOLD — sits at 1.6 with a very subtle breath.
 *   3. SHRINK + FADE — scale 1.6 → 0 AND opacity 1 → 0, both at the centre.
 *      Once the dot has fully shrunk away, the home screen takes over
 *      (its own orb mounts at screen-centre and rises to the top).
 *
 * No eyes on splash — that's the brand mark. Eyes belong to the agent on
 * the next screen.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { useThemeStore } from '../../stores/themeStore';

interface SplashScreenProps {
  onDone: () => void;
}

// Phase timings (ms). Total ~ 1880 ms.
// Dot starts at scale 0 (empty screen), grows SMOOTHLY to PEAK_SCALE
// (no back-easing overshoot — user reported the prior bounce read as a
// glitch), holds with a subtle breath, then shrinks back DOWN TO 1
// (= the Home orb size) and fades out. Because the splash ends at the
// exact size of the Home orb, when the splash container fades the Home
// orb behind is revealed at the same diameter and position — clean blend.
const GROW_DURATION = 520;
const HOLD_AFTER_GROW = 920;
const SHRINK_DURATION = 440;
const PEAK_SCALE = 1.6;
const REST_SCALE = 1; // matches the Home orb scale 1 at size 84

export function SplashScreen({ onDone }: SplashScreenProps) {
  const { colors } = useThemeStore();

  const scale = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Phase 1+2+3 on the scale value, sequenced so they can't race:
    //  1. Grow smoothly from 0 → PEAK_SCALE (no overshoot).
    //  2. Hold at PEAK_SCALE with a subtle breath.
    //  3. Shrink from PEAK_SCALE → REST_SCALE (= Home orb size).
    scale.value = withSequence(
      withTiming(PEAK_SCALE, {
        duration: GROW_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
      // Subtle breath during the hold.
      withRepeat(
        withSequence(
          withTiming(PEAK_SCALE * 1.03, {
            duration: HOLD_AFTER_GROW / 2,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(PEAK_SCALE, {
            duration: HOLD_AFTER_GROW / 2,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        1,
        false,
      ),
      // Shrink DOWN TO the Home orb size, not to zero. The container
      // opacity fades in lockstep — when the splash dot reaches REST_SCALE
      // the Home orb (same size, same position) is revealed beneath.
      withTiming(REST_SCALE, {
        duration: SHRINK_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Phase 3 (opacity half): fades in lockstep with the shrink so the
    // dot disappears at the centre — not "slide off, then disappear".
    // Triggers `onDone` when finished so the splash unmounts.
    containerOpacity.value = withDelay(
      GROW_DURATION + HOLD_AFTER_GROW,
      withTiming(
        0,
        { duration: SHRINK_DURATION, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
  }, [onDone, scale, containerOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.background },
        containerStyle,
      ]}
      pointerEvents="none"
    >
      {/* Dot stays at true vertical centre. The Home Orb continues from the
          same spot and rises up. */}
      <View style={styles.center}>
        <Animated.View style={orbStyle}>
          {/* Final size must match HOME_ORB_SIZE on HomeScreen so the
              dot grows to the exact size of the Home agent face and the
              hand-off is one continuous motion. Eyes are invisible, so
              we also disable the autonomous blink. */}
          <Orb size={84} eyesOpacity={0} noBlink />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
