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
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
  Alert,
  AppState,
  type KeyboardEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  Extrapolation,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { unitStatusLine, isSeedBroadcast } from '../../utils/unitStatusLine';
import type { Unit, UnitMetric, UnitQuickAction, UnitPerson, UnitReminder, UnitStep } from '../../core/mvp/types';
import { SNOOZE_OPTIONS, snoozeOptionLabel, snoozeTarget } from '../../utils/snooze';
import { TAG_COLORS } from '../../core/mvp/types';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { Orb } from '../../components/mvp/Orb';
import { generateUnitReply } from '../../utils/mvpChatReply';
import { invokeOneIntent } from '../../services/aiChat';
import { unitFromIntent, findSimilarUnit } from '../../utils/intentToUnit';
import { resolveReminderDue } from '../../utils/reminderTime';
import { TypingIndicator } from '../../components/mvp/TypingIndicator';
import { CloseIcon, ArrowDownIcon, MenuIcon } from '../../components/mvp/icons';
import { InputBar } from '../../components/mvp/InputBar';
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
}

interface ChatMessage {
  id: string;
  from: 'one' | 'user';
  text: string;
  /** Wall-clock ms — present because chat messages live in the store now. */
  ts?: number;
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

export function UnitProfileSheet({ unitId, onClose, onOpenIdentitySwitch, onNewProcess, forceChat }: UnitProfileSheetProps) {
  const { colors } = useThemeStore();
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
      // by (keyboard − that gap) to land its bottom edge ON the keyboard top.
      // `Math.max(0, …)` guards a hardware / floating keyboard that reports a
      // height SMALLER than the resting gap — without it the lift would go
      // POSITIVE and shove the dock down off the bottom edge.
      dockLift.value = withTiming(-Math.max(0, h - dockBottom), {
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

  // Compact sticky title — once the big centred title scrolls up under the
  // header, a small "emoji + title" fades into the bar centre, between the ⋮
  // and the X. Driven by a PLAIN JS onScroll callback: gorhom wraps it in
  // runOnJS internally, so (unlike a worklet handler — which broke the scroll
  // bridge before) it composes cleanly with gorhom's own gesture bookkeeping.
  const COMPACT_TITLE_THRESHOLD = 54;
  const compactTitleSV = useSharedValue(0);
  const compactShownRef = useRef(false);
  const setCompactShown = useCallback(
    (shouldShow: boolean) => {
      if (shouldShow === compactShownRef.current) return;
      compactShownRef.current = shouldShow;
      compactTitleSV.value = withTiming(shouldShow ? 1 : 0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    },
    [compactTitleSV],
  );
  const handleProfileScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      setCompactShown(y > COMPACT_TITLE_THRESHOLD);
    },
    [setCompactShown],
  );
  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: compactTitleSV.value,
    transform: [{ translateY: (1 - compactTitleSV.value) * 6 }],
  }));

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
      compactShownRef.current = false;
      compactTitleSV.value = withTiming(0, { duration: 120 });
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
      compactShownRef.current = false;
      compactTitleSV.value = 0;
      // This component never unmounts (unitId just toggles), so a prior
      // chat could leave the dock lifted onto a keyboard that hid without
      // firing keyboardWillHide. Drop it back to rest so the floating input
      // is never stranded off-screen on the next open.
      dockLift.value = 0;
      setKeyboardHeight(0);
      setProfileFull(false);
      return;
    }
    // Fresh open: start the dock at rest. If we land in chat mode the
    // keyboard's own show event will lift it a beat later.
    dockLift.value = 0;
    setKeyboardHeight(0);
    setProfileFull(false);
    // Profile by default; chat for unseen updates / a fresh conversation — OR
    // when the user long-pressed the card (forceChat).
    const openChat = forceChat || computeOpenInChat(unitId);
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

  // Contextual conversation starters for the chat — rebuilt only when the
  // process or language changes (Date.now() is read once per rebuild; the
  // chips don't need to tick every second).
  const chatSuggestions = useMemo(
    () => (unit ? buildChatSuggestions(unit, lang, Date.now()) : []),
    [unit, lang],
  );

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

  if (!unit) return null;

  const handleSend = () => submit(text);
  // Core send — takes the raw text so BOTH the input bar and the tappable
  // suggestion chips can drive a turn through the exact same AI pipeline.
  const submit = (raw: string) => {
    const v = raw.trim();
    if (!v || !unit) return;
    haptic.tap();
    setText('');
    setMessages((m) => [...m, { id: `u${Date.now()}`, from: 'user', text: v }]);
    setIsTyping(true);
    const history = messages.map((m) => ({
      role: m.from === 'one' ? ('assistant' as const) : ('user' as const),
      content: m.text,
    }));
    setTimeout(async () => {
      let reply: string;
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
        }
      } catch (err) {
        console.warn('[UnitProfileSheet] invokeOneIntent failed:', err);
        reply = await generateUnitReply(v, { unit, lang }, history);
      }
      setIsTyping(false);
      setMessages((m) => [
        ...m,
        { id: `o${Date.now()}`, from: 'one', text: reply },
      ]);
    }, TYPING_DELAY_MS);
  };

  // Share this process WITH ANOTHER ONE — add them as a collaborator on the
  // process. No multiplayer backend yet, so the in-app truth is: they land in
  // People, the process flips to "shared", and ONE logs + announces it.
  const shareWithOne = () => {
    if (!unit) return;
    const apply = (raw: string) => {
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
      store.pushUnitNotification({
        unitId: unit.id,
        text: `Shared with ${nm}`,
        emoji: '🤝',
        kind: 'update',
      });
    };
    if (Platform.OS === 'ios') {
      // iOS: prompt for the ONE's name / @handle.
      Alert.prompt(
        'Share with a ONE',
        "Name or @handle of the ONE you want on this process.",
        (input) => apply(input ?? ''),
        'plain-text',
      );
    } else {
      // Android has no Alert.prompt — share with a generic collaborator for now.
      apply('A ONE');
    }
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
        placeholder={mode === 'chat' ? 'Add an update…' : 'Talk to this process…'}
        onSubmit={handleSend}
        onPressVoice={handleSend}
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
      snapPoints={['72%', '92%']}
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
      // Opening a process from the list reads as the card lifting out of a
      // dimmed page — a stronger backdrop than the default so the home behind
      // recedes clearly.
      backdropOpacity={0.55}
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
          {inputDockNode}
          <UnitQuickActionsPanel
            visible={quickOpen}
            onClose={() => setQuickOpen(false)}
            onNewProcess={() => {
              setQuickOpen(false);
              onNewProcess?.();
            }}
          />
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
  doubleTap,
}: {
  unit: Unit;
  colors: ReturnType<typeof useThemeStore>['colors'];
  lang: 'en' | 'he';
  identityName: string | null;
  showIdentityChevron: boolean;
  onOpenIdentitySwitch?: () => void;
  onTapQuickAction?: (label: string) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onShareWithOne?: () => void;
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

      {/* Decisions — durable record of what the user decided. ONE writes
          here whenever intent.kind === 'decision'. Newest at the top so a
          quick glance shows the most recent call without scrolling. */}
      {unit.decisions && unit.decisions.length > 0 && (
        <Section title="Decisions" colors={colors}>
          {[...unit.decisions].reverse().map((d) => (
            <View
              key={d.id}
              style={[
                styles.decisionRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.decisionDot, { backgroundColor: accent }]} />
              <View style={styles.flex1}>
                <Text style={[styles.body, { color: colors.text }]}>{d.text}</Text>
                {!!d.rationale && (
                  <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                    {d.rationale}
                  </Text>
                )}
                <Text
                  style={[styles.decisionTs, { color: colors.textSecondary }]}
                >
                  {formatDecisionDate(d.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* Assets */}
      {unit.assets && unit.assets.length > 0 ? (
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
      ) : (
        <Section title="Assets" colors={colors}>
          <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'אין קבצים עדיין.' : 'No files yet.'}
          </Text>
        </Section>
      )}

      {/* Timeline */}
      {unit.timeline && unit.timeline.length > 0 ? (
        <Section title="Timeline" colors={colors}>
          {unit.timeline.map((t) => {
            const when = relativeWhen(t.date, Date.now(), lang);
            const meta = t.kind ? activityKindMeta(t.kind, lang) : null;
            const sub = [t.subtitle, when].filter(Boolean).join(' · ');
            return (
              <View key={t.id} style={styles.timelineRow}>
                <View
                  style={[styles.timelineDot, { backgroundColor: meta?.color ?? accent }]}
                />
                <View style={styles.flex1}>
                  <Text style={[styles.body, { color: colors.text }]}>{t.title}</Text>
                  {!!sub && (
                    <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                      {sub}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Section>
      ) : (
        <Section title="Timeline" colors={colors}>
          <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'פעילות תופיע כאן ככל שהתהליך מתקדם.'
              : 'Activity will appear here as the process moves forward.'}
          </Text>
        </Section>
      )}

      {/* History */}
      {unit.history && unit.history.length > 0 ? (
        <Section title="History" colors={colors}>
          {unit.history.map((h) => (
            <Text
              key={h.id}
              style={[styles.body, { color: colors.text, marginBottom: 4 }]}
            >
              • {h.title}
            </Text>
          ))}
        </Section>
      ) : (
        <Section title="History" colors={colors}>
          <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'אין היסטוריה עדיין.' : 'No history yet.'}
          </Text>
        </Section>
      )}

      {/* Settings (in-process) */}
      <Section title="Process Settings" colors={colors}>
        <View style={styles.settingsRow}>
          <Text style={[styles.body, { color: colors.text }]}>Name</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{unit.title}</Text>
        </View>
        <View style={styles.settingsRow}>
          <Text style={[styles.body, { color: colors.text }]}>Visibility</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {unit.visibility ?? 'private'}
          </Text>
        </View>
        <View style={styles.settingsRow}>
          <Text style={[styles.body, { color: colors.text }]}>Identity</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{unit.identityId.replace('identity_', '')}</Text>
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
}: {
  visible: boolean;
  onClose: () => void;
  onNewProcess: () => void;
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

  const tiles: Array<{ id: string; emoji: string; label: string }> = [
    { id: 'photo', emoji: '🖼', label: he ? 'תמונה' : 'Photo' },
    { id: 'camera', emoji: '📷', label: he ? 'מצלמה' : 'Camera' },
    { id: 'document', emoji: '📄', label: he ? 'מסמך' : 'Document' },
    { id: 'voice', emoji: '🎙', label: he ? 'הקלטה' : 'Voice' },
    { id: 'scan', emoji: '🔎', label: he ? 'סריקה' : 'Scan' },
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
              onPress={() => stub(tile.label)}
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

/**
 * Decisions show a short relative-when label ("today", "yesterday",
 * "3d ago") instead of a full timestamp. The exact wall-clock time isn't
 * useful — what matters is *recency* relative to other decisions in the
 * list. Falls through to an ISO date for anything older than a week so
 * the column stays scannable.
 */
function formatDecisionDate(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return '';
  const diffMs = Date.now() - created;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function MetricCell({
  metric,
  colors,
  wide,
}: {
  metric: UnitMetric;
  colors: ReturnType<typeof useThemeStore>['colors'];
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
  colors: ReturnType<typeof useThemeStore>['colors'];
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
  colors: ReturnType<typeof useThemeStore>['colors'];
  messages: ChatMessage[];
  isTyping: boolean;
  chatRef: React.RefObject<ScrollView>;
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
                <View
                  key={m.id}
                  style={[
                    styles.bubble,
                    styles.userBubble,
                    // User bubble hugs the reading side: right in Hebrew, left
                    // in English.
                    { alignSelf: he ? 'flex-end' : 'flex-start' },
                    { backgroundColor: colors.circle },
                  ]}
                >
                  <Text
                    selectable
                    style={[styles.bubbleText, { color: colors.circleEye }, rtlText(lang)]}
                  >
                    {m.text}
                  </Text>
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
  Reminders: 'תזכורות',
  People: 'אנשים',
  'People · Shared': 'אנשים · משותף',
  Insights: 'תובנות',
  Decisions: 'החלטות',
  Assets: 'קבצים',
  Timeline: 'ציר זמן',
  History: 'היסטוריה',
  'Process Settings': 'הגדרות תהליך',
};

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
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
  grabberRow: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },

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
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  decisionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  decisionTs: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
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
  // Header sits CENTRED in the top bar, between the ⋮ and X (which float over
  // it). paddingTop lines its content up with those 44px buttons (top:12).
  chatHeader: {
    alignItems: 'center',
    // Keep clear of the edge buttons (⋮ / X) so a long title never collides.
    paddingHorizontal: 64,
    paddingTop: 22,
    paddingBottom: 12,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatHeaderEmoji: { fontSize: 20 },
  chatHeaderTitle: { fontSize: 17, fontWeight: '600', maxWidth: 200 },
  chatHeaderProgress: { fontSize: 13, marginTop: 3 },

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
  userBubble: { alignSelf: 'flex-end', borderTopRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  /** Flat ONE reply — no bubble, no background. Same treatment as Home chat. */
  chatOneFlat: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignSelf: 'stretch',
  },
});
