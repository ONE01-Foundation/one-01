/**
 * Loading Screen – ספלאש: נקודה קטנה שמתפתחת לכדור סוכן (OrbAgent).
 * משתמש רק ב־RN Animated (ללא Reanimated) לתאימות.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { OrbAgent } from '../components/OrbAgent';

interface LoadingScreenProps {
  onComplete: () => void;
}

const ORB_SIZE = 72;
const DOT_SCALE_START = 0.15; // נקודה קטנה (~11px)

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const { colors, initialized } = useThemeStore();
  const scale = useRef(new Animated.Value(DOT_SCALE_START)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!initialized) return;
    // שלב 1: הנקודה גדלה לכדור (1.2s)
    const grow = Animated.timing(scale, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    });
    // שלב 2: הנקודה נעלמת והכדור סוכן מופיע (0.5s)
    const morph = Animated.parallel([
      Animated.timing(dotOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(orbOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);
    Animated.sequence([
      grow,
      Animated.delay(200),
      morph,
      Animated.delay(900),
    ]).start(() => {
      onComplete();
    });
  }, [initialized, onComplete, scale, dotOpacity, orbOpacity]);

  if (!initialized) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.orbSlot}>
        {/* נקודה שגדלה לכדור */}
        <Animated.View
          style={[
            styles.dotWrap,
            {
              opacity: dotOpacity,
              transform: [{ scale }],
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.dot,
              {
                width: ORB_SIZE,
                height: ORB_SIZE,
                borderRadius: ORB_SIZE / 2,
                backgroundColor: colors.circle,
              },
            ]}
          />
        </Animated.View>
        {/* כדור הסוכן – מופיע אחרי שהנקודה הופכת אליו */}
        <Animated.View style={[styles.orbOverlay, { opacity: orbOpacity }]} pointerEvents="none">
          <OrbAgent
            size={ORB_SIZE}
            state="idle"
            mode="home"
            showFace
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbSlot: {
    justifyContent: 'center',
    alignItems: 'center',
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  dotWrap: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  dot: {},
  orbOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
