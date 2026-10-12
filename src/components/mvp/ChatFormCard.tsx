/**
 * ChatFormCard — a TOOL widget ONE deploys in the thread: collect a few
 * structured details. Reads its run live from the store (survives reloads).
 * On submit the values flow back: any `discKey` field is saved into "What ONE
 * knows about you" (the active space's disclosure policy) so ONE can represent
 * it, and a note is logged onto the process (shows in Activity).
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useMvpStore, disclosureForIdentity } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

const GOOD = '#1CA06B';

export function ChatFormCard({ runId }: { runId: string }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const run = useMvpStore((s) => s.formRuns[runId]);
  const setFormFieldValue = useMvpStore((s) => s.setFormFieldValue);
  const submitForm = useMvpStore((s) => s.submitForm);
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const setDisclosureValue = useMvpStore((s) => s.setDisclosureValue);
  const addDisclosureField = useMvpStore((s) => s.addDisclosureField);
  const wroteRef = useRef(false);

  // On submit, write the values back ONCE: disclosure facts + a process note.
  useEffect(() => {
    if (!run?.submittedAt || wroteRef.current) return;
    wroteRef.current = true;

    // 1) Save disclosure-mapped fields into the active space's policy.
    const activeId = useMvpStore.getState().activeIdentityId;
    const policy = disclosureForIdentity(activeId);
    for (const f of run.fields) {
      const v = f.value?.trim();
      if (!f.discKey || !v) continue;
      const existing = policy.find((d) => d.key === f.discKey);
      if (existing) setDisclosureValue(existing.id, v);
      else addDisclosureField(f.label, v);
    }

    // 2) Log a note onto the process (shows in Activity).
    if (run.unitId) {
      const unit = useMvpStore.getState().units.find((u) => u.id === run.unitId);
      if (unit) {
        const filled = run.fields.filter((f) => f.value?.trim());
        const summary = filled.map((f) => `${f.label}: ${f.value!.trim()}`).join(' · ');
        const nowIso = new Date().toISOString();
        updateUnit(unit.id, {
          timeline: [
            ...(unit.timeline ?? []),
            { id: `tl_form_${Date.now()}`, title: he ? `פרטים נמסרו — ${run.title}` : `Details collected — ${run.title}`, subtitle: summary, date: nowIso, kind: 'event' },
          ],
          unreadUpdates: (unit.unreadUpdates ?? 0) + 1,
          lastUpdatedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.submittedAt]);

  if (!run) return null;
  const submitted = !!run.submittedAt;
  const allFilled = run.fields.every((f) => !!f.value?.trim());

  // ── SUBMITTED ──
  if (submitted) {
    const savedDisc = run.fields.filter((f) => f.discKey && f.value?.trim()).length;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.accent, { backgroundColor: GOOD }]} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>📝 {run.title}</Text>
          <Text style={[styles.doneBig, { color: GOOD }, rtlText(lang)]}>
            {he ? '✓ נמסר' : '✓ Submitted'}
          </Text>
          {run.fields.filter((f) => f.value?.trim()).map((f) => (
            <Text key={f.id} style={[styles.doneRow, { color: colors.text }, rtlText(lang)]}>
              <Text style={{ color: colors.textSecondary }}>{f.label}: </Text>{f.value!.trim()}
            </Text>
          ))}
          {savedDisc > 0 && (
            <Text style={[styles.doneSub, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? 'נשמר למה ש-ONE יודע עליך.' : 'Saved to what ONE knows about you.'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── FILL ──
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>📝 {run.title}</Text>
        {run.fields.map((f) => (
          <View key={f.id} style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }, rtlText(lang)]}>{f.label}</Text>
            <TextInput
              value={f.value ?? ''}
              onChangeText={(t) => setFormFieldValue(runId, f.id, t)}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textSecondary}
              keyboardType={f.kind === 'number' ? 'numbers-and-punctuation' : 'default'}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }, rtlText(lang)]}
            />
          </View>
        ))}
        <Pressable
          onPress={() => { if (!allFilled) return; haptic.tap(); submitForm(runId); }}
          disabled={!allFilled}
          style={[styles.submitBtn, { backgroundColor: colors.text, opacity: allFilled ? 1 : 0.4 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.submitText, { color: colors.surface }]}>{he ? 'שלח' : 'Submit'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    borderBottomStartRadius: 6,
    overflow: 'hidden',
  },
  accent: { width: 4 },
  body: { flex: 1, padding: 15, gap: 10 },
  title: { fontSize: 15.5, fontWeight: '700' },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
  },
  submitBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '700' },
  doneBig: { fontSize: 18, fontWeight: '800' },
  doneRow: { fontSize: 14, lineHeight: 20 },
  doneSub: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
});
