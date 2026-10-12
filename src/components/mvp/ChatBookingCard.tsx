/**
 * ChatBookingCard — a TOOL widget ONE deploys in the thread: pick a time with a
 * provider. Reads its run live from the store (survives reloads), lets the user
 * select one of ONE's offered slots and confirm. On confirm the appointment
 * flows back onto the process as a timeline entry (so it shows in Activity).
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

const GOOD = '#1CA06B';

export function ChatBookingCard({ runId }: { runId: string }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const run = useMvpStore((s) => s.bookingRuns[runId]);
  const selectBookingSlot = useMvpStore((s) => s.selectBookingSlot);
  const confirmBooking = useMvpStore((s) => s.confirmBooking);
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const wroteRef = useRef(false);

  // When confirmed, log the appointment onto the process once (shows in Activity).
  useEffect(() => {
    if (!run?.confirmedAt || wroteRef.current) return;
    wroteRef.current = true;
    if (!run.unitId) return;
    const unit = useMvpStore.getState().units.find((u) => u.id === run.unitId);
    if (!unit) return;
    const slot = run.slots.find((s) => s.id === run.selectedSlotId);
    const nowIso = new Date().toISOString();
    const title = he
      ? `תור נקבע${run.provider ? ` עם ${run.provider}` : ''}`
      : `Appointment booked${run.provider ? ` with ${run.provider}` : ''}`;
    updateUnit(unit.id, {
      timeline: [
        ...(unit.timeline ?? []),
        { id: `tl_bk_${Date.now()}`, title, subtitle: slot?.label, date: nowIso, kind: 'event' },
      ],
      unreadUpdates: (unit.unreadUpdates ?? 0) + 1,
      lastUpdatedAt: nowIso,
      updatedAt: nowIso,
    });

    // Represent the user OUTWARD: when there's a provider, ONE drafts the
    // confirmation message to them (never sends it) so the booking actually
    // reaches the other side. The draft lands in the process's Drafts section
    // with the selective-disclosure strip (ONE attaches only what you allow).
    if (run.provider && slot) {
      const body = he
        ? `היי ${run.provider}, קבעתי איתך תור ל${slot.label}. נתראה! 🙏`
        : `Hi ${run.provider}, I've booked a slot for ${slot.label}. See you then! 🙏`;
      useMvpStore.getState().addDraft(
        unit.id,
        {
          id: `dr_bk_${Date.now()}`,
          channel: 'whatsapp',
          to: run.provider,
          body,
          status: 'draft',
          createdAt: nowIso,
        },
        he ? 'he' : 'en',
      );
    }
  }, [run?.confirmedAt, run?.unitId, run?.selectedSlotId, updateUnit, he, run]);

  if (!run) return null;

  const confirmed = !!run.confirmedAt;
  const chosen = run.slots.find((s) => s.id === run.selectedSlotId);

  // ── CONFIRMED ──
  if (confirmed) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.accent, { backgroundColor: GOOD }]} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>📅 {run.title}</Text>
          <Text style={[styles.confirmBig, { color: GOOD }, rtlText(lang)]}>
            {he ? `✓ נקבע: ${chosen?.label ?? ''}` : `✓ Booked: ${chosen?.label ?? ''}`}
          </Text>
          <Text style={[styles.confirmSub, { color: colors.textSecondary }, rtlText(lang)]}>
            {run.provider
              ? he
                ? `עם ${run.provider} · ניסחתי אישור לשליחה (בטיוטות).`
                : `With ${run.provider} · drafted a confirmation to send (in Drafts).`
              : he ? 'נוסף לתהליך.' : 'Added to the process.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── PICK A SLOT ──
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
          📅 {run.title}
          {run.provider ? <Text style={{ color: colors.textSecondary }}>{`  ·  ${run.provider}`}</Text> : null}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }, rtlText(lang)]}>
          {he ? 'בחר שעה שמתאימה לך:' : 'Pick a time that works for you:'}
        </Text>

        <View style={[styles.slotWrap, { direction: he ? 'rtl' : 'ltr' }]}>
          {run.slots.map((s) => {
            const on = s.id === run.selectedSlotId;
            return (
              <Pressable
                key={s.id}
                onPress={() => { haptic.select(); selectBookingSlot(runId, s.id); }}
                style={[
                  styles.slot,
                  { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? withTint(colors.primary) : colors.background },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.slotText, { color: on ? colors.primary : colors.text }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {chosen && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Pressable
              onPress={() => { haptic.tap(); confirmBooking(runId); }}
              style={[styles.confirmBtn, { backgroundColor: colors.text }]}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmBtnText, { color: colors.surface }]}>
                {he ? `אשר — ${chosen.label}` : `Confirm — ${chosen.label}`}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/** A faint tint of a colour for the selected-slot fill. */
function withTint(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return 'rgba(0,0,0,0.06)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
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
  sub: { fontSize: 13, lineHeight: 18 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  slotText: { fontSize: 13.5, fontWeight: '700' },
  confirmBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700' },
  confirmBig: { fontSize: 19, fontWeight: '800' },
  confirmSub: { fontSize: 13.5, lineHeight: 18 },
});
