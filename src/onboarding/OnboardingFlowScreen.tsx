/**
 * אונבורדינג אחד: ספלאש → לנדינג (שורת דיבור מתחלפת ×4, שייט אחרי הרצף) → צ׳אט (פרצוף → כותרת טייפרייטר + משנה פייד כמו ברודקאסט → שייט) — צ׳אט אחרי «צור לי ONE».
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { ChatBackArrowIcon } from '../components/icons/ChatBackArrowIcon';
import { ExiteIcon } from '../components/icons/ExiteIcon';
import { useOnboardingDraftStore } from '../stores/onboardingDraftStore';
import { useOnboardingPresentationStore } from '../stores/onboardingPresentationStore';
import { getVoiceStepsForVariant } from './onboardingPresentationCopy';
import { translate, embedLatinRunsForRtlDisplay } from '../i18n/strings';
import { onboardingChatStyles as S } from './onboardingChatStyles';
import { SaveOneAccountPanel } from './SaveOneAccountScreen';
import { supabaseService } from '../services/supabaseService';
import type { AgentPersona } from '../core/types';

const AGENT_ORB = 72;
const LOGO_BASE = 120;
/** קנה־מידה של מעגל הספלאש (120) כדי שקוטר יתאים ל־OrbAgent בלנדינג */
const SPLASH_ORB_MATCH_SCALE = AGENT_ORB / LOGO_BASE;
/** מרווח תחתון לשייט הכניסה — נשאר קצת מתחת לקצה, פחות מסתיר את הטקסט */
const SHEET_ENTRY_PEEK = 36;
/** שלבים בשורת הדיבור — אחרי סיום הרצף נפתח השייט */
const SPLASH_TAGLINE_HOLD_FIRST_MS = 2200;
const SPLASH_TAGLINE_HOLD_MID_MS = 2400;
const SPLASH_TAGLINE_HOLD_LAST_MS = 3200;
const SPLASH_TAGLINE_FADE_MS = 320;
/** זמן מלא לרוטור: ארבעה שלבי הצגה + שלושה crossfade */
const SPLASH_TAGLINE_SEQUENCE_MS =
  SPLASH_TAGLINE_HOLD_FIRST_MS +
  2 * SPLASH_TAGLINE_HOLD_MID_MS +
  SPLASH_TAGLINE_HOLD_LAST_MS +
  3 * (2 * SPLASH_TAGLINE_FADE_MS);
/** פייד־אין לבלוק פרצוף+טקסט בלנדינג (מסונכן ל־finishIntro) */
const LANDING_REVEAL_MS = 400;
/** כמו כפתור שדרג ב-OneScreen */
const UPGRADE_GOLD = '#e6bf3f';
const UPGRADE_GOLD_TEXT = '#111111';

const PLUS_PATH =
  'M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z';

function SplashVoiceLineRotator({
  lines,
  color,
  isRtl,
}: {
  lines: readonly string[];
  color: string;
  isRtl: boolean;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const linesKey = lines.join('\u0001');

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
  }, [linesKey, opacity]);

  useEffect(() => {
    if (lines.length <= 1) return;
    const hold =
      index === 0
        ? SPLASH_TAGLINE_HOLD_FIRST_MS
        : index === lines.length - 1
          ? SPLASH_TAGLINE_HOLD_LAST_MS
          : SPLASH_TAGLINE_HOLD_MID_MS;
    const fade = SPLASH_TAGLINE_FADE_MS;
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: fade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished) return;
          setIndex((i) => (i + 1) % lines.length);
          opacity.setValue(0);
          Animated.timing(opacity, {
            toValue: 1,
            duration: fade,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }
      );
    }, hold);
    return () => clearTimeout(t);
  }, [index, lines.length, opacity]);

  const line = lines[index] ?? '';
  return (
    <View style={styles.splashTaglineSlot}>
      <Animated.View style={{ opacity }}>
        <Text
          style={[
            styles.splashTaglineOneLine,
            { color, writingDirection: isRtl ? 'rtl' : 'ltr' },
            Platform.OS === 'android' ? { includeFontPadding: false } : null,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {line}
        </Text>
      </Animated.View>
    </View>
  );
}

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
  | 'connect_account'
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
  const { restoreOneUser, completeProductOnboarding } = useOne();
  const presentationVariant = useOnboardingPresentationStore((s) => s.variant);
  const resetDraft = useOnboardingDraftStore((s) => s.reset);
  const draftAgentName = useOnboardingDraftStore((s) => s.agentName);
  const setPersona = useOnboardingDraftStore((s) => s.setPersona);
  const setAgentName = useOnboardingDraftStore((s) => s.setAgentName);
  const setUserName = useOnboardingDraftStore((s) => s.setUserName);
  const setFirstUnit = useOnboardingDraftStore((s) => s.setFirstUnit);

  const [phase, setPhase] = useState<Phase>('splash');
  /** אחרי סיום אנימציית הספלאש — אותו רקע ואותו מיקום פרצוף; מציגים CTA בלי להחליף מסך */
  const [splashPostHero, setSplashPostHero] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [connectEmail, setConnectEmail] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pickPersonaPromptRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** קנה־מידה ראשוני: מעגל בסיס LOGO_BASE מכסה את פינות המסך — לא רואים רקע מאחור */
  const splashOrbCoverScale = useMemo(
    () => Math.max(16, (Math.hypot(winW, winH) / LOGO_BASE) * 1.14),
    [winW, winH]
  );

  const chatBg = isDark ? '#121212' : colors.background;
  const oneBubbleBg = isDark ? '#ECEDEE' : '#f0f0f0';
  const avatarBg = theme === 'light' ? '#000000' : '#1f1f1f';
  const sheetMaxW = Math.min(winW, 460);
  const splashBg = isDark ? '#000000' : '#ffffff';
  /** שייט תחתון: כהה בשני המצבים; במוד בהיר רקע שחור + טקסט בהיר */
  const splashSheetBg = isDark ? '#0a0a0a' : '#000000';
  const splashSheetConnectMutedColor = 'rgba(255,255,255,0.48)';
  const splashSheetConnectEmphColor = '#ffffff';
  const splashGuestIconColor = 'rgba(255,255,255,0.42)';
  /** כהה/בהיר + וריאנט composer — ניגוד עדין יותר לספלאש */
  const splashLogoCircle = useMemo(() => {
    if (presentationVariant === 'composer') {
      return isDark ? '#c6c6c6' : '#141414';
    }
    return isDark ? '#d4d4d4' : '#000000';
  }, [presentationVariant, isDark]);
  const chatActionButtonBg = isDark ? '#ffffff' : '#000000';
  const chatActionIconColor = isDark ? '#111111' : '#ffffff';
  const resumeSplashSkipTypewriterRef = useRef(false);
  const splashAnimGenRef = useRef(0);
  const faceLandingGenRef = useRef(0);
  const introRunRef = useRef(0);
  const sheetPanelH = Math.min(Math.round(winH * 0.38), 312);
  const sheetHRef = useRef(sheetPanelH);
  sheetHRef.current = sheetPanelH;
  const sheetTranslateY = useRef(new Animated.Value(sheetPanelH + SHEET_ENTRY_PEEK)).current;

  /** ספלאש: כדור מסך מלא → כיווץ לגודל פרצוף + עלייה → crossfade ל־Orb. */
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const logoOrbScale = useRef(new Animated.Value(splashOrbCoverScale)).current;
  const logoOrbOpacity = useRef(new Animated.Value(1)).current;
  const logoOrbTranslateY = useRef(new Animated.Value(0)).current;
  const morphFaceOpacity = useRef(new Animated.Value(0)).current;
  const splashFromMorphHandoffRef = useRef(false);
  const stackTranslateY = useRef(new Animated.Value(0)).current;
  /** פייד-אין אחיד ללנדינג אחרי הספלאש (במקום קפיצה בין ענפי הרינדור) */
  const splashLandingReveal = useRef(new Animated.Value(0)).current;
  const faceScale = useRef(new Animated.Value(0.3)).current;
  /** תנועת «עלייה» קצרה — פרצוף גבוה יותר, פחות קפיצה מהמורף */
  const faceLiftStart = Math.min(26, Math.round(winH * 0.034));
  const faceLiftEnd = -Math.min(30, Math.round(winH * 0.034));

  const headerTitle = draftAgentName.trim()
    ? embedLatinRunsForRtlDisplay(draftAgentName.trim(), language)
    : translate(language, 'chat_title_default');
  const headerSub = translate(language, 'chat_status_agent');

  const voiceSteps = useMemo(() => getVoiceStepsForVariant(presentationVariant, he), [presentationVariant, he]);

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

  useEffect(() => {
    if (phase !== 'splash' || splashPostHero) return;
    const gen = ++splashAnimGenRef.current;
    logoOrbScale.setValue(splashOrbCoverScale);
    logoOrbTranslateY.setValue(0);
    logoOrbOpacity.setValue(1);
    morphFaceOpacity.setValue(0);
    heroOpacity.setValue(1);

    /** עקומה אחת רכה: כיסוי מלא → «דופק» ליד גודל לוגו → כיווץ+עלייה למורף */
    const settleEase = Easing.bezier(0.22, 1, 0.32, 1);
    const morphEase = Easing.bezier(0.25, 0.46, 0.45, 0.94);
    const settleDur = 640;
    const morphDur = 560;
    const crossDur = 360;
    const riseY = -Math.min(72, Math.max(34, Math.round(winH * 0.058)));

    Animated.sequence([
      Animated.delay(200),
      Animated.timing(logoOrbScale, {
        toValue: 1.02,
        duration: settleDur,
        easing: settleEase,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoOrbScale, {
          toValue: SPLASH_ORB_MATCH_SCALE,
          duration: morphDur,
          easing: morphEase,
          useNativeDriver: true,
        }),
        Animated.timing(logoOrbTranslateY, {
          toValue: riseY,
          duration: morphDur,
          easing: morphEase,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(logoOrbOpacity, {
          toValue: 0,
          duration: crossDur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(morphFaceOpacity, {
          toValue: 1,
          duration: crossDur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished || splashAnimGenRef.current !== gen) return;
      logoOrbOpacity.setValue(0);
      morphFaceOpacity.setValue(1);
      splashFromMorphHandoffRef.current = true;
      faceScale.setValue(1);
      stackTranslateY.setValue(faceLiftEnd);
      splashLandingReveal.setValue(0);
      setSplashPostHero(true);
    });

    return () => {
      splashAnimGenRef.current += 1;
    };
  }, [
    phase,
    splashPostHero,
    logoOrbOpacity,
    logoOrbScale,
    logoOrbTranslateY,
    morphFaceOpacity,
    heroOpacity,
    splashOrbCoverScale,
    faceScale,
    stackTranslateY,
    splashLandingReveal,
    winH,
    faceLiftEnd,
  ]);

  useEffect(() => {
    if (phase !== 'splash' || !splashPostHero) return;
    if (resumeSplashSkipTypewriterRef.current) {
      resumeSplashSkipTypewriterRef.current = false;
      return;
    }
    const faceGen = ++faceLandingGenRef.current;
    const fromMorph = splashFromMorphHandoffRef.current;
    splashFromMorphHandoffRef.current = false;

    if (fromMorph) {
      splashLandingReveal.setValue(0);
      faceScale.setValue(1);
      stackTranslateY.setValue(faceLiftEnd);
    } else {
      splashLandingReveal.setValue(0);
      faceScale.setValue(0.28);
      stackTranslateY.setValue(faceLiftStart);
    }

    let introCancelled = false;
    /** בלנדינג: השייט זמין מיד מההתחלה */
    sheetTranslateY.setValue(SHEET_ENTRY_PEEK);

    if (fromMorph) {
      Animated.timing(splashLandingReveal, {
        toValue: 1,
        duration: LANDING_REVEAL_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(splashLandingReveal, {
          toValue: 1,
          duration: LANDING_REVEAL_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(faceScale, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stackTranslateY, {
          toValue: faceLiftEnd,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      introCancelled = true;
      faceLandingGenRef.current += 1;
      introRunRef.current += 1;
    };
  }, [phase, splashPostHero, splashLandingReveal, faceScale, stackTranslateY, faceLiftStart, faceLiftEnd, sheetTranslateY]);

  /** לחיצה על פרצוף הסוכן בלנדינג — חוזרים לספלאש מההתחלה */
  const restartSplashFromLanding = useCallback(() => {
    if (phase !== 'splash' || !splashPostHero) return;
    splashAnimGenRef.current += 1;
    faceLandingGenRef.current += 1;
    introRunRef.current += 1;
    resumeSplashSkipTypewriterRef.current = false;
    splashFromMorphHandoffRef.current = false;
    logoOrbScale.setValue(splashOrbCoverScale);
    logoOrbTranslateY.setValue(0);
    logoOrbOpacity.setValue(1);
    morphFaceOpacity.setValue(0);
    heroOpacity.setValue(1);
    splashLandingReveal.setValue(0);
    faceScale.setValue(0.28);
    stackTranslateY.setValue(faceLiftStart);
    sheetTranslateY.setValue(sheetHRef.current + SHEET_ENTRY_PEEK);
    setSplashPostHero(false);
  }, [
    phase,
    splashPostHero,
    logoOrbScale,
    logoOrbOpacity,
    heroOpacity,
    splashLandingReveal,
    faceScale,
    stackTranslateY,
    sheetTranslateY,
    faceLiftStart,
    splashOrbCoverScale,
    logoOrbTranslateY,
    morphFaceOpacity,
  ]);

  const applySplashEndLayout = useCallback(() => {
    resumeSplashSkipTypewriterRef.current = true;
    setSplashPostHero(true);
    sheetTranslateY.setValue(SHEET_ENTRY_PEEK);
    heroOpacity.setValue(1);
    logoOrbScale.setValue(0);
    logoOrbTranslateY.setValue(0);
    logoOrbOpacity.setValue(0);
    morphFaceOpacity.setValue(0);
    splashLandingReveal.setValue(1);
    faceScale.setValue(1);
    stackTranslateY.setValue(faceLiftEnd);
  }, [
    faceLiftEnd,
    heroOpacity,
    logoOrbScale,
    logoOrbOpacity,
    logoOrbTranslateY,
    morphFaceOpacity,
    splashLandingReveal,
    faceScale,
    stackTranslateY,
    sheetTranslateY,
  ]);

  const openConnectAccount = useCallback(() => {
    splashAnimGenRef.current += 1;
    introRunRef.current += 1;
    faceLandingGenRef.current += 1;
    setPhase('connect_account');
  }, []);

  const onGuestOrSkip = useCallback(async () => {
    try {
      await completeProductOnboarding({
        userName: he ? 'אורח' : 'Guest',
        agentName: 'ONE',
        persona: 'neutral',
        firstUnitTitle: '',
        firstUnitSummary: '',
        lens: 'business',
      });
    } catch (e) {
      Alert.alert(he ? 'שגיאה' : 'Error', e instanceof Error ? e.message : String(e));
    }
  }, [he, completeProductOnboarding]);

  useEffect(() => {
    if (phase !== 'connect_account') return;
    setConnectEmail('');
    setConnectPassword('');
  }, [phase]);

  const onConnectSubmit = async () => {
    if (!connectEmail.includes('@') || connectPassword.length < 6) {
      Alert.alert(
        he ? 'פרטים חסרים' : 'Missing details',
        he ? 'הזינו אימייל וסיסמה (6 תווים לפחות).' : 'Enter email and password (6+ characters).'
      );
      return;
    }
    supabaseService.initialize();
    const client = supabaseService.getClient();
    if (!client) {
      Alert.alert('Supabase', he ? 'השרת לא מוגדר.' : 'Server not configured.');
      return;
    }
    setConnectBusy(true);
    try {
      const { error } = await supabaseService.signIn(connectEmail.trim(), connectPassword);
      if (error) {
        Alert.alert(he ? 'התחברות' : 'Sign in', error.message);
        return;
      }
      const remote = await supabaseService.fetchOneUserProfileForCurrentSession();
      if (!remote) {
        await supabaseService.signOut();
        Alert.alert(
          he ? 'אין פרופיל ONE' : 'No ONE profile',
          he ? 'לא נמצאה שמירה בענן לחשבון הזה. צרו ONE חדש או השלימו הרשמה.' : 'No saved ONE for this account. Create a new ONE or finish sign-up.'
        );
        return;
      }
      await restoreOneUser(remote);
    } catch (e) {
      Alert.alert(he ? 'שגיאה' : 'Error', e instanceof Error ? e.message : String(e));
    } finally {
      setConnectBusy(false);
    }
  };

  const onBackPress = useCallback(() => {
    if (phase === 'splash' && !splashPostHero) return;
    if (phase === 'connect_account') {
      applySplashEndLayout();
      setPhase('splash');
      return;
    }
    if (phase === 'pick_persona') {
      pickPersonaPromptRef.current = false;
      setMessages([]);
      applySplashEndLayout();
      setPhase('splash');
      return;
    }
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
  }, [he, navigation, phase, splashPostHero, applySplashEndLayout]);

  useEffect(() => {
    const listen =
      phase === 'connect_account' || phase === 'pick_persona' || (phase === 'splash' && splashPostHero);
    if (!listen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackPress();
      return true;
    });
    return () => sub.remove();
  }, [phase, splashPostHero, onBackPress]);

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
          : "What's the first unit we'll tackle? One sentence is enough.",
      });
      return;
    }
    if (phase === 'ask_goal') {
      setFirstUnit(t, t);
      setPhase('broadcast');
      const title = t;
      const bc = he
        ? `לפי מה ששיתפת, נתחיל ביחידה «${title}». נשבור לצעדים, נבדוק חוסמים וזמנים, ונעדכן בקיצור כשיש מה לדווח.`
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
      <>
        <StatusBar hidden animated showHideTransition="fade" />
        <View
          style={[
            styles.splashRoot,
            { backgroundColor: splashBg },
            splashPostHero && styles.splashRootWithCta,
            splashPostHero && { paddingTop: Math.max(insets.top, 10) },
          ]}
        >
        {!splashPostHero ? (
          <Animated.View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFillObject, styles.splashHeroIntroAbsolute, { opacity: heroOpacity }]}
          >
            <View style={{ width: LOGO_BASE, height: LOGO_BASE, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  width: LOGO_BASE,
                  height: LOGO_BASE,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ translateY: logoOrbTranslateY }],
                }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: AGENT_ORB,
                    height: AGENT_ORB,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: morphFaceOpacity,
                    zIndex: 1,
                  }}
                >
                  <OrbAgent size={AGENT_ORB} state="idle" mode="home" showFace labelLines={[]} />
                </Animated.View>
                <Animated.View
                  style={{
                    width: LOGO_BASE,
                    height: LOGO_BASE,
                    borderRadius: LOGO_BASE / 2,
                    backgroundColor: splashLogoCircle,
                    transform: [{ scale: logoOrbScale }],
                    opacity: logoOrbOpacity,
                    zIndex: 2,
                  }}
                />
              </Animated.View>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.splashLandingColumn} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.splashLandingAboveSheet,
                {
                  bottom: sheetPanelH + SHEET_ENTRY_PEEK + Math.max(insets.bottom, 8),
                },
              ]}
              pointerEvents="box-none"
            >
              <Animated.View style={{ opacity: splashLandingReveal, width: '100%', alignItems: 'center' }}>
                <View style={styles.splashLandingMainBlock}>
                  <Animated.View style={[styles.splashHeroPost, { opacity: heroOpacity }]}>
                    <Animated.View style={styles.splashFaceLiftWrap}>
                      <Animated.View style={{ alignItems: 'center', transform: [{ translateY: stackTranslateY }] }}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={restartSplashFromLanding}
                          accessibilityRole="button"
                          accessibilityLabel={he ? 'הפעל מחדש את הספלאש' : 'Replay splash'}
                        >
                          <Animated.View style={{ transform: [{ scale: faceScale }] }}>
                            <OrbAgent
                              size={AGENT_ORB}
                              state="idle"
                              mode="home"
                              showFace
                              labelLines={[]}
                            />
                          </Animated.View>
                        </TouchableOpacity>
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                  <View style={styles.splashCopyShell}>
                    <View style={styles.splashCopyInner}>
                      <SplashVoiceLineRotator lines={voiceSteps} color={colors.text} isRtl={isRtl} />
                    </View>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
            <Animated.View
              style={[
                styles.splashDarkSheet,
                {
                  backgroundColor: splashSheetBg,
                  height: sheetPanelH,
                  paddingBottom: Math.max(insets.bottom, 10) + 8,
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.splashSheetGoldBtn}
                onPress={() => setPhase('pick_persona')}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={he ? 'צור לי ONE' : 'Create my ONE'}
              >
                <Text style={styles.sheetGoldBtnText}>{he ? 'צור לי ONE' : 'Create my ONE'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.splashSheetConnectBtn}
                onPress={openConnectAccount}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={he ? 'התחבר ל-ONE' : 'Connect to ONE'}
              >
                <Text style={styles.splashSheetConnectBtnLine}>
                  {he ? (
                    <>
                      <Text style={[styles.splashConnectMuted, { color: splashSheetConnectMutedColor }]}>התחבר ל-</Text>
                      <Text style={[styles.splashConnectEmph, { color: splashSheetConnectEmphColor }]}>ONE</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.splashConnectMuted, { color: splashSheetConnectMutedColor }]}>Connect to </Text>
                      <Text style={[styles.splashConnectEmph, { color: splashSheetConnectEmphColor }]}>ONE</Text>
                    </>
                  )}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.splashGuestTouch}
                onPress={onGuestOrSkip}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={he ? 'אורח או דילוג' : 'Continue as guest or skip'}
              >
                <ExiteIcon color={splashGuestIconColor} size={22} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
        </View>
      </>
    );
  }

  if (phase === 'connect_account') {
    return (
      <View style={[styles.landingRoot, { backgroundColor: splashBg }]}>
        <View style={[styles.landingTopBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity
            style={[styles.entryBackRow, { flexDirection: isRtl ? 'row-reverse' : 'row', marginBottom: 0 }]}
            onPress={() => {
              applySplashEndLayout();
              setPhase('splash');
            }}
            hitSlop={12}
          >
            <Text style={[styles.entryBackGlyph, { color: colors.textSecondary }]}>{isRtl ? '→' : '←'}</Text>
            <Text style={[styles.entryBackLabel, { color: colors.text }]}>{he ? 'חזרה' : 'Back'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.landingScroll, { paddingBottom: insets.bottom + 24, paddingTop: 8 }]}
        >
          <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center' }}>
            <Text style={[styles.entryConnectTitle, { color: colors.text }]}>
              {he ? 'התחברות ל-ONE' : 'Sign in to your ONE'}
            </Text>
            <Text style={[styles.entryConnectSub, { color: colors.textSecondary }]}>
              {he ? 'אותו חשבון כמו בשמירה בענן.' : 'Same account as when you saved to the cloud.'}
            </Text>
            <TextInput
              style={[styles.entryInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={connectEmail}
              onChangeText={setConnectEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!connectBusy}
            />
            <TextInput
              style={[styles.entryInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              placeholder={he ? 'סיסמה' : 'Password'}
              placeholderTextColor={colors.textSecondary}
              value={connectPassword}
              onChangeText={setConnectPassword}
              secureTextEntry
              editable={!connectBusy}
            />
            <TouchableOpacity
              style={[styles.entrySignInBtn, { backgroundColor: colors.text }]}
              onPress={onConnectSubmit}
              disabled={connectBusy}
              activeOpacity={0.85}
            >
              {connectBusy ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.entrySignInBtnText, { color: colors.background }]}>{he ? 'התחבר' : 'Sign in'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: chatBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[styles.sheetOuter, { paddingTop: insets.top + 6, width: winW, alignItems: 'center', position: 'relative' }]}
      >
        <View style={[S.sheet, { backgroundColor: chatBg, width: sheetMaxW, borderTopLeftRadius: 22, borderTopRightRadius: 22 }]}>
          <View style={[S.topBar, { borderBottomColor: colors.border }]}>
            {isRtl ? (
              <>
                <TouchableOpacity style={S.menuBtn} activeOpacity={0.7}>
                  <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
                  <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
                  <View style={[S.menuDot, { backgroundColor: colors.textSecondary }]} />
                </TouchableOpacity>
                <View style={S.freeBadge}>
                  <Text style={S.freeBadgeText}>FREE</Text>
                </View>
                <TouchableOpacity style={[S.headerProfileBtn, { flexDirection: 'row-reverse' }]} activeOpacity={0.85}>
                  <View style={[S.avatar, { backgroundColor: avatarBg }]}>
                    <OrbAgent
                      size={40}
                      state="idle"
                      mode="home"
                      showFace
                      labelLines={[]}
                    />
                  </View>
                  <View style={[S.headerText, S.headerTextRtl]}>
                    <Text
                      style={[S.title, { color: colors.text, textAlign: 'right', writingDirection: 'rtl' }]}
                      numberOfLines={1}
                    >
                      {headerTitle}
                    </Text>
                    <Text
                      style={[S.subtitle, { color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' }]}
                      numberOfLines={1}
                    >
                      {headerSub}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={S.iconBtn} onPress={onBackPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={he ? 'חזרה' : 'Back'}>
                  <ChatBackArrowIcon color={colors.textSecondary} rtl={isRtl} size={24} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={S.iconBtn} onPress={onBackPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={he ? 'חזרה' : 'Back'}>
                  <ChatBackArrowIcon color={colors.textSecondary} rtl={isRtl} size={24} />
                </TouchableOpacity>
                <TouchableOpacity style={[S.headerProfileBtn, { flexDirection: 'row' }]} activeOpacity={0.85}>
                  <View style={[S.avatar, { backgroundColor: avatarBg }]}>
                    <OrbAgent
                      size={40}
                      state="idle"
                      mode="home"
                      showFace
                      labelLines={[]}
                    />
                  </View>
                  <View style={S.headerText}>
                    <Text
                      style={[S.title, { color: colors.text, textAlign: 'left', writingDirection: 'ltr' }]}
                      numberOfLines={1}
                    >
                      {headerTitle}
                    </Text>
                    <Text
                      style={[S.subtitle, { color: colors.textSecondary, textAlign: 'left', writingDirection: 'ltr' }]}
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
              </>
            )}
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
                    S.msgRow,
                    msg.role === 'one' ? (isRtl ? S.msgRowOneRtl : S.msgRowOne) : (isRtl ? S.msgRowUserRtl : S.msgRowUser),
                  ]}
                >
                  <View style={[S.bubble, msg.role === 'user' ? S.bubbleUser : S.bubbleOne, msg.role === 'one' ? { backgroundColor: oneBubbleBg } : null]}>
                    <Text
                      style={[
                        S.bubbleText,
                        msg.role === 'user' ? S.bubbleTextUser : S.bubbleTextOne,
                        {
                          textAlign: isRtl ? 'right' : 'left',
                          writingDirection: isRtl ? 'rtl' : 'ltr',
                        },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}
              {showPersonaChips ? (
                <View style={[S.chipRow, isRtl && S.chipRowRtl]}>
                  {PERSONA_CHIPS.map((row) => (
                    <TouchableOpacity
                      key={row.persona}
                      style={[S.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={() => onPickPersona(row.persona, he ? row.he : row.en)}
                    >
                      <Text
                        style={[
                          S.chipLabel,
                          { color: colors.text },
                          isRtl && { textAlign: 'right', writingDirection: 'rtl' },
                        ]}
                      >
                        {row.emoji} {he ? row.he : row.en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
  splashRootWithCta: { justifyContent: 'center', alignItems: 'stretch', position: 'relative', flex: 1 },
  /** כדור ספלאש במרכז המסך (לא מושפע מ-padding של הלנדינג) */
  splashHeroIntroAbsolute: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  splashLandingColumn: { flex: 1, width: '100%', minHeight: 0, overflow: 'visible', position: 'relative' },
  /** אזור מעל השייט — מרכז אנכי של פרצוף+טקסט בין הקצה העליון לקו העליון של השייט */
  splashLandingAboveSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLandingMainBlock: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 18 }],
  },
  /** אזור פרצוף — overflow visible כדי שלא ייחתך בזמן scale/translate */
  splashHeroPost: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 8,
    overflow: 'visible',
  },
  splashFaceLiftWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  splashCopyShell: { width: '100%', alignItems: 'center', zIndex: 1 },
  splashCopyInner: { maxWidth: 400, width: '100%', alignSelf: 'center', paddingHorizontal: 18 },
  splashTaglineSlot: {
    minHeight: 56,
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  splashTaglineOneLine: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  splashDarkSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 24,
    pointerEvents: 'auto',
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  splashSheetGoldBtn: {
    alignSelf: 'center',
    width: '86%',
    maxWidth: 340,
    backgroundColor: UPGRADE_GOLD,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  /** התחבר — טקסט בלבד, בלי מסגרת */
  splashSheetConnectBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  splashSheetConnectBtnLine: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  splashConnectMuted: { fontWeight: '600' },
  splashConnectEmph: { fontWeight: '700' },
  splashGuestTouch: { alignItems: 'center', marginTop: 10, paddingVertical: 8 },
  landingRoot: { flex: 1, minHeight: 0 },
  landingTopBar: { paddingHorizontal: 8, paddingBottom: 4 },
  landingScroll: { paddingHorizontal: 22, flexGrow: 1, justifyContent: 'center' },
  sheetOuter: { flex: 1, flexDirection: 'column', minHeight: 0 },
  entryScrollContent: { paddingHorizontal: 22, flexGrow: 1 },
  entryBackRow: { alignItems: 'center', gap: 8, marginBottom: 14, alignSelf: 'flex-start' },
  entryBackGlyph: { fontSize: 18, fontWeight: '700' },
  entryBackLabel: { fontSize: 16, fontWeight: '600' },
  entryConnectTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  entryConnectSub: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  entryInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  entrySignInBtn: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  entrySignInBtnText: { fontSize: 17, fontWeight: '800' },
  sheetGoldBtnText: { color: UPGRADE_GOLD_TEXT, fontSize: 16, fontWeight: '800' },
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
  /** כמו OneScreen: סדר פיזי קבוע — פלוס משמאל, שליחה מימין, גם ב־RTL */
  compRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52,
    direction: 'ltr',
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
