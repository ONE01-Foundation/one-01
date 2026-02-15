/**
 * DiscoveryPreview – Top of vertical OS. Small Orb, swipe down to enter Discovery.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../stores/themeStore';
import { OrbAgent } from '../components/OrbAgent';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Home'>;

export function DiscoveryPreviewScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const navigation = useNavigation<Nav>();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, minHeight: height }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <OrbAgent
          size={36}
          state="idle"
          mode="discovery"
          labelLines={['Discovery', 'Swipe down to enter']}
          onPress={() => navigation.navigate('Discovery')}
          tappable
        />
        <TouchableOpacity
          style={[styles.enterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Discovery')}
        >
          <Text style={[styles.enterBtnText, { color: colors.primary }]}>Enter Discovery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 24 },
  enterBtn: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1 },
  enterBtnText: { fontSize: 16, fontWeight: '600' },
});
