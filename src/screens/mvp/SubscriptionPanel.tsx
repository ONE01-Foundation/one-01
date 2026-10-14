/**
 * SubscriptionPanel — ONE's paid plans (Pro / Max), as a focused upgrade sheet
 * in the "Get ONE Pro / Max" style: a centred plan icon, a big title, a two-way
 * segmented toggle, the plan's feature list (no Free comparison column) and one
 * big "Upgrade for ₪X" pill.
 *
 * Interactions:
 *  • SWIPE sideways (or tap the toggle) to switch between the two plans.
 *  • DRAG the sheet DOWN to dismiss — the sheet follows your finger physically
 *    (like the ONE profile sheet) and either flings closed or springs back.
 *
 * It renders into a host sheet's `overlay` slot (screen-pinned), so it opens
 * instantly over the profile/settings sheet without closing it first.
 *
 * We're in Israel and NOT wiring Stripe yet, so choosing a tier is a local
 * (mock) `setPlan` flip. The real IL billing slots in behind the same call.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { useMvpStore } from '../../stores/mvpStore';
import type { PlanTier } from '../../stores/mvpStore';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { CloseIcon } from '../../components/mvp/icons';

interface SubscriptionPanelProps {
  visible: boolean;
  onClose: () => void;
  /** Optional contextual line shown under the title — set when the panel is
   *  opened from a gated action ("You've reached the free limit of 2 profiles"). */
  reason?: string;
}

type PaidTier = Extract<PlanTier, 'pro' | 'max'>;

interface PlanDef {
  id: PaidTier;
  name: string;
  /** Monthly price, in ILS (₪) — we bill in Israel. */
  price: string;
  tagline: { he: string; en: string };
  features: { he: string; en: string }[];
}

// The two paid options (no Free — this sheet is purely the upgrade choice).
const PLANS: PlanDef[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '₪29',
    tagline: { he: 'ל‑ONE שמלווה אותך בכל תהליך.', en: 'A ONE that carries every process.' },
    features: [
      { he: 'תהליכים ומרחבים ללא הגבלה', en: 'Unlimited processes & spaces' },
      { he: 'ONE חכם יותר (מודל מתקדם)', en: 'A smarter ONE (advanced model)' },
      { he: 'חיבור כל החשבונות והמקורות', en: 'Connect all accounts & sources' },
      { he: 'תזכורות ואוטומציות', en: 'Reminders & automations' },
      { he: 'זיכרון מורחב', en: 'Expanded memory' },
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
      { he: 'זיכרון מורחב לאורך זמן', en: 'Long, expanded memory' },
    ],
  },
];

const ACCENT = '#3B82F6';
// How far down you must drag (or how fast you must fling) to dismiss.
const DISMISS_DISTANCE = 130;
const DISMISS_VELOCITY = 950;

function PlanIcon({ tier }: { tier: PaidTier }) {
  // Pro → a filled accent diamond with a spark; Max → a brighter sparkle cluster.
  if (tier === 'max') {
    return (
      <View style={styles.iconWrap}>
        <Text style={[styles.sparkBig, { color: ACCENT }]}>✦</Text>
        <Text style={[styles.sparkSmall, { color: ACCENT }]}>✦</Text>
      </View>
    );
  }
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconDiamond, { backgroundColor: ACCENT }]} />
      <Text style={styles.iconDiamondSpark}>✦</Text>
    </View>
  );
}

export function SubscriptionPanel({ visible, onClose, reason }: SubscriptionPanelProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();
  const plan = useMvpStore((s) => s.plan);
  const setPlan = useMvpStore((s) => s.setPlan);

  // Which plan the sheet is showing (0 = Pro, 1 = Max).
  const [index, setIndex] = useState(0);
  const active = PLANS[index];
  const isCurrent = plan === active.id;

  // Entrance + drag.
  const sv = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const axisLock = useSharedValue(0); // 0 none, 1 vertical, 2 horizontal
  const contentFade = useSharedValue(1);
  // The panel's own measured height — the hidden pose translates it DOWN by
  // exactly this, so it sits fully OFF-SCREEN (below the frame) at rest instead
  // of peeking above the bottom edge when a host sheet (profile/settings) or the
  // app first renders it. Starts large so it's hidden before the first layout.
  const panelH = useSharedValue(900);

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      dragX.value = 0;
      setIndex((i) => i); // keep selection across reopens
    }
    sv.value = withTiming(visible ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [visible, sv, dragY, dragX]);

  // Crossfade the plan "page" when it switches (swipe or toggle tap).
  useEffect(() => {
    contentFade.value = 0.25;
    contentFade.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [index, contentFade]);

  const switchTo = (next: number) => {
    const clamped = Math.max(0, Math.min(PLANS.length - 1, next));
    if (clamped === index) return;
    haptic.select();
    setIndex(clamped);
  };

  const closeNow = () => {
    onClose();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      axisLock.value = 0;
    })
    .onUpdate((e) => {
      if (axisLock.value === 0) {
        if (Math.abs(e.translationY) > 8 || Math.abs(e.translationX) > 8) {
          axisLock.value = Math.abs(e.translationY) >= Math.abs(e.translationX) ? 1 : 2;
        }
      }
      if (axisLock.value === 1) {
        // Downward dismiss drag only (resist upward).
        dragY.value = Math.max(0, e.translationY);
      } else if (axisLock.value === 2) {
        dragX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (axisLock.value === 1) {
        if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
          // Fling the rest of the way down, THEN unmount — one continuous motion.
          dragY.value = withTiming(900, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
            if (done) runOnJS(closeNow)();
          });
        } else {
          dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
        }
      } else if (axisLock.value === 2) {
        // LTR: swipe left → next plan. In RTL (Hebrew) the axis is mirrored, so
        // flip it — swiping toward the incoming tab moves to that tab either way.
        let dir = e.translationX <= -50 ? 1 : e.translationX >= 50 ? -1 : 0;
        if (he) dir = -dir;
        if (dir !== 0) runOnJS(switchTo)(index + dir);
        dragX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
      axisLock.value = 0;
    });

  const scrimStyle = useAnimatedStyle(() => {
    const dragFade = 1 - interpolate(dragY.value, [0, 420], [0, 1], Extrapolation.CLAMP);
    return { opacity: sv.value * 0.55 * dragFade };
  });
  const panelStyle = useAnimatedStyle(() => ({
    // Hidden = translated fully below the screen by its own height PLUS a buffer,
    // so the rounded top + handle never peek above the fold (seen on some mobile
    // browsers where the measured height / safe-area is a touch short).
    transform: [{ translateY: (1 - sv.value) * (panelH.value + 80) + dragY.value }],
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value,
    transform: [{ translateX: dragX.value * 0.5 }],
  }));

  const choose = () => {
    if (isCurrent) return;
    haptic.success();
    setPlan(active.id); // mock upgrade (no Stripe in IL yet)
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap outside to dismiss. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={he ? 'סגור' : 'Close'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]} pointerEvents="none" />
      </Pressable>

      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(e) => {
            panelH.value = e.nativeEvent.layout.height;
          }}
          style={[
            styles.panel,
            { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) + 10 },
            panelStyle,
          ]}
        >
          {/* Physical drag handle. */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Close (X) — same size as the Global sheet's X; on the LEADING side
              (left in Hebrew / RTL, right in English) with the same gap from the
              top as from the side. */}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn, he ? { left: 20 } : { right: 20 }, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={he ? 'סגור' : 'Close'}
          >
            <CloseIcon size={22} color={colors.text} />
          </Pressable>

          {/* The swipeable plan "page" (icon + title + subtitle + features). */}
          <Animated.View style={[styles.page, pageStyle]}>
            <PlanIcon tier={active.id} />
            <Text style={[styles.title, { color: colors.text }]}>
              {he ? `קבלו ONE ${active.name}` : `Get ONE ${active.name}`}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {he ? active.tagline.he : active.tagline.en}
            </Text>

            {/* Contextual reason when opened from a gated action. */}
            {!!reason && (
              <View style={[styles.reasonPill, { backgroundColor: colors.surface }]}>
                <Text style={styles.reasonStar}>✦</Text>
                <Text style={[styles.reasonText, { color: colors.text }, rtlText(lang)]}>{reason}</Text>
              </View>
            )}
          </Animated.View>

          {/* Two-option segmented toggle (also switchable by swiping the page). */}
          <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
            {PLANS.map((p, i) => {
              const on = i === index;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => switchTo(i)}
                  style={[styles.toggleSeg, on && { backgroundColor: colors.background }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.toggleText, { color: on ? colors.text : colors.textSecondary }]}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Feature list for the selected plan — no Free column, just what you get. */}
          <Animated.View style={[styles.featureBox, { borderColor: colors.border }, pageStyle]}>
            {active.features.map((f, i) => (
              <View
                key={i}
                style={[
                  styles.featureRow,
                  rtlRow(lang),
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <Text style={[styles.featureText, { color: colors.text }, rtlText(lang)]}>
                  {he ? f.he : f.en}
                </Text>
                <Text style={[styles.featureCheck, { color: ACCENT }]}>✓</Text>
              </View>
            ))}
          </Animated.View>

          {/* Big "Upgrade for ₪X" pill — sized like the home box. */}
          <Pressable
            onPress={choose}
            disabled={isCurrent}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: isCurrent ? colors.surface : colors.text, opacity: pressed && !isCurrent ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.ctaText, { color: isCurrent ? colors.textSecondary : colors.background }]}>
              {isCurrent
                ? he ? 'התוכנית הנוכחית שלך' : 'Your current plan'
                : he ? `שדרגו תמורת ${active.price}` : `Upgrade for ${active.price}`}
            </Text>
          </Pressable>

          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            {he
              ? 'מתחדש מדי חודש. אפשר לבטל בכל רגע. התשלום בישראל ייפתח בקרוב.'
              : 'Auto-renews monthly. Cancel anytime. Billing in Israel is coming soon.'}
          </Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 22,
    zIndex: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
    marginBottom: 6,
  },
  // Matches the Global sheet's X (pillBtn): 44×44 surface pill with a soft
  // shadow. Leading side (left/right) is set inline per language; the top gap
  // matches the side gap (20) so it's inset symmetrically from the corner.
  closeBtn: {
    position: 'absolute',
    top: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  page: {
    alignItems: 'center',
    width: '100%',
    // Cap + centre the content on wide (web/desktop) viewports so it doesn't
    // stretch edge-to-edge even though the sheet itself is full-width.
    maxWidth: 560,
    alignSelf: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  iconDiamond: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 15,
    transform: [{ rotate: '45deg' }],
  },
  iconDiamondSpark: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  sparkBig: { fontSize: 40, fontWeight: '800' },
  sparkSmall: { position: 'absolute', top: 6, right: 8, fontSize: 20, fontWeight: '800' },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 13,
    marginTop: 12,
  },
  reasonStar: { fontSize: 13, color: '#FBBF24' },
  reasonText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  toggle: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    marginTop: 22,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  toggleSeg: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 16, fontWeight: '700' },
  featureBox: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  featureText: { fontSize: 16, fontWeight: '600', flex: 1 },
  featureCheck: { fontSize: 18, fontWeight: '800', marginHorizontal: 8 },
  // Big pill — matches the prominence of the home composer box.
  cta: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  ctaText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  fineprint: {
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});
