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

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'Naming'>;

const ORB_SIZE = 56;

export function NamingScreen() {
  const { colors } = useThemeStore();
  const { onboarding, setName, nextStep } = useOne();
  const nav = useNavigation<Nav>();
  const [customName, setCustomName] = useState(onboarding.name);
  const [showInput, setShowInput] = useState(false);

  const onKeepOne = () => {
    setName('');
    nextStep();
    nav.navigate('Login');
  };

  const onNameLater = () => {
    setName('');
    nextStep();
    nav.navigate('Login');
  };

  const onSaveName = () => {
    setName(customName.trim());
    nextStep();
    nav.navigate('Login');
  };

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
          Call me ONE, or name me later.
        </Text>

        {!showInput ? (
          <>
            <TouchableOpacity
              style={[styles.opt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onKeepOne}
              activeOpacity={0.8}
            >
              <Text style={[styles.optText, { color: colors.text }]}>
                Keep ONE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.opt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onNameLater}
              activeOpacity={0.8}
            >
              <Text style={[styles.optText, { color: colors.text }]}>
                Name me later
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.opt, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowInput(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optText, { color: colors.text }]}>
                Give me a name
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text },
              ]}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Agent name..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={onSaveName}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Save name</Text>
            </TouchableOpacity>
          </>
        )}
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
    textAlign: 'center',
    marginBottom: 32,
  },
  opt: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  optText: {
    fontSize: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
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
