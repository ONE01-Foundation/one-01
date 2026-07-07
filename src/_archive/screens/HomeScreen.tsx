/**
 * HomeScreen – NOW Sphere, My Agent modal, Create Process FAB + sheet.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { AgentBroadcast } from '../components/AgentBroadcast';
import { useHomePagerScroll } from '../navigation/HomePager';
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
  const [nowInputValue, setNowInputValue] = useState('');
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

  const lensOptions: (LifeLens | null)[] = useMemo(() => [null, ...lensesToShow], [lensesToShow]);
  const currentLensIndex = selectedLens === null ? 0 : lensOptions.indexOf(selectedLens);

  const onLensFilterPress = (lens: LifeLens | null) => {
    setSelectedLens(lens);
    if (lens) {
      const next: Hat[] = Array.from(new Set(['base', ...currentHats.filter((h) => h !== 'base'), lens])) as Hat[];
      updateAgentHats(next);
    }
  };

  const goToPrevHat = () => {
    const opts = lensOptions;
    const idx = currentLensIndex;
    const nextIndex = (idx - 1 + opts.length) % opts.length;
    onLensFilterPress(opts[nextIndex]);
  };

  const goToNextHat = () => {
    const opts = lensOptions;
    const idx = currentLensIndex;
    const nextIndex = (idx + 1) % opts.length;
    onLensFilterPress(opts[nextIndex]);
  };

  const lensOptionsRef = useRef(lensOptions);
  const currentLensIndexRef = useRef(currentLensIndex);
  const onLensFilterPressRef = useRef(onLensFilterPress);
  lensOptionsRef.current = lensOptions;
  currentLensIndexRef.current = currentLensIndex;
  onLensFilterPressRef.current = onLensFilterPress;

  useEffect(() => {
    const opts = lensOptionsRef.current;
    const currentIndex = currentLensIndexRef.current;
    const t = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % opts.length;
      onLensFilterPressRef.current(opts[nextIndex]);
    }, 5000);
    return () => clearTimeout(t);
  }, [selectedLens]);

  const swipeThreshold = 50;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderRelease: (_, g) => {
        const opts = lensOptionsRef.current;
        const idx = currentLensIndexRef.current;
        if (g.dx < -swipeThreshold) {
          const nextIndex = (idx + 1) % opts.length;
          onLensFilterPressRef.current(opts[nextIndex]);
        } else if (g.dx > swipeThreshold) {
          const nextIndex = (idx - 1 + opts.length) % opts.length;
          onLensFilterPressRef.current(opts[nextIndex]);
        }
      },
    })
  ).current;

  const pagerScroll = useHomePagerScroll();
  const { height: windowHeight } = useWindowDimensions();
  const scrollContentPaddingTop = insets.top + 56 + 72 + 24 + 16;
  const topOffsetForCenter = Math.max(0, (windowHeight - 320) / 2 - 80);

  React.useEffect(() => {
    pagerScroll?.registerAgentModalTrigger?.(() => setAgentModalVisible(true));
    return () => {
      pagerScroll?.registerAgentModalTrigger?.(null);
    };
  }, [pagerScroll]);

  const hatTintColor = getHatColor(selectedLens ?? 'base');
  const isMainHat = selectedLens === null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.containerInner} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: scrollContentPaddingTop + topOffsetForCenter,
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Hat switcher: arrows (loop) + current hat label */}
        <View style={styles.hatSwitcherRow}>
          <TouchableOpacity style={styles.arrowBtn} onPress={goToPrevHat} activeOpacity={0.8}>
            <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
              <Path
                fill={colors.text}
                d="M17.9621 15.5L11.1461 8.75094C10.9513 8.55809 10.9513 8.24541 11.1461 8.05255L12.063 7.14464C12.2578 6.95179 12.5735 6.95179 12.7683 7.14464L20.8539 15.1508C21.0487 15.3437 21.0487 15.6563 20.8539 15.8492L12.7683 23.8554C12.5735 24.0482 12.2578 24.0482 12.063 23.8554L11.1461 22.9474C10.9513 22.7546 10.9513 22.4419 11.1461 22.2491L17.9621 15.5Z"
              />
            </Svg>
          </TouchableOpacity>
          <View style={styles.hatLabelWrap}>
            <View style={[styles.hatLabelDot, { backgroundColor: hatTintColor }]} />
            <Text style={[styles.hatLabelText, { color: colors.text }]}>
              {isMainHat ? 'One Agent' : selectedLens ? LENS_LABELS[selectedLens] : 'One Agent'}
            </Text>
          </View>
          <TouchableOpacity style={styles.arrowBtn} onPress={goToNextHat} activeOpacity={0.8}>
            <View style={styles.arrowRightFlip}>
              <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
                <Path
                  fill={colors.text}
                  d="M17.9621 15.5L11.1461 8.75094C10.9513 8.55809 10.9513 8.24541 11.1461 8.05255L12.063 7.14464C12.2578 6.95179 12.5735 6.95179 12.7683 7.14464L20.8539 15.1508C21.0487 15.3437 21.0487 15.6563 20.8539 15.8492L12.7683 23.8554C12.5735 24.0482 12.2578 24.0482 12.063 23.8554L11.1461 22.9474C10.9513 22.7546 10.9513 22.4419 11.1461 22.2491L17.9621 15.5Z"
                />
              </Svg>
            </View>
          </TouchableOpacity>
        </View>

        {/* Broadcast */}
        <AgentBroadcast />

        {/* Now? input bar – oval, light gray, higher up (Fix layout) */}
        <View style={[styles.nowBar, styles.nowBarOval]}>
          <TouchableOpacity style={styles.nowBarBtn} onPress={openCreateSheet} activeOpacity={0.8}>
            <Svg width={24} height={24} viewBox="0 0 46 46" fill="none">
              <Path fill={colors.text} d="M20 11h6v14h-6zM11 20h14v6H11z" />
            </Svg>
          </TouchableOpacity>
          <TextInput
            style={[styles.nowInput, { color: colors.text }]}
            value={nowInputValue}
            onChangeText={setNowInputValue}
            placeholder="Now?"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            multiline
            numberOfLines={1}
            blurOnSubmit
          />
          <TouchableOpacity style={styles.nowBarBtn} onPress={() => {}} activeOpacity={0.8}>
            <Svg width={24} height={24} viewBox="0 0 26 26" fill="none">
              <Path
                fill={colors.textSecondary}
                d="M13.12 17.43c1.07 0 2.1-.46 2.86-1.27.76-.81 1.19-1.91 1.19-3.06V6.59c0-1.15-.43-2.25-1.19-3.07-.76-.81-1.79-1.27-2.86-1.27-1.07 0-2.1.46-2.86 1.27-.76.82-1.19 1.92-1.19 3.07v6.5c0 1.15.43 2.25 1.19 3.06.76.82 1.79 1.27 2.86 1.27z"
              />
              <Path
                fill={colors.textSecondary}
                d="M19.33 13.19c-.27 0-.53.1-.72.28-.19.18-.31.42-.31.67 0 1.25-.54 2.45-1.5 3.33-.96.88-2.26 1.38-3.62 1.38-1.36 0-2.66-.5-3.62-1.38-.96-.88-1.5-2.08-1.5-3.33 0-.25-.12-.49-.31-.67-.19-.18-.45-.28-.72-.28-.27 0-.53.1-.72.28-.19.18-.31.42-.31.67 0 1.75.75 3.43 2.1 4.66 1.34 1.24 3.16 1.93 5.06 1.93 1.9 0 3.72-.69 5.06-1.93 1.34-1.23 2.1-2.91 2.1-4.66 0-.25-.12-.49-.31-.67-.19-.18-.45-.28-.72-.28z"
              />
              <Path
                fill={colors.textSecondary}
                d="M16.16 21.76h-6.08c-.27 0-.53.11-.72.32-.19.2-.31.48-.31.76 0 .29.11.56.31.77.19.2.45.32.72.32h6.08c.27 0 .53-.11.72-.32.19-.2.31-.48.31-.77 0-.29-.11-.56-.31-.76-.19-.21-.45-.32-.72-.32z"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Arrows + bullets bar (preview-button-bg style) */}
        <View style={styles.bulletsBar}>
          <TouchableOpacity style={styles.arrowBtn} onPress={goToPrevHat} activeOpacity={0.8}>
            <Svg width={24} height={24} viewBox="0 0 32 32" fill="none">
              <Path
                fill={colors.textSecondary}
                d="M17.9621 15.5L11.1461 8.75094C10.9513 8.55809 10.9513 8.24541 11.1461 8.05255L12.063 7.14464C12.2578 6.95179 12.5735 6.95179 12.7683 7.14464L20.8539 15.1508C21.0487 15.3437 21.0487 15.6563 20.8539 15.8492L12.7683 23.8554C12.5735 24.0482 12.2578 24.0482 12.063 23.8554L11.1461 22.9474C10.9513 22.7546 10.9513 22.4419 11.1461 22.2491L17.9621 15.5Z"
              />
            </Svg>
          </TouchableOpacity>
          <View style={styles.bulletsRow}>
            {lensOptions.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.bullet,
                  { backgroundColor: i === currentLensIndex ? colors.primary : colors.textSecondary },
                ]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.arrowBtn} onPress={goToNextHat} activeOpacity={0.8}>
            <View style={styles.arrowRightFlip}>
              <Svg width={24} height={24} viewBox="0 0 32 32" fill="none">
                <Path
                  fill={colors.textSecondary}
                  d="M17.9621 15.5L11.1461 8.75094C10.9513 8.55809 10.9513 8.24541 11.1461 8.05255L12.063 7.14464C12.2578 6.95179 12.5735 6.95179 12.7683 7.14464L20.8539 15.1508C21.0487 15.3437 21.0487 15.6563 20.8539 15.8492L12.7683 23.8554C12.5735 24.0482 12.2578 24.0482 12.063 23.8554L11.1461 22.9474C10.9513 22.7546 10.9513 22.4419 11.1461 22.2491L17.9621 15.5Z"
                />
              </Svg>
            </View>
          </TouchableOpacity>
        </View>

        {/* Scroll indicator */}
        <View style={styles.scrollIndicatorWrap}>
          <Svg width={20} height={20} viewBox="0 0 32 32" fill="none" style={styles.chevronDown}>
            <Path
              fill={colors.textSecondary}
              d="M17.9621 15.5L11.1461 8.75094C10.9513 8.55809 10.9513 8.24541 11.1461 8.05255L12.063 7.14464C12.2578 6.95179 12.5735 6.95179 12.7683 7.14464L20.8539 15.1508C21.0487 15.3437 21.0487 15.6563 20.8539 15.8492L12.7683 23.8554C12.5735 24.0482 12.2578 24.0482 12.063 23.8554L11.1461 22.9474C10.9513 22.7546 10.9513 22.4419 11.1461 22.2491L17.9621 15.5Z"
            />
          </Svg>
        </View>
      </ScrollView>

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
            <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => { setAgentModalVisible(false); openCreateSheet(); }}>
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Add process</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => { setAgentModalVisible(false); navigation.navigate('Profile'); }}>
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Profile</Text>
            </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerInner: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 140 },
  nowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  nowBarOval: {
    backgroundColor: '#3A3A3C',
    borderRadius: 28,
    marginHorizontal: 24,
  },
  bulletsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 36,
    minHeight: 56,
    marginHorizontal: 24,
  },
  nowBarBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowInput: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hatSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowRightFlip: {
    transform: [{ scaleX: -1 }],
  },
  hatLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hatLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hatLabelText: {
    fontSize: 17,
    fontWeight: '600',
  },
  bulletsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollIndicatorWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  chevronDown: {
    transform: [{ rotate: '90deg' }],
  },
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
  modalBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  modalBtnText: { fontSize: 16, fontWeight: '600' },
  modalClose: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
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
