/**
 * CreateIdentitySheet — flow for adding a new Identity (Personal / Business / Family).
 *
 * Triggered from IdentitySwitchSheet's "+ Add Identity" button.
 *
 * Layout:
 *   Grabber
 *   Title: "New identity"                ✕
 *   Type picker: Personal / Business / Family
 *   Name input
 *   Auto-derived initials preview
 *   [Create]
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import type { Identity, IdentityType } from '../../core/mvp/types';

const SCREEN_H = Dimensions.get('window').height;

const TYPE_OPTIONS: { value: IdentityType; label: string; description: string }[] = [
  { value: 'personal', label: 'Personal', description: 'For your private life and goals.' },
  { value: 'business', label: 'Business', description: 'For a business you operate.' },
  { value: 'family', label: 'Family', description: 'Shared with people in your household.' },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

interface CreateIdentitySheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (identity: Identity) => void;
}

export function CreateIdentitySheet({ visible, onClose, onCreated }: CreateIdentitySheetProps) {
  const { colors } = useThemeStore();
  const setActive = useMvpStore((s) => s.setActiveIdentity);
  const setIdentitiesAdd = useMvpStore.setState;

  const [type, setType] = useState<IdentityType>('personal');
  const [name, setName] = useState('');

  const reset = () => {
    setType('personal');
    setName('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const identity: Identity = {
      id: `identity_${Date.now()}`,
      name: name.trim(),
      type,
      initials: initialsFromName(name),
      updateCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setIdentitiesAdd((state) => ({
      identities: [...state.identities, identity],
    }));
    setActive(identity.id);
    reset();
    onClose();
    onCreated?.(identity);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      // Card-feel, consistent with CreateProcessSheet.
      snapPoints={['75%', '92%']}
      sheetStyle={[styles.sheet]}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]}>New identity</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={[styles.closeX, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {/* Initials preview */}
        <View style={[styles.avatarPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.avatarInitials, { color: colors.text }]}>
            {initialsFromName(name)}
          </Text>
        </View>

        {/* Name input */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sarah Salon"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            autoFocus
            returnKeyType="next"
          />
        </View>

        {/* Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Type</Text>
          <View style={styles.typeStack}>
            {TYPE_OPTIONS.map((opt) => {
              const active = opt.value === type;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  style={({ pressed }) => [
                    styles.typeRow,
                    {
                      backgroundColor: active ? colors.surface : 'transparent',
                      borderColor: active ? colors.text : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.typeText}>
                    <Text style={[styles.typeLabel, { color: colors.text }]}>{opt.label}</Text>
                    <Text style={[styles.typeDesc, { color: colors.textSecondary }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {active && <Text style={[styles.typeCheck, { color: colors.text }]}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={!name.trim()}
          style={({ pressed }) => [
            styles.createBtn,
            {
              backgroundColor: colors.circle,
              opacity: !name.trim() ? 0.3 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.createBtnText, { color: colors.background }]}>Create</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {},

  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '600' },
  closeX: { fontSize: 20 },

  avatarPreview: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  avatarInitials: { fontSize: 28, fontWeight: '600' },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },

  typeStack: { gap: 8 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  typeText: { flex: 1, gap: 2 },
  typeLabel: { fontSize: 15, fontWeight: '600' },
  typeDesc: { fontSize: 13 },
  typeCheck: { fontSize: 18, fontWeight: '600' },

  createBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '600' },
});
