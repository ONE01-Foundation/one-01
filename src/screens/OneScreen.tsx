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
  Pressable,
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
import { useLocaleStore, type AppLanguage } from '../stores/localeStore';
import { useLoadingStore } from '../stores/loadingStore';
import { useDevModeStore, type DevPreviewProfile } from '../stores/devModeStore';
import { useGlobalIntentSignalsStore } from '../stores/globalIntentSignalsStore';
import {
  translate,
  embedLatinRunsForRtlDisplay,
  type SettingsStringKey,
  type ChatChromeKey,
} from '../i18n/strings';
import type { ViewMode, CardContext } from '../one01/viewState';
import { getProcessStepsData, getProgress } from '../data/processSteps';
import type { AppShellParamList } from '../navigation/types';
import { useOne } from '../core/OneContext';
import type { LifeLens, OneProcess } from '../core/types';
import type { SpaceId, DomainId } from '../core/spaces';
import { legacyWorldIdToSpaceDomain } from '../core/spaces';
import { OrbAgent } from '../components/OrbAgent';
import {
  UnitChatProfile,
  type AgentChatProfileModel,
  type UnitChatProfileModel,
  type UnitProfilePerson,
  type UnitProfileSlot,
} from '../components/UnitChatProfile';
import { HAT_LABELS, PERSONA_LABELS, type Hat } from '../core/types';
import { AttachActionSheet, type AttachActionId } from '../components/AttachActionSheet';
import { AddContactIcon } from '../components/icons/AddContactIcon';
import { ShareIcon } from '../components/icons/ShareIcon';
import { ChatBackArrowIcon } from '../components/icons/ChatBackArrowIcon';
import { SettingsIcon } from '../components/icons/SettingsIcon';
import { BackgroundOvarly } from '../components/icons/BackgroundOvarly';

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

/** זהב כפתור שדרוג – עקביות לקרדיטים, תג PRO וכפתורי ארנק */
const UPGRADE_GOLD = '#e6bf3f';
const UPGRADE_GOLD_ON = '#111111';

/** צ׳אט סוכן: גלילה למעלה (לכיוון הודעות/תוכן קודם, y קטן) אחרי שכבר גללת למטה — פותחת היסטוריה מעל */
/** פריט אחד בגלגל – תהליך עם אימוג'י, כותרת, תת־כותרת */
export type OrbItem = { id: string; emoji: string; title: string; subtitle: string };

/** כדורי יחידה חדשים מיד מתחת לשורת הבית (origin), לא בסוף הגלגל */
function insertPersonalOrbsAfterOrigin(prev: OrbItem[], orbs: OrbItem[]): OrbItem[] {
  if (!orbs.length) return prev;
  const idSet = new Set(orbs.map((o) => o.id));
  const without = prev.filter((p) => !idSet.has(p.id));
  const originIdx = without.findIndex((p) => p.id === 'origin');
  if (originIdx < 0) return [...orbs, ...without];
  return [...without.slice(0, originIdx + 1), ...orbs, ...without.slice(originIdx + 1)];
}

type ChatLine = { id: string; sender: 'user' | 'one'; text: string; sentAt?: number };
type AccountSpace = 'personal' | 'business';

function startOfLocalDayMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function inferMessageSentAt(line: ChatLine, index: number, total: number): number {
  if (line.sentAt != null) return line.sentAt;
  const daysBack = Math.max(0, total - 1 - index);
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.getTime();
}

function formatChatDayStickyLabel(sentAt: number, he: boolean): string {
  const now = Date.now();
  const sodNow = startOfLocalDayMs(now);
  const sodMsg = startOfLocalDayMs(sentAt);
  const diffDays = Math.round((sodNow - sodMsg) / 86400000);
  if (diffDays === 0) return he ? 'היום' : 'Today';
  if (diffDays === 1) return he ? 'אתמול' : 'Yesterday';
  if (diffDays === 2) return he ? 'שלשום' : '2 days ago';
  if (he) {
    return new Date(sentAt).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      ...(new Date(sentAt).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
    });
  }
  return new Date(sentAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(new Date(sentAt).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}

function formatUnitLogStatusLine(
  status: UnitChatProfileModel['status'],
  progress: number,
  steps: number,
  language: AppLanguage,
): string {
  if (language === 'he') {
    const statusHe = status === 'active' ? 'פעיל' : status === 'waiting' ? 'ממתין' : 'הושלם';
    return `${statusHe} · ${progress}% · ${steps} צעדים`;
  }
  return `${status} · ${progress}% · ${steps} steps`;
}

type FlowUnit = UnitChatProfileModel & {
  messages: ChatLine[];
  spaceId: SpaceId;
  domainId?: DomainId;
  /** @deprecated temporary migration bridge */
  worldId: string;
};

/** היסטוריית יחידות בצ׳אט סוכן — הישן למעלה */
function flowUnitHistorySortKey(unit: FlowUnit): number {
  const times =
    unit.messages
      ?.map((m) => m.sentAt)
      .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t)) ?? [];
  if (times.length) return Math.min(...times);
  const parsed = /^unit_(\d+)$/.exec(unit.id);
  if (parsed) return Number(parsed[1]) || 0;
  return 0;
}

function sortFlowUnitsHistoryOldestFirst(units: FlowUnit[]): FlowUnit[] {
  return [...units].sort((a, b) => {
    const d = flowUnitHistorySortKey(a) - flowUnitHistorySortKey(b);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

/** עולמות משתמש אישי */
const PERSONAL_WORLDS: { id: string; label: string; color: string }[] = [
  { id: 'personal', label: 'ראשי', color: '#ffffff' },
  { id: 'business', label: 'עבודה', color: '#0ea5e9' },
  { id: 'health', label: 'בריאות', color: '#22c55e' },
  { id: 'finance', label: 'כסף', color: '#eab308' },
  { id: 'knowledge', label: 'לימודים', color: '#a855f7' },
  { id: 'leisure', label: 'פנאי', color: '#fde047' },
  { id: 'relations', label: 'קשרים', color: '#f472b6' },
];

/** עולמות ייעודיים לחשבון עסקי */
const BUSINESS_WORLDS: { id: string; label: string; color: string }[] = [
  { id: 'business', label: 'סקירה', color: '#0ea5e9' },
  { id: 'clients', label: 'לקוחות', color: '#38bdf8' },
  { id: 'marketing', label: 'שיווק', color: '#f59e0b' },
  { id: 'sales', label: 'מכירות', color: '#22c55e' },
  { id: 'operations', label: 'תפעול', color: '#a78bfa' },
  { id: 'finance', label: 'כספים', color: '#eab308' },
  { id: 'team', label: 'צוות', color: '#f472b6' },
];

const WORLD_LABEL_HE: Record<string, string> = {
  personal: 'ראשי',
  business: 'עבודה',
  health: 'בריאות',
  finance: 'כסף',
  knowledge: 'לימודים',
  leisure: 'פנאי',
  relations: 'קשרים',
  clients: 'לקוחות',
  marketing: 'שיווק',
  sales: 'מכירות',
  operations: 'תפעול',
  team: 'צוות',
};

const WORLD_LABEL_EN: Record<string, string> = {
  personal: 'General',
  business: 'Work',
  health: 'Health',
  finance: 'Finance',
  knowledge: 'Learning',
  leisure: 'Leisure',
  relations: 'Relationships',
  clients: 'Clients',
  marketing: 'Marketing',
  sales: 'Sales',
  operations: 'Operations',
  team: 'Team',
};

function worldTitle(worldId: string, language: AppLanguage): string {
  if (language === 'he') return WORLD_LABEL_HE[worldId] ?? worldId;
  return WORLD_LABEL_EN[worldId] ?? worldId;
}

/** כדור גלובל מלאכותי בראש הגלגל — מעל הסוכן; אינדקס 0 = גלובל, 1 = סוכן */
const GLOBAL_WHEEL_ORB_ID = '__wheel_global__';
const GLOBAL_ORB_INDEX = 0;
const AGENT_ORB_INDEX = 1;

/** גרירה מעבר לראש הגלגל בכדור הסוכן → מעבר לגלובל מוד */
const GLOBAL_PULL_ENTER_PX = 56;
/** גלילה למעלה מתחת לעמדת הסוכן — פתיחת גלובל בלי להמתין למרכוז מלא של כדור הגלובל */
const GLOBAL_WHEEL_EARLY_OPEN_SCROLL_PX = 36;

/** ברודקאסט – שורה ראשית: סוג (עדכון/הודעה/תזכורת), שורה משנית: התוכן */
export type BroadcastMessage = { type: string; body: string };

/** ברודקאסט גלובלי — מרקט דיסקברי + אגרגט אנונימי של רצונות/יחידות שנפתחו בעולם */
function getGlobalBroadcastMessages(
  worldId: string,
  language: AppLanguage,
  crowdSignals: { key: string; labelHe: string; labelEn: string; count: number }[]
): BroadcastMessage[] {
  const name = worldTitle(worldId, language);
  const crowd: BroadcastMessage[] = [];
  const top = crowdSignals.filter((s) => s.count > 0).slice(0, 4);
  if (language === 'he') {
    for (const s of top) {
      crowd.push({
        type: 'ציבורי · אנונימי',
        body: `${s.count} אנשים פתחו לאחרונה תהליך דומה: «${s.labelHe}» — אגרגט בלבד, בלי זהויות.`,
      });
    }
  } else {
    for (const s of top) {
      crowd.push({
        type: 'Public · anonymous',
        body: `${s.count} people recently started a similar journey: “${s.labelEn}”—aggregate only, no identities.`,
      });
    }
  }
  if (language === 'he') {
    return [
      ...crowd,
      {
        type: 'גילוי',
        body: `«${name}» — כאן כל סוכני האנשים נפגשים כדי לחפש ספק שירות, מוצר או תהליך; רואים שכבת אגרגציה אחת שמזינה אתכם ואת ה-AI.`,
      },
      {
        type: 'אגרגט',
        body: 'מחירים, זמינות, ביקורות מאומתות, נפח חיפושים ומגמות ביקוש — מרוכזים לפי עולם ולפי אזור.',
      },
      {
        type: 'שוק',
        body: 'דירוג היצע מול ביקוש, מי מגיב מהר, ומה נפתח הכי הרבה כיחידות בבית — כדי להחליט מה לרדוף אחריו.',
      },
      {
        type: 'סוכנים',
        body: 'שאילתות מסוכנים שונים משלימות תמונה אחת: פחות רעש, יותר התאמה לפני שבוחרים ספק או מוצר.',
      },
    ];
  }
  return [
    ...crowd,
    {
      type: 'Discovery',
      body: `“${name}” — where everyone’s agents search for services, products, and flows; one aggregated layer for people and for AI.`,
    },
    {
      type: 'Aggregate',
      body: 'Prices, availability, verified reviews, search volume, and demand trends — rolled up by world and region.',
    },
    {
      type: 'Market',
      body: 'Supply vs demand, who responds fast, and what becomes a home unit most often — so you pick what to chase.',
    },
    {
      type: 'Agents',
      body: 'Queries from many agents complete one picture: less noise, better fit before you commit to a provider or product.',
    },
  ];
}

function broadcastMessagesForOrbItem(item: OrbItem, units: FlowUnit[], language: AppLanguage): BroadcastMessage[] {
  const he = language === 'he';
  const t = {
    next: he ? 'צעד הבא' : 'Next step',
    goal: he ? 'מטרה' : 'Goal',
    progress: he ? 'התקדמות' : 'Progress',
    update: he ? 'עדכון' : 'Update',
    area: he ? 'אזור' : 'Area',
    unit: he ? 'יחידה' : 'Unit',
    reminder: he ? 'תזכורת' : 'Reminder',
    ready: he ? 'מוכן לביצוע' : 'Ready to go',
    chatHint: he ? 'פתחו בצ׳אט למעקב אחר צעדים' : 'Open chat to track steps',
    need: he ? 'צריך ממך' : 'Need from you',
    status: he ? 'סטטוס' : 'Status',
  };
  const unit = units.find((u) => u.id === item.id);
  if (unit) {
    const out: BroadcastMessage[] = [];
    const slots = unit.profileSlots?.filter((s) => !s.optional) ?? [];
    const missing = slots.filter((s) => !s.value?.trim());
    if (missing.length > 0) {
      out.push({
        type: t.need,
        body: he ? `${missing.length} שדות חסרים בפרופיל — ${missing[0].label}` : `${missing.length} profile fields missing — ${missing[0].label}`,
      });
      for (const s of missing.slice(1, 4)) {
        out.push({ type: t.need, body: s.label });
      }
    }
    const stLine = formatUnitLogStatusLine(unit.status, unit.progress, unit.steps, language);
    out.push({ type: t.status, body: stLine });
    if (unit.nextAction?.trim()) out.push({ type: t.next, body: unit.nextAction.trim() });
    if (unit.goal?.trim()) out.push({ type: t.goal, body: unit.goal.trim() });
    out.push({ type: t.progress, body: `${unit.progress}% · ${unit.subtitle}` });
    if (unit.lastUpdatedLabel?.trim()) out.push({ type: t.update, body: unit.lastUpdatedLabel.trim() });
    if (unit.city?.trim()) out.push({ type: t.area, body: unit.city.trim() });
    return out.length > 0 ? out : [{ type: t.unit, body: unit.subtitle || item.subtitle }];
  }
  return [
    { type: t.update, body: item.subtitle || t.ready },
    { type: t.reminder, body: `«${item.title}» — ${t.chatHint}` },
  ];
}

const BROADCAST_BY_WORLD_HE: Record<string, BroadcastMessage[]> = {
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
  knowledge: [
    { type: 'עדכון', body: 'התווסף יעד לימוד חדש' },
    { type: 'תזכורת', body: 'זמן לתרגול של 20 דקות' },
    { type: 'הודעה', body: 'שיעור חדש זמין' },
    { type: 'עדכון', body: 'סיכום שיעור נשמר' },
    { type: 'תזכורת', body: 'חזרה לפני מבחן' },
    { type: 'עדכון', body: 'התקדמות הלמידה עודכנה' },
  ],
  leisure: [
    { type: 'תזכורת', body: 'סרט מחר ב־20:00 — כרטיסים ברשימה' },
    { type: 'עדכון', body: 'נוספה המלצה לטיול קצר' },
    { type: 'הודעה', body: 'חברים אישרו פגישה בסופ״ש' },
    { type: 'תזכורת', body: 'זמן לסגור רשימת ציוד לקמפינג' },
    { type: 'עדכון', body: 'מוזיקה חדשה בפלייליסט הפנאי' },
    { type: 'הודעה', body: 'אירוע בשכונה בסוף השבוע' },
  ],
  relations: [
    { type: 'תזכורת', body: 'יום הולדת לסבתא בשבוע הבא — לבחור מתנה' },
    { type: 'הודעה', body: 'חבר שאל מתי ניפגשים' },
    { type: 'עדכון', body: 'נוספה הערה לפגישה עם המשפחה' },
    { type: 'תזכורת', body: 'להחזיר שיחה לדני מהשבוע שעבר' },
    { type: 'עדכון', body: 'רשימת אורחים לערב עודכנה' },
    { type: 'הודעה', body: 'הוזמנתם לאירוע ביום שישי' },
  ],
};

const BROADCAST_BY_WORLD_EN: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'Update', body: 'New messages are waiting' },
    { type: 'Reminder', body: 'Driver license reminder' },
    { type: 'Update', body: 'Profile updated successfully' },
    { type: 'Message', body: '3 tasks pending' },
    { type: 'Reminder', body: 'Meeting with Dani tomorrow' },
    { type: 'Update', body: 'Password changed' },
  ],
  business: [
    { type: 'Message', body: 'Quarterly report uploaded' },
    { type: 'Reminder', body: 'Meeting tomorrow 09:00' },
    { type: 'Update', body: 'Contract ready for signature' },
    { type: 'Reminder', body: 'Project deadline Thursday' },
    { type: 'Update', body: 'Quote sent' },
    { type: 'Message', body: 'Client status updated' },
  ],
  health: [
    { type: 'Update', body: 'Test results received' },
    { type: 'Reminder', body: 'Doctor appointment tomorrow 10:00' },
    { type: 'Message', body: 'Tests within range' },
    { type: 'Update', body: 'Blood test slot confirmed' },
    { type: 'Reminder', body: 'Time to take medication' },
    { type: 'Update', body: 'Medical records available' },
  ],
  finance: [
    { type: 'Update', body: 'Portfolio up 2%' },
    { type: 'Reminder', body: 'Monthly payment due tomorrow' },
    { type: 'Message', body: 'Tax report prepared' },
    { type: 'Update', body: 'Transfer completed' },
    { type: 'Reminder', body: 'Checking account balance low' },
    { type: 'Update', body: 'Dividend received' },
  ],
  knowledge: [
    { type: 'Update', body: 'New study goal added' },
    { type: 'Reminder', body: 'Time for 20 minutes of practice' },
    { type: 'Message', body: 'New lesson available' },
    { type: 'Update', body: 'Lesson summary saved' },
    { type: 'Reminder', body: 'Review before exam' },
    { type: 'Update', body: 'Learning progress updated' },
  ],
  leisure: [
    { type: 'Reminder', body: 'Movie tomorrow 8:00 PM — tickets on your list' },
    { type: 'Update', body: 'Short trip suggestion added' },
    { type: 'Message', body: 'Friends confirmed weekend plans' },
    { type: 'Reminder', body: 'Time to finish the camping gear list' },
    { type: 'Update', body: 'New tracks in your leisure playlist' },
    { type: 'Message', body: 'Neighborhood event this weekend' },
  ],
  relations: [
    { type: 'Reminder', body: "Grandma's birthday next week — pick a gift" },
    { type: 'Message', body: 'Friend asked when to meet' },
    { type: 'Update', body: 'Note added for family dinner' },
    { type: 'Reminder', body: 'Return Dani’s call from last week' },
    { type: 'Update', body: 'Evening guest list updated' },
    { type: 'Message', body: 'Invited to an event on Friday' },
  ],
};

function broadcastMessagesForAgentWorld(worldId: string, language: AppLanguage, units: FlowUnit[]): BroadcastMessage[] {
  const he = language === 'he';
  const open = units
    .filter((u) => u.worldId === worldId && u.status !== 'done')
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  if (open.length === 0) {
    return he
      ? [{ type: 'סטטוס', body: 'אין עדיין יחידות פתוחות במרחב הזה. פתחו יחידה חדשה מהצ׳אט.' }]
      : [{ type: 'Status', body: 'No active units in this space yet. Create one from chat.' }];
  }
  const top = open.slice(0, 3);
  return top.map((u) => ({
    type: he ? 'יחידה פעילה' : 'Active unit',
    body: he
      ? `${u.title} · ${u.progress}% · ${u.nextAction || 'ממתין לצעד הבא'}`
      : `${u.title} · ${u.progress}% · ${u.nextAction || 'Waiting for next action'}`,
  }));
}

/** תהליכים לכל עולם – הכדורים שנגלילים למטה (דוגמאות רחבות) */
const ORB_DATA_BY_WORLD: Record<string, OrbItem[]> = {
  personal: [
    { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
    { id: 'license', emoji: '🚗', title: 'רישיון נהיגה', subtitle: 'מבחן תיאוריה, שיעורים, מבחן מעשי' },
    { id: 'mass', emoji: '💪', title: 'עלות 5 קילו מסה', subtitle: 'תזונה, אימונים, מעקב' },
    { id: 'passport', emoji: '🛂', title: 'חידוש דרכון', subtitle: 'תיאום תור, מסמכים, איסוף' },
  ],
  business: [
    { id: 'origin', emoji: '🏢', title: 'סקירת עסק', subtitle: '' },
    { id: 'biz_dashboard', emoji: '📈', title: 'לוח KPI שבועי', subtitle: 'יעדים, המרות, צווארי בקבוק' },
    { id: 'biz_q_plan', emoji: '🧭', title: 'תוכנית רבעונית', subtitle: 'מטרות, בעלים, דדליינים' },
    { id: 'biz_automation', emoji: '⚙️', title: 'אוטומציות חוסכות זמן', subtitle: 'CRM, פולואפ, דוחות' },
  ],
  clients: [
    { id: 'origin', emoji: '🤝', title: 'לקוחות', subtitle: '' },
    { id: 'clients_onboarding', emoji: '🧾', title: 'Onboarding לקוח חדש', subtitle: 'טפסים, דרישות, kickoff' },
    { id: 'clients_retention', emoji: '❤️', title: 'שימור לקוחות', subtitle: 'NPS, פולואפים, מניעת נטישה' },
    { id: 'clients_support', emoji: '🎧', title: 'תמיכה ו-SLA', subtitle: 'תורים, זמני תגובה, הסלמה' },
  ],
  marketing: [
    { id: 'origin', emoji: '📣', title: 'שיווק', subtitle: '' },
    { id: 'mkt_content', emoji: '🎬', title: 'תוכן חודשי', subtitle: 'רעיונות, הפקה, פרסום' },
    { id: 'mkt_ads', emoji: '💸', title: 'קמפיינים ממומנים', subtitle: 'קריאייטיב, קהלים, אופטימיזציה' },
    { id: 'mkt_site', emoji: '🌐', title: 'שיפור אתר/דפי נחיתה', subtitle: 'מהירות, CTA, A/B' },
  ],
  sales: [
    { id: 'origin', emoji: '💰', title: 'מכירות', subtitle: '' },
    { id: 'sales_pipeline', emoji: '🎯', title: 'ניהול Pipeline', subtitle: 'לידים, הצעות, סגירות' },
    { id: 'sales_followups', emoji: '📞', title: 'פולואפים יומיים', subtitle: 'שיחות, וואטסאפ, סטטוס' },
    { id: 'sales_pricing', emoji: '🧮', title: 'בניית הצעת מחיר', subtitle: 'סקופ, תמחור, מרווח' },
  ],
  operations: [
    { id: 'origin', emoji: '🛠️', title: 'תפעול', subtitle: '' },
    { id: 'ops_board', emoji: '📋', title: 'לוח משימות צוות', subtitle: 'עדיפויות, בעלים, SLA' },
    { id: 'ops_inventory', emoji: '📦', title: 'מלאי ורכש', subtitle: 'חוסרים, הזמנות, עלות' },
    { id: 'ops_quality', emoji: '✅', title: 'בקרת איכות', subtitle: 'צ׳קליסט, חריגות, תיקונים' },
  ],
  team: [
    { id: 'origin', emoji: '👥', title: 'צוות', subtitle: '' },
    { id: 'team_hiring', emoji: '🧲', title: 'גיוס תפקיד קריטי', subtitle: 'דרישות, סורסינג, ראיונות' },
    { id: 'team_training', emoji: '🎓', title: 'הכשרת עובדים', subtitle: 'SOP, חניכה, בדיקה' },
    { id: 'team_reviews', emoji: '🗓️', title: 'שיחות 1:1 חודשיות', subtitle: 'יעדים, חסמים, משוב' },
  ],
  health: [
    { id: 'origin', emoji: '🏥', title: 'בריאות', subtitle: '' },
    { id: 'h1', emoji: '🩺', title: 'תור לרופא', subtitle: 'הזמנה, הגעה, סיכום' },
    { id: 'h2', emoji: '💊', title: 'מעקב תרופות', subtitle: 'רישום, תזכורות, מעקב' },
    { id: 'h3', emoji: '🩸', title: 'בדיקות דם שנתיות', subtitle: 'הפניה, תיאום, תוצאות' },
  ],
  finance: [
    { id: 'origin', emoji: '💰', title: 'כסף', subtitle: '' },
    { id: 'f1', emoji: '📈', title: 'השקעות', subtitle: 'מטרה, פלטפורמה, פיזור נכסים' },
    { id: 'f2', emoji: '🧾', title: 'החזרי מס', subtitle: 'טפסים, הגשה, מעקב' },
    { id: 'f3', emoji: '🚗', title: 'חיסכון לרכב', subtitle: 'יעד, תקציב חודשי, אסטרטגיה' },
  ],
  knowledge: [
    { id: 'origin', emoji: '📚', title: 'לימודים', subtitle: '' },
    { id: 'k1', emoji: '🧠', title: 'תוכנית למידה', subtitle: 'נושאים, תרגול, מבחן' },
    { id: 'k2', emoji: '📝', title: 'הכנה למבחן', subtitle: 'סילבוס, תרגול, חזרות' },
    { id: 'k3', emoji: '🎓', title: 'קורס מקצועי', subtitle: 'מערכים, משימות, מעקב' },
  ],
  leisure: [
    { id: 'origin', emoji: '😊', title: 'פנאי', subtitle: '' },
    { id: 'l1', emoji: '🎬', title: 'ערב קולנוע', subtitle: 'כרטיסים, הגעה, ביקורת קצרה' },
    { id: 'l2', emoji: '🏕️', title: 'קמפינג משפחתי', subtitle: 'ציוד, מסלול, תזכורות' },
    { id: 'l3', emoji: '🎮', title: 'גיימינג עם חברים', subtitle: 'זמן, משחק, סיכום חוויה' },
  ],
  relations: [
    { id: 'origin', emoji: '💕', title: 'קשרים', subtitle: '' },
    { id: 'r1', emoji: '🎂', title: 'יום הולדת במשפחה', subtitle: 'מתנה, הזמנה, תזכורת לאורחים' },
    { id: 'r2', emoji: '☕', title: 'פגישה עם חברים', subtitle: 'מקום, שעה, אישור הגעה' },
    { id: 'r3', emoji: '💌', title: 'מעקב אחר קשרים', subtitle: 'שיחות, תאריכים חשובים, הערות' },
  ],
};

const ORB_DATA_BY_WORLD_EN: Record<string, OrbItem[]> = {
  personal: [
    { id: 'origin', emoji: '👤', title: 'Home', subtitle: '' },
    { id: 'license', emoji: '🚗', title: "Driver's license", subtitle: 'Theory, lessons, practical exam' },
    { id: 'mass', emoji: '💪', title: 'Gain 5 kg muscle', subtitle: 'Nutrition, workouts, tracking' },
    { id: 'passport', emoji: '🛂', title: 'Passport renewal', subtitle: 'Appointment, documents, pickup' },
  ],
  business: [
    { id: 'origin', emoji: '🏢', title: 'Business overview', subtitle: '' },
    { id: 'biz_dashboard', emoji: '📈', title: 'Weekly KPI dashboard', subtitle: 'Targets, conversion, bottlenecks' },
    { id: 'biz_q_plan', emoji: '🧭', title: 'Quarterly plan', subtitle: 'Goals, owners, deadlines' },
    { id: 'biz_automation', emoji: '⚙️', title: 'Time-saving automations', subtitle: 'CRM, follow-ups, reports' },
  ],
  clients: [
    { id: 'origin', emoji: '🤝', title: 'Clients', subtitle: '' },
    { id: 'clients_onboarding', emoji: '🧾', title: 'Client onboarding', subtitle: 'Forms, requirements, kickoff' },
    { id: 'clients_retention', emoji: '❤️', title: 'Client retention', subtitle: 'NPS, follow-ups, churn prevention' },
    { id: 'clients_support', emoji: '🎧', title: 'Support & SLA', subtitle: 'Queues, response times, escalation' },
  ],
  marketing: [
    { id: 'origin', emoji: '📣', title: 'Marketing', subtitle: '' },
    { id: 'mkt_content', emoji: '🎬', title: 'Monthly content engine', subtitle: 'Ideas, production, publishing' },
    { id: 'mkt_ads', emoji: '💸', title: 'Paid campaigns', subtitle: 'Creatives, audiences, optimization' },
    { id: 'mkt_site', emoji: '🌐', title: 'Website & landing optimization', subtitle: 'Speed, CTA, A/B tests' },
  ],
  sales: [
    { id: 'origin', emoji: '💰', title: 'Sales', subtitle: '' },
    { id: 'sales_pipeline', emoji: '🎯', title: 'Pipeline management', subtitle: 'Leads, proposals, closes' },
    { id: 'sales_followups', emoji: '📞', title: 'Daily follow-ups', subtitle: 'Calls, messages, status updates' },
    { id: 'sales_pricing', emoji: '🧮', title: 'Proposal pricing', subtitle: 'Scope, pricing, margin control' },
  ],
  operations: [
    { id: 'origin', emoji: '🛠️', title: 'Operations', subtitle: '' },
    { id: 'ops_board', emoji: '📋', title: 'Team ops board', subtitle: 'Priorities, owners, SLA' },
    { id: 'ops_inventory', emoji: '📦', title: 'Inventory & procurement', subtitle: 'Stock gaps, orders, cost' },
    { id: 'ops_quality', emoji: '✅', title: 'Quality control', subtitle: 'Checklists, incidents, fixes' },
  ],
  team: [
    { id: 'origin', emoji: '👥', title: 'Team', subtitle: '' },
    { id: 'team_hiring', emoji: '🧲', title: 'Hiring critical role', subtitle: 'JD, sourcing, interviews' },
    { id: 'team_training', emoji: '🎓', title: 'Employee training', subtitle: 'SOP, shadowing, validation' },
    { id: 'team_reviews', emoji: '🗓️', title: 'Monthly 1:1 reviews', subtitle: 'Goals, blockers, feedback' },
  ],
  health: [
    { id: 'origin', emoji: '🏥', title: 'Health', subtitle: '' },
    { id: 'h1', emoji: '🩺', title: 'Doctor visit', subtitle: 'Booking, visit, summary' },
    { id: 'h2', emoji: '💊', title: 'Medication tracking', subtitle: 'Log, reminders, follow-up' },
    { id: 'h3', emoji: '🩸', title: 'Annual blood tests', subtitle: 'Referral, scheduling, results' },
  ],
  finance: [
    { id: 'origin', emoji: '💰', title: 'Finance', subtitle: '' },
    { id: 'f1', emoji: '📈', title: 'Investing', subtitle: 'Goal, platform, diversification' },
    { id: 'f2', emoji: '🧾', title: 'Tax refunds', subtitle: 'Forms, filing, tracking' },
    { id: 'f3', emoji: '🚗', title: 'Saving for a car', subtitle: 'Goal, monthly budget, strategy' },
  ],
  knowledge: [
    { id: 'origin', emoji: '📚', title: 'Learning', subtitle: '' },
    { id: 'k1', emoji: '🧠', title: 'Learning plan', subtitle: 'Topics, practice, exam' },
    { id: 'k2', emoji: '📝', title: 'Exam prep', subtitle: 'Syllabus, practice, review' },
    { id: 'k3', emoji: '🎓', title: 'Professional course', subtitle: 'Modules, tasks, tracking' },
  ],
  leisure: [
    { id: 'origin', emoji: '😊', title: 'Leisure', subtitle: '' },
    { id: 'l1', emoji: '🎬', title: 'Movie night', subtitle: 'Tickets, trip, quick review' },
    { id: 'l2', emoji: '🏕️', title: 'Family camping', subtitle: 'Gear, route, reminders' },
    { id: 'l3', emoji: '🎮', title: 'Gaming with friends', subtitle: 'Time, game, recap' },
  ],
  relations: [
    { id: 'origin', emoji: '💕', title: 'Relationships', subtitle: '' },
    { id: 'r1', emoji: '🎂', title: 'Family birthday', subtitle: 'Gift, RSVP, guest reminders' },
    { id: 'r2', emoji: '☕', title: 'Friends coffee', subtitle: 'Place, time, RSVP' },
    { id: 'r3', emoji: '💌', title: 'Relationship check-ins', subtitle: 'Calls, important dates, notes' },
  ],
};

/** כדורי פרופיל dev שלא מופיעים בשורת personal המלאה — תרגום EN לפי id */
const ORB_EXTRA_EN: Record<string, Pick<OrbItem, 'title' | 'subtitle'>> = {
  study_plan: { title: 'Study plan', subtitle: 'Topics, practice, exam' },
  exam: { title: 'Exam prep', subtitle: 'Syllabus, practice, review' },
  content: { title: 'Content production', subtitle: 'Idea, shoot, edit' },
  launch: { title: 'Launch', subtitle: 'Landing page, promo, metrics' },
  class_plan: { title: 'Lesson plan', subtitle: 'Structure, tasks, feedback' },
  business_ops: { title: 'Business ops', subtitle: 'Clients, billing, tracking' },
};

/** כדורי עולם: רק «מקור» של העולם + יחידות שאתה יצרת — בלי כדורי דוגמה מהקטלוג (אלא אם includeCatalogExamples) */
function localizedOrbDataForWorld(
  worldId: string,
  personalOrbs: OrbItem[],
  language: AppLanguage,
  flowUnits: FlowUnit[],
  includeCatalogExamples: boolean
): OrbItem[] {
  const catalogHe = ORB_DATA_BY_WORLD[worldId] ?? ORB_DATA_BY_WORLD.personal;
  const catalogEn = ORB_DATA_BY_WORLD_EN[worldId] ?? ORB_DATA_BY_WORLD_EN.personal;

  const userOrbsForWorld = (excludeOrigin: boolean) =>
    personalOrbs.filter((o) => {
      if (excludeOrigin && o.id === 'origin') return false;
      const u = flowUnits.find((fu) => fu.id === o.id);
      return u?.worldId === worldId;
    });

  const catalogExamplesForWorld = (): OrbItem[] => {
    const cat = language === 'he' ? catalogHe : catalogEn;
    return cat.filter((o) => o.id !== 'origin');
  };

  const mergeById = (base: OrbItem[], extras: OrbItem[]): OrbItem[] => {
    const seen = new Set(base.map((o) => o.id));
    const out = [...base];
    for (const o of extras) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
    return out;
  };

  if (language === 'he') {
    if (worldId === 'personal') {
      if (!includeCatalogExamples) return personalOrbs;
      return mergeById(catalogHe, personalOrbs.filter((o) => !catalogHe.some((c) => c.id === o.id)));
    }
    const origin = catalogHe.find((o) => o.id === 'origin');
    const head = [origin ?? personalOrbs[0] ?? { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' }];
    const user = userOrbsForWorld(true);
    if (!includeCatalogExamples) return [...head, ...user];
    const examples = catalogExamplesForWorld().filter((o) => !user.some((u) => u.id === o.id));
    return [...head, ...mergeById(examples, user)];
  }
  if (worldId === 'personal') {
    const mappedPersonal = personalOrbs.map((o) => {
      const fromEn = ORB_DATA_BY_WORLD_EN.personal.find((e) => e.id === o.id);
      if (fromEn) return { ...o, title: fromEn.title, subtitle: fromEn.subtitle };
      const extra = ORB_EXTRA_EN[o.id];
      return extra ? { ...o, title: extra.title, subtitle: extra.subtitle ?? o.subtitle } : o;
    });
    if (!includeCatalogExamples) return mappedPersonal;
    return mergeById(
      ORB_DATA_BY_WORLD_EN.personal.map((o) => {
        const m = mappedPersonal.find((p) => p.id === o.id);
        return m ? { ...o, title: m.title, subtitle: m.subtitle } : o;
      }),
      mappedPersonal.filter((o) => !ORB_DATA_BY_WORLD_EN.personal.some((c) => c.id === o.id))
    );
  }
  const originEn = catalogEn.find((o) => o.id === 'origin');
  const head = [originEn ?? { id: 'origin', emoji: '👤', title: 'Home', subtitle: '' }];
  const user = userOrbsForWorld(true);
  if (!includeCatalogExamples) return [...head, ...user];
  const examples = catalogExamplesForWorld().filter((o) => !user.some((u) => u.id === o.id));
  return [...head, ...mergeById(examples, user)];
}

/** פרופיל + יחידות דמו לבדיקות — וריאציה דטרמיניסטית לפי זמן (מדמה «יצירה אוטומטית») */
function generateAiSyntheticProfile(language: AppLanguage): { personalOrbs: OrbItem[]; flowUnits: FlowUnit[] } {
  const catalog = language === 'he' ? ORB_DATA_BY_WORLD : ORB_DATA_BY_WORLD_EN;
  const personal = [...(catalog.personal ?? [])];
  const salt = Date.now();
  const flowUnits: FlowUnit[] = [];
  const syntheticOrbs: OrbItem[] = [];
  const lensWorlds = ['business', 'health', 'finance', 'knowledge', 'leisure', 'relations'] as const;
  lensWorlds.forEach((wid, wi) => {
    const rows = (catalog[wid] ?? []).filter((o) => o.id !== 'origin');
    const pickCount = 1 + (wi % 2);
    rows.slice(0, pickCount).forEach((orb, j) => {
      const id = `syn_${wid}_${j}_${salt}`;
      const he = language === 'he';
      const { spaceId: _sp, domainId: _dm } = legacyWorldIdToSpaceDomain(wid);
      flowUnits.push({
        id,
        spaceId: _sp,
        domainId: _dm,
        worldId: wid,
        title: orb.title,
        subtitle: orb.subtitle,
        emoji: orb.emoji,
        status: 'active',
        progress: 12 + ((wi * 7 + j * 3 + salt) % 40),
        steps: 10 + j * 2,
        messages: [
          {
            id: `m_${id}`,
            sender: 'one',
            text: he
              ? `יחידת דוגמה שנוצרה אוטומטית — פרופיל משתמש פוטנציאלי לבדיקת ממשק.`
              : `Auto-generated demo unit — synthetic potential-user profile for UI testing.`,
            sentAt: Date.now(),
          },
        ],
        goal: orb.subtitle,
        nextAction: he ? 'צעד הבא לדוגמה' : 'Sample next step',
        peopleRoles: [
          { id: 'p1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
          { id: 'p2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
        ],
        lastUpdatedLabel: he ? 'נוצר בגנרטור' : 'Generated',
        blockCount: 4,
      });
      syntheticOrbs.push({ id, emoji: orb.emoji, title: orb.title, subtitle: orb.subtitle });
    });
  });
  return { personalOrbs: [...personal, ...syntheticOrbs], flowUnits };
}

function generateBusinessWorkspaceSeed(language: AppLanguage): { personalOrbs: OrbItem[]; flowUnits: FlowUnit[] } {
  const catalog = language === 'he' ? ORB_DATA_BY_WORLD : ORB_DATA_BY_WORLD_EN;
  const he = language === 'he';
  const businessRoot = [...(catalog.business ?? [{ id: 'origin', emoji: '🏢', title: he ? 'סקירת עסק' : 'Business overview', subtitle: '' }])];
  const worldIds: Array<'clients' | 'marketing' | 'sales' | 'operations' | 'finance' | 'team'> = [
    'clients',
    'marketing',
    'sales',
    'operations',
    'finance',
    'team',
  ];
  const flowUnits: FlowUnit[] = [];
  const orbs: OrbItem[] = [...businessRoot];
  worldIds.forEach((wid, wi) => {
    const rows = (catalog[wid] ?? []).filter((o) => o.id !== 'origin').slice(0, 2);
    rows.forEach((orb, j) => {
      const id = `biz_seed_${wid}_${j}`;
      const { spaceId: _bsp, domainId: _bdm } = legacyWorldIdToSpaceDomain(wid);
      flowUnits.push({
        id,
        spaceId: _bsp,
        domainId: _bdm,
        worldId: wid,
        title: orb.title,
        subtitle: orb.subtitle,
        emoji: orb.emoji,
        status: 'active',
        progress: 18 + wi * 7 + j * 6,
        steps: 10 + wi + j,
        messages: [
          {
            id: `seed_msg_${id}`,
            sender: 'one',
            text: he
              ? `יחידת עסק לדוגמה נוצרה כדי שתוכל לראות תפעול אמיתי במוצר.`
              : `Business demo unit created so you can simulate real operations in-product.`,
            sentAt: Date.now(),
          },
        ],
        goal: orb.subtitle,
        nextAction: he ? 'לעדכן סטטוס יומי ולהתקדם לצעד הבא' : 'Update daily status and move to the next step',
        peopleRoles: [
          { id: `owner_${id}`, role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
          { id: `agent_${id}`, role: he ? 'סוכן' : 'Agent', name: 'ONE' },
        ],
        lastUpdatedLabel: he ? 'נזרע במרחב עסקי' : 'Seeded in business workspace',
        blockCount: 5,
      });
      orbs.push({ id, emoji: orb.emoji, title: orb.title, subtitle: orb.subtitle });
    });
  });
  return { personalOrbs: orbs, flowUnits };
}

function inferWorldForIntent(intentRaw: string, fallbackWorldId: string): string {
  const t = intentRaw.toLowerCase();
  if (/(לקוח|לקוחות|לקוחה|crm|onboard|retention|support|sla|customer|client|churn)/.test(t)) return 'clients';
  if (/(שיווק|קמפיין|מודעה|ads|meta|google ads|seo|content|funnel|landing)/.test(t)) return 'marketing';
  if (/(מכירה|מכירות|ליד|לידים|quote|proposal|deal|close|pipeline|follow[- ]?up)/.test(t)) return 'sales';
  if (/(תפעול|ops|inventory|procurement|logistics|אספקה|איכות|qa|sop)/.test(t)) return 'operations';
  if (/(עובד|עובדים|גיוס|ראיון|hr|hire|hiring|team|culture|training)/.test(t)) return 'team';
  if (/(לקוח|לקוחות|מכירה|מכירות|עסק|עסקי|invoice|crm|lead|sales|client|quote)/.test(t)) return 'business';
  if (/(כסף|תזרים|חשבונית|גביה|מס|השקעה|finance|cash|payment|tax|invoice)/.test(t)) return 'finance';
  if (/(בריאות|רופא|בדיקה|תרופה|health|doctor|medic|clinic)/.test(t)) return 'health';
  if (/(לימוד|מבחן|קורס|למידה|study|learn|course|exam)/.test(t)) return 'knowledge';
  if (/(זוג|משפחה|חבר|relationship|family|friend)/.test(t)) return 'relations';
  return fallbackWorldId;
}

/** תשובת סוכן בצ׳אט יחידה — בלי עדכון הורה בתוך עדכון state אחר */
function buildAgentUnitChatReply(unit: FlowUnit, userNote: string, language: AppLanguage): string {
  const clip = userNote.trim().slice(0, 220);
  const he = language === 'he';
  const na = unit.nextAction?.trim() || (he ? 'לא הוגדר' : 'not set');
  const goalHint =
    !unit.goal || unit.goal.length < 12
      ? he
        ? 'חדדו את המטרה במשפט אחד. '
        : 'State the goal in one clear sentence. '
      : '';
  if (he) {
    return (
      `שמרתי ב־«${unit.title}»: ${clip || 'עדכון'}\n\n` +
      `${goalHint}הצעד הבא בפרופיל: «${na}».\n` +
      `כתבו במפורש מה לשנות ביעד, בצעד הבא, בחסם או בתאריך יעד — אמשיך לעדכן את השיחה ואת פרופיל היחידה כאן.`
    );
  }
  return (
    `Saved under «${unit.title}»: ${clip || 'update'}\n\n` +
    `${goalHint}Next step on the profile: «${na}».\n` +
    `Spell out changes to goal, next step, blocker, or target date — I will keep the thread and unit profile aligned here.`
  );
}

type GoalTemplate = {
  title: string;
  /** @deprecated use spaceId + domainId */
  worldId: string;
  spaceId: SpaceId;
  domainId?: DomainId;
  emoji: string;
  subtitle: string;
  slots: UnitProfileSlot[];
  steps: number;
  /** מפתח יציב לאגרגט גלובלי אנונימי */
  publicSignalKey: string;
  publicSignalLabelHe: string;
  publicSignalLabelEn: string;
};

const EMPTY_GLOBAL_SIGNALS: { key: string; labelHe: string; labelEn: string; count: number }[] = [];

function recordGoalTemplatePublicSignal(tmpl: GoalTemplate): void {
  useGlobalIntentSignalsStore.getState().recordUnitIntent(
    tmpl.worldId,
    tmpl.publicSignalKey,
    tmpl.publicSignalLabelHe,
    tmpl.publicSignalLabelEn
  );
}

type GoalTemplateBase = Omit<GoalTemplate, 'spaceId' | 'domainId'>;

function goalTemplateFromText(goal: string, language: AppLanguage, fallbackWorld: string): GoalTemplate {
  const base = _goalTemplateCore(goal, language, fallbackWorld);
  const { spaceId, domainId } = legacyWorldIdToSpaceDomain(base.worldId);
  return { ...base, spaceId, domainId };
}

function _goalTemplateCore(goal: string, language: AppLanguage, fallbackWorld: string): GoalTemplateBase {
  const g = goal.toLowerCase();
  const he = language === 'he';
  const trimTitle = goal.trim().slice(0, 28);
  if (/(רדת|משקל|דיאטה|diet|lose weight|weight loss|lbs|קילו|kg\b|נשמן|רזון)/.test(g)) {
    return {
      title: trimTitle || (he ? 'לרדת במשקל' : 'Lose weight'),
      worldId: 'health',
      emoji: '⚖️',
      subtitle: he ? 'מעקב משקל, גיל ויעד' : 'Weight, age & target tracking',
      slots: he
        ? [
            { id: 'age', label: 'גיל (בשנים)' },
            { id: 'weight_current', label: 'משקל נוכחי (ק״ג)' },
            { id: 'weight_target', label: 'משקל יעד (ק״ג)' },
            { id: 'constraints', label: 'מגבלות רפואיות / מה חשוב שנדע', optional: true },
          ]
        : [
            { id: 'age', label: 'Age (years)' },
            { id: 'weight_current', label: 'Current weight (kg)' },
            { id: 'weight_target', label: 'Target weight (kg)' },
            { id: 'constraints', label: 'Medical notes / constraints', optional: true },
          ],
      steps: 12,
      publicSignalKey: 'intent_weight_loss',
      publicSignalLabelHe: 'ירידה במשקל',
      publicSignalLabelEn: 'Losing weight',
    };
  }
  if (/(רישיון|נהיגה|license|driving)/.test(g)) {
    return {
      title: he ? 'רישיון נהיגה' : "Driver's license",
      worldId: 'personal',
      emoji: '🚗',
      subtitle: he ? 'תיאוריה · שיעורים · מבחן' : 'Theory · lessons · exam',
      slots: he
        ? [
            { id: 'theory_done', label: 'מבחן תיאוריה (כן/לא)' },
            { id: 'lessons_done', label: 'כמה שיעורי נהיגה כבר עשית?' },
            { id: 'exam_target', label: 'תאריך יעד למבחן (אופציונלי)', optional: true },
          ]
        : [
            { id: 'theory_done', label: 'Theory exam done? (yes/no)' },
            { id: 'lessons_done', label: 'How many driving lessons completed?' },
            { id: 'exam_target', label: 'Target test date (optional)', optional: true },
          ],
      steps: 25,
      publicSignalKey: 'intent_drivers_license',
      publicSignalLabelHe: 'רישיון נהיגה',
      publicSignalLabelEn: "Driver's license",
    };
  }
  if (/(מבחן|למוד|בחינה|exam prep|study plan|course\b|לימוד)/.test(g)) {
    return {
      title: trimTitle || (he ? 'הכנה למבחן' : 'Exam prep'),
      worldId: 'knowledge',
      emoji: '📝',
      subtitle: he ? 'תוכנית למידה ומעקב' : 'Study plan & tracking',
      slots: he
        ? [
            { id: 'subject', label: 'נושא / קורס' },
            { id: 'exam_when', label: 'מתי המבחן (משוער)?' },
            { id: 'hours_week', label: 'כמה שעות בשבוע להשקיע?', optional: true },
          ]
        : [
            { id: 'subject', label: 'Subject / course' },
            { id: 'exam_when', label: 'When is the exam (estimate)?' },
            { id: 'hours_week', label: 'Hours per week?', optional: true },
          ],
      steps: 15,
      publicSignalKey: 'intent_exam_prep',
      publicSignalLabelHe: 'הכנה למבחן / לימודים',
      publicSignalLabelEn: 'Exam / study prep',
    };
  }
  if (/(עסק|לקוח|מכירות|business|startup|crm)/.test(g)) {
    return {
      title: trimTitle || (he ? 'יעד עסקי' : 'Business goal'),
      worldId: 'business',
      emoji: '💼',
      subtitle: he ? 'יעד, מדדים וצעדים' : 'Goals, metrics, steps',
      slots: he
        ? [
            { id: 'outcome', label: 'מה התוצר או המדד שמסמן הצלחה?' },
            { id: 'timeline', label: 'באיזה חלון זמן?' },
          ]
        : [
            { id: 'outcome', label: 'What outcome defines success?' },
            { id: 'timeline', label: 'What time window?' },
          ],
      steps: 14,
      publicSignalKey: 'intent_business_goal',
      publicSignalLabelHe: 'יעד עסקי / מכירות',
      publicSignalLabelEn: 'Business / sales goal',
    };
  }
  if (/(חיסכון|כסף|תקציב|save money|savings|finance\b)/.test(g)) {
    return {
      title: trimTitle || (he ? 'יעד כספי' : 'Money goal'),
      worldId: 'finance',
      emoji: '💸',
      subtitle: he ? 'יעד, סכום, לו״ז' : 'Target amount & timeline',
      slots: he
        ? [
            { id: 'amount', label: 'סכום יעד (בערך)' },
            { id: 'horizon', label: 'עד מתי?' },
          ]
        : [
            { id: 'amount', label: 'Target amount (approx.)' },
            { id: 'horizon', label: 'By when?' },
          ],
      steps: 12,
      publicSignalKey: 'intent_finance_goal',
      publicSignalLabelHe: 'יעד כספי / חיסכון',
      publicSignalLabelEn: 'Money / savings goal',
    };
  }
  const inferred = inferWorldForIntent(goal, fallbackWorld);
  return {
    title: trimTitle || (he ? 'יחידה חדשה' : 'New unit'),
    worldId: inferred,
    emoji: '🧩',
    subtitle: he ? 'נוצר מהמטרה שבחרת' : 'Created from your goal',
    slots: he
      ? [
          { id: 'clarify_goal', label: 'חדד את המטרה במשפט אחד' },
          { id: 'first_step', label: 'מה הצעד הקטן הראשון השבוע?' },
        ]
      : [
          { id: 'clarify_goal', label: 'Sharpen the goal in one sentence' },
          { id: 'first_step', label: 'First small step this week?' },
        ],
    steps: 10,
    publicSignalKey: `intent_${inferred}_custom`,
    publicSignalLabelHe: 'תהליך אישי חדש',
    publicSignalLabelEn: 'New personal process',
  };
}

function nextMissingSlot(slots: UnitProfileSlot[]): UnitProfileSlot | undefined {
  const req = slots.find((s) => !s.optional && !s.value?.trim());
  if (req) return req;
  return slots.find((s) => s.optional && !s.value?.trim());
}

function applyProfileSlotsFromMessage(unit: FlowUnit, text: string, language: AppLanguage): FlowUnit {
  const slots = (unit.profileSlots ?? []).map((s) => ({ ...s }));
  if (!slots.length) return unit;
  const t = text.trim();
  const he = language === 'he';
  const idx = slots.findIndex((s) => !s.value?.trim());
  if (idx < 0) return unit;
  const slot = slots[idx];
  const lower = t.toLowerCase();
  const numMatch = t.match(/-?\d+([.,]\d+)?/);
  const num = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : null;

  if (slot.id === 'theory_done') {
    if (/^(כן|yes|y|true|1|עבר)/i.test(lower)) slot.value = he ? 'כן' : 'Yes';
    else if (/^(לא|no|n|false|0)/i.test(lower)) slot.value = he ? 'לא' : 'No';
    else slot.value = t.slice(0, 48);
  } else if (
    slot.id === 'age' ||
    slot.id === 'weight_current' ||
    slot.id === 'weight_target' ||
    slot.id === 'lessons_done' ||
    slot.id === 'hours_week'
  ) {
    slot.value = num != null && !Number.isNaN(num) ? String(num) : t.slice(0, 48);
  } else {
    slot.value = t.slice(0, 120);
  }

  const required = slots.filter((s) => !s.optional);
  const filledReq = required.filter((s) => s.value?.trim()).length;
  const progress = Math.min(94, 10 + Math.round((filledReq / Math.max(required.length, 1)) * 72));
  const next = nextMissingSlot(slots);
  const nextAction = next
    ? he
      ? `למלא בפרופיל: ${next.label}`
      : `Fill in profile: ${next.label}`
    : he
      ? 'לסגור יעד שבועי או צעד מדידה הבא'
      : 'Set a weekly target or next check-in';

  let milestonesOut = unit.milestones;
  if (required.length > 0 && filledReq >= required.length) {
    const age = slots.find((s) => s.id === 'age')?.value;
    const wc = slots.find((s) => s.id === 'weight_current')?.value;
    const wt = slots.find((s) => s.id === 'weight_target')?.value;
    if (age && wc && wt) {
      milestonesOut = he
        ? [
            { id: 'mw1', title: 'מדידת התחלה + יעד שבועי קטן', done: true },
            { id: 'mw2', title: 'שגרת תזונה ופעילות ל־4 שבועות', done: false },
            { id: 'mw3', title: 'בדיקת ביניים מול משקל יעד', done: false },
            { id: 'mw4', title: 'ייצוב משקל ושמירה', done: false },
          ]
        : [
            { id: 'mw1', title: 'Baseline weigh-in + small weekly target', done: true },
            { id: 'mw2', title: 'Nutrition & movement habit (4 weeks)', done: false },
            { id: 'mw3', title: 'Mid-check vs target weight', done: false },
            { id: 'mw4', title: 'Stabilize and maintain', done: false },
          ];
    } else if (slots.some((s) => s.id === 'theory_done')) {
      milestonesOut = he
        ? [
            { id: 'ml1', title: 'תיאוריה / שיעורים לפי הסטטוס שמילאת', done: true },
            { id: 'ml2', title: 'תיאום מבחן מעשי', done: false },
            { id: 'ml3', title: 'מבחן וקבלת רישיון', done: false },
          ]
        : [
            { id: 'ml1', title: 'Theory / lessons per your status', done: true },
            { id: 'ml2', title: 'Schedule practical test', done: false },
            { id: 'ml3', title: 'Exam & license pickup', done: false },
          ];
    }
  }

  return {
    ...unit,
    profileSlots: slots,
    progress,
    nextAction,
    lastUpdatedLabel: he ? 'עודכן מהצ׳אט לפרופיל' : 'Profile updated from chat',
    milestones: milestonesOut,
  };
}

function findNewlyFilledSlotLabel(before: UnitProfileSlot[], after: UnitProfileSlot[]): string | undefined {
  for (let i = 0; i < after.length; i++) {
    if (!before[i]?.value?.trim() && after[i]?.value?.trim()) return after[i].label;
  }
  return undefined;
}

/** תשובה טבעית יותר: לא שאלה אחרי כל הודעה; מציע המשך רק כשמתאים */
function buildAdaptiveProfileReply(beforeUnit: FlowUnit, afterUnit: FlowUnit, userText: string, language: AppLanguage): string {
  const he = language === 'he';
  const slots = afterUnit.profileSlots ?? [];
  const beforeSlots = beforeUnit.profileSlots ?? [];
  const filledLabel = findNewlyFilledSlotLabel(beforeSlots, slots);
  const next = nextMissingSlot(slots);
  const userTurn = beforeUnit.messages.filter((m) => m.sender === 'user').length + 1;
  const requiredLeft = slots.filter((s) => !s.optional && !s.value?.trim()).length;

  const clip = userText.trim().slice(0, 180);
  const ack = filledLabel
    ? he
      ? `הבנתי. «${filledLabel}» נשמר בפרופיל היחידה.`
      : `Understood. «${filledLabel}» is saved on the unit profile.`
    : he
      ? 'קלטתי ושמרתי בפרופיל.'
      : 'Got it—saved to the unit profile.';

  if (requiredLeft === 0) {
    const opt = slots.find((s) => s.optional && !s.value?.trim());
    return he
      ? `${ack}\nהשדות המרכזיים מלאים — אפשר לבנות עכשיו תוכנית שבוע אחת קצרה (מדד אחד + פעולה אחת).${opt ? ` אם תרצה, בהמשך גם ${opt.label}.` : ''}`
      : `${ack}\nCore fields are set—we can shape one short weekly plan (one metric + one action).${opt ? ` Later we can add ${opt.label} if you want.` : ''}`;
  }

  if (clip.length > 80 || /[\n.]/.test(userText)) {
    return he
      ? `${ack}\n${next ? `כשיהיה לך נוח נשלים גם ${next.label} — רק אם זה רלוונטי לך עכשיו.` : 'כשתרצה נמשיך לחדד את התהליך.'}`
      : `${ack}\n${next ? `When it feels right we can finish ${next.label} too—only if it matters now.` : 'We can refine the flow whenever you want.'}`;
  }

  if (userTurn % 2 === 0 && next) {
    return he
      ? `${ack}\nאם תרצה בהמשך — ${next.label}.`
      : `${ack}\nWhenever you want next: ${next.label}.`;
  }

  if (next) {
    return he
      ? `${ack}\nכדי לסגור את התמונה בפרופיל — ${next.label}?`
      : `${ack}\nTo round out the profile—${next.label}?`;
  }

  return ack;
}

function lensToWorldId(lens: LifeLens): string {
  return lens;
}

function processToFlowUnit(p: OneProcess, language: AppLanguage): FlowUnit {
  const worldId = lensToWorldId(p.lens);
  const seed = `${p.fields?.goal ?? p.title} ${p.summary ?? ''}`;
  const tmpl = goalTemplateFromText(seed, language, worldId);
  recordGoalTemplatePublicSignal(tmpl);
  const resolvedSpaceId: SpaceId = p.spaceId ?? tmpl.spaceId;
  const resolvedDomainId: DomainId | undefined = p.domainId ?? tmpl.domainId;
  const firstEmpty = tmpl.slots.find((s) => !s.optional) ?? tmpl.slots[0];
  const he = language === 'he';
  const intro = he
    ? `אני ONE — מתחילים את «${tmpl.title}» אחרי ההרשמה.\n${p.summary ? `סיכום מה שכתבת: ${p.summary.slice(0, 200)}${p.summary.length > 200 ? '…' : ''}\n` : ''}נבנה כאן תהליך אמיתי: מה שתשלח נשמר בפרופיל היחידה (מספרים, תאריכים, סטטוסים) — לא רק בועות שמתפזרות.`
    : `I’m ONE—we’re starting “${tmpl.title}” after signup.\n${p.summary ? `What you wrote: ${p.summary.slice(0, 200)}${p.summary.length > 200 ? '…' : ''}\n` : ''}We will build a real flow here: what you send is stored on the unit profile, not only as chat bubbles.`;

  return {
    id: p.id,
    spaceId: resolvedSpaceId,
    domainId: resolvedDomainId,
    worldId: tmpl.worldId,
    title: tmpl.title,
    subtitle: tmpl.subtitle,
    emoji: tmpl.emoji,
    status: p.status,
    progress: 14,
    steps: tmpl.steps,
    profileSlots: tmpl.slots.map((s) => ({ ...s })),
    messages: [
      {
        id: `reg_${p.id}`,
        sender: 'one',
        text:
          intro +
          (firstEmpty
            ? he
              ? `\n\nכשתרצה נשלים את ${firstEmpty.label} — או תכתוב בחופשיות ואזין לפרופיל.`
              : `\n\nWhen you want we will complete ${firstEmpty.label}—or write freely and I will map it to the profile.`
            : ''),
        sentAt: Date.now(),
      },
    ],
    goal: p.fields?.goal ?? (he ? `להגשים: ${p.title}` : `Achieve: ${p.title}`),
    city: he ? 'לא צוין' : 'Not set',
    etaWeeks: 8,
    peopleRoles: [
      { id: 'p1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
      { id: 'p2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
    ],
    nextAction: firstEmpty ? (he ? `פרופיל: ${firstEmpty.label}` : `Profile: ${firstEmpty.label}`) : undefined,
    lastUpdatedLabel: he ? 'נוצר מהרשמה' : 'Created from signup',
    blockCount: 5,
  };
}

function buildAgentGoalPromptMessage(language: AppLanguage, worldId: string): string {
  const he = language === 'he';
  const w = worldTitle(worldId, language);
  if (he) {
    return `מה ברצונך להגשים?\nבחרו דוגמה למטה או כתבו בשורת המקלדת — ניצור יחידה, נעבור לכדור שלה בבית, ואמשיך לשאול כאן ולמלא את הפרופיל (הנתונים נשמרים שם, לא רק בבועות). מרחב נוכחי: ${w}.`;
  }
  return `What do you want to achieve?\nPick an example below or type in the keyboard — we will create a unit, jump to its orb at home, and continue here while your profile fills in (data lives on the profile, not only in bubbles). Current space: ${w}.`;
}

function creationGoalChipsForWorld(worldId: string, language: AppLanguage): string[] {
  const he = language === 'he';
  if (worldId === 'health') {
    return he
      ? ['לרדת במשקל', 'מעקב שינה', 'תור לרופא']
      : ['Lose weight', 'Sleep tracking', 'Doctor visit'];
  }
  if (worldId === 'knowledge') {
    return he ? ['הכנה למבחן', 'קורס מקצועי', 'תוכנית למידה'] : ['Exam prep', 'Professional course', 'Study plan'];
  }
  if (worldId === 'business') {
    return he ? ['לסגור 3 לקוחות', 'הקמת עסק', 'מעקב משימות'] : ['Close 3 clients', 'Start a business', 'Task tracking'];
  }
  if (worldId === 'finance') {
    return he ? ['חיסכון לרכב', 'החזר מס', 'יעד חודשי'] : ['Save for a car', 'Tax refund', 'Monthly target'];
  }
  if (worldId === 'relations') {
    return he ? ['יום הולדת במשפחה', 'פגישה עם חברים', 'מעקב קשרים'] : ['Family birthday', 'Friends meet-up', 'Relationship check-ins'];
  }
  if (worldId === 'leisure') {
    return he ? ['ערב קולנוע', 'טיול סופ״ש', 'רשימת ציוד'] : ['Movie night', 'Weekend trip', 'Gear checklist'];
  }
  return he
    ? ['לרדת במשקל', 'רישיון נהיגה', 'הכנה למבחן', 'יעד כספי', 'משהו אחר — אכתוב למטה']
    : ['Lose weight', "Driver's license", 'Exam prep', 'Money goal', 'Something else — I will type'];
}

const DEV_PROFILE_PRESETS: Record<DevPreviewProfile, { personalOrbs: OrbItem[]; flowUnits: FlowUnit[]; planTier: 'FREE' | 'PRO' | 'MAX' }> = {
  new_user: {
    personalOrbs: [{ id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' }],
    flowUnits: [],
    planTier: 'FREE',
  },
  consumer: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'license', emoji: '🚗', title: 'רישיון נהיגה', subtitle: 'תיאוריה, שיעורים, מבחן' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  student: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'study_plan', emoji: '📚', title: 'תוכנית למידה', subtitle: 'נושאים, תרגול, מבחן' },
      { id: 'exam', emoji: '📝', title: 'הכנה למבחן', subtitle: 'סילבוס, תרגול, חזרות' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  creator: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'content', emoji: '🎬', title: 'הפקת תוכן', subtitle: 'רעיון, צילום, עריכה' },
      { id: 'launch', emoji: '🚀', title: 'השקה', subtitle: 'עמוד נחיתה, פרסום, מדידה' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  teacher_business: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'class_plan', emoji: '👩‍🏫', title: 'מערך שיעור', subtitle: 'מבנה, משימות, משוב' },
      { id: 'business_ops', emoji: '💼', title: 'תפעול עסק', subtitle: 'לקוחות, גביה, מעקב' },
    ],
    flowUnits: [],
    planTier: 'PRO',
  },
  pro_user: {
    personalOrbs: ORB_DATA_BY_WORLD.personal,
    flowUnits: [],
    planTier: 'PRO',
  },
  max_user: {
    personalOrbs: ORB_DATA_BY_WORLD.personal,
    flowUnits: [],
    planTier: 'MAX',
  },
};

const BUSINESS_ACCOUNT_ORBS_HE: OrbItem[] = [
  { id: 'origin', emoji: '🏢', title: 'חשבון עסקי', subtitle: '' },
  { id: 'sales_pipeline', emoji: '🎯', title: 'צינור מכירות', subtitle: 'לידים, הצעות, סגירות' },
  { id: 'ops_board', emoji: '🗂️', title: 'לוח תפעול', subtitle: 'משימות, SLA, בקרה יומית' },
  { id: 'cashflow', emoji: '💸', title: 'תזרים עסקי', subtitle: 'גבייה, תשלומים, תחזית' },
];

const BUSINESS_ACCOUNT_ORBS_EN: OrbItem[] = [
  { id: 'origin', emoji: '🏢', title: 'Business account', subtitle: '' },
  { id: 'sales_pipeline', emoji: '🎯', title: 'Sales pipeline', subtitle: 'Leads, quotes, closures' },
  { id: 'ops_board', emoji: '🗂️', title: 'Ops board', subtitle: 'Tasks, SLA, daily control' },
  { id: 'cashflow', emoji: '💸', title: 'Business cashflow', subtitle: 'Collections, payments, forecast' },
];

function businessAccountOrbs(language: AppLanguage): OrbItem[] {
  return language === 'he' ? BUSINESS_ACCOUNT_ORBS_HE : BUSINESS_ACCOUNT_ORBS_EN;
}

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
/** היסט אנימטיבי של פרצוף הסוכן/איקון העולם בתוך הכדור; במרכז בלבד — הרמה נוספת כדי שלא ייחתך כשהכדור קטן */
const WHEEL_AGENT_FACE_BASE_TRANSLATE_Y = -10;
const WHEEL_AGENT_FACE_EXTRA_LIFT_WHEN_CENTERED_PX = 30;
/** כשכדור הסוכן במרכז — הגדלת קוטר מעט כדי שהפרצוף ייראה טוב */
const WHEEL_AGENT_CENTER_ORB_EXTRA_PX = 18;
/** ברודקאסט כדור סוכן — היסט אנכי לכותרת ראשית (שם עולם / ברכה); שלילי = למעלה, חיובי = למטה */
const WHEEL_AGENT_BROADCAST_PRIMARY_TITLE_OFFSET_Y = 0;
/** מרווח מעל כותרת משנית — רק בכדור סוכן (יחידות נשארות marginTop מה־StyleSheet) */
const WHEEL_AGENT_BROADCAST_SUBTITLE_MARGIN_TOP = 8;

function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/.{2}/g);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** אייקון פלוס מ־assets/icons/plus-icon.svg (viewBox 0 0 46 46) */
function PlusIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <Path
        d="M25.6758 25.7412V33.7921C25.6758 34.4054 25.4611 34.9268 25.0317 35.3562C24.6025 35.7857 24.0811 36.0004 23.4675 36.0004C22.8539 36.0004 22.3325 35.7857 21.9033 35.3562C21.4739 34.9268 21.2592 34.4054 21.2592 33.7921V25.7412H13.2083C12.595 25.7412 12.0736 25.5265 11.6442 25.0971C11.2147 24.6679 11 24.1465 11 23.5329C11 22.9193 11.2147 22.3979 11.6442 21.9687C12.0736 21.5393 12.595 21.3246 13.2083 21.3246H21.2592V13.2737C21.2592 12.6604 21.4739 12.139 21.9033 11.7096C22.3325 11.2801 22.8539 11.0654 23.4675 11.0654C24.0811 11.0654 24.6025 11.2801 25.0317 11.7096C25.4611 12.139 25.6758 12.6604 25.6758 13.2737V21.3246H33.7267C34.34 21.3246 34.8614 21.5393 35.2908 21.9687C35.7203 22.3979 35.935 22.9193 35.935 23.5329C35.935 24.1465 35.7203 24.6679 35.2908 25.0971C34.8614 25.5265 34.34 25.7412 33.7267 25.7412H25.6758Z"
        fill={color}
        stroke={color}
        strokeWidth={1.42857}
      />
    </Svg>
  );
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

/**
 * ב־react-native-web, `direction: 'ltr'` על שורת הקומפוזר לא תמיד מבטל את ציר flex של הורה `rtl`;
 * הופכים את סדר ה־DOM רק בווב+עברית כדי שפלוס הצירוף יישאר משמאל וכפתור הפרופיל מימין.
 */
function orderChatComposerRowWebRtl(
  isWebRtl: boolean,
  plus: React.ReactElement,
  bar: React.ReactElement,
  profile: React.ReactElement | null
): React.ReactNode {
  if (isWebRtl) {
    return (
      <>
        {profile}
        {bar}
        {plus}
      </>
    );
  }
  return (
    <>
      {plus}
      {bar}
      {profile}
    </>
  );
}

function VoiceTrayButton({
  label,
  onPress,
  active = false,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.voiceTrayBtn, active && styles.voiceTrayBtnActive]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={[styles.voiceTrayBtnLabel, active && styles.voiceTrayBtnLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** גובה נוסף מעבר ל-safe area – שטח תפריט מורחב כלפי מרכז המסך */
const BAR_EXTRA = 96;
/** גובה מסילת ה־fade ב־assets/icons/fading-bg.svg — גלובל משתמש באותה לוגיקה (LinearGradient) */
const GLOBAL_FADING_BG_STRIP_PX = 88;
/** הרמת bottom bar + כפתור X בגלובל מעל קצה המסך */
const GLOBAL_BOTTOM_CHROME_LIFT_PX = 36;
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
  titleProgressPct,
  titleProgressColor,
  titleProgressTrackColor,
  onBroadcastLoopComplete,
  onBroadcastLoopBackwardComplete,
  /** כל עלייה (מההורה) = טאפ על הכדור הממורכז — קידום ברודקאסט צעד אחד */
  advanceRequest,
  /** טאפ על חצי שמאל — הודעה קודמת; מההודעה הראשונה — מעבר עולם/כדור (אם הוגדר) */
  backwardRequest,
  titleTextAlign,
  subtitleTextAlign,
  /** כיוון כתיבה לטקסט — חובה בעברית כשהשורש `direction: rtl` כדי שלא יתהפכו תווים מול `textAlign` */
  writingDirection,
  /** תיבת טקסט ברוחב מלא כדי שיישור ימין ייושר לקצה המסך */
  fullWidthCopy,
  primaryTitleOffsetY,
  subtitleMarginTop,
}: {
  messages: BroadcastMessage[];
  visible: boolean;
  titleColor: string;
  subtitleColor: string;
  /** כשמוגדר: כותרת קבועה (לא מתחלפת), רק המשנה מתחלפת */
  fixedTitle?: string;
  /** פס התקדמות קטן מתחת לכותרת הראשית (לכדור יחידה) */
  titleProgressPct?: number | null;
  titleProgressColor?: string;
  titleProgressTrackColor?: string;
  /** אחרי הצגת כל ההודעות וחזרה לראשית – למשל מעבר לעולם הבא בכדור הסוכן */
  onBroadcastLoopComplete?: () => void;
  onBroadcastLoopBackwardComplete?: () => void;
  advanceRequest?: number;
  backwardRequest?: number;
  titleTextAlign?: 'left' | 'right' | 'center';
  subtitleTextAlign?: 'left' | 'right' | 'center';
  writingDirection?: 'rtl' | 'ltr';
  fullWidthCopy?: boolean;
  primaryTitleOffsetY?: number;
  /** כשמוגדר — מרווח מעל כותרת משנית; כשלא — משתמשים ב־marginTop מ־wheelOrbSubtitle (כדורי יחידה) */
  subtitleMarginTop?: number;
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const loopCompleteRef = useRef(onBroadcastLoopComplete);
  loopCompleteRef.current = onBroadcastLoopComplete;
  const loopBackwardRef = useRef(onBroadcastLoopBackwardComplete);
  loopBackwardRef.current = onBroadcastLoopBackwardComplete;
  const lastAdvanceReqRef = useRef(0);
  const lastBackwardReqRef = useRef(0);
  /** תוכן ההודעות — לא זהות מערך (ההורה מעביר מערך חדש מ־broadcastMessagesForOrbItem בכל רינדור) */
  const broadcastFingerprint = messages.map((m) => `${m.type}\0${m.body}`).join('\x1e');

  useEffect(() => {
    setMsgIndex(0);
    opacity.setValue(1);
    lastAdvanceReqRef.current = 0;
    lastBackwardReqRef.current = 0;
  }, [broadcastFingerprint, opacity]);

  useEffect(() => {
    if (visible) opacity.setValue(1);
  }, [visible, opacity]);

  /** טאפ על הכדור הממורכז — מקדם ברודקאסט מיד (ללא המתנה לטיימר) */
  useEffect(() => {
    if (advanceRequest == null) return;
    if (advanceRequest <= lastAdvanceReqRef.current) return;
    lastAdvanceReqRef.current = advanceRequest;
    if (!visible || messages.length === 0) return;
    const n = messages.length;
    setMsgIndex((i) => {
      const next = (i + 1) % n;
      /** הודעה אחת בעולם — כל טאפ קדימה = סוף המחזור → מעבר עולם */
      if (n === 1) {
        queueMicrotask(() => loopCompleteRef.current?.());
        return 0;
      }
      if (i === n - 1) {
        queueMicrotask(() => loopCompleteRef.current?.());
      }
      return next;
    });
  }, [advanceRequest, visible, messages.length]);

  useEffect(() => {
    if (backwardRequest == null) return;
    if (backwardRequest <= lastBackwardReqRef.current) return;
    lastBackwardReqRef.current = backwardRequest;
    if (!visible || messages.length === 0) return;
    const n = messages.length;
    setMsgIndex((i) => {
      const goPrevWorld = loopBackwardRef.current;
      if (i === 0 && goPrevWorld) {
        queueMicrotask(() => goPrevWorld());
        return 0;
      }
      return (i + n - 1) % n;
    });
  }, [backwardRequest, visible, messages.length]);

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
          /** טיימר אוטומטי: מעבר עולם רק כשיש יותר מהודעה אחת וסיימנו את האחרונה */
          if (n > 1 && i === n - 1) {
            queueMicrotask(() => loopCompleteRef.current?.());
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
  const wdStyle = writingDirection != null ? { writingDirection } : null;
  const fullWidthText = fullWidthCopy ? ({ width: '100%' as const, alignSelf: 'stretch' as const } as const) : null;
  const inner = (
    <>
      <Text
        style={[
          styles.wheelOrbTitle,
          { color: titleColor, marginTop: 10 + (primaryTitleOffsetY ?? 0) },
          titleTextAlign != null ? { textAlign: titleTextAlign } : null,
          wdStyle,
          fullWidthText,
        ]}
        numberOfLines={1}
      >
        {fixedTitle ?? msg.type}
      </Text>
      {titleProgressPct != null ? (
        <View style={{ width: '100%', direction: 'ltr' }}>
          <View style={[styles.wheelOrbTitleProgressTrack, { backgroundColor: titleProgressTrackColor ?? 'rgba(127,127,127,0.25)' }]}>
            <View
              style={[
                styles.wheelOrbTitleProgressFill,
                { width: `${Math.max(6, titleProgressPct * 100)}%`, backgroundColor: titleProgressColor ?? '#22c55e' },
              ]}
            />
          </View>
        </View>
      ) : null}
      <Animated.View style={{ opacity }}>
        <Text
          style={[
            styles.wheelOrbSubtitle,
            { color: subtitleColor, ...(subtitleMarginTop != null ? { marginTop: subtitleMarginTop } : {}) },
            subtitleTextAlign != null ? { textAlign: subtitleTextAlign } : null,
            wdStyle,
            fullWidthText,
          ]}
          numberOfLines={2}
        >
          {msg.body}
        </Text>
      </Animated.View>
    </>
  );
  if (fullWidthCopy) {
    return <View style={{ width: '100%', alignSelf: 'stretch' }}>{inner}</View>;
  }
  return inner;
}

/** שקיפות משותפת לחצי רמז גלילה בגלגל הכדורים */
const ORB_WHEEL_SCROLL_HINT_ARROW_FILL_OPACITY = 0.38;

/** חץ מטה בסגנון קלף — מסובב מ־assets/icons/icon-arrow-(left).svg; רמז גלילה בכדור מתחת לסוכן */
function OrbScrollDownHintSvg({
  size,
  color,
  fillOpacity = ORB_WHEEL_SCROLL_HINT_ARROW_FILL_OPACITY,
}: {
  size: number;
  color: string;
  fillOpacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <G transform="rotate(-90 16 16)">
        <Path
          d="M23.6223 5.28353C24.3734 4.53238 24.3734 3.31452 23.6223 2.56337C22.8711 1.81221 21.6533 1.81221 20.9021 2.56337L8.56337 14.9021C7.81221 15.6533 7.81221 16.8711 8.56337 17.6223L20.9021 29.961C21.6533 30.7122 22.8711 30.7122 23.6223 29.961C24.3734 29.2099 24.3734 27.992 23.6223 27.2409L12.6436 16.2622L23.6223 5.28353Z"
          fill={color}
          fillOpacity={fillOpacity}
        />
      </G>
    </Svg>
  );
}

/** חץ למעלה — אותו path, סיבוב הפוך; רמז חזרה לכדור הסוכן */
function OrbScrollUpHintSvg({
  size,
  color,
  fillOpacity = ORB_WHEEL_SCROLL_HINT_ARROW_FILL_OPACITY,
}: {
  size: number;
  color: string;
  fillOpacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <G transform="rotate(90 16 16)">
        <Path
          d="M23.6223 5.28353C24.3734 4.53238 24.3734 3.31452 23.6223 2.56337C22.8711 1.81221 21.6533 1.81221 20.9021 2.56337L8.56337 14.9021C7.81221 15.6533 7.81221 16.8711 8.56337 17.6223L20.9021 29.961C21.6533 30.7122 22.8711 30.7122 23.6223 29.961C24.3734 29.2099 24.3734 27.992 23.6223 27.2409L12.6436 16.2622L23.6223 5.28353Z"
          fill={color}
          fillOpacity={fillOpacity}
        />
      </G>
    </Svg>
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

/** אייקון בריאות — assets/icons/Health-icon.svg */
function HealthIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M19.2477 8.46421C19.8478 7.8641 20.0607 6.94217 20.1337 6.27442C20.1669 5.97002 20.175 5.68795 20.1724 5.4566C19.377 5.44683 17.9849 5.56096 17.1647 6.38121C16.5646 6.98132 16.3517 7.90325 16.2788 8.571C16.2707 8.64514 16.2641 8.71794 16.2588 8.789C16.2618 9.00944 16.2585 9.21131 16.252 9.38892C17.0487 9.39691 18.4315 9.28039 19.2477 8.46421Z"
        fill={color}
      />
      <Path
        d="M12.384 9.22141C12.7055 9.26459 13.0166 9.31243 13.3133 9.35947C13.8772 9.41371 14.3836 9.41301 14.7508 9.39808C14.749 9.21556 14.753 9.00887 14.7671 8.78541C14.748 7.54415 14.5056 5.62957 13.3222 4.44607C11.9195 3.04343 9.48932 2.96279 8.37048 3.00914C8.32413 4.12723 8.40447 6.55781 9.80751 7.9608C10.5074 8.6607 11.463 9.0314 12.384 9.22141Z"
        fill={color}
      />
      <Path
        d="M25.0459 12.7654C24.3288 11.5138 23.3017 10.8317 21.8134 10.6188C20.4555 10.4247 18.9699 10.6623 17.6591 10.8721C16.831 11.0046 16.1157 11.119 15.5 11.119C14.8843 11.119 14.1691 11.0046 13.3409 10.8721C12.0301 10.6623 10.5444 10.4247 9.18659 10.6188C7.6983 10.8317 6.67116 11.5138 5.95409 12.7654C4.98189 14.4623 4.73153 17.2584 5.30068 20.0626C5.59862 21.5307 6.1171 22.9367 6.80014 24.1289C7.54982 25.4375 8.48386 26.4871 9.57615 27.2485C11.4914 28.5836 12.57 28.467 13.9352 28.3195C14.4215 28.2669 14.9243 28.2126 15.5 28.2126C16.0757 28.2126 16.5785 28.2669 17.0648 28.3195C18.43 28.467 19.5086 28.5836 21.4239 27.2485C22.5161 26.487 23.4502 25.4375 24.1999 24.1289C24.8829 22.9367 25.4014 21.5307 25.6993 20.0626C26.2685 17.2584 26.0181 14.4623 25.0459 12.7654Z"
        fill={color}
      />
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

/** אייקון קשרים — מבוסס על assets/icons/relations-icon.svg */
function RelationsIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M24.9043 18.6278C23.8799 19.8697 19.3745 23.5864 17.0312 25.4901C16.1972 26.17 15.0051 26.17 14.1711 25.4901C11.8278 23.5864 7.32691 19.8697 6.29802 18.6278C4.72975 16.7377 4 14.9382 4 12.9802C4 11.0674 4.65269 9.30878 5.84023 8.02153C7.04589 6.72068 8.69122 6 10.4816 6C11.8232 6 13.047 6.42606 14.1258 7.26006C14.6878 7.69972 15.1864 8.21643 15.5989 8.80113C16.0159 8.22096 16.5099 7.69972 17.072 7.26006C18.1507 6.42153 19.379 6 20.7207 6C22.5156 6 24.1609 6.72068 25.362 8.02153C26.545 9.30878 27.2023 11.0629 27.2023 12.9802C27.2068 14.9382 26.4771 16.7377 24.9043 18.6278Z"
        fill={color}
      />
    </Svg>
  );
}

/** אייקון פנאי — מבוסס על assets/icons/leisure-icon.svg */
function LeisureIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.75 5C21.683 5 26.5 9.817 26.5 15.75C26.5 21.683 21.683 26.5 15.75 26.5C9.817 26.5 5 21.683 5 15.75C5 9.817 9.817 5 15.75 5ZM10.25 16C9.836 16 9.5 16.336 9.5 16.75C9.5 20.199 12.301 23 15.75 23C19.199 23 22 20.199 22 16.75C22 16.336 21.664 16 21.25 16H10.25ZM18.701 13.35C18.993 13.13 19.356 13 19.75 13C20.144 13 20.507 13.13 20.799 13.35C21.13 13.599 21.601 13.532 21.85 13.201C22.098 12.87 22.032 12.4 21.701 12.151C21.157 11.742 20.482 11.5 19.75 11.5C19.018 11.5 18.343 11.742 17.799 12.151C17.468 12.4 17.402 12.87 17.65 13.201C17.899 13.532 18.37 13.599 18.701 13.35ZM10.701 13.35C10.993 13.13 11.356 13 11.75 13C12.144 13 12.507 13.13 12.799 13.35C13.13 13.599 13.601 13.532 13.85 13.201C14.098 12.87 14.032 12.4 13.701 12.151C13.157 11.742 12.482 11.5 11.75 11.5C11.018 11.5 10.343 11.742 9.799 12.151C9.468 12.4 9.402 12.87 9.65 13.201C9.899 13.532 10.37 13.599 10.701 13.35Z"
        fill={color}
      />
    </Svg>
  );
}

function KnowledgeIconSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path fillRule="evenodd" clipRule="evenodd" d="M10.716 9.84401L8.97601 8.10406C8.73569 7.86375 8.34633 7.86375 8.10602 8.10406C7.8657 8.34437 7.8657 8.73372 8.10602 8.97403L9.846 10.714C10.0863 10.9543 10.4757 10.9543 10.716 10.714C10.9563 10.4737 10.9563 10.0843 10.716 9.84401Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M8.11722 14.8848H5.61524C5.27518 14.8848 5 15.1599 5 15.5C5 15.84 5.27518 16.1152 5.61524 16.1152H8.11722C8.45728 16.1152 8.73246 15.84 8.73246 15.5C8.73246 15.1599 8.45728 14.8848 8.11722 14.8848Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M25.3868 14.8848H22.8848C22.5447 14.8848 22.2695 15.1599 22.2695 15.5C22.2695 15.84 22.5447 16.1152 22.8848 16.1152H25.3868C25.7268 16.1152 26.002 15.84 26.002 15.5C26.002 15.1599 25.7268 14.8848 25.3868 14.8848Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M22.8957 8.10406C22.6554 7.86375 22.266 7.86375 22.0257 8.10406L20.2857 9.84401C20.0454 10.0843 20.0454 10.4737 20.2857 10.714C20.526 10.9543 20.9154 10.9543 21.1557 10.714L22.8957 8.97403C23.136 8.73372 23.136 8.34441 22.8957 8.10406Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M15.502 5C15.1619 5 14.8867 5.27517 14.8867 5.61523V8.11715C14.8867 8.45721 15.1619 8.73239 15.502 8.73239C15.842 8.73239 16.1172 8.45721 16.1172 8.11715V5.61523C16.1172 5.27517 15.842 5 15.502 5Z" fill={color} />
      <Path d="M18.9444 11.1564C17.6032 10.0982 15.8682 9.7168 14.1701 10.1229C12.2014 10.5781 10.6141 12.1408 10.1342 14.0972C9.65428 16.0659 10.208 18.0592 11.623 19.4497C12.1275 19.9542 12.4229 20.7458 12.4229 21.5579V21.6932C12.4229 22.0377 12.6935 22.3085 13.0381 22.3085H17.96C18.3046 22.3085 18.5753 22.0377 18.5753 21.6932V21.5579C18.5753 20.758 18.8829 19.9419 19.4243 19.4127C20.458 18.3669 21.0363 16.9765 21.0363 15.4999C21.0363 13.8019 20.2733 12.2146 18.9444 11.1564ZM15.4988 13.6543C14.5706 13.6543 13.8949 14.2699 13.718 14.9827C13.6375 15.3068 13.3113 15.5137 12.9724 15.4321C12.6431 15.3504 12.4418 15.0163 12.5236 14.6871C12.8284 13.4566 13.9841 12.4238 15.4988 12.4238C15.8389 12.4238 16.114 12.699 16.114 13.039C16.114 13.3791 15.8389 13.6543 15.4988 13.6543Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M13.0391 23.5391V24.1543C13.0391 25.172 13.867 26 14.8848 26H16.1153C17.133 26 17.961 25.172 17.961 24.1543V23.5391H13.0391Z" fill={color} />
    </Svg>
  );
}

const WORLD_ICON_SIZE = 46;

const PERSONAL_WORLD_ICON_LIGHT_GRAY = '#737373';

function WorldMiniIcon({ worldId, color, size }: { worldId: string; color: string; size: number }) {
  const theme = useThemeStore((s) => s.theme);
  if (worldId === 'business') return <BusinessIconSvg size={size} color={color} />;
  if (worldId === 'health') return <HealthIconSvg size={size} color={color} />;
  if (worldId === 'finance') return <FinanceIconSvg size={size} color={color} />;
  if (worldId === 'knowledge') return <KnowledgeIconSvg size={size} color={color} />;
  if (worldId === 'leisure') return <LeisureIconSvg size={size} color={color} />;
  if (worldId === 'relations') return <RelationsIconSvg size={size} color={color} />;
  const personalGlyphColor =
    theme === 'light' && worldId === 'personal' ? PERSONAL_WORLD_ICON_LIGHT_GRAY : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={personalGlyphColor} strokeWidth={2} />
      <Circle cx={12} cy={12} r={3.2} fill={personalGlyphColor} />
    </Svg>
  );
}

function contactInitials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return t.slice(0, Math.min(2, t.length)).toUpperCase();
}

function filterUnitChatParticipants(roles: UnitProfilePerson[] | undefined): UnitProfilePerson[] {
  if (!roles?.length) return [];
  return roles.filter((p) => {
    const rawName = (p.name ?? '').trim();
    const name = rawName.toLowerCase();
    const role = (p.role ?? '').trim().toLowerCase();
    if (role === 'סוכן' || role === 'agent') {
      if (name === 'one') return false;
    }
    /** מציין משתמש בתכנון — לא "איש קשר" חיצוני; כפתור ההדר משתמש ב־add-contact-icon.svg */
    if (rawName === 'את/ה' || name === 'you') return false;
    return true;
  });
}

function UnitChatHeaderContacts({
  participants,
  ringColor,
  surfaceTint,
  textColor,
  language,
  onPress,
}: {
  participants: UnitProfilePerson[];
  ringColor: string;
  surfaceTint: string;
  textColor: string;
  language: 'he' | 'en';
  onPress: () => void;
}) {
  const addLabel = language === 'he' ? 'הוסף איש קשר' : 'Add contact';
  if (participants.length === 0) {
    return (
      <TouchableOpacity
        style={styles.chatUnitContactsSlot}
        activeOpacity={0.78}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
      >
        <AddContactIcon color={textColor} size={28} />
      </TouchableOpacity>
    );
  }
  const maxShown = 2;
  const useOverflowBadge = participants.length > maxShown;
  const faces = useOverflowBadge ? participants.slice(0, maxShown) : participants;
  const overflow = useOverflowBadge ? participants.length - maxShown : 0;
  const groupLabel =
    language === 'he'
      ? `${participants.length} אנשי קשר ביחידה`
      : `${participants.length} contacts in unit`;
  return (
    <TouchableOpacity
      style={styles.chatUnitContactsSlot}
      activeOpacity={0.82}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={groupLabel}
    >
      <View style={styles.chatUnitContactsStack}>
        {faces.map((p, i) => (
          <View
            key={p.id}
            style={[
              styles.chatUnitContactAvatar,
              {
                marginStart: i > 0 ? -10 : 0,
                zIndex: 20 - i,
                borderColor: ringColor,
                backgroundColor: surfaceTint,
              },
            ]}
          >
            <Text style={[styles.chatUnitContactInitials, { color: textColor }]}>{contactInitials(p.name)}</Text>
          </View>
        ))}
        {overflow > 0 ? (
          <View
            style={[
              styles.chatUnitContactAvatar,
              styles.chatUnitContactOverflow,
              { marginStart: -10, zIndex: 30, borderColor: ringColor, backgroundColor: surfaceTint },
            ]}
          >
            <Text style={[styles.chatUnitContactOverflowText, { color: textColor }]}>{`+${overflow}`}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
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
const COMPOSER_LINE_HEIGHT = 20;
const COMPOSER_MIN_LINES = 1;
const COMPOSER_MAX_LINES = 8;

function getTimeGreeting(hour: number, name: string, language: AppLanguage): string {
  if (language === 'en') {
    if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
    if (hour >= 12 && hour < 18) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  }
  if (hour >= 5 && hour < 12) return `בוקר טוב, ${name}`;
  if (hour >= 12 && hour < 18) return `צהריים טובים, ${name}`;
  return `ערב טוב, ${name}`;
}

function progressColorByPct(pct: number, isDark: boolean): string {
  if (pct < 0.15) return isDark ? '#71717a' : '#a1a1aa';
  if (pct < 0.4) return '#f97316';
  if (pct < 0.7) return '#eab308';
  return '#22c55e';
}

type Nav = NativeStackNavigationProp<AppShellParamList, 'Home'>;

export function OneScreen() {
  const { colors, theme } = useThemeStore();
  const language = useLocaleStore((s) => s.language);
  const layoutDirection = useLocaleStore((s) => s.layoutDirection);
  const previewProfile = useDevModeStore((s) => s.previewProfile);
  const showAllWorldsExamples = useDevModeStore((s) => s.showAllWorldsExamples);
  const syntheticHomeApplyNonce = useDevModeStore((s) => s.syntheticHomeApplyNonce);
  const isRtlLayout = layoutDirection === 'rtl';
  const chatMenuRows = useMemo(
    () => CHAT_MENU_ROWS.map((row) => ({ ...row, label: translate(language, row.labelKey) })),
    [language]
  );
  const [agentUnitCreationMode, setAgentUnitCreationMode] = useState(false);
  const pendingReopenUnitChatRef = useRef<string | null>(null);
  const nowPlaceholderPhrase = useMemo(() => (language === 'he' ? 'עכשיו?' : 'Now?'), [language]);
  /** צבע עדין ל־«עכשיו?» / Now? — בשכבת overlay וב־placeholder של השדה */
  const nowFieldPlaceholderColor = useMemo(
    () => hexToRgba(colors.textSecondary, 0.36),
    [colors.textSecondary]
  );
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

  /** גלובל בעברית: יישור ימין — כמו UnitChatProfile: מיכל LTR + textAlign/writingDirection על טקסט */
  const globalHebrewUi = language === 'he';
  /** כרטיס One בגלובל — רוחב כמו contentWrap + גובה דומה לשכבת oval בבית (לא ריבוע 400px) */
  const globalOnePlatterLayout = useMemo(() => {
    const w = contentWidth;
    const h = Math.max(Math.round(w * 1.02), Math.round(windowHeight * 0.38));
    return {
      width: w,
      minHeight: h,
      marginHorizontal: isNarrow ? -16 : 0,
      alignSelf: 'center' as const,
    };
  }, [contentWidth, windowHeight, isNarrow]);
  const [orbIndex, setOrbIndex] = useState(AGENT_ORB_INDEX);
  /** עולם נבחר (אישי / עסקים / בריאות / כלכלה) – דפדוף רק בכדור הסוכן */
  const [worldIndex, setWorldIndex] = useState(0);
  const worldIndexRef = useRef(worldIndex);
  const [agentWorldLookX, setAgentWorldLookX] = useState(0);
  const worldLookResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWorldLookIndexRef = useRef(worldIndex);
  useEffect(() => {
    worldIndexRef.current = worldIndex;
  }, [worldIndex]);
  useEffect(() => {
    const prev = prevWorldLookIndexRef.current;
    if (prev === worldIndex) return;
    const total = WORLDS.length;
    const forwardSteps = (worldIndex - prev + total) % total;
    const backwardSteps = (prev - worldIndex + total) % total;
    const dir = forwardSteps <= backwardSteps ? 1 : -1;
    setAgentWorldLookX(dir > 0 ? 2 : -2);
    if (worldLookResetTimerRef.current) clearTimeout(worldLookResetTimerRef.current);
    worldLookResetTimerRef.current = setTimeout(() => {
      setAgentWorldLookX(0);
    }, 460);
    prevWorldLookIndexRef.current = worldIndex;
  }, [worldIndex]);
  useEffect(
    () => () => {
      if (worldLookResetTimerRef.current) clearTimeout(worldLookResetTimerRef.current);
    },
    []
  );
  /** עולם לפני כניסה לגלובל — משחזרים ביציאה ב־X */
  const preGlobalWorldIndexRef = useRef(0);
  /** 0→1: נקודות הצד בכפתור ONE נצבעות בעולם; חזרה ל־0 — רק המרכז נשאר בולט */
  const worldDotsPulse = useRef(new Animated.Value(0)).current;
  const worldDotsPulseSkipMountRef = useRef(true);
  /** טאפ על כדור ממורכז — קידום ברודקאסט (סוכן) */
  const [agentBroadcastKick, setAgentBroadcastKick] = useState(0);
  /** טאפ על כדור יחידה ממורכז — קידום ברודקאסט לפי id */
  const [unitBroadcastKickByOrbId, setUnitBroadcastKickByOrbId] = useState<Record<string, number>>({});
  /** חצי שמאל באזור הברודקאסט — הודעה קודמת (סוכן / יחידה) */
  const [agentBroadcastBackwardKick, setAgentBroadcastBackwardKick] = useState(0);
  const [unitBroadcastBackwardByOrbId, setUnitBroadcastBackwardByOrbId] = useState<Record<string, number>>({});
  /** פעימת נקודת צד בכפתור ONE אחרי טאפ שמאל/ימין בברודקאסט */
  const [broadcastDotFlashSide, setBroadcastDotFlashSide] = useState<'left' | 'right' | null>(null);
  const broadcastDotFlashOpacity = useRef(new Animated.Value(0)).current;
  /** מסך אחד – מחליף מצבים: orb | card | global */
  const [viewMode, setViewMode] = useState<ViewMode>('orb');
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  const orbIndexForPullRef = useRef(0);
  useEffect(() => {
    orbIndexForPullRef.current = orbIndex;
  }, [orbIndex]);
  /** מניעת פתיחת גלובל כפולה (גלילה מוקדמת + סיום גלילה) */
  const globalWheelNavigateFromScrollRef = useRef(false);
  const overlaysBlockGlobalRef = useRef(false);
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
  const showAttachSheetRef = useRef(showAttachSheet);
  useEffect(() => {
    showAttachSheetRef.current = showAttachSheet;
  }, [showAttachSheet]);
  const [showAgentCard, setShowAgentCard] = useState(false);
  useEffect(() => {
    overlaysBlockGlobalRef.current =
      showChatSheet || showCredits || showAttachSheet || showAgentCard;
  }, [showChatSheet, showCredits, showAttachSheet, showAgentCard]);
  const [agentCardWorldIndex, setAgentCardWorldIndex] = useState(0);
  const [unitsBalance, setUnitsBalance] = useState(1800);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [nowValue, setNowValue] = useState('');
  const [chatComposerMeasuredHeight, setChatComposerMeasuredHeight] = useState(COMPOSER_LINE_HEIGHT);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [accountSpace, setAccountSpace] = useState<AccountSpace>('personal');
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const WORLDS = accountSpace === 'business' ? BUSINESS_WORLDS : PERSONAL_WORLDS;
  const [businessName, setBusinessName] = useState('Nova Studio');
  const [isVoiceTrayOpen, setIsVoiceTrayOpen] = useState(false);
  const [isMicHoldActive, setIsMicHoldActive] = useState(false);
  const [chatSheetMessages, setChatSheetMessages] = useState<ChatLine[]>([
    { id: 'seed_1', sender: 'one', text: 'שלום! ספר במשפט מה המטרה — ונמשיך משם.', sentAt: Date.now() },
  ]);
  const [personalOrbs, setPersonalOrbs] = useState<OrbItem[]>(DEV_PROFILE_PRESETS[previewProfile].personalOrbs);
  const [flowUnits, setFlowUnits] = useState<FlowUnit[]>(DEV_PROFILE_PRESETS[previewProfile].flowUnits);
  const activeHomeWorldIds = useMemo(() => {
    const primary = accountSpace === 'business' ? 'business' : 'personal';
    const openWorlds = new Set(
      flowUnits
        .filter((u) => u.status !== 'done')
        .map((u) => u.worldId)
        .filter((wid) => WORLDS.some((w) => w.id === wid))
    );
    return [primary, ...Array.from(openWorlds).filter((wid) => wid !== primary)];
  }, [flowUnits, accountSpace, WORLDS]);

  /** יחידות מהרשמה (OneProcess) → FlowUnit + כדור בגלגל — היחידה הראשונה מהצ׳אט בהרשמה */
  useEffect(() => {
    if (!user?.processes?.length) return;
    let created: FlowUnit[] = [];
    setFlowUnits((prev) => {
      const existing = new Set(prev.map((u) => u.id));
      created = user.processes.filter((p) => !existing.has(p.id)).map((p) => processToFlowUnit(p, language));
      if (!created.length) return prev;
      return [...created, ...prev];
    });
    setPersonalOrbs((prev) => {
      if (!created.length) return prev;
      const existing = new Set(prev.map((o) => o.id));
      const newOrbs: OrbItem[] = [];
      for (const fu of created) {
        if (existing.has(fu.id)) continue;
        newOrbs.push({ id: fu.id, emoji: fu.emoji, title: fu.title, subtitle: fu.subtitle });
      }
      if (!newOrbs.length) return prev;
      return insertPersonalOrbsAfterOrigin(prev, newOrbs);
    });
  }, [user?.id, user?.processes, language]);

  useEffect(() => {
    if (viewModeRef.current !== 'orb') return;
    const selected = WORLDS[worldIndex]?.id;
    if (selected && activeHomeWorldIds.includes(selected)) return;
    const fallbackId = activeHomeWorldIds[0] ?? (accountSpace === 'business' ? 'business' : 'personal');
    const wi = WORLDS.findIndex((w) => w.id === fallbackId);
    if (wi >= 0 && wi !== worldIndex) setWorldIndex(wi);
  }, [activeHomeWorldIds, worldIndex, accountSpace]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [chatProfileEditMode, setChatProfileEditMode] = useState(false);
  const [chatPinnedWorldId, setChatPinnedWorldId] = useState<string>('personal');
  /** צ׳אט סוכן: רשימת יחידות בהיסטוריה — מקופלת עד «פתח היסטוריה» */
  const [agentChatHistoryExpanded, setAgentChatHistoryExpanded] = useState(false);
  useEffect(() => {
    setAgentChatHistoryExpanded(false);
  }, [showChatSheet, chatPinnedWorldId]);
  useEffect(() => {
    if (activeUnitId) setAgentChatHistoryExpanded(false);
  }, [activeUnitId]);
  const [chatOpenedFromOrbProfileShortcut, setChatOpenedFromOrbProfileShortcut] = useState(false);
  /** בפרופיל יחידה: אחרי גלילה — כותרת ואימוג׳י מוצגים בסרגל העליון (כמו בצ׳אט) */
  const [chatProfileHeaderCompact, setChatProfileHeaderCompact] = useState(false);
  const chatProfileCompactScrollRef = useRef(false);
  /** תווית תאריך צפה (כמו iMessage) — מתעדכנת לפי גלילה */
  const [chatStickyDateLabel, setChatStickyDateLabel] = useState(() =>
    formatChatDayStickyLabel(Date.now(), language === 'he')
  );
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [creditsHistory, setCreditsHistory] = useState<{ id: string; label: string; time: string; change: number; icon: 'globe' | 'brand' | 'gift' | 'buy' }[]>([
    { id: '1', label: 'One Site', time: '5:01 PM', change: -650, icon: 'globe' },
    { id: '2', label: 'One Brand', time: '9:18 PM', change: -450, icon: 'brand' },
    { id: '3', label: 'New User Gift', time: 'Sunday', change: 101, icon: 'gift' },
  ]);
  const [splashDone, setSplashDone] = useState(false);
  const wheelStepLockRef = useRef(false);
  const wheelStepLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileQuickDragDeltaRef = useRef(0);
  const [mobileQuickDragActive, setMobileQuickDragActive] = useState(false);
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
  const chatMessageBubbleYRef = useRef<Map<string, number>>(new Map());
  const chatStickyLabelLastRef = useRef<string>('');
  const lastChatScrollYRef = useRef(0);
  const profilePullCloseTriggeredRef = useRef(false);
  const chatPullCloseTriggeredRef = useRef(false);
  const closeChatFromProfileOverscroll = useCallback(() => {
    // Close the whole chat sheet (agent/unit) when pulling beyond the top.
    closeChatSheetRef.current?.({ direction: 'down' });
  }, []);
  const closeChatFromChatOverscroll = useCallback(() => {
    closeChatSheetRef.current?.({ direction: 'down' });
  }, []);
  const homeNowInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const chatComposerInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  /** פתיחת צ׳אט ממיקוד בשדה — אחרי הלייאאוט מפעילים focus שוב כדי שהמקלדת תיפתח */
  const shouldRefocusComposerAfterChatOpenRef = useRef(false);
  /** מבטל timeouts של פתיחת צ׳אט (סגירה באמצע / unmount) */
  const chatOpenAnimGenerationRef = useRef(0);
  const micLongPressTriggeredRef = useRef(false);
  /** עד סיום שלב הקלף+המקלדת — לא מיישמים padding למקלדת על הקומפוזר */
  const suppressKeyboardForChatLayoutRef = useRef(false);
  const pendingKeyboardInsetRef = useRef(0);
  const closeChatSheetRef = useRef<
    (opts?: { gestureDx?: number; gestureDy?: number; direction?: 'side' | 'down'; afterClose?: () => void }) => void
  >(() => {});
  const lastHomeTapAtRef = useRef(0);
  const lastHomeTapYRef = useRef(0);
  /** רוחב אזור טאפ ברודקאסט לפי אינדקס פריט בגלגל — לחלוקת שמאל/ימין */
  const broadcastPadWidthByOrbRef = useRef<Record<number, number>>({});
  /** ref לכדור הסוכן בגלגל (פריט סוכן) – למדידת מיקום ל־Smart Animate */
  const wheelOrbRef = useRef<View>(null);
  const agentCardScrollRef = useRef<ScrollView>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusBarIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollYRef = useRef(0);
  /** מעבר חלק בין תווית העולם לאייקון Enter בכפתור הכדור; בחזרה ל־orb 0 מופיע מיד */
  const orbButtonLabelOpacity = useRef(new Animated.Value(1)).current;
  const orbButtonEnterOpacity = useRef(new Animated.Value(0)).current;
  const chatBackdropOpacity = useRef(new Animated.Value(0)).current;
  const chatSheetTranslateY = useRef(new Animated.Value(1200)).current;
  const chatSheetTranslateX = useRef(new Animated.Value(0)).current;
  /** פרופיל יחידה: החלקה לצד בחזרה לצ׳אט */
  const profileDismissSlideX = useRef(new Animated.Value(0)).current;
  /** פרופיל סוכן מצומצם: כפתור שדרג/תוכנית — מרחף מלמטה */
  const profileUpgradeFabTranslateY = useRef(new Animated.Value(96)).current;
  const profileUpgradeFabOpacity = useRef(new Animated.Value(0)).current;
  const chatComposerTranslateY = useRef(new Animated.Value(0)).current;
  /** כדורים שכנים (לא במרכז): fade מסונכרן עם שורת המצב בכדור יחידה */
  const peripheralOrbsOpacity = useRef(new Animated.Value(1)).current;
  const chatActionBreath = useRef(new Animated.Value(1)).current;
  /** כניסה לגלובל מוד — Animated רגיל (ללא moti/reanimated worklets) למניעת קריסה ב־iOS */
  const globalEnterOpacity = useRef(new Animated.Value(1)).current;
  const globalEnterTranslateY = useRef(new Animated.Value(0)).current;
  const currentWorldId = WORLDS[worldIndex]?.id ?? WORLDS[0]?.id ?? 'personal';
  const currentWorld = WORLDS[worldIndex] ?? WORLDS[0];
  const currentOrbData = useMemo(
    () =>
      localizedOrbDataForWorld(currentWorldId, personalOrbs, language, flowUnits, showAllWorldsExamples && accountSpace !== 'business'),
    [currentWorldId, personalOrbs, language, flowUnits, showAllWorldsExamples, accountSpace]
  );
  const globalWheelOrbItem = useMemo<OrbItem>(
    () => ({
      id: GLOBAL_WHEEL_ORB_ID,
      emoji: '🌐',
      title: language === 'he' ? 'גלובל' : 'Global',
      subtitle:
        language === 'he'
          ? 'מרקט גילוי — ספקים, מוצרים ואגרגט דאטה לסוכנים'
          : 'Market discovery — providers, products & aggregated signals',
    }),
    [language]
  );
  const wheelOrbData = useMemo(() => [globalWheelOrbItem, ...currentOrbData], [globalWheelOrbItem, currentOrbData]);
  const wheelOrbDataRef = useRef(wheelOrbData);
  useEffect(() => {
    wheelOrbDataRef.current = wheelOrbData;
  }, [wheelOrbData]);
  const currentWorldColor = WORLDS[worldIndex]?.color ?? WORLDS[0].color;
  /** צבע הבזק נקודות ברודקאסט: בעולמות = עולם נוכחי; בכדור יחידה = צבע העולם של היחידה */
  const broadcastDotFlashColor = useMemo(() => {
    if (orbIndex > AGENT_ORB_INDEX) {
      const row = wheelOrbData[orbIndex];
      if (!row || row.id === GLOBAL_WHEEL_ORB_ID) return currentWorldColor;
      const u = flowUnits.find((f) => f.id === row.id);
      const wid = u?.worldId ?? 'personal';
      return WORLDS.find((w) => w.id === wid)?.color ?? currentWorldColor;
    }
    return currentWorldColor;
  }, [orbIndex, wheelOrbData, flowUnits, currentWorldColor]);
  const worldSideDotPulseBg = useMemo(
    () =>
      worldDotsPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [hexToRgba(colors.textSecondary, 0.35), hexToRgba(currentWorldColor, 1)],
      }),
    [worldDotsPulse, colors.textSecondary, currentWorldColor]
  );
  useEffect(() => {
    if (worldDotsPulseSkipMountRef.current) {
      worldDotsPulseSkipMountRef.current = false;
      return;
    }
    worldDotsPulse.stopAnimation();
    worldDotsPulse.setValue(0);
    Animated.sequence([
      Animated.timing(worldDotsPulse, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.delay(200),
      Animated.timing(worldDotsPulse, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [worldIndex, worldDotsPulse]);

  const triggerBroadcastDotFlash = useCallback(
    (side: 'left' | 'right') => {
      setBroadcastDotFlashSide(side);
      broadcastDotFlashOpacity.stopAnimation();
      broadcastDotFlashOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(broadcastDotFlashOpacity, {
          toValue: 0.78,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.delay(540),
        Animated.timing(broadcastDotFlashOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start(({ finished }) => {
        if (finished) setBroadcastDotFlashSide(null);
      });
    },
    [broadcastDotFlashOpacity]
  );

  const globalIntentByWorld = useGlobalIntentSignalsStore((s) => s.byWorld);
  const globalBroadcastMessages = useMemo(
    () =>
      getGlobalBroadcastMessages(
        currentWorldId,
        language,
        globalIntentByWorld[currentWorldId] ?? EMPTY_GLOBAL_SIGNALS
      ),
    [currentWorldId, language, globalIntentByWorld]
  );
  const globalNewInOneTitle = useMemo(
    () => (language === 'he' ? 'גילוי בשוק' : 'Market discovery'),
    [language]
  );
  const globalDiscoverySections = useMemo(() => {
    const he = language === 'he';
    const aggregate = he
      ? [
          {
            key: 'agg-q',
            title: 'חיפושי סוכנים (24 שעות)',
            sub: '1.4k שאילתות · ~62% ספקי שירות · ~28% מוצרים ומסלולים · ~10% תהליכים',
          },
          {
            key: 'agg-src',
            title: 'מה נכנס לאגרגט',
            sub: 'מחירון, סלוטים, SLA, ביקורות מאומתות, נפח חיפוש ויחידות בבית שמצביעות על ביקוש',
          },
          {
            key: 'agg-ai',
            title: 'למה זה עוזר ל-AI ולך',
            sub: 'שכבה אחת עקבית לפי עולם — פחות סתירות בין סוכנים, יותר בחירה מושכלת לפני פתיחת יחידה',
          },
        ]
      : [
          {
            key: 'agg-q',
            title: 'Agent searches (24h)',
            sub: '1.4k queries · ~62% services · ~28% products & bundles · ~10% flows',
          },
          {
            key: 'agg-src',
            title: 'What feeds the aggregate',
            sub: 'Pricing, slots, SLAs, verified reviews, search volume, and home units that signal demand',
          },
          {
            key: 'agg-ai',
            title: 'Why people & AI both win',
            sub: 'One consistent layer per world — fewer cross-agent conflicts, sharper picks before you open a unit',
          },
        ];
    const discovery = he
      ? [
          {
            key: 'd-svc',
            title: 'ספקי שירות',
            sub: 'משרדי ליווי, קליניקות, מאמנים, יועצים — דירוג לפי זמינות, מהירות מענה והתאמה לעולם הזה.',
          },
          {
            key: 'd-prd',
            title: 'מוצרים ומסלולים',
            sub: 'חבילות התחלה, מנויים, קורסים וכלים — מול ביקוש אמיתי מהשטח, לא רק פרסום.',
          },
          {
            key: 'd-match',
            title: 'התאמה מהשוק',
            sub: 'סוכנים מרכיבים הצעות מול אותו אגרגט — כדי לצמצם רעש ולהגיע מהר לשורה התחתונה.',
          },
        ]
      : [
          {
            key: 'd-svc',
            title: 'Service providers',
            sub: 'Desks, clinics, coaches, consultants — ranked by availability, response time, and fit to this world.',
          },
          {
            key: 'd-prd',
            title: 'Products & bundles',
            sub: 'Starter packs, subscriptions, courses, and tools — against real demand signals, not ads alone.',
          },
          {
            key: 'd-match',
            title: 'Market-matched offers',
            sub: 'Agents compose options against the same aggregate — less noise, faster path to a decision.',
          },
        ];
    const agentSearchThemes = currentOrbData
      .filter((o) => o.id !== 'origin')
      .slice(0, 4)
      .map((o) => ({ key: o.id, title: o.title, sub: o.subtitle }));
    const unitsHot = [...flowUnits]
      .filter((u) => u.worldId === currentWorldId)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3)
      .map((u) => ({ key: u.id, title: u.goal?.trim() || u.title, sub: `${u.progress}%` }));
    const marketPulse = he
      ? [
          {
            key: 'm1',
            title: 'היצע מול ביקוש',
            sub: 'חבילות ליווי בתחילת דרך — היצע גבוה; חלונות פגישה בערב — ביקוש חזק באזורים מסוימים.',
          },
          {
            key: 'm2',
            title: 'מה נפתח כיחידות',
            sub: 'תבניות שחוזרות מהחיפושים → נכנסות לבית כיחידות — מעידות על כיוון השוק.',
          },
        ]
      : [
          {
            key: 'm1',
            title: 'Supply vs demand',
            sub: 'Starter coaching — high supply; evening slots — tight demand in several metros.',
          },
          {
            key: 'm2',
            title: 'What becomes a unit',
            sub: 'Patterns that repeat in agent queries tend to land as home units — a live market compass.',
          },
        ];
    return { aggregate, discovery, agentSearchThemes, unitsHot, marketPulse };
  }, [currentOrbData, currentWorldId, flowUnits, language]);
  const effectiveChatWorldId = showChatSheet ? chatPinnedWorldId : currentWorldId;
  const effectiveChatWorld = WORLDS.find((w) => w.id === effectiveChatWorldId) ?? WORLDS[0];
  const effectiveChatWorldColor = effectiveChatWorld.color;
  const rawFirstName = user?.name?.trim()?.split(/\s+/)[0] || 'אריאל';
  const firstName =
    rawFirstName.toLowerCase() === 'guest' ? (language === 'he' ? 'אורח' : 'Guest') : rawFirstName;
  const greetingName = accountSpace === 'business' ? businessName : firstName;
  const personalGreeting = getTimeGreeting(new Date().getHours(), greetingName, language);
  const nowInputHasText = nowValue.trim().length > 0;
  const nowInputIsRtl = /[\u0590-\u08FF]/.test(nowValue);
  const nowInputTextAlign: 'left' | 'right' =
    language === 'he'
      ? nowInputHasText && !nowInputIsRtl
        ? 'left'
        : 'right'
      : nowInputHasText && nowInputIsRtl
        ? 'right'
        : 'left';
  const nowInputWritingDirection: 'ltr' | 'rtl' =
    language === 'he'
      ? nowInputHasText && !nowInputIsRtl
        ? 'ltr'
        : 'rtl'
      : nowInputHasText && nowInputIsRtl
        ? 'rtl'
        : 'ltr';
  const isChatSystemWorking = chatStatusPhase === 'thinking' || chatStatusPhase === 'planning';
  const chatComposerMaxHeight = COMPOSER_MAX_LINES * COMPOSER_LINE_HEIGHT;
  const chatComposerVisibleHeight = Math.max(
    COMPOSER_MIN_LINES * COMPOSER_LINE_HEIGHT,
    Math.min(chatComposerMaxHeight, chatComposerMeasuredHeight)
  );
  const chatComposerLineCount = Math.max(COMPOSER_MIN_LINES, Math.round(chatComposerVisibleHeight / COMPOSER_LINE_HEIGHT));
  const chatComposerCanExpand = chatComposerMeasuredHeight > chatComposerMaxHeight + 2;
  const activeUnit = activeUnitId ? flowUnits.find((unit) => unit.id === activeUnitId) ?? null : null;
  const isDark = theme === 'dark';
  const chatSheetBg = isDark ? '#121212' : colors.background;
  const chatCardBg = isDark ? '#121317' : colors.surface;
  const chatOneBubbleBg = isDark ? '#ECEDEE' : '#f0f0f0';
  const chatActionButtonBg = isDark ? '#ffffff' : '#000000';
  const chatActionIconColor = isDark ? '#111111' : '#ffffff';
  const profileRingR = 36;
  const profileRingC = 2 * Math.PI * profileRingR;
  const unitProgressPct = activeUnit ? Math.min(100, Math.max(0, activeUnit.progress)) / 100 : 0;
  const unitStepsDone = activeUnit ? Math.max(0, Math.round((activeUnit.progress / 100) * activeUnit.steps)) : 0;
  const profileAccent = effectiveChatWorldColor;
  const chatAgentAvatarBg = theme === 'light' ? '#000000' : '#1f1f1f';
  const generalWorldLabel = language === 'he' ? 'כללי' : 'General';
  const activeWorldChatLabel =
    effectiveChatWorldId === 'personal' ? generalWorldLabel : worldTitle(effectiveChatWorldId, language);
  const agentHeaderSubtitle = language === 'he' ? 'סוכן' : 'Agent';
  /** בצ׳אט סוכן — כותרת ההדר היא שם הסוכן (לא «ONE שלי» קבוע) */
  const chatAgentHeaderTitle = useMemo(() => {
    const name = user?.agent?.name?.trim();
    if (name) return embedLatinRunsForRtlDisplay(name, language);
    return translate(language, 'chat_title_default');
  }, [user?.agent?.name, language]);
  const buildWorldAgentWelcome = useCallback(
    (worldId: string): string => {
      const he = language === 'he';
      if (worldId === 'business') {
        return he
          ? 'שלום! מצב עבודה: כתבו יעד אחד, ואני אכין TODO מסודר + עדכון התקדמות ראשון.'
          : 'Work mode is on. Share one goal and I will build a focused TODO list with a first progress update.';
      }
      if (worldId === 'health') {
        return he
          ? 'שלום! מצב בריאות: כתבו מטרה אחת, ואני אכין TODO יומי + עדכון התקדמות.'
          : 'Health mode is on. Share one target and I will prepare a daily TODO flow with progress updates.';
      }
      if (worldId === 'finance') {
        return he
          ? 'שלום! מצב כסף: כתבו מה רוצים לשפר, ואני אבנה TODO כספי + עדכון מצב.'
          : 'Finance mode is on. Tell me what you want to improve and I will build a money TODO plan with status updates.';
      }
      if (worldId === 'knowledge') {
        return he
          ? 'שלום! מצב לימודים: כתבו נושא או מבחן, ואני אבנה TODO לימודי + עדכון התקדמות.'
          : 'Knowledge mode is on. Share a subject or exam and I will build a study TODO flow with progress updates.';
      }
      if (worldId === 'leisure') {
        return he
          ? 'שלום! מצב פנאי: כתבו מה בא לכם לעשות בזמן הפנוי — ואני אבנה רשימת TODO + תזכורות עדינות.'
          : 'Leisure mode is on. Tell me what you want to do in your free time and I will build a light TODO list with gentle reminders.';
      }
      if (worldId === 'relations') {
        return he
          ? 'שלום! מצב קשרים: ספרו על אדם או אירוע שחשוב לכם — ואני אעזור לסדר TODO, תזכורות ומעקב נעים.'
          : 'Relationships mode is on. Tell me about a person or event that matters and I will help with TODOs, reminders, and gentle follow-ups.';
      }
      return he
        ? 'שלום! מצב כללי: ספרו מה המטרה, ואני אתחיל TODO ראשוני + עדכון התקדמות.'
        : 'General mode is on. Tell me the goal and I will start with initial TODOs and a progress update.';
    },
    [language]
  );
  const userPlanTier = useMemo<'FREE' | 'PRO' | 'MAX'>(() => {
    const presetTier = DEV_PROFILE_PRESETS[previewProfile].planTier;
    if (presetTier === 'PRO' || presetTier === 'MAX') return presetTier;
    const rawTier = String(
      (user as any)?.planTier ??
      (user as any)?.tier ??
      (user as any)?.subscriptionTier ??
      (user as any)?.subscription?.tier ??
      'FREE'
    ).toUpperCase();
    if (rawTier === 'PRO' || rawTier === 'MAX') return rawTier;
    return 'FREE';
  }, [user, previewProfile]);
  const chatHeaderPlanLabel = userPlanTier === 'FREE'
    ? (language === 'he' ? 'שדרג' : 'Upgrade')
    : userPlanTier;
  const headerProgressPct = activeUnit ? Math.max(0, Math.min(100, activeUnit.progress)) / 100 : 0;
  const headerProgressColor = progressColorByPct(headerProgressPct, isDark);
  const unitChatParticipants = useMemo(
    () => (activeUnit ? filterUnitChatParticipants(activeUnit.peopleRoles) : []),
    [activeUnit?.id, activeUnit?.peopleRoles]
  );
  const chatProfileHeaderLabel = activeUnit
    ? (language === 'he' ? 'פרופיל יחידה' : 'Unit Profile')
    : (language === 'he' ? 'פרופיל סוכן' : 'Agent Profile');
  const chatContextSuggestions = useMemo(() => {
    const he = language === 'he';
    if (!activeUnit && agentUnitCreationMode) {
      return creationGoalChipsForWorld(effectiveChatWorldId, language);
    }
    if (activeUnit?.profileSlots?.length) {
      return [];
    }
    if (activeUnit) {
      const nextStepLabel = activeUnit.nextAction?.trim() || (he ? 'מה הצעד הבא?' : 'What is the next step?');
      if (activeUnit.worldId === 'health') {
        return he
          ? ['קבע תור', 'תזכורת יומית', nextStepLabel]
          : ['Schedule appointment', 'Daily reminder', nextStepLabel];
      }
      if (activeUnit.worldId === 'finance') {
        return he
          ? ['בדיקת תקציב', 'עדכון הוצאות', nextStepLabel]
          : ['Budget check', 'Update expenses', nextStepLabel];
      }
      if (activeUnit.worldId === 'knowledge') {
        return he
          ? ['תרגול יומי', 'סיכום חומר', nextStepLabel]
          : ['Daily practice', 'Study summary', nextStepLabel];
      }
      if (activeUnit.worldId === 'business') {
        return he
          ? ['משימת לקוח', 'עדכון סטטוס', nextStepLabel]
          : ['Client task', 'Status update', nextStepLabel];
      }
      if (activeUnit.worldId === 'leisure') {
        return he
          ? ['רעיון לסופ״ש', 'רשימת ציוד', nextStepLabel]
          : ['Weekend idea', 'Packing list', nextStepLabel];
      }
      if (activeUnit.worldId === 'relations') {
        return he
          ? ['תזכורת לפגישה', 'רשימת אורחים', nextStepLabel]
          : ['Meet-up reminder', 'Guest list', nextStepLabel];
      }
      if (/רישיון|license/i.test(activeUnit.title)) {
        return he
          ? ['קבע שיעור', 'תרגול תיאוריה', nextStepLabel]
          : ['Schedule lesson', 'Theory practice', nextStepLabel];
      }
      return he
        ? ['עדכן TODO', 'מה סטטוס היחידה?', nextStepLabel]
        : ['Update TODO', 'What is unit status?', nextStepLabel];
    }
    if (effectiveChatWorldId === 'business') {
      return he ? ['פתח TODO לעבודה', 'עדכון לקוחות', 'מה הכי דחוף היום?'] : ['Open work TODO', 'Client update', 'Top priority today?'];
    }
    if (effectiveChatWorldId === 'health') {
      return he ? ['TODO בריאות יומי', 'מעקב בדיקות', 'תזכורת תרופה'] : ['Daily health TODO', 'Track tests', 'Medication reminder'];
    }
    if (effectiveChatWorldId === 'finance') {
      return he ? ['TODO כלכלי', 'עדכון הוצאות', 'יעד חיסכון חודשי'] : ['Finance TODO', 'Update expenses', 'Monthly savings target'];
    }
    if (effectiveChatWorldId === 'knowledge') {
      return he ? ['TODO לימודים', 'תרגול יומי', 'סיכום שיעור'] : ['Study TODO', 'Daily practice', 'Lesson summary'];
    }
    if (effectiveChatWorldId === 'leisure') {
      return he ? ['תכנון סופ״ש', 'רשימת ציוד', 'תזכורת לאירוע'] : ['Weekend plan', 'Gear checklist', 'Event reminder'];
    }
    if (effectiveChatWorldId === 'relations') {
      return he ? ['TODO למשפחה', 'תזכורת ליום הולדת', 'מעקב אחר חברים'] : ['Family TODO', 'Birthday reminder', 'Friends check-in'];
    }
    return he ? ['פתח יחידה חדשה', 'הראה היסטוריה', 'מה עושים עכשיו?'] : ['Open new unit', 'Show history', 'What now?'];
  }, [activeUnit, effectiveChatWorldId, language, agentUnitCreationMode]);
  const historyUnitsForWorld = useMemo(() => {
    const list =
      effectiveChatWorldId === 'personal'
        ? flowUnits
        : flowUnits.filter((unit) => unit.worldId === effectiveChatWorldId);
    return sortFlowUnitsHistoryOldestFirst(list);
  }, [flowUnits, effectiveChatWorldId]);

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
    const worlds = WORLDS.map((w) => ({
      id: w.id,
      label: worldTitle(w.id, language),
      color: w.color,
      active: w.id === effectiveChatWorldId,
      detail:
        w.id === 'personal'
          ? he
            ? 'כל היחידות והיסטוריה — ללא סינון מרחב.'
            : 'All units and history — no world filter.'
          : he
            ? `יחידות מתויגות לעולם «${w.label}» והקשר ${w.label} לסוכן.`
            : `Units tagged to «${worldTitle(w.id, 'en')}» and matching context.`,
    }));
    const worldUnitsList =
      effectiveChatWorldId === 'personal' ? flowUnits : flowUnits.filter((u) => u.worldId === effectiveChatWorldId);
    const activeUnitsInWorld = worldUnitsList.filter((u) => u.status !== 'done').length;
    const worldNameHe = WORLDS.find((w) => w.id === effectiveChatWorldId)?.label ?? 'כללי';
    const worldNameEn = worldTitle(effectiveChatWorldId, 'en');
    const broadcastPrimary = he
      ? effectiveChatWorldId === 'personal'
        ? `יש לך ${activeUnitsInWorld} יחידות פעילות במרחב הכללי.`
        : `יש לך ${activeUnitsInWorld} יחידות פעילות במרחב «${worldNameHe}».`
      : effectiveChatWorldId === 'personal'
        ? `You have ${activeUnitsInWorld} active units in General.`
        : `You have ${activeUnitsInWorld} active units in «${worldNameEn}».`;
    const broadcastSecondary = he ? 'המשך מה שפתחת או התחל משהו חדש.' : 'Continue what you started or begin something new.';
    const msgCount = chatSheetMessages.length;
    const stats: AgentChatProfileModel['stats'] = he
      ? [
          {
            label: 'יחידות במעקב',
            value: String(worldUnitsList.length),
            hint: `${activeUnitsInWorld} פתוחות, ${worldUnitsList.length - activeUnitsInWorld} אחרות`,
          },
          {
            label: 'הודעות בשיחה',
            value: String(msgCount),
            hint: effectiveChatWorldId === 'personal' ? 'בצ׳אט ONE הנוכחי' : `מיקוד: «${worldNameHe}»`,
          },
          { label: 'מרחבים זמינים', value: String(WORLDS.length), hint: 'כללי, עבודה, בריאות, כסף, לימודים, פנאי, קשרים' },
        ]
      : [
          {
            label: 'Units tracked',
            value: String(worldUnitsList.length),
            hint: `${activeUnitsInWorld} open, ${worldUnitsList.length - activeUnitsInWorld} other`,
          },
          {
            label: 'Messages (chat)',
            value: String(msgCount),
            hint: effectiveChatWorldId === 'personal' ? 'In this ONE chat' : `Focus: «${worldNameEn}»`,
          },
          { label: 'Worlds', value: String(WORLDS.length), hint: 'General + 6 life lenses' },
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
          { label: 'יחידות במערכת', value: String(worldUnitsList.length) },
          { label: 'מרחב נוכחי בצ׳אט', value: activeWorldChatLabel },
          { label: 'כובעים פעילים', value: hats.map((h: Hat) => HAT_LABELS[h]).join(', ') || HAT_LABELS.base },
          { label: 'זיכרון שיחה', value: 'שמירת הקשר בתוך היחידה' },
        ]
      : [
          { label: 'Units in workspace', value: String(worldUnitsList.length) },
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
      broadcastPrimary,
      broadcastSecondary,
      worlds,
      hatsIntro: he
        ? 'הכובעים מצמצמים את ההקשר: אותו סוכן, פרשנות שונה לפי חיים / עבודה / בריאות / כסף.'
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
  }, [language, user, effectiveChatWorldId, activeWorldChatLabel, flowUnits, chatSheetMessages]);


  /** מעבר חלק בכפתור כדור: לכדור אחר – פייד; חזרה לסוכן – פייד־אין קצר (בלי קפיצה) */
  useEffect(() => {
    const toFirstOrb = orbIndex === AGENT_ORB_INDEX;
    const duration = toFirstOrb ? 120 : 200;
    Animated.parallel([
      Animated.timing(orbButtonLabelOpacity, { toValue: toFirstOrb ? 1 : 0, duration, useNativeDriver: true }),
      Animated.timing(orbButtonEnterOpacity, { toValue: toFirstOrb ? 0 : 1, duration, useNativeDriver: true }),
    ]).start();
  }, [orbIndex, orbButtonLabelOpacity, orbButtonEnterOpacity]);

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
    setChatPinnedWorldId(currentWorldId);
    const selectedOrb = wheelOrbData[orbIndex];
    if (selectedOrb?.id === GLOBAL_WHEEL_ORB_ID) {
      setAgentUnitCreationMode(false);
      setActiveUnitId(null);
      setChatSheetMessages([
        { id: `seed_${Date.now()}`, sender: 'one', text: buildWorldAgentWelcome(currentWorldId), sentAt: Date.now() },
      ]);
    } else if (selectedOrb && selectedOrb.id !== 'origin') {
      setAgentUnitCreationMode(false);
      let target = flowUnits.find((u) => u.id === selectedOrb.id);
      if (!target) {
        const isLicenseOrb = selectedOrb.id === 'license';
        const { spaceId: _orbSp, domainId: _orbDm } = legacyWorldIdToSpaceDomain(effectiveChatWorldId);
        target = {
          id: selectedOrb.id,
          spaceId: _orbSp,
          domainId: _orbDm,
          worldId: effectiveChatWorldId,
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
    } else {
      setActiveUnitId(null);
      setAgentUnitCreationMode(true);
      setChatSheetMessages([
        { id: `seed_${Date.now()}`, sender: 'one', text: buildAgentGoalPromptMessage(language, currentWorldId), sentAt: Date.now() },
      ]);
      shouldRefocusComposerAfterChatOpenRef.current = true;
    }
    chatBackdropOpacity.setValue(0);
    chatSheetTranslateY.setValue(windowHeight + 180);
    setShowChatSheet(true);
  }, [
    wheelOrbData,
    orbIndex,
    flowUnits,
    effectiveChatWorldId,
    windowHeight,
    chatBackdropOpacity,
    chatSheetTranslateY,
    currentWorldId,
    buildWorldAgentWelcome,
    language,
  ]);

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
    (opts?: { gestureDx?: number; gestureDy?: number; direction?: 'side' | 'down'; afterClose?: () => void }) => {
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
      const closeDown =
        opts?.direction === 'down' || (opts?.gestureDy != null && opts.gestureDy > 42 && (!opts?.gestureDx || Math.abs(opts.gestureDy) > Math.abs(opts.gestureDx)));
      if (closeDown) {
        const startY = Math.max(0, opts?.gestureDy ?? 0);
        chatSheetTranslateY.setValue(startY);
      }
      const dir =
        opts?.gestureDx != null && Math.abs(opts.gestureDx) > 8
          ? Math.sign(opts.gestureDx)
          : isRtlLayout
            ? 1
            : -1;
      const exitX = dir * Math.min(windowWidth * 1.12, windowWidth + 48);
      const composerExitY = windowHeight + 48;
      Animated.parallel([
        Animated.timing(chatBackdropOpacity, {
          toValue: 0,
          duration: closeDown ? 220 : 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(chatComposerTranslateY, {
          toValue: composerExitY,
          duration: closeDown ? 240 : 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        closeDown
          ? Animated.timing(chatSheetTranslateY, {
              toValue: windowHeight,
              duration: 280,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            })
          : Animated.timing(chatSheetTranslateX, {
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
      setIsVoiceTrayOpen(false);
      setIsMicHoldActive(false);
        setChatOpenedFromOrbProfileShortcut(false);
        setShowCredits(false);
        /** אחרי שהקלף נסגר — לא לפני, כדי שלא יבזק מסך «My One» בזמן האנימציה */
        setActiveUnitId(null);
        opts?.afterClose?.();
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
      setChatComposerMeasuredHeight(COMPOSER_LINE_HEIGHT);
      setIsComposerExpanded(false);
      return;
    }
    let cancelled = false;
    const animGen = ++chatOpenAnimGenerationRef.current;
    suppressKeyboardForChatLayoutRef.current = true;
    pendingKeyboardInsetRef.current = 0;
    setKeyboardOffset(0);
    chatBackdropOpacity.setValue(0);
    chatSheetTranslateY.setValue(windowHeight + 180);
    chatSheetTranslateX.setValue(0);
    chatComposerTranslateY.setValue(windowHeight + 96);

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
          duration: 380,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(chatComposerTranslateY, {
          toValue: 0,
          duration: 360,
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

  useEffect(() => {
    if (!nowValue.trim()) {
      setChatComposerMeasuredHeight(COMPOSER_LINE_HEIGHT);
      setIsComposerExpanded(false);
    }
  }, [nowValue]);

  useEffect(() => {
    if (accountSpace === 'business') {
      const seeded = generateBusinessWorkspaceSeed(language);
      setPersonalOrbs(seeded.personalOrbs);
      setFlowUnits(seeded.flowUnits);
      setWorldIndex(0);
      setChatPinnedWorldId('business');
    } else {
      setPersonalOrbs([{ id: 'origin', emoji: '👤', title: language === 'he' ? 'ראשי' : 'Home', subtitle: '' }]);
      setFlowUnits([]);
      setWorldIndex(0);
      setChatPinnedWorldId('personal');
    }
    setActiveUnitId(null);
    setShowChatProfile(false);
  }, [previewProfile, accountSpace, language]);

  const lastSyntheticApplyNonceRef = useRef(0);
  useEffect(() => {
    if (syntheticHomeApplyNonce === 0 || syntheticHomeApplyNonce === lastSyntheticApplyNonceRef.current) return;
    lastSyntheticApplyNonceRef.current = syntheticHomeApplyNonce;
    const gen = generateAiSyntheticProfile(language);
    setPersonalOrbs(gen.personalOrbs);
    setFlowUnits(gen.flowUnits);
    setActiveUnitId(null);
    setWorldIndex(0);
    setChatPinnedWorldId('personal');
  }, [syntheticHomeApplyNonce, language]);

  const collapseProfileToChat = useCallback(() => {
    if (chatOpenedFromOrbProfileShortcut) {
      closeChatSheetRef.current?.({ direction: 'down' });
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

  const chatSheetHeaderDownPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) + 4,
        onPanResponderMove: (_e, g) => {
          const pull = Math.max(0, g.dy);
          chatSheetTranslateY.setValue(pull);
          const fade = 1 - Math.min(0.55, pull / Math.max(220, windowHeight * 0.45));
          chatBackdropOpacity.setValue(fade);
        },
        onPanResponderRelease: (_e, g) => {
          const shouldClose = g.dy > 110 || g.vy > 1.05;
          if (shouldClose) {
            closeChatSheetRef.current?.({ direction: 'down', gestureDy: g.dy, gestureDx: g.dx });
            return;
          }
          Animated.parallel([
            Animated.spring(chatSheetTranslateY, {
              toValue: 0,
              stiffness: 420,
              damping: 34,
              mass: 0.85,
              useNativeDriver: true,
            }),
            Animated.timing(chatBackdropOpacity, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [chatSheetTranslateY, chatBackdropOpacity, windowHeight]
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
    if (!showChatSheet || !showChatProfile) return;
    const t = setTimeout(() => chatScrollRef.current?.scrollTo({ y: 0, animated: false }), 60);
    return () => clearTimeout(t);
  }, [showChatProfile, showChatSheet]);

  useEffect(() => {
    if (!showChatProfile) {
      chatProfileCompactScrollRef.current = false;
      setChatProfileHeaderCompact(false);
      profileDismissSlideX.setValue(0);
      profileUpgradeFabTranslateY.setValue(96);
      profileUpgradeFabOpacity.setValue(0);
    }
  }, [showChatProfile, profileDismissSlideX, profileUpgradeFabOpacity, profileUpgradeFabTranslateY]);

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

  const profileUpgradeFabVisible = showChatProfile && !activeUnit && chatProfileHeaderCompact;
  useEffect(() => {
    if (profileUpgradeFabVisible) {
      Animated.parallel([
        Animated.spring(profileUpgradeFabTranslateY, {
          toValue: 0,
          stiffness: 420,
          damping: 30,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.timing(profileUpgradeFabOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(profileUpgradeFabTranslateY, {
          toValue: 96,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(profileUpgradeFabOpacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    profileUpgradeFabVisible,
    profileUpgradeFabOpacity,
    profileUpgradeFabTranslateY,
  ]);

  const onMainChatThreadMessageLayout = useCallback((messageId: string, y: number) => {
    chatMessageBubbleYRef.current.set(messageId, y);
  }, []);

  const recomputeChatStickyDateLabel = useCallback(
    (scrollY: number) => {
      const list = activeUnit?.messages ?? chatSheetMessages;
      const he = language === 'he';
      if (!list.length) {
        const d = formatChatDayStickyLabel(Date.now(), he);
        if (d !== chatStickyLabelLastRef.current) {
          chatStickyLabelLastRef.current = d;
          setChatStickyDateLabel(d);
        }
        return;
      }
      const STICKY_TOP = 44;
      const cut = scrollY + STICKY_TOP;
      let pickedIdx = 0;
      const tops = chatMessageBubbleYRef.current;
      for (let i = 0; i < list.length; i++) {
        const ty = tops.get(list[i].id);
        if (ty != null && ty <= cut) pickedIdx = i;
      }
      const ts = inferMessageSentAt(list[pickedIdx], pickedIdx, list.length);
      const label = formatChatDayStickyLabel(ts, he);
      if (label !== chatStickyLabelLastRef.current) {
        chatStickyLabelLastRef.current = label;
        setChatStickyDateLabel(label);
      }
    },
    [activeUnit, chatSheetMessages, language]
  );

  useEffect(() => {
    chatStickyLabelLastRef.current = '';
    chatMessageBubbleYRef.current.clear();
  }, [activeUnit?.id, effectiveChatWorldId]);

  useEffect(() => {
    requestAnimationFrame(() => recomputeChatStickyDateLabel(lastChatScrollYRef.current));
  }, [chatSheetMessages.length, activeUnit?.messages?.length, language, recomputeChatStickyDateLabel]);

  const onCombinedChatScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (showChatProfile) {
        const y = e.nativeEvent.contentOffset.y;
        if (y < -56 && !profilePullCloseTriggeredRef.current) {
          profilePullCloseTriggeredRef.current = true;
          closeChatFromProfileOverscroll();
          return;
        }
        onChatProfileScroll(e);
        return;
      }
      if (showChatSheet) {
        const y = e.nativeEvent.contentOffset.y;
        if (y < -56 && !chatPullCloseTriggeredRef.current) {
          chatPullCloseTriggeredRef.current = true;
          closeChatFromChatOverscroll();
          return;
        }
      }
      const y = e.nativeEvent.contentOffset.y;
      lastChatScrollYRef.current = y;
      recomputeChatStickyDateLabel(y);
    },
    [
      showChatProfile,
      onChatProfileScroll,
      recomputeChatStickyDateLabel,
      showChatSheet,
      closeChatFromProfileOverscroll,
      closeChatFromChatOverscroll,
    ]
  );

  const onChatThreadScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (showChatProfile) {
        if (y < -32 && !profilePullCloseTriggeredRef.current) {
          profilePullCloseTriggeredRef.current = true;
          closeChatFromProfileOverscroll();
        }
        return;
      }
      if (showChatSheet) {
        if (y < -32 && !chatPullCloseTriggeredRef.current) {
          chatPullCloseTriggeredRef.current = true;
          closeChatFromChatOverscroll();
        }
      }
    },
    [showChatProfile, showChatSheet, closeChatFromProfileOverscroll, closeChatFromChatOverscroll]
  );

  useEffect(() => {
    if (showChatProfile) profilePullCloseTriggeredRef.current = false;
    if (showChatSheet && !showChatProfile) chatPullCloseTriggeredRef.current = false;
  }, [showChatProfile, showChatSheet]);

  /** לא מציגים «היום» בדיפולט — רק אחרי גלילה אחורה ליום קודם או תאריך מלא */
  const chatStickyDatePillVisible =
    chatStickyDateLabel !== formatChatDayStickyLabel(Date.now(), language === 'he');

  /** צ׳אט סוכן: פוקוס על הודעות אחרונות (היסטוריית יחידות נשארת למעלה בגלילה) */
  useEffect(() => {
    if (!showChatSheet || activeUnitId) return;
    // When opening the agent profile from Home, the UI should start at the top.
    if (showChatProfile || chatOpenedFromOrbProfileShortcut) return;
    const t = setTimeout(scrollOneChatToBottom, 40);
    const t2 = setTimeout(scrollOneChatToBottom, 120);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [
    showChatSheet,
    activeUnitId,
    showChatProfile,
    chatOpenedFromOrbProfileShortcut,
    flowUnits.length,
    chatSheetMessages.length,
    scrollOneChatToBottom,
  ]);

  const commitAgentCreationGoal = useCallback(
    (rawGoal: string) => {
      const text = rawGoal.trim();
      if (!text) return;
      if (!agentUnitCreationMode || activeUnitId) return;

      const matched = flowUnits.find(
        (unit) =>
          text.toLowerCase().includes(unit.title.toLowerCase()) ||
          unit.title.toLowerCase().includes(text.toLowerCase())
      );
      if (matched) {
        setAgentUnitCreationMode(false);
        setChatSheetMessages((prev) => [
          ...prev,
          { id: `u_${Date.now()}`, sender: 'user', text, sentAt: Date.now() },
          {
            id: `open_${Date.now()}`,
            sender: 'one',
            text:
              language === 'he'
                ? `פותחים יחידה קיימת: ${matched.title}`
                : `Opening existing unit: ${matched.title}`,
            sentAt: Date.now(),
          },
        ]);
        setActiveUnitId(matched.id);
        setNowValue('');
        return;
      }

      setChatStatusPhase('thinking');
      const tmpl = goalTemplateFromText(text, language, effectiveChatWorldId);
      recordGoalTemplatePublicSignal(tmpl);
      const newUnitId = `unit_${Date.now()}`;
      const firstEmpty = tmpl.slots.find((s) => !s.optional) ?? tmpl.slots[0];
      const he = language === 'he';
      const firstAsk = he
        ? `היחידה «${tmpl.title}» מוכנה. מה ${firstEmpty?.label ?? 'הפרט הבא'}? (הנתונים נשמרים בפרופיל היחידה.)`
        : `Unit “${tmpl.title}” is ready. What is ${firstEmpty?.label ?? 'the next detail'}? (Saved on the unit profile.)`;

      const newUnit: FlowUnit = {
        id: newUnitId,
        spaceId: tmpl.spaceId,
        domainId: tmpl.domainId,
        worldId: tmpl.worldId,
        title: tmpl.title,
        subtitle: tmpl.subtitle,
        emoji: tmpl.emoji,
        status: 'active',
        progress: 8,
        steps: tmpl.steps,
        profileSlots: tmpl.slots.map((s) => ({ ...s })),
        messages: [
          {
            id: `seed_${newUnitId}`,
            sender: 'one',
            text: firstAsk,
            sentAt: Date.now(),
          },
        ],
        goal: he ? `להגשים: ${text.slice(0, 120)}` : `Achieve: ${text.slice(0, 120)}`,
        city: he ? 'לא צוין' : 'Not set',
        etaWeeks: 8,
        peopleRoles: [
          { id: 'nu1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
          { id: 'nu2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
        ],
        nextAction: firstEmpty ? (he ? `למלא: ${firstEmpty.label}` : `Fill: ${firstEmpty.label}`) : undefined,
        lastUpdatedLabel: he ? 'נוצר מהמטרה שבחרת' : 'Created from your goal',
        blockCount: 5,
      };

      setFlowUnits((prev) => [newUnit, ...prev.filter((u) => u.id !== newUnitId)]);
      setPersonalOrbs((prev) =>
        prev.some((p) => p.id === newUnitId)
          ? prev
          : insertPersonalOrbsAfterOrigin(prev, [
              { id: newUnitId, emoji: newUnit.emoji, title: newUnit.title, subtitle: newUnit.subtitle },
            ])
      );
      const wi = WORLDS.findIndex((w) => w.id === tmpl.worldId);
      if (wi >= 0) setWorldIndex(wi);
      setChatPinnedWorldId(tmpl.worldId);
      setAgentUnitCreationMode(false);
      setNowValue('');
      setTimeout(() => setChatStatusPhase('planning'), 500);
      setTimeout(() => setChatStatusPhase('ready'), 1100);
      setTimeout(() => setChatStatusPhase('agent'), 2000);

      closeChatSheetRef.current?.({
        afterClose: () => {
          pendingReopenUnitChatRef.current = newUnitId;
        },
      });
    },
    [agentUnitCreationMode, activeUnitId, flowUnits, language, effectiveChatWorldId]
  );

  const submitNowValue = useCallback(() => {
    const text = nowValue.trim();
    if (!text) return;
    if (agentUnitCreationMode && !activeUnitId) {
      commitAgentCreationGoal(text);
      return;
    }
    setChatStatusPhase('thinking');

    const userLine: ChatLine = { id: `u_${Date.now()}`, sender: 'user', text, sentAt: Date.now() };

    if (activeUnitId) {
      setFlowUnits((prev) =>
        prev.map((unit) => {
          if (unit.id !== activeUnitId) return unit;
          if (!unit.profileSlots?.length) {
            return {
              ...unit,
              messages: [
                ...unit.messages,
                userLine,
                {
                  id: `o_${Date.now() + 1}`,
                  sender: 'one',
                  text: buildAgentUnitChatReply(unit, text, language),
                  sentAt: Date.now(),
                },
              ],
            };
          }
          const updated = applyProfileSlotsFromMessage(unit, text, language);
          return {
            ...updated,
            messages: [
              ...updated.messages,
              userLine,
              {
                id: `o_${Date.now() + 1}`,
                sender: 'one',
                text: buildAdaptiveProfileReply(unit, updated, text, language),
                sentAt: Date.now(),
              },
            ],
          };
        })
      );
      setNowValue('');
      setTimeout(() => setChatStatusPhase('planning'), 700);
      setTimeout(() => setChatStatusPhase('ready'), 1400);
      setTimeout(() => setChatStatusPhase('agent'), 2600);
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
        {
          id: `open_${Date.now()}`,
          sender: 'one',
          text:
            language === 'he'
              ? `פותחים יחידה קיימת: ${matched.title}`
              : `Opening existing unit: ${matched.title}`,
          sentAt: Date.now(),
        },
      ]);
      setActiveUnitId(matched.id);
    } else {
      const tmpl = goalTemplateFromText(text, language, effectiveChatWorldId);
      recordGoalTemplatePublicSignal(tmpl);
      const newUnitId = `unit_${Date.now()}`;
      const firstEmpty = tmpl.slots.find((s) => !s.optional) ?? tmpl.slots[0];
      const he = language === 'he';
      const newUnit: FlowUnit = {
        id: newUnitId,
        spaceId: tmpl.spaceId,
        domainId: tmpl.domainId,
        worldId: tmpl.worldId,
        title: tmpl.title,
        subtitle: tmpl.subtitle,
        emoji: tmpl.emoji,
        status: 'active',
        progress: 6,
        steps: tmpl.steps,
        profileSlots: tmpl.slots.map((s) => ({ ...s })),
        messages: [
          {
            id: `created_${Date.now()}`,
            sender: 'one',
            text: he
              ? `היחידה «${tmpl.title}» נפתחה. מה ${firstEmpty?.label ?? 'הפרט הבא'}?`
              : `Unit “${tmpl.title}” is open. What is ${firstEmpty?.label ?? 'next'}?`,
            sentAt: Date.now(),
          },
        ],
        goal: he ? `להגשים: ${text.slice(0, 120)}` : `Achieve: ${text.slice(0, 120)}`,
        city: he ? 'לא צוין' : 'Not set',
        etaWeeks: 8,
        peopleRoles: [
          { id: 'nu1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
          { id: 'nu2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
        ],
        nextAction: firstEmpty ? (he ? `למלא: ${firstEmpty.label}` : `Fill: ${firstEmpty.label}`) : undefined,
        lastUpdatedLabel: he ? 'נוצר עכשיו מהשיחה' : 'Created now from chat',
        blockCount: 5,
      };
      setFlowUnits((prev) => [newUnit, ...prev]);
      setPersonalOrbs((prev) =>
        prev.some((p) => p.id === newUnit.id)
          ? prev
          : insertPersonalOrbsAfterOrigin(prev, [
              { id: newUnitId, emoji: newUnit.emoji, title: newUnit.title, subtitle: newUnit.subtitle },
            ])
      );
      const wi = WORLDS.findIndex((w) => w.id === tmpl.worldId);
      if (wi >= 0) setWorldIndex(wi);
      setChatPinnedWorldId(tmpl.worldId);
      setChatSheetMessages((prev) => [
        ...prev,
        userLine,
        {
          id: `createdlog_${Date.now()}`,
          sender: 'one',
          text:
            language === 'he'
              ? `פתחתי יחידה חדשה: ${newUnit.title} · עולם ${worldTitle(tmpl.worldId, language)}`
              : `Opened new unit: ${newUnit.title} · World ${worldTitle(tmpl.worldId, language)}`,
          sentAt: Date.now(),
        },
      ]);
      setActiveUnitId(newUnitId);
    }
    setNowValue('');
    setTimeout(() => setChatStatusPhase('planning'), 900);
    setTimeout(() => setChatStatusPhase('ready'), 1800);
    setTimeout(() => setChatStatusPhase('agent'), 3200);
  }, [
    nowValue,
    activeUnitId,
    flowUnits,
    effectiveChatWorldId,
    language,
    agentUnitCreationMode,
    commitAgentCreationGoal,
  ]);

  const appendUserAttachmentMessage = useCallback(
    (text: string) => {
      setChatStatusPhase('thinking');
      const uid = Date.now();
      const userLine: ChatLine = { id: `u_${uid}`, sender: 'user', text, sentAt: uid };
      const oneLine: ChatLine = {
        id: `o_${uid + 1}`,
        sender: 'one',
        text:
          language === 'he'
            ? 'קיבלתי את הצירוף — נשתמש בו בעדכון הצעדים.'
            : 'Attachment noted — we will fold it into the next step update.',
        sentAt: uid + 1,
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
          case 'attach_ctx_unit_done': {
            setShowAttachSheet(false);
            const title = activeUnit?.title?.trim() || (he ? 'יחידה' : 'Unit');
            runAfterChatOpen(() =>
              appendUserAttachmentMessage(
                he
                  ? `✅ «${title}»: סימנתי שהצעד הנוכחי בוצע — עדכנו אותי אם צריך לפצל צעדים.`
                  : `✅ “${title}”: marked the current step as done—tell me if we should split the next steps.`
              )
            );
            return;
          }
          case 'attach_ctx_unit_blocker': {
            setShowAttachSheet(false);
            const title = activeUnit?.title?.trim() || (he ? 'יחידה' : 'Unit');
            runAfterChatOpen(() =>
              appendUserAttachmentMessage(
                he
                  ? `🧱 «${title}»: יש חוסם או דחף — תארו במשפט מה עוצר אתכם.`
                  : `🧱 “${title}”: there is a blocker or friction—describe in one sentence what is stuck.`
              )
            );
            return;
          }
          case 'attach_ctx_unit_note': {
            setShowAttachSheet(false);
            const title = activeUnit?.title?.trim() || (he ? 'יחידה' : 'Unit');
            runAfterChatOpen(() =>
              appendUserAttachmentMessage(
                he
                  ? `📝 «${title}»: הערה לסוכן —`
                  : `📝 “${title}”: note for the agent—`
              )
            );
            return;
          }
          case 'attach_ctx_world_tip': {
            setShowAttachSheet(false);
            const wid = effectiveChatWorldId;
            runAfterChatOpen(() => {
              if (wid === 'finance' || wid === 'knowledge') {
                appendUserAttachmentMessage(
                  he
                    ? `📋 עולם ${wid}: הדביקו שורה מהלוח (תנועה, נושא, שאלה) ואעזור לפרק לצעדים.`
                    : `📋 ${wid} world: paste a line from the clipboard and I will help break it into steps.`
                );
              } else if (wid === 'health') {
                appendUserAttachmentMessage(
                  he
                    ? '🩺 בריאות: מה מדדים השבוע (שינה, צעדים, דופק)? כתבו משפט אחד.'
                    : '🩺 Health: what will you track this week (sleep, steps, HR)? One sentence.'
                );
              } else if (wid === 'business') {
                appendUserAttachmentMessage(
                  he
                    ? '💼 עבודה: מה הדבר הבא שחייב לצאת? משימה אחת ברורה.'
                    : '💼 Work: what is the single next deliverable?'
                );
              } else if (wid === 'leisure') {
                appendUserAttachmentMessage(
                  he
                    ? '🎭 פנאי: מה בא לכם לתזמן או לגלות? רעיון קצר.'
                    : '🎭 Leisure: what do you want to plan or discover? Short idea.'
                );
              } else if (wid === 'relations') {
                appendUserAttachmentMessage(
                  he
                    ? '💬 קשרים: על מי או מה תרצו עדכון עדין? משפט אחד.'
                    : '💬 Relationships: who or what deserves a gentle check-in? One sentence.'
                );
              } else {
                appendUserAttachmentMessage(
                  he ? '✨ עדכון קצר לסוכן לפי העולם הפעיל.' : '✨ Short update for the agent in the active world.'
                );
              }
            });
            return;
          }
          default:
            setShowAttachSheet(false);
        }
      })();
    },
    [language, openChatSheet, appendUserAttachmentMessage, activeUnit, effectiveChatWorldId]
  );

  const topBarHeight =
    viewMode === 'global' ? insets.top + GLOBAL_FADING_BG_STRIP_PX : insets.top + BAR_EXTRA;
  const bottomBarHeight =
    viewMode === 'global'
      ? insets.bottom + GLOBAL_FADING_BG_STRIP_PX + GLOBAL_BOTTOM_CHROME_LIFT_PX
      : insets.bottom + BAR_EXTRA;
  const paddingVertical = (windowHeight - WHEEL_ITEM_HEIGHT) / 2;

  const largeOrbSize = Math.min(contentWidth, windowHeight) * ORB_SIZE_RATIO;
  const smallOrbSize = largeOrbSize * SMALL_ORB_RATIO;
  /** בגלגל: גודל כשלא במרכז (רק אימוג'י) */
  const wheelOrbSize = Math.min(contentWidth * 0.32, windowHeight * 0.16, 100);
  /** בגלגל: גודל במרכז – כדור גדול כשממורכז (אימוג'י + כותרת + תת־כותרת) */
  const centerOrbSize = Math.min(largeOrbSize * 0.92, WHEEL_ITEM_HEIGHT * 1.4, 380);
  /** שורה נוספת אחרי האורבים: ממורכזת או לחיצה → גלילה מיידית לכדור הסוכן */
  const wheelSlotCount = wheelOrbData.length + 1;
  const wheelSnapOffsets = useMemo(
    () => Array.from({ length: wheelSlotCount }, (_, i) => i * WHEEL_ITEM_HEIGHT),
    [wheelSlotCount]
  );
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

      if (effectiveOrb > AGENT_ORB_INDEX) {
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

  const jumpWheelToAgentOrb = useCallback(() => {
    const y = AGENT_ORB_INDEX * WHEEL_ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y, animated: true });
    setOrbIndex(AGENT_ORB_INDEX);
    resetInactivityTimer({ orbIndex: AGENT_ORB_INDEX });
  }, [resetInactivityTimer]);

  /** לחיצה על פרצוף הסוכן בגלגל הבית → קלף פרופיל סוכן (כמו קיצור מיחידה) */
  const openAgentProfileFromHomeOrb = useCallback(() => {
    if (viewMode !== 'orb') return;
    resetInactivityTimer({ orbIndex: AGENT_ORB_INDEX });
    Keyboard.dismiss();
    setChatOpenedFromOrbProfileShortcut(true);
    setShowAttachSheet(false);
    setShowCredits(false);
    setShowChatMenu(false);
    setAgentUnitCreationMode(false);
    setActiveUnitId(null);
    setChatPinnedWorldId(currentWorldId);
    // חשוב: לא להציג מקלדת בפתיחת פרופיל מה־Home.
    shouldRefocusComposerAfterChatOpenRef.current = false;
    setChatSheetMessages([
      { id: `seed_${Date.now()}`, sender: 'one', text: buildWorldAgentWelcome(currentWorldId), sentAt: Date.now() },
    ]);

    const openAndScrollTop = () => {
      openChatProfile();
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({ y: 0, animated: false });
        lastChatScrollYRef.current = 0;
      });
    };

    if (showChatSheetRef.current) {
      openAndScrollTop();
      return;
    }

    chatBackdropOpacity.setValue(0);
    chatSheetTranslateY.setValue(windowHeight + 180);
    setShowChatSheet(true);
    requestAnimationFrame(() => {
      openAndScrollTop();
    });
  }, [
    viewMode,
    resetInactivityTimer,
    currentWorldId,
    buildWorldAgentWelcome,
    windowHeight,
    openChatProfile,
  ]);

  const openGlobalMode = useCallback(() => {
    if (viewModeRef.current !== 'orb') return;
    if (orbIndexForPullRef.current !== AGENT_ORB_INDEX) return;
    if (overlaysBlockGlobalRef.current) return;
    if (showSplashOverlay) return;
    preGlobalWorldIndexRef.current = worldIndexRef.current;
    setViewMode('global');
  }, [showSplashOverlay]);

  /** פתיחת גלובל למרחב נתון — גם מתוך צ׳אט (אחרי סגירת הקלף) */
  const navigateToGlobalForContext = useCallback(
    (worldId: string) => {
      preGlobalWorldIndexRef.current = worldIndexRef.current;
      const wi = WORLDS.findIndex((w) => w.id === worldId);
      if (wi >= 0) setWorldIndex(wi);
      setChatPinnedWorldId(worldId);
      const open = () => setViewMode('global');
      if (showChatSheetRef.current) {
        closeChatSheet({ direction: 'down', afterClose: open });
      } else {
        open();
      }
    },
    [closeChatSheet]
  );

  const exitGlobalMode = useCallback(() => {
    globalWheelNavigateFromScrollRef.current = false;
    const restoreWi = preGlobalWorldIndexRef.current;
    setWorldIndex(restoreWi);
    setChatPinnedWorldId(WORLDS[restoreWi]?.id ?? WORLDS[0]?.id ?? 'personal');
    setViewMode('orb');
    const y = AGENT_ORB_INDEX * WHEEL_ITEM_HEIGHT;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      scrollY.setValue(y);
      setOrbIndex(AGENT_ORB_INDEX);
    });
    resetInactivityTimer({ orbIndex: AGENT_ORB_INDEX });
  }, [scrollY, resetInactivityTimer]);

  useEffect(() => {
    if (viewMode !== 'global') return;
    globalEnterOpacity.setValue(0);
    globalEnterTranslateY.setValue(22);
    Animated.parallel([
      Animated.timing(globalEnterOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(globalEnterTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [viewMode, globalEnterOpacity, globalEnterTranslateY]);

  const onOrbScrollMove = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      lastScrollYRef.current = y;
      scrollY.setValue(y);
      const H = WHEEL_ITEM_HEIGHT;
      const liveRaw = Math.round(y / H);
      const liveIndex = Math.max(0, Math.min(liveRaw, wheelOrbData.length - 1));
      if (liveIndex !== orbIndexForPullRef.current) {
        setOrbIndex(liveIndex);
      }
      resetInactivityTimer();
      if (viewModeRef.current !== 'orb') return;
      if (overlaysBlockGlobalRef.current) return;
      if (showSplashOverlay) return;
      const agentSnapY = AGENT_ORB_INDEX * H;
      /** גלילה קצרה למעלה מהסוכן / אזור גלובל–סוכן → גלובל מיד (בלי להמתין למרכוז חץ הגלובל) */
      if (
        orbIndexForPullRef.current <= AGENT_ORB_INDEX &&
        y >= 0 &&
        y < agentSnapY - GLOBAL_WHEEL_EARLY_OPEN_SCROLL_PX &&
        !globalWheelNavigateFromScrollRef.current
      ) {
        globalWheelNavigateFromScrollRef.current = true;
        requestAnimationFrame(() => {
          navigateToGlobalForContext(currentWorldId);
        });
        return;
      }
      if (orbIndexForPullRef.current !== AGENT_ORB_INDEX) return;
      if (y < -GLOBAL_PULL_ENTER_PX) {
        openGlobalMode();
      }
    },
    [scrollY, wheelOrbData.length, resetInactivityTimer, openGlobalMode, showSplashOverlay, navigateToGlobalForContext, currentWorldId]
  );

  const onOrbScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const H = WHEEL_ITEM_HEIGHT;
      const raw = Math.round(y / H);
      if (raw >= wheelOrbData.length) {
        jumpWheelToAgentOrb();
        return;
      }
      const index = Math.max(0, Math.min(raw, wheelOrbData.length - 1));
      setOrbIndex(index);
      resetInactivityTimer({ orbIndex: index });
      if (
        index === GLOBAL_ORB_INDEX &&
        !globalWheelNavigateFromScrollRef.current &&
        !overlaysBlockGlobalRef.current &&
        !showSplashOverlay
      ) {
        globalWheelNavigateFromScrollRef.current = true;
        requestAnimationFrame(() => {
          navigateToGlobalForContext(currentWorldId);
        });
      }
    },
    [
      wheelOrbData.length,
      jumpWheelToAgentOrb,
      resetInactivityTimer,
      navigateToGlobalForContext,
      currentWorldId,
      showSplashOverlay,
    ]
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

  /** אחרי יצירת יחידה ממסך המטרה — סגירת צ׳אט, מיקוד כדור בבית, פתיחת צ׳אט יחידה */
  useEffect(() => {
    if (showChatSheet) return;
    const uid = pendingReopenUnitChatRef.current;
    if (!uid) return;
    const unit = flowUnits.find((u) => u.id === uid);
    if (!unit) return;
    pendingReopenUnitChatRef.current = null;
    const wi = WORLDS.findIndex((w) => w.id === unit.worldId);
    if (wi >= 0) setWorldIndex(wi);
    setTimeout(() => {
      const idx = wheelOrbDataRef.current.findIndex((o) => o.id === uid);
      if (idx >= 0) {
        setOrbIndex(idx);
        scrollToOrb(idx);
      }
      setTimeout(() => {
        setActiveUnitId(uid);
        setChatPinnedWorldId(unit.worldId);
        shouldRefocusComposerAfterChatOpenRef.current = true;
        setShowChatSheet(true);
      }, 380);
    }, 90);
  }, [showChatSheet, flowUnits, scrollToOrb]);

  const stepOrb = useCallback((dir: 1 | -1) => {
    const current = Math.max(0, Math.min(orbIndexForPullRef.current, wheelOrbData.length - 1));
    const next = Math.max(0, Math.min(current + dir, wheelOrbData.length - 1));
    if (next === current) return;
    setOrbIndex(next);
    resetInactivityTimer({ orbIndex: next });
    scrollToOrb(next);
  }, [wheelOrbData.length, resetInactivityTimer, scrollToOrb]);

  const handleHomeDoubleTap = useCallback(
    (tapY: number) => {
      const now = Date.now();
      const deltaMs = now - lastHomeTapAtRef.current;
      const deltaY = Math.abs(tapY - lastHomeTapYRef.current);
      const goingToAgentOrb = orbIndex > AGENT_ORB_INDEX && deltaMs > 40 && deltaMs < 320 && deltaY < 56;
      if (goingToAgentOrb) {
        scrollToOrb(AGENT_ORB_INDEX);
        resetInactivityTimer({ orbIndex: AGENT_ORB_INDEX });
      } else {
        resetInactivityTimer();
      }
      lastHomeTapAtRef.current = now;
      lastHomeTapYRef.current = tapY;
    },
    [orbIndex, resetInactivityTimer, scrollToOrb]
  );

  /** במחשב: גלילה עם גלגלת העכבר מעבירה כדור אחד בכל פעם; בראש הגלגל + גלילה למעלה → גלובל */
  const handleWheel = useCallback((e: { preventDefault?: () => void; nativeEvent?: { deltaY: number }; deltaY?: number }) => {
    if (Platform.OS !== 'web') return;
    resetInactivityTimer();
    e.preventDefault?.();
    if (wheelStepLockRef.current) return;
    const deltaY = e.nativeEvent?.deltaY ?? (e as { deltaY: number }).deltaY ?? 0;
    const y = lastScrollYRef.current;
    const i = Math.max(0, Math.min(orbIndexForPullRef.current, wheelOrbData.length - 1));
    const agentY = AGENT_ORB_INDEX * WHEEL_ITEM_HEIGHT;
    if (
      deltaY < 0 &&
      i === AGENT_ORB_INDEX &&
      y <= agentY + 1 &&
      orbIndex === AGENT_ORB_INDEX &&
      viewMode === 'orb' &&
      !showSplashOverlay
    ) {
      openGlobalMode();
      return;
    }
    wheelStepLockRef.current = true;
    if (wheelStepLockTimerRef.current) clearTimeout(wheelStepLockTimerRef.current);
    wheelStepLockTimerRef.current = setTimeout(() => {
      wheelStepLockRef.current = false;
    }, 160);
    stepOrb(deltaY > 0 ? 1 : -1);
  }, [wheelOrbData.length, resetInactivityTimer, viewMode, showSplashOverlay, openGlobalMode, stepOrb]);

  /** פריט אחד בגלגל: גודל כדור + opacity טקסט מונפשים לפי scroll (מעבר מהיר וחלק, בלי קפיצה). */
  const renderWheelItem = useCallback((item: OrbItem, index: number) => {
    const H = WHEEL_ITEM_HEIGHT;
    const i = index;
    const isGlobalSlot = item.id === GLOBAL_WHEEL_ORB_ID;
    const isAgentSlot = index === AGENT_ORB_INDEX;
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
    const sizeRange = [(i - 1) * H, (i - 0.42) * H, i * H, (i + 0.42) * H, (i + 1) * H];
    const agentCenterOrbPeak = centerOrbSize + WHEEL_AGENT_CENTER_ORB_EXTRA_PX;
    const orbSize = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: isAgentSlot
        ? [wheelOrbSize, wheelOrbSize, agentCenterOrbPeak, wheelOrbSize, wheelOrbSize]
        : [wheelOrbSize, wheelOrbSize, centerOrbSize, wheelOrbSize, wheelOrbSize],
      extrapolate: 'clamp',
    });
    /** סקייל פנימי רציף לאימוג׳י/פרצוף כדי למנוע "קפיצות" כשהכדור קטן מהמרכז */
    const wheelInnerContentScale = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: isAgentSlot ? [0.78, 0.9, 1, 0.9, 0.78] : [0.74, 0.88, 1, 0.88, 0.74],
      extrapolate: 'clamp',
    });
    /** טקסט מופיע מהר – טווח רחב ל־1 כדי שבחזרה לכדור ראשי התוכן נראה מיד */
    const textOpacityRange = [(i - 0.38) * H, (i - 0.16) * H, (i + 0.16) * H, (i + 0.38) * H];
    const textOpacity = scrollY.interpolate({
      inputRange: textOpacityRange,
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
    /** כדור הסוכן מוגבה מעל לכותרת – רווח ביניהם כשממורכז (גדלנו כי הפרצוף צריך לצאת מעל המסכה + תאג מתחת) */
    const emojiMarginTop = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, isAgentSlot ? -162 : -135, 0, 0],
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
      outputRange: [0, 0, -33, 0, 0],
      extrapolate: 'clamp',
    });
    /** פרצוף/איקון סוכן: במרכז — 25px מעלה נוספים; בשכנים — כמו קודם (לא נדחף לתוך המסכה) */
    const wheelEmojiInnerTranslateY = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: isAgentSlot
        ? [
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y - WHEEL_AGENT_FACE_EXTRA_LIFT_WHEN_CENTERED_PX,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
          ]
        : [
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
            WHEEL_AGENT_FACE_BASE_TRANSLATE_Y,
          ],
      extrapolate: 'clamp',
    });
    /** מבט למעלה/מטה לפי מיקום גלילה (לא קפיצה רק אחרי snap לכדור) */
    const agentEyesPersonalGazeY =
      isAgentSlot
        ? scrollY.interpolate({
            inputRange: [(AGENT_ORB_INDEX - 1) * H, AGENT_ORB_INDEX * H, (AGENT_ORB_INDEX + 1) * H],
            outputRange: [-1.8, 0, 2.4],
            extrapolate: 'clamp',
          })
        : null;
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
    /** רקע עיגול הסוכן — תמיד שקוף (OrbAgent מצייר בעצמו) */
    const emojiCircleBg = isAgentSlot ? 'transparent' : 'transparent';
    /** גודל עיגול הסוכן — תמיד מלא (פרצוף בכל העולמות) */
    const agentCircleSize = EMOJI_CIRCLE_SIZE;
    const agentIconSize = WORLD_ICON_SIZE;
    const unitProgress = isAgentSlot || isGlobalSlot ? null : flowUnits.find((u) => u.id === item.id)?.progress;
    const unitProgressPct = unitProgress != null ? Math.max(0, Math.min(100, unitProgress)) / 100 : null;
    const unitProgressColor = progressColorByPct(unitProgressPct ?? 0, isDark);
    /** כדור ראשון מתחת לסוכן: כשהוא קטן — חץ מטה; כשמתקרב למרכז — חזרה לאימוג'י */
    const hintScrollBase = AGENT_ORB_INDEX * H;
    const firstNeighborScrollHintArrowOpacity =
      index === AGENT_ORB_INDEX + 1
        ? scrollY.interpolate({
            inputRange: [hintScrollBase, hintScrollBase + H * 0.38, hintScrollBase + H * 0.72],
            outputRange: [1, 0.22, 0],
            extrapolate: 'clamp',
          })
        : null;
    const firstNeighborScrollHintEmojiOpacity =
      index === AGENT_ORB_INDEX + 1
        ? scrollY.interpolate({
            inputRange: [hintScrollBase, hintScrollBase + H * 0.34, hintScrollBase + H * 0.72],
            outputRange: [0, 0.72, 1],
            extrapolate: 'clamp',
          })
        : null;
    const scrollHintArrowSize = Math.max(20, Math.round(EMOJI_CIRCLE_SIZE * 0.44));
    /** היסט נוסף לשורת הכדור מתחת לסוכן — מירבי כשהסוכן ממורכז; מתאפס כשהכדור הזה מתמרכן */
    const rowTranslateY =
      index === AGENT_ORB_INDEX + 1
        ? Animated.add(
            Animated.add(orbTranslateY, neighborDownShift),
            scrollY.interpolate({
              inputRange: [H * 0.9, H, 2 * H],
              outputRange: [0, 50, 0],
              extrapolate: 'clamp',
            })
          )
        : Animated.add(orbTranslateY, neighborDownShift);
    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={1}
        onLongPress={() => {
          if (isAgentSlot && orbIndex === index) setShowSpacePicker(true);
        }}
        delayLongPress={340}
        onPress={() => {
          resetInactivityTimer({ orbIndex: index });
          if (orbIndex === index) {
            if (isGlobalSlot) {
              navigateToGlobalForContext(currentWorldId);
              return;
            }
            if (isAgentSlot) {
              openAgentProfileFromHomeOrb();
              return;
            }
            /** סוכן/יחידה: קידום ברודקאסט רק מלחיצה על אזור הטקסט (חצי שמאל/ימין) */
            return;
          }
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
              transform: [{ scale }, { translateY: rowTranslateY }],
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
                  overflow: isAgentSlot ? ('visible' as const) : ('hidden' as const),
                },
              ]}
            >
            <View style={[styles.wheelOrbInner, isAgentSlot ? { overflow: 'visible' as const } : null]}>
              <Animated.View
                style={{
                  marginTop: Animated.add(emojiMarginTop, centerContentLift),
                  transform: [
                    { translateY: wheelEmojiInnerTranslateY },
                    { scale: isGlobalSlot || index === AGENT_ORB_INDEX + 1 ? 1 : wheelInnerContentScale },
                  ],
                }}
              >
                <Animated.View
                  ref={isAgentSlot ? wheelOrbRef : undefined}
                  style={[
                    styles.wheelOrbEmojiCircle,
                    {
                      width: agentCircleSize,
                      height: agentCircleSize,
                      borderRadius: agentCircleSize / 2,
                      borderWidth: isGlobalSlot ? 0 : EMOJI_CIRCLE_BORDER_WIDTH,
                      borderColor: isGlobalSlot ? 'transparent' : EMOJI_CIRCLE_BORDER_COLOR,
                      backgroundColor: emojiCircleBg,
                    },
                  ]}
                >
                  {isGlobalSlot ? (
                    <View
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        transform: [{ translateY: 6 }],
                      }}
                    >
                      <OrbScrollUpHintSvg size={scrollHintArrowSize} color={colors.text} />
                    </View>
                  ) : isAgentSlot ? (
                      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                        <OrbAgent
                          size={agentCircleSize}
                          state="idle"
                          mode="home"
                          showFace
                          gazeX={agentWorldLookX}
                          gazeY={agentEyesPersonalGazeY ?? 0}
                          labelLines={[]}
                          tappable={orbIndex === index}
                          onPress={openAgentProfileFromHomeOrb}
                        />
                      </View>
                  ) : index === AGENT_ORB_INDEX + 1 && firstNeighborScrollHintArrowOpacity && firstNeighborScrollHintEmojiOpacity ? (
                    <View
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: firstNeighborScrollHintArrowOpacity,
                            transform: [{ translateY: 16 }],
                          },
                        ]}
                      >
                        <OrbScrollDownHintSvg size={scrollHintArrowSize} color={colors.text} />
                      </Animated.View>
                      <Animated.View
                        style={{
                          justifyContent: 'center',
                          alignItems: 'center',
                          opacity: firstNeighborScrollHintEmojiOpacity,
                        }}
                      >
                        <Text style={styles.wheelOrbEmoji}>{item.emoji}</Text>
                      </Animated.View>
                    </View>
                  ) : (
                    <Text style={styles.wheelOrbEmoji}>{item.emoji}</Text>
                  )}
                </Animated.View>
              </Animated.View>
              {!isAgentSlot ? <View pointerEvents="none" style={styles.wheelOrbBottomSafeArea} /> : null}
              {isAgentSlot ? (() => {
                const tagColor = currentWorldColor === '#ffffff' ? colors.textSecondary : currentWorldColor;
                return (
                <Animated.View
                  pointerEvents={orbIndex === index ? 'box-none' : 'none'}
                  style={[
                    styles.agentWorldTagWrap,
                    { opacity: textOpacity, transform: [{ translateY: centerContentLift }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[
                      styles.agentWorldTag,
                      {
                        backgroundColor: hexToRgba(tagColor, isDark ? 0.18 : 0.12),
                        borderColor: hexToRgba(tagColor, isDark ? 0.38 : 0.28),
                      },
                    ]}
                    onPress={() => setWorldIndex(cycleWorldNext)}
                    {...(orbIndex === index ? worldSwipeResponder.panHandlers : {})}
                  >
                    <Text style={[styles.agentWorldTagText, { color: tagColor }]}>
                      {worldTitle(currentWorldId, language)}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
                );
              })() : null}
              <Animated.View
                style={[
                  styles.wheelOrbTextBlock,
                  { opacity: textOpacity, marginTop: Animated.add(textBlockMarginTop, centerContentLift) },
                ]}
                pointerEvents={orbIndex === index && !isGlobalSlot ? 'box-none' : 'none'}
              >
                {isGlobalSlot ? (
                  <Text style={[styles.wheelOrbSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                ) : (
                  <View
                    style={styles.wheelOrbBroadcastTapPad}
                    onLayout={(ev) => {
                      broadcastPadWidthByOrbRef.current[index] = ev.nativeEvent.layout.width;
                    }}
                  >
                    <Pressable
                      style={StyleSheet.absoluteFillObject}
                      disabled={orbIndex !== index}
                      onPress={(e) => {
                        if (orbIndex !== index) return;
                        const w = broadcastPadWidthByOrbRef.current[index] || 1;
                        const x = e.nativeEvent.locationX;
                        /** נקודות למטה: ימין/שמאל פיזי; תוכן ההודעה — הפוך (ימין = קדימה בהתאם לקריאה) */
                        const onPhysicalRightHalf = x >= w / 2;
                        triggerBroadcastDotFlash(onPhysicalRightHalf ? 'right' : 'left');
                        const advanceBroadcast = !onPhysicalRightHalf;
                        if (isAgentSlot) {
                          if (advanceBroadcast) setAgentBroadcastKick((k) => k + 1);
                          else setAgentBroadcastBackwardKick((k) => k + 1);
                        } else if (advanceBroadcast) {
                          setUnitBroadcastKickByOrbId((prev) => ({
                            ...prev,
                            [item.id]: (prev[item.id] ?? 0) + 1,
                          }));
                        } else {
                          setUnitBroadcastBackwardByOrbId((prev) => ({
                            ...prev,
                            [item.id]: (prev[item.id] ?? 0) + 1,
                          }));
                        }
                      }}
                    >
                    {isAgentSlot ? (
                      <FadeBroadcastBlock
                        messages={broadcastMessagesForAgentWorld(currentWorldId, language, flowUnits)}
                        visible={orbIndex === index}
                        titleColor={theme === 'dark' ? '#ffffff' : colors.text}
                        subtitleColor={colors.textSecondary}
                        fixedTitle={
                          currentWorldId === 'personal' ? personalGreeting : worldTitle(currentWorldId, language)
                        }
                        advanceRequest={agentBroadcastKick}
                        backwardRequest={agentBroadcastBackwardKick}
                        onBroadcastLoopComplete={() => {
                          if (showChatSheetRef.current || showAttachSheetRef.current) return;
                          setWorldIndex((wi) => cycleWorldNext(wi));
                        }}
                        onBroadcastLoopBackwardComplete={() => {
                          if (showChatSheetRef.current || showAttachSheetRef.current) return;
                          setWorldIndex((wi) => cycleWorldPrev(wi));
                        }}
                        titleTextAlign="center"
                        subtitleTextAlign="center"
                        writingDirection={language === 'he' ? 'rtl' : undefined}
                        primaryTitleOffsetY={WHEEL_AGENT_BROADCAST_PRIMARY_TITLE_OFFSET_Y}
                        subtitleMarginTop={WHEEL_AGENT_BROADCAST_SUBTITLE_MARGIN_TOP}
                      />
                    ) : (
                      <FadeBroadcastBlock
                        messages={broadcastMessagesForOrbItem(item, flowUnits, language)}
                        visible={orbIndex === index}
                        titleColor={colors.text}
                        subtitleColor={colors.textSecondary}
                        fixedTitle={item.title}
                        titleProgressPct={orbIndex === index ? unitProgressPct : null}
                        titleProgressColor={unitProgressColor}
                        titleProgressTrackColor={hexToRgba(colors.textSecondary, isDark ? 0.34 : 0.18)}
                        advanceRequest={unitBroadcastKickByOrbId[item.id] ?? 0}
                        backwardRequest={unitBroadcastBackwardByOrbId[item.id] ?? 0}
                        onBroadcastLoopComplete={() => {
                          if (showChatSheetRef.current || showAttachSheetRef.current) return;
                          scrollToOrb(Math.min(index + 1, wheelOrbData.length));
                        }}
                        titleTextAlign="center"
                        subtitleTextAlign="center"
                        writingDirection={language === 'he' ? 'rtl' : undefined}
                      />
                    )}
                    </Pressable>
                  </View>
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
    isDark,
    peripheralOrbsOpacity,
    orbIndex,
    wheelOrbData,
    agentCircleColor,
    currentWorldId,
    currentWorldColor,
    wheelOrbRef,
    flowUnits,
    resetInactivityTimer,
    setWorldIndex,
    agentBroadcastKick,
    agentBroadcastBackwardKick,
    unitBroadcastKickByOrbId,
    unitBroadcastBackwardByOrbId,
    triggerBroadcastDotFlash,
    language,
    navigateToGlobalForContext,
    personalGreeting,
    worldIndex,
    cycleWorldNext,
    cycleWorldPrev,
    openAgentProfileFromHomeOrb,
  ]);

  /** כדור־שליח אחרי האורב האחרון: ממורכז או לחיצה → קפיצה לכדור הסוכן */
  const renderWheelTopSentinel = useCallback(() => {
    const H = WHEEL_ITEM_HEIGHT;
    const i = wheelOrbData.length;
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
    const sizeRange = [(i - 1) * H, (i - 0.42) * H, i * H, (i + 0.42) * H, (i + 1) * H];
    const orbSize = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [wheelOrbSize, wheelOrbSize, centerOrbSize, wheelOrbSize, wheelOrbSize],
      extrapolate: 'clamp',
    });
    const textOpacityRange = [(i - 0.38) * H, (i - 0.16) * H, (i + 0.16) * H, (i + 0.38) * H];
    const textOpacity = scrollY.interpolate({
      inputRange: textOpacityRange,
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
    const emojiMarginTop = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -135, 0, 0],
      extrapolate: 'clamp',
    });
    const textBlockMarginTop = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -10, 0, 0],
      extrapolate: 'clamp',
    });
    const centerContentLift = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -33, 0, 0],
      extrapolate: 'clamp',
    });
    const orbTranslateY = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [0, 0, -25, 0, 0],
      extrapolate: 'clamp',
    });
    const neighborDownShift = scrollY.interpolate({
      inputRange: sizeRange,
      outputRange: [24, 16, 0, 16, 24],
      extrapolate: 'clamp',
    });
    const neighborFadeOpacity = 1;
    const debugOutline = SHOW_ORB_DEBUG_OUTLINE ? styles.orbDebugOutline : undefined;
    const circleSize = EMOJI_CIRCLE_SIZE;
    const hintSize = Math.max(20, Math.round(circleSize * 0.44));
    const hasOpenUnitsInWorld = flowUnits.some((u) => u.worldId === currentWorldId && u.status !== 'done');
    const sentinelLabel = hasOpenUnitsInWorld
      ? language === 'he'
        ? 'חזרה לסוכן'
        : 'Back to agent'
      : language === 'he'
        ? 'צ׳אט סוכן'
        : 'Agent chat';

    return (
      <TouchableOpacity
        key="__wheel_top_sentinel__"
        activeOpacity={1}
        onPress={() => {
          if (hasOpenUnitsInWorld) {
            jumpWheelToAgentOrb();
            return;
          }
          resetInactivityTimer();
          openChatSheet();
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
                <Animated.View style={{ marginTop: Animated.add(emojiMarginTop, centerContentLift), transform: [{ translateY: -10 }] }}>
                  <View
                    style={[
                      styles.wheelOrbEmojiCircle,
                      {
                        width: circleSize,
                        height: circleSize,
                        borderRadius: circleSize / 2,
                        borderWidth: EMOJI_CIRCLE_BORDER_WIDTH,
                        borderColor: EMOJI_CIRCLE_BORDER_COLOR,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    {hasOpenUnitsInWorld ? (
                      <OrbScrollUpHintSvg size={hintSize} color={colors.text} />
                    ) : (
                      <PlusIconSvg size={hintSize} color={colors.text} />
                    )}
                  </View>
                </Animated.View>
                <View pointerEvents="none" style={styles.wheelOrbBottomSafeArea} />
                <Animated.View
                  style={[styles.wheelOrbTextBlock, { opacity: textOpacity, marginTop: Animated.add(textBlockMarginTop, centerContentLift) }]}
                  pointerEvents="none"
                >
                  <Text style={[styles.wheelOrbSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {sentinelLabel}
                  </Text>
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
    colors,
    jumpWheelToAgentOrb,
    wheelOrbData.length,
    language,
    flowUnits,
    currentWorldId,
    openChatSheet,
    resetInactivityTimer,
  ]);

  const wheelContentHeight = paddingVertical * 2 + wheelSlotCount * WHEEL_ITEM_HEIGHT;

  /** החלפת עולם – גלילה חזרה לכדור הסוכן + איפוס קידום ברודקאסט בטאפ */
  useEffect(() => {
    const y = AGENT_ORB_INDEX * WHEEL_ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y, animated: false });
    scrollY.setValue(y);
    setOrbIndex(AGENT_ORB_INDEX);
    setAgentBroadcastKick(0);
    setUnitBroadcastKickByOrbId({});
  }, [worldIndex]);

  useEffect(
    () => () => {
      if (wheelStepLockTimerRef.current) clearTimeout(wheelStepLockTimerRef.current);
    },
    []
  );

  /** לופ עולמות בבית: רק עולמות שיש בהם תהליך פתוח (או עולם ראשי של החשבון) */
  function cycleWorldPrev(prev: number): number {
    const allowed = activeHomeWorldIds
      .map((id) => WORLDS.findIndex((w) => w.id === id))
      .filter((idx) => idx >= 0);
    if (allowed.length === 0) return prev;
    const pos = allowed.indexOf(prev);
    const base = pos >= 0 ? pos : 0;
    return allowed[(base - 1 + allowed.length) % allowed.length];
  }
  function cycleWorldNext(prev: number): number {
    const allowed = activeHomeWorldIds
      .map((id) => WORLDS.findIndex((w) => w.id === id))
      .filter((idx) => idx >= 0);
    if (allowed.length === 0) return prev;
    const pos = allowed.indexOf(prev);
    const base = pos >= 0 ? pos : 0;
    return allowed[(base + 1) % allowed.length];
  }

  /** במחשב: חצים ימינה/שמאלה בכדור הסוכן – החלפת עולם (לופ) */
  useEffect(() => {
    if (Platform.OS !== 'web' || orbIndex !== AGENT_ORB_INDEX || viewMode !== 'orb') return;
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
  }, [orbIndex, viewMode, cycleWorldPrev, cycleWorldNext]);

  /** במחשב: חצי מעלה/מטה (וגם Ctrl+Tab / Ctrl+Shift+Tab) לדילוג מהיר בין כדורים */
  useEffect(() => {
    if (Platform.OS !== 'web' || viewMode !== 'orb') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        stepOrb(1);
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        stepOrb(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, stepOrb]);

  /** סוויפ אופקי (רק בכדור הסוכן) – החלפת עולם בלופ אינסופי */
  const worldSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) setWorldIndex(cycleWorldNext);
        else if (g.dx < -40) setWorldIndex(cycleWorldPrev);
      },
    })
  ).current;

  /** מובייל: גרירה אנכית מהירה לדילוג רציף בין כדורים */
  const mobileWheelQuickNavResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Platform.OS !== 'web' && viewModeRef.current === 'orb' && Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          mobileQuickDragDeltaRef.current = 0;
          setMobileQuickDragActive(true);
        },
        onPanResponderMove: (_, g) => {
          const delta = g.dy - mobileQuickDragDeltaRef.current;
          const STEP_PX = 46;
          if (Math.abs(delta) < STEP_PX) return;
          const steps = Math.floor(Math.abs(delta) / STEP_PX);
          const dir: 1 | -1 = delta > 0 ? -1 : 1;
          for (let i = 0; i < steps; i += 1) stepOrb(dir);
          mobileQuickDragDeltaRef.current += (delta > 0 ? 1 : -1) * steps * STEP_PX;
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: () => {
          setMobileQuickDragActive(false);
        },
        onPanResponderTerminate: () => {
          setMobileQuickDragActive(false);
        },
      }),
    [stepOrb]
  );

  /** גרדיאנט: [מלא, …, שקוף] – שני הברים מלא בקצה המכשיר, שקוף לכיוון התוכן. */
  const gradientColorsBase = GRADIENT_STOPS.map((_, i) =>
    hexToRgba(colors.background, ALPHAS[i])
  ) as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
  const gradientColorsFromOpaque = [...gradientColorsBase].reverse() as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
  const gradientLocations = GRADIENT_STOPS as unknown as readonly [number, number, ...number[]];
  /** גלובל: כמו fading-bg.svg — רקע מלא בקצה (שעון למעלה / אזור X למטה) → שקוף לכיוון התוכן */
  const globalChromeFadeColors = useMemo(
    () => [colors.background, hexToRgba(colors.background, 0)] as readonly [string, string],
    [colors.background]
  );

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
    orbIndex === AGENT_ORB_INDEX &&
    !showChatSheet &&
    !showCredits &&
    !showAttachSheet &&
    !showAgentCard;

  /** כדור יחידה בבית: אחרי idle בלי תזוזה – שורת מצב נעלמת; תזוזה מחזירה (לא חל על סוכן) */
  const hideStatusBarForUnitOrbIdle =
    Platform.OS !== 'web' &&
    viewMode === 'orb' &&
    orbIndex > AGENT_ORB_INDEX &&
    !unitOrbSystemBarVisible &&
    !showChatSheet &&
    !showCredits &&
    !showAttachSheet &&
    !showAgentCard;

  const systemStatusBarHidden = hideStatusBarForAgentOrbHome || hideStatusBarForUnitOrbIdle;

  const creditsFloatingVisible =
    viewMode === 'global' &&
    !showCredits &&
    !showChatSheet &&
    !showAttachSheet &&
    !showAgentCard &&
    !showSplashOverlay;

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
          {...(viewMode === 'orb' && orbIndex === AGENT_ORB_INDEX ? worldSwipeResponder.panHandlers : null)}
          {...(Platform.OS !== 'web' ? mobileWheelQuickNavResponder.panHandlers : null)}
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
            onScrollBeginDrag={() => {
              globalWheelNavigateFromScrollRef.current = false;
            }}
            scrollEnabled={Platform.OS === 'web' ? true : !mobileQuickDragActive}
            showsVerticalScrollIndicator={false}
            snapToOffsets={wheelSnapOffsets}
            snapToAlignment="start"
            decelerationRate="normal"
            bounces
            alwaysBounceVertical
            onScroll={onOrbScrollMove}
            onMomentumScrollEnd={onOrbScrollEnd}
            scrollEventThrottle={16}
          >
            {wheelOrbData.map((item, i) => renderWheelItem(item, i))}
            {renderWheelTopSentinel()}
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
                  <PlusIconSvg size={24} color={colors.textSecondary} />
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
                    placeholderTextColor={nowFieldPlaceholderColor}
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

      {viewMode === 'global' && (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                zIndex: 11,
                backgroundColor: colors.background,
                opacity: globalEnterOpacity,
                transform: [{ translateY: globalEnterTranslateY }],
                direction: 'ltr',
              },
            ]}
          >
            <ScrollView
              style={{ flex: 1, direction: 'ltr' }}
              contentContainerStyle={{
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 140 + GLOBAL_BOTTOM_CHROME_LIFT_PX,
                paddingHorizontal: 16,
                overflow: 'visible' as const,
                width: '100%',
                alignItems: 'stretch',
                direction: 'ltr',
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.globalScrollInner}>
                <View style={[styles.globalOnePlatter, globalOnePlatterLayout]}>
                {/* assets/icons/Background-Ovarly.svg — דרך BackgroundOvarly + scale בגלובל */}
                <View style={styles.globalOneBgSlot} pointerEvents="none">
                  <View
                    style={{ flex: 1, opacity: theme === 'light' ? 0.7 : 0.8 }}
                    pointerEvents="none"
                  >
                    <BackgroundOvarly
                      gradientId="globalPlatterOvalGradient"
                      backgroundColor={colors.background}
                      midColor={ovalMidLight}
                      bottomColor={ovalBottomLight}
                      scale={1.07}
                    />
                  </View>
                </View>
                <View style={styles.globalBroadcastBlock}>
                  <View style={{ marginBottom: 8, alignSelf: 'center' }}>
                    <WorldMiniIcon worldId={currentWorldId} color={currentWorldColor} size={42} />
                  </View>
                  <View style={styles.globalBroadcastCopyStretch}>
                    <FadeBroadcastBlock
                      messages={globalBroadcastMessages}
                      visible
                      titleColor={colors.text}
                      subtitleColor={colors.textSecondary}
                      fixedTitle={globalNewInOneTitle}
                      titleTextAlign="center"
                      subtitleTextAlign="center"
                      writingDirection={globalHebrewUi ? 'rtl' : undefined}
                      fullWidthCopy
                    />
                  </View>
                </View>
                </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.globalWorldChipsScrollViewport}
                contentContainerStyle={styles.globalWorldChipsScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {WORLDS.map((w, wi) => {
                  const active = wi === worldIndex;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      activeOpacity={0.82}
                      onPress={() => {
                        setWorldIndex(wi);
                        setChatPinnedWorldId(w.id);
                      }}
                      style={[
                        styles.globalWorldChip,
                        {
                          backgroundColor: active ? hexToRgba(w.color, 0.16) : colors.surface,
                          borderColor: active ? hexToRgba(w.color, 0.52) : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={worldTitle(w.id, language)}
                      accessibilityState={{ selected: active }}
                    >
                      <WorldMiniIcon worldId={w.id} color={w.color} size={22} />
                      <Text
                        style={[
                          styles.globalWorldChipLabel,
                          { color: active ? colors.text : colors.textSecondary },
                          globalHebrewUi
                            ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const } as const)
                            : null,
                        ]}
                        numberOfLines={1}
                      >
                        {worldTitle(w.id, language)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.globalSectionHeading, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]}>
                {language === 'he' ? 'אגרגט מהשוק' : 'Aggregated market data'}
              </Text>
              {globalDiscoverySections.aggregate.map((row) => (
                <View key={row.key} style={[styles.globalListRow, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.globalListTitle, { color: colors.text }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.title}</Text>
                  <Text style={[styles.globalListSub, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]} numberOfLines={3}>
                    {row.sub}
                  </Text>
                </View>
              ))}

              <Text
                style={[styles.globalSectionHeading, { color: colors.textSecondary, marginTop: 18 }, globalHebrewUi ? styles.globalForceRtlText : null]}
              >
                {language === 'he' ? 'גילוי ספקים ומוצרים' : 'Services & product discovery'}
              </Text>
              {globalDiscoverySections.discovery.map((row) => (
                <View key={row.key} style={[styles.globalListRow, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.globalListTitle, { color: colors.text }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.title}</Text>
                  <Text style={[styles.globalListSub, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]} numberOfLines={3}>
                    {row.sub}
                  </Text>
                </View>
              ))}

              <Text
                style={[styles.globalSectionHeading, { color: colors.textSecondary, marginTop: 18 }, globalHebrewUi ? styles.globalForceRtlText : null]}
              >
                {language === 'he' ? 'נושאי חיפוש נפוצים (סוכנים)' : 'Common agent search themes'}
              </Text>
              {globalDiscoverySections.agentSearchThemes.map((row) => (
                <View key={row.key} style={[styles.globalListRow, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.globalListTitle, { color: colors.text }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.title}</Text>
                  <Text style={[styles.globalListSub, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]} numberOfLines={2}>
                    {row.sub}
                  </Text>
                </View>
              ))}

              <Text
                style={[styles.globalSectionHeading, { color: colors.textSecondary, marginTop: 18 }, globalHebrewUi ? styles.globalForceRtlText : null]}
              >
                {language === 'he' ? 'יחידות פופולריות' : 'Popular units'}
              </Text>
              {globalDiscoverySections.unitsHot.length === 0 ? (
                <Text style={[styles.globalListSub, { color: colors.textSecondary, paddingHorizontal: 4 }, globalHebrewUi ? styles.globalForceRtlText : null]}>
                  {language === 'he' ? 'אין עדיין יחידות בעולם הזה — צרו מהגלובל או מהבית.' : 'No units in this world yet — create from Global or Home.'}
                </Text>
              ) : (
                globalDiscoverySections.unitsHot.map((row) => (
                  <View key={row.key} style={[styles.globalListRow, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.globalListTitle, { color: colors.text }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.title}</Text>
                    <Text style={[styles.globalListSub, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.sub}</Text>
                  </View>
                ))
              )}

              <Text
                style={[styles.globalSectionHeading, { color: colors.textSecondary, marginTop: 18 }, globalHebrewUi ? styles.globalForceRtlText : null]}
              >
                {language === 'he' ? 'דופק שוק' : 'Market pulse'}
              </Text>
              {globalDiscoverySections.marketPulse.map((row) => (
                <View key={row.key} style={[styles.globalListRow, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.globalListTitle, { color: colors.text }, globalHebrewUi ? styles.globalForceRtlText : null]}>{row.title}</Text>
                  <Text style={[styles.globalListSub, { color: colors.textSecondary }, globalHebrewUi ? styles.globalForceRtlText : null]} numberOfLines={3}>
                    {row.sub}
                  </Text>
                </View>
              ))}
              </View>
            </ScrollView>
          </Animated.View>
          <View
            style={[
              styles.bottomActionBar,
              styles.globalBottomChromeWrap,
              { paddingBottom: insets.bottom + GLOBAL_BOTTOM_CHROME_LIFT_PX, paddingTop: 16, zIndex: 22 },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={[styles.globalCloseFab, styles.globalCloseFabOnChrome]}
              activeOpacity={0.65}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              onPress={exitGlobalMode}
              accessibilityRole="button"
              accessibilityLabel={language === 'he' ? 'סגור גלובל' : 'Close global'}
            >
              <Svg width={30} height={30} viewBox="0 0 46 46" fill="none">
                <Path
                  d="M22.954 26.8302L17.2612 32.523C16.8275 32.9567 16.307 33.1735 15.6996 33.1735C15.0925 33.1737 14.572 32.9569 14.1381 32.523C13.7042 32.0891 13.4874 31.5686 13.4876 30.9615C13.4876 30.3542 13.7044 29.8336 14.1381 29.4L19.8309 23.7072L14.1381 18.0144C13.7044 17.5807 13.4876 17.0602 13.4876 16.4528C13.4874 15.8457 13.7042 15.3252 14.1381 14.8913C14.572 14.4574 15.0925 14.2406 15.6996 14.2408C16.307 14.2408 16.8275 14.4576 17.2612 14.8913L22.954 20.5841L28.6468 14.8913C29.0805 14.4576 29.601 14.2408 30.2083 14.2408C30.8154 14.2406 31.3359 14.4574 31.7698 14.8913C32.2037 15.3252 32.4206 15.8457 32.4204 16.4528C32.4204 17.0602 32.2035 17.5807 31.7698 18.0144L26.077 23.7072L31.7698 29.4C32.2035 29.8336 32.4204 30.3542 32.4204 30.9615C32.4206 31.5686 32.2037 32.0891 31.7698 32.523C31.3359 32.9569 30.8154 33.1737 30.2083 33.1735C29.601 33.1735 29.0805 32.9567 28.6468 32.523L22.954 26.8302Z"
                  fill={hexToRgba(colors.textSecondary, 0.52)}
                  stroke={hexToRgba(colors.textSecondary, 0.45)}
                  strokeWidth={1.43}
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </>
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
                  <View
                    style={[
                      styles.walletPlanTierBadge,
                      userPlanTier === 'FREE' && styles.walletPlanTierBadgeFree,
                    ]}
                  >
                    <Text
                      style={[
                        styles.walletPlanTierBadgeText,
                        userPlanTier === 'FREE' && styles.walletPlanTierBadgeTextFree,
                      ]}
                    >
                      {userPlanTier}
                    </Text>
                  </View>
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

      <Modal visible={showSpacePicker} transparent animationType="fade" onRequestClose={() => setShowSpacePicker(false)}>
        <View style={styles.spacePickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowSpacePicker(false)} />
          <View style={[styles.spacePickerSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 14 }]}>
            <Text style={[styles.spacePickerTitle, { color: colors.text }]}>
              {language === 'he' ? 'בחר מרחב חשבון' : 'Choose account space'}
            </Text>
            <Text style={[styles.spacePickerSub, { color: colors.textSecondary }]}>
              {language === 'he'
                ? 'לחיצה ארוכה על כדור ONE פותחת את המגירה הזאת.'
                : 'Long-press the ONE orb to open this drawer.'}
            </Text>

            <View style={styles.spacePickerRow}>
              <TouchableOpacity
                style={[
                  styles.spacePickerChip,
                  { borderColor: colors.border, backgroundColor: accountSpace === 'personal' ? `${colors.primary}22` : colors.surface },
                ]}
                onPress={() => {
                  setAccountSpace('personal');
                  setShowSpacePicker(false);
                }}
                activeOpacity={0.82}
              >
                <Text style={[styles.spacePickerChipText, { color: accountSpace === 'personal' ? colors.primary : colors.text }]}>
                  {language === 'he' ? 'אישי' : 'Personal'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.spacePickerChip,
                  { borderColor: colors.border, backgroundColor: accountSpace === 'business' ? `${colors.primary}22` : colors.surface },
                ]}
                onPress={() => {
                  setAccountSpace('business');
                  setShowSpacePicker(false);
                }}
                activeOpacity={0.82}
              >
                <Text style={[styles.spacePickerChipText, { color: accountSpace === 'business' ? colors.primary : colors.text }]}>
                  {language === 'he' ? 'עסקי' : 'Business'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.spacePickerCreateBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              activeOpacity={0.82}
              onPress={() => {
                const next = accountSpace === 'business' ? `${businessName} 2` : 'ONE Workspace';
                setBusinessName(next);
                setAccountSpace('business');
                setShowSpacePicker(false);
                Alert.alert(language === 'he' ? 'מרחב חדש נוצר' : 'New space created', next);
              }}
            >
              <Text style={[styles.spacePickerCreateTxt, { color: colors.text }]}>
                {language === 'he' ? '+ צור מרחב חדש' : '+ Create new space'}
              </Text>
            </TouchableOpacity>
          </View>
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
        attachContext={{
          chatSheetOpen: showChatSheet,
          worldId: effectiveChatWorldId,
          worldLabel: activeWorldChatLabel,
          unitTitle: activeUnit?.title?.trim() ? activeUnit.title : null,
        }}
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
                const broadcasts = broadcastMessagesForAgentWorld(world.id, language, flowUnits);
                /** personal = לבן ב־WORLDS — על surface בהיר לא קריא; שאר העולמות משאירים צבע עולם */
                const agentCardWorldTextOnSurface =
                  world.id === 'personal' ? colors.textSecondary : world.color;
                return (
                  <View key={world.id} style={[styles.agentCardPage, { width: contentWidth }]}>
                    <View style={[styles.agentCardWorldCard, { backgroundColor: colors.surface, borderLeftColor: world.color }]}>
                      <View
                        style={[
                          styles.agentCardWorldBadge,
                          {
                            backgroundColor:
                              world.id === 'personal'
                                ? hexToRgba(colors.textSecondary, 0.14)
                                : hexToRgba(world.color, 0.2),
                          },
                        ]}
                      >
                        <Text style={[styles.agentCardWorldName, { color: agentCardWorldTextOnSurface }]}>
                          {worldTitle(world.id, language)}
                        </Text>
                      </View>
                      <Text style={[styles.agentCardWorldSub, { color: colors.textSecondary }]}>World · {world.id}</Text>
                      {broadcasts.length > 0 && (
                        <>
                          <Text style={[styles.agentCardSectionLabel, { color: colors.textSecondary }]}>Updates</Text>
                          {broadcasts.slice(0, 4).map((b, i) => (
                            <View key={i} style={[styles.agentCardBroadcastRow, { borderBottomColor: hexToRgba(colors.text, 0.08) }]}>
                              <Text style={[styles.agentCardBroadcastType, { color: agentCardWorldTextOnSurface }]}>{b.type}</Text>
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
          {
            height: topBarHeight,
            zIndex: viewMode === 'global' ? 14 : 8,
          },
          !isNarrow && styles.barDesktopInsetTop,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={viewMode === 'global' ? (globalChromeFadeColors as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]]) : gradientColorsFromOpaque}
          locations={viewMode === 'global' ? ([0, 1] as unknown as readonly [number, number, ...number[]]) : gradientLocations}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <View
        style={[
          styles.bottomBar,
          {
            height: bottomBarHeight,
            zIndex: viewMode === 'global' ? 12 : 8,
          },
          !isNarrow && styles.barDesktopInsetBottom,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={viewMode === 'global' ? (globalChromeFadeColors as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]]) : gradientColorsFromOpaque}
          locations={viewMode === 'global' ? ([0, 1] as unknown as readonly [number, number, ...number[]]) : gradientLocations}
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
                <PlusIconSvg size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.nowInputField, { color: colors.text }]}
                placeholder={nowPlaceholderPhrase}
                placeholderTextColor={nowFieldPlaceholderColor}
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
              <Animated.View style={{ opacity: splashFaceOpacity }} pointerEvents="none">
                <OrbAgent
                  size={EMOJI_CIRCLE_SIZE}
                  state="idle"
                  mode="home"
                  showFace
                  labelLines={[]}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      )}
      </View>
      {/* קרדיטים – רק במצב גלובל; מחוץ ל־contentWrap כדי לרחף מעל הגלילה; סדר LTR */}
      {creditsFloatingVisible && (
        <TouchableOpacity
          style={[styles.creditsFloatingWrap, { top: insets.top + 10 }]}
          activeOpacity={0.88}
          onPress={() => setShowCredits(true)}
        >
          <View style={styles.creditsPillLtrShell} pointerEvents="box-none">
            <View
              style={[
                styles.creditsPillInner,
                {
                  backgroundColor: theme === 'light' ? '#0a0a0a' : '#121212',
                  borderColor: hexToRgba('#ffffff', 0.12),
                },
              ]}
            >
              <View style={[styles.creditsPillCoin, { backgroundColor: UPGRADE_GOLD }]} />
              <Text style={styles.creditsPillBalance}>{unitsBalance.toLocaleString()}</Text>
              <Text style={styles.creditsPillSep}>|</Text>
              <PlusIconSvg size={18} color="#ffffff" />
            </View>
          </View>
        </TouchableOpacity>
      )}
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
                      <PlusIconSvg size={24} color={colors.textSecondary} />
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
                        placeholderTextColor={nowFieldPlaceholderColor}
                        value={nowValue}
                        onChangeText={setNowValue}
                        showSoftInputOnFocus={false}
                        onFocus={(e: any) => {
                          if (showChatSheet) return;
                          homeNowInputRef.current?.blur();
                          Keyboard.dismiss();
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
                          <NowPlaceholderLabel
                            phrase={nowPlaceholderPhrase}
                            isRtl={isRtlLayout}
                            mutedTextColor={nowFieldPlaceholderColor}
                          />
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
                    if (orbIndex === GLOBAL_ORB_INDEX) {
                      navigateToGlobalForContext(currentWorldId);
                    } else if (orbIndex === AGENT_ORB_INDEX) {
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
                  {orbIndex > AGENT_ORB_INDEX ? (
                    <View style={styles.orbButtonEnterIconWrap} pointerEvents="none">
                      {broadcastDotFlashSide != null ? (
                        <View style={styles.orbButtonDotsRow}>
                          <View
                            style={[
                              styles.orbButtonDot,
                              { overflow: 'hidden', backgroundColor: hexToRgba(colors.textSecondary, 0.35) },
                            ]}
                          >
                            {broadcastDotFlashSide === 'left' ? (
                              <Animated.View
                                pointerEvents="none"
                                style={[
                                  StyleSheet.absoluteFillObject,
                                  {
                                    borderRadius: 3,
                                    backgroundColor: broadcastDotFlashColor,
                                    opacity: broadcastDotFlashOpacity,
                                  },
                                ]}
                              />
                            ) : null}
                          </View>
                          <View
                            style={[
                              styles.orbButtonDotActive,
                              styles.orbButtonUnitBroadcastPlaySlot,
                              { backgroundColor: 'transparent' },
                            ]}
                          >
                            <EnterIconSvg size={ORB_BUTTON_ENTER_ICON_SIZE} color="#ffffff" />
                          </View>
                          <View
                            style={[
                              styles.orbButtonDot,
                              { overflow: 'hidden', backgroundColor: hexToRgba(colors.textSecondary, 0.35) },
                            ]}
                          >
                            {broadcastDotFlashSide === 'right' ? (
                              <Animated.View
                                pointerEvents="none"
                                style={[
                                  StyleSheet.absoluteFillObject,
                                  {
                                    borderRadius: 3,
                                    backgroundColor: broadcastDotFlashColor,
                                    opacity: broadcastDotFlashOpacity,
                                  },
                                ]}
                              />
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <View style={styles.orbButtonUnitPlayOnlyShell}>
                          <EnterIconSvg size={ORB_BUTTON_ENTER_ICON_SIZE} color="#ffffff" />
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      <Animated.View style={[styles.orbButtonDotsRow, { opacity: orbButtonLabelOpacity }]} pointerEvents="none">
                        {[cycleWorldPrev(worldIndex), worldIndex, cycleWorldNext(worldIndex)].map((idx, i) => {
                          const isCenter = i === 1;
                          const dotColor = WORLDS[idx]?.color ?? currentWorldColor;
                          if (isCenter) {
                            return (
                              <View
                                key={`${idx}-${i}-c`}
                                style={[styles.orbButtonDot, styles.orbButtonDotActive, { backgroundColor: dotColor }]}
                              />
                            );
                          }
                          const flashThis =
                            (broadcastDotFlashSide === 'left' && i === 0) ||
                            (broadcastDotFlashSide === 'right' && i === 2);
                          if (flashThis) {
                            /** דפדוף ברודקאסט — שני הצדדים בצבע העולם הנוכחי (לא צבעי שכנים) */
                            return (
                              <View
                                key={`${idx}-${i}-sf`}
                                style={[
                                  styles.orbButtonDot,
                                  { overflow: 'hidden', backgroundColor: hexToRgba(colors.textSecondary, 0.35) },
                                ]}
                              >
                                <Animated.View
                                  pointerEvents="none"
                                  style={[
                                    StyleSheet.absoluteFillObject,
                                    {
                                      borderRadius: 3,
                                      backgroundColor: broadcastDotFlashColor,
                                      opacity: broadcastDotFlashOpacity,
                                    },
                                  ]}
                                />
                              </View>
                            );
                          }
                          return (
                            <Animated.View
                              key={`${idx}-${i}-s`}
                              style={[styles.orbButtonDot, { backgroundColor: worldSideDotPulseBg }]}
                            />
                          );
                        })}
                      </Animated.View>
                      <Animated.View style={[styles.orbButtonEnterIconWrap, { opacity: orbButtonEnterOpacity }]} pointerEvents="none">
                        <EnterIconSvg size={ORB_BUTTON_ENTER_ICON_SIZE} color="#ffffff" />
                      </Animated.View>
                    </>
                  )}
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
                      /** RTL לכרום הצ׳אט — לא לכפות LTR על כל הגיליון (זה היפך את סרגל הכלים והשבבים) */
                      direction: isRtlLayout ? 'rtl' : 'ltr',
                    },
                  ]}
                >
                  {showChatProfile ? (
                    <View
                      {...chatSheetHeaderDownPan.panHandlers}
                      style={[
                        styles.chatSheetTopBar,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: activeUnit ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.chatModalIconBtn}
                        onPress={collapseProfileToChat}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <ChatBackArrowIcon color={colors.textSecondary} rtl={isRtlLayout} size={24} />
                      </TouchableOpacity>
                      {chatProfileHeaderCompact ? (
                        <View style={styles.chatProfileToolbarCompactCenter}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              navigateToGlobalForContext(activeUnit ? activeUnit.worldId : effectiveChatWorldId)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={language === 'he' ? 'גלובל' : 'Global'}
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
                                <OrbAgent
                                  size={36}
                                  state="idle"
                                  mode="home"
                                  showFace
                                  labelLines={[]}
                                />
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.chatProfileToolbarCompactText,
                              language === 'he' ? styles.chatModalHeaderTextAlignHe : styles.chatModalHeaderTextAlignEn,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => {
                              chatScrollRef.current?.scrollTo({ y: 0, animated: true });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={language === 'he' ? 'גלול לראש הפרופיל' : 'Scroll profile to top'}
                          >
                            <Text
                              style={[
                                styles.chatProfileToolbarTitle,
                                {
                                  color: colors.text,
                                  textAlign: language === 'he' ? 'right' : 'left',
                                  writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                  ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {activeUnit
                                ? embedLatinRunsForRtlDisplay(activeUnit.title, language)
                                : chatAgentHeaderTitle}
                            </Text>
                            {activeUnit ? (
                              <Text
                                style={[
                                  styles.chatProfileToolbarSubtitle,
                                  {
                                    color: colors.textSecondary,
                                    textAlign: language === 'he' ? 'right' : 'left',
                                    writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                    ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                <Text style={{ color: headerProgressColor }}>{`${activeUnit.progress}%`}</Text>
                                <Text style={{ color: colors.textSecondary }}>
                                  {language === 'he' ? ` · ${activeUnit.steps} צעדים` : ` · ${activeUnit.steps} Steps`}
                                </Text>
                              </Text>
                            ) : (
                              <Text
                                style={[
                                  styles.chatProfileToolbarSubtitle,
                                  {
                                    color: colors.textSecondary,
                                    textAlign: language === 'he' ? 'right' : 'left',
                                    writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                    ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                                  },
                                ]}
                              >
                                {agentHeaderSubtitle}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.chatProfileToolbarSpacer} />
                      )}
                      {!chatProfileHeaderCompact ? (
                        <View pointerEvents="none" style={styles.chatProfileHeaderAbsoluteLabelWrap}>
                          <Text style={[styles.chatProfileHeaderLabel, { color: colors.text }]}>
                            {chatProfileHeaderLabel}
                          </Text>
                        </View>
                      ) : null}
                      {activeUnit ? (
                        <TouchableOpacity
                          style={styles.chatSheetHeaderShareBtn}
                          hitSlop={8}
                          activeOpacity={0.7}
                          onPress={shareChatUnitProfile}
                          accessibilityRole="button"
                          accessibilityLabel={language === 'he' ? 'שתף' : 'Share'}
                        >
                          <ShareIcon color={colors.text} size={26} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.chatSheetHeaderShareBtn}
                          hitSlop={8}
                          activeOpacity={0.7}
                          onPress={() => {
                            setShowChatMenu(false);
                            closeChatSheet();
                            navigation.navigate('Settings');
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={language === 'he' ? 'הגדרות' : 'Settings'}
                        >
                          <SettingsIcon color={colors.text} size={26} />
                        </TouchableOpacity>
                      )}
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
                    <View
                      {...chatSheetHeaderDownPan.panHandlers}
                      style={[
                        styles.chatSheetTopBar,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: activeUnit ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.chatModalIconBtn}
                        onPress={() => {
                          closeChatSheet({ direction: 'down' });
                        }}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <ChatBackArrowIcon color={colors.textSecondary} rtl={isRtlLayout} size={24} />
                      </TouchableOpacity>
                      <View style={styles.chatHeaderProfileBtn}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() =>
                            navigateToGlobalForContext(activeUnit ? activeUnit.worldId : effectiveChatWorldId)
                          }
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
                              <OrbAgent
                                size={36}
                                state="idle"
                                mode="home"
                                showFace
                                labelLines={[]}
                              />
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.chatModalHeaderText,
                            language === 'he' ? styles.chatModalHeaderTextAlignHe : styles.chatModalHeaderTextAlignEn,
                          ]}
                          activeOpacity={0.75}
                          onPress={openChatProfile}
                        >
                          <Text
                            style={[
                              styles.chatModalTitle,
                              {
                                color: colors.text,
                                textAlign: language === 'he' ? 'right' : 'left',
                                writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                              },
                            ]}
                          >
                            {activeUnit
                              ? embedLatinRunsForRtlDisplay(activeUnit.title, language)
                              : chatAgentHeaderTitle}
                          </Text>
                          {activeUnit ? (
                            <Text
                              style={[
                                styles.chatModalSubtitle,
                                {
                                  color: colors.textSecondary,
                                  textAlign: language === 'he' ? 'right' : 'left',
                                  writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                  ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                                },
                              ]}
                            >
                              <Text style={{ color: headerProgressColor }}>{`${activeUnit.progress}%`}</Text>
                              <Text style={{ color: colors.textSecondary }}>
                                {language === 'he' ? ` · ${activeUnit.steps} צעדים` : ` · ${activeUnit.steps} Steps`}
                              </Text>
                            </Text>
                          ) : (
                            <Text
                              style={[
                                styles.chatModalSubtitle,
                                {
                                  color: colors.textSecondary,
                                  textAlign: language === 'he' ? 'right' : 'left',
                                  writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                  ...(language === 'he' ? { alignSelf: 'stretch' as const } : {}),
                                },
                              ]}
                            >
                              {agentHeaderSubtitle}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {!activeUnit ? (
                        <TouchableOpacity
                          style={[
                            styles.chatHeaderUpgradeBtn,
                            userPlanTier !== 'FREE' ? styles.chatHeaderPlanBadge : null,
                          ]}
                          activeOpacity={0.82}
                          onPress={() => setShowCredits(true)}
                        >
                          <Text
                            style={[
                              styles.chatHeaderUpgradeBtnText,
                              userPlanTier !== 'FREE' ? styles.chatHeaderPlanBadgeText : null,
                            ]}
                          >
                            {chatHeaderPlanLabel}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {activeUnit ? (
                        <UnitChatHeaderContacts
                          participants={unitChatParticipants}
                          ringColor={chatSheetBg}
                          surfaceTint={colors.surface}
                          textColor={colors.text}
                          language={language}
                          onPress={openAttachSheet}
                        />
                      ) : null}
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
                  {activeUnit ? (
                    <View style={[styles.chatHeaderProgressTrack, { backgroundColor: hexToRgba(colors.textSecondary, isDark ? 0.24 : 0.16) }]}>
                      <View style={[styles.chatHeaderProgressFill, { width: `${Math.max(2, headerProgressPct * 100)}%`, backgroundColor: headerProgressColor }]} />
                    </View>
                  ) : null}
                  {showChatMenu && (
                    <View style={styles.chatMenuOverlay}>
                      <TouchableOpacity
                        style={[styles.chatMenuScrim, { backgroundColor: hexToRgba('#000000', theme === 'dark' ? 0.35 : 0.2) }]}
                        activeOpacity={1}
                        onPress={() => setShowChatMenu(false)}
                      />
                      <View
                        style={[
                          styles.chatMenuCard,
                          { backgroundColor: colors.surface },
                          isRtlLayout ? ({ direction: 'ltr' } as const) : null,
                        ]}
                      >
                        {chatMenuRows.map((row) => (
                          <TouchableOpacity
                            key={row.id}
                            style={[styles.chatMenuItem, { width: '100%' }]}
                            activeOpacity={0.75}
                            onPress={() => {
                              setShowChatMenu(false);
                              if (row.id === 'History' && !activeUnitId) {
                                requestAnimationFrame(() => {
                                  chatScrollRef.current?.scrollTo({ y: 0, animated: true });
                                });
                              }
                              if (row.id === 'Profile') openChatProfile();
                              if (row.id === 'Settings') {
                                closeChatSheet();
                                navigation.navigate('Settings');
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.chatMenuItemText,
                                { color: colors.text },
                                language === 'he' ? styles.globalForceRtlText : styles.chatMenuItemTextEn,
                              ]}
                            >
                              {row.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  <View style={styles.chatThreadScrollWrap}>
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
                    onScroll={onCombinedChatScroll}
                    onScrollEndDrag={onChatThreadScrollEndDrag}
                    onContentSizeChange={() => {
                      requestAnimationFrame(() => recomputeChatStickyDateLabel(lastChatScrollYRef.current));
                    }}
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
                          agentPlanBadgeLabel={chatHeaderPlanLabel}
                          agentPlanBadgePaid={userPlanTier !== 'FREE'}
                          onPressAgentPlanBadge={() => setShowCredits(true)}
                          profileWorldId={effectiveChatWorldId}
                          onProfileWorldChange={(worldId) => {
                            setChatPinnedWorldId(worldId);
                            const wi = WORLDS.findIndex((w) => w.id === worldId);
                            if (wi >= 0) setWorldIndex(wi);
                          }}
                          centerContent={
                            activeUnit ? (
                              <Text style={styles.chatProfileRingEmoji}>{activeUnit.emoji}</Text>
                            ) : (
                              <View style={[styles.chatProfileAgentHeroOrb, { backgroundColor: 'transparent' }]}>
                                <OrbAgent
                                  size={80}
                                  state="idle"
                                  mode="home"
                                  showFace
                                  labelLines={[]}
                                />
                              </View>
                            )
                          }
                          onPressOpenUnits={() => {
                            setShowChatProfile(false);
                            closeChatSheet();
                            navigation.navigate('Units');
                          }}
                          onPressHeroOpenGlobal={() =>
                            navigateToGlobalForContext(activeUnit ? activeUnit.worldId : effectiveChatWorldId)
                          }
                          onPressWorldChipOpenGlobal={(worldId) => navigateToGlobalForContext(worldId)}
                        />
                      </Animated.View>
                    )}
                    {!showChatProfile && (
                      <>
                        {!activeUnit && (
                          <>
                            <View style={styles.chatAgentHistorySection}>
                              {historyUnitsForWorld.length === 0 ? (
                                <View
                                  style={[
                                    styles.unitLogCard,
                                    isRtlLayout ? ({ direction: 'ltr' } as const) : null,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.unitLogTitle,
                                      language === 'he' ? styles.globalForceRtlText : styles.unitLogEmptyHintEn,
                                    ]}
                                  >
                                    {language === 'he' ? 'אין היסטוריה לעולם הזה עדיין' : 'No history in this world yet'}
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  {agentChatHistoryExpanded ? (
                                    <View style={styles.chatAgentHistoryExpandedList}>
                                      {historyUnitsForWorld.map((unit) => (
                                        <TouchableOpacity
                                          key={`log_${unit.id}`}
                                          style={[
                                            styles.unitLogCard,
                                            language === 'he' ? ({ direction: 'rtl' } as const) : null,
                                          ]}
                                          activeOpacity={0.8}
                                          onPress={() => {
                                            setActiveUnitId(unit.id);
                                          }}
                                        >
                                          <View style={{ alignSelf: 'stretch', width: '100%', alignItems: 'flex-start' }}>
                                            <View style={{ alignItems: 'stretch', maxWidth: '100%' }}>
                                              <View
                                                style={{
                                                  flexDirection: 'row',
                                                  alignItems: 'center',
                                                  gap: 8,
                                                  flexWrap: 'wrap',
                                                  justifyContent: 'flex-start',
                                                }}
                                              >
                                                <TouchableOpacity
                                                  activeOpacity={0.85}
                                                  onPress={() => navigateToGlobalForContext(unit.worldId)}
                                                  accessibilityRole="button"
                                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                  <Text style={styles.unitLogTitle}>{unit.emoji}</Text>
                                                </TouchableOpacity>
                                                <Text
                                                  style={[
                                                    styles.unitLogTitle,
                                                    {
                                                      flexShrink: 1,
                                                      textAlign: language === 'he' ? 'right' : 'left',
                                                      writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                                    },
                                                  ]}
                                                >
                                                  {embedLatinRunsForRtlDisplay(unit.title, language)}
                                                </Text>
                                              </View>
                                              <Text
                                                style={[
                                                  styles.unitLogMeta,
                                                  {
                                                    textAlign: language === 'he' ? 'right' : 'left',
                                                    writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                                    alignSelf: 'stretch',
                                                  },
                                                ]}
                                              >
                                                {formatUnitLogStatusLine(unit.status, unit.progress, unit.steps, language)}
                                              </Text>
                                            </View>
                                          </View>
                                          {effectiveChatWorldId === 'personal' && (
                                            <TouchableOpacity
                                              style={styles.unitLogWorldTag}
                                              activeOpacity={0.85}
                                              onPress={() => navigateToGlobalForContext(unit.worldId)}
                                              accessibilityRole="button"
                                            >
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
                                            </TouchableOpacity>
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  ) : null}
                                  <View style={styles.chatAgentHistoryToggleWrap}>
                                    <TouchableOpacity
                                      style={[
                                        styles.chatAgentHistoryToggle,
                                        { borderColor: colors.border, backgroundColor: hexToRgba(colors.surface, theme === 'dark' ? 0.42 : 0.94) },
                                      ]}
                                      activeOpacity={0.8}
                                      onPress={() => setAgentChatHistoryExpanded((e) => !e)}
                                      accessibilityRole="button"
                                      accessibilityState={{ expanded: agentChatHistoryExpanded }}
                                    >
                                      <Text style={[styles.chatAgentHistoryToggleLabel, { color: colors.text }]}>
                                        {agentChatHistoryExpanded
                                          ? language === 'he'
                                            ? 'סגור היסטוריה'
                                            : 'Close history'
                                          : language === 'he'
                                            ? 'פתח היסטוריה'
                                            : 'Open history'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </>
                              )}
                            </View>
                            <View style={styles.chatHistoryMessagesSpacer} />
                          </>
                        )}
                        {(activeUnit ? activeUnit.messages : chatSheetMessages).map((message, idx) => {
                          const thread = activeUnit ? activeUnit.messages : chatSheetMessages;
                          return (
                            <View
                              key={message.id}
                              collapsable={false}
                              onLayout={(ev) => {
                                onMainChatThreadMessageLayout(message.id, ev.nativeEvent.layout.y);
                                if (idx === thread.length - 1) {
                                  requestAnimationFrame(() =>
                                    recomputeChatStickyDateLabel(lastChatScrollYRef.current)
                                  );
                                }
                              }}
                            >
                              <View
                                style={[
                                  styles.chatModalBubble,
                                  message.sender === 'user' ? styles.chatModalBubbleUser : styles.chatModalBubbleOne,
                                  message.sender === 'one' ? { backgroundColor: chatOneBubbleBg } : null,
                                ]}
                              >
                                <View style={styles.chatModalBubbleTextShell}>
                                  <Text
                                    style={[
                                      styles.chatModalBubbleText,
                                      message.sender === 'user' ? styles.chatModalBubbleTextUser : styles.chatModalBubbleTextOne,
                                      {
                                        textAlign: language === 'he' ? 'right' : 'left',
                                        writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                        alignSelf: 'stretch',
                                      },
                                    ]}
                                  >
                                    {message.text}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                        {!nowInputHasText ? (
                          <View style={styles.chatSuggestionsInThreadWrap}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.chatSuggestionsRow}
                              style={styles.chatSuggestionsScroller}
                            >
                              {chatContextSuggestions.map((label) => (
                                <TouchableOpacity
                                  key={label}
                                  style={[styles.chatSuggestionChip, { borderColor: colors.border, backgroundColor: hexToRgba(colors.surface, theme === 'dark' ? 0.48 : 0.92) }]}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (agentUnitCreationMode && !activeUnitId) {
                                      commitAgentCreationGoal(label);
                                      return;
                                    }
                                    setNowValue(label);
                                    setTimeout(() => chatComposerInputRef.current?.focus(), 0);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.chatSuggestionChipLabel,
                                      {
                                        color: colors.text,
                                        textAlign: language === 'he' ? 'right' : 'left',
                                        writingDirection: language === 'he' ? ('rtl' as const) : ('ltr' as const),
                                      },
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        ) : null}
                      </>
                    )}
                  </ScrollView>
                  {!showChatProfile && chatStickyDatePillVisible ? (
                    <View style={styles.chatStickyDateOverlay} pointerEvents="none">
                      <View
                        style={[
                          styles.chatStickyDatePill,
                          {
                            backgroundColor: isDark ? 'rgba(36,36,38,0.94)' : 'rgba(255,255,255,0.92)',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          },
                        ]}
                      >
                        <Text style={[styles.chatStickyDateText, { color: colors.textSecondary }]}>{chatStickyDateLabel}</Text>
                      </View>
                    </View>
                  ) : null}
                  </View>
                  {showChatProfile && !activeUnit ? (
                    <View style={styles.profileUpgradeFabWrap} pointerEvents="box-none">
                      <Animated.View
                        pointerEvents={profileUpgradeFabVisible ? 'auto' : 'none'}
                        style={{
                          opacity: profileUpgradeFabOpacity,
                          transform: [{ translateY: profileUpgradeFabTranslateY }],
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.chatHeaderUpgradeBtn,
                            userPlanTier !== 'FREE' ? styles.chatHeaderPlanBadge : null,
                            styles.profileUpgradeFabBtn,
                          ]}
                          activeOpacity={0.82}
                          onPress={() => setShowCredits(true)}
                          accessibilityRole="button"
                          accessibilityLabel={chatHeaderPlanLabel}
                        >
                          <Text
                            style={[
                              styles.chatHeaderUpgradeBtnText,
                              userPlanTier !== 'FREE' ? styles.chatHeaderPlanBadgeText : null,
                            ]}
                          >
                            {chatHeaderPlanLabel}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  ) : null}
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
              {isComposerExpanded ? (
                <View
                  style={[
                    styles.chatExpandedComposerPanel,
                    {
                      width: isNarrow ? '100%' : Math.min(contentWidth, 460),
                      alignSelf: isNarrow ? 'stretch' : 'center',
                      bottom: (insets.bottom || 6) + keyboardOffset + 68,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.chatExpandedComposerCollapseBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setIsComposerExpanded(false);
                      setChatComposerMeasuredHeight(COMPOSER_LINE_HEIGHT);
                    }}
                  >
                    <Text style={[styles.chatExpandedComposerCollapseGlyph, { color: colors.textSecondary }]}>↙</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.chatExpandedComposerInput,
                      { color: colors.text, writingDirection: nowInputWritingDirection, textAlign: nowInputTextAlign },
                    ]}
                    value={nowValue}
                    onChangeText={setNowValue}
                    multiline
                    autoFocus
                    placeholder=""
                    placeholderTextColor={nowFieldPlaceholderColor}
                    onContentSizeChange={() => {
                      // Expanded textarea should not control compact composer height.
                    }}
                  />
                </View>
              ) : null}
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
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View style={styles.chatComposerExpandedRow}>
                  {orderChatComposerRowWebRtl(
                    Platform.OS === 'web' && isRtlLayout,
                    (
                  <TouchableOpacity
                    key="chat-composer-attach"
                    style={[styles.plusInInputCircle, styles.chatComposerOuterPlus, { backgroundColor: 'transparent' }]}
                    activeOpacity={0.8}
                    onPress={openAttachSheet}
                  >
                    <PlusIconSvg size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                    ),
                    (
                <NowInputBarRow
                  key="chat-composer-bar"
                  isRtl={isRtlLayout}
                  style={[
                    styles.chatModalInputRow,
                    styles.chatComposerInputRowExpanded,
                    {
                      backgroundColor: colors.surface,
                      height: 52,
                    },
                  ]}
                  plus={null}
                  field={
                    isVoiceTrayOpen ? (
                      <View style={styles.chatVoiceTrayRow}>
                        <VoiceTrayButton label="◼" />
                        <VoiceTrayButton label=")))" />
                        <VoiceTrayButton label="2x" />
                        <VoiceTrayButton label="🎤" active={isMicHoldActive} />
                      </View>
                    ) : (
                    <View style={styles.nowInputFieldSlot}>
                      <TextInput
                        ref={chatComposerInputRef}
                        style={[
                          styles.nowInputField,
                          chatComposerLineCount <= 1 ? styles.nowInputFieldSingleLine : styles.nowInputFieldMultiLine,
                          {
                            minHeight: COMPOSER_LINE_HEIGHT + 18,
                            maxHeight: chatComposerMaxHeight + 8,
                            height: chatComposerVisibleHeight + 8,
                          },
                          { color: colors.text, textAlign: nowInputTextAlign, writingDirection: nowInputWritingDirection },
                          Platform.OS === 'web'
                            ? ({ outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' } as any)
                            : null,
                        ]}
                        placeholder=""
                        placeholderTextColor={nowFieldPlaceholderColor}
                        value={nowValue}
                        onChangeText={setNowValue}
                        multiline
                        onContentSizeChange={(e) => {
                          if (isComposerExpanded) return;
                          if (!nowValue.trim()) {
                            if (chatComposerMeasuredHeight !== COMPOSER_LINE_HEIGHT) {
                              setChatComposerMeasuredHeight(COMPOSER_LINE_HEIGHT);
                            }
                            return;
                          }
                          const h = e?.nativeEvent?.contentSize?.height ?? COMPOSER_LINE_HEIGHT;
                          const snapped = Math.max(
                            COMPOSER_LINE_HEIGHT,
                            Math.min(chatComposerMaxHeight, Math.round(h / COMPOSER_LINE_HEIGHT) * COMPOSER_LINE_HEIGHT)
                          );
                          if (Math.abs(snapped - chatComposerMeasuredHeight) >= 2) setChatComposerMeasuredHeight(snapped);
                        }}
                        scrollEnabled={chatComposerCanExpand}
                        showSoftInputOnFocus
                        onFocus={(e: any) => {
                          if (showChatProfile) {
                            setShowChatProfile(false);
                            setChatProfileEditMode(false);
                            setChatOpenedFromOrbProfileShortcut(false);
                            setTimeout(scrollOneChatToBottom, 100);
                          }
                          setIsVoiceTrayOpen(false);
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
                        returnKeyType="default"
                        blurOnSubmit={false}
                      />
                      {!nowInputHasText && !isChatInputFocused && (
                        <View style={styles.nowPlaceholderOverlay} pointerEvents="none">
                          <NowPlaceholderLabel
                            phrase={nowPlaceholderPhrase}
                            isRtl={isRtlLayout}
                            mutedTextColor={nowFieldPlaceholderColor}
                          />
                        </View>
                      )}
                      {chatComposerCanExpand && !isComposerExpanded ? (
                        <TouchableOpacity
                          style={styles.chatComposerExpandBtn}
                          activeOpacity={0.8}
                          onPress={() => setIsComposerExpanded(true)}
                        >
                          <Text style={[styles.chatComposerExpandGlyph, { color: colors.textSecondary }]}>↗</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    )
                  }
                  trailing={
                    <View style={styles.chatComposerTrailingRow}>
                      {nowValue.trim() ? (
                        <TouchableOpacity
                          style={[styles.chatSendBtn, { backgroundColor: chatActionButtonBg }]}
                          activeOpacity={0.8}
                          hitSlop={6}
                          onPress={submitNowValue}
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
                      ) : isVoiceTrayOpen ? (
                        <TouchableOpacity
                          style={styles.micButton}
                          activeOpacity={0.7}
                          hitSlop={6}
                          onPress={() => {
                            setIsVoiceTrayOpen(false);
                            setIsMicHoldActive(false);
                          }}
                        >
                          <Text style={styles.voiceTrayCloseGlyph}>✕</Text>
                        </TouchableOpacity>
                      ) : !nowValue.trim() ? (
                        <TouchableOpacity
                          style={styles.micButton}
                          activeOpacity={0.7}
                          hitSlop={6}
                          delayLongPress={220}
                          onLongPress={() => {
                            micLongPressTriggeredRef.current = true;
                            setIsMicHoldActive(true);
                          }}
                          onPressOut={() => {
                            setIsMicHoldActive(false);
                          }}
                          onPress={() => {
                            if (micLongPressTriggeredRef.current) {
                              micLongPressTriggeredRef.current = false;
                              return;
                            }
                            setIsVoiceTrayOpen(true);
                          }}
                        >
                          <Svg width={20} height={20} viewBox="0 0 26 26" fill="none">
                            <Path d="M13.1181 17.4274C14.1924 17.4274 15.2227 16.9709 15.9824 16.1582C16.7421 15.3455 17.1688 14.2433 17.1688 13.0941V6.59408C17.1688 5.4448 16.7421 4.3426 15.9824 3.52995C15.2227 2.71729 14.1924 2.26074 13.1181 2.26074C12.0438 2.26074 11.0135 2.71729 10.2538 3.52995C9.49415 4.3426 9.06738 5.4448 9.06738 6.59408V13.0941C9.06738 14.2433 9.49415 15.3455 10.2538 16.1582C11.0135 16.9709 12.0438 17.4274 13.1181 17.4274Z" fill={isMicHoldActive ? '#22c55e' : colors.textSecondary} />
                            <Path d="M19.3254 13.1882C19.0541 13.1882 18.794 13.2875 18.6022 13.4641C18.4103 13.6408 18.3026 13.8804 18.3026 14.1303C18.3026 15.3795 17.7638 16.5775 16.8048 17.4608C15.8457 18.3442 14.545 18.8404 13.1887 18.8404C11.8324 18.8404 10.5317 18.3442 9.57266 17.4608C8.61363 16.5775 8.07485 15.3795 8.07485 14.1303C8.07485 13.8804 7.96709 13.6408 7.77528 13.4641C7.58347 13.2875 7.32333 13.1882 7.05207 13.1882C6.78081 13.1882 6.52067 13.2875 6.32886 13.4641C6.13705 13.6408 6.0293 13.8804 6.0293 14.1303C6.0293 15.8792 6.78359 17.5564 8.12624 18.7931C9.46889 20.0297 11.2899 20.7245 13.1887 20.7245C15.0875 20.7245 16.9085 20.0297 18.2512 18.7931C19.5938 17.5564 20.3481 15.8792 20.3481 14.1303C20.3481 13.8804 20.2404 13.6408 20.0486 13.4641C19.8568 13.2875 19.5966 13.1882 19.3254 13.1882Z" fill={isMicHoldActive ? '#22c55e' : colors.textSecondary} />
                            <Path d="M16.1562 21.7607H10.0801C9.81148 21.7607 9.5539 21.8749 9.36399 22.078C9.17408 22.2812 9.06738 22.5568 9.06738 22.8441C9.06738 23.1314 9.17408 23.4069 9.36399 23.6101C9.5539 23.8133 9.81148 23.9274 10.0801 23.9274H16.1562C16.4247 23.9274 16.6823 23.8133 16.8722 23.6101C17.0621 23.4069 17.1688 23.1314 17.1688 22.8441C17.1688 22.5568 17.0621 22.2812 16.8722 22.078C16.6823 21.8749 16.4247 21.7607 16.1562 21.7607Z" fill={isMicHoldActive ? '#22c55e' : colors.textSecondary} />
                          </Svg>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  }
                />
                    ),
                    !nowValue.trim() ? (
                  <TouchableOpacity
                    key="chat-composer-profile"
                    style={[
                      styles.plusInInputCircle,
                      styles.chatComposerOuterPlus,
                      { backgroundColor: chatActionButtonBg },
                    ]}
                    activeOpacity={0.8}
                    hitSlop={6}
                    onPress={() => {
                      if (isChatSystemWorking) return;
                      if (showChatProfile) setChatProfileEditMode((v) => !v);
                      else openChatProfile();
                    }}
                  >
                    {isChatSystemWorking ? (
                      <Animated.View
                        style={[
                          styles.chatWorkingSquare,
                          {
                            backgroundColor: chatActionIconColor,
                            opacity: chatActionBreath,
                            transform: [{ scale: chatActionBreath }],
                          },
                        ]}
                      />
                    ) : showChatProfile ? (
                      chatProfileEditMode ? (
                        <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M6 12.5L10.5 17L18 8"
                            stroke={chatActionIconColor}
                            strokeWidth={2.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </Svg>
                      ) : (
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                          <Path d="M5 16.75V19H7.25L16.6 9.65L14.35 7.4L5 16.75Z" stroke={chatActionIconColor} strokeWidth={1.8} fill="none" />
                          <Path d="M13.75 8L16 10.25" stroke={chatActionIconColor} strokeWidth={1.8} strokeLinecap="round" />
                        </Svg>
                      )
                    ) : (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Rect x={5.25} y={4.5} width={13.5} height={15} rx={2.5} stroke={chatActionIconColor} strokeWidth={2} />
                        <Path d="M8.5 10H15.5M8.5 13.5H13.5" stroke={chatActionIconColor} strokeWidth={2} strokeLinecap="round" />
                      </Svg>
                    )}
                  </TouchableOpacity>
                ) : null
                  )}
                </View>
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

/** טקסט placeholder סטטי (עכשיו? / Now?) */
function NowPlaceholderLabel({
  phrase,
  isRtl,
  mutedTextColor,
}: {
  phrase: string;
  isRtl: boolean;
  mutedTextColor: string;
}) {
  return (
    <Text
      style={[
        styles.nowPlaceholderText,
        {
          color: mutedTextColor,
          width: '100%',
          textAlign: isRtl ? 'right' : 'left',
          writingDirection: isRtl ? 'rtl' : 'ltr',
        },
      ]}
      numberOfLines={1}
    >
      {phrase}
    </Text>
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
  chatComposerExpandBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  chatComposerExpandGlyph: {
    fontSize: 15,
    fontWeight: '700',
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
    paddingVertical: 0,
    minWidth: 0,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  nowInputFieldSingleLine: {
    paddingTop: 9,
    paddingBottom: 9,
  },
  nowInputFieldMultiLine: {
    paddingTop: 4,
    paddingBottom: 4,
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
  globalOnePlatter: {
    position: 'relative',
    overflow: 'hidden',
  },
  globalOneBgSlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  globalBroadcastBlock: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 2,
  },
  /** ברודקאסט בגלובל — רוחב מלא של המגש כדי מרכוז שורות (עם textAlign center + writingDirection rtl בעברית) */
  globalBroadcastCopyStretch: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  /** כמו UnitChatProfile — מיכל LTR; יישור עברית רק דרך Text */
  globalScrollInner: {
    width: '100%',
    alignSelf: 'stretch',
    direction: 'ltr',
  },
  globalWorldChipsScrollViewport: {
    alignSelf: 'stretch',
    marginTop: 2,
    marginBottom: 6,
    maxWidth: '100%',
  },
  globalWorldChipsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 8,
  },
  globalWorldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  globalWorldChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  /** כותרות וגוף בגלובל בעברית — אותו דפוס כמו מגירות ביחידה */
  globalForceRtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    ...Platform.select({
      android: { includeFontPadding: false as const },
      default: {},
    }),
  },
  globalSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 20,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  globalListRow: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  globalListTitle: {
    fontSize: 15,
    fontWeight: '700',
    alignSelf: 'stretch',
  },
  globalListSub: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    alignSelf: 'stretch',
  },
  /** כניסה לגלובל מהגלגל — ממורכז למעלה; הילה מונפשת אחרי השהייה */
  orbGlobalFabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlobalFabCluster: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlobalFabHalo: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
  },
  orbGlobalFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  globalCloseFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    alignSelf: 'center',
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
  wheelOrbTitleProgressTrack: {
    width: 82,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 8,
    alignSelf: 'center',
  },
  wheelOrbTitleProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  /** כותרת ראשית + משנית – מתחת לכדור הסוכן, קרוב יותר לכדור */
  wheelOrbTextBlock: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '43%',
    bottom: 74,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  /** מרחב טאפ לברודקאסט (חצי שמאל/ימין) */
  wheelOrbBroadcastTapPad: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 48,
  },
  wheelOrbTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  wheelOrbSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 6,
  },
  agentWorldTagWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  agentWorldTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  agentWorldTagText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  /** אזור בטוח שקוף מעל תיבת הטקסט — שומר שלא נניח תוכן נמוך מדי בתוך הכדור */
  wheelOrbBottomSafeArea: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    bottom: 52,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'transparent',
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
    direction: 'ltr',
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
  /** מיכל פליי: לא מרחיב את השורה (ממדים מ־orbButtonDotActive); overflow visible לציור המשולש */
  orbButtonUnitBroadcastPlaySlot: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  /** כדור יחידה: רק פליי; נקודות צד רק בזמן פלאש אחרי טאפ */
  orbButtonUnitPlayOnlyShell: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
  /** גלובל: מסילת תחתית עם fade כמו fading-bg — הגרדיאנט מאחורי כפתור X */
  globalBottomChromeWrap: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  /** X על ה־fade בלי כפתור צף נפרד */
  globalCloseFabOnChrome: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  barDesktopInsetTop: {
    top: 24,
  },
  barDesktopInsetBottom: {
    bottom: 24,
  },
  creditsFloatingWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 26,
    elevation: 26,
  },
  /** מטבע תמיד משמאל, פלוס תמיד מימין — גם בעברית (RTL) */
  creditsPillLtrShell: {
    direction: 'ltr',
    alignItems: 'center',
  },
  creditsPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  creditsPillCoin: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  creditsPillBalance: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  creditsPillSep: {
    color: '#ffffff',
    opacity: 0.45,
    marginHorizontal: 6,
    fontSize: 12,
    fontWeight: '600',
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
  walletPlanTierBadge: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UPGRADE_GOLD,
    backgroundColor: 'rgba(230, 191, 63, 0.22)',
  },
  walletPlanTierBadgeFree: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  walletPlanTierBadgeText: {
    color: UPGRADE_GOLD_ON,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  walletPlanTierBadgeTextFree: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '700',
  },
  walletUpgradeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: UPGRADE_GOLD,
  },
  walletUpgradeBtnText: {
    color: UPGRADE_GOLD_ON,
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
  chatHeaderProgressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: -1,
  },
  chatHeaderProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  chatSheetHeaderShareBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalIconBtn: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  /** מיכל LTR כדי ש־alignItems + textAlign לא יתהפכו תחת direction: rtl של הגיליון */
  chatModalHeaderTextAlignHe: {
    direction: 'ltr',
    alignItems: 'flex-end',
  },
  chatModalHeaderTextAlignEn: {
    direction: 'ltr',
    alignItems: 'flex-start',
  },
  chatHeaderProfileBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'flex-start',
  },
  chatModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  chatModalSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  chatAgentWorldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  chatHeaderUpgradeBtn: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: UPGRADE_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    flexShrink: 0,
  },
  chatHeaderUpgradeBtnText: {
    color: UPGRADE_GOLD_ON,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  chatHeaderPlanBadge: {
    backgroundColor: 'rgba(230, 191, 63, 0.22)',
    borderWidth: 1,
    borderColor: UPGRADE_GOLD,
  },
  chatHeaderPlanBadgeText: {
    color: UPGRADE_GOLD,
    fontWeight: '800',
    letterSpacing: 0.25,
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
  chatUnitContactsSlot: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    paddingHorizontal: 2,
  },
  chatUnitContactsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatUnitContactAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatUnitContactInitials: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatUnitContactOverflow: {
    minWidth: 30,
    paddingHorizontal: 2,
  },
  chatUnitContactOverflowText: {
    fontSize: 11,
    fontWeight: '800',
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
  chatMenuItemTextEn: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  chatProfileToolbarSpacer: {
    flex: 1,
  },
  chatProfileHeaderAbsoluteLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** כמו chatModalTitle בהדר הצ׳אט */
  chatProfileHeaderLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  chatProfileToolbarCompactCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  chatProfileToolbarCompactText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chatProfileToolbarTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  chatProfileToolbarSubtitle: {
    fontSize: 12,
    marginTop: 4,
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
  /** כדור סוכן בפרופיל — OrbAgent כמו בלנדינג */
  chatProfileAgentHeroOrb: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileUpgradeFabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center',
    zIndex: 10,
  },
  profileUpgradeFabBtn: {
    minWidth: 120,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
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
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'stretch',
  },
  /** LTR פנימי — textAlign + writingDirection בעברית בלי היפוך מתחת ל־rtl של הגיליון */
  chatModalBubbleTextShell: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    direction: 'ltr',
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
    flexShrink: 1,
    ...(Platform.OS === 'web'
      ? ({ overflowWrap: 'break-word', wordBreak: 'break-word' } as const)
      : {}),
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
  unitLogEmptyHintEn: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'left',
    writingDirection: 'ltr',
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
  chatThreadScrollWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  chatStickyDateOverlay: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 8,
  },
  chatStickyDatePill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatStickyDateText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chatAgentHistorySection: {
    paddingTop: 4,
    gap: 10,
  },
  chatAgentHistoryExpandedList: {
    alignSelf: 'stretch',
    gap: 6,
  },
  chatAgentHistoryToggleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  chatAgentHistoryToggle: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 168,
  },
  chatAgentHistoryToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatHistoryMessagesSpacer: {
    flexGrow: 1,
    minHeight: 12,
  },
  chatSuggestionsWrap: {
    zIndex: 6,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  /** שורת הצעות: רוחב מלא של הגיליון (מסכה/גלילה), תוכן מתחיל כמו בועות ONE (אותו gutter כמו chatModalScrollContent) */
  chatSuggestionsInThreadWrap: {
    marginBottom: 12,
    marginTop: 2,
    marginHorizontal: -16,
    alignSelf: 'stretch',
  },
  chatSuggestionsScroller: {
    maxHeight: 46,
    width: '100%',
  },
  chatSuggestionsRow: {
    gap: 10,
    paddingStart: 16,
    paddingEnd: 16,
    alignItems: 'center',
  },
  chatSuggestionChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSuggestionChipLabel: {
    fontSize: 16,
    fontWeight: '500',
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
  /** `direction: 'ltr'` — גם כשהאפליקציה ב־RTL: פלוס צירוף משמאל, כפתור פרופיל/עריכה מימין */
  chatComposerExpandedRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'ltr',
  },
  chatComposerInputRowExpanded: {
    flex: 1,
  },
  chatComposerOuterPlus: {
    flexShrink: 0,
  },
  chatExpandedComposerPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 320,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingHorizontal: 14,
    zIndex: 9,
  },
  chatExpandedComposerCollapseBtn: {
    position: 'absolute',
    right: 10,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  chatExpandedComposerCollapseGlyph: {
    fontSize: 18,
    fontWeight: '700',
  },
  chatExpandedComposerInput: {
    flex: 1,
    fontSize: 34,
    lineHeight: 44,
    textAlignVertical: 'top',
    paddingTop: 26,
  },
  chatVoiceTrayRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 6,
  },
  voiceTrayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a3a3a3',
  },
  voiceTrayBtnActive: {
    backgroundColor: '#22c55e',
  },
  voiceTrayBtnLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  voiceTrayBtnLabelActive: {
    color: '#ffffff',
  },
  voiceTrayCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTrayCloseGlyph: {
    fontSize: 24,
    color: '#ff4d4f',
    fontWeight: '700',
    marginTop: -2,
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
  spacePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
    justifyContent: 'flex-end',
  },
  spacePickerSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  spacePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  spacePickerSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  spacePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  spacePickerChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacePickerChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  spacePickerCreateBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  spacePickerCreateTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
});
