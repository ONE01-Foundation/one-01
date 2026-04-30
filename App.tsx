/**
 * ONE01 – Process Engine. v0.1: Loading → Onboarding (first-time) → Home (NOW Sphere) → Process.
 * MainApp (chat-only) is not in the active path.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeStore } from './src/stores/themeStore';
import { useLocaleStore } from './src/stores/localeStore';
import { useLoadingStore } from './src/stores/loadingStore';
import { OneProvider } from './src/core/OneContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  const { initialize: initTheme, updateTheme, colors, theme } = useThemeStore();
  const { initialize: initLocale, layoutDirection } = useLocaleStore();
  const { initialize: initLoading } = useLoadingStore();

  useEffect(() => {
    const init = async () => {
      await initTheme();
      await initLocale();
      await initLoading();
      setIsInitialized(true);
    };
    init();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => updateTheme(), 60000);
    return () => clearInterval(interval);
  }, [updateTheme]);

  if (!isInitialized) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, direction: layoutDirection === 'rtl' ? 'rtl' : 'ltr' }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <OneProvider>
          <AppNavigator />
        </OneProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
