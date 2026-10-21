/**
 * OnboardingOverlay — a first-run (and post-update) intro where ONE introduces
 * ITSELF. A clean, full-screen, theme-coloured surface (not a dark scrim): the
 * living ONE figure centred, and ONE speaking in the FIRST PERSON across a few
 * lines — who it is, what it does, how — advanced by "Next" (or a sideways
 * swipe), with "Skip" below. The figure stays put while its lines change, so it
 * reads as ONE actually talking to you. Dismissing records the current
 * ONBOARDING_CARDS_VERSION so it re-appears only when that version is bumped.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Orb } from '../../components/mvp/Orb';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MAX_W = Math.min(SCREEN_W, 460);

/** Bump when a new feature warrants re-showing the onboarding cards. */
export const ONBOARDING_CARDS_VERSION = 2;

interface Line {
  /** The name token is rendered in full ink; the rest is the lead-in. */
  lead: { he: string; en: string };
  body: { he: string; en: string };
}

/** ONE speaking, first person. */
const LINES: Line[] = [
  {
    lead: { he: 'שלום, אני ONE.', en: "Hi, I'm ONE." },
    body: { he: 'הנציג הדיגיטלי שלך.', en: 'Your digital representative.' },
  },
  {
    lead: { he: 'אני מקדם בשבילך דברים.', en: 'I move things forward for you.' },
    body: {
      he: 'תור, מכתב, בקשה, שיפוץ — אתה אומר מה שאתה רוצה, ואני דואג שזה יקרה.',
      en: 'A booking, a message, a request, a renovation — you say what you want, and I make it happen.',
    },
  },
  {
    lead: { he: 'אני מייצג אותך.', en: 'I represent you.' },
    body: {
      he: 'מדבר בשמך מול אנשים ועסקים — וחושף רק מה שתרשה. אתה שולט.',
      en: 'I speak for you to people and businesses — and share only what you allow. You stay in control.',
    },
  },
  {
    lead: { he: 'כל דבר הוא תהליך.', en: 'Everything is a process.' },
    body: {
      he: 'מה שתרצה לקדם נפתח כתהליך שאני מנהל — ואתה רואה בדיוק מה קורה.',
      en: 'Anything you want to get done opens as a process I run — and you see exactly what’s happening.',
    },
  },
  {
    lead: { he: 'מוכן כשתהיה.', en: 'Ready when you are.' },
    body: {
      he: 'בוא נתחיל — ספר לי על משהו שבא לך לקדם.',
      en: 'Let’s start — tell me something you’d like to move forward.',
    },
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function OnboardingOverlay({ visible, onDone }: Props) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const last = index >= LINES.length - 1;

  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(visible ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
    if (visible) {
      setIndex(0);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, animated: false }));
    }
  }, [visible, sv]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: sv.value }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sv.value) * 18 }],
  }));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / CARD_MAX_W);
    if (i !== index) { setIndex(i); haptic.select(); }
  }, [index]);

  const next = useCallback(() => {
    haptic.tap();
    if (last) { onDone(); return; }
    scrollRef.current?.scrollTo({ x: (index + 1) * CARD_MAX_W, animated: true });
  }, [last, index, onDone]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }, rootStyle]}>
      <Animated.View style={[styles.stage, stageStyle]}>
        {/* ONE — centred, present, speaking. Stays put while its lines change. */}
        <View style={styles.figure}>
          <Orb size={112} />
        </View>

        {/* ONE's lines — swipeable; Hebrew mirrors the row so it starts from the
            right, each page is un-mirrored so its text reads normally. */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={[styles.linesScroll, he && styles.flipX]}
        >
          {LINES.map((l, i) => (
            <View key={i} style={[styles.line, { width: CARD_MAX_W }, he && styles.flipX]}>
              <Text style={[styles.lead, { color: colors.text }, rtlText(lang)]}>
                {he ? l.lead.he : l.lead.en}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? l.body.he : l.body.en}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Progress dots — subtle, theme-aware. */}
        <View style={styles.dots}>
          {LINES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.text : colors.border },
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Next (primary, ink pill) + Skip below it. */}
      <View style={styles.actions}>
        <Pressable
          onPress={next}
          style={({ pressed }) => [styles.nextBtn, { backgroundColor: colors.text, opacity: pressed ? 0.9 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.nextText, { color: colors.background }]}>
            {last ? (he ? 'בוא נתחיל' : 'Let’s start') : (he ? 'הבא' : 'Next')}
          </Text>
        </Pressable>
        <Pressable onPress={() => { haptic.select(); onDone(); }} hitSlop={10} style={styles.skipBtn} accessibilityRole="button">
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {he ? 'דלג' : 'Skip'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  stage: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  figure: { marginBottom: 34 },
  linesScroll: { flexGrow: 0, alignSelf: 'center', width: CARD_MAX_W },
  flipX: { transform: [{ scaleX: -1 }] },
  line: {
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 120,
  },
  lead: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 340,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  actions: {
    width: '100%',
    maxWidth: CARD_MAX_W,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  nextBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  skipBtn: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 20 },
  skipText: { fontSize: 15, fontWeight: '600' },
});
