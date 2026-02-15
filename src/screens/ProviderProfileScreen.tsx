/**
 * ProviderProfileScreen – Public agent profile. Invite to process or start new.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { getProviderById } from '../data/providers';
import { LENS_LABELS } from '../core/types';
import type { AppShellParamList } from '../navigation/types';

type Route = RouteProp<AppShellParamList, 'ProviderProfile'>;
type Nav = NativeStackNavigationProp<AppShellParamList, 'ProviderProfile'>;

export function ProviderProfileScreen() {
  const { colors } = useThemeStore();
  const { user, getProcess, attachProviderToProcess, createProcess } = useOne();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { providerId } = route.params;
  const [pickerVisible, setPickerVisible] = useState(false);

  const provider = getProviderById(providerId);
  const activeProcesses = user?.processes.filter((p) => p.status === 'active') ?? [];

  if (!provider) {
    navigation.goBack();
    return null;
  }

  const onInviteToProcess = async (processId: string) => {
    await attachProviderToProcess(processId, provider.id, provider.displayName);
    setPickerVisible(false);
    navigation.goBack();
  };

  const onStartNewWithProvider = async () => {
    if (!user) return;
    const process = await createProcess({ lens: provider.lens, title: `With ${provider.displayName}` });
    await attachProviderToProcess(process.id, provider.id, provider.displayName);
    navigation.replace('Process', { processId: process.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Provider</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.name, { color: colors.text }]}>{provider.displayName}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{LENS_LABELS[provider.lens]} · {provider.priceRange} · {provider.rating}★ · {provider.responseTime}</Text>
        <Text style={[styles.bio, { color: colors.text }]}>{provider.bio}</Text>
        <View style={styles.specialties}>
          {provider.specialties.map((s) => (
            <View key={s} style={[styles.chip, { backgroundColor: colors.surface }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{s}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.primaryBtnText}>Invite to Process</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={onStartNewWithProvider}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Start new process with this provider</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={[styles.picker, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Choose process</Text>
            {activeProcesses.length === 0 ? (
              <Text style={[styles.pickerEmpty, { color: colors.textSecondary }]}>No active processes. Create one from Home.</Text>
            ) : (
              activeProcesses.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => onInviteToProcess(p.id)}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{p.title}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={[styles.pickerCancel, { borderColor: colors.border }]} onPress={() => setPickerVisible(false)}>
              <Text style={[styles.pickerCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backWrap: { padding: 4, marginRight: 12 },
  backText: { fontSize: 17 },
  title: { fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 24 },
  name: { fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 14, marginTop: 6 },
  bio: { fontSize: 15, marginTop: 16 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 14 },
  primaryBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  secondaryBtnText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  picker: { borderRadius: 16, padding: 24, maxHeight: 400 },
  pickerTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  pickerEmpty: { fontSize: 14, marginBottom: 16 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16 },
  pickerCancel: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  pickerCancelText: { fontSize: 15 },
});
