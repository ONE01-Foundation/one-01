/**
 * אונבורדינג אחד: ספלאש קצר → קלף צ׳אט כמו במוצר (כותרת, בועות, קומפוזר) —
 * הדגמה, בחירת דמות קומפקטית בבועה, שמות ויעד בצ׳אט, שמירה.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { OrbAgent } from '../components/OrbAgent';
import { ChatBackArrowIcon } from '../components/icons/ChatBackArrowIcon';
import { useOnboardingDraftStore } from '../stores/onboardingDraftStore';
import { translate, embedLatinRunsForRtlDisplay } from '../i18n/strings';
import { onboardingChatStyles as S } from './onboardingChatStyles';
import { SaveOneAccountPanel } from './SaveOneAccountScreen';
import type { AgentPersona } from '../core/types';

const AGENT_ORB = 72;
const LOGO_BASE = 120;
/** כמו כפתור שדרג ב-OneScreen */
const UPGRADE_GOLD = '#e6bf3f';
const UPGRADE_GOLD_TEXT = '#111111';

const PLUS_PATH =
  'M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z';

const DEMO_SLIDES: { he: { t: string; b: string }; en: { t: string; b: string } }[] = [
  {
    he: { t: 'משהו אחד שמוביל', b: 'ONE מחבר בין כוונה לביצוע — צעדים, זמן, ומה שקורה באמת.' },
    en: { t: 'One thread from intent to done', b: 'ONE connects what you want with what happens next—steps, time, and reality checks.' },
  },
  {
    he: { t: 'יחידות שאפשר לסיים', b: 'כל יחידה היא מסלול ברור: מה נסגר, מה נשאר, ומה השלב הבא.' },
    en: { t: 'Units you can actually finish', b: 'Each unit is a clear path: what’s done, what’s open, and the next move—without the noise.' },
  },
  {
    he: { t: 'סוכן שמכיר אותך', b: 'שפה אחת, זיכרון אחד, ועדכונים קצרים כשיש מה לדווח.' },
    en: { t: 'An agent that stays in sync', b: 'One voice, one memory, and short updates when something important changes.' },
  },
];

const PERSONA_CHIPS: {
  persona: AgentPersona;
  emoji: string;
  he: string;
  en: string;
}[] = [
  { persona: 'neutral', emoji: '⚫', he: 'מינימלי', en: 'Minimal' },
  { persona: 'professional', emoji: '🤖', he: 'מקצועי', en: 'Pro' },
  { persona: 'friendly', emoji: '🦒', he: 'חמים', en: 'Warm' },
];

type Msg = { id: string; role: 'one' | 'user'; text: string };

type Phase =
  | 'splash'
  | 'chat'
  | 'pick_persona'
  | 'ask_agent_name'
  | 'ask_user_name'
  | 'ask_goal'
  | 'broadcast'
  | 'save';

export function OnboardingFlowScreen() {
  const { colors, theme } = useThemeStore();
  const { language } = useLocaleStore();
  const he = language === 'he';
  const isRtl = language === 'he';
  const isDark = theme === 'dark';
  const { height: winH, width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const resetDraft = useOnboardingDraftStore((s) => s.reset);
  const draftAgentName = useOnboardingDraftStore((s) => s.agentName);
  const setPersona = useOnboardingDraftStore((s) => s.setPersona);
  const setAgentName = useOnboardingDraftStore((s) => s.setAgentName);
  const setUserName = useOnboardingDraftStore((s) => s.setUserName);
  const setFirstUnit = useOnboardingDraftStore((s) => s.setFirstUnit);

  const [phase, setPhase] = useState<Phase>('splash');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [createCtaVisible, setCreateCtaVisible] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const introDoneRef = useRef(false);
  const pickPersonaPromptRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const chatBg = isDark ? '#121212' : colors.background;
  const oneBubbleBg = isDark ? '#ECEDEE' : '#f0f0f0';
  const avatarBg = theme === 'light' ? '#000000' : '#1f1f1f';
  const sheetMaxW = Math.min(winW, 460);
  const splashBg = isDark ? '#000000' : '#ffffff';
  /** כהה: כדור אפור על שחור · בהיר: כדור שחור על לבן */
  const splashLogoCircle = isDark ? '#d4d4d4' : '#000000';
  const chatActionButtonBg = isDark ? '#ffffff' : '#000000';
  const chatActionIconColor = isDark ? '#111111' : '#ffffff';

  const headerTitle = draftAgentName.trim()
    ? embedLatinRunsForRtlDisplay(draftAgentName.trim(), language)
    : translate(language, 'chat_title_default');
  const headerSub = translate(language, 'chat_status_agent');

  const pushMsg = useCallback((m: Msg) => {
    setMessages((prev) => [...prev, m]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  useEffect(() => {
    resetDraft();
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [resetDraft]);

  /** ספלאש — בלי שכבות מחולפות */
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const blackOrbScale = useRef(new Animated.Value(0.2)).current;
  const blackOrbOpacity = useRef(new Animated.Value(1)).current;
  const stackTranslateY = useRef(new Animated.Value(0)).current;
  const faceOpacity = useRef(new Animated.Value(0)).current;
  const targetLift = -Math.min(160, winH * 0.2);

  useEffect(() => {
    if (phase !== 'splash') return;
    const t = setTimeout(() => {
      heroOpacity.setValue(1);
      Animated.sequence([
        Animated.timing(blackOrbScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(stackTranslateY, {
            toValue: targetLift,
            duration: 750,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(blackOrbScale, {
            toValue: AGENT_ORB / LOGO_BASE,
            duration: 750,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(blackOrbOpacity, {
            toValue: 0,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(faceOpacity, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setPhase('chat'));
    }, 600);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [phase, blackOrbOpacity, blackOrbScale, faceOpacity, heroOpacity, stackTranslateY, targetLift]);

  /** הודעות פתיחה בצ׳אט — רצף ברור, בלי קרוסלה על גבי כותרות */
  useEffect(() => {
    if (phase !== 'chat' || introDoneRef.current) return;
    introDoneRef.current = true;
    const mk = (text: string): Msg => ({ id: `m_${Date.now()}_${Math.random()}`, role: 'one', text });
    const schedule = (delay: number, fn: () => void) => {
      const id = setTimeout(fn, delay);
      timersRef.current.push(id);
    };
    let d = 200;
    schedule(d, () =>
      pushMsg(mk(he ? 'אני ONE' : 'I Am One'))
    );
    d += 450;
    schedule(d, () =>
      pushMsg(mk(he ? 'תגיד מה אתה רוצה — והשאר אצלי.' : 'Just say what you want.'))
    );
    DEMO_SLIDES.forEach((slide, i) => {
      d += 550;
      const c = he ? slide.he : slide.en;
      schedule(d, () => pushMsg(mk(`${c.t}\n\n${c.b}`)));
    });
    d += 700;
    schedule(d, () => setCreateCtaVisible(true));
  }, [phase, he, pushMsg]);

  const onBackPress = useCallback(() => {
    if (phase === 'splash') return;
    Alert.alert(
      he ? 'לצאת מההקמה?' : 'Leave setup?',
      he ? 'ההתקדמות הנוכחית תאבד.' : 'Your current progress will be lost.',
      [
        { text: he ? 'ביטול' : 'Cancel', style: 'cancel' },
        {
          text: he ? 'יציאה' : 'Exit',
          style: 'destructive',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              BackHandler.exitApp();
            }
          },
        },
      ]
    );
  }, [he, navigation, phase]);

  const onCreateMyOne = () => {
    setCreateCtaVisible(false);
    setPhase('pick_persona');
  };

  useEffect(() => {
    if (phase !== 'pick_persona' || pickPersonaPromptRef.current) return;
    pickPersonaPromptRef.current = true;
    pushMsg({
      id: `askp_${Date.now()}`,
      role: 'one',
      text: he
        ? 'איך אני נראה לך בצ׳אט? בחרו סגנון קצר (אפשר לשנות בהגדרות).'
        : 'How should I show up in chat? Pick a style (you can change this in Settings).',
    });
  }, [phase, he, pushMsg]);

  const onPickPersona = (p: AgentPersona, label: string) => {
    setPersona(p);
    pushMsg({ id: `u_${Date.now()}`, role: 'user', text: label });
    setPhase('ask_agent_name');
    pushMsg({
      id: `a_${Date.now()}`,
      role: 'one',
      text: he
        ? 'מעולה. איך תרצה לקרוא לי? (ONE, כינוי…)'
        : 'Nice. What should I go by? (ONE, a nickname…)',
    });
  };

  const onSend = () => {
    const t = input.trim();
    if (!t) return;
    setComposerExpanded(false);
    pushMsg({ id: `u_${Date.now()}`, role: 'user', text: t });
    setInput('');
    if (phase === 'ask_agent_name') {
      setAgentName(t);
      setPhase('ask_user_name');
      pushMsg({
        id: `a_${Date.now()}`,
        role: 'one',
        text: he ? 'ואיך אני קורא לך?' : 'And what should I call you?',
      });
      return;
    }
    if (phase === 'ask_user_name') {
      setUserName(t);
      setPhase('ask_goal');
      pushMsg({
        id: `a_${Date.now()}`,
        role: 'one',
        text: he
          ? 'מה נסגור ביחידה הראשונה? משפט אחד מספיק.'
          : 'What’s the first unit we’ll tackle? One sentence is enough.',
      });
      return;
    }
    if (phase === 'ask_goal') {
      setFirstUnit(t, t);
      setPhase('broadcast');
      const title = t;
      const bc = he
        ? `לפי מה ששיתפת, נתחיל ביחידה «${title}». נשבור לצעדים, נבדוק חוסמים וזמנים, ונעדכן בקצרה כשיש מה לדווח.`
        : `From what you shared, we’ll start “${title}”. We’ll break it into steps, watch timing and blockers, and send short updates when it matters.`;
      pushMsg({ id: `a_${Date.now()}`, role: 'one', text: bc });
      pushMsg({
        id: `a_${Date.now()}`,
        role: 'one',
        text: he ? 'כשתהיה מוכן — שמור ונכנס לבית.' : 'When you’re ready, save and we’ll head home.',
      });
      const tid = setTimeout(() => setPhase('save'), 900);
      timersRef.current.push(tid);
    }
  };

  const showComposer = phase === 'ask_agent_name' || phase === 'ask_user_name' || phase === 'ask_goal';
  const showPersonaChips = phase === 'pick_persona';

  if (phase === 'splash') {
    return (
      <View style={[styles.splashRoot, { backgroundColor: splashBg }]}>
        <Animated.View style={[styles.splashHero, { opacity: heroOpacity }]}>
          <Animated.View style={{ alignItems: 'center', transform: [{ translateY: stackTranslateY }] }}>
            <View style={{ width: LOGO_BASE, height: LOGO_BASE, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: LOGO_BASE,
                  height: LOGO_BASE,
                  borderRadius: LOGO_BASE / 2,
                  backgroundColor: splashLogoCircle,
                  transform: [{ scale: blackOrbScale }],
                  opacity: blackOrbOpacity,
                }}
              />
              <Animated.View style={{ opacity: faceOpacity }}>
                <OrbAgent size={AGENT_ORB} state="idle" mode="home" showFace labelLines={[]} />
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: chatBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.sheetOuter, { paddingTop: insets.top + 6, width: winW, alignItems: 'center' }]}>
        <View style={[S.sheet, { backgroundColor: chatBg, width: sheetMaxW, borderTopLeftRadius: 22, borderTopRightRadius: 22 }]}>
          <View style={[S.topBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={S.iconBtn} onPress={onBackPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={he ? 'חזרה' : 'Back'}>
              <ChatBackArrowIcon color={colors.textSecondary} rtl={isRtl} size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={S.headerProfileBtn} activeOpacity={0.85}>
              <View style={[S.avatar, { backgroundColor: avatarBg }]}>
                <OrbAgent size={40} state="idle" mode="home" showFace labelLines={[]} />
              </View>
              <View style={S.headerText}>
                <Text
                  style={[S.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                  numberOfLines={1}
                >
                  {headerTitle}
                </Text>
                <Text
                  style={[S.subtitle, { color: colors.textSecondary, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                  numberOfLines={1}
                >
                  {headerSub}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={S.freeBadge}>
              <Text style={S.freeBadgeText}>FREE</Text>
            </View>
            <TouchableOpacity style={S.menuBtn} activeOpacity={0.7}>
              <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
              <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
              <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
            </TouchableOpacity>
          </View>

          <View style={S.threadWrap}>
            <ScrollView
              ref={scrollRef}
              style={S.scroll}
              contentContainerStyle={S.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    S.bubble,
                    msg.role === 'user' ? S.bubbleUser : S.bubbleOne,
                    msg.role === 'one' ? { backgroundColor: oneBubbleBg } : null,
                  ]}
                >
                  <Text
                    style={[
                      S.bubbleText,
                      msg.role === 'user' ? S.bubbleTextUser : S.bubbleTextOne,
                      { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              ))}
              {showPersonaChips ? (
                <View style={S.chipRow}>
                  {PERSONA_CHIPS.map((row) => (
                    <TouchableOpacity
                      key={row.persona}
                      style={[S.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={() => onPickPersona(row.persona, he ? row.he : row.en)}
                    >
                      <Text style={[S.chipLabel, { color: colors.text }]}>
                        {row.emoji} {he ? row.he : row.en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {createCtaVisible && phase === 'chat' ? (
                <TouchableOpacity
                  style={styles.createCta}
                  activeOpacity={0.88}
                  onPress={onCreateMyOne}
                  accessibilityRole="button"
                  accessibilityLabel={he ? 'צור את ה-ONE שלי' : 'Create My One'}
                >
                  <Text style={styles.createCtaText}>{he ? 'צור את ה-ONE שלי' : 'Create My One'}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>

          {showComposer ? (
            <View style={[styles.compOuter, { borderTopColor: colors.border, backgroundColor: chatBg, paddingBottom: (insets.bottom || 6) + 6 }]}>
              {composerExpanded ? (
                <View style={[styles.compExpandedPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.compCollapseBtn, isRtl ? { left: 10 } : { right: 10 }]}
                    onPress={() => setComposerExpanded(false)}
                    hitSlop={8}
                  >
                    <Text style={[styles.compCollapseGlyph, { color: colors.textSecondary }]}>↙</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.compExpandedInput,
                      { color: colors.text, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
                    ]}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    autoFocus
                    placeholderTextColor={colors.textSecondary}
                    placeholder={he ? 'הקלד…' : 'Type…'}
                  />
                  <View style={styles.compExpandedFooter}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={[styles.sendBtn, { backgroundColor: chatActionButtonBg }]}
                      onPress={onSend}
                      hitSlop={6}
                      activeOpacity={0.82}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 20V6M12 6L6.75 11.25M12 6L17.25 11.25"
                          fill="none"
                          stroke={chatActionIconColor}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.compRowOuter}>
                  <View style={[styles.compRow, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity style={styles.plusWrap} activeOpacity={0.8} hitSlop={6}>
                      <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
                        <Path d={PLUS_PATH} fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} />
                      </Svg>
                    </TouchableOpacity>
                    <View style={styles.compFieldSlot}>
                      <TextInput
                        style={[
                          styles.compField,
                          styles.compFieldSingle,
                          { color: colors.text, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
                        ]}
                        placeholder={he ? 'הקלד…' : 'Type…'}
                        placeholderTextColor={colors.textSecondary}
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={onSend}
                        returnKeyType="send"
                      />
                      {input.trim().length > 0 ? (
                        <TouchableOpacity
                          style={[styles.compExpandBtn, isRtl ? { left: 2 } : { right: 2 }]}
                          onPress={() => setComposerExpanded(true)}
                          hitSlop={6}
                        >
                          <Text style={[styles.compExpandGlyph, { color: colors.textSecondary }]}>↗</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.sendBtn, { backgroundColor: chatActionButtonBg }]}
                      onPress={onSend}
                      hitSlop={6}
                      activeOpacity={0.82}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 20V6M12 6L6.75 11.25M12 6L17.25 11.25"
                          fill="none"
                          stroke={chatActionIconColor}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ height: insets.bottom + 8 }} />
          )}
        </View>
      </View>

      <Modal visible={phase === 'save'} animationType="slide" transparent>
        <View style={styles.saveModalRoot}>
          <View style={styles.saveScrim} />
          <View style={[styles.saveDock, { paddingBottom: 0 }]}>
            <SaveOneAccountPanel />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splashRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashHero: { alignItems: 'center', justifyContent: 'center' },
  sheetOuter: { flex: 1, flexDirection: 'column', minHeight: 0 },
  createCta: {
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: UPGRADE_GOLD,
  },
  createCtaText: {
    color: UPGRADE_GOLD_TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  compOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  compExpandedPanel: {
    flexDirection: 'column',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 36,
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginBottom: 10,
    minHeight: 160,
    maxHeight: 240,
  },
  compCollapseBtn: {
    position: 'absolute',
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  compCollapseGlyph: { fontSize: 18, fontWeight: '700' },
  compExpandedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 4,
  },
  compExpandedInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  compRowOuter: { alignItems: 'center' },
  compRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52,
  },
  plusWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compFieldSlot: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    justifyContent: 'center',
  },
  compField: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 6,
    paddingVertical: 10,
    minWidth: 0,
  },
  compFieldSingle: {
    minHeight: 44,
    maxHeight: 52,
  },
  compExpandBtn: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  compExpandGlyph: { fontSize: 15, fontWeight: '700' },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  saveModalRoot: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'flex-end' },
  saveScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  saveDock: { width: '100%' },
});
