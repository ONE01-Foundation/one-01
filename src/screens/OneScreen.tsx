/**
 * OneScreen – דף אחד נקי.
 * פטרון: overlay טופ/בוטום – גרדיאנט בלבד (צבע רקע, 100% בקצה המכשיר → 0% בקצה התוכן).
 * התוכן נגלל מתחת לבר; הגרדיאנט יוצר מעבר רך בלי חיתוך חד.
 * עיצוב: ראה assets/icons/bar-bg.svg.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  type ColorValue,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Platform,
  PanResponder,
  Modal,
  Keyboard,
  Easing,
  BackHandler,
  Share,
  Alert,
  StatusBar,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Path, Rect, G, ClipPath, Mask } from 'react-native-svg';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { useLoadingStore } from '../stores/loadingStore';
import {
  translate,
  formatChatUnitProgressLine,
  embedLatinRunsForRtlDisplay,
  type SettingsStringKey,
  type ChatChromeKey,
} from '../i18n/strings';
import type { ViewMode, CardContext } from '../one01/viewState';
import { getProcessStepsData, getProgress } from '../data/processSteps';
import type { AppShellParamList } from '../navigation/types';
import { useOne } from '../core/OneContext';
import { UnitChatProfile, type AgentChatProfileModel, type UnitChatProfileModel } from '../components/UnitChatProfile';
import { HAT_LABELS, PERSONA_LABELS, type Hat } from '../core/types';
import { AttachActionSheet, type AttachActionId } from '../components/AttachActionSheet';

const MAX_CONTENT_WIDTH = 428;
const INACTIVITY_HIDE_MS = 3000;
/** כדור יחידה: אחרי חוסר תזוזה – שורת מצב + כדורים שכנים (fade משותף) */
const UNIT_ORB_STATUS_BAR_IDLE_MS = 4000;
/** משך fade לכדורים שכנים ולסנכרון עם אנימציית שורת המצב */
const IDLE_CHROME_FADE_MS = 280;
type ChatStatusPhase = 'agent' | 'thinking' | 'planning' | 'ready';

const CHAT_PHASE_KEY: Record<ChatStatusPhase, ChatChromeKey> = {
  agent: 'chat_status_agent',
  thinking: 'chat_status_thinking',
  planning: 'chat_status_planning',
  ready: 'chat_status_ready',
};

const CHAT_MENU_ROWS: { id: 'Share' | 'Profile' | 'History' | 'Settings'; labelKey: SettingsStringKey }[] = [
  { id: 'Share', labelKey: 'menu_share' },
  { id: 'Profile', labelKey: 'menu_profile' },
  { id: 'History', labelKey: 'menu_history' },
  { id: 'Settings', labelKey: 'menu_settings' },
];

/** פריט אחד בגלגל – תהליך עם אימוג'י, כותרת, תת־כותרת */
export type OrbItem = { id: string; emoji: string; title: string; subtitle: string };
type ChatLine = { id: string; sender: 'user' | 'one'; text: string };
type FlowUnit = UnitChatProfileModel & { messages: ChatLine[]; worldId: string };

/** עולמות – רק בכדור הראשון אפשר לדפדף ביניהם; לכל עולם צבע */
const WORLDS: { id: string; label: string; color: string }[] = [
  { id: 'personal', label: 'ראשי', color: '#ffffff' },
  { id: 'business', label: 'עסקים', color: '#0ea5e9' },
  { id: 'health', label: 'בריאות', color: '#22c55e' },
  { id: 'finance', label: 'כלכלה', color: '#eab308' },
];

/** ברודקאסט – שורה ראשית: סוג (עדכון/הודעה/תזכורת), שורה משנית: התוכן */
export type BroadcastMessage = { type: string; body: string };

/** ברודקאסט לכדור יחידה / תהליך בגלגל — מתאים ל־flowUnits או לנתוני ה־Orb בלבד */
function broadcastMessagesForOrbItem(item: OrbItem, units: FlowUnit[]): BroadcastMessage[] {
  const unit = units.find((u) => u.id === item.id);
  if (unit) {
    const out: BroadcastMessage[] = [];
    if (unit.nextAction?.trim()) out.push({ type: 'צעד הבא', body: unit.nextAction.trim() });
    if (unit.goal?.trim()) out.push({ type: 'מטרה', body: unit.goal.trim() });
    out.push({ type: 'התקדמות', body: `${unit.progress}% · ${unit.subtitle}` });
    if (unit.lastUpdatedLabel?.trim()) out.push({ type: 'עדכון', body: unit.lastUpdatedLabel.trim() });
    if (unit.city?.trim()) out.push({ type: 'אזור', body: unit.city.trim() });
    return out.length > 0 ? out : [{ type: 'יחידה', body: unit.subtitle || item.subtitle }];
  }
  return [
    { type: 'עדכון', body: item.subtitle || 'מוכן לביצוע' },
    { type: 'תזכורת', body: `«${item.title}» — פתחו בצ׳אט למעקב אחר צעדים` },
  ];
}

const BROADCAST_BY_WORLD: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'עדכון', body: 'הודעות חדשות מחכות' },
    { type: 'תזכורת', body: 'תזכורת לרישיון נהיגה' },
    { type: 'עדכון', body: 'פרופיל עודכן בהצלחה' },
    { type: 'הודעה', body: '3 משימות ממתינות' },
    { type: 'תזכורת', body: 'פגישה עם דני מחר' },
    { type: 'עדכון', body: 'סיסמה שונתה' },
  ],
  business: [
    { type: 'הודעה', body: 'דוח רבעוני הועלה' },
    { type: 'תזכורת', body: 'פגישה מחר 09:00' },
    { type: 'עדכון', body: 'חוזה אושר לחתימה' },
    { type: 'תזכורת', body: 'דדליין לפרויקט ביום חמישי' },
    { type: 'עדכון', body: 'הצעת מחיר נשלחה' },
    { type: 'הודעה', body: 'סטטוס לקוח עודכן' },
  ],
  health: [
    { type: 'עדכון', body: 'תוצאות הבדיקות התקבלו' },
    { type: 'תזכורת', body: 'תור לרופא מחר 10:00' },
    { type: 'הודעה', body: 'בדיקות תקינות' },
    { type: 'עדכון', body: 'תור לבדיקת דם אושר' },
    { type: 'תזכורת', body: 'זמן לקחת תרופה' },
    { type: 'עדכון', body: 'רשומות רפואיות זמינות' },
  ],
  finance: [
    { type: 'עדכון', body: 'ההשקעה עלתה 2%' },
    { type: 'תזכורת', body: 'תשלום חודשי מחר' },
    { type: 'הודעה', body: 'דוח מס הוכן' },
    { type: 'עדכון', body: 'העברה הושלמה' },
    { type: 'תזכורת', body: 'חשבון עובר ושב נמוך' },
    { type: 'עדכון', body: 'דיבידנד התקבל' },
  ],
};

/** תהליכים לכל עולם – הכדורים שנגלילים למטה (דוגמאות רחבות) */
const ORB_DATA_BY_WORLD: Record<string, OrbItem[]> = {
  personal: [
    { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
    { id: 'license', emoji: '🚗', title: 'רישיון נהיגה', subtitle: 'מבחן תיאוריה, שיעורים, מבחן מעשי' },
    { id: 'mass', emoji: '💪', title: 'עלות 5 קילו מסה', subtitle: 'תזונה, אימונים, מעקב' },
    { id: 'passport', emoji: '🛂', title: 'חידוש דרכון', subtitle: 'תיאום תור, מסמכים, איסוף' },
  ],
  business: [
    { id: 'origin', emoji: '💼', title: 'עסקים', subtitle: '' },
    { id: 'b1', emoji: '📋', title: 'הקמת עסק', subtitle: 'רישום, בנק, מוצרים והפעלה' },
    { id: 'b2', emoji: '📊', title: 'דוח רווח והפסד', subtitle: 'איסוף נתונים, סיווג, ייצוא' },
    { id: 'b3', emoji: '👤', title: 'גיוס עובד ראשון', subtitle: 'הגדרת תפקיד, פרסום, ראיונות' },
  ],
  health: [
    { id: 'origin', emoji: '🏥', title: 'בריאות', subtitle: '' },
    { id: 'h1', emoji: '🩺', title: 'תור לרופא', subtitle: 'הזמנה, הגעה, סיכום' },
    { id: 'h2', emoji: '💊', title: 'מעקב תרופות', subtitle: 'רישום, תזכורות, מעקב' },
    { id: 'h3', emoji: '🩸', title: 'בדיקות דם שנתיות', subtitle: 'הפניה, תיאום, תוצאות' },
  ],
  finance: [
    { id: 'origin', emoji: '💰', title: 'כלכלה', subtitle: '' },
    { id: 'f1', emoji: '📈', title: 'השקעות', subtitle: 'מטרה, פלטפורמה, פיזור נכסים' },
    { id: 'f2', emoji: '🧾', title: 'החזרי מס', subtitle: 'טפסים, הגשה, מעקב' },
    { id: 'f3', emoji: '🚗', title: 'חיסכון לרכב', subtitle: 'יעד, תקציב חודשי, אסטרטגיה' },
  ],
};
/** כמו Background-Ovarly: עיגול r=160.5 ב-viewBox 375 → קוטר 321/375 של המסך */
const ORB_SIZE_RATIO = 321 / 375;
// הכדור הקטן ~שליש מהגדול, כדי שירגיש משמעותי אבל עדיין משני
const SMALL_ORB_RATIO = 0.32;
/** גובה שורה אחת בגלגל הפיקר – רווח בין כדורים; 240 = הכדורים הקטנים 10px קרוב יותר למרכז */
const WHEEL_ITEM_HEIGHT = 240;
/** true = קווי מיתר (מסגרת) סביב הכדורים לראות מידות/גודל. להחליף ל־false כדי לכבות. */
const SHOW_ORB_DEBUG_OUTLINE = true;
/** עיגול האימוג'י בתוך הכדור – רק מילוי (ללא מסגרת); שליטה כאן */
const EMOJI_CIRCLE_BORDER_WIDTH = 0;
const EMOJI_CIRCLE_BORDER_COLOR = 'transparent';
/** צבע כדור הסוכן – מתאים למוד כהה/בהיר (בכהה גוון רך יותר) */
const EMOJI_CIRCLE_LIGHT = '#000000';
const EMOJI_CIRCLE_DARK = '#2a2a2a';
/** עיגול הסוכן (אימוג'י) – גודל מלא בעולם ראשי */
const EMOJI_CIRCLE_SIZE = 72;
/** עיגול הסוכן בעולמות עסקים/בריאות/כלכלה – קטן יותר */
const AGENT_CIRCLE_SIZE_OTHER_WORLDS = 56;

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/.{2}/g);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * שורת כרום קלט: פלוס משמאל, שדה במרכז, מיקרופון/שלח מימין — קבוע פיזית גם כשהשורש ב־App.tsx הוא `direction: rtl`.
 * `direction: ltr` על השורה לבד לא תמיד מבטל היפוך flex ביוגה; לכן ב־RTL משתמשים ב־`row-reverse` ובסדר ילדים מתאים.
 */
function NowInputBarRow({
  isRtl,
  style,
  plus,
  field,
  trailing,
}: {
  isRtl: boolean;
  style?: StyleProp<ViewStyle>;
  plus: React.ReactNode;
  field: React.ReactNode;
  trailing: React.ReactNode;
}) {
  return (
    <View
      style={[style, { direction: 'ltr' }, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}
      collapsable={false}
    >
      {isRtl ? (
        <>
          {trailing}
          {field}
          {plus}
        </>
      ) : (
        <>
          {plus}
          {field}
          {trailing}
        </>
      )}
    </View>
  );
}

/** גובה נוסף מעבר ל-safe area – שטח תפריט מורחב כלפי מרכז המסך */
const BAR_EXTRA = 96;
/** כמו bar-bg.svg: צבע מלא דומיננטי, מעבר לשקוף רק בקצה. מלא (1) נשמר על ~40% מהבר, אז המעבר רך אבל הצבע המלא בולט. */
const GRADIENT_STOPS: number[] = [0, 0.2, 0.4, 0.5, 0.6, 0.75, 0.88, 0.96, 1];
const ALPHAS = [0, 0.02, 0.08, 0.2, 0.5, 0.8, 1, 1, 1];

/** כותרת קבועה + משנה מתחלפת (פאד) – בכדור ראשי: כותרת = שם העולם, רק המשנה מתחלפת בעדכונים */
function FadeBroadcastBlock({
  messages,
  visible,
  titleColor,
  subtitleColor,
  fixedTitle,
  onBroadcastLoopComplete,
}: {
  messages: BroadcastMessage[];
  visible: boolean;
  titleColor: string;
  subtitleColor: string;
  /** כשמוגדר: כותרת קבועה (לא מתחלפת), רק המשנה מתחלפת */
  fixedTitle?: string;
  /** אחרי הצגת כל ההודעות וחזרה לראשית – למשל מעבר לעולם הבא בכדור הסוכן */
  onBroadcastLoopComplete?: () => void;
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const loopCompleteRef = useRef(onBroadcastLoopComplete);
  loopCompleteRef.current = onBroadcastLoopComplete;

  useEffect(() => {
    setMsgIndex(0);
    opacity.setValue(1);
  }, [messages, opacity]);

  useEffect(() => {
    if (visible) opacity.setValue(1);
  }, [visible, opacity]);

  useEffect(() => {
    if (!visible || messages.length === 0) return;
    const duration = 400;
    const pause = 2800;
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setMsgIndex((i) => {
          const n = messages.length;
          const next = (i + 1) % n;
          if (n > 1 && i === n - 1) {
            loopCompleteRef.current?.();
          }
          return next;
        });
        opacity.setValue(0);
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
      });
    }, pause);
    return () => clearTimeout(t);
  }, [visible, msgIndex, messages.length, opacity]);

  if (!visible) return null;
  const msg = messages[msgIndex % (messages.length || 1)];
  if (!msg) return null;
  return (
    <>
      <Text style={[styles.wheelOrbTitle, { color: titleColor }]} numberOfLines={1}>
        {fixedTitle ?? msg.type}
      </Text>
      <Animated.View style={{ opacity }}>
        <Text style={[styles.wheelOrbSubtitle, { color: subtitleColor }]} numberOfLines={2}>{msg.body}</Text>
      </Animated.View>
    </>
  );
}

/** עיניים ונשימה – סוכן חי רק בעולם ראשי (בית) */
function AgentEyes({ compact = false }: { compact?: boolean }) {
  const breath = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1.06, duration: 1600, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ])
    );
    breathLoop.start();
    pulseLoop.start();
    return () => {
      breathLoop.stop();
      pulseLoop.stop();
    };
  }, [breath, pulse]);
  return (
    <Animated.View
      style={[
        styles.agentEyesRow,
        compact && styles.agentEyesRowCompact,
        { transform: [{ scale: Animated.multiply(breath, pulse) }] },
      ]}
    >
      <View style={[styles.agentEye, compact && styles.agentEyeCompact]} />
      <View style={[styles.agentEye, compact && styles.agentEyeCompact]} />
    </Animated.View>
  );
}

/** אייקון עסקים – צבע לפי עולם */
function BusinessIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M24.005 10.2745H19.6976V8.51733C19.6976 7.68065 19.0252 7 18.1988 7H13.8009C12.9745 7 12.3021 7.68065 12.3021 8.51733V10.2745H7.99466C6.89737 10.2745 6.00462 11.1783 6.00462 12.2892C6.00462 13.2983 5.90254 14.2045 6.65787 15.2236C7.08522 15.8001 7.67248 16.2115 8.35616 16.413L14.9951 18.3698C15.6523 18.5635 16.3472 18.5636 17.0046 18.3698L23.6435 16.413C24.3271 16.2114 24.9144 15.8001 25.3418 15.2236C26.1005 14.1999 25.995 13.2844 25.995 12.2892C25.995 11.1783 25.1023 10.2745 24.005 10.2745ZM13.5716 8.51733C13.5716 8.38933 13.6745 8.28523 13.8009 8.28523H18.1988C18.3252 8.28523 18.4281 8.38937 18.4281 8.51733V10.2745H13.5716V8.51733Z" fill={color} />
      <Path d="M24.0024 17.8726C16.8381 19.9052 16.9308 19.9463 16 19.9463C15.0758 19.9463 15.2951 19.943 7.99762 17.8727C7.22821 17.6544 6.54679 17.252 6 16.6973V22.6361C6 23.7058 6.89313 24.5761 7.99099 24.5761H24.009C25.1068 24.5761 26 23.7058 26 22.6361V16.6973C25.4532 17.2519 24.7718 17.6544 24.0024 17.8726Z" fill={color} />
    </Svg>
  );
}

/** אייקון בריאות – צבע לפי עולם */
function HealthIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16.4065 24.905C16.1506 25.0317 15.8494 25.0317 15.5935 24.905L15.5899 24.9032L15.583 24.8997L15.5595 24.8879C15.5397 24.8779 15.5115 24.8635 15.4754 24.8447C15.4032 24.8071 15.2995 24.7524 15.1691 24.6809C14.9083 24.5379 14.5391 24.3277 14.0977 24.0546C13.2169 23.5096 12.0385 22.7081 10.8559 21.6836C10.2058 21.1204 9.5399 20.4772 8.91782 19.7603C8.83014 19.6593 8.70275 19.6 8.56819 19.6H6.90909C6.40702 19.6 6 19.1971 6 18.7C6 18.2029 6.40702 17.8 6.90909 17.8H10.5455C10.9172 17.8 11.2515 17.5759 11.3895 17.2343L12.1948 15.2411C12.2558 15.0903 12.4715 15.0903 12.5325 15.2411L14.2468 19.4843C14.3849 19.8259 14.7192 20.05 15.0909 20.05C15.4626 20.05 15.7969 19.8259 15.935 19.4843L16.9221 17.0411C16.9831 16.8903 17.1987 16.8903 17.2597 17.0411L17.3377 17.2343C17.4758 17.5759 17.8101 17.8 18.1818 17.8H19.6364C20.1385 17.8 20.5455 17.3971 20.5455 16.9C20.5455 16.4029 20.1385 16 19.6364 16H18.9204C18.8461 16 18.7792 15.9552 18.7515 15.8869L17.935 13.8657C17.7969 13.5241 17.4626 13.3 17.0909 13.3C16.7192 13.3 16.3849 13.5241 16.2468 13.8657L15.2597 16.3089C15.1987 16.4597 14.9831 16.4597 14.9221 16.3089L13.2077 12.0657C13.0696 11.7241 12.7354 11.5 12.3636 11.5C11.9919 11.5 11.6576 11.7241 11.5196 12.0657L9.92997 16H6.90774C6.71829 16 6.54773 15.884 6.48683 15.7064C6.17949 14.8101 6 13.8562 6 12.85C6 11.563 6.38641 10.1239 7.26649 8.98454C8.16917 7.81592 9.56763 7 11.4546 7C13.3298 7 14.6765 7.8023 15.5371 8.58868C15.7101 8.74677 15.8642 8.90474 16 9.05632C16.1358 8.90474 16.2899 8.74677 16.4629 8.58868C17.3235 7.8023 18.6703 7 20.5455 7C22.4324 7 23.8308 7.81592 24.7335 8.98454C25.6135 10.1239 26 11.563 26 12.85C26 16.6268 23.4711 19.6678 21.1441 21.6836C19.9615 22.708 18.7832 23.5096 17.9023 24.0546C17.4609 24.3277 17.0918 24.5379 16.8309 24.6809C16.7005 24.7524 16.5968 24.8071 16.5246 24.8447C16.4885 24.8635 16.4604 24.8779 16.4405 24.8879L16.417 24.8997L16.4102 24.9032L16.4065 24.905Z" fill={color} />
    </Svg>
  );
}

/** אייקון כלכלה – צבע לפי עולם */
function FinanceIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <G clipPath="url(#financeClip)">
        <Path d="M19.1992 13.3984C16.0007 13.3984 13.3984 16.0007 13.3984 19.1992C13.3984 22.3978 16.0007 25 19.1992 25C22.3978 25 25 22.3978 25 19.1992C25 16.0007 22.3978 13.3984 19.1992 13.3984Z" fill={color} />
        <Path d="M12.8711 13.3984C16.1237 13.3984 18.6719 12.0085 18.6719 10.2344C18.6719 8.46025 16.1237 7 12.8711 7C9.61844 7 7 8.46025 7 10.2344C7 12.0085 9.61844 13.3984 12.8711 13.3984Z" fill={color} />
        <Path d="M7 18.8672V19.7264C7 21.5006 9.61844 22.8905 12.8711 22.8905C13.0556 22.8905 13.2344 22.8735 13.416 22.8646C13.0115 22.2286 12.7098 21.5229 12.5322 20.7684C10.1801 20.7035 8.13773 19.9807 7 18.8672Z" fill={color} />
        <Path d="M12.3691 19.6996C12.357 19.5337 12.3438 19.368 12.3438 19.1991C12.3438 18.6494 12.4158 18.1173 12.5386 17.6047C10.1836 17.5408 8.13875 16.8177 7 15.7031V16.5624C7 18.2424 9.36468 19.5627 12.3691 19.6996Z" fill={color} />
        <Path d="M12.8711 16.5624C12.8717 16.5624 12.8721 16.5623 12.8727 16.5623C13.2205 15.7311 13.7261 14.9818 14.3539 14.3539C13.8777 14.4141 13.3855 14.453 12.8711 14.453C10.3674 14.453 8.19271 13.7064 7 12.5391V13.3983C7 15.1724 9.61844 16.5624 12.8711 16.5624Z" fill={color} />
      </G>
      <Defs>
        <ClipPath id="financeClip">
          <Rect x="7" y="7" width="18" height="18" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

const WORLD_ICON_SIZE = 46;

function WorldMiniIcon({ worldId, color, size }: { worldId: string; color: string; size: number }) {
  if (worldId === 'business') return <BusinessIconSvg size={size} color={color} />;
  if (worldId === 'health') return <HealthIconSvg size={size} color={color} />;
  if (worldId === 'finance') return <FinanceIconSvg size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={3.2} fill={color} />
    </Svg>
  );
}

/** אייקון כניסה – חץ/פליי, צבע לפי עולם (בכפתור כדור התהליך) */
function EnterIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M26 13.7679C27.3333 14.5377 27.3333 16.4623 26 17.2321L11.75 25.4593C10.4167 26.2291 8.75 25.2668 8.75 23.7272L8.75 7.27276C8.75 5.73316 10.4167 4.77091 11.75 5.54071L26 13.7679Z" fill={color} />
    </Svg>
  );
}

const ORB_BUTTON_ENTER_ICON_SIZE = 28;

function getTimeGreeting(hour: number, name: string): string {
  if (hour >= 5 && hour < 12) return `בוקר טוב, ${name}`;
  if (hour >= 12 && hour < 18) return `צהריים טובים, ${name}`;
  return `ערב טוב, ${name}`;
}

type Nav = NativeStackNavigationProp<AppShellParamList, 'Home'>;

export function OneScreen() {
  const { colors, theme } = useThemeStore();
  const language = useLocaleStore((s) => s.language);
  const layoutDirection = useLocaleStore((s) => s.layoutDirection);
  const isRtlLayout = layoutDirection === 'rtl';
  const chatBackGlyph = isRtlLayout ? '›' : '‹';
  const chatShareGlyph = isRtlLayout ? '↖' : '↗';
  const chatMenuRows = useMemo(
    () => CHAT_MENU_ROWS.map((row) => ({ ...row, label: translate(language, row.labelKey) })),
    [language]
  );
  const nowPlaceholderPhrase = useMemo(() => (language === 'he' ? 'עכשיו?' : 'Now?'), [language]);
  const [chatStatusPhase, setChatStatusPhase] = useState<ChatStatusPhase>('agent');
  const chatAgentStatusLabel = useMemo(
    () => translate(language, CHAT_PHASE_KEY[chatStatusPhase]),
    [language, chatStatusPhase]
  );
  const { user } = useOne();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isNarrow = windowWidth <= MAX_CONTENT_WIDTH;
  const contentWidth = isNarrow ? windowWidth : MAX_CONTENT_WIDTH;
  const creditsColor = theme === 'light' ? '#000000' : colors.text;
  const creditsCircleBg = theme === 'light' ? '#000000' : '#ffffff';

  const [orbIndex, setOrbIndex] = useState(0);
  /** עולם נבחר (אישי / עסקים / בריאות / כלכלה) – דפדוף רק בכדור הראשון */
  const [worldIndex, setWorldIndex] = useState(0);
  /** מסך אחד – מחליף מצבים: orb | card | global */
  const [viewMode, setViewMode] = useState<ViewMode>('orb');
  const [cardContext, setCardContext] = useState<CardContext | null>(null);
  /** כדור יחידה בבית: אחרי idle – מסתירים שורת מצב; תזוזה מחזירה */
  const [unitOrbSystemBarVisible, setUnitOrbSystemBarVisible] = useState(true);
  const [showBottomActions, setShowBottomActions] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const showChatSheetRef = useRef(showChatSheet);
  useEffect(() => {
    showChatSheetRef.current = showChatSheet;
  }, [showChatSheet]);
  const [showCredits, setShowCredits] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showAgentCard, setShowAgentCard] = useState(false);
  const [agentCardWorldIndex, setAgentCardWorldIndex] = useState(0);
  const [unitsBalance, setUnitsBalance] = useState(1800);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [nowValue, setNowValue] = useState('');
  const [chatSheetMessages, setChatSheetMessages] = useState<ChatLine[]>([
    { id: 'seed_1', sender: 'one', text: 'שלום! ספר במשפט מה המטרה — ונמשיך משם.' },
  ]);
  const [personalOrbs, setPersonalOrbs] = useState<OrbItem[]>(ORB_DATA_BY_WORLD.personal);
  const [flowUnits, setFlowUnits] = useState<FlowUnit[]>([
    {
      id: 'license',
      worldId: 'personal',
      title: 'רישיון נהיגה',
      subtitle: 'תיאוריה · שיעורים במוסד · מבחן מעשי',
      emoji: '🚗',
      status: 'active',
      progress: 32,
      steps: 25,
      messages: [{ id: 'm1', sender: 'one', text: 'היחידה פעילה. אפשר להמשיך מהצעד הנוכחי או לפתוח כאן את הפרטים.' }],
      goal: 'לעבור תיאוריה, לסיים את שיעורי הנהיגה הנדרשים, ולעבור מבחן מעשי לרישיון סוג B.',
      city: 'מרכז · תל אביב–יפו',
      budgetMinIls: 4800,
      budgetMaxIls: 7200,
      etaWeeks: 8,
      peopleRoles: [
        { id: 'p1', role: 'סוכן', name: 'ONE' },
        { id: 'p2', role: 'נוהג/ת', name: 'את/ה' },
        { id: 'p3', role: 'מורה נהיגה', name: 'בהמתנה לבחירה' },
        { id: 'p4', role: 'מוסד לימוד', name: 'יוצע אחרי העדפות' },
      ],
      milestones: [
        { id: 'm0', title: 'תו רפואי וצילום ת.ז.', done: true },
        { id: 'm1', title: 'מבחן תיאוריה במשרד הרישוי', done: true },
        { id: 'm2', title: 'שיעורי נהיגה (בהתקדמות)', done: false },
        { id: 'm3', title: 'מבחן מעשי', done: false },
        { id: 'm4', title: 'הנפקת הרישיון', done: false },
      ],
      nextAction: 'לתאם עוד שני שיעורים ולבדוק תאריך פנוי למבחן מעשי.',
      lastUpdatedLabel: 'עודכן לפני יומיים',
      blockCount: 6,
    },
  ]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [intakeState, setIntakeState] = useState<{ intent: string; questionIndex: number; answers: string[] } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [chatProfileEditMode, setChatProfileEditMode] = useState(false);
  const [chatOpenedFromOrbProfileShortcut, setChatOpenedFromOrbProfileShortcut] = useState(false);
  /** בפרופיל יחידה: אחרי גלילה — כותרת ואימוג׳י מוצגים בסרגל העליון (כמו בצ׳אט) */
  const [chatProfileHeaderCompact, setChatProfileHeaderCompact] = useState(false);
  const chatProfileCompactScrollRef = useRef(false);
  /** בצ׳אט ONE: רשימת יחידות מוסתרת עד לחיצה על «היסטוריה» */
  const [oneChatUnitHistoryOpen, setOneChatUnitHistoryOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [creditsHistory, setCreditsHistory] = useState<{ id: string; label: string; time: string; change: number; icon: 'globe' | 'brand' | 'gift' | 'buy' }[]>([
    { id: '1', label: 'One Site', time: '5:01 PM', change: -650, icon: 'globe' },
    { id: '2', label: 'One Brand', time: '9:18 PM', change: -450, icon: 'brand' },
    { id: '3', label: 'New User Gift', time: 'Sunday', change: 101, icon: 'gift' },
  ]);
  const [splashDone, setSplashDone] = useState(false);
  const { hasSeenOrbSplash, markOrbSplashComplete } = useLoadingStore();
  const showSplashOverlay = !hasSeenOrbSplash && !splashDone;

  const walletSlideAnim = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0)).current;
  const splashTranslateX = useRef(new Animated.Value(0)).current;
  const splashTranslateY = useRef(new Animated.Value(0)).current;
  const splashFaceOpacity = useRef(new Animated.Value(0)).current;
  const splashOverlayOpacity = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  const homeNowInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const chatComposerInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  /** פתיחת צ׳אט ממיקוד בשדה — אחרי הלייאאוט מפעילים focus שוב כדי שהמקלדת תיפתח */
  const shouldRefocusComposerAfterChatOpenRef = useRef(false);
  /** מבטל timeouts של פתיחת צ׳אט (סגירה באמצע / unmount) */
  const chatOpenAnimGenerationRef = useRef(0);
  /** עד סיום שלב הקלף+המקלדת — לא מיישמים padding למקלדת על הקומפוזר */
  const suppressKeyboardForChatLayoutRef = useRef(false);
  const pendingKeyboardInsetRef = useRef(0);
  const closeChatSheetRef = useRef<(opts?: { gestureDx?: number }) => void>(() => {});
  const lastHomeTapAtRef = useRef(0);
  const lastHomeTapYRef = useRef(0);
  /** ref לכדור הסוכן בגלגל (פריט 0) – למדידת מיקום ל־Smart Animate */
  const wheelOrbRef = useRef<View>(null);
  const agentCardScrollRef = useRef<ScrollView>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusBarIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollYRef = useRef(0);
  /** מעבר חלק בין תווית העולם לאייקון Enter בכפתור הכדור; בחזרה ל־orb 0 מופיע מיד */
  const orbButtonLabelOpacity = useRef(new Animated.Value(1)).current;
  const orbButtonEnterOpacity = useRef(new Animated.Value(0)).current;
  const nowQuestionPulse = useRef(new Animated.Value(1)).current;
  const chatBackdropOpacity = useRef(new Animated.Value(0)).current;
  const chatSheetTranslateY = useRef(new Animated.Value(1200)).current;
  const chatSheetTranslateX = useRef(new Animated.Value(0)).current;
  /** פרופיל יחידה: החלקה לצד בחזרה לצ׳אט */
  const profileDismissSlideX = useRef(new Animated.Value(0)).current;
  const chatComposerTranslateY = useRef(new Animated.Value(0)).current;
  /** כדורים שכנים (לא במרכז): fade מסונכרן עם שורת המצב בכדור יחידה */
  const peripheralOrbsOpacity = useRef(new Animated.Value(1)).current;
  const chatActionBreath = useRef(new Animated.Value(1)).current;

  const currentWorldId = WORLDS[worldIndex]?.id ?? 'personal';
  const currentWorld = WORLDS[worldIndex] ?? WORLDS[0];
  const currentOrbData = currentWorldId === 'personal' ? personalOrbs : (ORB_DATA_BY_WORLD[currentWorldId] ?? ORB_DATA_BY_WORLD.personal);
  const currentWorldColor = WORLDS[worldIndex]?.color ?? WORLDS[0].color;
  const rawFirstName = user?.name?.trim()?.split(/\s+/)[0] || 'אריאל';
  const firstName = rawFirstName.toLowerCase() === 'guest' ? 'אורח' : rawFirstName;
  const personalGreeting = getTimeGreeting(new Date().getHours(), firstName);
  const nowInputHasText = nowValue.trim().length > 0;
  const nowInputIsRtl = /[\u0590-\u08FF]/.test(nowValue);
  const nowInputTextAlign: 'left' | 'right' = nowInputHasText ? (nowInputIsRtl ? 'right' : 'left') : 'left';
  const nowInputWritingDirection: 'ltr' | 'rtl' = nowInputHasText ? (nowInputIsRtl ? 'rtl' : 'ltr') : 'ltr';
  const isChatSystemWorking = chatStatusPhase === 'thinking' || chatStatusPhase === 'planning';
  const activeUnit = activeUnitId ? flowUnits.find((unit) => unit.id === activeUnitId) ?? null : null;
  const isDark = theme === 'dark';
  const chatSheetBg = isDark ? '#121212' : colors.background;
  const chatCardBg = isDark ? '#121317' : colors.surface;
  const chatOneBubbleBg = isDark ? '#ECEDEE' : '#f0f0f0';
  const profileRingR = 36;
  const profileRingC = 2 * Math.PI * profileRingR;
  const unitProgressPct = activeUnit ? Math.min(100, Math.max(0, activeUnit.progress)) / 100 : 0;
  const unitStepsDone = activeUnit ? Math.max(0, Math.round((activeUnit.progress / 100) * activeUnit.steps)) : 0;
  const profileAccent = currentWorldColor;
  const chatAgentAvatarBg = theme === 'light' ? '#000000' : '#1f1f1f';
  const generalWorldLabel = language === 'he' ? 'כללי' : 'General';
  const activeWorldChatLabel = currentWorldId === 'personal' ? generalWorldLabel : currentWorld.label;
  const historyUnitsForWorld = useMemo(() => {
    if (currentWorldId === 'personal') return flowUnits;
    return flowUnits.filter((unit) => unit.worldId === currentWorldId);
  }, [flowUnits, currentWorldId]);

  const agentChatProfileModel = useMemo((): AgentChatProfileModel => {
    const he = language === 'he';
    const agent = user?.agent;
    const name = agent?.name?.trim() || 'ONE';
    const personaKey = agent?.persona ?? 'friendly';
    const personaLine = `${he ? 'סגנון שיחה' : 'Persona'}: ${PERSONA_LABELS[personaKey]}`;
    const hats = (agent?.hats ?? ['base']).filter((h: Hat) => h !== 'base');
    const hatLabels = hats.length
      ? hats.map((h: Hat) => `${HAT_LABELS[h]} — ${he ? 'הקשר פעיל לפי הצורך' : 'context when relevant'}`)
      : [he ? 'מצב כללי — ללא כובע ממוקד' : 'General mode — no focused hat'];
    const worldLabelsEn: Record<string, string> = {
      personal: 'General',
      business: 'Business',
      health: 'Health',
      finance: 'Finance',
    };
    const worlds = WORLDS.map((w) => ({
      id: w.id,
      label: he ? w.label : worldLabelsEn[w.id] ?? w.label,
      color: w.color,
      active: w.id === currentWorldId,
      detail:
        w.id === 'personal'
          ? he
            ? 'כל היחידות והיסטוריה — ללא סינון מרחב.'
            : 'All units and history — no world filter.'
          : he
            ? `יחידות מתויגות לעולם «${w.label}» והקשר ${w.label} לסוכן.`
            : `Units tagged to «${worldLabelsEn[w.id] ?? w.label}» and matching context.`,
    }));
    const activeUnits = flowUnits.filter((u) => u.status !== 'done').length;
    const msgCount = chatSheetMessages.length;
    const stats: AgentChatProfileModel['stats'] = he
      ? [
          { label: 'יחידות במעקב', value: String(flowUnits.length), hint: `${activeUnits} פתוחות, ${flowUnits.length - activeUnits} אחרות` },
          { label: 'הודעות בשיחה', value: String(msgCount), hint: 'בצ׳אט ONE הנוכחי' },
          { label: 'מרחבים זמינים', value: String(WORLDS.length), hint: 'כללי, עסקים, בריאות, כלכלה' },
        ]
      : [
          { label: 'Units tracked', value: String(flowUnits.length), hint: `${activeUnits} open` },
          { label: 'Messages (chat)', value: String(msgCount), hint: 'In this ONE chat' },
          { label: 'Worlds', value: String(WORLDS.length), hint: 'General + 3 life lenses' },
        ];
    const permissions: AgentChatProfileModel['permissions'] = he
      ? [
          { label: 'התראות ועדכונים', state: 'on', note: 'תזכורות ליחידות וסטטוס סוכן.' },
          { label: 'גלריה / מצלמה', state: 'limited', note: 'רק אחרי שתאשרו בבחירת קובץ.' },
          { label: 'מיקרופון (הקלטה)', state: 'limited', note: 'לשימוש בצ׳אט כשתפעילו הקלטה.' },
          { label: 'אנשי קשר מהמכשיר', state: 'off', note: 'מתוכנן — שיתוף אנשי קשר בבחירה מפורשת.' },
          { label: 'מיקום', state: 'off', note: 'לא נאסף אוטומטית בגרסה זו.' },
        ]
      : [
          { label: 'Notifications', state: 'on', note: 'Unit reminders and agent status.' },
          { label: 'Gallery / camera', state: 'limited', note: 'Only after you approve a picker flow.' },
          { label: 'Microphone', state: 'limited', note: 'When you start voice capture in chat.' },
          { label: 'Device contacts', state: 'off', note: 'Planned — explicit sharing only.' },
          { label: 'Location', state: 'off', note: 'Not collected automatically in this build.' },
        ];
    const userDisplay = user?.name?.trim() || (he ? 'את/ה' : 'You');
    const contacts: AgentChatProfileModel['contacts'] = he
      ? [
          { role: 'בעלים של החשבון', name: userDisplay, note: 'העדפות, שפה ומראה נשמרים אצלך במכשיר ובחשבון.' },
          { role: 'סוכן אישי', name, note: 'מנוע אחד — כובעים שונים לפי מרחב.' },
          { role: 'ספקים חיצוניים', name: he ? 'לפי יחידה' : 'Per unit', note: he ? 'יופיעו כשתחברו שירות או איש קשר לתהליך.' : 'Appear when you link a service or person to a unit.' },
        ]
      : [
          { role: 'Account owner', name: userDisplay, note: 'Preferences, language, appearance.' },
          { role: 'Personal agent', name, note: 'One engine — different hats per world.' },
          { role: 'External parties', name: 'Per unit', note: 'Shown when you attach providers to a process.' },
        ];
    const dataRows: AgentChatProfileModel['dataRows'] = he
      ? [
          { label: 'יחידות במערכת', value: String(flowUnits.length) },
          { label: 'מרחב נוכחי בצ׳אט', value: activeWorldChatLabel },
          { label: 'כובעים פעילים', value: hats.map((h: Hat) => HAT_LABELS[h]).join(', ') || HAT_LABELS.base },
          { label: 'זיכרון שיחה', value: 'שמירת הקשר בתוך היחידה' },
        ]
      : [
          { label: 'Units in workspace', value: String(flowUnits.length) },
          { label: 'Current chat world', value: activeWorldChatLabel },
          { label: 'Active hats', value: hats.map((h: Hat) => HAT_LABELS[h]).join(', ') || HAT_LABELS.base },
          { label: 'Conversation memory', value: 'Context is kept per unit' },
        ];
    return {
      name,
      tagline: he
        ? 'מנהל אישי אחד — מסונכרן בין מרחבים, יחידות והרשאות.'
        : 'One personal manager — synced across worlds, units, and permissions.',
      personaLine,
      worlds,
      hatsIntro: he
        ? 'הכובעים מצמצמים את ההקשר: אותו סוכן, פרשנות שונה לפי חיים / עבודה / בריאות / כספים.'
        : 'Hats narrow context: same agent, different emphasis per life area.',
      hatLabels,
      permissions,
      contacts,
      dataRows,
      stats,
      privacyLead: he
        ? 'המידע משמש לתאם משימות ולהציג לך סיכומים. לא מוכרים פרופילים לצד שלישי לצורכי פרסום.'
        : 'Data is used to coordinate tasks and show you summaries. No ad-profile resale.',
      opsBullets: he
        ? [
            'מודל שפה בענן — תוכן השיחה נשלח לעיבוד לפי בקשתך.',
            'גיבויים: חשבון ONE וסנכרון מכשיר לפי ההגדרות שלך.',
            'מפתחות API ואינטגרציות — יופיעו כאן כשיתווספו.',
          ]
        : [
            'Language model in the cloud — chat content is sent when you ask.',
            'Backups: ONE account and device sync per your settings.',
            'API keys & integrations — will appear here when connected.',
          ],
      nextHint: he
        ? 'פתחו יחידה מהגלגל או חברו איש קשר לתהליך — הסוכן יעדכן כאן הרשאות ונתונים לפי הצורך.'
        : 'Open a unit from the wheel or attach a contact — permissions and data update as you go.',
      summary: he
        ? 'זהו כרטיס בית לסוכן: איפה הוא עובד, מה מותר לו, מי מחובר, ומה נמדד. השאר נבנה מתוך השיחה והיחידות.'
        : 'Home card for your agent: where it works, what is allowed, who is involved, and what we measure — grown from chat and units.',
      metaFoot: he
        ? 'נתונים מינימליים — שקיפות מקסימלית. לשינוי הרשאות: הגדרות המערכת והנחיות בצ׳אט.'
        : 'Minimal data — maximal clarity. Change permissions via system settings and chat.',
    };
  }, [language, user, currentWorldId, activeWorldChatLabel, flowUnits, chatSheetMessages]);


  /** מעבר חלק בכפתור כדור: לכדור אחר – פייד; חזרה לראשי – פייד־אין קצר (בלי קפיצה) */
  useEffect(() => {
    const toFirstOrb = orbIndex === 0;
    const duration = toFirstOrb ? 120 : 200;
    Animated.parallel([
      Animated.timing(orbButtonLabelOpacity, { toValue: toFirstOrb ? 1 : 0, duration, useNativeDriver: true }),
      Animated.timing(orbButtonEnterOpacity, { toValue: toFirstOrb ? 0 : 1, duration, useNativeDriver: true }),
    ]).start();
  }, [orbIndex, orbButtonLabelOpacity, orbButtonEnterOpacity]);

  /** פולס עדין לטקסט placeholder (עכשיו? / Now?) – לא נעלם לגמרי */
  useEffect(() => {
    nowQuestionPulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nowQuestionPulse, { toValue: 0.45, duration: 500, useNativeDriver: true }),
        Animated.timing(nowQuestionPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nowQuestionPulse, showChatSheet]);

  useEffect(() => {
    if (!showChatSheet || !isChatSystemWorking) {
      chatActionBreath.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chatActionBreath, { toValue: 0.72, duration: 520, useNativeDriver: true }),
        Animated.timing(chatActionBreath, { toValue: 1, duration: 520, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showChatSheet, isChatSystemWorking, chatActionBreath]);

  /** אנימציית חלון ארנק – נכנס מלמעלה למטה */
  useEffect(() => {
    if (showCredits) {
      walletSlideAnim.setValue(-windowHeight);
      Animated.timing(walletSlideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    }
  }, [showCredits, windowHeight, walletSlideAnim]);

  /** Keep chat input above keyboard without shifting header */
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const applyInset = (h: number) => {
      pendingKeyboardInsetRef.current = h;
      if (!suppressKeyboardForChatLayoutRef.current) setKeyboardOffset(h);
    };
    const showSub = Keyboard.addListener(showEvt, (e) => {
      const kbH = e.endCoordinates?.height ?? 0;
      applyInset(Math.max(0, kbH - insets.bottom));
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      pendingKeyboardInsetRef.current = 0;
      if (!suppressKeyboardForChatLayoutRef.current) setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  /** בפתיחת פופאפ פרופיל סוכן – גלילה לכרטיס העולם הנוכחי */
  useEffect(() => {
    if (!showAgentCard) return;
    const x = agentCardWorldIndex * contentWidth;
    const t = setTimeout(() => agentCardScrollRef.current?.scrollTo({ x, animated: false }), 80);
    return () => clearTimeout(t);
  }, [showAgentCard, contentWidth]);

  /** ספלאש בסגנון Smart Animate: גדילה → ריחוף → פרצוף → הכדור נע למיקום הסוכן בגלגל (אותו קנבס) ואז השכבה נעלמת */
  useEffect(() => {
    if (!showSplashOverlay) return;
    splashScale.setValue(0);
    splashTranslateX.setValue(0);
    splashTranslateY.setValue(0);
    splashFaceOpacity.setValue(0);
    splashOverlayOpacity.setValue(1);

    const runFlyToTarget = () => {
      const node = wheelOrbRef.current as (View & { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void }) | null;
      if (!node?.measureInWindow) {
        Animated.timing(splashOverlayOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
          if (finished) {
            setSplashDone(true);
            markOrbSplashComplete();
          }
        });
        return;
      }
      node.measureInWindow((x, y, w, h) => {
        const targetCenterX = x + w / 2;
        const targetCenterY = y + h / 2;
        const originCenterX = windowWidth / 2;
        const originCenterY = windowHeight / 2;
        splashTranslateX.setValue(0);
        splashTranslateY.setValue(-70);
        Animated.parallel([
          Animated.timing(splashTranslateX, {
            toValue: targetCenterX - originCenterX,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(splashTranslateY, {
            toValue: targetCenterY - originCenterY,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(splashOverlayOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) {
            setSplashDone(true);
            markOrbSplashComplete();
          }
        });
      });
    };

    Animated.sequence([
      Animated.timing(splashScale, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(splashTranslateY, { toValue: -70, duration: 400, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(splashFaceOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(80),
    ]).start(({ finished }) => {
      if (finished) runFlyToTarget();
    });
  }, [showSplashOverlay, windowWidth, windowHeight]);

  const closeWallet = useCallback(() => {
    Animated.timing(walletSlideAnim, { toValue: -windowHeight, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowCredits(false);
    });
  }, [walletSlideAnim, windowHeight]);

  const openChatSheet = useCallback(() => {
    setShowAttachSheet(false);
    setShowCredits(false);
    setShowChatMenu(false);
    const selectedOrb = currentOrbData[orbIndex];
    if (selectedOrb && selectedOrb.id !== 'origin') {
      let target = flowUnits.find((u) => u.id === selectedOrb.id);
      if (!target) {
        const isLicenseOrb = selectedOrb.id === 'license';
        target = {
          id: selectedOrb.id,
          worldId: currentWorldId,
          title: selectedOrb.title,
          subtitle: selectedOrb.subtitle || 'תהליך עם ליווי ONE',
          emoji: selectedOrb.emoji || '🧩',
          status: 'active',
          progress: 0,
          steps: isLicenseOrb ? 25 : 12,
          messages: [
            {
              id: `seed_${selectedOrb.id}`,
              sender: 'one',
              text: `פתחת את «${selectedOrb.title}». כתוב מה כבר נעשה — ואעדכן צעדים.`,
            },
          ],
          goal: `להשלים את «${selectedOrb.title}» בצורה מסודרת — צעד אחר צעד.`,
          city: 'ישראל',
          etaWeeks: isLicenseOrb ? 8 : 6,
          budgetMinIls: isLicenseOrb ? 4500 : undefined,
          budgetMaxIls: isLicenseOrb ? 7500 : undefined,
          peopleRoles: [
            { id: 'np1', role: 'סוכן', name: 'ONE' },
            { id: 'np2', role: 'אחראי/ת', name: 'את/ה' },
          ],
          nextAction: 'לפרט בצ׳אט מה כבר בוצע ומה חסר — אכין רשימת צעדים מדויקת.',
          lastUpdatedLabel: 'נפתח עכשיו',
          blockCount: isLicenseOrb ? 6 : 5,
        };
        setFlowUnits((prev) => [target!, ...prev.filter((u) => u.id !== target!.id)]);
      }
      setActiveUnitId(target.id);
      setOneChatUnitHistoryOpen(false);
    } else {
      setActiveUnitId(null);
      setOneChatUnitHistoryOpen(false);
    }
    chatBackdropOpacity.setValue(0);
    chatSheetTranslateY.setValue(windowHeight);
    setShowChatSheet(true);
  }, [currentOrbData, orbIndex, flowUnits, windowHeight, chatBackdropOpacity, chatSheetTranslateY, currentWorldId]);

  const closeAttachSheet = useCallback(() => {
    setShowAttachSheet(false);
  }, []);

  const openAttachSheet = useCallback(() => {
    shouldRefocusComposerAfterChatOpenRef.current = false;
    setShowCredits(false);
    Keyboard.dismiss();
    setShowAttachSheet(true);
  }, []);

  const closeChatSheet = useCallback(
    (opts?: { gestureDx?: number }) => {
      setShowAttachSheet(false);
      chatOpenAnimGenerationRef.current += 1;
      shouldRefocusComposerAfterChatOpenRef.current = false;
      suppressKeyboardForChatLayoutRef.current = false;
      homeNowInputRef.current?.blur();
      chatComposerInputRef.current?.blur();
      setIsChatInputFocused(false);
      setIsInputFocused(false);
      pendingKeyboardInsetRef.current = 0;
      setKeyboardOffset(0);
      Keyboard.dismiss();
      chatComposerTranslateY.setValue(0);
      const dir =
        opts?.gestureDx != null && Math.abs(opts.gestureDx) > 8
          ? Math.sign(opts.gestureDx)
          : isRtlLayout
            ? 1
            : -1;
      /** יציאה לצד בלבד — בלי ירידה למטה (פתיחה נשארת מלמטה) */
      const exitX = dir * Math.min(windowWidth * 1.12, windowWidth + 48);
      Animated.parallel([
        Animated.timing(chatBackdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chatSheetTranslateX, {
          toValue: exitX,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        chatSheetTranslateX.setValue(0);
        chatSheetTranslateY.setValue(windowHeight);
        chatComposerTranslateY.setValue(0);
        setShowChatSheet(false);
        setShowChatMenu(false);
        setShowChatProfile(false);
        setChatProfileEditMode(false);
      setChatOpenedFromOrbProfileShortcut(false);
        setShowCredits(false);
        /** אחרי שהקלף נסגר — לא לפני, כדי שלא יבזק מסך «My One» בזמן האנימציה */
        setActiveUnitId(null);
      });
    },
    [windowWidth, isRtlLayout, chatBackdropOpacity, chatSheetTranslateY, chatSheetTranslateX, chatComposerTranslateY]
  );

  closeChatSheetRef.current = closeChatSheet;

  useEffect(() => {
    if (!showAttachSheet && !showChatSheet) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showAttachSheet) {
        setShowAttachSheet(false);
        return true;
      }
      if (showChatSheet) {
        closeChatSheet();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showAttachSheet, showChatSheet, closeChatSheet]);

  useEffect(() => {
    if (!showChatSheet) {
      suppressKeyboardForChatLayoutRef.current = false;
      pendingKeyboardInsetRef.current = 0;
      setKeyboardOffset(0);
      chatComposerTranslateY.setValue(0);
      chatSheetTranslateX.setValue(0);
      return;
    }
    let cancelled = false;
    const animGen = ++chatOpenAnimGenerationRef.current;
    suppressKeyboardForChatLayoutRef.current = true;
    pendingKeyboardInsetRef.current = 0;
    setKeyboardOffset(0);
    chatBackdropOpacity.setValue(0);
    chatSheetTranslateY.setValue(windowHeight);
    chatSheetTranslateX.setValue(0);
    chatComposerTranslateY.setValue(0);

    const wantKeyboard = shouldRefocusComposerAfterChatOpenRef.current;
    if (wantKeyboard) {
      shouldRefocusComposerAfterChatOpenRef.current = false;
      chatComposerInputRef.current?.focus();
    }
    suppressKeyboardForChatLayoutRef.current = false;
    setKeyboardOffset(pendingKeyboardInsetRef.current);

    const frame = requestAnimationFrame(() => {
      if (cancelled || animGen !== chatOpenAnimGenerationRef.current) return;
      /** בלי spring overshoot — נכנס מלמטה ישר למקום (בלי “קופץ מעל ואז נמתח למטה”) */
      Animated.parallel([
        Animated.timing(chatBackdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chatSheetTranslateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      suppressKeyboardForChatLayoutRef.current = false;
      chatOpenAnimGenerationRef.current += 1;
    };
  }, [showChatSheet, windowHeight, chatBackdropOpacity, chatSheetTranslateY, chatSheetTranslateX, chatComposerTranslateY]);

  const collapseProfileToChat = useCallback(() => {
    if (chatOpenedFromOrbProfileShortcut) {
      closeChatSheetRef.current?.();
      return;
    }
    const exitW = Math.min(260, windowWidth * 0.38);
    const toX = isRtlLayout ? exitW : -exitW;
    Animated.timing(profileDismissSlideX, {
      toValue: toX,
      duration: 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        profileDismissSlideX.setValue(0);
        setShowChatProfile(false);
        setChatProfileEditMode(false);
      }
    });
  }, [chatOpenedFromOrbProfileShortcut, isRtlLayout, windowWidth, profileDismissSlideX]);

  const chatSheetEdgePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 22 && Math.abs(g.dx) > Math.abs(g.dy) + 12,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) <= 88 || Math.abs(g.dx) <= Math.abs(g.dy)) return;
          if (showChatProfile) {
            if (chatOpenedFromOrbProfileShortcut) {
              closeChatSheetRef.current?.({ gestureDx: g.dx });
              return;
            }
            const exitW = Math.min(260, windowWidth * 0.38);
            const toX = g.dx > 0 ? exitW : -exitW;
            Animated.timing(profileDismissSlideX, {
              toValue: toX,
              duration: 210,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                profileDismissSlideX.setValue(0);
                setShowChatProfile(false);
                setChatProfileEditMode(false);
              }
            });
          } else {
            closeChatSheetRef.current?.({ gestureDx: g.dx });
          }
        },
      }),
    [showChatProfile, chatOpenedFromOrbProfileShortcut, windowWidth, profileDismissSlideX]
  );

  const openChatProfile = useCallback(() => {
    Keyboard.dismiss();
    setShowChatMenu(false);
    setChatProfileEditMode(false);
    profileDismissSlideX.setValue(isRtlLayout ? -56 : 56);
    setShowChatProfile(true);
    requestAnimationFrame(() => {
      Animated.spring(profileDismissSlideX, {
        toValue: 0,
        stiffness: 420,
        damping: 32,
        useNativeDriver: true,
      }).start();
    });
  }, [isRtlLayout, profileDismissSlideX]);

  const shareChatUnitProfile = useCallback(async () => {
    try {
      const headline = activeUnit?.title ?? 'ONE';
      const detail = activeUnit?.nextAction ?? activeUnit?.subtitle ?? 'מעקב אחר תהליכים אישיים';
      await Share.share({ message: `${headline}\n${detail}` });
    } catch {
      /* משתמש ביטל או שיתוף לא זמין */
    }
  }, [activeUnit]);

  const scrollOneChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollToEnd({ animated: false });
      });
    });
  }, []);

  useEffect(() => {
    if (!showChatSheet) setOneChatUnitHistoryOpen(false);
  }, [showChatSheet]);

  useEffect(() => {
    if (!showChatSheet || !showChatProfile) return;
    const t = setTimeout(() => chatScrollRef.current?.scrollTo({ y: 0, animated: false }), 60);
    return () => clearTimeout(t);
  }, [showChatProfile, showChatSheet]);

  useEffect(() => {
    if (!showChatProfile) {
      chatProfileCompactScrollRef.current = false;
      setChatProfileHeaderCompact(false);
      profileDismissSlideX.setValue(0);
    }
  }, [showChatProfile, profileDismissSlideX]);

  const CHAT_PROFILE_COMPACT_SCROLL_Y = 128;

  const onChatProfileScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!showChatProfile) return;
      const y = e.nativeEvent.contentOffset.y;
      const compact = y > CHAT_PROFILE_COMPACT_SCROLL_Y;
      if (compact !== chatProfileCompactScrollRef.current) {
        chatProfileCompactScrollRef.current = compact;
        setChatProfileHeaderCompact(compact);
      }
    },
    [showChatProfile]
  );

  /** ONE chat: גלילה לסוף כשההיסטוריה סגורה; פתיחת היסטוריה — גלילה לראש הרשימה */
  useEffect(() => {
    if (!showChatSheet || activeUnitId) return;
    if (oneChatUnitHistoryOpen) {
      const t = setTimeout(() => chatScrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(scrollOneChatToBottom, 40);
    const t2 = setTimeout(scrollOneChatToBottom, 120);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [
    showChatSheet,
    activeUnitId,
    oneChatUnitHistoryOpen,
    flowUnits.length,
    chatSheetMessages.length,
    scrollOneChatToBottom,
  ]);

  const submitNowValue = useCallback(() => {
    const text = nowValue.trim();
    if (!text) return;
    setChatStatusPhase('thinking');

    const userLine: ChatLine = { id: `u_${Date.now()}`, sender: 'user', text };

    if (activeUnitId) {
      setFlowUnits((prev) =>
        prev.map((unit) =>
          unit.id === activeUnitId
            ? {
                ...unit,
                messages: [
                  ...unit.messages,
                  userLine,
                  { id: `o_${Date.now() + 1}`, sender: 'one', text: 'Updated. I logged this in your unit and adjusted the next steps.' },
                ],
              }
            : unit
        )
      );
      setNowValue('');
      setTimeout(() => setChatStatusPhase('planning'), 700);
      setTimeout(() => setChatStatusPhase('ready'), 1400);
      setTimeout(() => setChatStatusPhase('agent'), 2600);
      return;
    }

    const intakeQuestions = [
      'In which city?',
      'What budget range should we target?',
      'What timeline do you want?',
    ];

    if (intakeState) {
      const nextAnswers = [...intakeState.answers, text];
      const nextIndex = intakeState.questionIndex + 1;
      setChatSheetMessages((prev) => [...prev, userLine]);
      if (nextIndex < intakeQuestions.length) {
        setIntakeState({ ...intakeState, questionIndex: nextIndex, answers: nextAnswers });
        setChatSheetMessages((prev) => [...prev, { id: `q_${Date.now()}`, sender: 'one', text: intakeQuestions[nextIndex] }]);
      } else {
        const intent = intakeState.intent.toLowerCase();
        const isLicense = intent.includes('license') || intent.includes('רישיון');
        const newUnitId = `unit_${Date.now()}`;
        const [cityAns, , timelineAns] = nextAnswers;
        const weeksGuess =
          typeof timelineAns === 'string' && /\d+/.test(timelineAns)
            ? Math.min(24, Math.max(2, parseInt(timelineAns.match(/\d+/)![0], 10)))
            : 8;
        const newUnit: FlowUnit = {
          id: newUnitId,
          worldId: currentWorldId,
          title: isLicense ? 'רישיון נהיגה' : intakeState.intent.slice(0, 28),
          subtitle: isLicense ? 'תיאוריה · שיעורים · מבחן מעשי' : 'יחידה חדשה שנוצרה מהשיחה',
          emoji: isLicense ? '🚗' : '🧩',
          status: 'active',
          progress: 0,
          steps: isLicense ? 25 : 10,
          messages: [
            {
              id: `created_${Date.now()}`,
              sender: 'one',
              text: isLicense
                ? 'היחידה נוצרה. נתחיל מהמסמכים והרשמה לתיאוריה — כתוב אם כבר יש לך תואם רפואי.'
                : 'היחידה נוצרה. נפרק את המטרה לשלוש משימות ראשונות — מה הכי דחוף בשבילך?',
            },
          ],
          goal: isLicense
            ? 'לעבור תיאוריה, שיעורים ומבחן מעשי לרישיון נהיגה.'
            : `להשלים: ${intakeState.intent.slice(0, 72)}`,
          city: cityAns || 'לא צוין',
          etaWeeks: weeksGuess,
          budgetMinIls: isLicense ? 4500 : undefined,
          budgetMaxIls: isLicense ? 7000 : undefined,
          peopleRoles: [
            { id: 'nu1', role: 'סוכן', name: 'ONE' },
            { id: 'nu2', role: 'אחראי/ת', name: 'את/ה' },
          ],
          nextAction: isLicense
            ? 'לאסוף תו רפואי וצילום ת.ז., ואז להירשם למבחן תיאוריה.'
            : 'לנסח בשורה אחת מה נחשב «סיום מוצלח» ליחידה הזו.',
          lastUpdatedLabel: 'נוצר עכשיו מהשיחה',
          blockCount: isLicense ? 6 : 5,
        };
        setFlowUnits((prev) => [newUnit, ...prev]);
        setPersonalOrbs((prev) => [
          ...prev,
          { id: newUnitId, emoji: newUnit.emoji, title: newUnit.title, subtitle: newUnit.subtitle },
        ]);
        setChatSheetMessages((prev) => [
          ...prev,
          {
            id: `createdlog_${Date.now()}`,
            sender: 'one',
            text: `Created new unit: ${newUnit.title} (${newUnit.status})`,
          },
        ]);
        setIntakeState(null);
        setActiveUnitId(newUnitId);
      }
      setNowValue('');
      setTimeout(() => setChatStatusPhase('planning'), 900);
      setTimeout(() => setChatStatusPhase('ready'), 1800);
      setTimeout(() => setChatStatusPhase('agent'), 3200);
      return;
    }

    const matched = flowUnits.find((unit) =>
      text.toLowerCase().includes(unit.title.toLowerCase()) ||
      unit.title.toLowerCase().includes(text.toLowerCase())
    );
    if (matched) {
      setChatSheetMessages((prev) => [
        ...prev,
        userLine,
        { id: `open_${Date.now()}`, sender: 'one', text: `Opening existing unit: ${matched.title}` },
      ]);
      setActiveUnitId(matched.id);
    } else {
      setChatSheetMessages((prev) => [
        ...prev,
        userLine,
        { id: `start_${Date.now()}`, sender: 'one', text: 'I need a few details before creating your unit.' },
        { id: `q0_${Date.now()}`, sender: 'one', text: intakeQuestions[0] },
      ]);
      setIntakeState({ intent: text, questionIndex: 0, answers: [] });
    }
    setNowValue('');
    setTimeout(() => setChatStatusPhase('planning'), 900);
    setTimeout(() => setChatStatusPhase('ready'), 1800);
    setTimeout(() => setChatStatusPhase('agent'), 3200);
  }, [nowValue, activeUnitId, intakeState, flowUnits, currentWorldId]);

  const appendUserAttachmentMessage = useCallback(
    (text: string) => {
      setChatStatusPhase('thinking');
      const uid = Date.now();
      const userLine: ChatLine = { id: `u_${uid}`, sender: 'user', text };
      const oneLine: ChatLine = {
        id: `o_${uid + 1}`,
        sender: 'one',
        text:
          language === 'he'
            ? 'קיבלתי את הצירוף — נשתמש בו בעדכון הצעדים.'
            : 'Attachment noted — we will fold it into the next step update.',
      };
      if (activeUnitId) {
        setFlowUnits((prev) =>
          prev.map((u) => (u.id === activeUnitId ? { ...u, messages: [...u.messages, userLine, oneLine] } : u))
        );
      } else {
        setChatSheetMessages((prev) => [...prev, userLine, oneLine]);
      }
      setTimeout(() => setChatStatusPhase('planning'), 700);
      setTimeout(() => setChatStatusPhase('ready'), 1400);
      setTimeout(() => setChatStatusPhase('agent'), 2600);
    },
    [activeUnitId, language]
  );

  const renameActiveUnit = useCallback((nextTitle: string) => {
    if (!activeUnitId) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setFlowUnits((prev) => prev.map((u) => (u.id === activeUnitId ? { ...u, title: trimmed } : u)));
    setPersonalOrbs((prev) => prev.map((o) => (o.id === activeUnitId ? { ...o, title: trimmed } : o)));
  }, [activeUnitId]);

  const handleAttachPick = useCallback(
    (id: AttachActionId) => {
      const he = language === 'he';
      const runAfterChatOpen = (fn: () => void) => {
        if (!showChatSheetRef.current) {
          openChatSheet();
          setTimeout(fn, 380);
        } else {
          fn();
        }
      };

      void (async () => {
        switch (id) {
          case 'wallet':
            setShowAttachSheet(false);
            setShowCredits(true);
            return;
          case 'chat':
            setShowAttachSheet(false);
            openChatSheet();
            return;
          case 'gallery':
          case 'camera': {
            setShowAttachSheet(false);
            if (Platform.OS === 'web') {
              Alert.alert(
                he ? 'לא זמין בדפדפן' : 'Not available on web',
                he ? 'באפליקציה ניתן לבחור תמונה מהמכשיר.' : 'Use the mobile app to pick photos from the device.'
              );
              return;
            }
            const perm =
              id === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert(
                he ? 'אין הרשאה' : 'Permission needed',
                he ? 'נדרשת גישה לגלריה או למצלמה.' : 'Allow library or camera access in Settings.'
              );
              return;
            }
            const result =
              id === 'camera'
                ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.85,
                    allowsEditing: true,
                  });
            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];
            const label = he
              ? `📷 תמונה (${asset.width}×${asset.height})`
              : `📷 Photo (${asset.width}×${asset.height})`;
            runAfterChatOpen(() => appendUserAttachmentMessage(label));
            return;
          }
          case 'clipboard': {
            setShowAttachSheet(false);
            try {
              const Clipboard = await import('expo-clipboard');
              const pasted = await Clipboard.getStringAsync();
              if (!pasted?.trim()) {
                Alert.alert(he ? 'הלוח ריק' : 'Clipboard empty', he ? 'אין טקסט להדבקה.' : 'No text to paste.');
                return;
              }
              const snippet = pasted.length > 600 ? `${pasted.slice(0, 600)}…` : pasted;
              runAfterChatOpen(() =>
                appendUserAttachmentMessage(he ? `📋 מהלוח:\n${snippet}` : `📋 From clipboard:\n${snippet}`)
              );
            } catch {
              Alert.alert(he ? 'שגיאה' : 'Error', he ? 'לא הצלחנו לקרוא את הלוח.' : 'Could not read the clipboard.');
            }
            return;
          }
          case 'contact':
          case 'document':
          case 'location':
            setShowAttachSheet(false);
            Alert.alert(
              he ? 'בקרוב' : 'Coming soon',
              he ? 'איש קשר, קבצים ומיקום יתווספו בגרסה הבאה.' : 'Contacts, files, and location sharing are planned next.'
            );
            return;
          default:
            setShowAttachSheet(false);
        }
      })();
    },
    [language, openChatSheet, appendUserAttachmentMessage]
  );

  const topBarHeight = insets.top + BAR_EXTRA;
  const bottomBarHeight = insets.bottom + BAR_EXTRA;
  const paddingVertical = (windowHeight - WHEEL_ITEM_HEIGHT) / 2;

  const largeOrbSize = Math.min(contentWidth, windowHeight) * ORB_SIZE_RATIO;
  const smallOrbSize = largeOrbSize * SMALL_ORB_RATIO;
  /** בגלגל: גודל כשלא במרכז (רק אימוג'י) */
  const wheelOrbSize = Math.min(contentWidth * 0.32, windowHeight * 0.16, 100);
  /** בגלגל: גודל במרכז – כדור גדול כשממורכז (אימוג'י + כותרת + תת־כותרת) */
  const centerOrbSize = Math.min(largeOrbSize * 0.92, WHEEL_ITEM_HEIGHT * 1.4, 380);
  const wheelSnapOffsets = currentOrbData.map((_, i) => i * WHEEL_ITEM_HEIGHT);
  const agentCircleColor = theme === 'dark' ? EMOJI_CIRCLE_DARK : EMOJI_CIRCLE_LIGHT;

  const resetInactivityTimer = useCallback(
    (ctx?: { orbIndex?: number }) => {
      const effectiveOrb = ctx?.orbIndex ?? orbIndex;
      peripheralOrbsOpacity.stopAnimation();
      peripheralOrbsOpacity.setValue(1);

      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
      if (statusBarIdleRef.current) {
        clearTimeout(statusBarIdleRef.current);
        statusBarIdleRef.current = null;
      }

      const overlaysOpen = showChatSheet || showCredits || showAttachSheet || showAgentCard;
      const onOrbHome = viewMode === 'orb' && !overlaysOpen;

      const fadeNeighborsOut = () => {
        /** JS driver: לא לשלב עם multiply מול width/height אנימטיביים (orbSize) — Native Animated דוחה */
        Animated.timing(peripheralOrbsOpacity, {
          toValue: 0,
          duration: IDLE_CHROME_FADE_MS,
          useNativeDriver: false,
        }).start();
      };

      if (!onOrbHome) {
        setUnitOrbSystemBarVisible(true);
        return;
      }

      if (effectiveOrb > 0) {
        setUnitOrbSystemBarVisible(true);
        statusBarIdleRef.current = setTimeout(() => {
          fadeNeighborsOut();
          setUnitOrbSystemBarVisible(false);
          statusBarIdleRef.current = null;
        }, UNIT_ORB_STATUS_BAR_IDLE_MS);
      } else {
        inactivityRef.current = setTimeout(() => {
          fadeNeighborsOut();
          inactivityRef.current = null;
        }, INACTIVITY_HIDE_MS);
      }
    },
    [orbIndex, viewMode, showChatSheet, showCredits, showAttachSheet, showAgentCard, peripheralOrbsOpacity]
  );

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (statusBarIdleRef.current) clearTimeout(statusBarIdleRef.current);
    };
  }, [resetInactivityTimer]);

  const onOrbScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.max(0, Math.min(Math.round(y / WHEEL_ITEM_HEIGHT), currentOrbData.length - 1));
      setOrbIndex(index);
      resetInactivityTimer({ orbIndex: index });
    },
    [currentOrbData.length, resetInactivityTimer]
  );

  const renderOrbContent = useCallback((item: OrbItem, isSmall: boolean) => {
    if (isSmall) {
      return <Text style={styles.orbEmojiSmall}>{item.emoji}</Text>;
    }
    return (
      <>
        <Text style={styles.orbEmojiLarge}>{item.emoji}</Text>
        <Text style={[styles.orbTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.orbSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
      </>
    );
  }, [colors]);

  const renderOrb = useCallback((item: OrbItem, size: number, isSmall: boolean) => (
    <View
      key={item.id}
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'transparent',
          borderWidth: 0,
        },
      ]}
    >
      <View style={styles.orbInner}>
        {renderOrbContent(item, isSmall)}
      </View>
    </View>
  ), [renderOrbContent]);

  const scrollToOrb = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
  }, []);

  const handleHomeDoubleTap = useCallback(
    (tapY: number) => {
      const now = Date.now();
      const deltaMs = now - lastHomeTapAtRef.current;
      const deltaY = Math.abs(tapY - lastHomeTapYRef.current);
      const goingToAgentOrb = orbIndex > 0 && deltaMs > 40 && deltaMs < 320 && deltaY < 56;
      if (goingToAgentOrb) {
        scrollToOrb(0);
        resetInactivityTimer({ orbIndex: 0 });
      } else {
        resetInactivityTimer();
      }
      lastHomeTapAtRef.current = now;
      lastHomeTapYRef.current = tapY;
    },
    [orbIndex, resetInactivityTimer, scrollToOrb]
  );

  /** במחשב: גלילה עם גלגלת העכבר מעבירה כדור אחד בכל פעם */
  const handleWheel = useCallback((e: { preventDefault?: () => void; nativeEvent?: { deltaY: number }; deltaY?: number }) => {
    if (Platform.OS !== 'web') return;
    resetInactivityTimer();
    e.preventDefault?.();
    const deltaY = e.nativeEvent?.deltaY ?? (e as { deltaY: number }).deltaY ?? 0;
    const y = lastScrollYRef.current;
    const i = Math.round(y / WHEEL_ITEM_HEIGHT);
    const maxIndex = currentOrbData.length - 1;
    const next = deltaY > 0 ? Math.min(i + 1, maxIndex) : Math.max(i - 1, 0);
    if (next !== i) scrollRef.current?.scrollTo({ y: next * WHEEL_ITEM_HEIGHT, animated: true });
  }, [currentOrbData.length, resetInactivityTimer]);

  /** פריט אחד בגלגל: גודל כדור + opacity טקסט מונפשים לפי scroll (מעבר מהיר וחלק, בלי קפיצה). */
  const renderWheelItem = useCallback((item: OrbItem, index: number) => {
    const H = WHEEL_ITEM_HEIGHT;
    const i = index;
    const inputRange = [i - 2, i - 1, i, i + 1, i + 2].map((x) => x * H);
    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.28, 0.55, 1, 0.55, 0.28],
      extrapolate: 'clamp',
    });
    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.35, 0.7, 1, 0.7, 0.35],
      extrapolate: 'clamp',
    });
    /** מעבר גודל מהיר: קטן → גדול במרכז על ~0.25 שורות גלילה */
    const sizeRange = [(i - 1) * H, (i - 0.25) * H, i * H, (i + 0.25) * H, (i + 1) * H];
    const orbSize = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [wheelOrbSize, wheelOrbSize, centerOrbSize, wheelOrbSize, wheelOrbSize],
      extrapolate: 'clamp',
    });
    /** טקסט מופיע מהר – טווח רחב ל־1 כדי שבחזרה לכדור ראשי התוכן נראה מיד */
    const textOpacityRange = [(i - 0.5) * H, (i - 0.28) * H, (i + 0.28) * H, (i + 0.5) * H];
    const textOpacity = scrollY.interpolate({
      inputRange: textOpacityRange,
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
    /** כדור הסוכן מוגבה מעל לכותרת – רווח ביניהם כשממורכז */
    const emojiMarginTop = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, index === 0 ? -142 : -135, 0, 0],
      extrapolate: 'clamp',
    });
    const textBlockMarginTop = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -10, 0, 0],
      extrapolate: 'clamp',
    });
    /** מעלה תוכן רק בכדור המרכזי (בלי לחתוך את הכדורים הקטנים) */
    const centerContentLift = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -25, 0, 0],
      extrapolate: 'clamp',
    });
    /** הכדור הממורכז (ראש הסוכן) מוגבה 15px למעלה */
    const orbTranslateY = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -25, 0, 0],
      extrapolate: 'clamp',
    });
    /** כדורים שכנים (למעלה/למטה) יורדים מעט למטה לפי הבקשה; המרכז נשאר במקום */
    const neighborDownShift = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [24, 16, 0, 16, 24],
      extrapolate: 'clamp',
    });
    /** שכבה כפולה: opacity מהגלילה × fade שכנים — בלי Animated.multiply (לא תואם width/height אנימטיביים ב־native driver) */
    const neighborFadeOpacity = index === orbIndex ? 1 : peripheralOrbsOpacity;
    const debugOutline = SHOW_ORB_DEBUG_OUTLINE ? styles.orbDebugOutline : undefined;
    /** רקע עיגול הסוכן רק בכדור הראשון – צבע לפי מצב כהה/בהיר */
    const emojiCircleBg = index === 0 ? agentCircleColor : 'transparent';
    /** גודל עיגול הסוכן: מלא בראשי, קטן בשאר העולמות */
    const agentCircleSize = index === 0 && currentWorldId !== 'personal'
      ? AGENT_CIRCLE_SIZE_OTHER_WORLDS
      : EMOJI_CIRCLE_SIZE;
    const agentIconSize = index === 0 && currentWorldId !== 'personal'
      ? Math.round(WORLD_ICON_SIZE * AGENT_CIRCLE_SIZE_OTHER_WORLDS / EMOJI_CIRCLE_SIZE)
      : WORLD_ICON_SIZE;
    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={1}
        onPress={() => {
          resetInactivityTimer({ orbIndex: index });
          scrollToOrb(index);
        }}
        style={styles.wheelItemTouch}
      >
        <Animated.View
          style={[
            styles.wheelItemWrap,
            {
              height: H,
              opacity,
              transform: [{ scale }, { translateY: Animated.add(orbTranslateY, neighborDownShift) }],
            },
          ]}
        >
          <Animated.View style={{ flex: 1, opacity: neighborFadeOpacity }}>
            <Animated.View
              style={[
                styles.orb,
                styles.wheelOrb,
                debugOutline,
                {
                  width: orbSize,
                  height: orbSize,
                  borderRadius: 999,
                },
              ]}
            >
            <View style={styles.wheelOrbInner}>
              <Animated.View style={{ marginTop: Animated.add(emojiMarginTop, centerContentLift) }}>
                <View
                  ref={index === 0 ? wheelOrbRef : undefined}
                  style={[
                    styles.wheelOrbEmojiCircle,
                    {
                      width: agentCircleSize,
                      height: agentCircleSize,
                      borderRadius: agentCircleSize / 2,
                      borderWidth: EMOJI_CIRCLE_BORDER_WIDTH,
                      borderColor: EMOJI_CIRCLE_BORDER_COLOR,
                      backgroundColor: emojiCircleBg,
                    },
                  ]}
                >
                  {index === 0 ? (
                    currentWorldId === 'personal' ? (
                      <AgentEyes />
                    ) : currentWorldId === 'business' ? (
                      <BusinessIconSvg size={agentIconSize} color={currentWorldColor} />
                    ) : currentWorldId === 'health' ? (
                      <HealthIconSvg size={agentIconSize} color={currentWorldColor} />
                    ) : currentWorldId === 'finance' ? (
                      <FinanceIconSvg size={agentIconSize} color={currentWorldColor} />
                    ) : null
                  ) : (
                    <Text style={styles.wheelOrbEmoji}>{item.emoji}</Text>
                  )}
                </View>
              </Animated.View>
              <Animated.View
                style={[styles.wheelOrbTextBlock, { opacity: textOpacity, marginTop: Animated.add(textBlockMarginTop, centerContentLift) }]}
                pointerEvents="none"
              >
                {index === 0 ? (
                  <FadeBroadcastBlock
                    messages={BROADCAST_BY_WORLD[currentWorldId] ?? []}
                    visible={orbIndex === 0 && index === 0}
                    titleColor={theme === 'dark' ? '#ffffff' : colors.text}
                    subtitleColor={colors.textSecondary}
                    fixedTitle={currentWorldId === 'personal' ? personalGreeting : (WORLDS[worldIndex]?.label ?? '')}
                    onBroadcastLoopComplete={() => setWorldIndex((wi) => (wi + 1) % WORLDS.length)}
                  />
                ) : (
                  <FadeBroadcastBlock
                    messages={broadcastMessagesForOrbItem(item, flowUnits)}
                    visible={orbIndex === index}
                    titleColor={colors.text}
                    subtitleColor={colors.textSecondary}
                    fixedTitle={item.title}
                  />
                )}
              </Animated.View>
            </View>
          </Animated.View>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    );
  }, [
    scrollY,
    wheelOrbSize,
    centerOrbSize,
    scrollToOrb,
    colors,
    theme,
    peripheralOrbsOpacity,
    orbIndex,
    currentOrbData,
    agentCircleColor,
    currentWorldId,
    currentWorldColor,
    wheelOrbRef,
    flowUnits,
    resetInactivityTimer,
    scrollToOrb,
    setWorldIndex,
  ]);

  const wheelContentHeight = paddingVertical * 2 + currentOrbData.length * WHEEL_ITEM_HEIGHT;

  /** החלפת עולם – גלילה חזרה לכדור הראשון */
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
    setOrbIndex(0);
  }, [worldIndex]);

  /** לופ אינסופי: מראשי שמאלה → כלכלה, מכלכלה ימינה → ראשי */
  const cycleWorldPrev = (prev: number) => (prev - 1 + WORLDS.length) % WORLDS.length;
  const cycleWorldNext = (prev: number) => (prev + 1) % WORLDS.length;

  /** במחשב: חצים ימינה/שמאלה בכדור הראשון – החלפת עולם (לופ) */
  useEffect(() => {
    if (Platform.OS !== 'web' || orbIndex !== 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setWorldIndex(cycleWorldPrev);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setWorldIndex(cycleWorldNext);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orbIndex]);

  /** סוויפ אופקי (רק בכדור הראשון) – החלפת עולם בלופ אינסופי */
  const worldSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) setWorldIndex(cycleWorldNext);
        else if (g.dx < -40) setWorldIndex(cycleWorldPrev);
      },
    })
  ).current;

  /** גרדיאנט: [מלא, …, שקוף] – שני הברים מלא בקצה המכשיר, שקוף לכיוון התוכן. */
  const gradientColorsBase = GRADIENT_STOPS.map((_, i) =>
    hexToRgba(colors.background, ALPHAS[i])
  ) as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
  const gradientColorsFromOpaque = [...gradientColorsBase].reverse() as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
  const gradientLocations = GRADIENT_STOPS as unknown as readonly [number, number, ...number[]];

  const ovalBottomLight = theme === 'light' ? '#e8e8e8' : '#181818';
  const ovalMidLight = theme === 'light' ? '#f0f0f0' : '#181818';
  /** כפתור כדור – גודל אחיד, צבע כמו תיבת האינפוט */
  const ORB_BUTTON_WIDTH = 168;
  const ORB_BUTTON_HEIGHT = 74;
  const orbButtonFill = agentCircleColor;

  /** מעל קלף צ׳אט (כולל פרופיל): אייקונים בהירים כמו מעל ה־scrim; בבית בהיר → כהים */
  const chatOverlayStatusBarStyle = !showChatSheet
    ? theme === 'dark'
      ? 'light'
      : 'dark'
    : 'light';

  /** בדף הבית על כדור הסוכן בלבד – ללא שורת מצב */
  const hideStatusBarForAgentOrbHome =
    Platform.OS !== 'web' &&
    viewMode === 'orb' &&
    orbIndex === 0 &&
    !showChatSheet &&
    !showCredits &&
    !showAttachSheet &&
    !showAgentCard;

  /** כדור יחידה בבית: אחרי idle בלי תזוזה – שורת מצב נעלמת; תזוזה מחזירה (לא חל על סוכן) */
  const hideStatusBarForUnitOrbIdle =
    Platform.OS !== 'web' &&
    viewMode === 'orb' &&
    orbIndex > 0 &&
    !unitOrbSystemBarVisible &&
    !showChatSheet &&
    !showCredits &&
    !showAttachSheet &&
    !showAgentCard;

  const systemStatusBarHidden = hideStatusBarForAgentOrbHome || hideStatusBarForUnitOrbIdle;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar hidden={systemStatusBarHidden} animated showHideTransition="fade" />
      <ExpoStatusBar style={chatOverlayStatusBarStyle} />
      <View
        style={[
          styles.contentWrap,
          !isNarrow && { width: contentWidth, alignSelf: 'center' },
          showSplashOverlay && { zIndex: 3 },
        ]}
      >
      {/* רקע: Orb View = Background-Ovarly (עיגול), Card View = Background-Card-Ovarly (קלף) */}
      <View style={[styles.ovalLayer, { opacity: theme === 'light' ? 0.7 : 0.8 }]} pointerEvents="none">
        <Svg
          viewBox="0 0 375 375"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={styles.ovalSvg}
        >
          <Defs>
            <SvgLinearGradient
              id="ovalGradient"
              x1="187.5"
              y1="27"
              x2="187.5"
              y2="348"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0.45" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="0.75" stopColor={ovalMidLight} stopOpacity="0.4" />
              <Stop offset="1" stopColor={ovalBottomLight} stopOpacity="0.85" />
            </SvgLinearGradient>
            <SvgLinearGradient
              id="cardOvalGradient"
              x1="187.25"
              y1="348"
              x2="187.75"
              y2="27"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="0.75" stopColor={ovalMidLight} stopOpacity="0.4" />
              <Stop offset="1" stopColor={ovalBottomLight} stopOpacity="0.85" />
            </SvgLinearGradient>
          </Defs>
          {viewMode === 'card' ? (
            <Path d="M27 53C27 38.6406 38.6406 27 53 27H322C336.359 27 348 38.6406 348 53V348H27V53Z" fill="url(#cardOvalGradient)" />
          ) : (
            <Circle cx="187.5" cy="187.5" r="160.5" fill="url(#ovalGradient)" />
          )}
        </Svg>
      </View>

      {/* Orb View: גלילה בסגנון גלגל פיקר */}
      {viewMode === 'orb' && (
        <View
          style={styles.orbPagerWrap}
          onTouchStart={() => resetInactivityTimer()}
          {...(orbIndex === 0 ? worldSwipeResponder.panHandlers : null)}
          onTouchEnd={(e) => handleHomeDoubleTap(e.nativeEvent.locationY)}
          {...(Platform.OS === 'web' && {
            onWheelCapture: handleWheel,
          } as Record<string, typeof handleWheel>)}
        >
          <ScrollView
            ref={scrollRef}
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{
              paddingTop: paddingVertical,
              paddingBottom: paddingVertical,
              minHeight: wheelContentHeight,
            }}
            onTouchStart={() => resetInactivityTimer()}
            showsVerticalScrollIndicator={false}
            snapToOffsets={wheelSnapOffsets}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              lastScrollYRef.current = y;
              scrollY.setValue(y);
              resetInactivityTimer();
            }}
            onMomentumScrollEnd={onOrbScrollEnd}
            onScrollEndDrag={onOrbScrollEnd}
            scrollEventThrottle={16}
          >
            {currentOrbData.map((item, i) => renderWheelItem(item, i))}
          </ScrollView>
        </View>
      )}

      {/* Card View: קלף תהליך – פרוגרס, צעדים, צפי vs מציאות */}
      {viewMode === 'card' && cardContext && (() => {
        const cardWorldData = ORB_DATA_BY_WORLD[cardContext.worldId] ?? ORB_DATA_BY_WORLD.personal;
        const cardOrbItem = cardWorldData.find((o) => o.id === cardContext.orbId);
        const stepsData = getProcessStepsData(cardContext.worldId, cardContext.orbId);
        const worldColor = WORLDS.find((w) => w.id === cardContext.worldId)?.color ?? currentWorldColor;
        const progress = stepsData ? getProgress(stepsData.steps) : { completed: 0, total: 0, percent: 0 };
        const r = stepsData?.reality;
        return (
          <View style={styles.cardViewWrap} pointerEvents="box-none">
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={[styles.cardScrollContent, { paddingTop: insets.top + 24, paddingBottom: 24 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.cardTitleRow, { borderBottomColor: hexToRgba(worldColor, 0.3) }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{cardOrbItem?.title ?? cardContext.orbId}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{cardOrbItem?.subtitle}</Text>
              </View>
              {stepsData && (
                <>
                  <View style={styles.cardProgressWrap}>
                    <View style={[styles.cardProgressBarBg, { backgroundColor: hexToRgba(worldColor, 0.2) }]}>
                      <View style={[styles.cardProgressBarFill, { width: `${progress.percent}%`, backgroundColor: worldColor }]} />
                    </View>
                    <Text style={[styles.cardProgressText, { color: colors.textSecondary }]}>
                      {progress.completed} / {progress.total} צעדים · {progress.percent}%
                    </Text>
                  </View>
                  <Text style={[styles.cardSectionLabel, { color: colors.textSecondary }]}>צעדים</Text>
                  {stepsData.steps.sort((a, b) => a.order - b.order).map((s) => (
                    <View key={s.id} style={[styles.cardStepRow, { backgroundColor: colors.surface }]}>
                      <View style={[styles.cardStepBullet, { backgroundColor: s.completed ? worldColor : hexToRgba(colors.textSecondary, 0.3) }]} />
                      <Text style={[styles.cardStepTitle, { color: colors.text }]}>{s.title}</Text>
                    </View>
                  ))}
                </>
              )}
              {r && (r.estimatedCostNis != null || r.estimatedTimeDays != null || r.estimatedTimeMinutes != null) && (
                <>
                  <Text style={[styles.cardSectionLabel, { color: colors.textSecondary }]}>צפי vs מציאות</Text>
                  <View style={[styles.cardRealityBlock, { backgroundColor: colors.surface }]}>
                    {r.estimatedCostNis != null && (
                      <Text style={[styles.cardRealityLine, { color: colors.text }]}>עלות משוערת: {r.estimatedCostNis} ₪</Text>
                    )}
                    {r.estimatedTimeDays != null && (
                      <Text style={[styles.cardRealityLine, { color: colors.text }]}>זמן משוער: {r.estimatedTimeDays} ימים</Text>
                    )}
                    {r.estimatedTimeMinutes != null && (
                      <Text style={[styles.cardRealityLine, { color: colors.text }]}>משך: ~{r.estimatedTimeMinutes} דק׳</Text>
                    )}
                    {r.resources && r.resources.length > 0 && (
                      <Text style={[styles.cardRealityLine, { color: colors.textSecondary }]}>נדרש: {r.resources.join(', ')}</Text>
                    )}
                    {(r.targetCostNis != null || r.targetTimeDays != null) && (
                      <Text style={[styles.cardRealityTarget, { color: worldColor }]}>
                        יעד שלך: {r.targetCostNis != null && `${r.targetCostNis} ₪ `}{r.targetTimeDays != null && `${r.targetTimeDays} ימים`}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        );
      })()}


      {/* Card View: תיבת אינפוט למטה + כפתור חזרה */}
      {viewMode === 'card' && (
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
          <View style={[styles.nowInputWrap, styles.bottomInputWrap]}>
            <NowInputBarRow
              isRtl={isRtlLayout}
              style={[
                styles.nowInputRow,
                { backgroundColor: colors.surface },
                isInputFocused ? styles.nowInputRowExpanded : styles.nowInputRowCollapsed,
              ]}
              plus={
                <TouchableOpacity
                  style={[styles.plusInInputCircle, { backgroundColor: colors.background }]}
                  activeOpacity={0.8}
                  onPress={openAttachSheet}
                >
                  <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
                    <Path d="M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z" fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} />
                  </Svg>
                </TouchableOpacity>
              }
              field={
                <View style={styles.nowInputFieldSlot}>
                  <TextInput
                    style={[
                      styles.nowInputField,
                      { color: colors.text, textAlign: nowInputTextAlign, writingDirection: nowInputWritingDirection },
                      Platform.OS === 'web'
                        ? ({ outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' } as any)
                        : null,
                    ]}
                    placeholder={nowPlaceholderPhrase}
                    placeholderTextColor={hexToRgba(colors.textSecondary, 0.5)}
                    value={nowValue}
                    onChangeText={setNowValue}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
              }
              trailing={
                <TouchableOpacity style={styles.micButton} activeOpacity={0.7} hitSlop={6}>
                  <Svg width={20} height={20} viewBox="0 0 26 26" fill="none">
                    <Path d="M13.1181 17.4274C14.1924 17.4274 15.2227 16.9709 15.9824 16.1582C16.7421 15.3455 17.1688 14.2433 17.1688 13.0941V6.59408C17.1688 5.4448 16.7421 4.3426 15.9824 3.52995C15.2227 2.71729 14.1924 2.26074 13.1181 2.26074C12.0438 2.26074 11.0135 2.71729 10.2538 3.52995C9.49415 4.3426 9.06738 5.4448 9.06738 6.59408V13.0941C9.06738 14.2433 9.49415 15.3455 10.2538 16.1582C11.0135 16.9709 12.0438 17.4274 13.1181 17.4274Z" fill={colors.textSecondary} />
                    <Path d="M19.3254 13.1882C19.0541 13.1882 18.794 13.2875 18.6022 13.4641C18.4103 13.6408 18.3026 13.8804 18.3026 14.1303C18.3026 15.3795 17.7638 16.5775 16.8048 17.4608C15.8457 18.3442 14.545 18.8404 13.1887 18.8404C11.8324 18.8404 10.5317 18.3442 9.57266 17.4608C8.61363 16.5775 8.07485 15.3795 8.07485 14.1303C8.07485 13.8804 7.96709 13.6408 7.77528 13.4641C7.58347 13.2875 7.32333 13.1882 7.05207 13.1882C6.78081 13.1882 6.52067 13.2875 6.32886 13.4641C6.13705 13.6408 6.0293 13.8804 6.0293 14.1303C6.0293 15.8792 6.78359 17.5564 8.12624 18.7931C9.46889 20.0297 11.2899 20.7245 13.1887 20.7245C15.0875 20.7245 16.9085 20.0297 18.2512 18.7931C19.5938 17.5564 20.3481 15.8792 20.3481 14.1303C20.3481 13.8804 20.2404 13.6408 20.0486 13.4641C19.8568 13.2875 19.5966 13.1882 19.3254 13.1882Z" fill={colors.textSecondary} />
                    <Path d="M16.1562 21.7607H10.0801C9.81148 21.7607 9.5539 21.8749 9.36399 22.078C9.17408 22.2812 9.06738 22.5568 9.06738 22.8441C9.06738 23.1314 9.17408 23.4069 9.36399 23.6101C9.5539 23.8133 9.81148 23.9274 10.0801 23.9274H16.1562C16.4247 23.9274 16.6823 23.8133 16.8722 23.6101C17.0621 23.4069 17.1688 23.1314 17.1688 22.8441C17.1688 22.5568 17.0621 22.2812 16.8722 22.078C16.6823 21.8749 16.4247 21.7607 16.1562 21.7607Z" fill={colors.textSecondary} />
                  </Svg>
                </TouchableOpacity>
              }
            />
          </View>
          <TouchableOpacity
            style={[styles.exitButton, { opacity: 0.85 }]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => { setViewMode('orb'); setCardContext(null); }}
          >
            <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
              <Path d="M22.954 26.8302L17.2612 32.523C16.8275 32.9567 16.307 33.1735 15.6996 33.1735C15.0925 33.1737 14.572 32.9569 14.1381 32.523C13.7042 32.0891 13.4874 31.5686 13.4876 30.9615C13.4876 30.3542 13.7044 29.8336 14.1381 29.4L19.8309 23.7072L14.1381 18.0144C13.7044 17.5807 13.4876 17.0602 13.4876 16.4528C13.4874 15.8457 13.7042 15.3252 14.1381 14.8913C14.572 14.4574 15.0925 14.2406 15.6996 14.2408C16.307 14.2408 16.8275 14.4576 17.2612 14.8913L22.954 20.5841L28.6468 14.8913C29.0805 14.4576 29.601 14.2408 30.2083 14.2408C30.8154 14.2406 31.3359 14.4574 31.7698 14.8913C32.2037 15.3252 32.4206 15.8457 32.4204 16.4528C32.4204 17.0602 32.2035 17.5807 31.7698 18.0144L26.077 23.7072L31.7698 29.4C32.2035 29.8336 32.4204 30.3542 32.4204 30.9615C32.4206 31.5686 32.2037 32.0891 31.7698 32.523C31.3359 32.9569 30.8154 33.1737 30.2083 33.1735C29.601 33.1735 29.0805 32.9567 28.6468 32.523L22.954 26.8302Z" fill={colors.text} stroke={colors.text} strokeWidth={1.43} />
            </Svg>
          </TouchableOpacity>
        </View>
      )}

      {/* קרדיטים – מופיעים רק אחרי לחיצה על פלוס; לחיצה פותחת חלון ארנק */}
      {showBottomActions && !showCredits && !showChatSheet && (
        <TouchableOpacity
          style={[styles.creditsTrigger, { top: insets.top + 12 }]}
          activeOpacity={0.8}
          onPress={() => setShowCredits(true)}
        >
          <View style={[styles.creditsCircle, { backgroundColor: creditsCircleBg }]} />
          <Text style={[styles.creditsText, { color: creditsColor }]}>{unitsBalance.toLocaleString()}</Text>
        </TouchableOpacity>
      )}

      {/* חלון ארנק – במחשב: קלף ממורכז; במובייל: מלא מסך */}
      <Modal visible={showCredits} transparent animationType="none" onRequestClose={closeWallet}>
        <View style={[
          styles.walletScreenWrap,
          { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background },
          !isNarrow && styles.walletScreenWrapDesktop,
        ]}>
          <Animated.View style={[
            styles.walletScreenInner,
            { transform: [{ translateY: walletSlideAnim }] },
            !isNarrow && styles.walletScreenInnerDesktop,
          ]}>
            <View style={styles.walletFixedTop}>
              <View style={styles.walletPlanCard}>
                <View style={styles.walletPlanRow}>
                  <View style={styles.walletPlanIconPlaceholder} />
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.walletUpgradeBtn} activeOpacity={0.8}>
                    <Text style={styles.walletUpgradeBtnText}>Upgrade</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.walletBalanceRow}>
                  <View>
                    <Text style={styles.walletBalanceNumber}>{unitsBalance.toLocaleString()}</Text>
                    <Text style={styles.walletBalanceLabel}>UNITS</Text>
                  </View>
                  <Text style={styles.walletPayPalLabel}>תרגום ל-PayPal</Text>
                </View>
              </View>
              <View style={styles.walletActionsRow}>
                <TouchableOpacity style={styles.walletCircleBtn} onPress={() => setUnitsBalance((n) => Math.max(0, n - 101))}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M5 12h14" stroke="#555" strokeWidth={2} strokeLinecap="round" /></Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.walletBuyUnitsBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    const add = 101;
                    setUnitsBalance((n) => n + add);
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    setCreditsHistory((prev) => [{ id: String(Date.now()), label: 'Buy Units', time: timeStr, change: add, icon: 'buy' }, ...prev]);
                  }}
                >
                  <Text style={styles.walletBuyUnitsText}>Buy Units</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.walletCircleBtn} onPress={() => setUnitsBalance((n) => n + 101)}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke="#555" strokeWidth={2} strokeLinecap="round" /></Svg>
                </TouchableOpacity>
              </View>
              <Text style={[styles.walletHistoryTitle, { color: colors.text }]}>History</Text>
            </View>
            <ScrollView style={styles.walletHistoryScroll} contentContainerStyle={styles.walletHistoryScrollContent} showsVerticalScrollIndicator={true}>
              {creditsHistory.map((item) => (
                <View key={item.id} style={[styles.walletHistoryRow, { borderBottomColor: hexToRgba(colors.text, 0.12) }]}>
                  <View style={[styles.walletHistoryIcon, { backgroundColor: hexToRgba(colors.text, 0.08) }]}>
                    {item.icon === 'globe' && <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={colors.textSecondary} strokeWidth={2} /><Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={colors.textSecondary} strokeWidth={2} /></Svg>}
                    {item.icon === 'brand' && <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke={colors.textSecondary} strokeWidth={2} strokeLinejoin="round" /></Svg>}
                    {item.icon === 'gift' && <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
                    {item.icon === 'buy' && <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round"/></Svg>}
                  </View>
                  <View style={styles.walletHistoryTextWrap}>
                    <Text style={[styles.walletHistoryLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.walletHistoryTime, { color: colors.textSecondary }]}>{item.time}</Text>
                  </View>
                  <Text style={[styles.walletHistoryChange, { color: item.change >= 0 ? '#22c55e' : colors.textSecondary }]}>{item.change >= 0 ? '+' : ''}{item.change}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.walletBottomBar, { paddingBottom: insets.bottom }]}>
              <TouchableOpacity style={styles.walletCloseBtn} onPress={closeWallet} hitSlop={12}>
                <Svg width={28} height={28} viewBox="0 0 46 46" fill="none"><Path d="M22.954 26.8302L17.2612 32.523C16.8275 32.9567 16.307 33.1735 15.6996 33.1735C15.0925 33.1737 14.572 32.9569 14.1381 32.523C13.7042 32.0891 13.4874 31.5686 13.4876 30.9615C13.4876 30.3542 13.7044 29.8336 14.1381 29.4L19.8309 23.7072L14.1381 18.0144C13.7044 17.5807 13.4876 17.0602 13.4876 16.4528C13.4874 15.8457 13.7042 15.3252 14.1381 14.8913C14.572 14.4574 15.0925 14.2406 15.6996 14.2408C16.307 14.2408 16.8275 14.4576 17.2612 14.8913L22.954 20.5841L28.6468 14.8913C29.0805 14.4576 29.601 14.2408 30.2083 14.2408C30.8154 14.2406 31.3359 14.4574 31.7698 14.8913C32.2037 15.3252 32.4206 15.8457 32.4204 16.4528C32.4204 17.0602 32.2035 17.5807 31.7698 18.0144L26.077 23.7072L31.7698 29.4C32.2035 29.8336 32.4204 30.3542 32.4204 30.9615C32.4206 31.5686 32.2037 32.0891 31.7698 32.523C31.3359 32.9569 30.8154 33.1737 30.2083 33.1735C29.601 33.1735 29.0805 32.9567 28.6468 32.523L22.954 26.8302Z" fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} /></Svg>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <AttachActionSheet
        visible={showAttachSheet}
        onClose={closeAttachSheet}
        language={language}
        isRtl={isRtlLayout}
        colors={{
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        }}
        bottomInset={insets.bottom}
        hideChatRow={showChatSheet}
        onPick={handleAttachPick}
      />

      {/* Agent / Orbit profile popup – במחשב: קלף ממורכז; במובייל: כמעט מלא */}
      <Modal visible={showAgentCard} transparent animationType="fade" onRequestClose={() => setShowAgentCard(false)}>
        <View style={[
          styles.agentCardOverlay,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
          !isNarrow && styles.agentCardOverlayDesktop,
        ]}>
          <View style={[
            styles.agentCardContainer,
            { backgroundColor: colors.background },
            !isNarrow && styles.agentCardContainerDesktop,
          ]}>
            <View style={[styles.agentCardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.agentCardTitle, { color: colors.text }]}>Orbit Profile</Text>
              <TouchableOpacity onPress={() => setShowAgentCard(false)} hitSlop={12} style={styles.agentCardClose}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6l12 12" stroke={colors.text} strokeWidth={2} strokeLinecap="round" /></Svg>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={agentCardScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / contentWidth);
                setAgentCardWorldIndex(Math.max(0, Math.min(idx, WORLDS.length - 1)));
              }}
              contentContainerStyle={{ paddingHorizontal: 0 }}
              style={styles.agentCardScroll}
            >
              {WORLDS.map((world, idx) => {
                const broadcasts = BROADCAST_BY_WORLD[world.id] ?? [];
                return (
                  <View key={world.id} style={[styles.agentCardPage, { width: contentWidth }]}>
                    <View style={[styles.agentCardWorldCard, { backgroundColor: colors.surface, borderLeftColor: world.color }]}>
                      <View style={[styles.agentCardWorldBadge, { backgroundColor: hexToRgba(world.color, 0.2) }]}>
                        <Text style={[styles.agentCardWorldName, { color: world.color }]}>{world.label}</Text>
                      </View>
                      <Text style={[styles.agentCardWorldSub, { color: colors.textSecondary }]}>World · {world.id}</Text>
                      {broadcasts.length > 0 && (
                        <>
                          <Text style={[styles.agentCardSectionLabel, { color: colors.textSecondary }]}>Updates</Text>
                          {broadcasts.slice(0, 4).map((b, i) => (
                            <View key={i} style={[styles.agentCardBroadcastRow, { borderBottomColor: hexToRgba(colors.text, 0.08) }]}>
                              <Text style={[styles.agentCardBroadcastType, { color: world.color }]}>{b.type}</Text>
                              <Text style={[styles.agentCardBroadcastBody, { color: colors.text }]}>{b.body}</Text>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.agentCardProfileLink, { borderColor: colors.border }]}
                      onPress={() => { setShowAgentCard(false); navigation.navigate('Profile'); }}
                    >
                      <Text style={[styles.agentCardProfileLinkText, { color: colors.primary }]}>View full Origin profile</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <View style={[styles.agentCardDots, { paddingBottom: insets.bottom + 8 }]}>
              {WORLDS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.agentCardDot,
                    { backgroundColor: idx === agentCardWorldIndex ? (WORLDS[idx]?.color ?? colors.primary) : hexToRgba(colors.textSecondary, 0.3) },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <View
        style={[
          styles.topBar,
          { height: topBarHeight },
          !isNarrow && styles.barDesktopInsetTop,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={gradientColorsFromOpaque}
          locations={gradientLocations}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <View
        style={[
          styles.bottomBar,
          { height: bottomBarHeight },
          !isNarrow && styles.barDesktopInsetBottom,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={gradientColorsFromOpaque}
          locations={gradientLocations}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
      </View>


      {/* אחרי לחיצה על ONE: תיבת האינפוט יורדת למיקום ה־action (בלי כפתור Button Example), + X לסגירה */}
      {false && showBottomActions && (
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
          <View style={[styles.nowInputWrap, styles.bottomInputWrap]}>
            <View style={[
              styles.nowInputRow,
              { backgroundColor: colors.surface },
              isInputFocused ? styles.nowInputRowExpanded : styles.nowInputRowCollapsed,
            ]}>
              <TouchableOpacity
                style={[styles.plusInInputCircle, { backgroundColor: colors.background }]}
                activeOpacity={0.8}
                onPress={openAttachSheet}
              >
                <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
                    <Path d="M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z" fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} />
                  </Svg>
                </TouchableOpacity>
                <TextInput
                  style={[styles.nowInputField, { color: colors.text }]}
                  placeholder={nowPlaceholderPhrase}
                  placeholderTextColor={hexToRgba(colors.textSecondary, 0.5)}
                  value={nowValue}
                  onChangeText={setNowValue}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onSubmitEditing={submitNowValue}
                  returnKeyType="done"
                  blurOnSubmit
                />
                <TouchableOpacity style={styles.micButton} activeOpacity={0.7} hitSlop={6} onPress={submitNowValue}>
                  <Svg width={20} height={20} viewBox="0 0 26 26" fill="none">
                  <Path d="M13.1181 17.4274C14.1924 17.4274 15.2227 16.9709 15.9824 16.1582C16.7421 15.3455 17.1688 14.2433 17.1688 13.0941V6.59408C17.1688 5.4448 16.7421 4.3426 15.9824 3.52995C15.2227 2.71729 14.1924 2.26074 13.1181 2.26074C12.0438 2.26074 11.0135 2.71729 10.2538 3.52995C9.49415 4.3426 9.06738 5.4448 9.06738 6.59408V13.0941C9.06738 14.2433 9.49415 15.3455 10.2538 16.1582C11.0135 16.9709 12.0438 17.4274 13.1181 17.4274Z" fill={colors.textSecondary} />
                  <Path d="M19.3254 13.1882C19.0541 13.1882 18.794 13.2875 18.6022 13.4641C18.4103 13.6408 18.3026 13.8804 18.3026 14.1303C18.3026 15.3795 17.7638 16.5775 16.8048 17.4608C15.8457 18.3442 14.545 18.8404 13.1887 18.8404C11.8324 18.8404 10.5317 18.3442 9.57266 17.4608C8.61363 16.5775 8.07485 15.3795 8.07485 14.1303C8.07485 13.8804 7.96709 13.6408 7.77528 13.4641C7.58347 13.2875 7.32333 13.1882 7.05207 13.1882C6.78081 13.1882 6.52067 13.2875 6.32886 13.4641C6.13705 13.6408 6.0293 13.8804 6.0293 14.1303C6.0293 15.8792 6.78359 17.5564 8.12624 18.7931C9.46889 20.0297 11.2899 20.7245 13.1887 20.7245C15.0875 20.7245 16.9085 20.0297 18.2512 18.7931C19.5938 17.5564 20.3481 15.8792 20.3481 14.1303C20.3481 13.8804 20.2404 13.6408 20.0486 13.4641C19.8568 13.2875 19.5966 13.1882 19.3254 13.1882Z" fill={colors.textSecondary} />
                  <Path d="M16.1562 21.7607H10.0801C9.81148 21.7607 9.5539 21.8749 9.36399 22.078C9.17408 22.2812 9.06738 22.5568 9.06738 22.8441C9.06738 23.1314 9.17408 23.4069 9.36399 23.6101C9.5539 23.8133 9.81148 23.9274 10.0801 23.9274H16.1562C16.4247 23.9274 16.6823 23.8133 16.8722 23.6101C17.0621 23.4069 17.1688 23.1314 17.1688 22.8441C17.1688 22.5568 17.0621 22.2812 16.8722 22.078C16.6823 21.8749 16.4247 21.7607 16.1562 21.7607Z" fill={colors.textSecondary} />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.exitButton, { opacity: 0.55 }]}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => { setShowBottomActions(false); setShowCredits(false); }}
          >
            <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
              <Path
                d="M22.954 26.8302L17.2612 32.523C16.8275 32.9567 16.307 33.1735 15.6996 33.1735C15.0925 33.1737 14.572 32.9569 14.1381 32.523C13.7042 32.0891 13.4874 31.5686 13.4876 30.9615C13.4876 30.3542 13.7044 29.8336 14.1381 29.4L19.8309 23.7072L14.1381 18.0144C13.7044 17.5807 13.4876 17.0602 13.4876 16.4528C13.4874 15.8457 13.7042 15.3252 14.1381 14.8913C14.572 14.4574 15.0925 14.2406 15.6996 14.2408C16.307 14.2408 16.8275 14.4576 17.2612 14.8913L22.954 20.5841L28.6468 14.8913C29.0805 14.4576 29.601 14.2408 30.2083 14.2408C30.8154 14.2406 31.3359 14.4574 31.7698 14.8913C32.2037 15.3252 32.4206 15.8457 32.4204 16.4528C32.4204 17.0602 32.2035 17.5807 31.7698 18.0144L26.077 23.7072L31.7698 29.4C32.2035 29.8336 32.4204 30.3542 32.4204 30.9615C32.4206 31.5686 32.2037 32.0891 31.7698 32.523C31.3359 32.9569 30.8154 33.1737 30.2083 33.1735C29.601 33.1735 29.0805 32.9567 28.6468 32.523L22.954 26.8302Z"
                fill={colors.text}
                stroke={colors.text}
                strokeWidth={1.43}
              />
            </Svg>
          </TouchableOpacity>
        </View>
      )}

      {/* ספלאש: כדור גדל מהמרכז, מרחף למעלה, פרצוף מופיע – המשכיות לראש הסוכן במסך */}
      {showSplashOverlay && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.background, opacity: splashOverlayOpacity },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.splashOrbSlot}>
            <Animated.View
              style={[
                styles.splashOrbWrap,
                {
                  transform: [
                    { scale: splashScale },
                    { translateX: splashTranslateX },
                    { translateY: splashTranslateY },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.splashOrbCircle,
                  {
                    width: EMOJI_CIRCLE_SIZE,
                    height: EMOJI_CIRCLE_SIZE,
                    borderRadius: EMOJI_CIRCLE_SIZE / 2,
                    backgroundColor: agentCircleColor,
                  },
                ]}
              />
              <Animated.View style={[styles.splashFaceWrap, { opacity: splashFaceOpacity }]} pointerEvents="none">
                <AgentEyes />
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      )}
      </View>
      {/* שכבת צ׳אט: בית+ONE בשכבה קבועה במרכז; שדה צ׳אט נפרד למטה כשהקלף פתוח */}
      {viewMode === 'orb' && !showBottomActions && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: showSplashOverlay ? 0 : showChatSheet ? 44 : 10 },
          ]}
          pointerEvents="box-none"
        >
          <View
            pointerEvents={showChatSheet ? 'none' : 'box-none'}
            style={[StyleSheet.absoluteFillObject, styles.fixedCenterWrap, { zIndex: 2 }]}
          >
            <View
              style={[styles.fixedCenterInner, Platform.OS !== 'web' && styles.fixedCenterInnerMobile]}
              onTouchStart={() => resetInactivityTimer()}
            >
              <View style={styles.nowInputWrap}>
                <NowInputBarRow
                  isRtl={isRtlLayout}
                  style={[styles.nowInputRow, styles.nowInputRowCollapsed, { backgroundColor: colors.surface }]}
                  plus={
                    <TouchableOpacity
                      style={[styles.plusInInputCircle, { backgroundColor: colors.background }]}
                      activeOpacity={0.8}
                      onPress={openAttachSheet}
                    >
                      <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
                        <Path d="M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z" fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} />
                      </Svg>
                    </TouchableOpacity>
                  }
                  field={
                    <View style={styles.nowInputFieldSlot}>
                      <TextInput
                        ref={homeNowInputRef}
                        editable={!showChatSheet}
                        style={[
                          styles.nowInputField,
                          { color: colors.text, textAlign: nowInputTextAlign, writingDirection: nowInputWritingDirection },
                          Platform.OS === 'web'
                            ? ({ outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' } as any)
                            : null,
                        ]}
                        placeholder=""
                        placeholderTextColor={hexToRgba(colors.textSecondary, 0.5)}
                        value={nowValue}
                        onChangeText={setNowValue}
                        showSoftInputOnFocus={!showChatSheet}
                        onFocus={(e: any) => {
                          if (showChatSheet) return;
                          shouldRefocusComposerAfterChatOpenRef.current = true;
                          openChatSheet();
                          if (Platform.OS === 'web') {
                            const t = e?.target;
                            if (t?.style) {
                              t.style.outline = 'none';
                              t.style.boxShadow = 'none';
                              t.style.border = '0';
                            }
                          }
                        }}
                        onSubmitEditing={submitNowValue}
                        returnKeyType="done"
                        blurOnSubmit
                      />
                      {!nowInputHasText && (
                        <View style={styles.nowPlaceholderOverlay} pointerEvents="none">
                          <Animated.Text
                            style={[
                              styles.nowPlaceholderText,
                              {
                                color: hexToRgba(colors.textSecondary, 0.72),
                                opacity: nowQuestionPulse,
                                writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                textAlign: isRtlLayout ? 'right' : 'left',
                                width: '100%',
                              },
                            ]}
                          >
                            {nowPlaceholderPhrase}
                          </Animated.Text>
                        </View>
                      )}
                    </View>
                  }
                  trailing={
                    <TouchableOpacity style={styles.micButton} activeOpacity={0.7} hitSlop={6}>
                      <Svg width={20} height={20} viewBox="0 0 26 26" fill="none">
                        <Path d="M13.1181 17.4274C14.1924 17.4274 15.2227 16.9709 15.9824 16.1582C16.7421 15.3455 17.1688 14.2433 17.1688 13.0941V6.59408C17.1688 5.4448 16.7421 4.3426 15.9824 3.52995C15.2227 2.71729 14.1924 2.26074 13.1181 2.26074C12.0438 2.26074 11.0135 2.71729 10.2538 3.52995C9.49415 4.3426 9.06738 5.4448 9.06738 6.59408V13.0941C9.06738 14.2433 9.49415 15.3455 10.2538 16.1582C11.0135 16.9709 12.0438 17.4274 13.1181 17.4274Z" fill={colors.textSecondary} />
                        <Path d="M19.3254 13.1882C19.0541 13.1882 18.794 13.2875 18.6022 13.4641C18.4103 13.6408 18.3026 13.8804 18.3026 14.1303C18.3026 15.3795 17.7638 16.5775 16.8048 17.4608C15.8457 18.3442 14.545 18.8404 13.1887 18.8404C11.8324 18.8404 10.5317 18.3442 9.57266 17.4608C8.61363 16.5775 8.07485 15.3795 8.07485 14.1303C8.07485 13.8804 7.96709 13.6408 7.77528 13.4641C7.58347 13.2875 7.32333 13.1882 7.05207 13.1882C6.78081 13.1882 6.52067 13.2875 6.32886 13.4641C6.13705 13.6408 6.0293 13.8804 6.0293 14.1303C6.0293 15.8792 6.78359 17.5564 8.12624 18.7931C9.46889 20.0297 11.2899 20.7245 13.1887 20.7245C15.0875 20.7245 16.9085 20.0297 18.2512 18.7931C19.5938 17.5564 20.3481 15.8792 20.3481 14.1303C20.3481 13.8804 20.2404 13.6408 20.0486 13.4641C19.8568 13.2875 19.5966 13.1882 19.3254 13.1882Z" fill={colors.textSecondary} />
                        <Path d="M16.1562 21.7607H10.0801C9.81148 21.7607 9.5539 21.8749 9.36399 22.078C9.17408 22.2812 9.06738 22.5568 9.06738 22.8441C9.06738 23.1314 9.17408 23.4069 9.36399 23.6101C9.5539 23.8133 9.81148 23.9274 10.0801 23.9274H16.1562C16.4247 23.9274 16.6823 23.8133 16.8722 23.6101C17.0621 23.4069 17.1688 23.1314 17.1688 22.8441C17.1688 22.5568 17.0621 22.2812 16.8722 22.078C16.6823 21.8749 16.4247 21.7607 16.1562 21.7607Z" fill={colors.textSecondary} />
                      </Svg>
                    </TouchableOpacity>
                  }
                />
              </View>
              <View style={styles.orbButtonWrap}>
                <TouchableOpacity
                  style={[styles.orbButton, { width: ORB_BUTTON_WIDTH, height: ORB_BUTTON_HEIGHT, marginTop: -5 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    resetInactivityTimer();
                    if (orbIndex === 0) {
                      setAgentCardWorldIndex(worldIndex);
                      setShowAgentCard(true);
                    } else {
                      openChatSheet();
                      setChatOpenedFromOrbProfileShortcut(true);
                      requestAnimationFrame(() => {
                        openChatProfile();
                      });
                    }
                  }}
                >
                  <Svg width={ORB_BUTTON_WIDTH} height={ORB_BUTTON_HEIGHT} viewBox="0 0 180 72" fill="none" preserveAspectRatio="xMidYMid meet">
                    <Defs>
                      <ClipPath id="oneBtnClip">
                        <Rect width={180} height={72} fill="white" />
                      </ClipPath>
                      <Mask id="oneBtnMask" maskUnits="userSpaceOnUse" x={6} y={16} width={168} height={63}>
                        <Rect x={6} y={16} width={168} height={63} rx={31.5} fill="white" />
                      </Mask>
                    </Defs>
                    <G clipPath="url(#oneBtnClip)">
                      <G mask="url(#oneBtnMask)">
                        <Circle cx={90.4995} cy={-91.315} r={150.5} fill={orbButtonFill} />
                      </G>
                    </G>
                  </Svg>
                  <Animated.View style={[styles.orbButtonDotsRow, { opacity: orbButtonLabelOpacity }]} pointerEvents="none">
                    {[cycleWorldPrev(worldIndex), worldIndex, cycleWorldNext(worldIndex)].map((idx, i) => {
                      const isCenter = i === 1;
                      const dotColor = isCenter
                        ? (WORLDS[idx]?.color ?? currentWorldColor)
                        : hexToRgba(colors.textSecondary, 0.35);
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.orbButtonDot,
                            isCenter && styles.orbButtonDotActive,
                            { backgroundColor: dotColor },
                          ]}
                        />
                      );
                    })}
                  </Animated.View>
                  <Animated.View style={[styles.orbButtonEnterIconWrap, { opacity: orbButtonEnterOpacity }]} pointerEvents="none">
                    <EnterIconSvg size={ORB_BUTTON_ENTER_ICON_SIZE} color="#ffffff" />
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {showChatSheet && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#000000', opacity: chatBackdropOpacity, zIndex: 3 },
              ]}
            />
          )}
          <Animated.View
            pointerEvents={showChatSheet ? 'auto' : 'box-none'}
            style={[
              showChatSheet
                ? {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: insets.top + 6,
                    bottom: 0,
                    flexDirection: 'column',
                    zIndex: 6,
                  }
                : styles.fixedCenterWrap,
            ]}
          >
            <View
              pointerEvents={showChatSheet ? 'auto' : 'box-none'}
              style={
                showChatSheet
                  ? { flex: 1, flexDirection: 'column', minHeight: 0, width: '100%', alignItems: isNarrow ? 'stretch' : 'center' }
                  : [styles.fixedCenterInner, Platform.OS !== 'web' && styles.fixedCenterInnerMobile]
              }
            >
              {showChatSheet && (
                <Animated.View
                  {...chatSheetEdgePan.panHandlers}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: isNarrow ? '100%' : Math.min(contentWidth, 460),
                    alignSelf: isNarrow ? 'stretch' : 'center',
                    transform: [{ translateY: chatSheetTranslateY }, { translateX: chatSheetTranslateX }],
                    zIndex: 5,
                  }}
                >
                <View
                  style={[
                    styles.chatModalSheet,
                    {
                      flex: 1,
                      width: '100%',
                      minHeight: 0,
                      backgroundColor: chatSheetBg,
                      borderTopLeftRadius: isNarrow ? 22 : 20,
                      borderTopRightRadius: isNarrow ? 22 : 20,
                      overflow: 'hidden',
                      paddingTop: isNarrow ? 8 : 6,
                      /** בנייטיב ה־direction לא תמיד יורש מהשורש — מפעילים מפה כדי שיוגה + טקסט יתנהגו כמו בווב */
                      direction: isRtlLayout ? 'rtl' : 'ltr',
                    },
                  ]}
                >
                  {showChatProfile ? (
                    <View style={[styles.chatSheetTopBar, { borderBottomColor: colors.border }]}>
                      <TouchableOpacity
                        style={styles.chatModalIconBtn}
                        onPress={collapseProfileToChat}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chatModalBackIcon, { color: colors.textSecondary }]}>{chatBackGlyph}</Text>
                      </TouchableOpacity>
                      {chatProfileHeaderCompact ? (
                        <TouchableOpacity
                          style={styles.chatProfileToolbarCompactCenter}
                          activeOpacity={0.85}
                          onPress={() => {
                            chatScrollRef.current?.scrollTo({ y: 0, animated: true });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={language === 'he' ? 'גלול לראש הפרופיל' : 'Scroll profile to top'}
                        >
                          <View
                            style={[
                              styles.chatModalAvatar,
                              { backgroundColor: activeUnit ? colors.surface : chatAgentAvatarBg },
                            ]}
                          >
                            {activeUnit ? (
                              <Text style={styles.chatModalUnitEmoji}>{activeUnit.emoji}</Text>
                            ) : (
                              <AgentEyes compact />
                            )}
                          </View>
                          <View style={styles.chatProfileToolbarCompactText}>
                            <Text
                              style={[
                                styles.chatProfileToolbarTitle,
                                {
                                  color: colors.text,
                                  textAlign: isRtlLayout ? 'right' : 'left',
                                  writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {activeUnit
                                ? embedLatinRunsForRtlDisplay(activeUnit.title, language)
                                : translate(language, 'chat_title_default')}
                            </Text>
                            {activeUnit ? (
                              <Text
                                style={[
                                  styles.chatProfileToolbarSubtitle,
                                  {
                                    color: colors.textSecondary,
                                    textAlign: isRtlLayout ? 'right' : 'left',
                                    writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {formatChatUnitProgressLine(language, activeUnit.progress, activeUnit.steps)}
                              </Text>
                            ) : (
                              <View style={styles.chatAgentWorldRow}>
                                <Text style={[styles.chatProfileToolbarSubtitle, { color: colors.textSecondary }]}>
                                  {chatAgentStatusLabel}
                                </Text>
                                <Text style={[styles.chatProfileToolbarSubtitle, { color: colors.textSecondary }]}> · </Text>
                                <WorldMiniIcon worldId={currentWorldId} color={currentWorldColor} size={14} />
                                <Text style={[styles.chatProfileToolbarSubtitle, { color: currentWorldColor }]}>
                                  {activeWorldChatLabel}
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.chatProfileToolbarSpacer} />
                      )}
                      <TouchableOpacity
                        style={styles.chatSheetHeaderShareBtn}
                        hitSlop={8}
                        activeOpacity={0.7}
                        onPress={shareChatUnitProfile}
                      >
                        <Text style={[styles.chatSheetHeaderShareGlyph, { color: colors.textSecondary }]}>{chatShareGlyph}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.chatModalMenuBtn}
                        hitSlop={8}
                        activeOpacity={0.7}
                        onPress={() => setShowChatMenu((v) => !v)}
                      >
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.chatSheetTopBar, { borderBottomColor: colors.border }]}>
                      <TouchableOpacity
                        style={styles.chatModalIconBtn}
                        onPress={() => {
                          closeChatSheet();
                        }}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chatModalBackIcon, { color: colors.textSecondary }]}>{chatBackGlyph}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.chatHeaderProfileBtn} activeOpacity={0.75} onPress={openChatProfile}>
                        <View
                          style={[
                            styles.chatModalAvatar,
                            { backgroundColor: activeUnit ? colors.surface : chatAgentAvatarBg },
                          ]}
                        >
                          {activeUnit ? (
                            <Text style={styles.chatModalUnitEmoji}>{activeUnit.emoji}</Text>
                          ) : (
                            <AgentEyes compact />
                          )}
                        </View>
                        <View style={styles.chatModalHeaderText}>
                          <Text
                            style={[
                              styles.chatModalTitle,
                              {
                                color: colors.text,
                                textAlign: isRtlLayout ? 'right' : 'left',
                                writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                alignSelf: 'stretch',
                                width: '100%',
                              },
                            ]}
                          >
                            {activeUnit
                              ? embedLatinRunsForRtlDisplay(activeUnit.title, language)
                              : translate(language, 'chat_title_default')}
                          </Text>
                          {activeUnit ? (
                            <Text
                              style={[
                                styles.chatModalSubtitle,
                                {
                                  color: colors.textSecondary,
                                  textAlign: isRtlLayout ? 'right' : 'left',
                                  writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                  alignSelf: 'stretch',
                                  width: '100%',
                                },
                              ]}
                            >
                              {formatChatUnitProgressLine(language, activeUnit.progress, activeUnit.steps)}
                            </Text>
                          ) : (
                            <View style={styles.chatAgentWorldRow}>
                              <Text style={[styles.chatModalSubtitle, { color: colors.textSecondary }]}>{chatAgentStatusLabel}</Text>
                              <Text style={[styles.chatModalSubtitle, { color: colors.textSecondary }]}> · </Text>
                              <WorldMiniIcon worldId={currentWorldId} color={currentWorldColor} size={14} />
                              <Text style={[styles.chatModalSubtitle, { color: currentWorldColor }]}>{activeWorldChatLabel}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.chatModalMenuBtn}
                        hitSlop={8}
                        activeOpacity={0.7}
                        onPress={() => setShowChatMenu((v) => !v)}
                      >
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={[styles.chatModalMenuDot, { backgroundColor: colors.textSecondary }]} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {showChatMenu && (
                    <View style={styles.chatMenuOverlay}>
                      <TouchableOpacity
                        style={[styles.chatMenuScrim, { backgroundColor: hexToRgba('#000000', theme === 'dark' ? 0.35 : 0.2) }]}
                        activeOpacity={1}
                        onPress={() => setShowChatMenu(false)}
                      />
                      <View style={[styles.chatMenuCard, { backgroundColor: colors.surface }]}>
                        {chatMenuRows.map((row) => (
                          <TouchableOpacity
                            key={row.id}
                            style={styles.chatMenuItem}
                            activeOpacity={0.75}
                            onPress={() => {
                              setShowChatMenu(false);
                              if (row.id === 'History' && !activeUnitId) setOneChatUnitHistoryOpen(true);
                              if (row.id === 'Profile') openChatProfile();
                              if (row.id === 'Settings') {
                                closeChatSheet();
                                navigation.navigate('Settings');
                              }
                            }}
                          >
                            <Text style={[styles.chatMenuItemText, { color: colors.text }]}>{row.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.chatModalScroll}
                    contentContainerStyle={[
                      styles.chatModalScrollContent,
                      !activeUnit && !showChatProfile ? styles.chatModalScrollContentOne : null,
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={showChatProfile ? onChatProfileScroll : undefined}
                  >
                    {showChatProfile && (
                      <Animated.View style={{ transform: [{ translateX: profileDismissSlideX }] }}>
                        <UnitChatProfile
                          visible={showChatProfile}
                          unit={activeUnit}
                          agentProfile={agentChatProfileModel}
                          chatAgentStatus={`${chatAgentStatusLabel} · ${activeWorldChatLabel}`}
                          colors={colors}
                          isDark={isDark}
                          profileAccent={profileAccent}
                          profileRingR={profileRingR}
                          profileRingC={profileRingC}
                          unitProgressPct={activeUnit ? unitProgressPct : 0.9}
                          unitStepsDone={unitStepsDone}
                          editMode={!!activeUnit && chatProfileEditMode}
                          onRenameUnit={renameActiveUnit}
                          centerContent={
                            activeUnit ? (
                              <Text style={styles.chatProfileRingEmoji}>{activeUnit.emoji}</Text>
                            ) : (
                              <View style={[styles.chatProfileAgentCore, { backgroundColor: chatAgentAvatarBg }]}>
                                <AgentEyes compact />
                              </View>
                            )
                          }
                          onPressOpenUnits={() => {
                            setShowChatProfile(false);
                            closeChatSheet();
                            navigation.navigate('Units');
                          }}
                        />
                      </Animated.View>
                    )}
                    {!showChatProfile && (
                      <>
                        {!activeUnit && (
                          <>
                            {oneChatUnitHistoryOpen &&
                              (historyUnitsForWorld.length === 0 ? (
                                <View style={styles.unitLogCard}>
                                  <Text style={[styles.unitLogTitle, { textAlign: isRtlLayout ? 'right' : 'left' }]}>
                                    {language === 'he' ? 'אין היסטוריה לעולם הזה עדיין' : 'No history in this world yet'}
                                  </Text>
                                </View>
                              ) : (
                                historyUnitsForWorld.map((unit) => (
                                  <TouchableOpacity
                                    key={`log_${unit.id}`}
                                    style={styles.unitLogCard}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                      setActiveUnitId(unit.id);
                                      setOneChatUnitHistoryOpen(false);
                                    }}
                                  >
                                    <Text style={[styles.unitLogTitle, { textAlign: isRtlLayout ? 'right' : 'left' }]}>
                                      {unit.emoji} {embedLatinRunsForRtlDisplay(unit.title, language)}
                                    </Text>
                                    <Text style={[styles.unitLogMeta, { textAlign: isRtlLayout ? 'right' : 'left' }]}>
                                      {unit.status} · {unit.progress}% · {unit.steps} steps
                                    </Text>
                                    {currentWorldId === 'personal' && (
                                      <View style={styles.unitLogWorldTag}>
                                        <WorldMiniIcon
                                          worldId={unit.worldId}
                                          color={(WORLDS.find((w) => w.id === unit.worldId)?.color ?? colors.textSecondary)}
                                          size={12}
                                        />
                                        <Text
                                          style={[
                                            styles.unitLogWorldTagText,
                                            { color: WORLDS.find((w) => w.id === unit.worldId)?.color ?? colors.textSecondary },
                                          ]}
                                        >
                                          {unit.worldId === 'personal'
                                            ? generalWorldLabel
                                            : (WORLDS.find((w) => w.id === unit.worldId)?.label ?? unit.worldId)}
                                        </Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                ))
                              ))}
                            <View style={styles.historyHintWrap}>
                              <TouchableOpacity
                                style={[styles.historyToggleBtn, { backgroundColor: '#000000' }]}
                                activeOpacity={0.75}
                                onPress={() => setOneChatUnitHistoryOpen((v) => !v)}
                              >
                                <Text style={[styles.historyToggleLabel, { color: '#ffffff' }]}>
                                  {oneChatUnitHistoryOpen ? 'סגור היסטוריה' : 'היסטוריה'}
                                </Text>
                                <Text style={[styles.historyToggleChevron, { color: '#a3a3a3' }]}>
                                  {oneChatUnitHistoryOpen ? '⌃' : '⌄'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.historyAboveMessagesFlex} />
                          </>
                        )}
                        {(activeUnit ? activeUnit.messages : chatSheetMessages).map((message) => (
                          <View
                            key={message.id}
                            style={[
                              styles.chatModalBubble,
                              message.sender === 'user' ? styles.chatModalBubbleUser : styles.chatModalBubbleOne,
                              message.sender === 'one' ? { backgroundColor: chatOneBubbleBg } : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chatModalBubbleText,
                                message.sender === 'user' ? styles.chatModalBubbleTextUser : styles.chatModalBubbleTextOne,
                                {
                                  writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                  textAlign: isRtlLayout ? 'right' : 'left',
                                },
                              ]}
                            >
                              {message.text}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </ScrollView>
                </View>
                </Animated.View>
              )}
              {showChatSheet && (
              <Animated.View
                style={{
                  transform: [{ translateY: chatComposerTranslateY }, { translateX: chatSheetTranslateX }],
                  zIndex: 6,
                }}
              >
              <View
                style={[
                  styles.nowInputWrap,
                  {
                    width: isNarrow ? '100%' : Math.min(contentWidth, 460),
                    alignSelf: isNarrow ? 'stretch' : 'center',
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    paddingBottom: (insets.bottom || 6) + 6 + keyboardOffset,
                    marginBottom: 0,
                    backgroundColor: chatSheetBg,
                  },
                ]}
              >
                <NowInputBarRow
                  isRtl={isRtlLayout}
                  style={[styles.chatModalInputRow, { backgroundColor: colors.surface }]}
                  plus={
                    <TouchableOpacity
                      style={[styles.plusInInputCircle, { backgroundColor: colors.background }]}
                      activeOpacity={0.8}
                      onPress={openAttachSheet}
                    >
                      <Svg width={26} height={26} viewBox="0 0 46 46" fill="none">
                        <Path d="M25.6758 25.7408L25.6758 33.7917C25.6758 34.405 25.4611 34.9264 25.0317 35.3558C24.6025 35.7853 24.0811 36 23.4675 36C22.8539 36 22.3325 35.7853 21.9033 35.3558C21.4739 34.9264 21.2592 34.405 21.2592 33.7917L21.2592 25.7408L13.2083 25.7408C12.595 25.7408 12.0736 25.5261 11.6442 25.0967C11.2147 24.6675 11 24.1461 11 23.5325C11 22.9189 11.2147 22.3975 11.6442 21.9683C12.0736 21.5389 12.595 21.3242 13.2083 21.3242L21.2592 21.3242L21.2592 13.2733C21.2592 12.66 21.4739 12.1386 21.9033 11.7092C22.3325 11.2797 22.8539 11.065 23.4675 11.065C24.0811 11.065 24.6025 11.2797 25.0317 11.7092C25.4611 12.1386 25.6758 12.66 25.6758 13.2733L25.6758 21.3242L33.7267 21.3242C34.34 21.3242 34.8614 21.5389 35.2908 21.9683C35.7203 22.3975 35.935 22.9189 35.935 23.5325C35.935 24.1461 35.7203 24.6675 35.2908 25.0967C34.8614 25.5261 34.34 25.7408 33.7267 25.7408L25.6758 25.7408Z" fill={colors.textSecondary} stroke={colors.textSecondary} strokeWidth={1.43} />
                      </Svg>
                    </TouchableOpacity>
                  }
                  field={
                    <View style={styles.nowInputFieldSlot}>
                      <TextInput
                        ref={chatComposerInputRef}
                        style={[
                          styles.nowInputField,
                          { color: colors.text, textAlign: nowInputTextAlign, writingDirection: nowInputWritingDirection },
                          Platform.OS === 'web'
                            ? ({ outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' } as any)
                            : null,
                        ]}
                        placeholder=""
                        placeholderTextColor={hexToRgba(colors.textSecondary, 0.5)}
                        value={nowValue}
                        onChangeText={setNowValue}
                        showSoftInputOnFocus
                        onFocus={(e: any) => {
                          if (showChatProfile) {
                            setShowChatProfile(false);
                            setChatProfileEditMode(false);
                            setChatOpenedFromOrbProfileShortcut(false);
                            setTimeout(scrollOneChatToBottom, 100);
                          }
                          setIsChatInputFocused(true);
                          if (Platform.OS === 'web') {
                            const t = e?.target;
                            if (t?.style) {
                              t.style.outline = 'none';
                              t.style.boxShadow = 'none';
                              t.style.border = '0';
                            }
                          }
                        }}
                        onBlur={() => setIsChatInputFocused(false)}
                        onSubmitEditing={submitNowValue}
                        returnKeyType="done"
                        blurOnSubmit
                      />
                      {!nowInputHasText && !isChatInputFocused && (
                        <View style={styles.nowPlaceholderOverlay} pointerEvents="none">
                          <Animated.Text
                            style={[
                              styles.nowPlaceholderText,
                              {
                                color: hexToRgba(colors.textSecondary, 0.72),
                                opacity: nowQuestionPulse,
                                writingDirection: isRtlLayout ? 'rtl' : 'ltr',
                                textAlign: isRtlLayout ? 'right' : 'left',
                                width: '100%',
                              },
                            ]}
                          >
                            {nowPlaceholderPhrase}
                          </Animated.Text>
                        </View>
                      )}
                    </View>
                  }
                  trailing={
                    <View style={styles.chatComposerTrailingRow}>
                      <TouchableOpacity style={styles.micButton} activeOpacity={0.7} hitSlop={6}>
                        <Svg width={20} height={20} viewBox="0 0 26 26" fill="none">
                          <Path d="M13.1181 17.4274C14.1924 17.4274 15.2227 16.9709 15.9824 16.1582C16.7421 15.3455 17.1688 14.2433 17.1688 13.0941V6.59408C17.1688 5.4448 16.7421 4.3426 15.9824 3.52995C15.2227 2.71729 14.1924 2.26074 13.1181 2.26074C12.0438 2.26074 11.0135 2.71729 10.2538 3.52995C9.49415 4.3426 9.06738 5.4448 9.06738 6.59408V13.0941C9.06738 14.2433 9.49415 15.3455 10.2538 16.1582C11.0135 16.9709 12.0438 17.4274 13.1181 17.4274Z" fill={colors.textSecondary} />
                          <Path d="M19.3254 13.1882C19.0541 13.1882 18.794 13.2875 18.6022 13.4641C18.4103 13.6408 18.3026 13.8804 18.3026 14.1303C18.3026 15.3795 17.7638 16.5775 16.8048 17.4608C15.8457 18.3442 14.545 18.8404 13.1887 18.8404C11.8324 18.8404 10.5317 18.3442 9.57266 17.4608C8.61363 16.5775 8.07485 15.3795 8.07485 14.1303C8.07485 13.8804 7.96709 13.6408 7.77528 13.4641C7.58347 13.2875 7.32333 13.1882 7.05207 13.1882C6.78081 13.1882 6.52067 13.2875 6.32886 13.4641C6.13705 13.6408 6.0293 13.8804 6.0293 14.1303C6.0293 15.8792 6.78359 17.5564 8.12624 18.7931C9.46889 20.0297 11.2899 20.7245 13.1887 20.7245C15.0875 20.7245 16.9085 20.0297 18.2512 18.7931C19.5938 17.5564 20.3481 15.8792 20.3481 14.1303C20.3481 13.8804 20.2404 13.6408 20.0486 13.4641C19.8568 13.2875 19.5966 13.1882 19.3254 13.1882Z" fill={colors.textSecondary} />
                          <Path d="M16.1562 21.7607H10.0801C9.81148 21.7607 9.5539 21.8749 9.36399 22.078C9.17408 22.2812 9.06738 22.5568 9.06738 22.8441C9.06738 23.1314 9.17408 23.4069 9.36399 23.6101C9.5539 23.8133 9.81148 23.9274 10.0801 23.9274H16.1562C16.4247 23.9274 16.6823 23.8133 16.8722 23.6101C17.0621 23.4069 17.1688 23.1314 17.1688 22.8441C17.1688 22.5568 17.0621 22.2812 16.8722 22.078C16.6823 21.8749 16.4247 21.7607 16.1562 21.7607Z" fill={colors.textSecondary} />
                        </Svg>
                      </TouchableOpacity>
                      {isChatSystemWorking ? (
                        <View style={[styles.chatSendBtn, { backgroundColor: theme === 'dark' ? '#ffffff' : '#111111' }]}>
                          <Animated.View
                            style={[
                              styles.chatWorkingSquare,
                              {
                                backgroundColor: theme === 'dark' ? '#111111' : '#ffffff',
                                opacity: chatActionBreath,
                                transform: [{ scale: chatActionBreath }],
                              },
                            ]}
                          />
                        </View>
                      ) : nowValue.trim() ? (
                        <TouchableOpacity
                          style={[styles.chatSendBtn, { backgroundColor: theme === 'dark' ? '#ffffff' : '#111111' }]}
                          activeOpacity={0.8}
                          hitSlop={6}
                          onPress={submitNowValue}
                        >
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M12 20V6M12 6L6.75 11.25M12 6L17.25 11.25"
                              fill="none"
                              stroke={theme === 'dark' ? '#111111' : '#ffffff'}
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.chatSendBtn, { backgroundColor: theme === 'dark' ? '#ffffff' : '#111111' }]}
                          activeOpacity={0.8}
                          hitSlop={6}
                          onPress={() => {
                            if (showChatProfile && activeUnit) setChatProfileEditMode((v) => !v);
                            else openChatProfile();
                          }}
                        >
                          {showChatProfile ? (
                            activeUnit && chatProfileEditMode ? (
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path
                                  d="M6 12.5L10.5 17L18 8"
                                  stroke="#22c55e"
                                  strokeWidth={2.6}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="none"
                                />
                              </Svg>
                            ) : activeUnit ? (
                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Path d="M5 16.75V19H7.25L16.6 9.65L14.35 7.4L5 16.75Z" stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={1.8} fill="none" />
                                <Path d="M13.75 8L16 10.25" stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={1.8} strokeLinecap="round" />
                              </Svg>
                            ) : (
                              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Rect x={5.25} y={4.5} width={13.5} height={15} rx={2.5} stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={2} />
                                <Path d="M8.5 10H15.5M8.5 13.5H13.5" stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={2} strokeLinecap="round" />
                              </Svg>
                            )
                          ) : (
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                              <Rect x={5.25} y={4.5} width={13.5} height={15} rx={2.5} stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={2} />
                              <Path d="M8.5 10H15.5M8.5 13.5H13.5" stroke={theme === 'dark' ? '#111111' : '#ffffff'} strokeWidth={2} strokeLinecap="round" />
                            </Svg>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  }
                />
              </View>
              </Animated.View>
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashOrbSlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashOrbWrap: {
    width: EMOJI_CIRCLE_SIZE,
    height: EMOJI_CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashOrbCircle: {
    position: 'absolute',
  },
  splashFaceWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    flex: 1,
    width: '100%',
  },
  ovalLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 50,
  },
  ovalSvg: {
    width: '100%',
    height: '100%',
  },
  fixedCenterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** שליטה במיקום האינפוט + ONE: הגדלת marginTop מורידה את הבלוק */
  fixedCenterInner: {
    marginTop: 248,
    marginBottom: 24,
    alignItems: 'center',
  },
  /** במוביל – מגביהים את הבלוק (ONE נראה נמוך במכשיר) */
  fixedCenterInnerMobile: {
    marginTop: 218,
  },
  /** פחות רווח בין תיבת האינפוט לכפתור ONE; תיבת האינפוט קרובה יותר למטה */
  nowInputWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 5,
  },
  /** תיבת האינפוט בבר התחתון (אחרי לחיצה על ONE) – באותו מיקום שבו היה ה־action button */
  bottomInputWrap: {
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  /** פחות רווח בקצוות – עיגול הפלוס קרוב יותר לקצה התיבה (כיוון השורה: `NowInputBarRow`) */
  nowInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  /** שדה + placeholder מעליו — בתוך שורת כרום קבועה LTR */
  nowInputFieldSlot: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  nowInputRowCollapsed: {
    width: 150,
    minHeight: 40,
  },
  nowInputRowExpanded: {
    minWidth: 280,
    maxWidth: '90%',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nowInputField: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'left',
    minWidth: 0,
  },
  nowPlaceholderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 6,
  },
  nowPlaceholderText: {
    fontSize: 15,
    lineHeight: 18,
  },
  plusInInputCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    padding: 4,
    marginLeft: 0,
  },
  orbPagerWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  cardViewWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    paddingHorizontal: 20,
  },
  cardTitleRow: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  cardProgressWrap: {
    marginBottom: 20,
  },
  cardProgressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  cardProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardProgressText: {
    fontSize: 13,
    textAlign: 'center',
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  cardStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  cardStepBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  cardStepTitle: {
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  cardRealityBlock: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardRealityLine: {
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 4,
  },
  cardRealityTarget: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 8,
  },
  wheelItemTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelOrb: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  /** כשהכדור קטן האימוג'י ממורכז; הגבהת אימוג'י במרכז מתבצעת ב־render (emojiMarginTop) */
  wheelOrbInner: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelOrbEmoji: {
    fontSize: 44,
  },
  /** אייקון (אימוג'י) בתוך עיגול – גודל/מסגרת/מילוי בראש הקובץ (EMOJI_CIRCLE_*) */
  wheelOrbEmojiCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentEyesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  agentEyesRowCompact: {
    gap: 9,
  },
  agentEye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  agentEyeCompact: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  /** כותרת ראשית + משנית – מתחת לכדור הסוכן, קרוב יותר לכדור */
  wheelOrbTextBlock: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '45%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  wheelOrbTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  wheelOrbSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 7,
    paddingHorizontal: 6,
  },
  /** קווי מיתר לדיבוג – כבה עם SHOW_ORB_DEBUG_OUTLINE = false */
  orbDebugOutline: {
    borderWidth: 1,
    borderColor: 'rgba(112, 112, 112, 0)',
  },
  orb: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orbInner: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 16,
    flex: 1,
    width: '100%',
  },
  orbEmojiSmall: {
    fontSize: 28,
  },
  orbEmojiLarge: {
    fontSize: 48,
    marginBottom: 8,
  },
  orbTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  orbSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  orbButtonWrap: {
    alignItems: 'center',
  },
  orbButton: {
    overflow: 'hidden',
  },
  /** טקסט העולם (אישי / בריאות / עסקים / כלכלה) – בתוך ובמרכז כפתור הכדור, צבעוני */
  orbButtonWorldLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbButtonWorldLabelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  /** שלוש נקודות סליידר בכדור הראשון – המרכזית גדולה = העולם הפעיל, צבע לפי עולם */
  orbButtonDotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  orbButtonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  orbButtonDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  /** אייקון Enter במרכז כפתור הכדור – בכדורי תהליך, לבן תמיד */
  orbButtonEnterIconWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  barDesktopInsetTop: {
    top: 24,
  },
  barDesktopInsetBottom: {
    bottom: 24,
  },
  creditsTrigger: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  walletScreenWrap: {
    flex: 1,
  },
  walletScreenWrapDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  walletScreenInner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  walletScreenInnerDesktop: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    maxHeight: '88%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  walletFixedTop: {
    paddingBottom: 12,
  },
  walletPlanCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  walletPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletPlanIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  walletUpgradeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  walletUpgradeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletBalanceNumber: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  walletBalanceLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  walletPayPalLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  walletActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  walletCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBuyUnitsBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  walletBuyUnitsText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  walletHistoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  walletHistoryScroll: {
    flex: 1,
    maxHeight: 400,
  },
  walletHistoryScrollContent: {
    paddingBottom: 16,
  },
  walletBottomBar: {
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  walletHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  walletHistoryTextWrap: {
    flex: 1,
  },
  walletHistoryLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  walletHistoryTime: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  walletHistoryChange: {
    fontSize: 16,
    fontWeight: '600',
  },
  walletCloseBtn: {
    padding: 10,
  },
  agentCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  agentCardOverlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  agentCardContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 48,
    borderRadius: 20,
    overflow: 'hidden',
  },
  agentCardContainerDesktop: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    flex: 0,
    maxHeight: '85%',
    marginVertical: 24,
  },
  agentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  agentCardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  agentCardClose: {
    padding: 8,
  },
  agentCardScroll: {
    flex: 1,
  },
  agentCardPage: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  agentCardWorldCard: {
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  agentCardWorldBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  agentCardWorldName: {
    fontSize: 18,
    fontWeight: '700',
  },
  agentCardWorldSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  agentCardSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  agentCardBroadcastRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  agentCardBroadcastType: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  agentCardBroadcastBody: {
    fontSize: 15,
  },
  agentCardProfileLink: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  agentCardProfileLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  agentCardDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
  },
  agentCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  creditsCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  creditsText: {
    fontSize: 17,
    fontWeight: '600',
  },
  bottomActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
    zIndex: 2,
  },
  chatSheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '18%',
    bottom: 86,
    borderTopWidth: 1,
    zIndex: 1,
  },
  chatSheetScroll: {
    flex: 1,
  },
  chatSheetScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 10,
  },
  chatSheetBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatSheetBubbleText: {
    fontSize: 15,
    textAlign: 'right',
  },
  chatModalBackdrop: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  chatModalScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  chatModalBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  chatModalSheet: {
    position: 'relative',
    flexDirection: 'column',
    borderTopWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  chatModalHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  chatModalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  /** סרגל עליון אחיד — צ׳אט ופרופיל יחידה */
  chatSheetTopBar: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    paddingVertical: 6,
  },
  chatSheetHeaderShareBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSheetHeaderShareGlyph: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatModalIconBtn: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalBackIcon: {
    fontSize: 32,
    marginTop: -6,
  },
  chatModalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalUnitEmoji: {
    fontSize: 18,
  },
  chatModalHeaderText: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  chatHeaderProfileBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chatModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chatAgentWorldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  chatModalMenuBtn: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  chatModalMenuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chatMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 30,
  },
  chatMenuScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  chatMenuCard: {
    position: 'absolute',
    zIndex: 2,
    top: 58,
    end: 14,
    width: 190,
    borderRadius: 18,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  chatMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatMenuItemText: {
    fontSize: 28/2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  chatProfileToolbarSpacer: {
    flex: 1,
  },
  chatProfileToolbarCompactCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  chatProfileToolbarCompactText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chatProfileToolbarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chatProfileToolbarSubtitle: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: '600',
  },
  /** גודל אימוג'י במרכז טבעת הפרופיל (UnitChatProfile) */
  chatProfileRingEmoji: {
    fontSize: 34,
  },
  chatProfileAgentCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalScroll: {
    flex: 1,
  },
  chatModalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  /** ממלא לפחות גובה ה־ScrollView כדי ש־flexGrow בין היסטוריה להודעות ידחוף את הצ׳אט לתחתית */
  chatModalScrollContentOne: {
    flexGrow: 1,
  },
  chatModalBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatModalBubbleOne: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  chatModalBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#000000',
  },
  chatModalBubbleText: {
    fontSize: 16,
  },
  chatModalBubbleTextOne: {
    color: '#111111',
  },
  chatModalBubbleTextUser: {
    color: '#ffffff',
  },
  /** היסטוריית יחידות בצ׳אט ONE — רקע שחור, ללא מסגרת */
  unitLogCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    backgroundColor: '#000000',
    borderWidth: 0,
  },
  unitLogTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  unitLogMeta: {
    fontSize: 12,
    marginTop: 3,
    color: '#a1a1aa',
  },
  unitLogWorldTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  unitLogWorldTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyHintWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  historyAboveMessagesFlex: {
    height: 56,
  },
  historyToggleBtn: {
    minWidth: 120,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyToggleChevron: {
    fontSize: 14,
    marginTop: -2,
  },
  chatModalInputWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatModalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatComposerTrailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chatWorkingSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  chatSendBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 160,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  /** כפתור X בבוטום בר – marginTop גדול יותר = נמוך יותר (אופסיטי) */
  exitButton: {
    marginTop: 26,
    padding: 10,
  },
});
