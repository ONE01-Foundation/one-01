/**
 * SignInScreen — returning-user sign-in flow.
 *
 * Distinct from SaveYourONE (which is for first-time users to save what they
 * just created). This screen is for users who already have a saved ONE on
 * another device.
 *
 * Layout:
 *   [ONE face]
 *   Welcome back.
 *   Sign in to continue your processes.
 *
 *   [Continue with Apple]   (primary)
 *   [Continue with Google]
 *   [Continue with Email]
 *
 *   ←  Back to start
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { useThemeStore } from '../../stores/themeStore';

interface SignInScreenProps {
  onSignedIn: () => void;
  onBack: () => void;
}

export function SignInScreen({ onSignedIn, onBack }: SignInScreenProps) {
  const { colors } = useThemeStore();

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Pressable onPress={onBack} style={styles.backRow} hitSlop={12}>
        <Text style={[styles.backChev, { color: colors.textSecondary }]}>‹</Text>
        <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
      </Pressable>

      <View style={styles.center}>
        <Animated.View style={orbBreathStyle}>
          <Orb size={80} />
        </Animated.View>
        <View style={styles.copy}>
          <Text style={[styles.headline, { color: colors.text }]}>Welcome back.</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Pick up where we left off.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Btn label="Continue with Apple" primary onPress={onSignedIn} colors={colors} />
        <Btn label="Continue with Google" onPress={onSignedIn} colors={colors} />
        <Btn label="Continue with Email" onPress={onSignedIn} colors={colors} />

        <Pressable onPress={onBack} hitSlop={10} style={styles.altLink}>
          <Text style={[styles.altLinkText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
            <Text style={{ color: colors.text, fontWeight: '500' }}>Start with ONE</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Btn({
  label,
  primary,
  onPress,
  colors,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary
          ? { backgroundColor: colors.circle }
          : { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.btnText, { color: primary ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  backChev: { fontSize: 28, lineHeight: 28 },
  backText: { fontSize: 15 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  copy: { alignItems: 'center', gap: 6, maxWidth: 320 },
  headline: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  sub: { fontSize: 16, textAlign: 'center' },
  actions: { paddingBottom: 28, gap: 12 },
  btn: {
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  altLink: { paddingVertical: 12, alignItems: 'center' },
  altLinkText: { fontSize: 14 },
});
