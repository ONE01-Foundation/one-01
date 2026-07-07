/**
 * SaveYourONEScreen — per ONE_UI_UX_SPEC §5 and ONE_MASTER_SPEC §9.
 *
 * Shown ONLY after the user has produced their first processes.
 *
 * Copy (verbatim):
 *   Let's save your ONE
 *   so we can continue later.
 *
 * Buttons:
 *   • Continue with Apple
 *   • Continue with Google
 *   • Continue with Email
 *   Secondary:
 *   • Sign in
 *
 * The account is positioned as saving the relationship, not as a signup wall.
 * No real auth integration in v0 — onSaved() advances regardless of provider tap.
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

interface SaveYourONEScreenProps {
  onSaved: () => void;
  onLater: () => void;
}

export function SaveYourONEScreen({ onSaved, onLater }: SaveYourONEScreenProps) {
  const { colors } = useThemeStore();

  // Match Welcome/Home: the Orb breathes — keeps the screen from feeling
  // like a static signup wall.
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
      <View style={styles.top}>
        <Animated.View style={orbBreathStyle}>
          <Orb size={80} />
        </Animated.View>
        <View style={styles.copy}>
          <Text style={[styles.headline, { color: colors.text }]}>
            Let's save your ONE
          </Text>
          <Text style={[styles.subhead, { color: colors.textSecondary }]}>
            so I can keep moving things forward, even when you're not here.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <ProviderButton
          label="Continue with Apple"
          variant="primary"
          onPress={onSaved}
          colors={colors}
        />
        <ProviderButton
          label="Continue with Google"
          variant="outline"
          onPress={onSaved}
          colors={colors}
        />
        <ProviderButton
          label="Continue with Email"
          variant="outline"
          onPress={onSaved}
          colors={colors}
        />

        <Pressable onPress={onLater} style={styles.signIn} hitSlop={10}>
          <Text style={[styles.signInText, { color: colors.textSecondary }]}>
            Sign in
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ProviderButton({
  label,
  variant,
  onPress,
  colors,
}: {
  label: string;
  variant: 'primary' | 'outline';
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        isPrimary
          ? { backgroundColor: colors.circle }
          : { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          { color: isPrimary ? colors.background : colors.text },
        ]}
      >
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
  top: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  copy: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
  },
  headline: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  subhead: {
    fontSize: 17,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: 28,
    gap: 12,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signIn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 15,
  },
});
