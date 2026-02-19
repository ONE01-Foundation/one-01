import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';

const ORB_SIZE = 56;

export function LoginScreen() {
  const { colors } = useThemeStore();
  const { completeOnboarding } = useOne();

  const onGuest = () => {
    completeOnboarding();
  };

  const onSaveMyOne = () => {
    // Guest first, login later – for now same as guest; real auth later
    completeOnboarding();
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
        Guest first, login later.
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={onGuest}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Continue as Guest</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={onSaveMyOne}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>
          Save my ONE
        </Text>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
