/**
 * SubscriptionPanel — ONE's plans (Pro / Max), as an INLINE slide-up panel.
 *
 * It renders into a sheet's `overlay` slot (screen-pinned), the same pattern as
 * UnitQuickActionsPanel: a full-screen scrim + a panel that slides up OVER the
 * host sheet. This is why it opens instantly and doesn't close the profile
 * first (the old Modal version had to close one sheet before presenting the
 * next — slow, and it dismissed the profile).
 *
 * We're in Israel and NOT wiring Stripe yet, so choosing a tier is a local
 * (mock) `setPlan` flip. The real IL billing slots in behind the same call.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { useMvpStore } from '../../stores/mvpStore';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

interface SubscriptionPanelProps {
  visible: boolean;
  onClose: () => void;
  /** Optional contextual line shown at the top — set when the panel is opened
   *  from a gated action ("You've reached the free limit of 2 profiles"). */
  reason?: string;
}

type PaidTier = 'pro' | 'max';

interface TierDef {
  id: PaidTier;
  name: string;
  /** Monthly price, in ILS (₪) — we bill in Israel. */
  price: string;
  accent: string;
  tagline: { he: string; en: string };
  features: { he: string; en: string }[];
}

const TIERS: TierDef[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '₪29',
    accent: '#3B82F6',
    tagline: { he: 'ל‑ONE שמלווה אותך בכל תהליך.', en: 'For a ONE that carries every process.' },
    features: [
      { he: 'תהליכים ללא הגבלה', en: 'Unlimited processes' },
      { he: 'ONE חכם יותר (מודל מתקדם)', en: 'A smarter ONE (advanced model)' },
      { he: 'חיבור חשבונות ומקורות', en: 'Connect accounts & sources' },
      { he: 'תזכורות ואוטומציות', en: 'Reminders & automations' },
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '₪69',
    accent: '#8B5CF6',
    tagline: { he: 'ONE שיוזם ופועל בשמך.', en: 'A ONE that acts on your behalf.' },
    features: [
      { he: 'כל מה שב‑Pro', en: 'Everything in Pro' },
      { he: 'ריבוי פרופילים ללא הגבלה', en: 'Unlimited profiles' },
      { he: 'ONE יוזם ופועל בשבילך', en: 'ONE takes initiative for you' },
      { he: 'עדיפות מקסימלית + תמיכה אישית', en: 'Top priority + personal support' },
    ],
  },
];

export function SubscriptionPanel({ visible, onClose, reason }: SubscriptionPanelProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();
  const plan = useMvpStore((s) => s.plan);
  const setPlan = useMvpStore((s) => s.setPlan);

  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(visible ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [visible, sv]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: sv.value * 0.55 }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateY: (1 - sv.value) * 420 }],
  }));

  const choose = (tier: PaidTier) => {
    haptic.success();
    // Mock upgrade (no Stripe in IL yet) — flips the local/persisted plan.
    setPlan(tier);
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap outside the panel to dismiss. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={he ? 'סגור' : 'Close'}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}
          pointerEvents="none"
        />
      </Pressable>

      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) + 8 },
          panelStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
          {he ? 'שדרג את ONE' : 'Upgrade ONE'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }, rtlText(lang)]}>
          {he
            ? 'תן ל‑ONE יותר כוח להפוך כוונות למציאות.'
            : 'Give ONE more power to turn intentions into reality.'}
        </Text>

        {/* Contextual reason when opened from a gated action. */}
        {!!reason && (
          <View style={[styles.reasonPill, { backgroundColor: colors.surface }]}>
            <Text style={styles.reasonStar}>✦</Text>
            <Text style={[styles.reasonText, { color: colors.text }, rtlText(lang)]}>{reason}</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {TIERS.map((tier) => {
            const current = plan === tier.id;
            return (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  { backgroundColor: colors.surface, borderColor: current ? tier.accent : colors.border },
                  current && { borderWidth: 2 },
                ]}
              >
                <View style={[styles.tierHead, rtlRow(lang)]}>
                  <View style={[styles.tierNameRow, rtlRow(lang)]}>
                    <View style={[styles.tierDot, { backgroundColor: tier.accent }]} />
                    <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
                  </View>
                  <View style={[styles.priceRow, rtlRow(lang)]}>
                    <Text style={[styles.price, { color: colors.text }]}>{tier.price}</Text>
                    <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>
                      {he ? '/ חודש' : '/ mo'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.tagline, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? tier.tagline.he : tier.tagline.en}
                </Text>

                <View style={styles.featureList}>
                  {tier.features.map((f, i) => (
                    <View key={i} style={[styles.featureRow, rtlRow(lang)]}>
                      <Text style={[styles.featureCheck, { color: tier.accent }]}>✓</Text>
                      <Text style={[styles.featureText, { color: colors.text }, rtlText(lang)]}>
                        {he ? f.he : f.en}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => (current ? undefined : choose(tier.id))}
                  disabled={current}
                  style={({ pressed }) => [
                    styles.chooseBtn,
                    current
                      ? { backgroundColor: colors.background, borderColor: tier.accent, borderWidth: 1 }
                      : { backgroundColor: tier.accent },
                    { opacity: pressed && !current ? 0.9 : 1 },
                  ]}
                >
                  <Text style={[styles.chooseBtnText, { color: current ? tier.accent : '#FFFFFF' }]}>
                    {current
                      ? he ? 'התוכנית הנוכחית שלך' : 'Your current plan'
                      : he ? `בחר ${tier.name}` : `Choose ${tier.name}`}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {/* Downgrade back to free — only on a paid tier. */}
          {plan !== 'free' && (
            <Pressable
              onPress={() => { haptic.select(); setPlan('free'); onClose(); }}
              style={styles.downgradeLink}
            >
              <Text style={[styles.downgradeText, { color: colors.textSecondary }]}>
                {he ? 'חזרה לתוכנית החינמית' : 'Back to the free plan'}
              </Text>
            </Pressable>
          )}

          {/* Billing isn't wired yet (no Stripe in Israel). Keep it honest. */}
          <Text style={[styles.billingNote, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'התשלום בישראל ייפתח בקרוב — בינתיים השדרוג נשמר במכשיר.'
              : 'Billing in Israel is coming soon — for now the upgrade is saved on-device.'}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '86%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 18,
    zIndex: 40,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 6,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  reasonStar: {
    fontSize: 13,
    color: '#FBBF24',
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  scrollContent: {
    gap: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tierCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureList: {
    gap: 8,
    marginTop: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    fontSize: 15,
    fontWeight: '800',
    width: 16,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  chooseBtn: {
    marginTop: 6,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  downgradeLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  downgradeText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  billingNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginTop: 2,
  },
});
