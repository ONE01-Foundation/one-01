/**
 * UnitProfileSheet — bottom sheet that opens on Unit (Process) tap.
 *
 * Per ONE_UI_UX_SPEC §10 (Preview) and §12 (Chat mode):
 *   Two internal modes inside the same sheet (no new route):
 *     1. PROFILE — kebab + X header → emoji+title centered → one-line broadcast →
 *                  3-column metric grid → 4 quick-action capsules.
 *     2. CHAT    — small unit emoji+title header (tap = back to profile) → messages.
 *
 *   Tap input in PROFILE → CHAT mode.
 *   Tap the small unit header in CHAT mode → PROFILE mode.
 *
 *   Input placeholder differs by mode:
 *     PROFILE: not focused (user taps to enter chat mode)
 *     CHAT:    "Add an update..."
 *
 * v1: Modal-backed sheet at fixed 88% height with grabber. Spec §10 calls for
 * @gorhom/bottom-sheet at ['72%','100%'] snap points; that polish can land in
 * a follow-up without breaking this surface.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
  Alert,
  AppState,
  Share,
  TextInput,
  StatusBar,
  type KeyboardEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  Extrapolation,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore, disclosureForIdentity, type ChatWidget } from '../../stores/mvpStore';
import { ChatQuizCard } from '../../components/mvp/ChatQuizCard';
import { ChatBookingCard } from '../../components/mvp/ChatBookingCard';
import { ChatFormCard } from '../../components/mvp/ChatFormCard';
import { quizForText, buildQuizRun } from '../../data/mvp/quizBank';
import { bookingForText, buildBookingRun } from '../../data/mvp/booking';
import { formForText, buildFormRun } from '../../data/mvp/forms';
import { startToolRun, quizAvailableFor, type ToolKind } from '../../data/mvp/deployTool';
import { toolEnabled } from '../../data/mvp/tools';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { extractRememberFact } from '../../utils/rememberIntent';
import { unitStatusLine, isSeedBroadcast } from '../../utils/unitStatusLine';
import type { Unit, UnitMetric, UnitQuickAction, UnitPerson, UnitReminder, UnitStep, UnitDraft } from '../../core/mvp/types';
import type { ThemeColors } from '../../utils/theme';
import { SNOOZE_OPTIONS, snoozeOptionLabel, snoozeTarget } from '../../utils/snooze';
import { TAG_COLORS } from '../../core/mvp/types';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { Orb } from '../../components/mvp/Orb';
import { generateUnitReply } from '../../utils/mvpChatReply';
import { invokeOneIntent } from '../../services/aiChat';
import { openDisclosureStrings, disclosureLabel, DEFAULT_DISCLOSURE } from '../../data/mvp/disclosure';
import { unitFromIntent, findSimilarUnit } from '../../utils/intentToUnit';
import { resolveReminderDue } from '../../utils/reminderTime';
import { TypingIndicator } from '../../components/mvp/TypingIndicator';
import { CloseIcon, MenuIcon, SpeakerIcon, MicIcon, MicOffIcon, CameraIcon } from '../../components/mvp/icons';
import { InputBar } from '../../components/mvp/InputBar';
import { InlinePrompt, type InlinePromptConfig } from '../../components/mvp/InlinePrompt';
import { SharedProcessPreview } from '../../components/mvp/SharedProcessPreview';
import { SharedThreadOverlay } from '../../components/mvp/SharedThreadOverlay';
import { shareUnit, postSharedMessage } from '../../services/cloudShared';
import { ActionMenu, type ActionMenuItem } from '../../components/mvp/ActionMenu';
import { relativeWhen, activityKindMeta } from '../../utils/activity';
import { analyzeUnit } from '../../utils/processIntelligence';
import { haptic } from '../../utils/haptics';

/**
 * A tapped card opens on the PROFILE side by DEFAULT. It opens straight into
 * CHAT only when there's something to converse about:
 *   • an unseen update on the unit (from ONE, another participant, or a home
 *     "update this" command), OR
 *   • a very fresh conversation (just created / chatting <90s ago).
 * (The card-tap path in MvpStack defers clearing unreadUpdates one tick so this
 * can still read it.)
 */
function computeOpenInChat(unitId: string): boolean {
  const st = useMvpStore.getState();
  const unread = st.units.find((u) => u.id === unitId)?.unreadUpdates ?? 0;
  const last = st.unitChats[unitId]?.slice(-1)[0] as
    | { ts?: number; createdAt?: string }
    | undefined;
  const lastTs = last?.ts ?? (last?.createdAt ? new Date(last.createdAt).getTime() : 0);
  return unread > 0 || Date.now() - lastTs < 90 * 1000;
}

/**
 * Contextual conversation starters for the process chat. Built from ONE's live
 * read of the process (analyzeUnit) plus its concrete steps / metrics, so the
 * chips guide a genuinely USEFUL exchange — closing what's overdue, recapping
 * status, logging a number — instead of leaving the user at a blank prompt.
 * Localized he/en, deduped, capped at four.
 */
function buildChatSuggestions(unit: Unit, lang: 'en' | 'he', nowMs: number): string[] {
  const he = lang === 'he';
  const focus = analyzeUnit(unit, nowMs, lang);
  const out: string[] = [];

  // Lead with the state's own natural opener.
  if (focus.cta?.kind === 'discuss') {
    out.push(focus.cta.prompt);
  } else if (focus.state === 'overdue' || focus.state === 'due_soon') {
    out.push(he ? 'עזור לי לסגור את מה שדחוף' : 'Help me close what’s urgent');
  } else if (focus.state === 'almost_done') {
    out.push(he ? 'מה נשאר כדי לסיים?' : 'What’s left to finish?');
  }

  // Always-useful: a status recap in ONE's own words.
  out.push(he ? 'סכם לי איפה אנחנו' : 'Summarize where we are');

  // The concrete next step, when there's an open one.
  if ((unit.nextSteps ?? []).some((s) => !s.done)) {
    out.push(he ? 'מה הצעד הבא?' : 'What’s the next step?');
  }

  // Log a value onto the first tracked metric.
  const m = unit.metrics?.[0];
  if (m) out.push(he ? `עדכן ${m.label}` : `Update ${m.label}`);

  // Capture a reminder against the process.
  out.push(he ? 'הזכר לי משהו בהמשך' : 'Remind me about this later');

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const s of out) {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      uniq.push(t);
    }
  }
  return uniq.slice(0, 4);
}

type Mode = 'profile' | 'chat';

interface UnitProfileSheetProps {
  unitId: string | null;
  onClose: () => void;
  /** Tap the identity row at the top of the sheet → opens identity switch. */
  onOpenIdentitySwitch?: () => void;
  /** "New process" from the + panel → the host closes this sheet and opens
   *  CreateProcess. (The + panel itself renders inline OVER the card here, so it
   *  no longer needs a separate Modal.) */
  onNewProcess?: () => void;
  /** Force-open straight into CHAT (with the keyboard up) regardless of the
   *  unread/recency heuristic — set when the user LONG-PRESSED the card. */
  forceChat?: boolean;
  /** True while a voice call is active. The backdrop then goes LIGHTER so the
   *  live call orb (floating on Home above this sheet) stays visible — the call
   *  "comes with you" into the process. */
  callActive?: boolean;
}

interface ChatMessage {
  id: string;
  from: 'one' | 'user';
  text: string;
  /** Wall-clock ms — present because chat messages live in the store now. */
  ts?: number;
  /** Optional attached image (local URI) — a file answer, not just text. */
  imageUri?: string;
  /** An interactive tool widget ONE deployed in THIS process's chat (e.g. a
   *  quiz). Same channel the Home chat uses. */
  widget?: ChatWidget;
}

const TYPING_DELAY_MS = 900;

// Stable empty array used as the "no chat yet" fallback inside the
// zustand selector. MUST be module-level so the same reference is
// returned across renders — otherwise React's useSyncExternalStore
// loops with "getSnapshot should be cached".
const EMPTY_CHAT: ChatMessage[] = [];

// ── Fuzzy field/step matching ────────────────────────────────────────────
// The AI labels a declared value ("salary cost") that rarely matches a
// metric label character-for-character ("estimated cost"). Exact-match
// dropped these on the floor — the value got appended as a hidden 4th+
// metric (only the first three render) or lost entirely. These helpers do
// Hebrew-aware token-overlap matching so a declared value lands on the
// RIGHT existing metric, and so a value that answers an open step checks
// that step off.

/** lowercase, strip Hebrew niqqud + punctuation, collapse whitespace. */
function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud / cantillation marks
    .replace(/["'`.,:;!?()[\]{}<>/\\|״׳–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Short Hebrew/English particles that carry no matching signal.
const STOP_TOKENS = new Set([
  'the', 'a', 'of', 'to', 'for', 'and', 'my', 'is', 'on', 'in',
  'של', 'עם', 'על', 'את', 'לי', 'כ', 'ה', 'ו', 'ל', 'ב', 'מ',
]);

/** Significant tokens (≥2 chars, non-stopword) for overlap matching. */
function sigTokens(s: string): string[] {
  return normalizeLabel(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

/** Index of the metric whose label best matches `wanted` — exact first,
 *  then a shared significant token. -1 if nothing reasonable matches. */
function matchMetricIndex(metrics: { label: string }[], wanted: string): number {
  const wn = normalizeLabel(wanted);
  const exact = metrics.findIndex((m) => normalizeLabel(m.label) === wn);
  if (exact >= 0) return exact;
  const wTokens = new Set(sigTokens(wanted));
  if (wTokens.size === 0) return -1;
  return metrics.findIndex((m) => sigTokens(m.label).some((t) => wTokens.has(t)));
}

/** Given declared updates, check off any OPEN step whose title is clearly
 *  answered by one (e.g. user gives the company name → "decide company
 *  name"). Conservative: needs ≥half the step's significant tokens shared.
 *  Returns the (possibly) updated steps + the titles that got completed. */
function completeStepsFromUpdates(
  steps: UnitStep[] | undefined,
  updates: Array<{ metricLabel: string; value: string }>,
): { steps: UnitStep[]; completed: string[] } {
  const list = steps ?? [];
  if (!list.length || !updates?.length) return { steps: list, completed: [] };
  const completed: string[] = [];
  const next = list.map((s) => {
    if (s.done) return s;
    const stTokens = sigTokens(s.title);
    if (!stTokens.length) return s;
    for (const u of updates) {
      const uTokens = new Set([
        ...sigTokens(u.metricLabel),
        ...sigTokens(String(u.value)),
      ]);
      const overlap = stTokens.filter((t) => uTokens.has(t)).length;
      if (overlap >= 1 && overlap / stTokens.length >= 0.5) {
        completed.push(s.title);
        return { ...s, done: true };
      }
    }
    return s;
  });
  return { steps: next, completed };
}

// ── Drafts: ONE's outward artifacts (the "intent → reality" bridge) ──────────
const DRAFT_CHANNEL_META: Record<
  UnitDraft['channel'],
  { emoji: string; he: string; en: string }
> = {
  whatsapp: { emoji: '💬', he: 'וואטסאפ', en: 'WhatsApp' },
  email: { emoji: '✉️', he: 'מייל', en: 'Email' },
  sms: { emoji: '📱', he: 'SMS', en: 'SMS' },
  call: { emoji: '📞', he: 'שיחה', en: 'Call' },
  form: { emoji: '📝', he: 'טופס', en: 'Form' },
  note: { emoji: '📄', he: 'הערה', en: 'Note' },
};

/** Offline/fallback draft — a plausible outreach built from the process's own
 *  people + open steps, so "Draft a message" always produces something real to
 *  edit even when the AI is unreachable. */
function buildLocalDraft(unit: Unit, userName: string | undefined, lang: 'en' | 'he'): UnitDraft {
  const he = lang === 'he';
  const to = unit.people?.[0]?.name;
  const openStep = (unit.nextSteps ?? []).find((s) => !s.done)?.title;
  const body = he
    ? `שלום${to ? ` ${to}` : ''},\n${userName ? `מדבר ${userName}` : 'פונה אליך'} בנוגע ל${unit.title}.\n${openStep ? `רציתי להתקדם עם: ${openStep}.` : 'רציתי להתקדם בתהליך.'}\nאפשר לתאם? תודה.`
    : `Hi${to ? ` ${to}` : ''},\n${userName ? `${userName} here` : 'Reaching out'} about ${unit.title}.\n${openStep ? `I'd like to move forward with: ${openStep}.` : "I'd like to move this forward."}\nCan we set it up? Thanks.`;
  return {
    id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    channel: 'whatsapp',
    to,
    body,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

export function UnitProfileSheet({ unitId, onClose, onOpenIdentitySwitch, onNewProcess, forceChat, callActive = false }: UnitProfileSheetProps) {
  const { colors, theme } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();
  // ⋮ action-menu open state — declared up top so it's before any early return.
  const [menuOpen, setMenuOpen] = useState(false);
  // Resting float of the input dock above the sheet's bottom edge — clears the
  // home indicator and reads as "floating", a touch LESS than Home's gap. The
  // `|| ` floor covers the case the safe-area context doesn't reach inside the
  // RN-Modal-hosted sheet (it can return 0 there).
  const dockBottom = Math.max(insets.bottom - 4, 14);
  const units = useMvpStore((s) => s.units);
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const rawUnit = units.find((u) => u.id === unitId) ?? null;
  // Keep the LAST-opened unit on screen while the sheet slides closed. Tapping
  // X clears unitId, so rawUnit goes null instantly — without this the content
  // would blank and the sheet would appear to SNAP shut. Holding the last unit
  // lets it slide away with its content, exactly like a drag-close (the drag
  // path only clears unitId AFTER the slide, so it never hit this).
  const lastUnitRef = useRef<Unit | null>(null);
  if (rawUnit) lastUnitRef.current = rawUnit;
  const unit = rawUnit ?? lastUnitRef.current;
  const unitIdentity = unit
    ? identities.find((i) => i.id === unit.identityId)
    : null;

  const [mode, setMode] = useState<Mode>('profile');
  // Keeps the sheet at the FULL snap while in profile mode — set when we switch
  // chat→profile via a TAP (header tap / double-tap), so the sheet doesn't drop
  // to the half card. A DRAG down to the half card clears it (that collapse is
  // intended). Independent of `mode` so the two don't fight.
  const [profileFull, setProfileFull] = useState(false);
  // The + quick-actions panel — rendered inline OVER the card (see overlay).
  const [quickOpen, setQuickOpen] = useState(false);
  // Cross-platform text prompt (replaces iOS-only Alert.prompt) — rides the
  // overlay slot, see render below.
  const [promptConfig, setPromptConfig] = useState<InlinePromptConfig | null>(null);
  // "What the other side sees" preview (shared/public processes) — overlay slot.
  const [previewOpen, setPreviewOpen] = useState(false);
  // The owner's view of the shared conversation (when the process has a code).
  const [threadOpen, setThreadOpen] = useState(false);
  // In-process voice call — a self-contained call mode inside this sheet (the
  // top-level home call dock is behind this Modal, so it can't reach here). The
  // orb call-presence shows at the top and the dock switches to call controls.
  const [inCall, setInCall] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  // The green call ring around the presence orb — a gentle live breath.
  const callRingPulse = useSharedValue(1);
  useEffect(() => {
    if (inCall) {
      callRingPulse.value = withRepeat(withTiming(1.05, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      callRingPulse.value = 1;
    }
  }, [inCall, callRingPulse]);
  const callRingStyle = useAnimatedStyle(() => ({ transform: [{ scale: callRingPulse.value }] }));
  const [text, setText] = useState('');
  // Bumped whenever the sheet opens DIRECTLY into chat mode (a fresh
  // create hand-off, or re-opening a process we were just talking to) —
  // tells the InputBar to pop the keyboard so the conversation is ready
  // to continue without a tap. One-shot: it never re-fires on its own, so
  // dismissing the keyboard mid-conversation isn't undone.
  const [chatFocusSignal, setChatFocusSignal] = useState(0);
  // Per-unit chat history lives in the store (persisted + synced). The
  // selector MUST return a stable reference when there's no entry yet,
  // otherwise zustand's getSnapshot cache invalidates on every render
  // and React throws "infinite loop". EMPTY_CHAT is module-level so the
  // same array is returned across renders.
  const messages = useMvpStore(
    (s) => (unitId ? s.unitChats[unitId] ?? EMPTY_CHAT : EMPTY_CHAT),
  ) as ChatMessage[];
  const appendUnitChat = useMvpStore((s) => s.appendUnitChat);
  const clearUnitChatAction = useMvpStore((s) => s.clearUnitChat);
  const setMessages = useCallback(
    (updater: ((m: ChatMessage[]) => ChatMessage[]) | ChatMessage[]) => {
      if (!unitId) return;
      const cur = (useMvpStore.getState().unitChats[unitId] ?? []) as ChatMessage[];
      const next = typeof updater === 'function' ? updater(cur) : updater;
      if (next.length > cur.length) {
        for (let i = cur.length; i < next.length; i++) {
          const m = next[i];
          appendUnitChat(unitId, { ...m, ts: m.ts ?? Date.now() });
        }
      } else if (next.length === 0) {
        clearUnitChatAction(unitId);
      } else {
        clearUnitChatAction(unitId);
        for (const m of next) appendUnitChat(unitId, { ...m, ts: m.ts ?? Date.now() });
      }
    },
    [unitId, appendUnitChat, clearUnitChatAction],
  );
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<ScrollView>(null);
  // Tracks which unit the render-phase open-detent decision was made for, and
  // whether that open should land in chat (full snap). Drives `initialSnap`
  // synchronously so the sheet presents at the right height on the first frame.
  const openUnitRef = useRef<string | null>(null);
  const openInChatRef = useRef(false);
  // Live keyboard height — fed into the chat's bottom padding so the last
  // message clears the keyboard (the ScrollView isn't height-managed by a
  // KeyboardAvoidingView here, so without this the newest bubble hides
  // behind the keyboard + floating dock).
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Floating-dock keyboard lift. The InputBar is `position: absolute,
  // bottom: 0` so the keyboard would cover it. Listen for keyboard
  // show/hide and translate the dock up by the keyboard height.
  // Reanimated translateY so it stays on the UI thread.
  const dockLift = useSharedValue(0);
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      // The dock already rests `dockBottom` above the screen bottom, so lift it
      // by (keyboard − that gap) PLUS a small breathing gap so it floats a touch
      // ABOVE the keyboard top (matching the home dock), not glued to it.
      // `Math.max(0, …)` guards a hardware / floating keyboard that reports a
      // height SMALLER than the resting gap — without it the lift would go
      // POSITIVE and shove the dock down off the bottom edge.
      const KB_GAP = 14;
      dockLift.value = withTiming(-Math.max(0, h - dockBottom + KB_GAP), {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      // Grow the chat's bottom padding by the keyboard height + dock, then
      // pin to the newest message so it sits ABOVE the keyboard, not behind it.
      setKeyboardHeight(h);
      requestAnimationFrame(() => chatRef.current?.scrollToEnd({ animated: true }));
    };
    // Drop the dock back to its resting float. The lift is ONLY ever negative
    // (dock moves up), so a MISSED reset strands the input high up the card —
    // which reads as "the input disappeared" after a while of chatting.
    const resetDock = () => {
      dockLift.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      setKeyboardHeight(0);
    };
    const a = Keyboard.addListener(showEv, onShow);
    const b = Keyboard.addListener(hideEv, resetDock);
    // Belt-and-suspenders reset. On iOS `keyboardWillHide` is genuinely MISSED
    // when the keyboard is dismissed by a scroll-drag, an interactive swipe, or
    // an app background→foreground cycle — leaving `dockLift` stuck at its
    // negative (lifted) value and the floating input stranded off the top of
    // the visible card. `keyboardDidHide` ALWAYS fires, so we reset on it too.
    // This is the direct fix for the vanishing process input.
    const c =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardDidHide', resetDock)
        : null;
    return () => {
      a.remove();
      b.remove();
      c?.remove();
    };
  }, [dockLift, dockBottom]);
  // Safety net: any time we're NOT in chat mode, the input dock belongs at its
  // resting float. A missed keyboard event could otherwise leave it lifted after
  // we've already returned to the profile — this pins it back down.
  useEffect(() => {
    if (mode !== 'chat') {
      dockLift.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      setKeyboardHeight(0);
    }
  }, [mode, dockLift]);
  // Returning from the background can skip the keyboard-hide event entirely,
  // leaving the dock stranded up the card (the "input vanished" report). On
  // foreground, if the keyboard isn't actually up, drop the dock back to rest.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !Keyboard.isVisible()) {
        dockLift.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
        setKeyboardHeight(0);
      }
    });
    return () => sub.remove();
  }, [dockLift]);
  // Live snap index of the sheet (-1 closed … 0 half/72% … 1 full/92%).
  const sheetIndex = useSharedValue(0);

  // Mirror `mode` so the sheet-index worklet reaction below can read it.
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  // Dragging the sheet DOWN off the full card while in chat drops the keyboard
  // and returns to the profile (per user request). To re-enter chat, tap the
  // floating input. This also stops the input dock from being stranded/raised
  // at the half card mid-conversation.
  const leaveChatOnCollapse = useCallback(() => {
    // A DRAG down toward the half card: release "stay full" so the sheet settles
    // at the half snap (the intended collapse), and if we were chatting, drop to
    // profile + dismiss the keyboard.
    setProfileFull(false);
    if (modeRef.current !== 'chat') return;
    Keyboard.dismiss();
    setMode('profile');
  }, []);
  // Tapping the chat-header title returns to the profile — at the FULL card (a
  // tap must NOT drop to the half; only a drag does). Keyboard down first.
  const backToProfile = useCallback(() => {
    Keyboard.dismiss();
    setProfileFull(true);
    setMode('profile');
  }, []);
  // Double-tap toggles profile ↔ chat. profile→chat expands to full + pops the
  // keyboard; chat→profile mirrors backToProfile (full, no drop).
  const toggleMode = useCallback(() => {
    haptic.select();
    if (modeRef.current === 'chat') {
      Keyboard.dismiss();
      setProfileFull(true);
      setMode('profile');
    } else {
      setProfileFull(true);
      setMode('chat');
      setChatFocusSignal((n) => n + 1);
    }
  }, []);
  // Double-tap the sheet body toggles profile ↔ chat. A discrete Tap gesture
  // coexists with the scroll — it does NOT claim the vertical pan, so it doesn't
  // disturb gorhom's scroll-pan bridge (only a PAN gesture would). `runOnJS` so
  // the plain JS `toggleMode` runs directly from the gesture callback.
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(320)
        .runOnJS(true)
        .onEnd((_e, success) => {
          if (success) toggleMode();
        }),
    [toggleMode],
  );
  useAnimatedReaction(
    () => sheetIndex.value,
    (cur, prev) => {
      'worklet';
      if (prev == null) return;
      // Crossed from "near full" down toward the half card — but NOT on the way
      // to fully closed (cur > -0.4) — so a real half-card collapse, not a close.
      if (prev >= 0.6 && cur < 0.6 && cur > -0.4) {
        runOnJS(leaveChatOnCollapse)();
      }
    },
  );

  // Status-bar clock colour, tied to the SNAP so it turns over DURING the close
  // slide (not on a delayed onClose flip). The clock stays VISIBLE the whole
  // time — only its colour changes:
  //   • sheet open at any snap (index > −0.5) → the dark backdrop is behind the
  //     clock → WHITE clock.
  //   • closing (index drops past −0.5) → the backdrop has faded enough that the
  //     light home shows through → BLACK clock. It has flipped BEFORE the sheet
  //     unmounts, so when the card is gone the clock is ALREADY black (matching
  //     the black clock of the cards list behind it) — no delayed white→black.
  const [clockDark, setClockDark] = useState(false);
  useAnimatedReaction(
    () => sheetIndex.value < -0.5,
    (dark, prev) => {
      'worklet';
      if (prev == null || dark === prev) return;
      runOnJS(setClockDark)(dark);
    },
  );

  // Compact sticky title — once the big centred title scrolls up under the
  // header, a small "emoji + title" fades into the bar centre, between the ⋮
  // and the X. Driven by a PLAIN JS onScroll callback: gorhom wraps it in
  // runOnJS internally, so (unlike a worklet handler — which broke the scroll
  // bridge before) it composes cleanly with gorhom's own gesture bookkeeping.
  const COMPACT_TITLE_THRESHOLD = 54;
  // Track the live scroll offset in a shared value; the compact bar title is a
  // CONTINUOUS function of it (interpolated below). At the top (y=0 — or when the
  // content isn't scrollable and onScroll never fires, so the value stays 0) it's
  // GUARANTEED hidden. That kills the "title shown twice" overlap: the small bar
  // title only fades in AFTER the big centred title has scrolled up under the
  // header, and it tracks the finger during the scroll.
  const compactTitleSV = useSharedValue(0);
  const handleProfileScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      compactTitleSV.value = e?.nativeEvent?.contentOffset?.y ?? 0;
    },
    [compactTitleSV],
  );
  const compactTitleStyle = useAnimatedStyle(() => {
    // Fade in only once the big title has cleared the header — a clean handoff,
    // never both titles visible at once.
    const op = interpolate(
      compactTitleSV.value,
      [COMPACT_TITLE_THRESHOLD, COMPACT_TITLE_THRESHOLD + 34],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: op, transform: [{ translateY: (1 - op) * 6 }] };
  });

  // Floating input dock. It now renders in the sheet's OVERLAY slot — a sibling
  // pinned to the SCREEN bottom, NOT inside gorhom's max-snap-sized content — so
  // there is NO snap-offset math (that fragile lift is exactly what kept the
  // input vanishing at the half card). Just the keyboard lift, plus an
  // open/close fade tied to the sheet index so the dock doesn't hang at the
  // bottom while the card slides away on close.
  const inputDockStyle = useAnimatedStyle(() => {
    const openFade = interpolate(sheetIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: openFade,
      transform: [{ translateY: dockLift.value }],
    };
  });

  // (The swipe-to-flip gesture was removed: wrapping the BottomSheetScrollView
  // in a Pan GestureDetector competed with gorhom's own scroll-pan bridge,
  // which broke content scroll, the compact-title onScroll, and the floating
  // input. We now mirror the (working) OneProfileSheet — the scroll view is a
  // direct child, no gesture wrapper. Profile↔chat still switches via tapping
  // the input (→ chat) and the small chat header (→ profile).)

  // NOTE: a worklet scroll handler used to drive a sticky compact title
  // here. Passing useAnimatedScrollHandler into gorhom's BottomSheetScrollView
  // crashed the sheet on scroll — gorhom owns that prop internally and
  // overriding it broke the scroll bridge. Removed; if we re-add a sticky
  // title we'll do it via a non-worklet path.

  // Compact title starts hidden on every (re)open and whenever we leave the
  // profile scroll — chat mode renders its own header, so the bar title would
  // double up otherwise.
  useEffect(() => {
    if (mode !== 'profile') {
      // Chat mode renders its own header title; keep the scroll-driven bar title
      // collapsed so they never double up.
      compactTitleSV.value = 0;
    }
  }, [mode, compactTitleSV]);

  useEffect(() => {
    if (!unitId) {
      // Reset transient UI state when the sheet closes. The chat
      // history is PERSISTED — leave unitChats alone so the next open
      // shows the prior conversation. The user can wipe explicitly
      // from the kebab menu (later).
      setMode('profile');
      setText('');
      setIsTyping(false);
      compactTitleSV.value = 0;
      // This component never unmounts (unitId just toggles), so a prior
      // chat could leave the dock lifted onto a keyboard that hid without
      // firing keyboardWillHide. Drop it back to rest so the floating input
      // is never stranded off-screen on the next open.
      dockLift.value = 0;
      setKeyboardHeight(0);
      setProfileFull(false);
      // End any in-process call when the sheet closes.
      setInCall(false);
      // Reset the clock to WHITE now that the sheet is GONE (no StatusBar is
      // rendered while unitId is null, so this is invisible). This is what kills
      // the reopen "flick": without it clockDark stays TRUE from the close, so
      // the NEXT open's first frame renders dark-content and then animates to
      // light — a visible flip even in dark mode (where the clock is white
      // anyway). Resetting here means the next open starts already-white.
      setClockDark(false);
      return;
    }
    // Fresh open: start the dock at rest. If we land in chat mode the
    // keyboard's own show event will lift it a beat later.
    dockLift.value = 0;
    setKeyboardHeight(0);
    setProfileFull(false);
    // Reset the clock to WHITE for the open. The close turns clockDark → true
    // (white→black during the slide) and that value PERSISTS on this
    // never-unmounting component — so without this reset the NEXT open would
    // start BLACK and then flip to white mid-open (the status-bar "flick").
    setClockDark(false);
    // Profile by default; chat for unseen updates / a fresh conversation — OR
    // when the user long-pressed the card (forceChat). A JOINED process (you're
    // the provider) always opens to the profile, which leads with the shared
    // conversation — the local AI chat isn't the point there.
    const joinedHere = useMvpStore.getState().units.find((x) => x.id === unitId)?.sharedRole === 'human';
    const openChat = !joinedHere && (forceChat || computeOpenInChat(unitId));
    // Seed sheetIndex to the snap we're about to present at (0 = half/profile,
    // 1 = full/chat) BEFORE gorhom takes over, so the dock's snap-offset is
    // correct from the first frame regardless of any stale value left behind by
    // a previous session. This is the fix for the input vanishing on reopen.
    sheetIndex.value = openChat ? 1 : 0;
    setMode(openChat ? 'chat' : 'profile');
    setText('');
    setIsTyping(false);
    // Opening straight into chat → pop the keyboard so the user can keep
    // typing immediately (the InputBar focuses after the sheet settles).
    if (openChat) setChatFocusSignal((n) => n + 1);
  }, [unitId]);

  useEffect(() => {
    chatRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  // Which tools are enabled — so the chat can surface tool starters (making the
  // toolbox discoverable: a tap sends the phrase through the normal pipeline,
  // which the deploy intercepts turn into a live widget).
  const enabledTools = useMvpStore((s) => s.enabledTools);

  // Contextual conversation starters for the chat — rebuilt only when the
  // process / language / tools change (Date.now() is read once per rebuild; the
  // chips don't need to tick every second). Tool starters lead (they're the
  // actionable "ONE can DO this" chips), then the contextual ones.
  const chatSuggestions = useMemo(() => {
    if (!unit) return [];
    const he = lang === 'he';
    const tools: string[] = [];
    if (toolEnabled(enabledTools, 'booking')) tools.push(he ? 'לקבוע תור' : 'Book a time');
    if (toolEnabled(enabledTools, 'forms')) tools.push(he ? 'מלא פרטי קשר' : 'Collect contact details');
    if (toolEnabled(enabledTools, 'quiz') && quizForText(unit.title)) tools.push(he ? 'תן לי תרגול' : 'Quiz me');
    return [...tools, ...buildChatSuggestions(unit, lang, Date.now())].slice(0, 5);
  }, [unit, lang, enabledTools]);

  // Tool launchers for the "+" panel — always reachable (unlike the chat chips,
  // which fade after a few messages). Booking + form are generic; quiz shows
  // only when one fits this process.
  const launcherTools = useMemo(() => {
    const he = lang === 'he';
    const out: Array<{ kind: ToolKind; emoji: string; label: string }> = [];
    if (toolEnabled(enabledTools, 'booking')) out.push({ kind: 'booking', emoji: '📅', label: he ? 'תור' : 'Booking' });
    if (toolEnabled(enabledTools, 'forms')) out.push({ kind: 'form', emoji: '📝', label: he ? 'טופס' : 'Form' });
    if (toolEnabled(enabledTools, 'quiz') && quizAvailableFor(unit?.title)) out.push({ kind: 'quiz', emoji: '🧠', label: he ? 'תרגול' : 'Quiz' });
    return out;
  }, [unit?.title, lang, enabledTools]);

  // Decide the OPEN detent SYNCHRONOUSLY the first render a unit appears.
  // Deriving it from `mode` state was a frame too late — the sheet had already
  // presented at the low card before the post-render effect flipped mode to
  // chat, so a chat-open landed half-height. A render-phase ref has the answer
  // in time. (Same chat-recency rule as the [unitId] effect above.)
  if (unitId && openUnitRef.current !== unitId) {
    openUnitRef.current = unitId;
    openInChatRef.current = !!forceChat || computeOpenInChat(unitId);
  } else if (!unitId) {
    openUnitRef.current = null;
    openInChatRef.current = false;
  }

  // Draft-compose state — declared BEFORE the `!unit` early return so its hook
  // slot is stable across the closed→open transition (else "rendered more hooks
  // than during the previous render"). `composeDraft` below reads it.
  const [isDrafting, setIsDrafting] = useState(false);

  if (!unit) return null;

  const handleSend = () => submit(text);
  // Start / end the in-process voice call. Dismiss the keyboard so the call
  // controls + orb presence read cleanly.
  const startUnitCall = () => {
    haptic.tap();
    Keyboard.dismiss();
    setInCall(true);
  };
  const endUnitCall = () => {
    haptic.tap();
    setInCall(false);
    setMuted(false);
    setCameraOn(false);
    setSpeakerOn(true);
  };
  // Answering with a FILE (photo) — the file IS the reply. Record it as the
  // user's message (with any typed caption), then ONE acknowledges and keeps
  // working. No vision model here, so it confirms + continues rather than
  // "reading" the image.
  const handleAttachImage = (uri: string) => {
    if (!unitId) return;
    haptic.tap();
    setQuickOpen(false);
    if (mode !== 'chat') setMode('chat');
    const caption = text.trim();
    setText('');
    const ts = Date.now();
    setMessages((m) => [
      ...m,
      { id: `u${ts}`, from: 'user', text: caption, imageUri: uri, ts },
      {
        id: `o${ts + 1}`,
        from: 'one',
        text: he
          ? 'קיבלתי את הקובץ 📎 — צירפתי אותו לתהליך וממשיך מכאן.'
          : 'Got the file 📎 — added it to the process and continuing from here.',
        ts: ts + 1,
      },
    ]);
  };
  // Core send — takes the raw text so BOTH the input bar and the tappable
  // suggestion chips can drive a turn through the exact same AI pipeline.
  const submit = (raw: string) => {
    const v = raw.trim();
    if (!v || !unit) return;
    haptic.tap();
    setText('');
    const uts = Date.now();
    setMessages((m) => [...m, { id: `u${uts}`, from: 'user', text: v }]);

    // TOOL — deploy a QUIZ for THIS process when asked to practice / be tested
    // and ONE has a quiz for it. The widget renders in this process's chat and
    // its score flows onto the process metric. Client-side, no AI round-trip.
    if (
      toolEnabled(useMvpStore.getState().enabledTools, 'quiz') &&
      /מבחן|תרגול|תרגל|בחן אותי|תבחן|quiz|test me|practice/i.test(v)
    ) {
      const def = quizForText(unit.title) ?? quizForText(v);
      if (def) {
        const qHe = /[֐-׿]/.test(v) || he;
        const run = buildQuizRun(def, unit.id, qHe ? 'he' : 'en');
        useMvpStore.getState().startQuizRun(run);
        setMessages((m) => [
          ...m,
          { id: `o${uts + 1}`, from: 'one', text: qHe ? `יאללה — ${run.title} קצר 👇` : `Let's go — a quick ${run.title} 👇`, ts: uts + 1 },
          { id: `w${uts + 2}`, from: 'one', text: '', ts: uts + 2, widget: { kind: 'quiz', runId: run.id } },
        ]);
        return;
      }
    }

    // TOOL — deploy a BOOKING for THIS process: offer concrete slots with its
    // provider; the confirmed slot lands on the process timeline. Client-side.
    if (toolEnabled(useMvpStore.getState().enabledTools, 'booking') && bookingForText(v)) {
      const bHe = /[֐-׿]/.test(v) || he;
      const run = buildBookingRun({
        unitId: unit.id,
        title: bHe ? 'קביעת תור' : 'Booking',
        provider: unit.people?.[0]?.name,
        lang: bHe ? 'he' : 'en',
      });
      useMvpStore.getState().startBookingRun(run);
      setMessages((m) => [
        ...m,
        { id: `o${uts + 1}`, from: 'one', text: bHe ? 'בטח — הנה כמה זמנים פנויים 👇' : 'Sure — a few open times 👇', ts: uts + 1 },
        { id: `w${uts + 2}`, from: 'one', text: '', ts: uts + 2, widget: { kind: 'booking', runId: run.id } },
      ]);
      return;
    }

    // TOOL — deploy a FORM for THIS process: collect structured details; on
    // submit they save into disclosure + a note on this process. Client-side.
    if (toolEnabled(useMvpStore.getState().enabledTools, 'forms')) {
      const fDef = formForText(v);
      if (fDef) {
        const fHe = /[֐-׿]/.test(v) || he;
        const run = buildFormRun(fDef, unit.id, fHe ? 'he' : 'en');
        useMvpStore.getState().startFormRun(run);
        setMessages((m) => [
          ...m,
          { id: `o${uts + 1}`, from: 'one', text: fHe ? 'בטח — מלא את הפרטים ואשמור 👇' : 'Sure — fill these in 👇', ts: uts + 1 },
          { id: `w${uts + 2}`, from: 'one', text: '', ts: uts + 2, widget: { kind: 'form', runId: run.id } },
        ]);
        return;
      }
    }

    // "Remember that…" → ONE saves it to his memory of you and confirms; no AI
    // turn. (Seen later in the ONE profile → "What ONE remembers".)
    const rememberFact = extractRememberFact(v);
    if (rememberFact) {
      useMvpStore.getState().addMemory(rememberFact);
      setMessages((m) => [
        ...m,
        {
          id: `o${uts + 1}`,
          from: 'one',
          text: he ? `שמרתי לזיכרון 🧠 — ${rememberFact}` : `Got it 🧠 — I'll remember: ${rememberFact}`,
          ts: uts + 1,
        },
      ]);
      return;
    }

    setIsTyping(true);
    const history = messages.map((m) => ({
      role: m.from === 'one' ? ('assistant' as const) : ('user' as const),
      content: m.text,
    }));
    setTimeout(async () => {
      let reply: string;
      // An interactive tool widget ONE chose to deploy this turn (deploy_tool).
      let toolWidget: ChatWidget | null = null;
      try {
        // existingUnits gives ONE awareness of every sibling process
        // under this identity, so a mention like "I also need to renew
        // my license" routes to the existing "רישיון נהיגה" instead of
        // inventing a duplicate. activeUnit still wins for unspecified
        // context — see system prompt rule.
        const allUnits = useMvpStore.getState().units;
        const siblings = allUnits
          .filter((u) => u.identityId === unit.identityId && u.id !== unit.id)
          .slice(0, 10)
          .map((u) => ({ title: u.title, emoji: u.emoji, tags: u.tagIds }));
        const intent = await invokeOneIntent(v, {
          history,
          voiceStyle: personalityPrompt(useMvpStore.getState().agentPersonality, lang),
          userMemories: useMvpStore.getState().memories.map((m) => m.text),
          userDisclosure: openDisclosureStrings(disclosureForIdentity(unit.identityId), lang === 'he'),
          activeUnit: {
            title: unit.title,
            emoji: unit.emoji,
            broadcast: unit.latestBroadcastText[0],
            // Hand ONE the current metric labels so it reuses them verbatim
            // when the user declares a matching value (no duplicate metrics).
            metricLabels: (unit.metrics ?? []).map((m) => m.label),
            // Full current state → ONE answers as THIS process's own agent,
            // aware of the plan and where it stands (not a generic home chat).
            openSteps: (unit.nextSteps ?? []).filter((s) => !s.done).map((s) => s.title),
            progress: (() => {
              const steps = unit.nextSteps ?? [];
              if (steps.length) return `${steps.filter((s) => s.done).length}/${steps.length}`;
              return unit.progress ? `${unit.progress.current}/${unit.progress.total}` : undefined;
            })(),
            metricsSummary:
              (unit.metrics ?? [])
                .slice(0, 5)
                .map((m) => `${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
                .join(' · ') || undefined,
          },
          existingUnits: siblings,
        });
        reply = intent.reply;
        // Side effects on the active unit. We re-read the current store
        // state to avoid clobbering work the user did elsewhere mid-turn.
        const store = useMvpStore.getState();
        const current = store.units.find((u) => u.id === unit.id);
        if (!current) {
          /* unit was deleted while ONE was thinking — nothing to write */
        } else if (intent.kind === 'create_process' && intent.process) {
          // User asked about a totally different topic while inside this
          // unit. Spawn a sibling process under the same identity.
          // Dedupe guard: if a similar process already exists, reuse it
          // (same logic as Home sendChat).
          const allUnits = store.units.filter(
            (u) => u.identityId === unit.identityId && u.id !== unit.id,
          );
          const proposedTitle = intent.process.title?.trim() ?? v;
          const similar = findSimilarUnit(proposedTitle, allUnits, unit.identityId);
          if (similar) {
            const target = allUnits.find((u) => u.id === similar.id);
            if (target) {
              store.pushUnitNotification({
                unitId: target.id,
                text: `Captured under ${target.title}`,
                emoji: target.emoji,
                kind: 'capture',
              });
            }
          } else {
            const created = unitFromIntent(intent, unit.identityId, lang);
            if (created) {
              store.addUnit(created);
              store.pushUnitNotification({
                unitId: created.id,
                text: `New process: ${created.title}`,
                emoji: created.emoji,
                kind: 'created',
              });
            }
          }
        } else if (intent.kind === 'extract_task' && intent.task) {
          const stepTitle = [
            intent.task.action,
            intent.task.contact ? `→ ${intent.task.contact}` : '',
            intent.task.when ? `(${intent.task.when})` : '',
          ]
            .filter(Boolean)
            .join(' ');
          const existingPeople = current.people ?? [];
          const contactName = intent.task.contact?.trim();
          const peopleNext =
            contactName &&
            !existingPeople.find(
              (p) => p.name.toLowerCase() === contactName.toLowerCase(),
            )
              ? [
                  ...existingPeople,
                  { id: `p_${Date.now()}`, name: contactName },
                ]
              : existingPeople;
          store.updateUnit(unit.id, {
            nextSteps: [
              ...(current.nextSteps ?? []),
              {
                id: `ns_${Date.now()}`,
                title: stepTitle,
                done: false,
                subtitle: intent.task.contact ?? undefined,
              },
            ],
            people: peopleNext,
            updatedAt: new Date().toISOString(),
          });
          store.pushUnitNotification({
            unitId: unit.id,
            text: `Captured: ${stepTitle}`,
            emoji: unit.emoji,
            kind: 'capture',
          });
        } else if (intent.kind === 'decision' && intent.decision) {
          const decisionId = `d_${Date.now()}`;
          const nowIso = new Date().toISOString();
          store.updateUnit(unit.id, {
            decisions: [
              ...(current.decisions ?? []),
              {
                id: decisionId,
                text: intent.decision.text,
                createdAt: nowIso,
              },
            ],
            latestBroadcastText: [
              intent.decision.text,
              ...current.latestBroadcastText,
            ].slice(0, 2) as [string, string?],
            lastUpdatedAt: nowIso,
            updatedAt: nowIso,
          });
          store.pushUnitNotification({
            unitId: unit.id,
            text: `Decision saved: ${intent.decision.text}`,
            emoji: unit.emoji,
            kind: 'decision',
          });
        } else if (intent.kind === 'add_reminder' && intent.reminder) {
          const nowIso = new Date().toISOString();
          store.updateUnit(unit.id, {
            reminders: [
              ...(current.reminders ?? []),
              {
                id: `r_${Date.now()}`,
                text: intent.reminder.text,
                dueLabel: intent.reminder.when,
                dueAt: resolveReminderDue(intent.reminder.when, Date.now()),
                done: false,
                createdAt: nowIso,
              },
            ],
            lastUpdatedAt: nowIso,
            updatedAt: nowIso,
          });
          store.pushUnitNotification({
            unitId: unit.id,
            text: `Reminder set: ${intent.reminder.text}${intent.reminder.when ? ` (${intent.reminder.when})` : ''}`,
            emoji: unit.emoji,
            kind: 'capture',
          });
        } else if (intent.kind === 'update_process' && intent.updates?.length) {
          // Match each declared value to an existing metric via fuzzy
          // (Hebrew-aware) token overlap — "salary cost" lands on the
          // existing "estimated cost" instead of being appended as a hidden
          // 4th metric. Only an unmatched label appends a new metric (≤6).
          const existing = current.metrics ?? [];
          const updated = [...existing];
          for (const u of intent.updates.slice(0, 3)) {
            const idx = matchMetricIndex(updated, u.metricLabel);
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                value: u.value,
                unit: u.unit ?? updated[idx].unit,
              };
            } else if (updated.length < 6) {
              updated.push({
                id: `m_${Date.now()}_${updated.length}`,
                label: u.metricLabel.trim(),
                value: u.value,
                unit: u.unit?.trim() || undefined,
              });
            }
          }
          // A declared value can also ANSWER an open step (the company name
          // answers "decide company name") — check those off so the steps
          // list reflects reality, not just the metrics.
          const { steps: nextSteps, completed } = completeStepsFromUpdates(
            current.nextSteps,
            intent.updates,
          );
          store.updateUnit(unit.id, {
            metrics: updated,
            ...(completed.length ? { nextSteps } : null),
            lastUpdatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          const summary = intent.updates
            .slice(0, 2)
            .map((u) => `${u.metricLabel} ${u.value}${u.unit ? ' ' + u.unit : ''}`)
            .join(', ');
          store.pushUnitNotification({
            unitId: unit.id,
            text: completed.length
              ? `Updated: ${summary} · ✓ ${completed[0]}`
              : `Updated: ${summary}`,
            emoji: unit.emoji,
            kind: 'update',
          });
        } else if (intent.kind === 'draft_message' && intent.draft?.body) {
          // ONE composed the actual outward message. Drop it into the process
          // as an editable, sendable artifact — the intent → reality bridge.
          store.addDraft(
            unit.id,
            {
              id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
              channel: intent.draft.channel ?? 'note',
              to: intent.draft.to?.trim() || undefined,
              subject: intent.draft.subject?.trim() || undefined,
              body: intent.draft.body.trim(),
              status: 'draft',
              createdAt: new Date().toISOString(),
            },
            lang,
          );
        } else if (intent.kind === 'deploy_tool' && intent.tool) {
          // ONE chose to drop an interactive tool into THIS process's chat.
          const tHe = /[֐-׿]/.test(v) || he;
          const topic = intent.tool.topic ?? v;
          if (intent.tool.kind === 'quiz') {
            const def = quizForText(topic) ?? quizForText(unit.title) ?? quizForText(v);
            if (def) {
              const run = buildQuizRun(def, unit.id, tHe ? 'he' : 'en');
              useMvpStore.getState().startQuizRun(run);
              toolWidget = { kind: 'quiz', runId: run.id };
            }
          } else if (intent.tool.kind === 'booking') {
            const run = buildBookingRun({ unitId: unit.id, title: tHe ? 'קביעת תור' : 'Booking', provider: unit.people?.[0]?.name, lang: tHe ? 'he' : 'en' });
            useMvpStore.getState().startBookingRun(run);
            toolWidget = { kind: 'booking', runId: run.id };
          } else if (intent.tool.kind === 'form') {
            const def = formForText(topic) ?? formForText(v) ?? formForText('טופס');
            if (def) {
              const run = buildFormRun(def, unit.id, tHe ? 'he' : 'en');
              useMvpStore.getState().startFormRun(run);
              toolWidget = { kind: 'form', runId: run.id };
            }
          }
        }
      } catch (err) {
        console.warn('[UnitProfileSheet] invokeOneIntent failed:', err);
        reply = await generateUnitReply(v, { unit, lang }, history);
      }
      setIsTyping(false);
      const rts = Date.now();
      setMessages((m) => {
        const next: ChatMessage[] = [...m, { id: `o${rts}`, from: 'one', text: reply }];
        if (toolWidget) next.push({ id: `wt${rts}`, from: 'one', text: '', widget: toolWidget });
        return next;
      });
    }, TYPING_DELAY_MS);
  };

  // "Ask ONE to draft a message" — ONE composes the actual next outreach for
  // this process (aware of its people + open steps) and drops it in as an
  // editable, sendable draft. Deterministic: on any AI failure it falls back to
  // a local template so a draft always appears. Plain function (NOT a hook) so
  // it can live below the `if (!unit) return null` guard; the `isDrafting` state
  // it reads is declared above that guard.
  const composeDraft = async () => {
    if (!unit || isDrafting) return;
    haptic.tap();
    setIsDrafting(true);
    const store = useMvpStore.getState();
    const cur = store.units.find((u) => u.id === unit.id) ?? unit;
    const people = (cur.people ?? []).map((p) => p.name).filter(Boolean);
    const openSteps = (cur.nextSteps ?? []).filter((s) => !s.done).map((s) => s.title);
    const prompt = he
      ? `נסח את ההודעה הבאה שכדאי לשלוח עכשיו כדי לקדם את "${cur.title}". כתוב טקסט מלא ומוכן לשליחה, בעברית.${people.length ? ` אנשים בתהליך: ${people.join(', ')}.` : ''}`
      : `Draft the next message worth sending now to move "${cur.title}" forward. Write the full text, ready to send.${people.length ? ` People in this process: ${people.join(', ')}.` : ''}`;
    try {
      const intent = await invokeOneIntent(prompt, {
        voiceStyle: personalityPrompt(store.agentPersonality, lang),
        userMemories: store.memories.map((m) => m.text),
        userDisclosure: openDisclosureStrings(disclosureForIdentity(cur.identityId), lang === 'he'),
        activeUnit: {
          title: cur.title,
          emoji: cur.emoji,
          broadcast: cur.latestBroadcastText[0],
          openSteps,
          metricsSummary:
            (cur.metrics ?? [])
              .slice(0, 5)
              .map((m) => `${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
              .join(' · ') || undefined,
        },
      });
      if (intent.kind === 'draft_message' && intent.draft?.body) {
        store.addDraft(
          cur.id,
          {
            id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
            channel: intent.draft.channel ?? 'note',
            to: intent.draft.to?.trim() || undefined,
            subject: intent.draft.subject?.trim() || undefined,
            body: intent.draft.body.trim(),
            status: 'draft',
            createdAt: new Date().toISOString(),
          },
          lang,
        );
      } else {
        store.addDraft(cur.id, buildLocalDraft(cur, store.name, lang), lang);
      }
    } catch (e) {
      console.warn('[composeDraft] failed, using local draft:', e);
      const st = useMvpStore.getState();
      st.addDraft(unit.id, buildLocalDraft(cur, st.name, lang), lang);
    } finally {
      setIsDrafting(false);
    }
  };

  // Share this process WITH ANOTHER ONE — add them as a collaborator on the
  // process. No multiplayer backend yet, so the in-app truth is: they land in
  // People, the process flips to "shared", and ONE logs + announces it.
  const shareWithOne = () => {
    if (!unit) return;
    const apply = async (raw: string) => {
      const nm = raw.trim().replace(/^@/, '');
      if (!nm) return;
      const store = useMvpStore.getState();
      const cur = store.units.find((u) => u.id === unit.id);
      if (!cur) return;
      const already = (cur.people ?? []).some(
        (p) => p.name.toLowerCase() === nm.toLowerCase(),
      );
      const ts = new Date().toISOString();
      store.updateUnit(unit.id, {
        people: already
          ? cur.people
          : [
              ...(cur.people ?? []),
              { id: `p_${Date.now()}`, name: nm, role: 'Shared ONE', connectionType: 'partner' as const },
            ],
        visibility: 'shared',
        relationLabel: `Shared with ${nm}`,
        lastUpdatedAt: ts,
        updatedAt: ts,
      });
      store.pushUnitNotification({ unitId: unit.id, text: `Shared with ${nm}`, emoji: '🤝', kind: 'update' });

      // Publish a DISCLOSURE-SAFE snapshot to the shared backend so the other
      // side can actually join (only open facts + the outward message cross;
      // ask/private stay local). Degrades to local-only when unreachable.
      const policy = disclosureForIdentity(cur.identityId);
      const sharedByName = policy.find((d) => d.key === 'name' && d.tier === 'open' && !!d.value?.trim())?.value?.trim();
      const row = await shareUnit(
        {
          title: cur.title,
          emoji: cur.emoji,
          status: unitStatusLine(cur, he),
          openFacts: openDisclosureStrings(policy, he),
          message: cur.drafts?.[0]?.body,
          sharedByName,
          providerName: nm,
        },
        sharedByName ?? unitIdentity?.name ?? 'ONE',
      );
      if (row?.code) {
        store.updateUnit(unit.id, { shareCode: row.code });
        store.pushUnitNotification({
          unitId: unit.id,
          text: he ? `קוד הצטרפות: ${row.code}` : `Join code: ${row.code}`,
          emoji: '🔗',
          kind: 'event',
        });
        // Open the conversation: post the outward message (as ONE) so the other
        // side sees it the moment they join, not just in the static snapshot.
        const opener = cur.drafts?.[0]?.body?.trim();
        if (opener) {
          void postSharedMessage(row.code, sharedByName ?? unitIdentity?.name ?? 'ONE', 'one', opener);
        }
      }
    };
    setPromptConfig({
      title: he ? 'שיתוף עם ONE' : 'Share with a ONE',
      message: he ? 'שם או @כינוי של ה-ONE שתרצה בתהליך הזה.' : 'Name or @handle of the ONE you want on this process.',
      placeholder: he ? 'שם או @כינוי' : 'Name or @handle',
      onSubmit: (v) => { void apply(v); },
    });
  };

  // Deploy a tool from the "+" launcher — build it (tied to this process) and
  // drop it into the chat, switching to the chat view so it's visible.
  const deployToolFromLauncher = (kind: ToolKind) => {
    if (!unit) return;
    const topic = kind === 'quiz' ? unit.title : kind === 'form' ? (he ? 'פרטי קשר' : 'contact details') : undefined;
    const widget = startToolRun(kind, {
      unitId: unit.id,
      unitTitle: unit.title,
      provider: unit.people?.[0]?.name,
      topic,
      lang: he ? 'he' : 'en',
    });
    if (!widget) return;
    setMode('chat');
    const intro =
      kind === 'booking' ? (he ? 'בטח — הנה כמה זמנים פנויים 👇' : 'Sure — a few open times 👇')
      : kind === 'form' ? (he ? 'בטח — מלא את הפרטים 👇' : 'Sure — fill these in 👇')
      : (he ? 'יאללה — תרגול קצר 👇' : 'Let’s practice 👇');
    const ts = Date.now();
    setMessages((m) => [
      ...m,
      { id: `ol${ts}`, from: 'one', text: intro },
      { id: `wl${ts}`, from: 'one', text: '', widget },
    ]);
  };

  // The floating input dock. Rendered into the sheet's OVERLAY slot (a sibling
  // pinned to the SCREEN bottom, not inside gorhom's snap-sized content), so it
  // stays at the bottom edge at BOTH snaps — the half-card no longer hides it.
  const inputDockNode = (
    <Animated.View
      style={[styles.inputDock, { bottom: dockBottom }, inputDockStyle]}
      pointerEvents="box-none"
    >
      <InputBar
        value={text}
        onChangeText={setText}
        placeholder={mode === 'chat' ? (he ? 'כתוב עדכון…' : 'Add an update…') : (he ? 'דבר עם התהליך…' : 'Talk to this process…')}
        onSubmit={handleSend}
        onPressVoice={handleSend}
        // Empty green button → start an in-process voice call with ONE.
        onStartCall={startUnitCall}
        // Call mode: the dock becomes speaker / mute / camera + a red hang-up.
        callMode={inCall}
        onEndCall={endUnitCall}
        callControls={
          <>
            <Pressable
              onPress={() => { haptic.select(); setSpeakerOn((v) => !v); }}
              style={[styles.callCtrlBtn, { backgroundColor: speakerOn ? colors.text : colors.surface }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: speakerOn }}
              accessibilityLabel="Speaker"
            >
              <View style={{ opacity: speakerOn ? 1 : 0.45 }}>
                <SpeakerIcon size={24} color={speakerOn ? colors.surface : colors.text} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => { haptic.select(); setMuted((v) => !v); }}
              style={[styles.callCtrlBtn, { backgroundColor: muted ? '#EF4444' : colors.surface }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: muted }}
              accessibilityLabel="Mute"
            >
              <View style={{ opacity: muted ? 1 : 0.45 }}>
                {muted ? <MicOffIcon size={24} color="#FFFFFF" /> : <MicIcon size={24} color={colors.text} />}
              </View>
            </Pressable>
            <Pressable
              onPress={() => { haptic.select(); setCameraOn((v) => !v); }}
              style={[styles.callCtrlBtn, { backgroundColor: cameraOn ? colors.text : colors.surface }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: cameraOn }}
              accessibilityLabel="Camera"
            >
              <View style={{ opacity: cameraOn ? 1 : 0.45 }}>
                <CameraIcon size={24} color={cameraOn ? colors.surface : colors.text} />
              </View>
            </Pressable>
          </>
        }
        // The + opens the quick-actions panel — rendered INLINE, over the card
        // (no second Modal), so it lands on top of the process instead of
        // closing it. Drop the keyboard first so the panel reads cleanly.
        onPressPlus={() => {
          Keyboard.dismiss();
          setQuickOpen(true);
        }}
        // Pop the keyboard when the sheet opens straight into chat.
        focusSignal={chatFocusSignal}
        // Lift the dock off the near-white sheet — hairline ring + a
        // stronger shadow so the input reads as a distinct, reachable bar.
        bordered
        elevated
        // Always the compact chat shape (+ lifted out into its own pill,
        // tighter capsule) in BOTH profile and chat mode — the floating
        // dock should read as the same component as the home chat input,
        // not a different fuller box.
        compact
        textInputProps={{
          onFocus: () => {
            if (mode === 'profile') setMode('chat');
          },
        }}
      />
    </Animated.View>
  );

  // Call presence — ONE's orb (with a live green ring) shown at the top of the
  // sheet whenever a call is active, so "the figure is always there during a
  // call". Non-interactive: the process behind stays reachable, and the call
  // controls live in the dock below.
  const callPresenceNode = inCall ? (
    <View pointerEvents="none" style={[styles.callPresence, { bottom: dockBottom + 104 }]}>
      <View style={styles.callOrbWrap}>
        <Orb size={88} noBlink noShadow mouth />
        <Animated.View style={[styles.callRing, callRingStyle]} />
      </View>
      <Text style={[styles.callPresenceText, { color: colors.text }]} numberOfLines={1}>
        {(he ? 'בשיחה · ' : 'On a call · ') + unit.title}
      </Text>
    </View>
  ) : null;

  // ⋮ action menu — localized items, shown by the ActionMenu dropdown below.
  // (menuOpen state is declared with the other hooks at the top — declaring it
  // here would sit AFTER an early return and violate rules-of-hooks.)
  const unitMenuItems: ActionMenuItem[] = unit
    ? (() => {
        const store = useMvpStore.getState();
        const isDone = unit.status === 'completed';
        const confirmDelete = () =>
          Alert.alert(
            he ? 'למחוק את התהליך?' : 'Delete this process?',
            he
              ? 'השיחה, הצעדים והמדדים יימחקו. אי אפשר לשחזר.'
              : 'The conversation, steps and metrics will be removed. This cannot be undone.',
            [
              { text: he ? 'ביטול' : 'Cancel', style: 'cancel' as const },
              {
                text: he ? 'מחק' : 'Delete',
                style: 'destructive' as const,
                onPress: () => {
                  store.removeUnit(unit.id);
                  store.clearUnitChat(unit.id);
                  onClose();
                },
              },
            ],
          );
        return [
          { icon: '🤝', label: he ? 'שתף עם ONE' : 'Share with a ONE', onPress: shareWithOne },
          { icon: '🧹', label: he ? 'נקה שיחה' : 'Wipe conversation', onPress: () => store.clearUnitChat(unit.id) },
          isDone
            ? { icon: '↩️', label: he ? 'פתח מחדש' : 'Reopen process', onPress: () => store.reopenUnit(unit.id, lang) }
            : { icon: '✓', label: he ? 'סמן כהושלם' : 'Mark complete', onPress: () => { store.completeUnit(unit.id, lang); onClose(); } },
          { icon: '🗑️', label: he ? 'מחק תהליך' : 'Delete process', destructive: true, onPress: confirmDelete },
        ];
      })()
    : [];

  return (
    <>
    {/* Snap-driven status-bar clock — always VISIBLE while the sheet is open:
        white over the dark backdrop, flipping to black DURING the close slide
        (see clockDark) so it's black before the card is gone. Mounted after
        Home's StatusBar, so while the sheet is open this one wins. In DARK mode
        the home behind is dark, so the clock is white ALWAYS — never dark-content
        (a black clock there would be invisible AND caused a needless flip). */}
    <StatusBar animated hidden={false} barStyle={clockDark && theme === 'light' ? 'dark-content' : 'light-content'} />
    <BottomSheet
      visible={!!unitId}
      onClose={onClose}
      // Reads as a floating "full card": rounded top corners + a sliver of
      // home background visible at top.
      //   • At the lower snap (65%) — scrolling UP expands to 92%.
      //   • At the higher snap (92%) — scrolling moves the content
      //     FREELY. Pull-down-past-top no longer collapses the sheet;
      //     the user closes via the handle drag or the X button. This
      //     separation was the user's explicit request — long-content
      //     processes (lots of text) need uninterrupted scroll.
      snapPoints={['81%', '93%']}
      // Strong black dim behind the sheet so it reads as a floating card over a
      // fully receded home. DURING A CALL it goes lighter so the live call orb
      // floating on Home above the sheet stays visible — the call "comes with
      // you" into the process instead of vanishing behind a black scrim.
      backdropOpacity={callActive ? 0.45 : 0.82}
      // When we land straight in chat (handoff from the home conversation, or
      // re-opening a process we were just talking to) open FULLY at the high
      // snap — the user is mid-conversation and wants the whole surface, not a
      // half card. Browsing the profile cold still opens at the 72% card.
      //   • openInChatRef → correct on the FIRST render (present at full).
      //   • mode === 'chat' → keeps the "tap the input in profile → expand to
      //     full" behavior once the user is already inside.
      initialSnap={openInChatRef.current || mode === 'chat' || profileFull ? 1 : 0}
      // CONTENT PAN ON. gorhom's BottomSheetScrollView bridge gives the
      // expected mobile-card behavior:
      //   • At the LOW snap → scroll-up gesture inside content drags
      //     the sheet to the HIGH snap (no auto-snap; gradual).
      //   • At the HIGH snap → scroll moves content freely, all the way
      //     down through the full process.
      // CONTENT PAN ON — matches the working OneProfileSheet: scroll-up at the
      // low snap gradually expands to the high snap, and at the high snap the
      // scroll view hands scrolling back to the content (free scroll to the end).
      enableContentPan={true}
      // Bypass gorhom's default BottomSheetView wrapper. Wrapping the
      // BottomSheetScrollView in another container breaks gorhom's
      // pan-vs-scroll bookkeeping at the high snap — the wrapper sees
      // the gesture first and snaps the sheet down. Rendering the scroll
      // view directly as gorhom's child fixes the "bounces back" report.
      bypassDefaultView={true}
      animatedIndex={sheetIndex}
      sheetStyle={[styles.sheet]}
      // Floating input + the inline + panel — both pinned to the SCREEN as
      // siblings of the sheet. The input never hangs off-screen at the half card
      // (the vanishing-input bug), and the quick-actions panel opens OVER the
      // card without a second Modal (which iOS would drop) — so it no longer
      // closes the process to show itself.
      overlay={
        <>
          {/* Screen-pinned bottom fade — sits at the sheet's bottom at EVERY
              snap (incl. the half card), BEHIND the floating input dock
              (zIndex 30). In the overlay (not content) so it doesn't hang
              off-screen at the low snap the way a content-anchored bar does. */}
          <EdgeBars top={false} bottomHeight={130} style={{ zIndex: 5 }} />
          {callPresenceNode}
          {inputDockNode}
          <UnitQuickActionsPanel
            visible={quickOpen}
            onClose={() => setQuickOpen(false)}
            onNewProcess={() => {
              setQuickOpen(false);
              onNewProcess?.();
            }}
            onAttachImage={handleAttachImage}
            tools={launcherTools}
            onDeployTool={(kind) => { setQuickOpen(false); deployToolFromLauncher(kind); }}
          />
          <InlinePrompt
            config={promptConfig}
            onClose={() => setPromptConfig(null)}
            colors={colors}
            lang={lang}
          />
          {previewOpen && (() => {
            const policy = disclosureForIdentity(unit.identityId);
            const openFacts = openDisclosureStrings(policy, he);
            const hiddenCount = policy.filter((d) => !!d.value?.trim() && d.tier !== 'open').length;
            const nameFact = policy.find((d) => d.key === 'name' && d.tier === 'open' && !!d.value?.trim());
            return (
              <SharedProcessPreview
                visible
                emoji={unit.emoji}
                title={unit.title}
                status={unitStatusLine(unit, he)}
                providerName={unit.people?.[0]?.name}
                sharedByName={nameFact?.value?.trim()}
                openFacts={openFacts}
                hiddenCount={hiddenCount}
                draftBody={unit.drafts?.[0]?.body}
                shareCode={unit.shareCode}
                onClose={() => setPreviewOpen(false)}
                colors={colors}
                lang={lang}
              />
            );
          })()}
          {threadOpen && unit.shareCode && (
            <SharedThreadOverlay
              visible
              code={unit.shareCode}
              role={unit.sharedRole ?? 'one'}
              myName={
                unit.sharedAs
                ?? disclosureForIdentity(unit.identityId).find((d) => d.key === 'name' && d.tier === 'open' && !!d.value?.trim())?.value?.trim()
                ?? unitIdentity?.name
                ?? 'ONE'
              }
              providerName={unit.people?.[0]?.name}
              onClose={() => setThreadOpen(false)}
              colors={colors}
              lang={lang}
            />
          )}
        </>
      }
    >
      {/* No wrapping View. The scroll view (ProfileView / ChatView) must be a
          DIRECT child of gorhom for its scroll-pan bridge to work — exactly like
          the working OneProfileSheet. A `<View flex1>` wrapper here defeated
          `bypassDefaultView` and broke the scroll (couldn't scroll-to-expand at
          the low snap NOR scroll the content at the high snap). EdgeBars + the
          sticky header are absolute overlays, so they're safe as siblings. */}
      {/* Soft top fade on the card — content scrolls UNDER it. The BOTTOM bar
          is NOT here (it would anchor to gorhom's max-snap content and hang
          off-screen at the low snap); it's rendered screen-pinned in the
          overlay above so it shows at every snap. */}
      <EdgeBars bottom={false} topHeight={112} topLinear />
        {/* Sticky header — three slots: ⋮ menu (left), compact emoji+title
            (fades in as content scrolls past), X close (right). All three
            float over the scroll content. */}
        <View pointerEvents="box-none" style={styles.stickyHeader}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={[styles.stickyBtn, { backgroundColor: colors.surface }]}
            accessibilityLabel={he ? 'עוד אפשרויות' : 'More options'}
            hitSlop={14}
          >
            <MenuIcon size={22} color={colors.text} />
          </Pressable>

          {/* Centre slot — the process's emoji + title.
              • profile mode: fades in only once the big title scrolls off the
                top (scroll-gated), not tappable.
              • chat mode: ALWAYS shown (the chat has no big title of its own),
                and tappable to return to the profile. */}
          {mode === 'chat' ? (
            <Pressable
              onPress={backToProfile}
              style={styles.stickyTitleSlot}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${unit.title} — back to profile`}
            >
              <Text style={styles.compactTitleEmoji}>{unit.emoji}</Text>
              <Text
                style={[styles.compactTitleText, { color: colors.text }]}
                numberOfLines={1}
              >
                {unit.title}
              </Text>
            </Pressable>
          ) : (
            <Animated.View
              style={[styles.stickyTitleSlot, compactTitleStyle]}
              pointerEvents="none"
            >
              <Text style={styles.compactTitleEmoji}>{unit.emoji}</Text>
              <Text
                style={[styles.compactTitleText, { color: colors.text }]}
                numberOfLines={1}
              >
                {unit.title}
              </Text>
            </Animated.View>
          )}

          <Pressable
            onPress={onClose}
            style={[styles.stickyBtn, { backgroundColor: colors.surface }]}
            accessibilityLabel="Close"
            hitSlop={14}
          >
            <CloseIcon size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Mode content — the scroll view is a DIRECT child of gorhom (its
            scroll bridge needs that, like OneProfileSheet). The double-tap Tap
            gesture is attached INSIDE, wrapping the scroll view (a host
            component); a discrete Tap coexists with scrolling and doesn't add a
            layout wrapper, so the bridge stays intact. */}
        {mode === 'profile' ? (
          <ProfileView
            unit={unit}
            colors={colors}
            lang={lang}
            identityName={unitIdentity?.name ?? null}
            showIdentityChevron={identities.length > 1}
            onOpenIdentitySwitch={onOpenIdentitySwitch}
            onScroll={handleProfileScroll}
            onShareWithOne={shareWithOne}
            onComposeDraft={composeDraft}
            onPreview={() => setPreviewOpen(true)}
            onOpenThread={() => setThreadOpen(true)}
            isDrafting={isDrafting}
            doubleTap={doubleTap}
            onTapQuickAction={(label) => {
              // Provider side: confirming an incoming booking request resolves it
              // for real (Status → Confirmed, step done), then the client's ONE
              // acknowledges back — mirrors the web business console.
              const status = unit.metrics?.find((m) => /status/i.test(m.label))?.value ?? '';
              if (/confirm/i.test(label) && /pending/i.test(status)) {
                const when = unit.metrics?.find((m) => /request|when/i.test(m.label))?.value ?? 'the time';
                const who = unit.relationLabel ?? 'the client';
                const store = useMvpStore.getState();
                store.updateUnit(unit.id, {
                  metrics: unit.metrics?.map((m) =>
                    /status/i.test(m.label) ? { ...m, value: 'Confirmed' } : m,
                  ),
                  nextSteps: unit.nextSteps?.map((s) =>
                    /confirm/i.test(s.title) ? { ...s, done: true } : s,
                  ),
                  progress: unit.progress
                    ? { ...unit.progress, current: Math.min(unit.progress.current + 1, unit.progress.total) }
                    : unit.progress,
                  latestBroadcastText: [`Confirmed ${when} with ${who}.`, undefined] as [string, string?],
                  lastUpdatedAt: new Date().toISOString(),
                });
                store.pushUnitNotification({
                  unitId: unit.id,
                  text: `You confirmed ${when}.`,
                  emoji: unit.emoji,
                  kind: 'update',
                });
                setTimeout(() => {
                  useMvpStore.getState().pushUnitNotification({
                    unitId: unit.id,
                    text: `${who}'s ONE confirmed back — see you ${when}.`,
                    emoji: unit.emoji,
                    kind: 'event',
                  });
                }, 2200);
                return;
              }
              // Default: switch to chat mode and pre-fill the input with a
              // ONE-shaped prompt. The user can tweak before sending.
              setMode('chat');
              setText(label);
            }}
          />
        ) : (
          <ChatView
            unit={unit}
            colors={colors}
            messages={messages}
            isTyping={isTyping}
            chatRef={chatRef}
            bottomInset={keyboardHeight}
            suggestions={chatSuggestions}
            onSuggestion={(s) => submit(s)}
            doubleTap={doubleTap}
          />
        )}

        {/* ⋮ dropdown — floats over the sheet, anchored under the button. */}
        <ActionMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={unitMenuItems} top={58} />
    </BottomSheet>
    </>
  );
}

/* ───────────────────────── Profile view ───────────────────────── */

function ProfileView({
  unit,
  colors,
  lang,
  identityName,
  showIdentityChevron,
  onOpenIdentitySwitch,
  onTapQuickAction,
  onScroll,
  onShareWithOne,
  onComposeDraft,
  onPreview,
  onOpenThread,
  isDrafting,
  doubleTap,
}: {
  unit: Unit;
  colors: ThemeColors;
  lang: 'en' | 'he';
  identityName: string | null;
  showIdentityChevron: boolean;
  onOpenIdentitySwitch?: () => void;
  onTapQuickAction?: (label: string) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onShareWithOne?: () => void;
  onComposeDraft?: () => void;
  onPreview?: () => void;
  onOpenThread?: () => void;
  isDrafting?: boolean;
  doubleTap: ReturnType<typeof Gesture.Tap>;
}) {
  const accent = unit.color ?? (unit.tagIds[0] && TAG_COLORS[unit.tagIds[0]]) ?? '#10B981';
  const he = lang === 'he';

  // Finish-line recognition: when the user checks off the LAST open step, ONE
  // notices the process has reached reality and offers to close it out — the
  // intent→reality payoff, surfaced at the exact moment it happens.
  const offerCompletion = () => {
    Alert.alert(
      he ? '🎉 סיימת הכול' : '🎉 You finished everything',
      he
        ? `כל הצעדים ב"${unit.title}" הושלמו. לסמן את התהליך כהושלם?`
        : `Every step in "${unit.title}" is done. Mark the process complete?`,
      [
        { text: he ? 'עוד לא' : 'Not yet', style: 'cancel' },
        {
          text: he ? 'סמן כהושלם ✓' : 'Mark complete ✓',
          onPress: () => useMvpStore.getState().completeUnit(unit.id, lang),
        },
      ],
    );
  };

  // Snooze a reminder forward — "not now, bring it back later". Offers the
  // three quick choices (later today / tomorrow / next week); ONE reschedules
  // in place and drops a small "I'll bring this back" note.
  const promptSnooze = (r: UnitReminder) => {
    Alert.alert(
      he ? 'דחיית תזכורת' : 'Snooze reminder',
      r.text,
      [
        ...SNOOZE_OPTIONS.map((o) => ({
          text: snoozeOptionLabel(o, lang),
          onPress: () => {
            const { dueAt, dueLabel } = snoozeTarget(o, Date.now(), lang);
            useMvpStore.getState().snoozeReminder(unit.id, r.id, dueAt, dueLabel, lang);
          },
        })),
        { text: he ? 'ביטול' : 'Cancel', style: 'cancel' as const },
      ],
    );
  };


  // The one-line broadcast RUNS like Home's — but only from THIS unit's own
  // voice: its latest two-line text plus every line in its broadcast queue,
  // de-duped. With more than one line we rotate every few seconds, fading on
  // each swap, so the process feels like it's quietly talking to you.
  const lines = useMemo(() => {
    const he = lang === 'he';
    const steps = unit.nextSteps ?? [];
    const openSteps = steps.filter((s) => !s.done);
    const doneCount = steps.length - openSteps.length;
    // Tailored, useful lines ONE surfaces here — so the process "talks" with
    // tips, status and updates instead of getting stuck on one default line.
    const tips: string[] = [];
    // 1) Unseen updates lead — "there's something here you didn't see".
    const unread = unit.unreadUpdates ?? 0;
    if (unread > 0) {
      tips.push(
        he
          ? unread === 1
            ? 'יש כאן עדכון חדש — כדאי להסתכל.'
            : `יש כאן ${unread} עדכונים חדשים — כדאי להסתכל.`
          : `${unread} new update${unread > 1 ? 's' : ''} here — worth a look.`,
      );
    }
    // 2) The concrete next step, to nudge action.
    if (openSteps[0]?.title) {
      tips.push(he ? `הצעד הבא: ${openSteps[0].title}` : `Next up: ${openSteps[0].title}`);
    }
    // 3) Progress snapshot.
    if (steps.length > 0) {
      tips.push(
        he ? `${doneCount} מתוך ${steps.length} צעדים הושלמו.` : `${doneCount}/${steps.length} steps done.`,
      );
    }
    // 4) A key number from the metrics.
    const m = unit.metrics?.[0];
    if (m) {
      tips.push(`${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`);
    }

    // Drop the generic seed prompt from the rotation — the same rule the Home
    // cards use — so a fresh process leads with real tips, not a default line.
    const raw: string[] = [
      ...tips,
      ...unit.latestBroadcastText.filter((s): s is string => !!s && !isSeedBroadcast(s)),
      ...(unit.broadcast ?? []).map((b) => b.text).filter((tx) => !isSeedBroadcast(tx)),
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of raw) {
      const tx = (l ?? '').trim();
      if (tx && !seen.has(tx)) {
        seen.add(tx);
        out.push(tx);
      }
    }
    return out.length ? out : [unitStatusLine(unit, lang === 'he') ?? ''];
  }, [unit, lang]);

  // Unified activity feed — Decisions, Timeline and History used to be three
  // separate logs of "what happened in this process". We fold them into one
  // chronological stream so the profile reads as a single story: decisions keep
  // a badge + their rationale, auto-logged timeline entries keep their kind
  // colour, and plain history lines fall in by date.
  const activity = useMemo(() => {
    type Entry = { id: string; title: string; subtitle?: string; iso: string; ts: number; color: string; badge?: string };
    const out: Entry[] = [];
    for (const d of unit.decisions ?? []) {
      out.push({ id: `dec_${d.id}`, title: d.text, subtitle: d.rationale, iso: d.createdAt, ts: Date.parse(d.createdAt) || 0, color: accent, badge: he ? 'החלטה' : 'Decision' });
    }
    for (const t of unit.timeline ?? []) {
      const meta = t.kind ? activityKindMeta(t.kind, lang) : null;
      out.push({ id: `tl_${t.id}`, title: t.title, subtitle: t.subtitle, iso: t.date, ts: Date.parse(t.date) || 0, color: meta?.color ?? accent });
    }
    for (const h of unit.history ?? []) {
      out.push({ id: `hs_${h.id}`, title: h.title, subtitle: h.description, iso: h.createdAt, ts: Date.parse(h.createdAt) || 0, color: colors.textSecondary });
    }
    // Newest first — a glance shows the latest move.
    return out.sort((a, b) => b.ts - a.ts);
  }, [unit.decisions, unit.timeline, unit.history, he, lang, accent, colors.textSecondary]);

  const [lineIdx, setLineIdx] = useState(0);
  const lineOpacity = useSharedValue(1);
  const lineStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value }));

  // Reset to the freshest line whenever the process changes.
  useEffect(() => {
    setLineIdx(0);
  }, [unit.id]);

  // Advance on a calm cadence — only when there's more than one line to show.
  useEffect(() => {
    if (lines.length <= 1) return;
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % lines.length);
    }, 4200);
    return () => clearInterval(id);
  }, [lines.length]);

  // Fade the line in on every swap (mirrors Home's broadcast crossfade).
  useEffect(() => {
    lineOpacity.value = 0;
    lineOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [lineIdx, lineOpacity]);

  // All metrics. Up to 3 lay out as an even row; more than that become a
  // horizontally-scrollable strip so ONE can surface as many numbers as the
  // process needs without truncating to three.
  const allMetrics: UnitMetric[] = unit.metrics ?? [];
  const metricsScrollable = allMetrics.length > 3;

  return (
    // Double-tap toggles to chat. GestureDetector wraps the scroll view directly
    // (a host component) — a discrete Tap coexists with the scroll and adds no
    // layout view, so gorhom's scroll bridge is unaffected.
    <GestureDetector gesture={doubleTap}>
    {/* gorhom's BottomSheetScrollView — at the LOW snap, scroll-up gradually
        drags the sheet to the HIGH snap. At the HIGH snap the gesture system
        hands scrolling back to this view and content scrolls FREELY to the end. */}
    <BottomSheetScrollView
      style={styles.flex1}
      contentContainerStyle={styles.profileContent}
      showsVerticalScrollIndicator={false}
      // Plain-JS scroll callback (gorhom routes it through runOnJS, and owns
      // scrollEventThrottle internally) — drives the compact sticky title once
      // the big title scrolls off the top.
      onScroll={onScroll}
    >
      {/* The kebab + X are now rendered as a sticky overlay above the
          ScrollView. Leave breathing room here so the content doesn't sit
          underneath them. */}
      <View style={styles.stickyHeaderSpacer} />

      {/* Centered emoji + title */}
      <View style={styles.titleBlock}>
        <Text style={styles.titleRow}>
          <Text style={styles.titleEmoji}>{unit.emoji}  </Text>
          <Text style={[styles.titleText, { color: colors.text }]}>{unit.title}</Text>
        </Text>
      </View>

      {/* Completed badge — from intent to reality. */}
      {unit.status === 'completed' && (
        <View style={styles.completedBadgeWrap}>
          <View style={[styles.completedBadge, { backgroundColor: '#10B981' }]}>
            <Text style={styles.completedBadgeText}>✓ Completed</Text>
          </View>
        </View>
      )}

      {/* One-line process line under the title — rotates through THIS unit's
          own broadcast lines, aligned to the writing direction. (The proactive
          "ONE's read" card was removed — the Next Steps list below is the place
          to act on steps.) */}
      <Animated.Text
        style={[styles.processBroadcast, { color: colors.text }, rtlText(lang), lineStyle]}
      >
        {lines[lineIdx % lines.length]}
      </Animated.Text>

      {/* JOINED process (you're the provider): the conversation IS the point —
          lead with it, since the owner's steps/drafts aren't yours to fill. */}
      {unit.sharedRole === 'human' && !!unit.shareCode && (
        <Pressable
          onPress={() => { haptic.tap(); onOpenThread?.(); }}
          style={({ pressed }) => [styles.joinedConvo, { backgroundColor: colors.text, opacity: pressed ? 0.85 : 1 }, rtlRow(lang)]}
          accessibilityRole="button"
        >
          <Text style={styles.joinedConvoEmoji}>💬</Text>
          <View style={styles.flex1}>
            <Text style={[styles.joinedConvoTitle, { color: colors.background }, rtlText(lang)]}>
              {he ? 'פתח שיחה משותפת' : 'Open shared conversation'}
            </Text>
            <Text style={[styles.joinedConvoSub, { color: colors.background }, rtlText(lang)]} numberOfLines={1}>
              {he ? `עם ${unit.people?.[0]?.name ?? 'הצד השני'}` : `With ${unit.people?.[0]?.name ?? 'the other side'}`}
            </Text>
          </View>
          <Text style={[styles.joinedConvoChev, { color: colors.background }]}>{he ? '‹' : '›'}</Text>
        </Pressable>
      )}

      {/* Metrics — up to 3 as an even row; more scroll sideways. */}
      {allMetrics.length > 0 &&
        (metricsScrollable ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.metricsScrollWrap}
            contentContainerStyle={styles.metricsScrollContent}
          >
            {allMetrics.map((m) => (
              <MetricCell key={m.id} metric={m} colors={colors} wide />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.metricsGrid}>
            {allMetrics.map((m) => (
              <MetricCell key={m.id} metric={m} colors={colors} />
            ))}
          </View>
        ))}

      {/* Quick actions — up to 4 capsules. Tapping one drops a ready-
          to-edit prompt into the chat ("Log my weight as ___") so ONE
          captures the data conversationally instead of via a form. */}
      {unit.quickActions && unit.quickActions.length > 0 && (
        <View style={styles.quickActionsRow}>
          {unit.quickActions.slice(0, 4).map((qa) => (
            <QuickActionPill
              key={qa.id}
              action={qa}
              colors={colors}
              onPress={() => onTapQuickAction?.(qa.label)}
            />
          ))}
        </View>
      )}

      {/* Next Steps — vertical list, tap to toggle done */}
      {unit.nextSteps && unit.nextSteps.length > 0 && (
        <Section title="Next Steps" colors={colors}>
          {unit.nextSteps.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                // Checking a step OFF→done feels like progress (success);
                // un-checking is a lighter tap.
                haptic[s.done ? 'tap' : 'success']();
                const updated = (unit.nextSteps ?? []).map((x) =>
                  x.id === s.id ? { ...x, done: !x.done } : x,
                );
                useMvpStore
                  .getState()
                  .updateUnit(unit.id, { nextSteps: updated, updatedAt: new Date().toISOString() });
                // Did this toggle just complete the final open step?
                const wasIncomplete = (unit.nextSteps ?? []).some((x) => !x.done);
                const allDoneNow = updated.length > 0 && updated.every((x) => x.done);
                if (wasIncomplete && allDoneNow && unit.status !== 'completed') {
                  offerCompletion();
                }
              }}
              style={({ pressed }) => [styles.stepRow, rtlRow(lang), { opacity: pressed ? 0.65 : 1 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!s.done }}
              accessibilityLabel={s.title}
            >
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: s.done ? accent : 'transparent',
                    borderColor: s.done ? accent : colors.border,
                  },
                ]}
              >
                {s.done && <Text style={styles.stepCheck}>✓</Text>}
              </View>
              <View style={styles.flex1}>
                <Text
                  style={[
                    styles.stepText,
                    {
                      color: colors.text,
                      textDecorationLine: s.done ? 'line-through' : 'none',
                      opacity: s.done ? 0.55 : 1,
                    },
                    rtlText(lang),
                  ]}
                >
                  {s.title}
                </Text>
                {!!s.subtitle && (
                  <Text style={[styles.stepSubtitle, { color: colors.textSecondary }, rtlText(lang)]}>
                    {s.subtitle}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </Section>
      )}

      {/* Drafts — ONE's outward artifacts: the ACTUAL next message to send.
          The intent → reality bridge. Always shows the compose affordance so
          "let ONE write it" is one tap away, with any drafts listed above. */}
      <Section title="Drafts" colors={colors}>
        {(unit.drafts ?? []).map((d) => (
          <DraftCard
            key={d.id}
            draft={d}
            unitId={unit.id}
            colors={colors}
            lang={lang}
            accent={accent}
          />
        ))}
        <Pressable
          onPress={onComposeDraft}
          disabled={isDrafting}
          style={({ pressed }) => [
            styles.composeBtn,
            { borderColor: colors.border, opacity: pressed || isDrafting ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.composeBtnText, { color: colors.text }, rtlText(lang)]}>
            {isDrafting
              ? he
                ? 'ONE מנסח…'
                : 'ONE is drafting…'
              : he
                ? '✍️  בקש מ-ONE לנסח הודעה'
                : '✍️  Ask ONE to draft a message'}
          </Text>
        </Pressable>
      </Section>

      {/* Reminders — things ONE holds in front of you. ONE writes here on
          intent.kind === 'add_reminder'. Tap to mark done. */}
      {unit.reminders && unit.reminders.length > 0 && (
        <Section title="Reminders" colors={colors}>
          {[...unit.reminders].reverse().map((r) => (
            <View key={r.id} style={[styles.reminderRow, rtlRow(lang)]}>
              <Pressable
                onPress={() => {
                  const updated = (unit.reminders ?? []).map((x) =>
                    x.id === r.id ? { ...x, done: !x.done } : x,
                  );
                  useMvpStore
                    .getState()
                    .updateUnit(unit.id, { reminders: updated, updatedAt: new Date().toISOString() });
                }}
                style={({ pressed }) => [styles.stepRow, styles.flex1, rtlRow(lang), { opacity: pressed ? 0.65 : 1 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!r.done }}
                accessibilityLabel={r.text}
              >
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: r.done ? accent : 'transparent',
                      borderColor: r.done ? accent : colors.border,
                    },
                  ]}
                >
                  {r.done && <Text style={styles.stepCheck}>✓</Text>}
                </View>
                <View style={styles.flex1}>
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color: colors.text,
                        textDecorationLine: r.done ? 'line-through' : 'none',
                        opacity: r.done ? 0.55 : 1,
                      },
                      rtlText(lang),
                    ]}
                  >
                    {r.text}
                  </Text>
                  {!!r.dueLabel && (
                    <Text style={[styles.stepSubtitle, { color: accent }, rtlText(lang)]}>
                      ⏰ {r.dueLabel}
                    </Text>
                  )}
                </View>
              </Pressable>
              {/* Snooze — only for open reminders. "Not now, bring it back later." */}
              {!r.done && (
                <Pressable
                  onPress={() => promptSnooze(r)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.snoozePill,
                    { borderColor: colors.border, opacity: pressed ? 0.55 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={he ? 'דחה תזכורת' : 'Snooze reminder'}
                >
                  <Text style={[styles.snoozePillText, { color: colors.textSecondary }]}>
                    {he ? 'דחה' : 'Snooze'}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* People & sharing — always shown so "Share with a ONE" is reachable.
          When the process is shared, the collaborators appear here too. */}
      <Section title={unit.visibility === 'shared' ? 'People · Shared' : 'People'} colors={colors}>
        <View style={styles.peopleRow}>
          {(unit.people ?? []).map((p: UnitPerson) => (
            <View
              key={p.id}
              style={[
                styles.personChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.personText, { color: colors.text }]}>{p.name}</Text>
              {!!p.role && (
                <Text style={[styles.personRole, { color: colors.textSecondary }]}>
                  {p.role}
                </Text>
              )}
            </View>
          ))}
          {unit.sharedRole !== 'human' && (
          <Pressable
            onPress={onShareWithOne}
            style={({ pressed }) => [
              styles.sharePill,
              { borderColor: accent, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Share with a ONE"
          >
            <Text style={[styles.sharePillText, { color: accent }]}>+ Share with a ONE 🤝</Text>
          </Pressable>
          )}
        </View>
      </Section>

      {/* Insights — optional ONE-generated summary */}
      {unit.insights && unit.insights.length > 0 && (
        <Section title="Insights" colors={colors}>
          {unit.insights.map((i) => (
            <Text
              key={i.id}
              style={[styles.body, { color: colors.text, marginBottom: 4 }]}
            >
              • {i.text}
            </Text>
          ))}
        </Section>
      )}

      {/* Activity — one chronological stream that folds together what used to be
          three separate logs (Decisions, Timeline, History). Decisions carry a
          badge + their rationale; auto-logged entries keep their kind colour.
          A single empty state stands in until the process starts moving. */}
      <Section title="Activity" colors={colors}>
        {activity.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'פעילות תופיע כאן ככל שהתהליך מתקדם.'
              : 'Activity will appear here as the process moves forward.'}
          </Text>
        ) : (
          activity.map((a) => {
            const when = relativeWhen(a.iso, Date.now(), lang);
            const sub = [a.subtitle, when].filter(Boolean).join(' · ');
            return (
              <View key={a.id} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: a.color }]} />
                <View style={styles.flex1}>
                  <View style={[styles.activityTitleRow, rtlRow(lang)]}>
                    {!!a.badge && (
                      <Text style={[styles.activityBadge, { color: accent, borderColor: accent }]}>
                        {a.badge}
                      </Text>
                    )}
                    <Text style={[styles.body, { color: colors.text, flex: 1 }, rtlText(lang)]}>
                      {a.title}
                    </Text>
                  </View>
                  {!!sub && (
                    <Text style={[styles.stepSubtitle, { color: colors.textSecondary }, rtlText(lang)]}>
                      {sub}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </Section>

      {/* Assets — only when the process actually has files attached. */}
      {unit.assets && unit.assets.length > 0 && (
        <Section title="Assets" colors={colors}>
          {unit.assets.map((a) => (
            <View
              key={a.id}
              style={[styles.assetRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.assetIcon, { color: colors.text }]}>{iconForAssetType(a.type)}</Text>
              <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{a.title}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Settings (in-process). Visibility is editable — it decides how far ONE
          may take this process: private to you, shared with the people you
          added, or public to anyone with the link. Tap the pill to cycle. */}
      <Section title="Process Settings" colors={colors}>
        <View style={[styles.settingsRow, rtlRow(lang)]}>
          <Text style={[styles.body, { color: colors.text }, rtlText(lang)]}>{he ? 'שם' : 'Name'}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }, rtlText(lang)]}>{unit.title}</Text>
        </View>
        {(() => {
          const vis = unit.visibility ?? 'private';
          const visMeta: Record<string, { label: string; hint: string; color: string }> = {
            private: { label: he ? 'פרטי' : 'Private', hint: he ? 'רק אתה רואה את התהליך.' : 'Only you can see this process.', color: colors.textSecondary },
            shared: { label: he ? 'משותף' : 'Shared', hint: he ? 'משותף עם מי שצירפת.' : 'Shared with people you added.', color: '#F59E0B' },
            public: { label: he ? 'ציבורי' : 'Public', hint: he ? 'גלוי לכל מי שיש לו קישור.' : 'Visible to anyone with the link.', color: '#10B981' },
          };
          const meta = visMeta[vis];
          const cycle = () => {
            haptic.select();
            const order = ['private', 'shared', 'public'] as const;
            const next = order[(order.indexOf(vis as typeof order[number]) + 1) % order.length];
            useMvpStore.getState().updateUnit(unit.id, { visibility: next });
          };
          return (
            <>
              <View style={[styles.settingsRow, rtlRow(lang)]}>
                <Text style={[styles.body, { color: colors.text }, rtlText(lang)]}>{he ? 'נראות' : 'Visibility'}</Text>
                <Pressable
                  onPress={cycle}
                  style={[styles.visPill, { borderColor: meta.color }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${he ? 'נראות' : 'Visibility'}: ${meta.label}`}
                >
                  <View style={[styles.visDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.visPillText, { color: meta.color }]}>{meta.label}</Text>
                </Pressable>
              </View>
              <Text style={[styles.settingsHint, { color: colors.textSecondary }, rtlText(lang)]}>{meta.hint}</Text>
              {vis !== 'private' && unit.sharedRole !== 'human' && (
                <Pressable
                  onPress={() => { haptic.tap(); onPreview?.(); }}
                  style={({ pressed }) => [styles.previewRow, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }, rtlRow(lang)]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.previewRowText, { color: colors.text }, rtlText(lang)]}>
                    {he ? '👁 מה שהצד השני רואה' : '👁 What the other side sees'}
                  </Text>
                  <Text style={[styles.previewRowChev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
                </Pressable>
              )}
              {!!unit.shareCode && (
                <Pressable
                  onPress={() => { haptic.tap(); onOpenThread?.(); }}
                  style={({ pressed }) => [styles.previewRow, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }, rtlRow(lang)]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.previewRowText, { color: colors.text }, rtlText(lang)]}>
                    {he ? '💬 שיחה משותפת' : '💬 Shared conversation'}
                  </Text>
                  <Text style={[styles.previewRowChev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
                </Pressable>
              )}
            </>
          );
        })()}
        <View style={[styles.settingsRow, rtlRow(lang)]}>
          <Text style={[styles.body, { color: colors.text }, rtlText(lang)]}>{he ? 'זהות' : 'Identity'}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }, rtlText(lang)]}>{unit.identityId.replace('identity_', '')}</Text>
        </View>
      </Section>
    </BottomSheetScrollView>
    </GestureDetector>
  );
}

/* ───────────────────── Inline + quick-actions panel ───────────────────── */

/**
 * The + panel for the process sheet. Rendered in the sheet's OVERLAY slot so it
 * slides up OVER the card (a sibling of gorhom, NOT a second Modal — which iOS
 * would drop). Tools are v0 stubs; "New process" hands back to the host, which
 * closes the sheet and opens CreateProcess.
 */
function UnitQuickActionsPanel({
  visible,
  onClose,
  onNewProcess,
  onAttachImage,
  tools = [],
  onDeployTool,
}: {
  visible: boolean;
  onClose: () => void;
  onNewProcess: () => void;
  onAttachImage: (uri: string) => void;
  tools?: Array<{ kind: ToolKind; emoji: string; label: string }>;
  onDeployTool?: (kind: ToolKind) => void;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const insetsBottom = insets.bottom;
  const he = lang === 'he';
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(visible ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [visible, sv]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: sv.value * 0.55 }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateY: (1 - sv.value) * 340 }],
  }));

  const stub = (label: string) =>
    Alert.alert(label, he ? 'עוד רגע — היכולת הזו בדרך.' : 'Coming soon.');

  // Pick a photo (library) or shoot one (camera) and hand its URI back so the
  // user can answer the process with a FILE, not only text/voice.
  const pickImage = async (source: 'photo' | 'camera') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          he ? 'צריך הרשאה' : 'Permission needed',
          he ? 'כדי לצרף קובץ צריך לאשר גישה.' : 'Please allow access to attach a file.',
        );
        return;
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
      const uri = !res.canceled ? res.assets?.[0]?.uri : undefined;
      if (uri) {
        onClose();
        onAttachImage(uri);
      }
    } catch {
      Alert.alert(he ? 'משהו השתבש' : 'Something went wrong');
    }
  };

  const tiles: Array<{ id: string; emoji: string; label: string; onPress: () => void }> = [
    { id: 'photo', emoji: '🖼', label: he ? 'תמונה' : 'Photo', onPress: () => pickImage('photo') },
    { id: 'camera', emoji: '📷', label: he ? 'מצלמה' : 'Camera', onPress: () => pickImage('camera') },
    { id: 'document', emoji: '📄', label: he ? 'מסמך' : 'Document', onPress: () => pickImage('photo') },
    { id: 'voice', emoji: '🎙', label: he ? 'הקלטה' : 'Voice', onPress: () => stub(he ? 'הקלטה' : 'Voice') },
    { id: 'scan', emoji: '🔎', label: he ? 'סריקה' : 'Scan', onPress: () => pickImage('camera') },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap anywhere outside the panel to close. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel={he ? 'סגור' : 'Close'}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}
          pointerEvents="none"
        />
      </Pressable>

      <Animated.View
        style={[
          styles.qaPanel,
          { backgroundColor: colors.background, paddingBottom: Math.max(insetsBottom, 16) + 8 },
          panelStyle,
        ]}
      >
        <View style={[styles.qaHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.qaTitle, { color: colors.textSecondary }, rtlText(lang)]}>
          {he ? 'פעולות מהירות' : 'Quick actions'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.qaTilesRow}
        >
          {tiles.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={tile.onPress}
              style={({ pressed }) => [
                styles.qaTile,
                { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
            >
              <Text style={styles.qaTileEmoji}>{tile.emoji}</Text>
              <Text style={[styles.qaTileLabel, { color: colors.text }]} numberOfLines={1}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {tools.length > 0 && onDeployTool && (
          <>
            <Text style={[styles.qaTitle, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? 'כלים של ONE' : "ONE’s tools"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.qaTilesRow}
            >
              {tools.map((t) => (
                <Pressable
                  key={t.kind}
                  onPress={() => onDeployTool(t.kind)}
                  style={({ pressed }) => [
                    styles.qaTile,
                    { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t.label}
                >
                  <Text style={styles.qaTileEmoji}>{t.emoji}</Text>
                  <Text style={[styles.qaTileLabel, { color: colors.text }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        <Pressable
          onPress={onNewProcess}
          style={({ pressed }) => [
            styles.qaAction,
            { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'תהליך חדש' : 'New process'}
        >
          <Text style={styles.qaActionEmoji}>✨</Text>
          <Text style={[styles.qaActionLabel, { color: colors.text }, rtlText(lang)]}>
            {he ? 'תהליך חדש' : 'New process'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function iconForAssetType(t: string): string {
  switch (t) {
    case 'file': return '📄';
    case 'image': return '🖼️';
    case 'link': return '🔗';
    case 'note': return '📝';
    case 'document': return '📑';
    default: return '📎';
  }
}

function MetricCell({
  metric,
  colors,
  wide,
}: {
  metric: UnitMetric;
  colors: ThemeColors;
  wide?: boolean;
}) {
  return (
    <View style={[styles.metricCell, wide && styles.metricCellWide]}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
        {metric.label.toUpperCase()}
      </Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>
        {metric.value}
        {metric.unit ? ` ${metric.unit}` : ''}
      </Text>
    </View>
  );
}

function QuickActionPill({
  action,
  colors,
  onPress,
}: {
  action: UnitQuickAction;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionPill,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/* ───────────────────────── Chat view ───────────────────────── */

function ChatView({
  unit,
  colors,
  messages,
  isTyping,
  chatRef,
  bottomInset,
  suggestions,
  onSuggestion,
  doubleTap,
}: {
  unit: Unit;
  colors: ThemeColors;
  messages: ChatMessage[];
  isTyping: boolean;
  chatRef: React.RefObject<ScrollView | null>;
  /** Keyboard height — added to the scroll content's bottom padding so the
   *  last message stays above the keyboard. */
  bottomInset: number;
  /** Contextual, state-aware conversation starters. */
  suggestions: string[];
  /** Tap a starter → send it straight through the chat pipeline. */
  onSuggestion: (text: string) => void;
  /** Double-tap the messages area → back to profile. */
  doubleTap: ReturnType<typeof Gesture.Tap>;
}) {
  const lang = useLanguage();
  const he = lang === 'he';
  // Starters guide a fresh conversation, then step aside once it's under way.
  const showSuggestions = suggestions.length > 0 && messages.length < 3;
  return (
    <>
      {/* The unit's emoji + title now live in the sticky header bar above —
          always visible AND tappable to return to the profile — so the chat has
          no header of its own; just a spacer that clears that floating bar. */}
      <View style={styles.stickyHeaderSpacer} />

      {/* Contextual conversation starters — a horizontal row of tappable chips
          ONE offers based on where the process actually stands. Tapping one
          sends it as a turn. Shown while the conversation is still nascent. */}
      {showSuggestions && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chatSuggestScroll}
          contentContainerStyle={[styles.chatSuggestRow, he && styles.chatSuggestRowRtl]}
        >
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => onSuggestion(s)}
              style={({ pressed }) => [
                styles.chatSuggestChip,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={s}
            >
              <Text
                style={[styles.chatSuggestText, { color: colors.text }]}
                numberOfLines={1}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <GestureDetector gesture={doubleTap}>
      <ScrollView
        ref={chatRef}
        style={styles.flex1}
        contentContainerStyle={[
          styles.chatContent,
          // Lift the last message above the keyboard when it's open.
          bottomInset > 0 && { paddingBottom: 132 + bottomInset },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {messages.length === 0 && !isTyping ? (
          <Text style={[styles.empty, { color: colors.textSecondary, padding: 24 }, rtlText(lang)]}>
            {he ? 'נתחיל לדבר…' : 'Start the conversation…'}
          </Text>
        ) : (
          <>
            {messages.map((m) => {
              // A TOOL widget ONE deployed in this process (e.g. a quiz) — the
              // same interactive card as the Home chat, here inside the process.
              if (m.widget?.kind === 'quiz') {
                return (
                  <View key={m.id} style={styles.unitWidgetWrap}>
                    <ChatQuizCard runId={m.widget.runId} />
                  </View>
                );
              }
              if (m.widget?.kind === 'booking') {
                return (
                  <View key={m.id} style={styles.unitWidgetWrap}>
                    <ChatBookingCard runId={m.widget.runId} />
                  </View>
                );
              }
              if (m.widget?.kind === 'form') {
                return (
                  <View key={m.id} style={styles.unitWidgetWrap}>
                    <ChatFormCard runId={m.widget.runId} />
                  </View>
                );
              }
              // ONE messages render FLAT — no bubble, no background —
              // matching the home chat redesign. Selectable so the user
              // can copy fragments. User messages keep their bubble so
              // the back-and-forth still reads as a dialogue.
              if (m.from === 'one') {
                return (
                  <Text
                    key={m.id}
                    selectable
                    // Hebrew → right-aligned, English → left.
                    style={[styles.chatOneFlat, { color: colors.text }, rtlText(lang)]}
                  >
                    {m.text}
                  </Text>
                );
              }
              return (
                // Wrap in an explicit LTR row (like the working Home chat) so
                // justify-flex-end DETERMINISTICALLY lands the user bubble on the
                // visual RIGHT — regardless of the device's RTL engine state,
                // which was flipping a bare alignSelf:'flex-end' to the left.
                <View key={m.id} style={styles.userBubbleRow}>
                  <View
                    style={[styles.bubble, styles.userBubble, { backgroundColor: colors.circle }]}
                  >
                    {m.imageUri ? (
                      <Image
                        source={{ uri: m.imageUri }}
                        style={[styles.bubbleImage, m.text ? { marginBottom: 6 } : null]}
                        resizeMode="cover"
                      />
                    ) : null}
                    {m.text ? (
                      <Text
                        selectable
                        style={[styles.bubbleText, { color: colors.circleEye }, rtlText(lang)]}
                      >
                        {m.text}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {isTyping && <TypingIndicator />}
          </>
        )}
      </ScrollView>
      </GestureDetector>
    </>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

// Hebrew labels for the process-content section titles. The Section component
// translates by exact English key, so call sites can keep passing the English
// label and still render right in Hebrew.
const SECTION_TITLE_HE: Record<string, string> = {
  'Next Steps': 'צעדים הבאים',
  Drafts: 'טיוטות',
  Reminders: 'תזכורות',
  People: 'אנשים',
  'People · Shared': 'אנשים · משותף',
  Insights: 'תובנות',
  Activity: 'פעילות',
  Assets: 'קבצים',
  'Process Settings': 'הגדרות תהליך',
};

function DraftCard({
  draft,
  unitId,
  colors,
  lang,
  accent,
}: {
  draft: UnitDraft;
  unitId: string;
  colors: ThemeColors;
  lang: 'en' | 'he';
  accent: string;
}) {
  const he = lang === 'he';
  const meta = DRAFT_CHANNEL_META[draft.channel] ?? DRAFT_CHANNEL_META.note;
  const sent = draft.status === 'sent';
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const updateDraft = useMvpStore((s) => s.updateDraft);
  const markDraftSent = useMvpStore((s) => s.markDraftSent);
  const removeDraft = useMvpStore((s) => s.removeDraft);

  // Selective disclosure AT THE MOMENT ONE ACTS — the keystone that makes ONE a
  // permissioned representative, not an impersonator. 'open' fields are always
  // included; 'ask' fields are opt-in per outreach; 'private' never shows.
  // Per-space: the disclosure policy of the SPACE this process belongs to.
  const disclosure = useMvpStore((s) => {
    const u = s.units.find((x) => x.id === unitId);
    return (u && s.disclosure[u.identityId]) || DEFAULT_DISCLOSURE;
  });
  // Memories carry the same tier scale (see the unified "What ONE knows about
  // you" section). An 'open' memory is offered here too, an 'ask' memory is
  // opt-in, a 'private' one (the default) never surfaces — so by default no
  // memory leaks into an outward message.
  const memories = useMvpStore((s) => s.memories);
  const sharedIds = draft.sharedFields ?? [];
  const openShare = disclosure.filter((d) => d.tier === 'open' && d.value && d.value.trim());
  const askShare = disclosure.filter((d) => d.tier === 'ask' && d.value && d.value.trim());
  const openMemShare = memories.filter((m) => m.tier === 'open' && m.text.trim());
  const askMemShare = memories.filter((m) => m.tier === 'ask' && m.text.trim());
  const hasPrivate =
    disclosure.some((d) => d.tier === 'private' && d.value && d.value.trim()) ||
    memories.some((m) => (m.tier ?? 'private') === 'private' && m.text.trim());
  const showDisclosure =
    openShare.length > 0 || askShare.length > 0 || openMemShare.length > 0 || askMemShare.length > 0;
  const toggleShare = (id: string) => {
    haptic.select();
    const next = sharedIds.includes(id) ? sharedIds.filter((x) => x !== id) : [...sharedIds, id];
    updateDraft(unitId, draft.id, { sharedFields: next });
  };
  const memChipLabel = (text: string) => (text.trim().length > 22 ? `${text.trim().slice(0, 22)}…` : text.trim());

  // The ACTUAL permissioned payload: the message body + the facts ONE is allowed
  // to attach — every 'open' fact (field or memory) plus the 'ask' ones the user
  // toggled on. 'private' never leaves. This is what makes the "ONE shares:"
  // strip real: sending / copying carries exactly these facts, nothing more.
  const sharedFacts = [...openShare, ...askShare.filter((d) => sharedIds.includes(d.id))];
  const sharedMems = [...openMemShare, ...askMemShare.filter((m) => sharedIds.includes(m.id))];
  const anythingShared = sharedFacts.length > 0 || sharedMems.length > 0;
  const buildOutgoing = (): string => {
    const base = draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body;
    if (!anythingShared) return base;
    const header = he ? 'פרטים שוואן מצרף בשמך:' : 'Details ONE is sharing on your behalf:';
    const lines = [
      ...sharedFacts.map((d) => `• ${disclosureLabel(d, he)}: ${d.value}`),
      ...sharedMems.map((m) => `• ${m.text.trim()}`),
    ].join('\n');
    return `${base}\n\n—\n${header}\n${lines}`;
  };

  // Keep the edit buffer in sync when the draft changes upstream (not editing).
  useEffect(() => {
    if (!editing) setBody(draft.body);
  }, [draft.body, editing]);

  const saveEdit = () => {
    haptic.select();
    updateDraft(unitId, draft.id, { body: body.trim() || draft.body });
    setEditing(false);
    Keyboard.dismiss();
  };
  const copy = async () => {
    haptic.select();
    await Clipboard.setStringAsync(buildOutgoing());
    Alert.alert(
      he ? 'הועתק' : 'Copied',
      anythingShared
        ? he ? 'ההודעה + הפרטים שאישרת הועתקו ללוח.' : 'Message + the details you approved were copied.'
        : he ? 'ההודעה הועתקה ללוח.' : 'Message copied to clipboard.',
    );
  };
  const send = async () => {
    haptic.tap();
    try {
      const res = await Share.share({ message: buildOutgoing() });
      if (res.action === Share.sharedAction) markDraftSent(unitId, draft.id, lang);
    } catch {
      /* user dismissed the share sheet */
    }
  };
  const discard = () => {
    Alert.alert(he ? 'למחוק טיוטה?' : 'Discard draft?', undefined, [
      { text: he ? 'ביטול' : 'Cancel', style: 'cancel' },
      {
        text: he ? 'מחק' : 'Discard',
        style: 'destructive',
        onPress: () => removeDraft(unitId, draft.id),
      },
    ]);
  };

  return (
    <View
      style={[
        styles.draftCard,
        { backgroundColor: colors.surface, borderColor: sent ? colors.border : accent },
      ]}
    >
      <View style={[styles.draftHead, rtlRow(lang)]}>
        <View style={[styles.draftChannelTag, { backgroundColor: colors.background }]}>
          <Text style={styles.draftChannelEmoji}>{meta.emoji}</Text>
          <Text style={[styles.draftChannelText, { color: colors.textSecondary }]} numberOfLines={1}>
            {he ? meta.he : meta.en}
            {draft.to ? ` · ${draft.to}` : ''}
          </Text>
        </View>
        <View style={styles.flex1} />
        {sent ? (
          <Text style={[styles.draftSentTag, { color: accent }]}>{he ? '✓ נשלח' : '✓ Sent'}</Text>
        ) : (
          <Pressable onPress={discard} hitSlop={12}>
            <Text style={[styles.draftDiscard, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          autoFocus
          style={[styles.draftBodyInput, { color: colors.text, borderColor: colors.border }, rtlText(lang)]}
        />
      ) : (
        <Text selectable style={[styles.draftBody, { color: colors.text }, rtlText(lang)]}>
          {draft.body}
        </Text>
      )}

      {showDisclosure && (
        <View style={[styles.discStrip, { borderTopColor: colors.border }]}>
          <Text style={[styles.discStripLabel, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'וואן משתף:' : 'ONE shares:'}
          </Text>
          <View style={[styles.discStripChips, rtlRow(lang)]}>
            {openShare.map((d) => (
              <View
                key={d.id}
                style={[styles.discStripChip, { borderColor: '#10B981', backgroundColor: colors.background }]}
              >
                <View style={[styles.discStripDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.discStripChipText, { color: '#10B981' }]}>{disclosureLabel(d, he)}</Text>
              </View>
            ))}
            {askShare.map((d) => {
              const on = sharedIds.includes(d.id);
              const color = on ? '#10B981' : '#F59E0B';
              return (
                <Pressable
                  key={d.id}
                  onPress={sent ? undefined : () => toggleShare(d.id)}
                  disabled={sent}
                  style={[styles.discStripChip, { borderColor: color, backgroundColor: colors.background, opacity: sent && !on ? 0.5 : 1 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={disclosureLabel(d, he)}
                >
                  <View style={[styles.discStripDot, { backgroundColor: color }]} />
                  <Text style={[styles.discStripChipText, { color }]}>
                    {disclosureLabel(d, he)}{on ? '' : ' +'}
                  </Text>
                </Pressable>
              );
            })}
            {openMemShare.map((m) => (
              <View
                key={m.id}
                style={[styles.discStripChip, { borderColor: '#10B981', backgroundColor: colors.background }]}
              >
                <View style={[styles.discStripDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.discStripChipText, { color: '#10B981' }]}>{memChipLabel(m.text)}</Text>
              </View>
            ))}
            {askMemShare.map((m) => {
              const on = sharedIds.includes(m.id);
              const color = on ? '#10B981' : '#F59E0B';
              return (
                <Pressable
                  key={m.id}
                  onPress={sent ? undefined : () => toggleShare(m.id)}
                  disabled={sent}
                  style={[styles.discStripChip, { borderColor: color, backgroundColor: colors.background, opacity: sent && !on ? 0.5 : 1 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={memChipLabel(m.text)}
                >
                  <View style={[styles.discStripDot, { backgroundColor: color }]} />
                  <Text style={[styles.discStripChipText, { color }]}>
                    {memChipLabel(m.text)}{on ? '' : ' +'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {hasPrivate && (
            <Text style={[styles.discStripNote, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? 'פרטים פרטיים נשמרים אצלך.' : 'Private details stay with you.'}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.draftActions, rtlRow(lang)]}>
        {editing ? (
          <Pressable onPress={saveEdit} style={[styles.draftAction, { backgroundColor: accent }]}>
            <Text style={[styles.draftActionText, { color: colors.background }]}>
              {he ? 'שמור' : 'Save'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            style={[styles.draftAction, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
          >
            <Text style={[styles.draftActionText, { color: colors.text }]}>{he ? 'ערוך' : 'Edit'}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={copy}
          style={[styles.draftAction, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
        >
          <Text style={[styles.draftActionText, { color: colors.text }]}>{he ? 'העתק' : 'Copy'}</Text>
        </Pressable>
        <Pressable onPress={send} style={[styles.draftAction, { backgroundColor: colors.text }]}>
          <Text style={[styles.draftActionText, { color: colors.background }]}>
            {sent ? (he ? 'שלח שוב' : 'Send again') : he ? 'שלח' : 'Send'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  const lang = useLanguage();
  const he = lang === 'he';
  const label = he ? SECTION_TITLE_HE[title] ?? title : title;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }, rtlText(lang)]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: {},

  // Profile
  profileContent: {
    paddingHorizontal: 24,
    // Clearance for the floating InputBar dock (screen-pinned at the bottom) so
    // the LAST section (Process Settings) scrolls fully clear of the dock + home
    // indicator. The REAL scroll fix was structural — the scroll view is now a
    // DIRECT child of gorhom (no wrapping View), matching the working
    // OneProfileSheet, so the scroll-pan bridge works.
    paddingBottom: 150,
    gap: 22,
  },
  /**
   * Floating dock that pins the InputBar to the sheet's bottom edge,
   * above the scroll content (`zIndex: 10`). The scroll view scrolls
   * BEHIND it; `profileContent.paddingBottom` reserves matching space so
   * the last item is reachable.
   */
  inputDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Topmost layer inside the sheet — above the sticky header (20) and all
    // scroll content, so the input is ALWAYS reachable and never covered.
    zIndex: 30,
  },
  // Inline + quick-actions panel (over the card, no Modal).
  qaPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: 14,
    zIndex: 40,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  qaHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
    marginBottom: 8,
  },
  qaTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  qaTilesRow: { gap: 12, paddingVertical: 4, paddingRight: 8 },
  qaTile: {
    width: 92,
    height: 92,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qaTileEmoji: { fontSize: 28 },
  qaTileLabel: { fontSize: 13, fontWeight: '600' },
  qaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  qaActionEmoji: { fontSize: 20 },
  qaActionLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  /** Sticky header — sits over the scrollable content. White, shadowed pills. */
  stickyHeader: {
    position: 'absolute',
    top: 12,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  /** Centre slot between the ⋮ and X — holds the compact sticky title that
   *  fades in as the big title scrolls away. Flexes to fill the gap so the
   *  two buttons stay pinned to the edges. */
  stickyTitleSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  compactTitleEmoji: { fontSize: 16 },
  compactTitleText: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 190,
  },
  stickyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    // backgroundColor is set inline so it tracks the theme surface.
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  stickyBtnPlaceholder: {
    width: 44,
    height: 44,
  },
  stickyHeaderSpacer: {
    // Clears the floating ⋮ / X buttons (top:12 + 44 tall = 56) plus a gap,
    // so the big centred title always lands BELOW the header row instead of
    // colliding with the buttons.
    height: 68,
  },
  /** Sheet hero: bigger Orb above the title, identity row tappable below it. */
  sheetHero: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sheetIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sheetIdentityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 8,
  },
  titleRow: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  titleEmoji: { fontSize: 26 },
  titleText: { fontSize: 26, fontWeight: '600' },
  completedBadgeWrap: { alignItems: 'center', marginTop: 10 },
  completedBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  completedBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  processBroadcast: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: -4,
    paddingHorizontal: 8,
  },

  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  // Horizontal metrics strip (>3 metrics). Cells get a fixed width and the
  // row scrolls sideways.
  metricsScrollWrap: {
    paddingVertical: 12,
  },
  metricsScrollContent: {
    paddingHorizontal: 4,
    gap: 18,
  },
  metricCellWide: {
    flex: undefined,
    width: 92,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '600',
  },

  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickActionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  sectionTitleRtl: { textAlign: 'right', writingDirection: 'rtl' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },
  body: { fontSize: 14, lineHeight: 20 },
  empty: { fontSize: 13 },

  // ── Drafts (ONE's outward artifacts) ──────────────────────────────────────
  composeBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  composeBtnText: { fontSize: 15, fontWeight: '600' },
  draftCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  draftHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftChannelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    maxWidth: '82%',
  },
  draftChannelEmoji: { fontSize: 13 },
  draftChannelText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  draftSentTag: { fontSize: 12, fontWeight: '700' },
  draftDiscard: { fontSize: 15, fontWeight: '600', paddingHorizontal: 4 },
  draftBody: { fontSize: 14, lineHeight: 21 },
  draftBodyInput: {
    fontSize: 14,
    lineHeight: 21,
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
  },
  // Selective-disclosure strip inside a draft card — what ONE will share.
  discStrip: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 7 },
  discStripLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  discStripChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  discStripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  discStripDot: { width: 6, height: 6, borderRadius: 3 },
  discStripChipText: { fontSize: 12, fontWeight: '600' },
  discStripNote: { fontSize: 11, lineHeight: 15, fontStyle: 'italic' },
  draftActions: { flexDirection: 'row', gap: 8 },
  draftAction: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftActionText: { fontSize: 13, fontWeight: '600' },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepCheck: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 15,
    lineHeight: 20,
  },
  stepSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Reminder row = [toggle (flex)] + [snooze pill]. In Hebrew the row's
  // `direction: rtl` lands the pill on the leading (left) edge.
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  snoozePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  snoozePillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  assetIcon: { fontSize: 18 },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  // Activity row title line — an optional badge (e.g. "Decision") sits before
  // the title; the title flexes to fill and wrap.
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    alignItems: 'center',
  },
  settingsHint: { fontSize: 12, lineHeight: 17, marginTop: -2, marginBottom: 6, opacity: 0.9 },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  visDot: { width: 7, height: 7, borderRadius: 4 },
  visPillText: { fontSize: 12.5, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 2,
  },
  previewRowText: { fontSize: 14, fontWeight: '600' },
  previewRowChev: { fontSize: 18, fontWeight: '700' },
  // Joined-process (provider) conversation banner — the primary action.
  joinedConvo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15, marginTop: 6 },
  joinedConvoEmoji: { fontSize: 22 },
  joinedConvoTitle: { fontSize: 15, fontWeight: '700' },
  joinedConvoSub: { fontSize: 12.5, opacity: 0.72, marginTop: 1 },
  joinedConvoChev: { fontSize: 20, fontWeight: '800' },
  personChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  personText: { fontSize: 13, fontWeight: '500' },
  personRole: { fontSize: 11, marginTop: 2 },
  // "+ Share with a ONE" — dashed-feel accent pill that flows with the chips.
  sharePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sharePillText: { fontSize: 13, fontWeight: '600' },

  // Chat
  // Horizontal starters row — sits just under the sticky header, above the
  // message list. `flexGrow:0` so it never steals the messages' vertical space.
  chatSuggestScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chatSuggestRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  // In Hebrew the row reads right→left, so the first (most relevant) chip sits
  // on the right where the eye starts.
  chatSuggestRowRtl: {
    flexDirection: 'row-reverse',
  },
  chatSuggestChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  chatSuggestText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  chatContent: {
    // Messages anchored to the TOP so they stay visible when the keyboard opens
    // (bottom-anchored, they hid behind it). Newest appends below; long threads
    // scroll.
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    // Bottom clearance for the absolute-positioned InputBar dock (now floating
    // a gap above the sheet bottom) — the newest message sits above the capsule.
    paddingBottom: 132,
    gap: 8,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  oneBubble: { alignSelf: 'flex-start', borderTopLeftRadius: 6 },
  userBubble: { borderTopRightRadius: 6 },
  // Full-width LTR row that pins the user bubble to the visual right (see the
  // render note). direction:'ltr' makes flex-end deterministic on the RTL engine.
  userBubbleRow: { flexDirection: 'row', direction: 'ltr', justifyContent: 'flex-end' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  // Attached photo inside a user bubble.
  bubbleImage: { width: 210, height: 158, borderRadius: 14, backgroundColor: '#00000022' },
  // In-process call: control button in the dock (speaker / mute / camera).
  callCtrlBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  // In-process call: ONE's orb presence, pinned above the call dock.
  callPresence: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 10, zIndex: 8 },
  callOrbWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  callRing: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: '#22C55E',
  },
  callPresenceText: { fontSize: 14, fontWeight: '700' },
  /** Flat ONE reply — no bubble, no background. Same treatment as Home chat. */
  chatOneFlat: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignSelf: 'stretch',
  },
  unitWidgetWrap: { alignSelf: 'stretch', marginVertical: 8 },
});
