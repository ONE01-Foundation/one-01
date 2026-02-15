/**
 * ProcessesPreview – Bottom of vertical OS. Next 2 processes, swipe up to continue.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { LENS_LABELS } from '../core/types';
import type { AppShellParamList } from '../navigation/types';
import type { OneProcess } from '../core/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Home'>;

export function ProcessesPreviewScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user } = useOne();
  const navigation = useNavigation<Nav>();

  const nextProcesses = useMemo(() => {
    if (!user) return [];
    return user.processes.filter((p) => p.status === 'active').slice(0, 2);
  }, [user]);

  const onProcessPress = (process: OneProcess) => {
    navigation.navigate('Process', { processId: process.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, minHeight: height }]}>
      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
        <OrbAgent size={32} state="idle" mode="process" labelLines={['Timeline', 'Swipe up to continue']} />
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Next up</Text>
        {nextProcesses.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onProcessPress(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{p.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {LENS_LABELS[p.lens]} · {p.status}
            </Text>
          </TouchableOpacity>
        ))}
        {nextProcesses.length === 0 && (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No active processes</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: { width: '100%', paddingHorizontal: 24 },
  sectionTitle: { fontSize: 12, marginBottom: 12, textTransform: 'uppercase' },
  card: { padding: 18, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardMeta: { fontSize: 13, marginTop: 6 },
  empty: { fontSize: 15 },
});
