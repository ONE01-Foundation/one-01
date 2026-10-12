/**
 * ChatHomeScreen — the "Home = conversation" paradigm (behind the 'chat' home
 * mode; the classic home is untouched).
 *
 * The home IS one continuous chat thread with ONE. ONE SPEAKS FIRST: you open
 * the app to a message already waiting, like a contact who texted you. ONE's
 * proactive updates (what the classic home shows as the resting "broadcast")
 * land here as ONE's own chat bubbles, synthesised from your real processes +
 * what ONE remembers + what you've allowed it to represent (selective
 * disclosure). This is our sharpest contrast with "agent" products that only
 * bring results back for review: ONE is a PRESENCE that reaches out first.
 *
 * v1 reuses every shared primitive (homeChat store, invokeOneIntent /
 * invokeAttentionLines, unitFromIntent, Orb, InputBar) so nothing here forks
 * the core data model.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { InputBar } from '../../components/mvp/InputBar';
import { RepresentativeSetup } from '../../components/mvp/RepresentativeSetup';
import { ChatProcessCard } from '../../components/mvp/ChatProcessCard';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import {
  useMvpStore,
  useActiveUnits,
  useActiveIdentity,
  disclosureForIdentity,
  type ChatMessageStored,
} from '../../stores/mvpStore';
import { invokeOneIntent } from '../../services/aiChat';
import { unitFromIntent } from '../../utils/intentToUnit';
import { extractRememberFact } from '../../utils/rememberIntent';
import { openDisclosureStrings } from '../../data/mvp/disclosure';
import { oneHomeMessages } from '../../utils/oneOpener';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import type { ThemeColors } from '../../utils/theme';

interface ChatHomeScreenProps {
  /** Tap the ONE orb / title → open the ONE profile (or sign-in when not yet
   *  onboarded). */
  onOpenProfile?: () => void;
  /** The + button → quick actions / create a process. */
  onCreateProcess?: () => void;
  /** Open a process (e.g. the one ONE just created from the conversation). */
  onOpenUnit?: (id: string) => void;
}

function greetingFor(hour: number, he: boolean): string {
  if (hour < 5) return he ? 'לילה טוב' : 'Good night';
  if (hour < 12) return he ? 'בוקר טוב' : 'Good morning';
  if (hour < 17) return he ? 'צהריים טובים' : 'Good afternoon';
  if (hour < 22) return he ? 'ערב טוב' : 'Good evening';
  return he ? 'לילה טוב' : 'Good night';
}

const rid = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

export function ChatHomeScreen({ onOpenProfile, onCreateProcess, onOpenUnit }: ChatHomeScreenProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();

  const chat = useMvpStore((s) => s.homeChat);
  const appendHomeChat = useMvpStore((s) => s.appendHomeChat);
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);
  const markOnboardingComplete = useMvpStore((s) => s.markOnboardingComplete);
  const addUnit = useMvpStore((s) => s.addUnit);
  const activeUnits = useActiveUnits();
  const identity = useActiveIdentity();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const appendOne = useCallback(
    (body: string) => {
      if (!body.trim()) return;
      appendHomeChat({ id: `one_${rid()}`, from: 'one', text: body.trim(), ts: Date.now() });
    },
    [appendHomeChat],
  );
  const appendUser = useCallback(
    (body: string) => {
      appendHomeChat({ id: `u_${rid()}`, from: 'user', text: body, ts: Date.now() });
    },
    [appendHomeChat],
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);
  useEffect(scrollToEnd, [chat.length, scrollToEnd]);

  // ── ONE SPEAKS FIRST ──────────────────────────────────────────────────────
  // On arrival, if ONE isn't already waiting with a fresh message, it posts a
  // proactive opener: a greeting, then (when there are processes) one concrete
  // beat drawn from them. Gated once a day via lastDigestDate so it greets anew
  // each day without spamming every reopen.
  const didOpenRef = useRef(false);
  useEffect(() => {
    if (didOpenRef.current) return;
    didOpenRef.current = true;
    const st = useMvpStore.getState();
    const thread = st.homeChat;
    const last = thread[thread.length - 1];
    // Don't talk over an unanswered user message (send() will handle it).
    if (last && last.from === 'user') return;
    const todayIso = new Date().toISOString().slice(0, 10);

    // First run — ONE introduces itself as your representative; the SETUP WIDGET
    // renders just below this intro (see the thread). Intro once only.
    if (!st.hasCompletedOnboarding) {
      if (thread.some((m) => m.from === 'one')) return;
      appendOne(he ? 'היי 👋 אני וואן — הנציג הדיגיטלי שלך.' : "Hi 👋 I'm ONE — your digital representative.");
      appendOne(
        he
          ? 'אני מנהל איתך תהליכים ומייצג אותך מול העולם — וחושף רק מה שתרשה. בוא נגדיר אותי קצר.'
          : "I run your processes and represent you to the world — sharing only what you allow. Let's set me up quickly.",
      );
      return;
    }

    // Already greeted today and the thread isn't empty → leave it be.
    if (st.lastDigestDate === todayIso && thread.length > 0) return;
    const hour = new Date().getHours();
    const greet = greetingFor(hour, he);
    appendOne(st.name.trim() ? `${greet}, ${st.name.trim()}.` : `${greet}.`);
    st.markDigestDelivered(todayIso);

    if (activeUnits.length === 0) {
      appendOne(he ? 'על מה נתחיל לעבוד?' : 'What should we start on?');
      return;
    }
    // ONE's time-aware opener — a state summary + the one move worth surfacing.
    oneHomeMessages(activeUnits, he, Date.now(), Math.floor(Date.now() / 86_400_000)).forEach(appendOne);
    // Run once on mount; intentionally no deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Completing setup finishes onboarding and ONE moves into the real work.
  const handleSetupDone = useCallback(() => {
    haptic.tap();
    markOnboardingComplete();
    appendOne(he ? 'מעולה — הנציג שלך מוכן. במה נתחיל?' : 'Great — your representative is ready. What should we start on?');
    scrollToEnd();
  }, [markOnboardingComplete, appendOne, he, scrollToEnd]);

  // ── The user replies — ONE acts, in the SAME thread ──────────────────────
  const send = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    haptic.tap();
    setText('');
    appendUser(value);
    scrollToEnd();
    // Starting to talk also completes setup (the widget then steps aside; the
    // emblem/voice stay at their defaults and can be tuned later in the profile).
    if (!useMvpStore.getState().hasCompletedOnboarding) markOnboardingComplete();

    // "remember that…" is captured as a memory, not sent to the model.
    const fact = extractRememberFact(value);
    if (fact) {
      useMvpStore.getState().addMemory(fact);
      appendOne(he ? `אזכור את זה: ${fact}` : `Got it — I'll remember: ${fact}`);
      return;
    }

    setSending(true);
    try {
      const st = useMvpStore.getState();
      const intent = await invokeOneIntent(value, {
        identityName: identity?.name,
        unitsCount: activeUnits.length,
        voiceStyle: personalityPrompt(st.agentPersonality, lang),
        history: st.homeChat.slice(-6).map((m) => ({
          role: m.from === 'one' ? ('assistant' as const) : ('user' as const),
          content: m.text,
        })),
        userMemories: st.memories.map((m) => m.text),
        userDisclosure: openDisclosureStrings(disclosureForIdentity(st.activeIdentityId), he),
        existingUnits: activeUnits.slice(0, 12).map((u) => ({
          title: u.title,
          emoji: u.emoji,
          tags: u.tagIds,
        })),
      });

      let createdId: string | null = null;
      if (intent.kind === 'create_process') {
        const u = unitFromIntent(intent, st.activeIdentityId, lang);
        if (u) {
          addUnit(u);
          createdId = u.id;
        }
      }
      appendOne(intent.reply || (he ? 'קיבלתי.' : 'Got it.'));
      if (createdId) {
        // ONE sends the process it just opened as a WIDGET in the thread — a
        // live card with a way in — instead of a "tap me" line. The conversation
        // stays the center; the user opens it when they want.
        appendHomeChat({ id: `w_${rid()}`, from: 'one', text: '', ts: Date.now(), widget: { kind: 'process', unitId: createdId } });
        scrollToEnd();
      }
    } catch {
      appendOne(he ? 'אופס, לא הצלחתי כרגע. ננסה שוב?' : "Hmm, that didn't go through. Try again?");
    } finally {
      setSending(false);
    }
  }, [text, sending, appendUser, appendOne, scrollToEnd, he, identity?.name, activeUnits, lang, addUnit, onOpenUnit, markOnboardingComplete]);

  const visible = useMemo(() => chat, [chat]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header: ONE as a prominent, living presence (your representative). The
          orb stays the face of the home — not a tiny icon. Tap → profile. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptic.tap(); onOpenProfile?.(); }}
          style={styles.presence}
          accessibilityRole="button"
          accessibilityLabel="ONE"
        >
          <Orb size={54} alive noShadow />
          <Text style={[styles.headerTitle, { color: colors.text }]}>ONE</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {he ? 'הנציג שלך' : 'Your representative'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { haptic.tap(); onCreateProcess?.(); }}
          hitSlop={12}
          style={[styles.headerBtn, styles.plusAbs, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'תהליך חדש' : 'New process'}
        >
          <Text style={[styles.headerPlus, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 4}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
        >
          {visible.map((m) =>
            m.widget?.kind === 'process' ? (
              <Animated.View key={m.id} entering={FadeInDown.duration(240)} style={styles.widgetWrap}>
                <ChatProcessCard unitId={m.widget.unitId} onOpen={onOpenUnit} />
              </Animated.View>
            ) : (
              <Bubble key={m.id} msg={m} colors={colors} he={he} />
            ),
          )}
          {/* First widget in the conversation: set up your representative. */}
          {!hasOnboarded && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.widgetWrap}>
              <RepresentativeSetup onDone={handleSetupDone} />
            </Animated.View>
          )}
          {sending && (
            <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: colors.surface, alignSelf: 'flex-start' }]}>
              <Text style={[styles.typing, { color: colors.textSecondary }]}>⋯</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 8 }]}>
          <InputBar
            value={text}
            onChangeText={setText}
            onSubmit={send}
            onPressVoice={send}
            onPressPlus={onCreateProcess}
            placeholder={he ? 'כתוב לוואן…' : 'Message ONE…'}
            compact
            textInputProps={{ onSubmitEditing: send, returnKeyType: 'send', blurOnSubmit: false }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({
  msg,
  colors,
  he,
}: {
  msg: ChatMessageStored;
  colors: ThemeColors;
  he: boolean;
}) {
  const isOne = msg.from === 'one';
  // ONE (received) always sits on the start/left; you (sent) on the end/right —
  // same in both languages, per the chosen home layout.
  const align = isOne ? 'flex-start' : 'flex-end';
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[
        styles.bubble,
        isOne ? styles.bubbleOne : styles.bubbleUser,
        {
          alignSelf: align,
          backgroundColor: isOne ? colors.surface : colors.text,
        },
      ]}
    >
      <Text
        style={[
          styles.bubbleText,
          { color: isOne ? colors.text : colors.background },
          rtlText(he ? 'he' : 'en'),
        ]}
      >
        {msg.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  presence: { alignItems: 'center', gap: 4 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusAbs: { position: 'absolute', top: 6, insetInlineStart: 14 },
  headerPlus: { fontSize: 24, fontWeight: '400', lineHeight: 26 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  headerSub: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  widgetWrap: { alignSelf: 'stretch', marginTop: 4 },
  thread: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bubbleOne: { borderBottomStartRadius: 6 },
  bubbleUser: { borderBottomEndRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  typing: { fontSize: 20, lineHeight: 20, letterSpacing: 2 },
  dock: {
    paddingTop: 6,
    paddingHorizontal: 8,
  },
});
