/**
 * Loading Screen - Animated loading screen with 7 phases
 * 
 * Phase 1: Circle grows 0px → 72px (0-1.5s)
 * Phase 2: Circle breathing 72px ↔ 68px (1.5-3.5s)
 * Phase 3: Circle moves up (3.5-4.5s)
 * Phase 4: Text "Hello. I am your ONE" appears and disappears (4.5-6.5s)
 * Phase 5: Text "Agent-01" appears (6.5-8s)
 * Phase 6: Subtitle appears (8-10s)
 * Phase 7: Complete and transition (10s+)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useThemeStore } from '../stores/themeStore';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const { colors, theme, initialized } = useThemeStore();
  
  // Wait for theme to initialize
  if (!initialized) {
    return null;
  }

  // Animation values
  const circleScale = useSharedValue(0);
  const circleTranslateY = useSharedValue(0);
  const breathingScale = useSharedValue(1);
  const firstTextOpacity = useSharedValue(0);
  const agentTextOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    // Phase 1: Circle grows (0-1.5s)
    circleScale.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.ease),
    });

    // Phase 2: Breathing starts after growth (1.5s delay)
    breathingScale.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(0.94, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite
        false
      )
    );

    // Phase 3: Move up (3.5s delay, 1s duration = 3.5-4.5s)
    circleTranslateY.value = withDelay(
      3500,
      withTiming(-100, {
        duration: 1000,
        easing: Easing.out(Easing.ease),
      })
    );

    // Phase 4: First text appears (4.5s delay)
    firstTextOpacity.value = withDelay(
      4500,
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(1, { duration: 1500 }), // Hold
        withTiming(0, { duration: 500 }) // Fade out
      )
    );

    // Phase 5: Agent text appears (6.5s delay)
    agentTextOpacity.value = withDelay(
      6500,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      })
    );

    // Phase 6: Subtitle appears (8s delay)
    subtitleOpacity.value = withDelay(
      8000,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      })
    );

    // Phase 7: Complete (10s delay)
    // Use setTimeout for the callback since it's a JS function
    const timeoutId = setTimeout(() => {
      onComplete();
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [onComplete]);

  // Animated styles
  const circleStyle = useAnimatedStyle(() => {
    const finalScale = circleScale.value * breathingScale.value;
    return {
      transform: [
        { scale: finalScale },
        { translateY: circleTranslateY.value },
      ],
    };
  });

  const firstTextStyle = useAnimatedStyle(() => ({
    opacity: firstTextOpacity.value,
  }));

  const agentTextStyle = useAnimatedStyle(() => ({
    opacity: agentTextOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Circle */}
      <Animated.View
        style={[
          styles.circleContainer,
          circleStyle,
        ]}
      >
        <View
          style={[
            styles.circle,
            {
              backgroundColor: colors.circle,
              width: 72,
              height: 72,
            },
          ]}
        />
      </Animated.View>

      {/* Text Container — each block positioned so they don't overlap */}
      <View style={styles.textContainer}>
        {/* First Text: "Hello. I am your ONE" — single line */}
        <Animated.View style={[styles.textWrapper, styles.textWrapperFirst, firstTextStyle]}>
          <View style={styles.firstTextRow}>
            <Text style={[styles.firstText, { color: colors.text }]}>
              Hello. I am your{' '}
              <Text style={[styles.oneText, { color: colors.text }]}>ONE</Text>
            </Text>
          </View>
        </Animated.View>

        {/* Agent Text: "Agent-" and "01" on two lines */}
        <Animated.View style={[styles.textWrapper, styles.textWrapperAgent, agentTextStyle]}>
          <Text style={[styles.agentLine, { color: colors.text }]}>Agent-</Text>
          <Text style={[styles.agentLine, styles.agentLineSecond, { color: colors.text }]}>01</Text>
        </Animated.View>

        {/* Subtitle: single readable block, below agent */}
        <Animated.View style={[styles.textWrapper, styles.textWrapperSubtitle, subtitleStyle]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            I clear the noise and bring your vision to life
          </Text>
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
  circleContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    borderRadius: 36,
  },
  textContainer: {
    marginTop: 200,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    minHeight: 220,
  },
  textWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  textWrapperFirst: {
    top: 0,
  },
  textWrapperAgent: {
    top: 44,
  },
  textWrapperSubtitle: {
    top: 148,
  },
  firstTextRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    minWidth: 280,
  },
  firstText: {
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 30,
  },
  oneText: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: 26,
    lineHeight: 30,
  },
  agentLine: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 42,
  },
  agentLineSecond: {
    marginTop: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
});

