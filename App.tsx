/**
 * ONE01 – Process Engine. v0.1: Loading → Onboarding (first-time) → Home (NOW Sphere) → Process.
 * MainApp (chat-only) is not in the active path.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeStore } from './src/stores/themeStore';
import { useLoadingStore } from './src/stores/loadingStore';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { OneProvider } from './src/core/OneContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLoading, setShowLoading] = useState(true);

  const { initialize: initTheme, updateTheme, colors, theme } = useThemeStore();
  const { initialize: initLoading, hasSeenLoading, markLoadingComplete } = useLoadingStore();

  useEffect(() => {
    const init = async () => {
      await initTheme();
      await initLoading();
      setIsInitialized(true);
      setShowLoading(!hasSeenLoading);
    };
    init();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => updateTheme(), 60000);
    return () => clearInterval(interval);
  }, [updateTheme]);

  const handleLoadingComplete = async () => {
    await markLoadingComplete();
    setShowLoading(false);
  };

  if (!isInitialized) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {showLoading ? (
        <LoadingScreen onComplete={handleLoadingComplete} />
      ) : (
        <OneProvider>
          <AppNavigator />
        </OneProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
