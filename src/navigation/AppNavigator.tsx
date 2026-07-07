/**
 * Root navigator.
 *
 * MVP path (active): mvp-new-one-spec branch — routes through MvpStack
 *   Home (entry) → SignIn (optional via "Sign in" CTA under input bar)
 *
 * Splash + Welcome + FirstConversation + SaveYourONE were removed; the
 * Home surface itself adapts to first-time / signed-in / not-signed-in
 * via `hasCompletedOnboarding`. Archived screens remain under
 * src/_archive/screens/ for reference.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { MvpStack } from './MvpStack';

export function AppNavigator() {
  const { colors } = useThemeStore();
  const { initialized } = useOne();

  if (!initialized) {
    return <View style={[styles.placeholder, { backgroundColor: colors.background }]} />;
  }

  return (
    <NavigationContainer>
      <MvpStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1 },
});
