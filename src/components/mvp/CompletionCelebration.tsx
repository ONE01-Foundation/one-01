/**
 * CompletionCelebration — the payoff moment.
 *
 * ONE exists to carry a process from a typed intent all the way to reality, so
 * the instant a process is marked complete it deserves more than a quiet line
 * in the timeline. This full-screen overlay beams ONE (the Orb scales in with a
 * little overshoot and "speaks"), bursts a soft confetti shower, names the
 * process that just landed, and fires a success haptic — then bows out on tap
 * or after a few seconds.
 *
 * Trigger: `completeUnit` sets the transient `celebration` field on the store
 * (NOT persisted). This component watches it and clears it when done.
 *
 * Freeze-safety: this is a plain transparent RN Modal. Dismissing a transparent
 * Modal DURING its present transition is the orphan-window bug we fought in the
 * sheets, so taps are ignored for the first PRESENT_GUARD_MS — by then the
 * present transition is long finished. The auto-dismiss timer is well past it.
 */
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { Orb } from './Orb';

const PALETTE = [
  '#FFB703',
  '#FB8500',
  '#2EC4B6',
  '#E71D36',
  '#8338EC',
  '#3A86FF',
  '#06D6A0',
  '#FF6B6B',
];
const PIECE_COUNT = 24;
const AUTO_DISMISS_MS = 3200;
const PRESENT_GUARD_MS = 420;

type Piece = {
  dx: number;
  dy: number;
  gravity: number;
  size: number;
  color: string;
  rot: number;
  delay: number;
};

/** Generate one festive burst. Runs on the JS thread (Math.random is fine here);
 *  the result is a frozen set of constants the worklet animates deterministically. */
function makePieces(): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < PIECE_COUNT; i++) {
    // Mostly upward and outward, spread wide across the top hemisphere.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const dist = 90 + Math.random() * 160;
    out.push({
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      gravity: 180 + Math.random() * 160,
      size: 7 + Math.random() * 7,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rot: (Math.random() - 0.5) * 720,
      delay: Math.random() * 0.12,
    });
  }
  return out;
}

function ConfettiPiece({ progress, piece }: { progress: SharedValue<number>; piece: Piece }) {
  const style = useAnimatedStyle(() => {
    const span = 1 - piece.delay;
    const e = Math.min(1, Math.max(0, (progress.value - piece.delay) / span));
    const tx = piece.dx * e;
    const ty = piece.dy * e + piece.gravity * e * e; // arc up then fall back down
    const fadeIn = Math.min(1, e / 0.08);
    const fadeOut = e > 0.65 ? Math.max(0, 1 - (e - 0.65) / 0.35) : 1;
    return {
      opacity: fadeIn * fadeOut,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${piece.rot * e}deg` },
        { scale: 0.5 + 0.5 * Math.min(1, e * 4) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: piece.size,
          height: piece.size * 0.55,
          borderRadius: 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

export function CompletionCelebration() {
  const celebration = useMvpStore((s) => s.celebration);
  const clearCelebration = useMvpStore((s) => s.clearCelebration);
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';

  const progress = useSharedValue(0);
  const orbScale = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const eyeLookY = useSharedValue(-0.6); // eyes drift up → reads as joyful

  // Keep the last celebration around so the fade-out still has a title to show.
  const [shown, setShown] = React.useState(celebration);
  const [canDismiss, setCanDismiss] = React.useState(false);

  React.useEffect(() => {
    if (celebration) {
      setShown(celebration);
      return;
    }
    // Fade-out grace: keep the content for the Modal's fade, then unmount so
    // the Orb's blink/mouth loops stop instead of running offscreen forever.
    const t = setTimeout(() => setShown(null), 260);
    return () => clearTimeout(t);
  }, [celebration]);

  const id = celebration?.id;
  // Fresh burst params per celebration, computed off the worklet thread and
  // available during the same render the Modal becomes visible.
  const pieces = React.useMemo(() => makePieces(), [id]);

  React.useEffect(() => {
    if (!id) return;
    setCanDismiss(false);
    progress.value = 0;
    orbScale.value = 0;
    cardScale.value = 0.92;

    haptic.success();
    cardScale.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    orbScale.value = withSequence(
      withTiming(1.12, { duration: 380, easing: Easing.out(Easing.back(1.7)) }),
      withTiming(1, { duration: 240 }),
    );
    progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) });

    const guard = setTimeout(() => setCanDismiss(true), PRESENT_GUARD_MS);
    const auto = setTimeout(() => clearCelebration(), AUTO_DISMISS_MS);
    return () => {
      clearTimeout(guard);
      clearTimeout(auto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: orbScale.value }] }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const dismiss = React.useCallback(() => {
    if (!canDismiss) return;
    haptic.tap();
    clearCelebration();
  }, [canDismiss, clearCelebration]);

  const title = shown?.title?.trim();

  return (
    <Modal
      visible={!!celebration}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View
          style={[styles.card, { backgroundColor: colors.surface }, cardStyle]}
          pointerEvents="box-none"
        >
          <Animated.View style={orbStyle}>
            <Orb size={104} mouth eyeLookY={eyeLookY} noShadow />
          </Animated.View>

          <Text style={[styles.headline, { color: colors.text }, rtlText(lang)]}>
            {he ? 'הגעת לזה!' : 'You made it!'}
          </Text>

          {!!title && (
            <Text
              style={[styles.title, { color: colors.text }, rtlText(lang)]}
              numberOfLines={2}
            >
              {shown?.emoji ? `${shown.emoji} ` : ''}
              «{title}»
            </Text>
          )}

          <Text style={[styles.sub, { color: colors.text }, rtlText(lang)]}>
            {he ? 'מכוונה — למציאות.' : 'From intent — to reality.'}
          </Text>

          <Text style={[styles.hint, { color: colors.text }, rtlText(lang)]}>
            {he ? 'הקש כדי להמשיך' : 'Tap to continue'}
          </Text>
        </Animated.View>

        {/* Confetti rides above the card, bursting from its centre. */}
        <View style={styles.burstLayer} pointerEvents="none">
          {pieces.map((p, i) => (
            <ConfettiPiece key={i} progress={progress} piece={p} />
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  card: {
    width: 300,
    maxWidth: '86%',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  headline: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  title: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.92,
  },
  sub: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.55,
  },
  hint: {
    marginTop: 20,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.4,
  },
  // Centred 0×0 anchor: pieces are absolutely positioned at its centre and
  // fly out via transforms.
  burstLayer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
