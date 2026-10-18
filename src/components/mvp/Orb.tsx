/**
 * Orb — the ONE agent's visual presence.
 *
 * Rendered as SVG so the eyes are perfectly round at every size and the
 * proportions match the canonical brand face (viewBox 64×64, face r=28,
 * eyes at cy=29, cx=23/41).
 *
 * Eyes are SVG `Ellipse`s (not Circles) so we can animate `ry` independently
 * for the blink (eyes squash thin → spring back open).
 *
 * Behaviours:
 *   • Eyes look FORWARD by default (eyeLookY=0).
 *   • Optional `eyeLookY` shared value shifts gaze up/down (e.g. driven by
 *     the Home scroll: pulling processes up → eyes drift DOWN to look at them).
 *   • Every Orb instance blinks on a random 4–8 s cadence — done internally
 *     so each face on screen blinks independently and the screen never feels
 *     mechanically synchronised.
 */

import React, { useEffect, useRef } from 'react';
import Svg, { Circle, Ellipse, Rect, Line, Path, G } from 'react-native-svg';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { resolveSkin } from '../../data/mvp/agentAppearance';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

// Eye geometry in the 64×64 viewBox.
// Eyes are slightly TALLER than wide (ry > rx) — the softer, more "alive" oval
// from the concept demo — and sit a touch more centred (cy 31) and a hair closer
// together than before. Accessories (glasses) derive from these, so they track.
const EYE_RX = 6;            // horizontal radius (stays put)
const EYE_RY_OPEN = 7;       // vertical radius when open — taller oval, per demo
const EYE_RY_BLINK = 0.6;    // vertical radius mid-blink (squashed thin)
const EYE_CY = 31;
const EYE_CX_LEFT = 24;
const EYE_CX_RIGHT = 41;

// How far the eyes can drift up/down in the viewBox (per unit of eyeLookY).
// 5 means a fully positive eyeLookY (e.g. fully scrolled processes) shifts
// the eye centre by 5 viewBox units → clearly "looking down".
const EYE_TRACK_RANGE = 5;
// Horizontal gaze range (viewBox units) for the autonomous "look around".
const EYE_LOOK_X = 3.2;

export interface OrbProps {
  size: number;
  /**
   * 0 → 1 visibility of the eyes. Static number. Defaults to 1.
   * Splash uses `0` so the orb reads as a pure brand mark.
   */
  eyesOpacity?: number;
  /**
   * Optional animated eyes opacity — overrides `eyesOpacity` when present.
   * Used to fade the eyes IN smoothly on the splash → home handoff ("agent
   * opens its eyes").
   */
  eyesOpacityAnim?: SharedValue<number>;
  /**
   * Optional shared value that tracks where the eyes look:
   *   negative (e.g. -1) → eyes drift UP
   *   positive (e.g.  1) → eyes drift DOWN
   *   0 (default)        → eyes centred, looking forward
   * When omitted, eyes look straight forward.
   */
  eyeLookY?: SharedValue<number>;
  /**
   * Disable the autonomous blink. Useful for the splash mark (eyes are
   * faded out anyway). Default false (blinking on).
   */
  noBlink?: boolean;
  /**
   * Render a mouth below the eyes and animate it as if ONE is speaking.
   * Used in call mode so the face reads as talking, not just watching.
   */
  mouth?: boolean;
  /**
   * Hollow "ghost" presence: the face is drawn as a thin outline ring (no
   * fill) instead of a solid disc — used while a chat is in ghost / temporary
   * mode, so ONE reads as present-but-ephemeral. Eyes switch to the ring
   * colour so they stay visible on the now-transparent face.
   */
  outline?: boolean;
  /**
   * Optional 0 → 1 lid openness. 0 = eyes shut to a thin line, 1 = fully open.
   * Multiplies the blink height, so it composes with the autonomous blink.
   * Driven by Home for two effects: eyes CLOSE as the user pulls toward Global,
   * and ONE "falls asleep" (lids drop) after a long idle. Defaults to 1 (open).
   */
  eyeOpen?: SharedValue<number>;
  /**
   * When true, ONE feels alive: its eyes autonomously glance to the sides now
   * and then (with pauses), on top of the blink. Used on the Home hero orb.
   */
  alive?: boolean;
  /**
   * Force a specific skin instead of the app-wide chosen one. Used by the
   * Settings skin picker to preview each skin as a real mini-face.
   */
  skinOverride?: string;
  /**
   * Drop the soft drop-shadow halo. Pass this whenever the orb sits inside a
   * transform-SCALED container (Home hero splash grow-in + pull-to-Global,
   * profile orb tap-grow, call mode, celebration pop). The platform rasterises
   * the blurred shadow at the base size and stretches that bitmap when scaled,
   * which reads as a pixelated / blocky halo. The solid face scales cleanly, so
   * only the shadow needs to go. Default false (halo on) for static orbs.
   */
  noShadow?: boolean;
  /**
   * Web: the eyes follow the pointer (mouse / touch). ONE looks toward where
   * the cursor is, relative to its own centre, so the face feels present and
   * attentive. No-op on native (no global pointer).
   */
  trackPointer?: boolean;
}

export function Orb({ size, eyesOpacity = 1, eyesOpacityAnim, eyeLookY, noBlink, mouth, outline, eyeOpen, alive, skinOverride, noShadow, trackPointer }: OrbProps) {
  const { colors } = useThemeStore();
  // The user's chosen skin (Settings). Skins are accessories + eye-shape, never
  // a colour swap — the face stays the theme's central black.
  const agentSkin = useMvpStore((s) => s.agentSkin);
  const skin = resolveSkin(skinOverride ?? agentSkin);
  const faceColor = skin.face || colors.circle; // black face unless a skin overrides
  const eyeColor = colors.circleEye;     // off-white in light, pure white in dark
  const eyeFill = outline ? faceColor : eyeColor;
  const square = skin.eyeShape === 'square';
  // Eye open-height by shape: 'round' = a perfect circle (the classic look,
  // now a selectable skin); everything else = the slightly taller oval (the
  // default face). rx stays put, only the open ry differs.
  const openRy = skin.eyeShape === 'round' ? EYE_RX : EYE_RY_OPEN;
  const accent = skin.accent ?? eyeColor;
  // Where the accessory is mounted: eyewear rides the eyes, headwear the head.
  const isEyewear = skin.accessory === 'glasses' || skin.accessory === 'sunglasses';
  const isHeadwear = skin.accessory === 'hat' || skin.accessory === 'headphones';
  // Glasses frame radius (hugging the eye) — shared by clear + sun lenses.
  const lensR = EYE_RX + 2.7;

  // Blink: ry oscillates from OPEN → BLINK → OPEN on a randomised cadence.
  // Each Orb instance picks its own first-delay so two faces on screen
  // never blink in lockstep.
  const ry = useSharedValue(openRy);
  useEffect(() => {
    // Keep the open height in sync with the skin even when blinking is off
    // (splash mark) or the skin changes.
    if (noBlink) { ry.value = openRy; return; }
    const initialDelay = 1800 + Math.floor(Math.random() * 2400);
    const period = 4200 + Math.floor(Math.random() * 2800); // 4.2–7 s
    ry.value = withDelay(
      initialDelay,
      withRepeat(
        withSequence(
          withTiming(EYE_RY_BLINK, { duration: 70, easing: Easing.in(Easing.cubic) }),
          withTiming(openRy, { duration: 110, easing: Easing.out(Easing.cubic) }),
          // Hold open for the rest of the period.
          withTiming(openRy, { duration: period }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      // Reset on unmount so a remount doesn't inherit a mid-blink value.
      ry.value = openRy;
    };
  }, [noBlink, ry, openRy]);

  // Autonomous horizontal gaze — ONE occasionally glances to a side, holds,
  // then returns to centre, so the face reads as alive/curious. Each instance
  // runs its own irregular schedule.
  const lookX = useSharedValue(0);
  useEffect(() => {
    // Pointer tracking (below) owns the gaze when on — don't also run the
    // autonomous glance, or they fight.
    if (!alive || noBlink || trackPointer) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const glance = () => {
      if (!live) return;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const mag = 0.55 + Math.random() * 0.45;
      lookX.value = withSequence(
        withTiming(dir * mag, { duration: 460, easing: Easing.inOut(Easing.quad) }),
        withDelay(700 + Math.random() * 1100, withTiming(0, { duration: 460, easing: Easing.inOut(Easing.quad) })),
      );
      timer = setTimeout(glance, 2600 + Math.random() * 3400);
    };
    timer = setTimeout(glance, 1400 + Math.random() * 1800);
    return () => {
      live = false;
      clearTimeout(timer);
      lookX.value = 0;
    };
  }, [alive, noBlink, trackPointer, lookX]);

  // Pointer gaze (web): the eyes glide toward the cursor / finger, normalised by
  // distance from ONE's own centre (fully deflected within ~PTR_REF px).
  const ptrX = useSharedValue(0);
  const ptrY = useSharedValue(0);
  const containerRef = useRef<View>(null);
  useEffect(() => {
    if (!trackPointer || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const PTR_REF = 190;
    let raf = 0;
    const onMove = (e: { clientX: number; clientY: number }) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = containerRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
        const rect = el?.getBoundingClientRect?.();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / PTR_REF));
        const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / PTR_REF));
        ptrX.value = withTiming(nx, { duration: 170, easing: Easing.out(Easing.quad) });
        ptrY.value = withTiming(ny, { duration: 170, easing: Easing.out(Easing.quad) });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
      ptrX.value = withTiming(0, { duration: 300 });
      ptrY.value = withTiming(0, { duration: 300 });
    };
  }, [trackPointer, ptrX, ptrY]);

  // The eye group carries the FULL gaze — horizontal (pointer or autonomous
  // glance) AND vertical (eyeLookY scroll + pointer). Everything mounted on the
  // eyes (the eyes + eyewear) lives inside this group so glasses ride the eyes.
  const eyeGroupProps = useAnimatedProps(() => {
    'worklet';
    const v = (eyeLookY ? eyeLookY.value : 0) + (trackPointer ? ptrY.value : 0);
    const offset = Math.max(-EYE_TRACK_RANGE, Math.min(EYE_TRACK_RANGE, v * EYE_TRACK_RANGE));
    const px = trackPointer ? ptrX.value : lookX.value;
    return { transform: [{ translateX: px * EYE_LOOK_X }, { translateY: offset }] };
  });
  // Headwear (hat / headphones) sits on the HEAD, not the eyes — so it only
  // gets a gentle parallax with the glance (a quarter of the eye travel), which
  // reads as the whole head shifting a touch, not a rigid decal.
  const headAccessoryProps = useAnimatedProps(() => {
    'worklet';
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    return { opacity: op, transform: [{ translateX: lookX.value * EYE_LOOK_X * 0.25 }] };
  });

  // Animated props for the eyes. Left + right share the SAME props (they track
  // together and blink in sync); only their static cx / x differs. `ry` is the
  // blink height scaled by `eyeOpen` (lids), clamped to the thin blink line so
  // a fully-shut eye still reads as a closed lid, not a vanished eye. Opacity
  // rides through too so `eyesOpacityAnim` can fade the eyes in on splash.
  // Vertical look is now applied to the whole eye GROUP (see eyeGroupProps), so
  // the eyes only own their blink height + fade here — cy stays the resting
  // centre and the group shifts them.
  const eyeEllipseProps = useAnimatedProps(() => {
    'worklet';
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    const eo = eyeOpen ? eyeOpen.value : 1;
    const ryEff = Math.max(EYE_RY_BLINK, ry.value * eo);
    return { cy: EYE_CY, ry: ryEff, opacity: op };
  });
  // Square-eye variant: same geometry expressed as a rounded rect. y / height
  // animate around the eye centre so the blink + lid-close still work.
  const eyeRectProps = useAnimatedProps(() => {
    'worklet';
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    const eo = eyeOpen ? eyeOpen.value : 1;
    const ryEff = Math.max(EYE_RY_BLINK, ry.value * eo);
    return { y: EYE_CY - ryEff, height: ryEff * 2, opacity: op };
  });
  // Accessories fade with the eyes so they never pop in before the face has
  // "opened its eyes" on the splash → home handoff.
  const accessoryProps = useAnimatedProps(() => {
    'worklet';
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    return { opacity: op };
  });

  // Talking mouth — an ellipse whose vertical radius oscillates on an
  // irregular loop so it reads like speech, not a metronome. Only runs when
  // `mouth` is on (call mode).
  const mouthRy = useSharedValue(2);
  useEffect(() => {
    if (!mouth) return;
    mouthRy.value = withRepeat(
      withSequence(
        withTiming(3.4, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.3, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        withTiming(2.9, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(2.4, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      mouthRy.value = 2;
    };
  }, [mouth, mouthRy]);
  const mouthProps = useAnimatedProps(() => {
    'worklet';
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    return { ry: mouthRy.value, opacity: op };
  });

  return (
    <View
      ref={containerRef}
      style={[
        !noShadow && styles.shadow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        accessibilityLabel="ONE agent"
      >
        <Circle
          cx={32}
          cy={32}
          r={28}
          fill={outline ? 'none' : faceColor}
          stroke={outline ? faceColor : undefined}
          strokeWidth={outline ? 2.5 : 0}
        />
        <AnimatedG animatedProps={eyeGroupProps}>
          {square ? (
            <>
              <AnimatedRect
                animatedProps={eyeRectProps}
                x={EYE_CX_LEFT - EYE_RX}
                width={EYE_RX * 2}
                rx={2}
                fill={eyeFill}
              />
              <AnimatedRect
                animatedProps={eyeRectProps}
                x={EYE_CX_RIGHT - EYE_RX}
                width={EYE_RX * 2}
                rx={2}
                fill={eyeFill}
              />
            </>
          ) : (
            <>
              <AnimatedEllipse
                animatedProps={eyeEllipseProps}
                cx={EYE_CX_LEFT}
                rx={EYE_RX}
                fill={eyeFill}
              />
              <AnimatedEllipse
                animatedProps={eyeEllipseProps}
                cx={EYE_CX_RIGHT}
                rx={EYE_RX}
                fill={eyeFill}
              />
            </>
          )}
          {/* Eyewear rides the eyes — it lives INSIDE the gaze group, so
              glasses / shades track the glance + look instead of hanging fixed
              while the eyes move. Fades in with the eyes via accessoryProps. */}
          {!outline && isEyewear && (
            <AnimatedG animatedProps={accessoryProps}>
              {skin.accessory === 'glasses' && (square ? (
                <>
                  {/* Rectangular "scholar" frames — match the square eyes. */}
                  <Rect x={EYE_CX_LEFT - lensR} y={EYE_CY - lensR + 0.5} width={lensR * 2} height={lensR * 2 - 1} rx={2.6} fill="none" stroke={accent} strokeWidth={2.2} />
                  <Rect x={EYE_CX_RIGHT - lensR} y={EYE_CY - lensR + 0.5} width={lensR * 2} height={lensR * 2 - 1} rx={2.6} fill="none" stroke={accent} strokeWidth={2.2} />
                  <Line x1={EYE_CX_LEFT + lensR} y1={EYE_CY - 2} x2={EYE_CX_RIGHT - lensR} y2={EYE_CY - 2} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                  <Line x1={EYE_CX_LEFT - lensR} y1={EYE_CY - 1} x2={6.5} y2={EYE_CY - 3} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                  <Line x1={EYE_CX_RIGHT + lensR} y1={EYE_CY - 1} x2={57.5} y2={EYE_CY - 3} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                </>
              ) : (
                <>
                  {/* Modern round frames with an arched bridge. */}
                  <Circle cx={EYE_CX_LEFT} cy={EYE_CY} r={lensR} fill="none" stroke={accent} strokeWidth={2.2} />
                  <Circle cx={EYE_CX_RIGHT} cy={EYE_CY} r={lensR} fill="none" stroke={accent} strokeWidth={2.2} />
                  <Path d={`M${EYE_CX_LEFT + lensR - 0.5} ${EYE_CY - 1.5} Q 32 ${EYE_CY - 4.6} ${EYE_CX_RIGHT - lensR + 0.5} ${EYE_CY - 1.5}`} fill="none" stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                  <Line x1={EYE_CX_LEFT - lensR} y1={EYE_CY - 1} x2={6.5} y2={EYE_CY - 3} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                  <Line x1={EYE_CX_RIGHT + lensR} y1={EYE_CY - 1} x2={57.5} y2={EYE_CY - 3} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
                </>
              ))}
              {skin.accessory === 'sunglasses' && (
                <>
                  {/* Tinted lenses with a light metal rim (so they read on the
                      black face) + a glossy highlight streak. */}
                  <Circle cx={EYE_CX_LEFT} cy={EYE_CY} r={lensR + 0.4} fill={accent} stroke="#9AA6B2" strokeWidth={1.8} />
                  <Circle cx={EYE_CX_RIGHT} cy={EYE_CY} r={lensR + 0.4} fill={accent} stroke="#9AA6B2" strokeWidth={1.8} />
                  <Line x1={EYE_CX_LEFT + lensR} y1={EYE_CY - 2} x2={EYE_CX_RIGHT - lensR} y2={EYE_CY - 2} stroke="#9AA6B2" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={EYE_CX_LEFT - lensR} y1={EYE_CY - 2.5} x2={6} y2={EYE_CY - 4.5} stroke="#9AA6B2" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={EYE_CX_RIGHT + lensR} y1={EYE_CY - 2.5} x2={58} y2={EYE_CY - 4.5} stroke="#9AA6B2" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={EYE_CX_LEFT - 2.6} y1={EYE_CY - 2.4} x2={EYE_CX_LEFT + 0.6} y2={EYE_CY + 0.8} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={EYE_CX_RIGHT - 2.6} y1={EYE_CY - 2.4} x2={EYE_CX_RIGHT + 0.6} y2={EYE_CY + 0.8} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
                </>
              )}
            </AnimatedG>
          )}
        </AnimatedG>
        {/* Headwear sits on the HEAD (a separate group). It only gets a gentle
            parallax with the glance, so it feels attached but not glued. Skipped
            in ghost (outline) mode. */}
        {!outline && isHeadwear && (
          <AnimatedG animatedProps={headAccessoryProps}>
            {skin.accessory === 'hat' && (
              <>
                {/* Soft artist's beret — a tilted cap ellipse, a shaded band and
                    an off-centre stub. */}
                <Ellipse cx={32} cy={13} rx={21} ry={8.6} fill={accent} />
                <Ellipse cx={32} cy={16.6} rx={20} ry={3.3} fill="#000000" opacity={0.16} />
                <Circle cx={42} cy={6} r={2.7} fill={accent} />
              </>
            )}
            {skin.accessory === 'headphones' && (
              <>
                {/* Over-ear headphones — a band arcing over the crown + two
                    ear-cups hugging the sides. */}
                <Path d="M9 33 C 9 7, 55 7, 55 33" fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" />
                <Rect x={5.5} y={27} width={8} height={13.5} rx={4} fill={accent} />
                <Rect x={50.5} y={27} width={8} height={13.5} rx={4} fill={accent} />
              </>
            )}
          </AnimatedG>
        )}
        {mouth && (
          <AnimatedEllipse
            animatedProps={mouthProps}
            cx={32}
            cy={44}
            rx={7}
            fill={eyeColor}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    // soft halo so the orb feels like a "presence", not just a dot
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
