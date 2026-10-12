/**
 * PresenceHomeScreen — the "presence" home mode (behind the home-mode toggle;
 * classic + chat left untouched).
 *
 * Keeps ONE's calm hero — centered Orb + greeting + date, exactly like the
 * classic home — but renders ONE's proactive broadcast as CHAT BUBBLES right on
 * the same page: ONE is messaging you, not listing prompts on a dashboard. You
 * reply in the dock and the exchange continues inline, as bubbles, under the
 * hero; scroll on down and your processes are there.
 *
 * This is the synthesis Ariel asked for: the chat method, on the home page,
 * without becoming a bare full-screen chat. Reuses Orb / InputBar / UnitCard /
 * homeChat / invokeOneIntent / invokeAttentionLines so it never forks the model.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { InputBar } from '../../components/mvp/InputBar';
import { UnitCard } from '../../components/mvp/UnitCard';
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
import { oneHomeMessages } from '../../utils/oneOpener';
import { unitFromIntent } from '../../utils/intentToUnit';
import { extractRememberFact } from '../../utils/rememberIntent';
import { openDisclosureStrings } from '../../data/mvp/disclosure';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import type { ThemeColors } from '../../utils/theme';

interface PresenceHomeScreenProps {
  onOpenProfile?: () => void;
  onCreateProcess?: () => void;
  onOpenUnit?: (id: string) => void;
}

const ORB = 96;
const rid = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

function greetingFor(hour: number, he: boolean): string {
  if (hour < 5) return he ? 'שקט של אחרי חצות' : 'Quiet after midnight';
  if (hour < 12) return he ? 'בוקר טוב' : 'Good morning';
  if (hour < 17) return he ? 'צהריים טובים' : 'Good afternoon';
  if (hour < 22) return he ? 'ערב טוב' : 'Good evening';
  return he ? 'לילה טוב' : 'Good night';
}

function dateLine(he: boolean): string {
  const now = new Date();
  const loc = he ? 'he-IL' : 'en-US';
  try {
    const weekday = now.toLocaleDateString(loc, { weekday: 'short' });
    const dm = now.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
    const time = now.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
    return `${weekday} · ${dm} · ${time}`;
  } catch {
    return '';
  }
}

export function PresenceHomeScreen({ onOpenProfile, onCreateProcess, onOpenUnit }: PresenceHomeScreenProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();

  const chat = useMvpStore((s) => s.homeChat);
  const appendHomeChat = useMvpStore((s) => s.appendHomeChat);
  const name = useMvpStore((s) => s.name);
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);
  const addUnit = useMvpStore((s) => s.addUnit);
  const activeUnits = useActiveUnits();
  const identity = useActiveIdentity();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const greeting = name.trim() ? `${greetingFor(new Date().getHours(), he)}, ${name.trim()}.` : `${greetingFor(new Date().getHours(), he)}.`;
  const [stamp] = useState(() => dateLine(he));

  const appendOne = useCallback(
    (body: string) => {
      if (body.trim()) appendHomeChat({ id: `one_${rid()}`, from: 'one', text: body.trim(), ts: Date.now() });
    },
    [appendHomeChat],
  );

  // ── ONE SPEAKS FIRST — its broadcast arrives as chat bubbles, not a list. ──
  const didOpenRef = useRef(false);
  useEffect(() => {
    if (didOpenRef.current) return;
    didOpenRef.current = true;
    const st = useMvpStore.getState();
    const thread = st.homeChat;
    const last = thread[thread.length - 1];
    if (last && last.from === 'user') return; // don't talk over an unanswered message
    const todayIso = new Date().toISOString().slice(0, 10);
    if (st.lastDigestDate === todayIso && thread.length > 0) return;
    st.markDigestDelivered(todayIso);

    if (!hasOnboarded || activeUnits.length === 0) {
      appendOne(he ? 'אני כאן. על מה נתחיל לעבוד?' : "I'm here. What should we start on?");
      return;
    }
    // ONE's time-aware opener (same as the classic home) — a state summary +
    // the one move worth surfacing, as its own bubbles. Instant, no AI.
    oneHomeMessages(activeUnits, he, Date.now(), Math.floor(Date.now() / 86_400_000)).forEach(appendOne);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    haptic.tap();
    setText('');
    appendHomeChat({ id: `u_${rid()}`, from: 'user', text: value, ts: Date.now() });
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
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
        existingUnits: activeUnits.slice(0, 12).map((u) => ({ title: u.title, emoji: u.emoji, tags: u.tagIds })),
      });
      let createdId: string | null = null;
      if (intent.kind === 'create_process') {
        const u = unitFromIntent(intent, st.activeIdentityId, lang);
        if (u) { addUnit(u); createdId = u.id; }
      }
      appendOne(intent.reply || (he ? 'קיבלתי.' : 'Got it.'));
      if (createdId && onOpenUnit) {
        const openId = createdId;
        setTimeout(() => onOpenUnit(openId), 650);
      }
    } catch {
      appendOne(he ? 'לא הצלחתי כרגע. ננסה שוב?' : "That didn't go through. Try again?");
    } finally {
      setSending(false);
    }
  }, [text, sending, appendHomeChat, appendOne, he, identity?.name, activeUnits, lang, addUnit, onOpenUnit]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — same calm centre as the classic home: just ONE + a warm,
              time-aware greeting. No fixed date stat (that read as a dashboard);
              the day context appears as a chat-style divider below instead. */}
          <View style={styles.hero}>
            <Pressable onPress={() => { haptic.tap(); onOpenProfile?.(); }} accessibilityRole="button" accessibilityLabel="ONE">
              <Orb size={ORB} alive />
            </Pressable>
            <Text style={[styles.greeting, { color: colors.text }, rtlText(he ? 'he' : 'en')]}>{greeting}</Text>
          </View>

          {/* ONE's broadcast + the conversation — as bubbles, on the same page. */}
          <View style={styles.thread}>
            {!!stamp && (
              <Text style={[styles.dayDivider, { color: colors.textSecondary }]}>{stamp}</Text>
            )}
            {chat.filter((m) => !m.widget).map((m) => (
              <Bubble key={m.id} msg={m} colors={colors} he={he} />
            ))}
            {sending && (
              <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: colors.surface, alignSelf: 'flex-start' }]}>
                <Text style={[styles.typing, { color: colors.textSecondary }]}>⋯</Text>
              </View>
            )}
          </View>

          {/* Processes — right there when you scroll down. */}
          {activeUnits.length > 0 && (
            <View style={styles.list}>
              <Text style={[styles.listLabel, { color: colors.textSecondary }, rtlText(he ? 'he' : 'en')]}>
                {he ? 'התהליכים שלך' : 'Your processes'}
              </Text>
              {activeUnits.map((u) => (
                <UnitCard key={u.id} unit={u} onPress={() => onOpenUnit?.(u.id)} swipeDisabled />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 8, backgroundColor: colors.background }]}>
          <InputBar
            value={text}
            onChangeText={setText}
            onSubmit={send}
            onPressVoice={send}
            onPressPlus={onCreateProcess}
            placeholder=""
            textInputProps={{ onSubmitEditing: send, returnKeyType: 'send', blurOnSubmit: false }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ msg, colors, he }: { msg: ChatMessageStored; colors: ThemeColors; he: boolean }) {
  const isOne = msg.from === 'one';
  // ONE (received) on the start/left; you (sent) on the end/right — both langs.
  const align = isOne ? 'flex-start' : 'flex-end';
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[
        styles.bubble,
        isOne ? styles.bubbleOne : styles.bubbleUser,
        { alignSelf: align, backgroundColor: isOne ? colors.surface : colors.text },
      ]}
    >
      <Text
        style={[styles.bubbleText, { color: isOne ? colors.text : colors.background }, rtlText(he ? 'he' : 'en')]}
      >
        {msg.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  hero: { alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 20 },
  greeting: { fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32, paddingHorizontal: 8 },
  thread: { gap: 8, paddingTop: 4 },
  dayDivider: { fontSize: 12, fontWeight: '600', textAlign: 'center', letterSpacing: 0.2, opacity: 0.7, marginBottom: 6 },
  bubble: { maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  bubbleOne: { borderBottomStartRadius: 6 },
  bubbleUser: { borderBottomEndRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  typing: { fontSize: 20, lineHeight: 20, letterSpacing: 2 },
  list: { paddingTop: 22, gap: 10 },
  listLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 6, paddingHorizontal: 8 },
});
