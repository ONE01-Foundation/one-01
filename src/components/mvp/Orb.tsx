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

import React, { useEffect } from 'react';
import Svg, { Circle, Ellipse, Rect, Line, Path, G } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
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
// Eyes spread wide (cx 23 / 41) so the face reads less cramped.
// Eyes pulled in one notch (7 → 6) per latest design — a touch smaller for
// a cleaner face. ry stays equal to rx so the eye remains a circle when open.
const EYE_RX = 6;            // horizontal radius (stays put)
const EYE_RY_OPEN = 6;       // vertical radius when open
const EYE_RY_BLINK = 0.6;    // vertical radius mid-blink (squashed thin)
const EYE_CY = 29;
const EYE_CX_LEFT = 23;
const EYE_CX_RIGHT = 41;

// How far the eyes can drift up/down in the viewBox (per unit of eyeLookY).
// 5 means a fully positive eyeLookY (e.g. fully scrolled processes) shifts
// the eye centre by 5 viewBox units → clearly "looking down".
const EYE_TRACK_RANGE = 5;

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
}

export function Orb({ size, eyesOpacity = 1, eyesOpacityAnim, eyeLookY, noBlink, mouth, outline, eyeOpen, skinOverride, noShadow }: OrbProps) {
  const { colors } = useThemeStore();
  // The user's chosen skin (Settings). Skins are accessories + eye-shape, never
  // a colour swap — the face stays the theme's central black.
  const agentSkin = useMvpStore((s) => s.agentSkin);
  const skin = resolveSkin(skinOverride ?? agentSkin);
  const faceColor = skin.face || colors.circle; // black face unless a skin overrides
  const eyeColor = colors.circleEye;     // off-white in light, pure white in dark
  const eyeFill = outline ? faceColor : eyeColor;
  const square = skin.eyeShape === 'square';
  const accent = skin.accent ?? eyeColor;

  // Blink: ry oscillates from OPEN → BLINK → OPEN on a randomised cadence.
  // Each Orb instance picks its own first-delay so two faces on screen
  // never blink in lockstep.
  const ry = useSharedValue(EYE_RY_OPEN);
  useEffect(() => {
    if (noBlink) return;
    const initialDelay = 1800 + Math.floor(Math.random() * 2400);
    const period = 4200 + Math.floor(Math.random() * 2800); // 4.2–7 s
    ry.value = withDelay(
      initialDelay,
      withRepeat(
        withSequence(
          withTiming(EYE_RY_BLINK, { duration: 70, easing: Easing.in(Easing.cubic) }),
          withTiming(EYE_RY_OPEN, { duration: 110, easing: Easing.out(Easing.cubic) }),
          // Hold open for the rest of the period.
          withTiming(EYE_RY_OPEN, { duration: period }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      // Reset on unmount so a remount doesn't inherit a mid-blink value.
      ry.value = EYE_RY_OPEN;
    };
  }, [noBlink, ry]);

  // Animated props for the eyes. Left + right share the SAME props (they track
  // together and blink in sync); only their static cx / x differs. `ry` is the
  // blink height scaled by `eyeOpen` (lids), clamped to the thin blink line so
  // a fully-shut eye still reads as a closed lid, not a vanished eye. Opacity
  // rides through too so `eyesOpacityAnim` can fade the eyes in on splash.
  const eyeEllipseProps = useAnimatedProps(() => {
    'worklet';
    const v = eyeLookY ? eyeLookY.value : 0;
    const offset = Math.max(-EYE_TRACK_RANGE, Math.min(EYE_TRACK_RANGE, v * EYE_TRACK_RANGE));
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    const eo = eyeOpen ? eyeOpen.value : 1;
    const ryEff = Math.max(EYE_RY_BLINK, ry.value * eo);
    return { cy: EYE_CY + offset, ry: ryEff, opacity: op };
  });
  // Square-eye variant: same geometry expressed as a rounded rect. y / height
  // animate around the eye centre so the blink + lid-close still work.
  const eyeRectProps = useAnimatedProps(() => {
    'worklet';
    const v = eyeLookY ? eyeLookY.value : 0;
    const offset = Math.max(-EYE_TRACK_RANGE, Math.min(EYE_TRACK_RANGE, v * EYE_TRACK_RANGE));
    const op = eyesOpacityAnim ? eyesOpacityAnim.value : eyesOpacity;
    const eo = eyeOpen ? eyeOpen.value : 1;
    const ryEff = Math.max(EYE_RY_BLINK, ry.value * eo);
    const cy = EYE_CY + offset;
    return { y: cy - ryEff, height: ryEff * 2, opacity: op };
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
        {/* Accessories — glasses / beanie. Skipped in ghost (outline) mode so
            the incognito face reads as a bare ring. Tinted by the skin accent;
            the face itself stays black. */}
        {!outline && skin.accessory !== 'none' && (
          <AnimatedG animatedProps={accessoryProps}>
            {skin.accessory === 'glasses' && (
              <>
                <Circle cx={EYE_CX_LEFT} cy={EYE_CY} r={EYE_RX + 2.5} fill="none" stroke={accent} strokeWidth={2} />
                <Circle cx={EYE_CX_RIGHT} cy={EYE_CY} r={EYE_RX + 2.5} fill="none" stroke={accent} strokeWidth={2} />
                <Line x1={EYE_CX_LEFT + EYE_RX + 2.5} y1={EYE_CY} x2={EYE_CX_RIGHT - EYE_RX - 2.5} y2={EYE_CY} stroke={accent} strokeWidth={2} />
                <Line x1={EYE_CX_LEFT - EYE_RX - 2.5} y1={EYE_CY} x2={7} y2={EYE_CY - 1.5} stroke={accent} strokeWidth={2} strokeLinecap="round" />
                <Line x1={EYE_CX_RIGHT + EYE_RX + 2.5} y1={EYE_CY} x2={57} y2={EYE_CY - 1.5} stroke={accent} strokeWidth={2} strokeLinecap="round" />
              </>
            )}
            {skin.accessory === 'hat' && (
              <>
                <Path d="M8 17 C 8 3, 56 3, 56 17 Z" fill={accent} />
                <Rect x={6} y={14.5} width={52} height={5} rx={2.5} fill={accent} />
                <Circle cx={32} cy={5} r={3} fill={accent} />
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
