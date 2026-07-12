/**
 * CardLoop — a vertical "news carousel" that never ends: a stack of three
 * cards, the front one drops DOWN and fades away, cycles to the BACK of the
 * loop, and the next card rises into its place. Loops forever.
 *
 * Advance by: auto-rotation (paused while you touch), a downward drag on the
 * front card, or a tap. Actions on a card fire without advancing.
 *
 * Positional slots (not item ids) are animated: four <Animated.View>s hold the
 * front + two peeking behind + one incoming, and each interpolates from its
 * depth to depth-1 over a single `t` (0→1). When `t` completes we bump the head
 * index and reset `t` — because the slots are keyed by position, the item that
 * was rising to the front simply stays there. Seamless.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

// Rest style per depth (0 = front). Cards peek UP behind the front (negative
// translateY), a touch smaller and fainter the deeper they sit. Index -1 is the
// "exit" (dropped down + gone); index 3 is the "incoming" (hidden above).
export type DepthStyle = { ty: number; sc: number; op: number };

function depthStyles(exitY: number): DepthStyle[] {
  // Indexed 0..4, where element k is depth (k-1): [-1(exit),0,1,2,3(incoming)].
  return [
    { ty: exitY, sc: 1, op: 0 }, // -1 exit (dropped away)
    { ty: 0, sc: 1, op: 1 }, //  0 front
    { ty: -16, sc: 0.94, op: 0.6 }, //  1 first peek
    { ty: -30, sc: 0.88, op: 0.34 }, //  2 second peek
    { ty: -42, sc: 0.84, op: 0 }, //  3 incoming (fades in as it becomes depth 2)
  ];
}

const SLOTS = 4; // front + 2 peeking + 1 incoming
const AUTO_MS = 5000;

interface CardLoopProps<T> {
  items: T[];
  renderCard: (item: T, isFront: boolean) => React.ReactNode;
  cardHeight: number;
  /** Auto-rotate like a news feed (paused while touched). Default true. */
  auto?: boolean;
  /** Allow a downward drag on the front card to advance. Off by default so it
   *  never fights the enclosing sheet's drag-to-close. */
  draggable?: boolean;
  /** Tap the front card to advance. Off by default so taps land on the card's
   *  own action button instead of skipping it. */
  tappable?: boolean;
  onAdvance?: () => void;
}

export function CardLoop<T>({
  items,
  renderCard,
  cardHeight,
  auto = true,
  draggable = false,
  tappable = false,
  onAdvance,
}: CardLoopProps<T>) {
  const n = items.length;
  const { height: winH } = useWindowDimensions();
  const exitY = winH; // drop the whole way off the bottom

  const [head, setHead] = useState(0);
  const t = useSharedValue(0); // 0 = at rest, 1 = one full advance
  const animating = useRef(false);
  const touching = useRef(false);
  const depths = depthStyles(exitY);

  // Commit one step forward and reset the timeline (positional slots keep the
  // rising card in place, so this is invisible).
  const commit = useCallback(() => {
    setHead((h) => (h + 1) % Math.max(1, n));
    t.value = 0;
    animating.current = false;
    onAdvance?.();
  }, [n, t, onAdvance]);

  const advance = useCallback(() => {
    if (animating.current || n < 2) return;
    animating.current = true;
    t.value = withTiming(1, { duration: 460, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(commit)();
    });
  }, [commit, n, t]);

  // Auto-rotation — paused while a finger is down or an animation is running.
  useEffect(() => {
    if (!auto || n < 2) return;
    const id = setInterval(() => {
      if (!animating.current && !touching.current) advance();
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [auto, n, advance]);

  const pan = Gesture.Pan()
    .activeOffsetY(10) // only claim clearly-downward drags
    .failOffsetY(-14)
    .onBegin(() => {
      touching.current = true;
    })
    .onUpdate((e) => {
      if (animating.current) return;
      const d = Math.max(0, e.translationY);
      t.value = Math.min(1, d / (cardHeight * 0.6));
    })
    .onEnd((e) => {
      if (animating.current) return;
      const past = t.value > 0.4 || e.velocityY > 700;
      if (past) {
        animating.current = true;
        // INLINE — never call a JS helper from this worklet (crashes on gesture).
        t.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) runOnJS(commit)();
        });
      } else {
        t.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    })
    .onFinalize(() => {
      touching.current = false;
    });

  // Tap the front card to advance (news-carousel feel).
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(advance)();
    });

  const interactive = draggable || tappable;
  const gesture = draggable
    ? tappable
      ? Gesture.Exclusive(pan, tap)
      : pan
    : tap;

  useEffect(() => () => cancelAnimation(t), [t]);

  if (n === 0) return null;

  return (
    <View style={[styles.wrap, { height: cardHeight + 46 }]}>
      {/* Slot k holds the item at (head + k). k=0 front … k=3 incoming. Keyed by
          SLOT so items flow through slots as `head` advances. */}
      {Array.from({ length: Math.min(SLOTS, n) }).map((_, k) => {
        const item = items[(head + k) % n];
        const front = k === 0;
        const card = (
          <LoopSlot key={k} slot={k} t={t} depths={depths} height={cardHeight}>
            {renderCard(item, front)}
          </LoopSlot>
        );
        // Only the front slot is interactive (drag / tap to advance) — and only
        // when a manual gesture is enabled; otherwise it auto-rotates and taps
        // fall through to the card's own action button.
        return front && interactive ? (
          <GestureDetector key={k} gesture={gesture}>
            {card}
          </GestureDetector>
        ) : (
          card
        );
      })}
    </View>
  );
}

function LoopSlot({
  slot,
  t,
  depths,
  height,
  children,
}: {
  slot: number;
  t: SharedValue<number>;
  depths: DepthStyle[];
  height: number;
  children: React.ReactNode;
}) {
  // Element index into `depths`: depth d = slot, so depths index = slot + 1.
  // As t: 0→1 the slot moves from depth `slot` to depth `slot-1`.
  const from = depths[slot + 1];
  const to = depths[slot];
  const style = useAnimatedStyle(() => {
    'worklet';
    const p = t.value;
    const ty = from.ty + (to.ty - from.ty) * p;
    const sc = from.sc + (to.sc - from.sc) * p;
    const op = from.op + (to.op - from.op) * p;
    return {
      opacity: op,
      transform: [{ translateY: ty }, { scale: sc }],
    };
  });
  return (
    <Animated.View
      style={[styles.slot, { height, zIndex: 40 - slot * 10 }, style]}
      pointerEvents={slot === 0 ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'flex-start' },
  slot: { position: 'absolute', top: 30, left: 0, right: 0 },
});
