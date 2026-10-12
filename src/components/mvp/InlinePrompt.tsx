/**
 * InlinePrompt — a tiny cross-platform text prompt. Replaces `Alert.prompt`
 * (which only exists on iOS) so value-entry flows work on web + Android too.
 *
 * It is NOT a React Native <Modal>: nesting a Modal inside a @gorhom bottom
 * sheet gets dropped on iOS. Instead it renders as an absolute overlay and is
 * meant to live in a sheet's screen-pinned `overlay` slot (next to the other
 * panels), so it covers the sheet at every snap. Returns null when idle.
 *
 * Usage: keep an `InlinePromptConfig | null` in state; set it to open, pass it
 * as `config`, and clear it in `onClose`. `onSubmit` gets the trimmed value.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import type { ThemeColors } from '../../utils/theme';
import { rtlText } from '../../utils/rtl';

export interface InlinePromptConfig {
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
}

export function InlinePrompt({
  config,
  onClose,
  colors,
  lang,
}: {
  config: InlinePromptConfig | null;
  onClose: () => void;
  colors: ThemeColors;
  lang: 'en' | 'he';
}) {
  const he = lang === 'he';
  const [value, setValue] = useState('');
  // Reseed the field whenever a new prompt opens.
  useEffect(() => {
    setValue(config?.initialValue ?? '');
  }, [config]);

  if (!config) return null;

  const submit = () => {
    config.onSubmit(value.trim());
    onClose();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.host]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={he ? 'סגור' : 'Dismiss'}>
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>{config.title}</Text>
          {!!config.message && (
            <Text style={[styles.message, { color: colors.textSecondary }, rtlText(lang)]}>{config.message}</Text>
          )}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={config.placeholder}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            multiline={config.multiline}
            onSubmitEditing={config.multiline ? undefined : submit}
            returnKeyType="done"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
              rtlText(lang),
              config.multiline ? styles.inputMultiline : null,
            ]}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{he ? 'ביטול' : 'Cancel'}</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={[styles.btn, { backgroundColor: colors.text }]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: colors.background }]}>
                {config.submitLabel ?? (he ? 'שמור' : 'Save')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the sheet's docks/panels (switcher dock is zIndex 10).
  host: { zIndex: 60, elevation: 60 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },
  message: { fontSize: 13.5, lineHeight: 19 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
