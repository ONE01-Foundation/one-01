/**
 * ONE Platform - Main App Component
 * Handles loading screen and main app with theme system
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from './src/stores/themeStore';
import { useLoadingStore } from './src/stores/loadingStore';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { MainApp } from './src/screens/MainApp';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  
  const { initialize: initTheme, updateTheme, colors, theme } = useThemeStore();
  const { initialize: initLoading, hasSeenLoading, markLoadingComplete } = useLoadingStore();

  useEffect(() => {
    // Initialize stores
    const init = async () => {
      await initTheme();
      await initLoading();
      setIsInitialized(true);
      
      // Check if loading screen should be shown
      setShowLoading(!hasSeenLoading);
    };
    init();
  }, []);

  useEffect(() => {
    // Update theme periodically to check time changes
    const interval = setInterval(() => {
      updateTheme();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [updateTheme]);

  const handleLoadingComplete = async () => {
    await markLoadingComplete();
    setShowLoading(false);
  };

  // Show nothing until stores are initialized
  if (!isInitialized) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  // Show loading screen or main app
  if (showLoading) {
    return (
      <>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <LoadingScreen onComplete={handleLoadingComplete} />
      </>
    );
  }

  return <MainApp />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
