import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { LIFE_LENSES, LENS_LABELS } from '../core/types';
import type { LifeLens } from '../core/types';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Lens'>;

function toggle(lenses: LifeLens[], lens: LifeLens, max: number): LifeLens[] {
  if (lenses.includes(lens)) return lenses.filter((l) => l !== lens);
  if (lenses.length >= max) return lenses;
  return [...lenses, lens];
}

export function LensScreen() {
  const { colors } = useThemeStore();
  const { onboarding, setLenses, nextStep } = useOne();
  const nav = useNavigation<Nav>();
  const { lenses } = onboarding;

  const onNext = () => {
    nextStep();
    nav.navigate('Desire');
  };

  const onToggle = (lens: LifeLens) => setLenses(toggle(lenses, lens, 3));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Life Lenses (Hats)</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>Pick 1 to 3</Text>
      {LIFE_LENSES.map((lens) => {
        const selected = lenses.includes(lens);
        return (
          <TouchableOpacity
            key={lens}
            style={[
              styles.opt,
              {
                backgroundColor: colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: selected ? 2 : 1,
              },
            ]}
            onPress={() => onToggle(lens)}
            activeOpacity={0.8}
          >
            <Text style={[styles.optText, { color: colors.text }]}>{LENS_LABELS[lens]}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }, lenses.length === 0 && styles.btnDisabled]}
        onPress={onNext}
        activeOpacity={0.8}
        disabled={lenses.length === 0}
      >
        <Text style={styles.btnText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 14, marginBottom: 24 },
  opt: { padding: 18, borderRadius: 12, marginBottom: 12 },
  optText: { fontSize: 18 },
  btn: { marginTop: 32, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
