/**
 * UnitsBadge – Orb icon + Units count. Tap opens UnitsScreen (coming soon).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { OrbAgent } from './OrbAgent';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, keyof AppShellParamList>;

const MOCK_UNITS = 100;

export function UnitsBadge() {
  const { colors } = useThemeStore();
  const navigation = useNavigation<Nav>();

  const onPress = () => {
    navigation.navigate('Units');
  };

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.8}>
      <OrbAgent size={22} state="idle" mode="units" />
      <Text style={[styles.count, { color: colors.text }]}>{MOCK_UNITS}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
  },
});
