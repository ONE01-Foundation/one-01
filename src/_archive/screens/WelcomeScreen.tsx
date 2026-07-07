/**
 * WelcomeScreen — mirrors the Home layout, per user's request:
 *
 *   [Orb]
 *   {rotating line}
 *   [Input bar]
 *   Sign in
 *
 * Typing a first intention into the input bar IS how you start with ONE —
 * no separate "Start with ONE" button. Sign-in stays small below as a
 * secondary affordance for returning users.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { InputBar } from '../../components/mvp/InputBar';
import { useThemeStore } from '../../stores/themeStore';

const LINES = [
  "Hi, I'm ONE.",                          // anchor — held longer
  'I move things forward for you.',
  'I remember where we left off.',
  'A conversation becomes a process.',
  'I can help with life and work.',
  'I organize people, tasks and information.',
  "You don't have to figure everything out first.",
  'We can start with one thing.',
  'I turn intention into process.',
  'What do you want to move forward?',     // closing — held longer
] as const;

const NORMAL_MS = 4200;
const ANCHOR_MS = 6000; // "Hi, I'm ONE." and closing line — held longer.

export interface WelcomeScreenProps {
  /**
   * Fires when the user submits their first intention from the input bar.
   * The submitted text is passed so the next screen can seed the first
   * process / chat off of it.
   */
  onStart: (firstText?: string) => void;
  onSignIn?: () => void;
}

export function WelcomeScreen({ onStart, onSignIn }: WelcomeScreenProps) {
  const { colors } = useThemeStore();
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    const isAnchor = i === 0 || i === LINES.length - 1;
    const delay = isAnchor ? ANCHOR_MS : NORMAL_MS;
    const t = setTimeout(() => setI((x) => (x + 1) % LINES.length), delay);
    return () => clearTimeout(t);
  }, [i]);

  // Gentle breath on the Orb — same feel as Home's resting state.
  const orbBreath = useSharedValue(1);
  useEffect(() => {
    orbBreath.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.000, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [orbBreath]);
  const orbBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbBreath.value }],
  }));

  // Subtle crossfade when the line changes.
  const lineOpacity = useSharedValue(1);
  useEffect(() => {
    lineOpacity.value = 0;
    lineOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [i, lineOpacity]);
  const lineFadeStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
  }));

  // Eyes meet the user's gaze when the input is focused.
  const focusSV = useSharedValue(0);
  useEffect(() => {
    focusSV.value = withTiming(inputFocused ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [inputFocused, focusSV]);
  const eyeLookY = useDerivedValue(() => {
    'worklet';
    // Negative = looking up; tiny baseline downward gaze for "looking at you reading".
    return -focusSV.value * 0.35;
  });

  const handleSubmit = () => {
    const v = text.trim();
    onStart(v.length > 0 ? v : undefined);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.center}>
          <Animated.View style={orbBreathStyle}>
            {/* Match HOME_ORB_SIZE so Splash → Welcome → Home reads as one
                continuous face that simply moves and breathes. */}
            <Orb size={84} eyeLookY={eyeLookY} />
          </Animated.View>
          <Animated.View style={lineFadeStyle}>
            <Text
              style={[styles.line, { color: colors.text }]}
              numberOfLines={2}
            >
              {LINES[i]}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.bottom}>
          <InputBar
            value={text}
            onChangeText={setText}
            placeholder="Start with one thing…"
            onSubmit={handleSubmit}
            onPressVoice={handleSubmit}
            onPressPlus={() => onStart(undefined)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Sign in"
            onPress={onSignIn}
            hitSlop={12}
            style={({ pressed }) => [styles.signInWrap, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Text style={[styles.signInText, { color: colors.text }]}>
              Already with ONE? <Text style={{ fontWeight: '600' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 24,
  },
  line: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30,
    maxWidth: 320,
    letterSpacing: -0.01,
    // Reserve two-line height so the Orb above doesn't shift when the
    // rotating message goes from 1 line to 2 lines and back.
    height: 60,
    textAlignVertical: 'center',
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  signInWrap: {
    paddingVertical: 10,
  },
  signInText: {
    fontSize: 15,
    opacity: 0.7,
  },
});
