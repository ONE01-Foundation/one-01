import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { LENS_LABELS, PERSONA_LABELS } from '../core/types';

export function ConfirmScreen() {
  const { colors } = useThemeStore();
  const { onboarding, completeOnboarding } = useOne();
  const { name, persona, lenses, desire } = onboarding;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Summary</Text>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <Text style={[styles.val, { color: colors.text }]}>{name || '—'}</Text>
      </View>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Style</Text>
        <Text style={[styles.val, { color: colors.text }]}>{persona ? PERSONA_LABELS[persona] : '—'}</Text>
      </View>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Lenses</Text>
        <Text style={[styles.val, { color: colors.text }]}>{lenses.length ? lenses.map((l) => LENS_LABELS[l]).join(', ') : '—'}</Text>
      </View>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Desire</Text>
        <Text style={[styles.val, { color: colors.text }]} numberOfLines={3}>{desire || '—'}</Text>
      </View>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => completeOnboarding()}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Create My ONE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 24 },
  row: { paddingVertical: 12, borderBottomWidth: 1 },
  label: { fontSize: 14, marginBottom: 4 },
  val: { fontSize: 16 },
  btn: { marginTop: 40, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
