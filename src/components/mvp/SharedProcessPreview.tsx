/**
 * SharedProcessPreview — "what the other side sees". When a process is shared or
 * public, this shows the recipient's-eye view: the process summary, the outward
 * message ONE would send, and ONLY the open-tier disclosure facts. Everything
 * else (ask / private facts) stays hidden, so the user can SEE exactly what they
 * expose before they share. It's the client half of the two-sided Unit — the
 * same surface a provider will see remotely once the shared backend lands.
 *
 * Not a <Modal> (dropped on iOS inside a gorhom sheet) — an absolute overlay
 * meant for a sheet's screen-pinned `overlay` slot. Renders null when hidden.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ThemeColors } from '../../utils/theme';
import { rtlText, rtlRow } from '../../utils/rtl';

export function SharedProcessPreview({
  visible,
  emoji,
  title,
  status,
  providerName,
  sharedByName,
  openFacts,
  hiddenCount,
  draftBody,
  shareCode,
  onClose,
  colors,
  lang,
}: {
  visible: boolean;
  emoji: string;
  title: string;
  status?: string | null;
  providerName?: string;
  sharedByName?: string;
  openFacts: string[];
  hiddenCount: number;
  draftBody?: string;
  /** Live join code, once published to the shared backend. */
  shareCode?: string;
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
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.headRow, rtlRow(lang)]}>
            <Text style={[styles.eyebrow, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? '👁 כפי שהצד השני רואה' : '👁 What the other side sees'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={he ? 'סגור' : 'Close'}>
              <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.scrollContent}>
            {!!shareCode && (
              <View style={[styles.codeBanner, { backgroundColor: colors.background, borderColor: colors.border }, rtlRow(lang)]}>
                <Text style={[styles.codeLabel, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? 'קוד הצטרפות — תן לצד השני:' : 'Join code — give the other side:'}
                </Text>
                <Text style={[styles.codeValue, { color: colors.text }]} selectable>{shareCode}</Text>
              </View>
            )}
            <Text style={[styles.sharedBy, { color: colors.textSecondary }, rtlText(lang)]}>
              {sharedByName
                ? he ? `${sharedByName} שיתף/ה איתך תהליך:` : `${sharedByName} shared a process with you:`
                : he ? 'שותף איתך תהליך:' : 'A process was shared with you:'}
            </Text>

            <View style={[styles.processRow, { backgroundColor: colors.background }, rtlRow(lang)]}>
              <Text style={styles.processEmoji}>{emoji}</Text>
              <View style={styles.flex1}>
                <Text style={[styles.processTitle, { color: colors.text }, rtlText(lang)]} numberOfLines={2}>{title}</Text>
                {!!status && (
                  <Text style={[styles.processStatus, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={2}>{status}</Text>
                )}
              </View>
            </View>

            {!!draftBody && (
              <View style={styles.block}>
                <Text style={[styles.blockLabel, { color: colors.textSecondary }, rtlText(lang)]}>
                  {providerName
                    ? he ? `הודעה אליך (${providerName})` : `Message to you (${providerName})`
                    : he ? 'ההודעה' : 'The message'}
                </Text>
                <Text style={[styles.draftBody, { color: colors.text, backgroundColor: colors.background }, rtlText(lang)]}>{draftBody}</Text>
              </View>
            )}

            <View style={styles.block}>
              <Text style={[styles.blockLabel, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? 'פרטים משותפים' : 'Shared details'}
              </Text>
              {openFacts.length > 0 ? (
                openFacts.map((f) => (
                  <View key={f} style={[styles.factRow, rtlRow(lang)]}>
                    <View style={[styles.factDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.factText, { color: colors.text }, rtlText(lang)]}>{f}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.factText, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? 'עדיין לא שותפו פרטים אישיים.' : 'No personal details shared yet.'}
                </Text>
              )}
            </View>

            <Text style={[styles.footer, { color: colors.textSecondary }, rtlText(lang)]}>
              {hiddenCount > 0
                ? he
                  ? `רק מה שאישרת לשיתוף מופיע כאן. ${hiddenCount} פרטים נוספים נשמרים פרטיים.`
                  : `Only what you allowed is shown. ${hiddenCount} more detail${hiddenCount === 1 ? '' : 's'} stay private.`
                : he
                  ? 'רק מה שאישרת לשיתוף מופיע כאן.'
                  : 'Only what you allowed to share is shown here.'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { zIndex: 60, elevation: 60 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  flex1: { flex: 1 },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '82%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  close: { fontSize: 16, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8, gap: 14 },
  codeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  codeLabel: { fontSize: 12, flex: 1 },
  codeValue: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  sharedBy: { fontSize: 13, lineHeight: 18 },
  processRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14 },
  processEmoji: { fontSize: 26 },
  processTitle: { fontSize: 16, fontWeight: '700' },
  processStatus: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  block: { gap: 7 },
  blockLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  draftBody: { fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 12 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  factDot: { width: 7, height: 7, borderRadius: 4 },
  factText: { fontSize: 14, lineHeight: 20, flex: 1 },
  footer: { fontSize: 12, lineHeight: 17, marginTop: 2, fontStyle: 'italic' },
});
