/**
 * JoinSharedSheet — the PROVIDER side of a shared Unit. Enter the code you were
 * given, join the process, and correspond in the common thread. Reads only the
 * disclosure-safe snapshot the owner published (never their private data). This
 * is the other end of "Share with a ONE" → cloudShared.
 *
 * Top-level sheet (rendered in MvpStack, never nested inside another Modal).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { joinSharedUnit, type SharedUnitRow, type SharedSnapshot } from '../../services/cloudShared';
import { SharedThread } from '../../components/mvp/SharedThread';

export function JoinSharedSheet({
  visible,
  onClose,
  myName,
}: {
  visible: boolean;
  onClose: () => void;
  myName: string;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';

  const [code, setCode] = useState('');
  const [name, setName] = useState(myName);
  const [row, setRow] = useState<SharedUnitRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fresh each time the sheet opens.
  useEffect(() => {
    if (!visible) {
      setRow(null); setCode(''); setErr(null);
    } else {
      setName(myName || (he ? 'אורח' : 'Guest'));
    }
  }, [visible, myName, he]);

  const join = useCallback(async () => {
    const c = code.trim().toLowerCase();
    if (!c) return;
    haptic.tap(); setBusy(true); setErr(null);
    const r = await joinSharedUnit(c, name.trim() || (he ? 'אורח' : 'Guest'));
    setBusy(false);
    if (!r) {
      setErr(he ? 'קוד לא נמצא, או אין חיבור כרגע.' : 'Code not found, or no connection right now.');
      return;
    }
    setRow(r);
  }, [code, name, he]);

  const snap = (row?.unit ?? {}) as SharedSnapshot;

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={['82%']}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {!row ? (
          <View style={styles.enter}>
            <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
              {he ? 'הצטרפות לתהליך משותף' : 'Join a shared process'}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? 'הזן את הקוד שקיבלת מהצד שמשתף.' : 'Enter the code the other side gave you.'}
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={he ? 'קוד' : 'Code'}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.codeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={he ? 'השם שלך' : 'Your name'}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }, rtlText(lang)]}
            />
            {!!err && <Text style={[styles.err, rtlText(lang)]}>{err}</Text>}
            <Pressable
              onPress={join}
              disabled={busy || !code.trim()}
              style={[styles.primaryBtn, { backgroundColor: colors.text, opacity: busy || !code.trim() ? 0.4 : 1 }]}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={colors.background} /> : (
                <Text style={[styles.primaryText, { color: colors.background }]}>{he ? 'הצטרף' : 'Join'}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.joined}>
            <View style={[styles.snapHead, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
              <Text style={styles.snapEmoji}>{snap.emoji ?? '📌'}</Text>
              <View style={styles.flex1}>
                <Text style={[styles.snapTitle, { color: colors.text }, rtlText(lang)]} numberOfLines={2}>{snap.title ?? row.title}</Text>
                {!!snap.status && <Text style={[styles.snapStatus, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={2}>{snap.status}</Text>}
              </View>
            </View>
            {!!snap.sharedByName && (
              <Text style={[styles.sharedBy, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? `${snap.sharedByName} שיתף/ה איתך` : `Shared with you by ${snap.sharedByName}`}
                {snap.openFacts?.length ? ` · ${snap.openFacts.join(' · ')}` : ''}
              </Text>
            )}

            <SharedThread
              code={row.code}
              unitId={row.id}
              myName={name}
              role="human"
              active={visible}
              colors={colors}
              lang={lang}
            />
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40, gap: 12 },
  flex1: { flex: 1 },
  enter: { gap: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  codeInput: { fontSize: 20, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  err: { fontSize: 13, color: '#D1495B' },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 15, fontWeight: '700' },
  joined: { gap: 12 },
  snapHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  snapEmoji: { fontSize: 26 },
  snapTitle: { fontSize: 16, fontWeight: '700' },
  snapStatus: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  sharedBy: { fontSize: 12.5, lineHeight: 18 },
  thread: { gap: 8, marginTop: 2 },
  msg: { maxWidth: '85%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  msgMine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  msgTheirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  msgAuthor: { fontSize: 11, fontWeight: '700' },
  msgText: { fontSize: 14.5, lineHeight: 20 },
  replyRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  reply: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  sendBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
