/**
 * ProfileScreen – Origin / My Identity. Stats, export placeholder, reset demo.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { LENS_LABELS, PERSONA_LABELS } from '../core/types';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Profile'>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user, clearUser } = useOne();
  const navigation = useNavigation<Nav>();

  if (!user) return null;

  const activeCount = user.processes.filter((p) => p.status === 'active').length;
  const doneCount = user.processes.filter((p) => p.status === 'done').length;
  const totalNotes = user.processes.reduce((sum, p) => sum + p.messages.length, 0);

  const onReset = () => {
    Alert.alert(
      'Reset demo user',
      'This will clear all local data and return you to onboarding. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearUser();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <OrbAgent
            size={28}
            state="idle"
            mode="process"
            onPress={() => navigation.navigate('Home')}
            tappable
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Origin</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.orbSection}>
          <OrbAgent size={64} state="idle" mode="home" labelLines={['This is your ONE agent.']} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Agent</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{user.agent.name} · {PERSONA_LABELS[user.agent.persona]}</Text>
          <Text style={[styles.hatsSummary, { color: colors.textSecondary }]}>
            Hats: {(user.agent.hats ?? []).join(', ')}
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Lenses</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>
            {user.lenses.map((l) => LENS_LABELS[l]).join(', ')}
          </Text>
        </View>
        <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{doneCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalNotes}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Notes</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.optionText, { color: colors.text }]}>Export / Backup</Text>
          <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>Coming soon</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.border }]}
          onPress={onReset}
        >
          <Text style={[styles.resetText, { color: colors.text }]}>Reset demo user</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backWrap: { padding: 4 },
  backText: { fontSize: 17 },
  title: { fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 100 },
  scroll: { flex: 1 },
  content: { padding: 24 },
  orbSection: { alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  card: { padding: 18, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardLabel: { fontSize: 12, marginBottom: 4, textTransform: 'uppercase' },
  cardValue: { fontSize: 16 },
  hatsSummary: { fontSize: 14, marginTop: 6 },
  statsRow: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1, marginBottom: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 14, marginTop: 4 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  optionText: { fontSize: 16 },
  comingSoon: { fontSize: 13 },
  resetBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  resetText: { fontSize: 15 },
});
