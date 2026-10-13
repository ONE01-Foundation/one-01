/**
 * OnboardingOverlay — a first-run (and post-update) explainer shown OVER the
 * home: a dimmed black scrim with a horizontal carousel of cards you swipe
 * sideways, a primary "Next" button and a "Skip" below it. On the last card
 * "Next" becomes the start CTA. Dismissing records the current
 * ONBOARDING_CARDS_VERSION so it re-appears only when that version is bumped
 * (i.e. after a feature update).
 *
 * Kept deliberately on-brand with the home: minimal, theme-aware, one accent.
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
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
// The card itself is capped so it never stretches edge-to-edge on desktop.
const CARD_MAX_W = Math.min(SCREEN_W, 460);

/** Bump this when a new feature warrants re-showing the onboarding cards. */
export const ONBOARDING_CARDS_VERSION = 1;

const ACCENT = '#3B82F6';

interface Card {
  emoji: string;
  title: { he: string; en: string };
  body: { he: string; en: string };
}

const CARDS: Card[] = [
  {
    emoji: '👤',
    title: { he: 'ONE מייצג אותך', en: 'ONE represents you' },
    body: {
      he: 'דבר איתו כמו עם עצמך. הוא זוכר, מבין, ופועל בשמך — מול אנשים, עסקים ומערכות.',
      en: 'Talk to it like you’d talk to yourself. It remembers, understands and acts on your behalf — with people, businesses and systems.',
    },
  },
  {
    emoji: '✨',
    title: { he: 'כל דבר הוא תהליך', en: 'Everything is a Process' },
    body: {
      he: 'משכנתא, תור לרופא, שיפוץ — כל מה שתרצה לקדם נפתח כתהליך ש-ONE מנהל ומקדם בשבילך.',
      en: 'A mortgage, a doctor’s visit, a renovation — anything you want to get done opens as a Process that ONE carries for you.',
    },
  },
  {
    emoji: '🔑',
    title: { he: 'אתה בוחר מה לחשוף', en: 'You choose what’s shared' },
    body: {
      he: 'לכל פרט אתה מחליט: פתוח, לפי בקשה, או פרטי. ONE חושף רק את מה שצריך, ורק למי שצריך.',
      en: 'For every detail you decide: open, on request, or private. ONE reveals only what’s needed, only to who needs it.',
    },
  },
  {
    emoji: '🌐',
    title: { he: 'Global — הרשת של ONE', en: 'Global — the network' },
    body: {
      he: 'ONE מתחבר לרשת של עסקים, נותני שירות וידע משותף — ופועל בתוכה בשבילך.',
      en: 'ONE connects to a shared network of businesses, providers and knowledge — and acts across it for you.',
    },
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function OnboardingOverlay({ visible, onDone }: Props) {
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const last = index >= CARDS.length - 1;

  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(visible ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (visible) {
      setIndex(0);
      // Reset to the first page when (re)shown.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, animated: false }));
    }
  }, [visible, sv]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: sv.value }));
  const cardsStyle = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateY: (1 - sv.value) * 24 }],
  }));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / CARD_MAX_W);
    if (i !== index) setIndex(i);
  }, [index]);

  const next = useCallback(() => {
    haptic.tap();
    if (last) {
      onDone();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * CARD_MAX_W, animated: true });
  }, [last, index, onDone]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Dimmed black scrim — the home shows through. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />

      <Animated.View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }, cardsStyle]}>
        {/* Swipeable cards. Hebrew mirrors the row (scaleX:-1) so it reads + starts
            from the RIGHT; each card is un-mirrored so its content is normal. */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={[styles.cardsScroll, he && styles.flipX]}
        >
          {CARDS.map((c, i) => (
            <View key={i} style={[styles.card, { width: CARD_MAX_W }, he && styles.flipX]}>
              <View style={styles.emojiWrap}>
                <Text style={styles.emoji}>{c.emoji}</Text>
              </View>
              <Text style={[styles.title, rtlText(lang)]}>
                {he ? c.title.he : c.title.en}
              </Text>
              <Text style={[styles.body, rtlText(lang)]}>
                {he ? c.body.he : c.body.en}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {CARDS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? ACCENT : 'rgba(255,255,255,0.28)' },
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next (primary) + Skip below it. */}
        <View style={styles.actions}>
          <Pressable
            onPress={next}
            style={({ pressed }) => [styles.nextBtn, { opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.nextText}>
              {last
                ? he ? 'בוא נתחיל' : 'Let’s start'
                : he ? 'הבא' : 'Next'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { haptic.select(); onDone(); }} hitSlop={10} style={styles.skipBtn} accessibilityRole="button">
            <Text style={styles.skipText}>
              {he ? 'דלג' : 'Skip'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000', opacity: 0.72 },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  cardsScroll: { flexGrow: 0, alignSelf: 'center', width: CARD_MAX_W },
  flipX: { transform: [{ scaleX: -1 }] },
  card: {
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // Give the cards a tall, centred stage above the controls.
    minHeight: 360,
  },
  emojiWrap: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    // Always on the dark scrim → a light frosted tile, not a theme surface.
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  emoji: { fontSize: 44 },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 12,
    // Light text — the scrim is always dark regardless of the app theme.
    color: '#FFFFFF',
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.74)',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 20 },
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
    // White pill on the dark scrim (high contrast, like the home composer).
    backgroundColor: '#FFFFFF',
  },
  nextText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2, color: '#111111' },
  skipBtn: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 20 },
  skipText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.62)' },
});
