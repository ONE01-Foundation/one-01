import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { PERSONA_LABELS } from '../core/types';
import type { AgentPersona } from '../core/types';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Style'>;

const OPTIONS: AgentPersona[] = ['friendly', 'professional', 'neutral'];

export function StyleScreen() {
  const { colors } = useThemeStore();
  const { onboarding, setPersona, nextStep } = useOne();
  const nav = useNavigation<Nav>();

  const onNext = () => {
    nextStep();
    nav.navigate('Lens');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Persona style</Text>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.opt,
            { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: onboarding.persona === opt ? 2 : 1 },
          ]}
          onPress={() => setPersona(opt)}
          activeOpacity={0.8}
        >
          <Text style={[styles.optText, { color: colors.text }]}>{PERSONA_LABELS[opt]}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }, !onboarding.persona && styles.btnDisabled]}
        onPress={onNext}
        activeOpacity={0.8}
        disabled={!onboarding.persona}
      >
        <Text style={styles.btnText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 24 },
  opt: { padding: 18, borderRadius: 12, marginBottom: 12 },
  optText: { fontSize: 18 },
  btn: { marginTop: 32, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
