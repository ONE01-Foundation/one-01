/**
 * FirstConversationScreen — per ONE_UI_UX_SPEC §4.
 *
 * Layout (now Home-shaped):
 *   [Orb]                              ← big, breathing
 *   "Tell me what you want to move forward."
 *   [bubbles…]
 *   [InputBar]                         ← shared component
 *
 * Flow:
 *   1. User types one or several intentions (newlines / commas / "and" / "וגם").
 *   2. ONE: "I can turn that into N processes:" + bulleted list of emoji+title.
 *   3. Brief beat → onComplete() → SaveYourONE.
 *
 * No login. No persona pick. No worlds/spaces. No name question — name is
 * collected later when the user saves their ONE.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { InputBar } from '../../components/mvp/InputBar';
import { TypingIndicator } from '../../components/mvp/TypingIndicator';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { parseDesires, desireToUnit } from '../../utils/mvpInferUnit';

type Phase = 'awaiting_input' | 'created' | 'done';

interface Bubble {
  from: 'one' | 'user';
  text: string;
  id: string;
}

export interface FirstConversationScreenProps {
  onComplete: () => void;
  /** Initial intention typed on Welcome — pre-fill the input so the user
   *  doesn't have to retype what they already wrote. */
  seedText?: string;
}

export function FirstConversationScreen({ onComplete, seedText }: FirstConversationScreenProps) {
  const { colors } = useThemeStore();
  const addUnits = useMvpStore((s) => s.addUnits);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const clearUnits = useMvpStore((s) => s.clearUnits);

  const [phase, setPhase] = useState<Phase>('awaiting_input');
  const [text, setText] = useState(seedText ?? '');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const idCounter = useRef(0);

  // Wipe seeded mock units on first render — this is the *first* conversation
  // for a brand-new user; spec wants the user's own intentions to populate Home.
  useEffect(() => {
    clearUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user typed on Welcome, auto-submit on mount so their first
  // intention becomes the opening bubble — no need to tap send again.
  const didAutoSubmit = useRef(false);
  useEffect(() => {
    if (didAutoSubmit.current) return;
    if (!seedText) return;
    didAutoSubmit.current = true;
    // Tiny beat so the screen renders with their text, then submits.
    const t = setTimeout(() => handleSubmit(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedText]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [bubbles, isTyping]);

  // Orb breathing — same vocabulary as Home/Welcome.
  const orbBreath = useSharedValue(1);
  useEffect(() => {
    orbBreath.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.000, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [orbBreath]);
  const orbBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbBreath.value }],
  }));

  // Eyes meet the user's gaze when input is focused.
  const focusSV = useSharedValue(0);
  useEffect(() => {
    focusSV.value = withTiming(inputFocused ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [inputFocused, focusSV]);
  const eyeLookY = useDerivedValue(() => {
    'worklet';
    return -focusSV.value * 0.35;
  });

  function nextId(): string {
    idCounter.current += 1;
    return `b${idCounter.current}`;
  }

  function pushBubble(from: 'one' | 'user', t: string) {
    setBubbles((prev) => [...prev, { from, text: t, id: nextId() }]);
  }

  const handleSubmit = () => {
    const value = text.trim();
    if (!value || phase !== 'awaiting_input') return;
    setText('');

    pushBubble('user', value);
    const desires = parseDesires(value);
    if (desires.length === 0) return;

    const units = desires.map((d) => desireToUnit(d, activeIdentityId));
    addUnits(units);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const intro =
        desires.length === 1
          ? 'I can turn that into 1 process:'
          : `I can turn that into ${desires.length} processes:`;
      pushBubble('one', intro);
    }, 600);

    setTimeout(() => {
      const list = units
        .map((u) => `${u.emoji}  ${u.title}`)
        .join('\n');
      pushBubble('one', list);
      setPhase('created');
    }, 1100);

    setTimeout(() => {
      pushBubble('one', "Let's start with these.");
    }, 1900);

    setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3200);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Animated.View style={orbBreathStyle}>
            <Orb size={64} eyeLookY={eyeLookY} />
          </Animated.View>
          {bubbles.length === 0 && (
            <Text style={[styles.headline, { color: colors.text }]}>
              Tell me what you want to move forward.
            </Text>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {bubbles.map((b) => (
            <View
              key={b.id}
              style={[
                styles.bubble,
                b.from === 'one'
                  ? [styles.oneBubble, { backgroundColor: colors.surface }]
                  : [styles.userBubble, { backgroundColor: colors.circle }],
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: b.from === 'one' ? colors.text : colors.background },
                ]}
              >
                {b.text}
              </Text>
            </View>
          ))}
          {isTyping && <TypingIndicator />}
        </ScrollView>

        <InputBar
          value={text}
          onChangeText={setText}
          placeholder="Start with anything on your mind…"
          onSubmit={handleSubmit}
          onPressVoice={handleSubmit}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          textInputProps={{
            editable: phase === 'awaiting_input',
            multiline: true,
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 30,
    letterSpacing: -0.01,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  oneBubble: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 6,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
});
