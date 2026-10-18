/**
 * TimelineHomeScreen — the "conversation that compacts into a timeline" home
 * (behind the 'timeline' home mode; classic/chat/presence left untouched).
 *
 * The home is one ongoing conversation with ONE, but instead of an endless
 * thread it folds TIME into a single surface:
 *   • NOW sits in the middle — ONE's current line(s) in full + the composer.
 *   • SCROLL UP → the past, COMPACTED onto a timeline rail: each older turn is
 *     a one-line entry with a dot + time, grouped by day. The conversation
 *     literally compacts the moment it stops being "now".
 *   • SCROLL DOWN → the cards: the processes worth acting on, right there.
 *
 * Reuses every shared primitive (homeChat store, invokeOneIntent, unitFromIntent,
 * the oneHomeMessages opener, Orb, InputBar, ChatProcessCard) so it never forks
 * the core data model — same contract as the other alternate home screens.
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
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { InputBar } from '../../components/mvp/InputBar';
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
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import type { ThemeColors } from '../../utils/theme';

interface TimelineHomeScreenProps {
  onOpenProfile?: () => void;
  onCreateProcess?: () => void;
  onOpenUnit?: (id: string) => void;
}

const rid = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

function greetingFor(hour: number, he: boolean): string {
  if (hour < 5) return he ? 'לילה טוב' : 'Good night';
  if (hour < 12) return he ? 'בוקר טוב' : 'Good morning';
  if (hour < 17) return he ? 'צהריים טובים' : 'Good afternoon';
  if (hour < 22) return he ? 'ערב טוב' : 'Good evening';
  return he ? 'לילה טוב' : 'Good night';
}

/** Day bucket label for a timestamp: Today / Yesterday / a date. */
function dayLabel(ts: number, he: boolean): string {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return he ? 'היום' : 'Today';
  if (days === 1) return he ? 'אתמול' : 'Yesterday';
  try {
    return d.toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function timeLabel(ts: number, he: boolean): string {
  try {
    return new Date(ts).toLocaleTimeString(he ? 'he-IL' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function TimelineHomeScreen({ onOpenProfile, onCreateProcess, onOpenUnit }: TimelineHomeScreenProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();

  const chat = useMvpStore((s) => s.homeChat);
  const appendHomeChat = useMvpStore((s) => s.appendHomeChat);
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);
  const addUnit = useMvpStore((s) => s.addUnit);
  const activeUnits = useActiveUnits();
  const identity = useActiveIdentity();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Y of the NOW divider inside the scroll content, so we can park the viewport
  // on the present (past above, cards below) — the signature of this home.
  const nowYRef = useRef(0);
  const didScrollRef = useRef(false);

  const appendOne = useCallback(
    (body: string) => {
      if (body.trim()) appendHomeChat({ id: `one_${rid()}`, from: 'one', text: body.trim(), ts: Date.now() });
    },
    [appendHomeChat],
  );

  const scrollToNow = useCallback((animated: boolean) => {
    const y = Math.max(0, nowYRef.current - 8);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated }));
  }, []);

  // ── ONE SPEAKS FIRST — there is always a "now" to land on. ────────────────
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
    const greet = greetingFor(new Date().getHours(), he);
    appendOne(st.name.trim() ? `${greet}, ${st.name.trim()}.` : `${greet}.`);
    st.markDigestDelivered(todayIso);
    if (!hasOnboarded || activeUnits.length === 0) {
      appendOne(he ? 'אני כאן. על מה נתחיל?' : "I'm here. What should we start on?");
      return;
    }
    oneHomeMessages(activeUnits, he, Date.now(), Math.floor(Date.now() / 86_400_000)).forEach(appendOne);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split the thread into the compacted PAST and the live PRESENT. The present
  // is the current exchange — from the last thing you said onward, or ONE's
  // latest line when it spoke last and you haven't replied yet.
  const { past, live } = useMemo(() => {
    const msgs = chat;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].from === 'user') { lastUserIdx = i; break; }
    }
    const liveStart = lastUserIdx >= 0 ? lastUserIdx : Math.max(0, msgs.length - 1);
    return { past: msgs.slice(0, liveStart), live: msgs.slice(liveStart) };
  }, [chat]);

  // Group the past into day buckets for the timeline rail.
  const pastDays = useMemo(() => {
    const groups: Array<{ day: string; items: ChatMessageStored[] }> = [];
    for (const m of past) {
      if (m.widget && !m.text?.trim()) continue; // skip bare widget placeholders
      const day = dayLabel(m.ts, he);
      const tail = groups[groups.length - 1];
      if (tail && tail.day === day) tail.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [past, he]);

  const send = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    haptic.tap();
    setText('');
    appendHomeChat({ id: `u_${rid()}`, from: 'user', text: value, ts: Date.now() });
    requestAnimationFrame(() => scrollToNow(true));
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
      if (createdId) {
        appendHomeChat({ id: `w_${rid()}`, from: 'one', text: '', ts: Date.now(), widget: { kind: 'process', unitId: createdId } });
      }
      requestAnimationFrame(() => scrollToNow(true));
    } catch {
      appendOne(he ? 'לא הצלחתי כרגע. ננסה שוב?' : "That didn't go through. Try again?");
    } finally {
      setSending(false);
    }
  }, [text, sending, appendHomeChat, appendOne, scrollToNow, he, identity?.name, activeUnits, lang, addUnit]);

  const onNowLayout = useCallback((e: LayoutChangeEvent) => {
    nowYRef.current = e.nativeEvent.layout.y;
    if (!didScrollRef.current) {
      didScrollRef.current = true;
      scrollToNow(false);
    }
  }, [scrollToNow]);

  const liveWidgetUnitId = (m: ChatMessageStored) => (m.widget?.kind === 'process' ? m.widget.unitId : null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header: ONE as the calm face of the home. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptic.tap(); onOpenProfile?.(); }}
          style={styles.presence}
          accessibilityRole="button"
          accessibilityLabel="ONE"
        >
          <Orb size={50} alive noShadow />
          <Text style={[styles.headerTitle, { color: colors.text }]}>ONE</Text>
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
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 84 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── THE PAST, compacted onto a timeline rail ─────────────────── */}
          {pastDays.length > 0 && (
            <View style={styles.timeline}>
              <View style={[styles.rail, { backgroundColor: colors.border }]} pointerEvents="none" />
              {pastDays.map((g) => (
                <View key={g.day} style={styles.dayGroup}>
                  <Text style={[styles.dayLabel, { color: colors.textSecondary }, rtlText(he ? 'he' : 'en')]}>{g.day}</Text>
                  {g.items.map((m) => (
                    <View key={m.id} style={[styles.tlRow, rtlRow(lang)]}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: m.from === 'one' ? colors.text : colors.surface,
                            borderColor: colors.text,
                          },
                        ]}
                      />
                      <Text style={[styles.tlTime, { color: colors.textSecondary }]}>{timeLabel(m.ts, he)}</Text>
                      <Text
                        style={[styles.tlText, { color: colors.textSecondary }, rtlText(he ? 'he' : 'en')]}
                        numberOfLines={1}
                      >
                        {m.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* ── NOW — the present: ONE's current line(s) in full ─────────── */}
          <View style={styles.nowDivider} onLayout={onNowLayout}>
            <View style={[styles.nowLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.nowLabel, { color: colors.textSecondary }]}>{he ? 'עכשיו' : 'Now'}</Text>
            <View style={[styles.nowLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.present}>
            {live.map((m) => {
              const wid = liveWidgetUnitId(m);
              if (wid) {
                return (
                  <Animated.View key={m.id} entering={FadeInDown.duration(240)} style={styles.widgetWrap}>
                    <ChatProcessCard unitId={wid} onOpen={onOpenUnit} />
                  </Animated.View>
                );
              }
              if (!m.text?.trim()) return null;
              return <PresentLine key={m.id} msg={m} colors={colors} he={he} />;
            })}
            {sending && (
              <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: colors.surface, alignSelf: 'flex-start' }]}>
                <Text style={[styles.typing, { color: colors.textSecondary }]}>⋯</Text>
              </View>
            )}
          </View>

          {/* ── DOWN — the cards: processes worth acting on ──────────────── */}
          {activeUnits.length > 0 && (
            <View style={styles.cards}>
              <Text style={[styles.cardsLabel, { color: colors.textSecondary }, rtlText(he ? 'he' : 'en')]}>
                {he ? 'לפעול עכשיו' : 'To act on'}
              </Text>
              {activeUnits.map((u) => (
                <View key={u.id} style={styles.cardWrap}>
                  <ChatProcessCard unitId={u.id} onOpen={onOpenUnit} />
                </View>
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
            placeholder={he ? 'כתוב לוואן…' : 'Message ONE…'}
            compact
            textInputProps={{ onSubmitEditing: send, returnKeyType: 'send', blurOnSubmit: false }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function PresentLine({ msg, colors, he }: { msg: ChatMessageStored; colors: ThemeColors; he: boolean }) {
  const isOne = msg.from === 'one';
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[
        styles.bubble,
        isOne ? styles.bubbleOne : styles.bubbleUser,
        { alignSelf: isOne ? 'flex-start' : 'flex-end', backgroundColor: isOne ? colors.surface : colors.text },
      ]}
    >
      <Text style={[styles.bubbleText, { color: isOne ? colors.text : colors.background }, rtlText(he ? 'he' : 'en')]}>
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
    paddingTop: 4,
    paddingBottom: 8,
  },
  presence: { alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  plusAbs: { position: 'absolute', top: 4, insetInlineStart: 14 },
  headerPlus: { fontSize: 24, fontWeight: '400', lineHeight: 26 },
  content: { paddingHorizontal: 16, paddingTop: 6 },

  // Timeline (the compacted past)
  timeline: { position: 'relative', paddingTop: 4 },
  rail: { position: 'absolute', insetInlineStart: 5, top: 10, bottom: 6, width: 2, borderRadius: 1, opacity: 0.6 },
  dayGroup: { marginBottom: 10 },
  dayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6, marginInlineStart: 20, opacity: 0.8 },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, marginInlineEnd: 3 },
  tlTime: { fontSize: 11, fontVariant: ['tabular-nums'], minWidth: 42 },
  tlText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // Now
  nowDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 10 },
  nowLine: { flex: 1, height: StyleSheet.hairlineWidth },
  nowLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  present: { gap: 8 },
  widgetWrap: { alignSelf: 'stretch' },
  bubble: { maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  bubbleOne: { borderBottomStartRadius: 6 },
  bubbleUser: { borderBottomEndRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  typing: { fontSize: 20, lineHeight: 20, letterSpacing: 2 },

  // Cards (scroll down)
  cards: { paddingTop: 22, gap: 10 },
  cardsLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  cardWrap: { alignSelf: 'stretch' },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 6, paddingHorizontal: 8 },
});
