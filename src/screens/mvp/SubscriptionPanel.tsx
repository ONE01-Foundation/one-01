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
import { CloseIcon } from '../../components/mvp/icons';
import { EdgeBars } from '../../components/mvp/EdgeBars';

interface SubscriptionPanelProps {
  visible: boolean;
  onClose: () => void;
  /** Optional contextual line shown at the top — set when the panel is opened
   *  from a gated action ("You've reached the free limit of 2 profiles"). */
  reason?: string;
}

type Tier = 'free' | 'pro' | 'max';

interface TierDef {
  id: Tier;
  name: string;
  /** Monthly price, in ILS (₪) — we bill in Israel. */
  price: string;
  /** Highlighted card (the one we nudge toward) gets the filled black CTA. */
  featured?: boolean;
  tagline: { he: string; en: string };
  features: { he: string; en: string }[];
}

const TIERS: TierDef[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₪0',
    tagline: { he: 'הכר את ONE וגלה מה הוא יכול — בחינם.', en: 'Get to know ONE and what it can do — free.' },
    features: [
      { he: 'עד 2 מרחבים', en: 'Up to 2 spaces' },
      { he: 'תהליכים וצ׳אט עם ONE', en: 'Processes & chat with ONE' },
      { he: 'מקור מחובר אחד', en: 'One connected source' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₪29',
    featured: true,
    tagline: { he: 'ל‑ONE שמלווה אותך בכל תהליך.', en: 'For a ONE that carries every process.' },
    features: [
      { he: 'תהליכים ומרחבים ללא הגבלה', en: 'Unlimited processes & spaces' },
      { he: 'ONE חכם יותר (מודל מתקדם)', en: 'A smarter ONE (advanced model)' },
      { he: 'חיבור כל החשבונות והמקורות', en: 'Connect all your accounts & sources' },
      { he: 'תזכורות ואוטומציות', en: 'Reminders & automations' },
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '₪69',
    tagline: { he: 'ONE שיוזם ופועל בשמך.', en: 'A ONE that acts on your behalf.' },
    features: [
      { he: 'כל מה שב‑Pro', en: 'Everything in Pro' },
      { he: 'ONE יוזם ופועל בשבילך', en: 'ONE takes initiative for you' },
      { he: 'עדיפות מקסימלית + תמיכה אישית', en: 'Top priority + personal support' },
      { he: 'גישה מוקדמת ליכולות חדשות', en: 'Early access to new abilities' },
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

  const choose = (tier: Tier) => {
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
        {/* Close (X) — same round button as the ONE profile. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'סגור' : 'Close'}
        >
          <CloseIcon size={18} color={colors.text} />
        </Pressable>

        {/* One header sentence — no separate title + subtitle. */}
        <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
          {he ? 'התחל חינם, וגדל בקצב שלך.' : 'Start free, and scale as you grow.'}
        </Text>

        {/* Contextual reason when opened from a gated action. */}
        {!!reason && (
          <View style={[styles.reasonPill, { backgroundColor: colors.surface }]}>
            <Text style={styles.reasonStar}>✦</Text>
            <Text style={[styles.reasonText, { color: colors.text }, rtlText(lang)]}>{reason}</Text>
          </View>
        )}

        {/* Scroll region with soft top + bottom fades (like the processes list),
            and overscroll-past-the-content to dismiss. */}
        <View style={styles.scrollArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          alwaysBounceVertical
          onScrollEndDrag={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const overBottom = contentOffset.y - (contentSize.height - layoutMeasurement.height);
            // Pulled down past the top, or dragged up past the bottom → close.
            if (contentOffset.y < -70 || overBottom > 70) onClose();
          }}
        >
          {TIERS.map((tier) => {
            const current = plan === tier.id;
            // Black filled CTA for the plan we nudge toward + any real upgrade;
            // an outline "current plan" pill for the one you're on.
            const filled = !current && tier.featured;
            return (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  { backgroundColor: colors.surface, borderColor: current ? colors.text : colors.border },
                  current && { borderWidth: 1.5 },
                ]}
              >
                <Text style={[styles.tierName, { color: colors.text }, rtlText(lang)]}>{tier.name}</Text>
                <View style={[styles.priceRow, rtlRow(lang)]}>
                  <Text style={[styles.price, { color: colors.text }]}>{tier.price}</Text>
                  <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>
                    {he ? '/ לחודש' : '/ month'}
                  </Text>
                </View>

                <Text style={[styles.tagline, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? tier.tagline.he : tier.tagline.en}
                </Text>

                <View style={styles.featureList}>
                  {tier.features.map((f, i) => (
                    <View key={i} style={[styles.featureRow, rtlRow(lang)]}>
                      <Text style={[styles.featureCheck, { color: colors.textSecondary }]}>✓</Text>
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
                      ? { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 }
                      : filled
                        ? { backgroundColor: colors.text }
                        : { backgroundColor: colors.background, borderColor: colors.text, borderWidth: 1 },
                    { opacity: pressed && !current ? 0.85 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chooseBtnText,
                      { color: current ? colors.textSecondary : filled ? colors.background : colors.text },
                    ]}
                  >
                    {current
                      ? he ? 'התוכנית הנוכחית שלך' : 'Your current plan'
                      : tier.id === 'free'
                        ? he ? 'חזרה ל‑Free' : 'Switch to Free'
                        : he ? `שדרג ל‑${tier.name}` : `Upgrade to ${tier.name}`}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {/* Billing isn't wired yet (no Stripe in Israel). Keep it honest. */}
          <Text style={[styles.billingNote, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'התשלום בישראל ייפתח בקרוב — בינתיים השדרוג נשמר במכשיר.'
              : 'Billing in Israel is coming soon — for now the upgrade is saved on-device.'}
          </Text>
        </ScrollView>
        {/* Soft fades so content dissolves at the edges instead of a hard cut. */}
        <EdgeBars topLinear topHeight={40} bottomHeight={64} />
        </View>
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
    // Fixed height so the scroll area (flex:1 below) is bounded and the fades
    // can overlay its edges.
    height: '86%',
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
  // Round X in the top corner (leading side), matching the ONE profile.
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Bounded, relative container so the ScrollView scrolls and EdgeBars can
  // overlay its top + bottom edges.
  scrollArea: { flex: 1, position: 'relative' },
  title: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 6,
    marginBottom: 12,
    // Clear the X in the corner.
    paddingHorizontal: 4,
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
    paddingTop: 10,
    // Clears the bottom fade so the last card + note aren't hidden under it.
    paddingBottom: 72,
  },
  tierCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  price: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 7,
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
  billingNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginTop: 2,
  },
});
