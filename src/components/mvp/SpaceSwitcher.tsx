/**
 * SpaceSwitcher — the one consistent way to switch spaces (identities) across
 * the app: the home list, the ONE profile, and Global. A pill row with the
 * active space filled dark; "+ מרחב" adds the next space type.
 *
 * Units + disclosure are scoped per identity, so switching the active identity
 * is what re-scopes the list / profile / Global to that space — the same
 * gesture everywhere, so "which ONE am I right now" reads the same in each place.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { haptic } from '../../utils/haptics';
import { rtlRow } from '../../utils/rtl';
import type { IdentityType } from '../../core/mvp/types';

const SPACE_META: Record<IdentityType, { he: string; en: string; emoji: string }> = {
  personal: { he: 'אישי', en: 'Personal', emoji: '🏠' },
  business: { he: 'עסקי', en: 'Business', emoji: '💼' },
  family: { he: 'משפחה', en: 'Family', emoji: '👨‍👩‍👧' },
};
const ADD_ORDER: IdentityType[] = ['business', 'family', 'personal'];

export function SpaceSwitcher({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const setActiveIdentity = useMvpStore((s) => s.setActiveIdentity);
  const addIdentity = useMvpStore((s) => s.addIdentity);

  const addNext = useCallback(() => {
    const have = new Set(identities.map((i) => i.type));
    const next = ADD_ORDER.find((t) => !have.has(t)) ?? 'personal';
    haptic.select();
    addIdentity(next);
  }, [identities, addIdentity]);

  return (
    <View style={[styles.row, rtlRow(lang), style]}>
      {identities.map((idn) => {
        const active = idn.id === activeIdentityId;
        const meta = SPACE_META[idn.type] ?? { he: 'מרחב', en: 'Space', emoji: '•' };
        const label = idn.name && idn.name.trim() ? idn.name : (he ? meta.he : meta.en);
        return (
          <Pressable
            key={idn.id}
            onPress={() => { haptic.select(); setActiveIdentity(idn.id); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.pill,
              { borderColor: active ? colors.circle : colors.border, backgroundColor: active ? colors.circle : colors.surface },
            ]}
          >
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <Text style={[styles.txt, { color: active ? colors.background : colors.text }]}>{label}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={addNext} accessibilityRole="button" style={[styles.add, { borderColor: colors.border }]}>
        <Text style={[styles.txt, { color: colors.textSecondary }]}>{he ? '+ מרחב' : '+ Space'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13,
  },
  add: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13,
  },
  emoji: { fontSize: 13 },
  txt: { fontSize: 13.5, fontWeight: '600' },
});
