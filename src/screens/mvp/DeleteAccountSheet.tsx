/**
 * DeleteAccountSheet — typed-confirmation flow per Apple §5.1.1(v).
 *
 * "Apps that support account creation must also offer account deletion within
 *  the app." We satisfy this with a clear confirmation step that requires the
 *  user to type the word DELETE before the destructive action enables.
 *
 * Flow:
 *   1. Sheet opens with a warning + a TextInput labeled "Type DELETE to confirm"
 *   2. The red "Delete account" button is disabled until input matches DELETE
 *   3. Tap → onConfirmed() (parent resets state + signs out)
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
import { BottomSheet } from '../../components/mvp/BottomSheet';

const SCREEN_H = Dimensions.get('window').height;
const CONFIRM_WORD = 'DELETE';

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}

export function DeleteAccountSheet({ visible, onClose, onConfirmed }: DeleteAccountSheetProps) {
  const { colors } = useThemeStore();
  const [text, setText] = useState('');
  const matches = text.trim().toUpperCase() === CONFIRM_WORD;

  const handleConfirm = () => {
    if (!matches) return;
    setText('');
    onConfirmed();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['55%']}
      sheetStyle={[styles.sheet]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Delete account</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          This permanently removes your account, all your processes, identities, and
          memory. We cannot recover this data later.
        </Text>
        <Text style={[styles.bodyStrong, { color: colors.text }]}>
          Type {CONFIRM_WORD} below to confirm.
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[
            styles.input,
            { color: colors.text, borderColor: matches ? '#E24B4A' : colors.border },
          ]}
        />

        <Pressable
          onPress={handleConfirm}
          disabled={!matches}
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: !matches ? 0.4 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.deleteBtnText}>Permanently delete account</Text>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={10} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {},
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 2,
    textAlign: 'center',
  },
  deleteBtn: {
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: '#E24B4A',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
