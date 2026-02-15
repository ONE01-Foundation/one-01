/**
 * HomeScreen – NOW Sphere, My Agent modal, Create Process FAB + sheet.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { UnitsBadge } from '../components/UnitsBadge';
import { AgentBroadcast } from '../components/AgentBroadcast';
import { LENS_LABELS, PERSONA_LABELS, HAT_LABELS, getHatColor } from '../core/types';
import type { LifeLens, Hat } from '../core/types';
import type { OneProcess } from '../core/types';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Home'>;

const TOGGLEABLE_HATS: Hat[] = ['health', 'finance', 'knowledge', 'business', 'provider'];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user, updateAgentHats, createProcess, agentStatusText } = useOne();
  const navigation = useNavigation<Nav>();
  const [selectedLens, setSelectedLens] = useState<LifeLens | null>(null);
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [createLens, setCreateLens] = useState<LifeLens | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [showScrollHint, setShowScrollHint] = useState(true);

  const processes = useMemo(() => {
    if (!user) return [];
    const list = user.processes.filter((p) => p.status === 'active');
    if (selectedLens) return list.filter((p) => p.lens === selectedLens);
    return list;
  }, [user, selectedLens]);

  if (!user) return null;

  const lensesToShow = user.lenses;
  const agent = user.agent;
  const currentHats = agent.hats ?? ['base'];

  const toggleHat = (hat: Hat) => {
    const next = currentHats.includes(hat)
      ? currentHats.filter((h) => h !== hat)
      : [...currentHats, hat];
    updateAgentHats(next);
  };

  const onProcessPress = (process: OneProcess) => {
    navigation.navigate('Process', { processId: process.id });
  };

  const openCreateSheet = () => {
    setSheetVisible(true);
    setCreateLens(selectedLens ?? user.lenses[0]);
    setCreateTitle('');
  };

  const onCreateProcess = async () => {
    const lens = createLens ?? user.lenses[0];
    const title = createTitle.trim() || 'New process';
    const process = await createProcess({ lens, title });
    setSheetVisible(false);
    setCreateTitle('');
    navigation.navigate('Process', { processId: process.id });
  };

  const hasProviderHat = currentHats.includes('provider');

  const rotatingLines = useMemo(() => {
    const lines: string[] = [user.name, 'What are we building today?'];
    const active = user.processes.filter((p) => p.status === 'active');
    if (active.length > 0)
      lines.push(`Process active: ${active[0].title}`);
    return lines;
  }, [user.name, user.processes]);

  const [labelIndex, setLabelIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % Math.max(1, rotatingLines.length));
    }, 3000);
    return () => clearInterval(id);
  }, [rotatingLines.length]);

  const orbLabelLines = useMemo(() => {
    if (agentStatusText) return [agentStatusText];
    return rotatingLines.length ? [rotatingLines[labelIndex]] : [];
  }, [agentStatusText, rotatingLines, labelIndex]);

  const primaryHat = currentHats.filter((h) => h !== 'base')[0] ?? 'base';
  const orbGlow = getHatColor(primaryHat);

  const activeCount = user.processes.filter((p) => p.status === 'active').length;
  const today = new Date().toDateString();
  const notesToday = useMemo(() => {
    return user.processes.reduce((sum, p) => {
      return sum + p.messages.filter((m) => m.sender === 'user' && new Date(m.createdAt).toDateString() === today).length;
    }, 0);
  }, [user.processes, today]);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const compilesThisWeek = useMemo(() => {
    return user.processes.reduce((sum, p) => {
      return sum + (p.timeline?.filter((e) => e.type === 'compile' && new Date(e.at).getTime() >= weekAgo).length ?? 0);
    }, 0);
  }, [user.processes]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 60) setShowScrollHint(false);
    else setShowScrollHint(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Discovery')} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: colors.primary }]}>Discovery</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>NOW</Text>
        <View style={styles.headerRight}>
          <UnitsBadge />
          <TouchableOpacity onPress={() => setAgentModalVisible(true)} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>Agent</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {/* Agent Face */}
        <View style={[styles.sphereWrap, { backgroundColor: colors.surface }]}>
          <OrbAgent
            size={72}
            state="idle"
            mode="home"
            labelLines={orbLabelLines}
            onPress={() => setAgentModalVisible(true)}
            tappable
            glowColor={orbGlow}
          />
        </View>

        {/* Broadcast */}
        <AgentBroadcast />

        {/* Stats – real metrics */}
        <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{notesToday}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Notes Today</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{compilesThisWeek}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Compiles This Week</Text>
          </View>
        </View>

        {/* Hats – agent capabilities */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Hats</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.lensRow}
          contentContainerStyle={styles.lensRowContent}
        >
          {TOGGLEABLE_HATS.map((hat) => (
            <TouchableOpacity
              key={hat}
              style={[
                styles.lensChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                currentHats.includes(hat) && { borderColor: getHatColor(hat), borderWidth: 2 },
              ]}
              onPress={() => toggleHat(hat)}
            >
              <Text style={[styles.lensChipText, { color: colors.text }]}>{HAT_LABELS[hat]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Persona */}
        <Text style={[styles.personaLine, { color: colors.textSecondary }]}>{PERSONA_LABELS[agent.persona]}</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active processes</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.lensRow}
          contentContainerStyle={styles.lensRowContent}
        >
          <TouchableOpacity
            style={[
              styles.lensChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedLens === null && { borderColor: colors.primary, borderWidth: 2 },
            ]}
            onPress={() => setSelectedLens(null)}
          >
            <Text style={[styles.lensChipText, { color: colors.text }]}>All</Text>
          </TouchableOpacity>
          {lensesToShow.map((lens) => (
            <TouchableOpacity
              key={lens}
              style={[
                styles.lensChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedLens === lens && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={() => setSelectedLens(lens)}
            >
              <Text style={[styles.lensChipText, { color: colors.text }]}>{LENS_LABELS[lens]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {processes.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onProcessPress(item)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {LENS_LABELS[item.lens]} · {item.status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Scroll hint – microdots */}
      {showScrollHint && (
        <View style={styles.microdotsWrap} pointerEvents="none">
          <View style={styles.microdots}>
            <View style={[styles.microdot, { backgroundColor: colors.textSecondary }]} />
            <View style={[styles.microdot, styles.microdotCenter, { backgroundColor: colors.text }]} />
            <View style={[styles.microdot, { backgroundColor: colors.textSecondary }]} />
          </View>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openCreateSheet}
        activeOpacity={0.9}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* My Agent modal */}
      <Modal visible={agentModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAgentModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>My Agent</Text>
            <Text style={[styles.agentName, { color: colors.text }]}>{agent.name}</Text>
            <Text style={[styles.personaLabel, { color: colors.textSecondary }]}>Persona</Text>
            <Text style={[styles.personaValue, { color: colors.text }]}>{PERSONA_LABELS[agent.persona]}</Text>
            <Text style={[styles.hatsLabel, { color: colors.textSecondary }]}>Hats</Text>
            {TOGGLEABLE_HATS.map((hat) => (
              <TouchableOpacity
                key={hat}
                style={[
                  styles.hatRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  currentHats.includes(hat) && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => toggleHat(hat)}
              >
                <Text style={[styles.hatLabel, { color: colors.text }]}>{HAT_LABELS[hat]}</Text>
                <Text style={[styles.hatToggle, { color: colors.primary }]}>{currentHats.includes(hat) ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            ))}
            {hasProviderHat && (
              <View style={[styles.comingSoon, { backgroundColor: colors.surface }]}>
                <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>Create Public Profile (coming soon)</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.modalClose, { backgroundColor: colors.primary }]} onPress={() => setAgentModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bottom sheet: Create Process / Find Provider / Share */}
      <Modal visible={sheetVisible} transparent animationType="slide">
        <Pressable style={styles.sheetOverlay} onPress={() => setSheetVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add</Text>

            <View style={[styles.createForm, { borderBottomColor: colors.border }]}>
              <Text style={[styles.createFormTitle, { color: colors.text }]}>Create Process</Text>
              <Text style={[styles.createLabel, { color: colors.textSecondary }]}>Lens</Text>
              <View style={styles.lensRowCreate}>
                {user.lenses.map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.lensChipSmall,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      createLens === l && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setCreateLens(l)}
                  >
                    <Text style={[styles.lensChipText, { color: colors.text }]}>{LENS_LABELS[l]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.createLabel, { color: colors.textSecondary }]}>Title / Goal</Text>
              <TextInput
                style={[styles.createInput, { borderColor: colors.border, color: colors.text }]}
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="What do you want to achieve?"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={[styles.createSubmit, { backgroundColor: colors.primary }]}
                onPress={onCreateProcess}
              >
                <Text style={styles.createSubmitText}>Create</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sheetItem, { borderBottomColor: colors.border }]}
              onPress={() => setSheetVisible(false)}
            >
              <View style={styles.sheetItemRow}>
                <Text style={[styles.sheetItemText, { color: colors.text }]}>Find Provider</Text>
                <Text style={[styles.comingSoonSmall, { color: colors.textSecondary }]}>Coming soon</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetItem, { borderBottomColor: colors.border }]}
              onPress={() => setSheetVisible(false)}
            >
              <View style={styles.sheetItemRow}>
                <Text style={[styles.sheetItemText, { color: colors.text }]}>Share</Text>
                <Text style={[styles.comingSoonSmall, { color: colors.textSecondary }]}>Coming soon</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', gap: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 120 },
  microdotsWrap: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  microdots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  microdot: { width: 6, height: 6, borderRadius: 3 },
  microdotCenter: { width: 8, height: 8, borderRadius: 4 },
  sphereWrap: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8, borderBottomWidth: 1, marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4, textTransform: 'uppercase' },
  personaLine: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  lensRow: { marginHorizontal: -24, marginBottom: 16 },
  lensRowContent: { paddingHorizontal: 24 },
  lensChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  lensChipText: { fontSize: 14, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { padding: 18, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardMeta: { fontSize: 13, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  agentName: { fontSize: 18, marginBottom: 8 },
  personaLabel: { fontSize: 12, marginBottom: 4, textTransform: 'uppercase', color: '#666' },
  personaValue: { fontSize: 15, marginBottom: 16 },
  hatsLabel: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: '#666' },
  hatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  hatLabel: { fontSize: 16 },
  hatToggle: { fontSize: 14, fontWeight: '600' },
  comingSoon: { marginTop: 12, padding: 12, borderRadius: 8 },
  comingSoonText: { fontSize: 13 },
  modalClose: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1 },
  sheetItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetItemText: { fontSize: 16 },
  comingSoonSmall: { fontSize: 12 },
  createForm: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1 },
  createFormTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  createLabel: { fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  lensRowCreate: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  lensChipSmall: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  createInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  createSubmit: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  createSubmitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
