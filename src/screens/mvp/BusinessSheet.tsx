/**
 * BusinessSheet — a business's own ONE, on mobile. Mirrors the web business
 * profile: hours, services (tap to choose), and open slots you can book. Booking
 * a slot hands back to the caller, which creates the appointment as a process.
 *
 * Deliberately simple + crash-defensive (single snap, plain ScrollView, no
 * scroll-to-expand bridge, opened from Home — never stacked inside another
 * sheet) because the app's past sheet crashes were all in those areas.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlRow, rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import type { DirectoryBusiness } from '../../utils/businessDirectory';
import {
  myBusinessKey,
  followSet,
  isFollowing,
  fetchFollowers,
  fetchCustomers,
  createBooking,
  type CloudFollower,
  type CloudCustomer,
} from '../../services/cloudBusiness';

const SNAP = ['88%'];

export function BusinessSheet({
  visible,
  biz,
  onClose,
  onBook,
  identityName,
}: {
  visible: boolean;
  biz: DirectoryBusiness | null;
  onClose: () => void;
  /** Called with a natural-language booking request the home ONE will run. */
  onBook: (bookingPhrase: string) => void;
  /** Current user's display name — used to follow + to name the booking. */
  identityName?: string;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const [service, setService] = useState<string | null>(null);

  // Cloud (Supabase-backed) state, only meaningful when biz.cloudId is set.
  const isCloud = !!biz?.cloudId;
  const [isOwner, setIsOwner] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<CloudFollower[]>([]);
  const [customers, setCustomers] = useState<CloudCustomer[]>([]);
  const [followBusy, setFollowBusy] = useState(false);

  // On open: reset the chosen service and, for a cloud business, load whether
  // I own it (→ dashboard) or follow it (→ Follow button).
  useEffect(() => {
    setService(null);
    setIsOwner(false);
    setFollowing(false);
    setFollowers([]);
    setCustomers([]);
    const cloudId = biz?.cloudId;
    if (!visible || !cloudId) return;
    let cancelled = false;
    (async () => {
      const mine = await myBusinessKey();
      const owner = !!biz?.ownerKey && mine === biz.ownerKey;
      if (cancelled) return;
      setIsOwner(owner);
      if (owner) {
        const [f, cust] = await Promise.all([
          fetchFollowers(cloudId),
          fetchCustomers(cloudId),
        ]);
        if (!cancelled) {
          setFollowers(f);
          setCustomers(cust);
        }
      } else {
        const on = await isFollowing(cloudId);
        if (!cancelled) setFollowing(on);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, biz?.id, biz?.cloudId, biz?.ownerKey]);

  const toggleFollow = async () => {
    const cloudId = biz?.cloudId;
    if (!cloudId || followBusy) return;
    haptic.tap();
    setFollowBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    const ok = await followSet(cloudId, next, identityName ?? 'Someone');
    if (!ok) setFollowing(!next); // revert on failure
    setFollowBusy(false);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={SNAP} initialSnap={0} backdropOpacity={0.3}>
      {biz && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.headRow, rtlRow(lang)]}>
            <Text style={styles.emoji}>{biz.emoji}</Text>
            <View style={styles.flex1}>
              <Text style={[styles.name, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
                {biz.name[lang]}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                {biz.category[lang]}
              </Text>
            </View>
          </View>

          {/* Follow (visitor) — only for cloud businesses I don't own. */}
          {isCloud && !isOwner && (
            <Pressable
              onPress={toggleFollow}
              style={[
                styles.followBtn,
                {
                  backgroundColor: following ? colors.background : colors.text,
                  borderColor: colors.text,
                },
              ]}
            >
              <Text
                style={[
                  styles.followText,
                  { color: following ? colors.text : colors.background },
                ]}
              >
                {following
                  ? he
                    ? '✓ עוקב/ת'
                    : '✓ Following'
                  : he
                    ? '+ עקוב/י אחרי הוואן הזה'
                    : '+ Follow this ONE'}
              </Text>
            </Pressable>
          )}

          {/* Owner dashboard — followers + customer cards. */}
          {isCloud && isOwner && (
            <>
              <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? `עוקבים · ${followers.length}` : `Followers · ${followers.length}`}
              </Text>
              {followers.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? 'עדיין אין עוקבים.' : 'No followers yet.'}
                </Text>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.background }]}>
                  {followers.map((f) => (
                    <Text
                      key={f.follower_key}
                      style={[styles.rowText, { color: colors.text }, rtlText(lang)]}
                      numberOfLines={1}
                    >
                      {f.follower_name}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? `לקוחות · ${customers.length}` : `Customers · ${customers.length}`}
              </Text>
              {customers.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? 'עדיין אין תורים.' : 'No bookings yet.'}
                </Text>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.background }]}>
                  {customers.map((cust, i) => (
                    <View
                      key={`${cust.customer_name}_${i}`}
                      style={[styles.custRow, rtlRow(lang)]}
                    >
                      <Text
                        style={[styles.custName, { color: colors.text }, rtlText(lang)]}
                        numberOfLines={1}
                      >
                        {cust.customer_name}
                      </Text>
                      <Text style={[styles.custMeta, { color: colors.textSecondary }]}>
                        {he
                          ? `${cust.visits} ביקורים${cust.last_slot ? ` · ${cust.last_slot}` : ''}`
                          : `${cust.visits} visit${cust.visits === 1 ? '' : 's'}${cust.last_slot ? ` · ${cust.last_slot}` : ''}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Hours */}
          <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'שעות פעילות' : 'Hours'}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <Text style={[styles.hours, { color: colors.text }, rtlText(lang)]}>{biz.hoursText[lang]}</Text>
          </View>

          {/* Services — tap to choose */}
          <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'שירותים — בחר/י' : 'Services — tap to choose'}
          </Text>
          {biz.services.map((s) => {
            const active = service === s.label[lang];
            return (
              <Pressable
                key={s.label.en}
                onPress={() => {
                  haptic.select();
                  setService((cur) => (cur === s.label[lang] ? null : s.label[lang]));
                }}
                style={[
                  styles.serviceRow,
                  rtlRow(lang),
                  { backgroundColor: active ? colors.surface : colors.background, borderColor: active ? colors.text : 'transparent' },
                ]}
              >
                <Text style={[styles.serviceName, { color: colors.text }, rtlText(lang)]}>
                  {active ? '✓ ' : ''}
                  {s.label[lang]}
                </Text>
                <Text style={[styles.servicePrice, { color: colors.textSecondary }]}>{s.price}</Text>
              </Pressable>
            );
          })}

          {/* Book a time */}
          <Text style={[styles.h4, { color: colors.textSecondary }, rtlText(lang)]}>
            {service ? (he ? `קביעת ${service} — בחר/י זמן` : `Book ${service} — pick a time`) : he ? 'קביעת תור' : 'Book a time'}
          </Text>
          <View style={[styles.slotWrap, rtlRow(lang)]}>
            {biz.slots.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => {
                  haptic.tap();
                  const svc = service ? `${service} ` : '';
                  const phrase = he
                    ? `תקבע לי ${svc}תור ב${biz.name.he} ב${slot}`
                    : `Book ${svc}at ${biz.name.en} ${slot}`;
                  // Cloud businesses: also record the booking so the owner gets
                  // a customer card. Fire-and-forget; the process is created
                  // locally by onBook either way.
                  if (biz.cloudId) {
                    void createBooking(
                      biz.cloudId,
                      identityName ?? 'A customer',
                      service ?? undefined,
                      slot,
                    );
                  }
                  onBook(phrase);
                }}
                style={[styles.slot, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.slotText, { color: colors.text }]}>{slot}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  flex1: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  emoji: { fontSize: 34 },
  name: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 13.5, marginTop: 2 },
  h4: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  card: { borderRadius: 14, padding: 14 },
  hours: { fontSize: 14, lineHeight: 21 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  serviceName: { fontSize: 15, fontWeight: '600' },
  servicePrice: { fontSize: 13.5, fontWeight: '600' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1 },
  slotText: { fontSize: 13.5, fontWeight: '600' },
  followBtn: {
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 2,
  },
  followText: { fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13.5, marginBottom: 4 },
  rowText: { fontSize: 14, fontWeight: '600', paddingVertical: 5 },
  custRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
  },
  custName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  custMeta: { fontSize: 12.5, fontWeight: '500' },
});
