/**
 * ProfileFocus — the "who you are / what ONE represents" page for focus mode.
 * ONE's differentiator made tangible: selective disclosure. You see every fact
 * ONE holds and set, per fact, how freely it may share it (open / on request /
 * private). Same for what ONE remembers about you. Reuses the real store policy
 * (useActiveDisclosure + setDisclosureTier/Value, memories) so every toggle is
 * live, per-space.
 *
 * Presented as a plain RN Modal (no gorhom) to stay simple and robust.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLocaleStore } from '../../stores/localeStore';
import {
  useMvpStore,
  useActiveIdentity,
  useActiveDisclosure,
} from '../../stores/mvpStore';
import type { DisclosureTier, DisclosureField, MemoryItem } from '../../core/mvp/types';
import { disclosureLabel, countWithheld } from '../../data/mvp/disclosure';
import { Orb } from '../../components/mvp/Orb';
import { haptic } from '../../utils/haptics';
import { rtlText, rtlRow } from '../../utils/rtl';

interface ProfileFocusProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onUpgrade: () => void;
}

const TIER_META: Record<DisclosureTier, { c: string; he: string; en: string; icon: string }> = {
  open: { c: '#0f8f6b', he: 'פתוח', en: 'Open', icon: '🟢' },
  ask: { c: '#b2822a', he: 'לפי בקשה', en: 'On request', icon: '🔸' },
  private: { c: '#868a92', he: 'פרטי', en: 'Private', icon: '🔒' },
};
const ORDER: DisclosureTier[] = ['open', 'ask', 'private'];
const nextTier = (t: DisclosureTier): DisclosureTier => ORDER[(ORDER.indexOf(t) + 1) % 3];

function TierChip({ tier, he, onPress }: { tier: DisclosureTier; he: boolean; onPress: () => void }) {
  const m = TIER_META[tier];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.chip, { backgroundColor: `${m.c}22` }]}
      accessibilityRole="button"
      accessibilityLabel={he ? m.he : m.en}
    >
      <Text style={[styles.chipText, { color: m.c }]}>{m.icon} {he ? m.he : m.en}</Text>
    </Pressable>
  );
}

export function ProfileFocus({ visible, onClose, onOpenSettings, onUpgrade }: ProfileFocusProps) {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const language = useLocaleStore((s) => s.language);
  const he = language === 'he';
  const lang = he ? 'he' : 'en';

  const identity = useActiveIdentity();
  const disclosure = useActiveDisclosure();
  const name = useMvpStore((s) => s.name);
  const plan = useMvpStore((s) => s.plan);
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const memories = useMvpStore((s) => s.memories);

  const setDisclosureTier = useMvpStore((s) => s.setDisclosureTier);
  const setDisclosureValue = useMvpStore((s) => s.setDisclosureValue);
  const setMemoryTier = useMvpStore((s) => s.setMemoryTier);
  const removeMemory = useMvpStore((s) => s.removeMemory);
  const setActiveIdentity = useMvpStore((s) => s.setActiveIdentity);
  const reset = useMvpStore((s) => s.reset);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const withheld = countWithheld(disclosure, memories);

  const cycleField = (f: DisclosureField) => {
    haptic.select();
    setDisclosureTier(f.id, nextTier(f.tier));
  };
  const startEdit = (f: DisclosureField) => {
    setEditingId(f.id);
    setEditDraft(f.value ?? '');
  };
  const commitEdit = (f: DisclosureField) => {
    setDisclosureValue(f.id, editDraft.trim());
    setEditingId(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]}>
        {/* Header */}
        <View style={[styles.header, rtlRow(lang)]}>
          <Text style={[styles.title, { color: colors.text }]}>{he ? 'הפרופיל שלי' : 'My profile'}</Text>
          <Pressable onPress={onClose} hitSlop={14} style={[styles.round, { backgroundColor: colors.surface }]}>
            <Text style={[styles.roundGlyph, { color: colors.text }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Orb size={74} alive trackPointer />
            <Text style={[styles.name, { color: colors.text }]}>{name || (he ? 'ה-ONE שלי' : 'My ONE')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {plan === 'free' ? (he ? 'ONE · חינם' : 'ONE · Free') : `ONE ${plan.toUpperCase()}`}
            </Text>
          </View>

          {/* Spaces */}
          {identities.length > 1 && (
            <View style={[styles.spaces, rtlRow(lang)]}>
              {identities.map((i) => {
                const on = i.id === activeIdentityId;
                return (
                  <Pressable
                    key={i.id}
                    onPress={() => { haptic.select(); setActiveIdentity(i.id); }}
                    style={[styles.space, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : 'transparent' }]}
                  >
                    <Text style={[styles.spaceText, { color: on ? colors.background : colors.textSecondary }]} numberOfLines={1}>
                      {i.name || (he ? 'אישי' : 'Personal')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* What ONE knows */}
          <Text style={[styles.section, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'מה ONE יודע עליך' : 'What ONE knows about you'}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'הקש על התגית כדי לקבוע כמה ONE חושף כל פרט. אני אף פעם לא מתחזה אליך.'
              : "Tap a tag to set how freely ONE shares each fact. I never impersonate you."}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {disclosure.map((f, idx) => (
              <View
                key={f.id}
                style={[styles.factRow, { borderBottomColor: colors.border, borderBottomWidth: idx === disclosure.length - 1 ? 0 : StyleSheet.hairlineWidth }]}
              >
                <View style={[styles.factTop, rtlRow(lang)]}>
                  <Text style={[styles.factLabel, { color: colors.text }, rtlText(lang)]}>{disclosureLabel(f, he)}</Text>
                  <TierChip tier={f.tier} he={he} onPress={() => cycleField(f)} />
                </View>
                {editingId === f.id ? (
                  <View style={[styles.editRow, rtlRow(lang)]}>
                    <TextInput
                      style={[styles.editInput, { color: colors.text, borderColor: colors.border }, rtlText(lang)]}
                      value={editDraft}
                      onChangeText={setEditDraft}
                      onSubmitEditing={() => commitEdit(f)}
                      placeholder={he ? 'הערך ש-ONE ייצג' : 'The value ONE represents'}
                      placeholderTextColor={colors.textSecondary}
                      autoFocus
                      returnKeyType="done"
                    />
                    <Pressable onPress={() => commitEdit(f)} style={[styles.saveBtn, { backgroundColor: colors.text }]}>
                      <Text style={[styles.saveGlyph, { color: colors.background }]}>✓</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => startEdit(f)} style={[styles.valRow, rtlRow(lang)]}>
                    <Text style={[styles.factValue, { color: f.value ? colors.textSecondary : colors.border }, rtlText(lang)]}>
                      {f.value || (he ? 'לא מולא — הקש להוספה' : 'Not set — tap to add')}
                    </Text>
                    <Text style={[styles.editGlyph, { color: colors.textSecondary }]}>✎</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {withheld > 0 && (
            <Text style={[styles.withheld, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? `🔒 ${withheld} פרטים נשמרים פרטיים כברירת מחדל` : `🔒 ${withheld} details stay private by default`}
            </Text>
          )}

          {/* What ONE remembers */}
          {memories.length > 0 && (
            <>
              <Text style={[styles.section, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? 'מה ONE זוכר' : 'What ONE remembers'}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {memories.map((m: MemoryItem, idx) => {
                  const tier: DisclosureTier = m.tier ?? 'private';
                  return (
                    <View
                      key={m.id}
                      style={[styles.memRow, { borderBottomColor: colors.border, borderBottomWidth: idx === memories.length - 1 ? 0 : StyleSheet.hairlineWidth }, rtlRow(lang)]}
                    >
                      <Text style={[styles.memText, { color: colors.text }, rtlText(lang)]}>{m.text}</Text>
                      <View style={[styles.memCtl, rtlRow(lang)]}>
                        <TierChip tier={tier} he={he} onPress={() => { haptic.select(); setMemoryTier(m.id, nextTier(tier)); }} />
                        <Pressable onPress={() => { haptic.tap(); removeMemory(m.id); }} hitSlop={8}>
                          <Text style={[styles.removeGlyph, { color: colors.textSecondary }]}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Account rows */}
          <Text style={[styles.section, { color: colors.textSecondary }, rtlText(lang)]}>{he ? 'חשבון' : 'Account'}</Text>
          <Pressable onPress={onOpenSettings} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>⚙︎  {he ? 'הגדרות' : 'Settings'}</Text>
            <Text style={[styles.chev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
          </Pressable>
          <Pressable onPress={onUpgrade} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>⭐  {plan === 'free' ? (he ? 'שדרג את ONE' : 'Upgrade ONE') : (he ? 'נהל מנוי' : 'Manage plan')}</Text>
            <Text style={[styles.chev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
          </Pressable>
          <Pressable
            onPress={() => { haptic.tap(); reset(); onClose(); }}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}
          >
            <Text style={[styles.rowLabel, { color: '#E24B4A' }]}>{he ? 'התנתק' : 'Sign out'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roundGlyph: { fontSize: 15, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, gap: 14 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 2 },
  name: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 12.5, fontWeight: '600' },
  spaces: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  space: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  spaceText: { fontSize: 12.5, fontWeight: '700' },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginTop: 8, paddingHorizontal: 2 },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 2, marginTop: -6 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  factRow: { paddingVertical: 12, gap: 7 },
  factTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  factLabel: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  valRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  factValue: { fontSize: 13, flexShrink: 1 },
  editGlyph: { fontSize: 13 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, fontSize: 14 },
  saveBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  saveGlyph: { fontSize: 15, fontWeight: '800' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11.5, fontWeight: '800' },
  withheld: { fontSize: 12, fontWeight: '600', paddingHorizontal: 2, marginTop: -4 },
  memRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12 },
  memText: { fontSize: 13.5, flexShrink: 1, lineHeight: 19 },
  memCtl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeGlyph: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 14 },
  rowLabel: { fontSize: 14.5, fontWeight: '600' },
  chev: { fontSize: 20 },
});
