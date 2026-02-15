/**
 * Root: onboarding (first-time) vs AppShell (Home + Process + Profile + Discovery + ProviderProfile + ShareCard).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OnboardingNavigator } from './OnboardingNavigator';
import { AppShell } from './AppShell';

export function AppNavigator() {
  const { colors } = useThemeStore();
  const { initialized, isOnboarded } = useOne();

  if (!initialized) {
    return <View style={[styles.placeholder, { backgroundColor: colors.background }]} />;
  }

  return (
    <NavigationContainer>
      {isOnboarded ? <AppShell /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1 },
});
