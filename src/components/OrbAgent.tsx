/**
 * OrbAgent – The living ONE symbol. Agent presence across the app.
 * States: idle (breathing), listening (expand/contract), thinking (pulse), speaking (bounce + dots).
 * Uses RN Animated only for compatibility with splash/loading flow.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../stores/themeStore';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type OrbMode = 'home' | 'discovery' | 'process' | 'units';

export interface OrbAgentProps {
  size: number;
  state: OrbState;
  mode: OrbMode;
  labelLines?: string[];
  onPress?: () => void;
  /** When true, orb is tappable (e.g. return home) */
  tappable?: boolean;
  /** Hat-based glow behind orb (e.g. health=green, finance=blue) */
  glowColor?: string;
  /** Subtle typing effect for label text */
  typingEffect?: boolean;
  /** Show eyes and mouth that look around (living face) */
  showFace?: boolean;
  /** Horizontal mouth line; false = dots-only (eyes) */
  showMouth?: boolean;
  /** Optional eye gaze override in px (for world scroll / unit focus cues) */
  gazeX?: number | Animated.AnimatedInterpolation<number>;
  /** Optional vertical eye gaze override in px (positive = look down) */
  gazeY?: number | Animated.AnimatedInterpolation<number>;
}

export function OrbAgent({
  size,
  state,
  mode,
  labelLines = [],
  onPress,
  tappable,
  glowColor,
  typingEffect,
  showFace,
  showMouth = false,
  gazeX,
  gazeY,
}: OrbAgentProps) {
  const { colors } = useThemeStore();
  const scale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const lookVal = useRef(new Animated.Value(0.5)).current;
  const blinkVal = useRef(new Animated.Value(1)).current;
  const [typedLine, setTypedLine] = React.useState('');
  const typedIndexRef = useRef(0);
  const lineIndexRef = useRef(0);
  const fullLine = labelLines.length > 0 ? labelLines[0] : '';

  useEffect(() => {
    switch (state) {
      case 'idle': {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(breathe, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }
      case 'listening': {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.15,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(scale, {
              toValue: 0.92,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }
      case 'thinking': {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(breathe, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }
      case 'speaking': {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bounce, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(bounce, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.in(Easing.ease),
            }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }
    }
  }, [state, scale, breathe, bounce]);

  // Reset scale when not listening
  useEffect(() => {
    if (state !== 'listening') {
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [state, scale]);

  // Typing effect for first label line
  useEffect(() => {
    if (!typingEffect || !fullLine) {
      setTypedLine(fullLine);
      return;
    }
    lineIndexRef.current = 0;
    typedIndexRef.current = 0;
    setTypedLine('');
    const delay = 45;
    const id = setInterval(() => {
      typedIndexRef.current += 1;
      if (typedIndexRef.current > fullLine.length) {
        clearInterval(id);
        setTypedLine(fullLine);
        return;
      }
      setTypedLine(fullLine.slice(0, typedIndexRef.current));
    }, delay);
    return () => clearInterval(id);
  }, [fullLine, typingEffect]);

  // Face: eyes look left / right (only when showFace)
  useEffect(() => {
    if (!showFace || size < 40) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lookVal, { toValue: 1, duration: 2200, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(lookVal, { toValue: 0.5, duration: 1800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(lookVal, { toValue: 0, duration: 2200, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(lookVal, { toValue: 0.5, duration: 1800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showFace, size, lookVal]);

  // Face: occasional natural blink
  useEffect(() => {
    if (!showFace || size < 30) {
      blinkVal.setValue(1);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleBlink = () => {
      if (cancelled) return;
      const nextInMs = 2200 + Math.round(Math.random() * 3000);
      timeoutId = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blinkVal, {
            toValue: 0.12,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(blinkVal, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
        ]).start(() => {
          if (!cancelled) scheduleBlink();
        });
      }, nextInMs);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showFace, size, blinkVal]);

  const breatheScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });
  const bounceTranslate = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });
  const combinedScale =
    state === 'idle' || state === 'thinking'
      ? Animated.multiply(scale, breatheScale)
      : state === 'speaking'
        ? scale
        : scale;

  const Wrapper = tappable && onPress ? TouchableOpacity : View;
  const wrapperProps = tappable && onPress ? { onPress, activeOpacity: 0.8 } : {};

  return (
    <Wrapper style={styles.wrap} {...wrapperProps}>
      <Animated.View
        style={[
          styles.orbWrap,
          {
            width: size,
            height: size,
            transform: [
              { scale: combinedScale },
              state === 'speaking' ? { translateY: bounceTranslate } : { translateY: 0 },
            ],
          },
        ]}
      >
        {glowColor ? (
          <>
            <View
              style={[
                styles.glow,
                {
                  width: size * 2.8,
                  height: size * 2.8,
                  borderRadius: (size * 2.8) / 2,
                  backgroundColor: glowColor,
                  opacity: 0.04,
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.glow,
                {
                  width: size * 2.2,
                  height: size * 2.2,
                  borderRadius: (size * 2.2) / 2,
                  backgroundColor: glowColor,
                  opacity: 0.08,
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.glow,
                {
                  width: size * 1.6,
                  height: size * 1.6,
                  borderRadius: (size * 1.6) / 2,
                  backgroundColor: glowColor,
                  opacity: 0.12,
                },
              ]}
              pointerEvents="none"
            />
          </>
        ) : null}
        <View
          style={[
            styles.orb,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.circle,
            },
          ]}
        />
        {showFace && size >= 30 && (() => {
          const eyeSize = Math.max(5, size * 0.158);
          const rEye = eyeSize / 2;
          const R = size / 2;
          const cx = R;
          const cy = R;
          /** מעט נמוך יותר + רחוק יותר מהאף (רוחב) */
          const eyeY = size * 0.378;
          const dy = eyeY - cy;
          /** מרחק מקסימלי מציר האנכי למרכז עין כך שכל דיסק העין נשאר בתוך העיגול */
          const maxHoriz = Math.sqrt(Math.max(0, (R - rEye) ** 2 - dy * dy));
          /** חצי מרחק בין מרכזי העיניים — רחוק יותר מגשר האף */
          const halfInteraxial = Math.max(
            rEye + 1.35,
            Math.min(maxHoriz - 0.65, size * 0.166)
          );
          const leftCx = cx - halfInteraxial;
          const rightCx = cx + halfInteraxial;
          const mouthWidth = size * 0.28;
          const mouthY = size * 0.62;
          const autoLookX = lookVal.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-1.25, 0, 1.25] });
          const lookX = gazeX ?? autoLookX;
          const lookY = gazeY ?? 0;
          return (
            <View style={[styles.face, { width: size, height: size }]} pointerEvents="none">
              <Animated.View style={[styles.eyeWrap, { left: leftCx - rEye, top: eyeY - rEye, width: eyeSize, height: eyeSize, transform: [{ translateX: lookX }, { translateY: lookY }, { scaleY: blinkVal }] }]}>
                <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2, backgroundColor: colors.background }]} />
              </Animated.View>
              <Animated.View style={[styles.eyeWrap, { left: rightCx - rEye, top: eyeY - rEye, width: eyeSize, height: eyeSize, transform: [{ translateX: lookX }, { translateY: lookY }, { scaleY: blinkVal }] }]}>
                <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2, backgroundColor: colors.background }]} />
              </Animated.View>
              {showMouth ? (
                <View style={[styles.mouth, { width: mouthWidth, left: (size - mouthWidth) / 2, top: mouthY, height: 2, borderRadius: 1, backgroundColor: colors.background }]} />
              ) : null}
            </View>
          );
        })()}
        {state === 'speaking' && (
          <View style={[styles.dots, { bottom: -size * 0.3 }]} pointerEvents="none">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: size * 0.12,
                    height: size * 0.12,
                    borderRadius: size * 0.06,
                    backgroundColor: colors.circle,
                    opacity: 0.6,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
      {labelLines.length > 0 && (
        <Animated.View style={[styles.labels, { opacity: labelOpacity }]}>
          {typingEffect && fullLine ? (
            <Text style={[styles.labelLine, { color: colors.textSecondary }]} numberOfLines={1}>
              {typedLine}
              {typedLine.length < fullLine.length ? <Text style={{ opacity: 0.5 }}>|</Text> : null}
            </Text>
          ) : (
            labelLines.slice(0, 2).map((line, i) => (
              <Text key={i} style={[styles.labelLine, { color: colors.textSecondary }]} numberOfLines={1}>
                {line}
              </Text>
            ))
          )}
        </Animated.View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
  },
  orb: {},
  face: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeWrap: {
    position: 'absolute',
  },
  eye: {},
  mouth: {
    position: 'absolute',
  },
  dots: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {},
  labels: {
    marginTop: 10,
    alignItems: 'center',
    minHeight: 36,
  },
  labelLine: {
    fontSize: 14,
    textAlign: 'center',
  },
});
