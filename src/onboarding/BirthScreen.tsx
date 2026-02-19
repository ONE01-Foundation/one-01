import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Birth'>;

const ORB_SIZE = 88;

export function BirthScreen() {
  const { colors } = useThemeStore();
  const { nextStep } = useOne();
  const nav = useNavigation<Nav>();

  const onBegin = () => {
    nextStep();
    nav.navigate('Worlds');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.orbWrap}>
        <OrbAgent
          size={ORB_SIZE}
          state="idle"
          mode="home"
          showFace
          labelLines={[]}
        />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        I am your ONE Agent.
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={onBegin}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Begin</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  orbWrap: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 48,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
