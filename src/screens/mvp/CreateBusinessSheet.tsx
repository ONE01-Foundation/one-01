/**
 * CreateBusinessSheet — build a business profile (its own ONE) on mobile.
 *
 * Two ways to fill it in:
 *   1. Describe it in free text ("Bella Nails — a nail salon, manicure ₪90,
 *      open 9–7") and let ONE parse the name, category, services and hours.
 *   2. Edit the structured fields directly.
 *
 * On create it upserts into the shared Supabase `providers` table (the same one
 * the web writes to) so the business is live on every surface, and the owner
 * can then see its followers + customer cards from the BusinessSheet.
 *
 * Deliberately simple + crash-defensive (single ScrollView, opened from Home,
 * never stacked inside another sheet), matching BusinessSheet.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { useBusinessStore } from '../../stores/businessStore';
import {
  emptyDraft,
  parseBusinessText,
  draftToCloud,
  saveBusiness,
  myBusinessKey,
  newBusinessId,
  slotsFromHours,
  type BusinessDraft,
} from '../../services/cloudBusiness';

const SNAP = ['92%'];

function hoursPreview(hours: BusinessDraft['hours']): string {
  return hours
    .map((h) => (h.close ? `${h.day} ${h.open}–${h.close}` : `${h.day} —`))
    .join(' · ');
}

export function CreateBusinessSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fires with the new business id so Home can open it right away. */
  onCreated?: (id: string) => void;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';

  const [describe, setDescribe] = useState('');
  const [draft, setDraft] = useState<BusinessDraft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = () => {
    setDescribe('');
    setDraft(emptyDraft());
    setBusy(false);
    setFailed(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const applyDescribe = () => {
    if (!describe.trim()) return;
    haptic.tap();
    const p = parseBusinessText(describe);
    setDraft((d) => {
      const next: BusinessDraft = { ...d, ...p };
      if (p.hours) next.slots = slotsFromHours(p.hours);
      return next;
    });
  };

  const setService = (i: number, key: 'name' | 'price', val: string) => {
    setDraft((d) => {
      const services = d.services.map((s, j) => (j === i ? { ...s, [key]: val } : s));
      return { ...d, services };
    });
  };

  const addService = () => {
    haptic.select();
    setDraft((d) => ({ ...d, services: [...d.services, { name: '', price: '' }] }));
  };

  const canCreate = draft.name.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    haptic.press();
    setBusy(true);
    setFailed(false);
    const id = newBusinessId();
    const biz = draftToCloud(draft, id);
    const ok = await saveBusiness(biz);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    // Stamp the owner key onto the optimistic copy so the creator immediately
    // sees the owner dashboard (followers / customers), not a Follow button.
    const owner = await myBusinessKey();
    useBusinessStore.getState().upsertLocal({ ...biz, ownerKey: owner });
    onCreated?.(id);
    reset();
    onClose();
  };

  const label = (s: string) => (
    <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>{s}</Text>
  );

  return (
    <BottomSheet visible={visible} onClose={close} snapPoints={SNAP} initialSnap={0} backdropOpacity={0.3}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
            {he ? 'עסק חדש · הוואן שלו' : 'New business · its ONE'}
          </Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={[styles.closeX, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {/* Describe → let ONE fill it in */}
        {label(he ? 'תאר/י את העסק' : 'Describe the business')}
        <TextInput
          value={describe}
          onChangeText={setDescribe}
          placeholder={
            he
              ? 'לדוגמה: נדיה ניילס — מניקור ₪90, ג׳ל ₪140, פתוח 9 עד 19'
              : 'e.g. Bella Nails — a nail salon, manicure ₪90, gel ₪140, open 9–7'
          }
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.textarea,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
            rtlText(lang),
          ]}
        />
        <Pressable
          onPress={applyDescribe}
          disabled={!describe.trim()}
          style={[
            styles.fillBtn,
            { borderColor: colors.text, opacity: describe.trim() ? 1 : 0.4 },
          ]}
        >
          <Text style={[styles.fillText, { color: colors.text }]}>
            {he ? '✨ שהוואן ימלא את זה' : '✨ Let ONE fill it in'}
          </Text>
        </Pressable>

        {/* Emoji + name */}
        <View style={styles.nameRow}>
          <TextInput
            value={draft.emoji}
            onChangeText={(v) => setDraft((d) => ({ ...d, emoji: v }))}
            style={[styles.emojiInput, { color: colors.text, borderColor: colors.border }]}
            maxLength={2}
          />
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder={he ? 'שם העסק' : 'Business name'}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.nameInput,
              { color: colors.text, borderColor: colors.border },
              rtlText(lang),
            ]}
          />
        </View>

        {/* Category */}
        {label(he ? 'קטגוריה' : 'Category')}
        <TextInput
          value={draft.category}
          onChangeText={(v) => setDraft((d) => ({ ...d, category: v }))}
          placeholder={he ? 'לדוגמה: מספרה' : 'e.g. Hair salon'}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }, rtlText(lang)]}
        />

        {/* Services */}
        {label(he ? 'שירותים ומחירים' : 'Services & prices')}
        {draft.services.map((s, i) => (
          <View key={i} style={styles.svcRow}>
            <TextInput
              value={s.name}
              onChangeText={(v) => setService(i, 'name', v)}
              placeholder={he ? 'שירות' : 'Service'}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.svcName,
                { color: colors.text, borderColor: colors.border },
                rtlText(lang),
              ]}
            />
            <TextInput
              value={s.price}
              onChangeText={(v) => setService(i, 'price', v)}
              placeholder="₪"
              placeholderTextColor={colors.textSecondary}
              style={[styles.svcPrice, { color: colors.text, borderColor: colors.border }]}
            />
          </View>
        ))}
        <Pressable onPress={addService} style={styles.addSvc}>
          <Text style={[styles.addSvcText, { color: colors.textSecondary }]}>
            {he ? '+ הוסף/י שירות' : '+ Add a service'}
          </Text>
        </Pressable>

        {/* Hours preview */}
        {label(he ? 'שעות פעילות' : 'Hours')}
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.hoursText, { color: colors.text }, rtlText(lang)]}>
            {hoursPreview(draft.hours)}
          </Text>
        </View>

        {failed && (
          <Text style={[styles.failed, rtlText(lang)]}>
            {he
              ? 'לא הצלחתי לשמור. בדוק/י חיבור ונסה/י שוב.'
              : "Couldn't save — check your connection and try again."}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={!canCreate}
          style={[styles.createBtn, { backgroundColor: colors.circle, opacity: canCreate ? 1 : 0.35 }]}
        >
          <Text style={[styles.createText, { color: colors.background }]}>
            {busy
              ? he
                ? 'יוצר…'
                : 'Creating…'
              : he
                ? 'צור/צרי עסק ONE'
                : 'Create business ONE'}
          </Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800', flex: 1 },
  closeX: { fontSize: 20 },
  h4: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 68,
    fontSize: 14.5,
    textAlignVertical: 'top',
  },
  fillBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  fillText: { fontSize: 14.5, fontWeight: '700' },
  nameRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  emojiInput: {
    width: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    fontSize: 24,
    textAlign: 'center',
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  svcRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  svcName: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  svcPrice: {
    width: 84,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    textAlign: 'center',
  },
  addSvc: { paddingVertical: 8 },
  addSvcText: { fontSize: 14, fontWeight: '600' },
  card: { borderRadius: 14, padding: 14 },
  hoursText: { fontSize: 13.5, lineHeight: 21 },
  failed: { color: '#c0392b', fontSize: 13.5, marginTop: 14 },
  createBtn: {
    marginTop: 22,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  createText: { fontSize: 16, fontWeight: '700' },
});
