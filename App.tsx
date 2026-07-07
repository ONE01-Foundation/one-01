import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useThemeStore } from './src/stores/themeStore';
import { useLocaleStore } from './src/stores/localeStore';
import { OneProvider } from './src/core/OneContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/mvp/ErrorBoundary';

/**
 * Root: gates rendering on theme + locale init, then renders Home directly.
 * Splash + onboarding (Welcome / FirstConversation / SaveYourONE) were
 * removed per spec — Home itself adapts its broadcast to first-time vs
 * returning users.
 */
export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  const { initialize: initTheme, updateTheme, colors, theme } = useThemeStore();
  const { initialize: initLocale, layoutDirection } = useLocaleStore();

  useEffect(() => {
    (async () => {
      await initTheme();
      await initLocale();
      setIsInitialized(true);
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => updateTheme(), 60000);
    return () => clearInterval(interval);
  }, [updateTheme]);

  if (!isInitialized) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* BottomSheetModalProvider must be the direct child of
            GestureHandlerRootView per gorhom v5 docs so the modal portal can
            register before any child component mounts. Sheets that wouldn't
            open were the symptom of getting this wrong. */}
        <BottomSheetModalProvider>
          <SafeAreaProvider>
            <View
              style={{
                flex: 1,
                ...(Platform.OS !== 'web'
                  ? { direction: layoutDirection === 'rtl' ? 'rtl' : 'ltr' as const }
                  : {}),
              }}
            >
              <StatusBar style={theme === 'dark' ? 'light' : 'dark'} animated />
              <OneProvider>
                <AppNavigator />
              </OneProvider>
              {/* EdgeBars are rendered inside HomeScreen, not at the App
                  level, so they layer correctly between content and the
                  Orb / broadcast / input chrome:
                    cards/bubbles < bars < orb / broadcast / chat header / input. */}
            </View>
          </SafeAreaProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
