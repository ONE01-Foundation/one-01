import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import type { OnboardingStackParamList } from '../navigation/OnboardingNavigator';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Direction'>;

const ORB_SIZE = 64;

export function DirectionScreen() {
  const { colors } = useThemeStore();
  const { onboarding, setDesire, nextStep } = useOne();
  const nav = useNavigation<Nav>();
  const [value, setValue] = useState(onboarding.desire);
  const [created, setCreated] = useState(false);

  const onStartOne = () => {
    const trimmed = value.trim() || 'My first goal';
    setDesire(trimmed);
    setCreated(true);
  };

  const onContinue = () => {
    nextStep();
    nav.navigate('Naming');
  };

  if (created) {
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
        <Text style={[styles.createdTitle, { color: colors.text }]}>
          First Process Created
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
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
          Choose first direction
        </Text>
        <TextInput
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text },
          ]}
          value={value}
          onChangeText={setValue}
          placeholder="Your first intent..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={2}
        />
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onStartOne}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Start ONE</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    width: '100%',
  },
  orbWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  createdTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 48,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
