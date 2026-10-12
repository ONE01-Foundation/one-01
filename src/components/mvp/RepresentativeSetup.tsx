/**
 * RepresentativeSetup — the first in-chat WIDGET: set up your representative.
 *
 * Not "design a character." You configure YOUR proxy — how it addresses you,
 * the voice it speaks in, your emblem (the face it wears to represent you), and
 * a first look at what it may disclose on your behalf. Picking an emblem updates
 * the big hero Orb live, so creating ONE feels like shaping a presence.
 *
 * Rendered as a card inside the representative chat home while onboarding; its
 * "done" completes onboarding.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Orb } from './Orb';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { useMvpStore } from '../../stores/mvpStore';
import { ORB_SKINS, AGENT_PERSONALITIES } from '../../data/mvp/agentAppearance';
import { rtlRow, rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

export function RepresentativeSetup({ onDone }: { onDone: () => void }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';

  const storedName = useMvpStore((s) => s.name);
  const setName = useMvpStore((s) => s.setName);
  const agentSkin = useMvpStore((s) => s.agentSkin);
  const setAgentSkin = useMvpStore((s) => s.setAgentSkin);
  const agentPersonality = useMvpStore((s) => s.agentPersonality);
  const setAgentPersonality = useMvpStore((s) => s.setAgentPersonality);

  const [name, setNameLocal] = useState(storedName);

  const onChangeName = (v: string) => {
    setNameLocal(v);
    setName(v);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
        {he ? 'נגדיר את הנציג שלך' : 'Set up your representative'}
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }, rtlText(lang)]}>
        {he ? 'כמה דברים קצרים — ותמיד אפשר לשנות בפרופיל.' : 'A few quick things — always changeable in your profile.'}
      </Text>

      {/* How to address you */}
      <Text style={[styles.label, { color: colors.textSecondary }, rtlText(lang)]}>
        {he ? 'איך לפנות אליך?' : 'What should I call you?'}
      </Text>
      <TextInput
        value={name}
        onChangeText={onChangeName}
        placeholder={he ? 'השם שלך' : 'Your name'}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, textAlign: he ? 'right' : 'left' },
        ]}
        autoCapitalize="words"
        returnKeyType="done"
      />

      {/* Voice — how ONE speaks to you / on your behalf */}
      <Text style={[styles.label, { color: colors.textSecondary }, rtlText(lang)]}>
        {he ? 'איך אדבר אליך?' : 'How should I speak?'}
      </Text>
      <View style={[styles.chips, rtlRow(lang)]}>
        {AGENT_PERSONALITIES.map((p) => {
          const active = p.id === agentPersonality;
          return (
            <Pressable
              key={p.id}
              onPress={() => { haptic.select(); setAgentPersonality(p.id); }}
              style={[styles.chip, { backgroundColor: active ? colors.text : colors.background, borderColor: active ? colors.text : colors.border }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, { color: active ? colors.background : colors.text }]}>
                {he ? p.labelHe : p.labelEn}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Emblem — the face ONE wears to represent you (updates the hero Orb) */}
      <Text style={[styles.label, { color: colors.textSecondary }, rtlText(lang)]}>
        {he ? 'החותם שלי' : 'My emblem'}
      </Text>
      <View style={[styles.skins, rtlRow(lang)]}>
        {ORB_SKINS.map((skin) => {
          const active = skin.id === agentSkin;
          return (
            <Pressable
              key={skin.id}
              onPress={() => { haptic.select(); setAgentSkin(skin.id); }}
              style={[styles.skinItem, { borderColor: active ? colors.text : 'transparent', backgroundColor: active ? colors.background : 'transparent' }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={he ? skin.labelHe : skin.labelEn}
            >
              <Orb size={32} skinOverride={skin.id} noBlink noShadow />
            </Pressable>
          );
        })}
      </View>

      {/* Disclosure teaser — the trust core, configured in depth in the profile */}
      <View style={[styles.discNote, { borderColor: colors.border }]}>
        <Text style={[styles.discTitle, { color: colors.text }, rtlText(lang)]}>
          {he ? 'מה מותר לי לייצג' : 'What I may represent'}
        </Text>
        <Text style={[styles.discBody, { color: colors.textSecondary }, rtlText(lang)]}>
          {he
            ? 'אני מייצג אותך — ומשתף רק מה שתרשה. כל פרט: גלוי · באישור · פרטי. נגדיר לעומק בפרופיל.'
            : "I represent you — and share only what you allow. Each detail: open · ask · private. We'll set it in depth in your profile."}
        </Text>
        <View style={[styles.tiers, rtlRow(lang)]}>
          <View style={[styles.tier, rtlRow(lang)]}><View style={[styles.dot, { backgroundColor: '#10B981' }]} /><Text style={[styles.tierT, { color: colors.textSecondary }]}>{he ? 'גלוי' : 'Open'}</Text></View>
          <View style={[styles.tier, rtlRow(lang)]}><View style={[styles.dot, { backgroundColor: '#F59E0B' }]} /><Text style={[styles.tierT, { color: colors.textSecondary }]}>{he ? 'באישור' : 'Ask'}</Text></View>
          <View style={[styles.tier, rtlRow(lang)]}><View style={[styles.dot, { backgroundColor: colors.textSecondary }]} /><Text style={[styles.tierT, { color: colors.textSecondary }]}>{he ? 'פרטי' : 'Private'}</Text></View>
        </View>
      </View>

      <Pressable
        onPress={() => { haptic.tap(); onDone(); }}
        style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.text, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.doneText, { color: colors.background }]}>
          {he ? 'זהו, בוא נתחיל' : "That's it — let's start"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, borderBottomStartRadius: 6, padding: 18, gap: 10, alignSelf: 'stretch' },
  title: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, marginTop: -4 },
  label: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, fontSize: 15.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  skins: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skinItem: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  discNote: { borderWidth: 1, borderRadius: 14, padding: 13, gap: 7, marginTop: 10 },
  discTitle: { fontSize: 14, fontWeight: '700' },
  discBody: { fontSize: 12.5, lineHeight: 18 },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tierT: { fontSize: 12, fontWeight: '600' },
  doneBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  doneText: { fontSize: 15, fontWeight: '700' },
});
