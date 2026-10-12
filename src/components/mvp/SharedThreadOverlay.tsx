/**
 * SharedThreadOverlay — the OWNER's view of a shared Unit's common thread. Opens
 * over the process (not a nested Modal — an absolute overlay for a sheet's
 * overlay slot), shows the live conversation and lets the owner reply as role
 * 'one' (ONE representing them to the provider). Wraps the reusable SharedThread.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { ThemeColors } from '../../utils/theme';
import { rtlText, rtlRow } from '../../utils/rtl';
import { SharedThread } from './SharedThread';

export function SharedThreadOverlay({
  visible,
  code,
  myName,
  providerName,
  role = 'one',
  onClose,
  colors,
  lang,
}: {
  visible: boolean;
  code: string;
  myName: string;
  providerName?: string;
  /** 'one' = you shared it (ONE represents you); 'human' = you joined it. */
  role?: 'one' | 'human';
  onClose: () => void;
  colors: ThemeColors;
  lang: 'en' | 'he';
}) {
  const he = lang === 'he';
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.host]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={he ? 'סגור' : 'Dismiss'}>
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottom}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.head, rtlRow(lang)]}>
            <Text style={[styles.title, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
              {(he ? 'שיחה משותפת' : 'Shared conversation') + (providerName ? ` · ${providerName}` : '')}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={he ? 'סגור' : 'Close'}>
              <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }, rtlText(lang)]}>
            {role === 'human'
              ? (he ? 'שיחה עם הצד שמשתף איתך.' : 'Talking with the side sharing with you.')
              : (he ? 'וואן מייצג אותך מול הצד השני.' : 'ONE represents you to the other side.')}
          </Text>
          {/* Explicit maxHeight bounds the scroll so it renders + scrolls (an
              unbounded ScrollView in a flex column collapses on web). */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <SharedThread code={code} myName={myName} role={role} active colors={colors} lang={lang} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { zIndex: 60, elevation: 60 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  close: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  scroll: { maxHeight: 420, marginTop: 4 },
  scrollContent: { paddingBottom: 6 },
});
