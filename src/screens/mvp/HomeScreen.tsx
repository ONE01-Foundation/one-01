/**
 * HomeScreen — per ONE_UI_UX_SPEC §6 + §7.
 *
 * Behaves like iOS Lock Screen → Notification Center.
 *
 * One Animated.ScrollView holds the whole surface:
 *     [ hero spacer of HERO_REST_H ]
 *     [ vertical list of UnitCards   ]
 *
 * At rest (scrollY = 0) only the top PEEK_HEIGHT of the first card shows
 * beneath the centered Orb + broadcast.
 *
 * The scroll snaps to [0, SNAP_OPEN]. Pulling up to SNAP_OPEN fades the hero
 * out and fades the top title bar (X + Identity ⌄) in. Past SNAP_OPEN the
 * cards scroll freely so all of them are reachable — that's where the
 * "smooth like Notification Center" feel comes from.
 *
 * The Orb + broadcast are rendered as a positioned overlay over the hero
 * spacer, so they don't move with the scroll — they just fade + scale.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Platform,
  Keyboard,
  Share,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedKeyboard,
  interpolate,
  Extrapolation,
  runOnJS,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

// Pressable wrapped to accept Reanimated styles. Lets the Pressable itself be
// the transformed container so iOS hit-testing happens on the actual touch
// surface (Pressable inside a transformed Animated.View was unreliable).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Orb } from '../../components/mvp/Orb';
import { UnitCard } from '../../components/mvp/UnitCard';
import { InputBar } from '../../components/mvp/InputBar';
import { ArrowDownIcon, PlusThinIcon, StackedCardsIcon, GhostModeIcon, MicIcon, MicOffIcon, CameraIcon, SpeakerIcon } from '../../components/mvp/icons';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { useThemeStore } from '../../stores/themeStore';
import { useT, useLanguage } from '../../i18n/useT';
import { localizedGreeting, translate } from '../../i18n/strings';
import { useActiveIdentity, useActiveUnits, useMvpStore } from '../../stores/mvpStore';
import { ONBOARDING_EXAMPLE_UNITS } from '../../data/mvp/onboardingExamples';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { generateOneReply } from '../../utils/mvpChatReply';
import { haptic } from '../../utils/haptics';
import { desireToUnit } from '../../utils/mvpInferUnit';
import { invokeOneIntent, invokeAttentionLines } from '../../services/aiChat';
import { unitFromIntent, findSimilarUnit, buildProcessOpener } from '../../utils/intentToUnit';
import {
  DIRECTORY,
  findAnyBusiness,
  businessDirectoryReply,
  directoryBookingIntent,
  directoryBookingConfirm,
} from '../../utils/businessDirectory';
import { useBusinessStore } from '../../stores/businessStore';
import { createBooking as cloudCreateBooking } from '../../services/cloudBusiness';
import { resolveReminderDue, isReminderDue, formatDueRelative } from '../../utils/reminderTime';
import type { Unit, UnitReminder } from '../../core/mvp/types';
import { searchMemory, looksLikeMemoryQuery } from '../../utils/memoryRetrieval';
import { createSpeechRecognizer, type SpeechRecognizer } from '../../utils/speech';
import { TypingIndicator } from '../../components/mvp/TypingIndicator';
import {
  buildBroadcastLoop,
  broadcastDwellMs,
  HOME_BROADCAST_CLOSING_LINE,
  HOME_BROADCAST_INTERVAL_MS,
  HOME_BROADCAST_CLOSING_HOLD_MS,
} from '../../data/mvp/broadcasts';
import { timeAwareLines, timeBucket, timeGreeting } from '../../data/mvp/oneClock';
import { enrichUnitFromArchetype } from '../../data/mvp/unitArchetype';

const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;

// Visual footprint of the bottom dock — capsule (72) + outer padding (10+4).
// The dock is now flush to the safe-area bottom (bottom:0), so no extra
// offset to account for. Used to inset the cards list and the messages
// overlay so nothing tucks under the input bar.
const INPUT_BAR_H = 86;

/**
 * Home scroll behaviour:
 *
 *   Rest (scrollY = 0):
 *     Orb + broadcast centered. NO cards visible — the spacer fills the screen.
 *
 *   Pull up:
 *     Cards appear stacked over each other (deeply overlapped near the bottom)
 *     and SPREAD apart as the user scrolls further. The top card moves the
 *     most — it travels from the bottom of the stack up to its natural place
 *     at the top of the list. By the time we reach SNAP_OPEN, cards are in
 *     their natural vertical-list positions and the top title bar (Orb over
 *     identity name) is fully visible.
 *
 *   Past SNAP_OPEN:
 *     Free scroll through the list, like a normal feed.
 *
 * Cards are real scroll content (not absolutely positioned) so free-scroll
 * past the snap point Just Works.
 */
const TITLE_BAR_H = 78;              // small Orb + identity below it
const HERO_REST_H = SCREEN_H;        // hero spacer fills the screen at rest
const SNAP_OPEN = SCREEN_H - TITLE_BAR_H - 50;  // pull this far for full open
/** Resting agent face on Home. Splash dot uses the same value so the
 *  hand-off is seamless (splash dot grows to this size and lands here).
 *  Pulled in one notch (88 → 84) per latest design — slightly smaller orb
 *  reads cleaner against the broadcast text. */
const HOME_ORB_SIZE = 84;
/** Vertical position of the resting hero. Sits ABOVE screen center so the
 *  broadcast text reads in the upper third — leaves room for the input dock
 *  and feels less crowded against the bottom bar. */
const HERO_CENTER_TOP = Math.round(SCREEN_H * 0.26);

/** Home → Global transition. Pulling DOWN past the top (negative overscroll)
 *  scrubs this 0→1: ONE slides back to screen-centre, CLOSES its eyes (so only
 *  the bare dot is left) and the broadcast/identity text fades out — a visible
 *  "ONE folds into a dot and dives into the world" hand-off into ONE01 Global.
 *  GLOBAL_PULL_RANGE is the overscroll distance (px) for a full 0→1 sweep;
 *  GLOBAL_OPEN_THRESHOLD (released-at offset) is where Global actually opens. */
const GLOBAL_PULL_RANGE = 88;
const GLOBAL_OPEN_THRESHOLD = 48;
/** How far the orb travels DOWN to re-centre during the pull. Lands its centre
 *  near mid-screen (0.46·H reads better than dead-centre against the bottom). */
const PULL_CENTER_DELTA = Math.max(
  60,
  Math.round(SCREEN_H * 0.46 - (HERO_CENTER_TOP + HOME_ORB_SIZE / 2)),
);

// Call-orb floating-bubble geometry. The call face sits in the SAME spot as
// the resting Home agent (its centre matches), just a touch larger — and the
// user can fling it to any screen corner (WhatsApp-style PiP).
const CALL_ORB_SIZE = 104;          // a little bigger than the Home orb (84)
// paddingTop that lines the call orb's CENTRE up with the Home orb's centre.
// The draggable wrap is (CALL_ORB_SIZE + 20) tall (room for the ring), so the
// orb centre sits half that below paddingTop.
const CALL_ORB_TOP =
  HERO_CENTER_TOP + HOME_ORB_SIZE / 2 - (CALL_ORB_SIZE + 20) / 2;
const CALL_ORB_EDGE_MARGIN = 18;    // gap from the screen edge at a corner
// When the user scrolls into the processes list DURING a call, the orb glides
// UP toward the top (re-centred + smaller) so it never sits over the cards.
// This is how far up it travels from its resting centre.
const CALL_TOP_DELTA = -(CALL_ORB_TOP - 14);

/** Per-card geometry used by the stacked-deck animation. */
const CARD_H_EST = 180;
const CARD_GAP = 12;
/** When stacked, each card sticks out by this much above the one below it. */
const STACKED_PEEK = 14;

/**
 * Onboarding broadcast loop. Opens like Google's homepage — a calm
 * time-of-day greeting + an invitation, framed so anyone can start
 * using ONE without an account first. The "Sign in" CTA under the
 * input bar handles the eventual hand-off.
 */
function onboardingLines(lang: 'en' | 'he'): readonly string[] {
  const greeting = localizedGreeting(lang);
  if (lang === 'he') {
    return [
      greeting,
      'אני ONE — איך אפשר לעזור?',
      'ספר לי על משהו שאתה רוצה לקדם.',
      'אפשר לנסות גם בלי חשבון.',
      'אזכור רק את מה שתבקש.',
      'מה הדבר שהיית רוצה לקדם?',
    ];
  }
  return [
    greeting,
    "I'm ONE — what can I help with?",
    'Tell me something you want to move forward.',
    'You can try without an account.',
    "I'll only remember what you ask me to.",
    'What do you want to move forward?',
  ];
}

interface HomeScreenProps {
  onTapUnit: (unitId: string) => void;
  /** Long-press (hold) a process card → open it straight into CHAT with the
   *  keyboard up. */
  onLongPressUnit?: (unitId: string) => void;
  onTapHeader?: () => void;
  onTapOrb?: () => void;
  onLongPressOrb?: () => void;
  /** Tap on the "+" icon in the input capsule opens "New Process". */
  onCreateProcess?: () => void;
  /** Tap the "Sign in" CTA shown under the input bar when not signed in. */
  onSignIn?: () => void;
  /**
   * Fires when ONE creates a new process FROM the home chat (intent.kind
   * === 'create_process'). The host closes the chat overlay and opens the
   * new unit's profile so the conversation continues inside the process,
   * matching the user's "process owns the next turn" mental model.
   */
  onCreatedFromChat?: (unitId: string) => void;
  /** True while the sign-in bottom sheet is open. Home lifts the Orb +
   *  broadcast (like keyboard-open) and overrides the broadcast text to
   *  "Welcome back." so the page reads as the sign-in surface. */
  signInOpen?: boolean;
  /** True while the ONE profile sheet is open. The home orb COLLAPSES away
   *  (shrinks + fades) so the face reads as moving INTO the profile, which
   *  grows its own orb in from zero. A clean cross-fade hand-off. */
  profileOpen?: boolean;
  /** True while the Quick Actions (+) sheet is open. When it closes and the
   *  user had opened it FROM an active chat with the keyboard up, we bring the
   *  keyboard back so they land straight back in typing. */
  quickActionsOpen?: boolean;
  /** True while a process (unit) sheet is open over Home. When it opens we drop
   *  the Home chat keyboard so the sheet presents cleanly; when it closes we
   *  bring the keyboard back if the user was mid-chat. */
  unitOpen?: boolean;
  /** True while ANY overlay sheet is open over Home (unit / profile / settings /
   *  global / quick-actions / sign-in / …). ONE never dozes off while a sheet is
   *  up — the doze countdown only runs on a truly bare Home. */
  anySheetOpen?: boolean;
  /** Live animated index of the ONE profile sheet (-1 closed … 1 full).
   *  Drives the home orb's collapse/return IN SYNC with the sheet slide —
   *  so dragging the sheet down brings the orb back in real time, not on a
   *  fixed timer. Falls back to `profileOpen` when not provided. */
  profileSheetIndex?: SharedValue<number>;
  /** Open ONE01 Global — the world of processes (official ONEs, public
   *  processes, templates, insights, signals). Entry pill at the top. */
  onOpenGlobal?: () => void;
  /** Open a business's ONE profile sheet (from a chat "open <business>"). */
  onOpenBusiness?: (id: string) => void;
}

/**
 * Cycle through the broadcast loop. The closing line ("What matters most…")
 * holds longer than the others. The loop is derived from the active identity's
 * units, so switching identity changes which messages cycle.
 */

/**
 * StackedCard — wraps UnitCard and animates its translateY based on scrollY
 * so cards collapse into a tight deck at low scroll and SPREAD apart as the
 * user pulls up.
 *
 * Layout intuition (cards are real flex children, `index = 0` at the top):
 *   - In their natural positions they sit one below the other, separated by
 *     `CARD_GAP`. Top card is highest.
 *   - At rest we translate each card DOWN by `depth * collapseDelta` so the
 *     entire deck collapses onto the bottom card. `depth = total-1-index`,
 *     so the bottom card barely moves and the TOP card moves the most —
 *     matching the user's "the most top one is most spread from them".
 *   - `collapseDelta = CARD_H_EST + CARD_GAP - STACKED_PEEK` so each card
 *     in the deck sticks out by `STACKED_PEEK` above the one below it.
 *   - Opacity also fades down at very low scroll so the deck doesn't sit
 *     visible behind the Orb at rest.
 */
function StackedCard({
  unit,
  index,
  total,
  scrollY,
  onPress,
  onLongPress,
  onDelete,
  onPin,
  onShare,
  swipeDisabled,
}: {
  unit: import('../../core/mvp/types').Unit;
  index: number;
  total: number;
  scrollY: Animated.SharedValue<number>;
  onPress: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onShare?: () => void;
  swipeDisabled?: boolean;
}) {
  const depth = total - 1 - index;
  const collapseDelta = (CARD_H_EST + CARD_GAP - STACKED_PEEK) * depth;

  // Depth-opacity (at rest only): the FRONT card (index 0 — fully visible
  // because it sits on top with the highest zIndex) is opaque. The peeks
  // showing below it fade further with each step deeper into the stack.
  // Previously this was inverted, which made the visible card itself look
  // washed out — fixed per user note "make the topmost clearly visible and
  // fade the bottoms a bit". As the user scrolls and the deck spreads,
  // every card reaches full opacity.
  const depthOpacityRest = Math.max(0.35, 1 - index * 0.15);

  const style = useAnimatedStyle(() => {
    // Cards stay collapsed for the first slice of the pull; then spread as
    // the user keeps pulling toward SNAP_OPEN.
    const spreadStart = SNAP_OPEN * 0.15;
    const spreadEnd = SNAP_OPEN;
    const ty = interpolate(
      scrollY.value,
      [spreadStart, spreadEnd],
      [collapseDelta, 0],
      Extrapolation.CLAMP,
    );
    // Cards hidden at rest, then fade in to their depth-aware opacity at the
    // start of the pull, then strengthen toward full opacity as they spread.
    const emergence = interpolate(
      scrollY.value,
      [0, SNAP_OPEN * 0.18],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const spreadOpacity = interpolate(
      scrollY.value,
      [SNAP_OPEN * 0.4, SNAP_OPEN],
      [depthOpacityRest, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: emergence * spreadOpacity,
      transform: [{ translateY: ty }],
    };
  });

  // Top of the list (index 0) sits ABOVE every card beneath it when the
  // stack is collapsed — the most recent / top process covers the others.
  return (
    <Animated.View style={[{ zIndex: total - index }, style]}>
      <UnitCard
        unit={unit}
        onPress={onPress}
        onLongPress={onLongPress}
        onDelete={onDelete}
        onPin={onPin}
        onShare={onShare}
        swipeDisabled={swipeDisabled}
      />
    </Animated.View>
  );
}

/**
 * Broadcast navigator — auto-cycles AND supports manual prev/next.
 *
 * Tapping the broadcast advances one line. Horizontal swipe goes prev/next.
 * After any manual interaction we hold the current line for a beat
 * (`MANUAL_HOLD_MS`) before the auto-cycle resumes, so the user can read
 * what they just navigated to.
 */
const MANUAL_HOLD_MS = 6000;

/**
 * Broadcast navigator.
 *
 * `autoCycle = true`  (default, home rest state): lines advance on a timer
 *   and on tap/swipe. Manual interaction extends the next-tick by
 *   MANUAL_HOLD_MS so the user has time to read what they just navigated to.
 *
 * `autoCycle = false` (chat state): NO timer. The line only changes when the
 *   user taps or swipes. Each new chat session passes a fresh `seedIndex`
 *   so the opening line rotates — the user doesn't see the same prompt every
 *   time they tap into the input.
 */
function useBroadcastNavigator(
  lines: readonly string[],
  opts: {
    autoCycle?: boolean;
    seedIndex?: number;
    /** Per-line dwell time (ms). When provided, ONE holds each line for its
     *  own duration — reading-time + occasional pause — instead of a fixed
     *  interval, so the loop reads like speech, not a metronome. */
    dwellFor?: (line: string, index: number) => number;
    /** One-and-done: play through the loop once, then park on the final
     *  (closing) line and go quiet. `resume()` — wired to any screen touch —
     *  kicks it back to the top for another round. */
    restAtEnd?: boolean;
  } = {},
) {
  const { autoCycle = true, seedIndex = 0, dwellFor, restAtEnd = false } = opts;
  const [index, setIndex] = useState(() => seedIndex % Math.max(1, lines.length));
  const manualHoldUntil = useRef(0);

  // Reset to a fresh seed whenever the lines themselves swap (e.g. broadcast
  // loop ↔ chat suggestions) so we don't keep an out-of-range index.
  useEffect(() => {
    setIndex(seedIndex % Math.max(1, lines.length));
    manualHoldUntil.current = 0;
  }, [lines, seedIndex]);

  useEffect(() => {
    if (!autoCycle) return;
    const len = Math.max(1, lines.length);
    // One pass, then quiet: park on the final (closing) line and stop the
    // timer. resume() (wired to any screen touch) sends it back to the top.
    if (restAtEnd && index >= len - 1) return;
    const current = lines[index] ?? '';
    const base = dwellFor
      ? dwellFor(current, index)
      : current === HOME_BROADCAST_CLOSING_LINE
        ? HOME_BROADCAST_CLOSING_HOLD_MS
        : HOME_BROADCAST_INTERVAL_MS;
    const now = Date.now();
    const holdRemaining = Math.max(0, manualHoldUntil.current - now);
    const delay = Math.max(base, holdRemaining);
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % len);
    }, delay);
    return () => clearTimeout(t);
  }, [index, lines, autoCycle, dwellFor, restAtEnd]);

  // Resume a rested loop. Only "kicks" when parked on the final line, so a
  // stray touch mid-round never snaps the broadcast back to the top.
  const resume = useCallback(() => {
    setIndex((i) => (i >= Math.max(1, lines.length) - 1 ? 0 : i));
  }, [lines.length]);

  const next = useCallback(() => {
    manualHoldUntil.current = Date.now() + MANUAL_HOLD_MS;
    setIndex((i) => (i + 1) % Math.max(1, lines.length));
  }, [lines.length]);

  const prev = useCallback(() => {
    manualHoldUntil.current = Date.now() + MANUAL_HOLD_MS;
    setIndex((i) => (i - 1 + Math.max(1, lines.length)) % Math.max(1, lines.length));
  }, [lines.length]);

  // Guard: never return an empty string. If the resolved line is empty (e.g.
  // a build mistake left a falsy entry in the loop), fall back to the closing
  // prompt so the broadcast slot always has SOMETHING to render. Stops the
  // hero from collapsing to a blank text box.
  const resolved = lines[index] ?? '';
  const safe = resolved.trim().length > 0 ? resolved : HOME_BROADCAST_CLOSING_LINE;
  return { line: safe, next, prev, resume };
}

interface InlineMessage {
  id: string;
  from: 'one' | 'user';
  text: string;
  /** Wall-clock ms when the message was sent. Stamped at create-time so the
   *  displayed time doesn't shift on re-renders. */
  ts: number;
}

const HOME_CHAT_TYPING_MS = 850;

// While composing the first chat message, an UNanswered prompt quietly
// switches to another after this idle beat. Stable module function so the
// navigator effect doesn't reset its timer on every render.
const CHAT_PROMPT_IDLE_MS = 7000;
function chatPromptDwell(): number {
  return CHAT_PROMPT_IDLE_MS;
}

/** Format a chat timestamp as "14:32" (24h) or "2:32 PM" depending on the
 *  device locale. `toLocaleTimeString` is the standard cross-RTL primitive. */
function formatBubbleTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

export function HomeScreen({
  onTapUnit,
  onLongPressUnit,
  onTapHeader,
  onTapOrb,
  onLongPressOrb,
  onCreateProcess,
  onSignIn,
  onCreatedFromChat,
  signInOpen = false,
  profileOpen = false,
  quickActionsOpen = false,
  unitOpen = false,
  anySheetOpen = false,
  profileSheetIndex,
  onOpenGlobal,
  onOpenBusiness,
}: HomeScreenProps) {
  const { colors, theme } = useThemeStore();
  const t = useT();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const identity = useActiveIdentity();
  const realUnits = useActiveUnits();
  const addUnit = useMvpStore((s) => s.addUnit);
  const removeUnit = useMvpStore((s) => s.removeUnit);
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const identityCount = useMvpStore((s) => s.identities.length);
  const showIdentityChevron = identityCount > 1;

  // First-time users haven't completed onboarding. Their broadcast loop is
  // the "Hi, I'm ONE…" intro that previously lived on WelcomeScreen — the
  // home itself does the introduction now. Returning / signed-in users get
  // the time-aware greeting + identity-driven lines.
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);

  // ── Due reminders ──────────────────────────────────────────────────────
  // A reminder ONE set is only useful if it comes BACK to you when its time
  // arrives. We surface due/overdue reminders across the active identity's
  // processes right on the home, above the input — ONE keeping its promise.
  // A 30s tick keeps it live so a reminder appears the moment it comes due.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const dueReminders = React.useMemo(() => {
    if (!hasOnboarded) return [] as Array<{ unit: Unit; reminder: UnitReminder }>;
    const out: Array<{ unit: Unit; reminder: UnitReminder }> = [];
    for (const u of realUnits) {
      if (u.status === 'completed') continue; // finished — no more nudges
      for (const r of u.reminders ?? []) {
        if (!r.done && isReminderDue(r.dueAt, nowTick)) out.push({ unit: u, reminder: r });
      }
    }
    out.sort((a, b) => Date.parse(a.reminder.dueAt!) - Date.parse(b.reminder.dueAt!));
    return out.slice(0, 3);
  }, [realUnits, nowTick, hasOnboarded]);

  // While onboarding (not signed in), the cards stack shows illustrative
  // USE-CASE cards instead of real processes — "Health & fitness",
  // "Trips & travel", etc. They render through the same UnitCard path so
  // visuals stay consistent. Once the user signs in, this swaps to their
  // actual units.
  const units = hasOnboarded ? realUnits : ONBOARDING_EXAMPLE_UNITS;

  // Display name shown in the identity row below the orb. Before the user
  // has signed in / introduced themselves, default to "ONE" — using the
  // seeded "Ariel" mock name would look like ONE already knows them.
  const displayedIdentityName = hasOnboarded
    ? identity?.name ?? 'Ariel'
    : 'ONE';

  // ── Inline chat on Home ─────────────────────────────────────────────────
  // There is NO separate chat layout any more. The Home layout is the same
  // whether the user is talking to ONE or not. Tapping the input field opens
  // the keyboard in place; that's the only thing that changes. We track:
  //   • inputFocused — TextInput is currently focused
  //   • chatMessages — running list of bubbles for the current conversation
  // and derive `chatActive` from those. When chatActive, the broadcast area
  // cycles through suggestions instead of the ambient broadcast loop, and
  // the message bubbles render above the input bar.
  const [inputFocused, setInputFocused] = useState(false);
  // Holds the chat OPEN across a keyboard dismiss that isn't a real "close" —
  // notably pressing + (which dismisses the keyboard before opening Quick
  // Actions). Without this, the blur drops `inputFocused` and an empty chat
  // (no messages yet) collapses back to the home rest state, losing the
  // typed text and hero position. Reset only on an explicit close (X).
  const [chatHeldOpen, setChatHeldOpen] = useState(false);
  // When the user opens Quick Actions (+) from chat WITH the keyboard up, we
  // remember to bring the keyboard back once they close it. `wantKeyboardBack`
  // captures whether the keyboard was actually open at + press time; bumping
  // `chatReturnFocus` re-focuses the InputBar (see its focusSignal).
  const wantKeyboardBackRef = useRef(false);
  const [chatReturnFocus, setChatReturnFocus] = useState(0);
  // Chat explicitly CLOSED via the X. Closing KEEPS the persisted homeChat
  // (the X used to wipe it) — the history lives on for ONE's memory.
  const [chatDismissed, setChatDismissed] = useState(false);
  // Session boundary: each time the chat OPENS we mark the current homeChat
  // length, and the visible conversation is only the messages AFTER that mark.
  // So opening the chat always starts FRESH (empty), while the prior turns
  // stay in homeChat (for memory + a future scroll-up "timeline of ONE").
  const [sessionStartCount, setSessionStartCount] = useState(
    () => useMvpStore.getState().homeChat.length,
  );
  const [chatText, setChatText] = useState('');
  // Chat history lives in the store now (persisted + synced to Supabase).
  // Reading via selector means every send / clear / hydrate re-renders
  // the chat without local-state duplication.
  const chatMessages = useMvpStore((s) => s.homeChat) as InlineMessage[];
  const appendHomeChat = useMvpStore((s) => s.appendHomeChat);
  const clearHomeChatAction = useMvpStore((s) => s.clearHomeChat);
  const setChatMessages = useCallback(
    (updater: ((m: InlineMessage[]) => InlineMessage[]) | InlineMessage[]) => {
      const cur = useMvpStore.getState().homeChat as InlineMessage[];
      const next = typeof updater === 'function' ? updater(cur) : updater;
      // We always append a single message at a time, so derive the delta
      // and route through appendHomeChat to preserve the 50-cap + store
      // observers (Supabase sync).
      if (next.length > cur.length) {
        for (let i = cur.length; i < next.length; i++) {
          appendHomeChat(next[i]);
        }
      } else if (next.length === 0) {
        clearHomeChatAction();
      } else {
        // Full replacement falls back to clear + re-append.
        clearHomeChatAction();
        for (const m of next) appendHomeChat(m);
      }
    },
    [appendHomeChat, clearHomeChatAction],
  );
  // The CURRENT conversation = messages added since this session opened. The
  // earlier messages remain in homeChat (history) but aren't shown as the
  // active chat, so every open reads as a clean, new conversation.
  const sessionMessages = useMemo(
    () => chatMessages.slice(sessionStartCount),
    [chatMessages, sessionStartCount],
  );
  const [chatTyping, setChatTyping] = useState(false);
  // Status caption shown UNDER the small Orb during a turn — "Thinking…",
  // "Searching memory…", "Updating process…" — replaces the broadcast text
  // once the user has sent a message. null = no caption (resting between
  // turns). Lifecycle is driven by sendChat below.
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // ── Voice: TAP the mic = start a call, HOLD = record ──────────────────
  // Call mode: ONE goes "live" — the orb becomes a draggable in-call bubble
  // with a green dot + running timer, and the input dock turns into call
  // controls (speaker / mute / camera + a red hang-up). It's a working
  // shell for now; the realtime voice transport lands later.
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  // Recording mode: holding the mic records via the device microphone AND
  // (on web) runs the browser speech recognizer to transcribe into the input.
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  // Ghost mode — an "off the record" chat toggle in the chat header.
  const [ghostMode, setGhostMode] = useState(false);
  // Idle-sleep — after a long, untouched rest on Home, ONE "falls asleep"
  // (lids drop). Woken by any touch of the Home surface. Never sleeps while a
  // chat / call / sheet is up.
  const [orbAsleep, setOrbAsleep] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the voice call was started from inside an active chat — if so,
  // ending the call brings the keyboard back so the user lands in the chat.
  const callFromChatRef = useRef(false);
  // Live mirror of `chatActive` (computed later in render) for earlier callbacks.
  const chatActiveRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  // Settled (final) transcript so far this recording — interim text is added
  // on top live, but only the final part is committed between phrases.
  const transcriptRef = useRef('');

  // Tick the recording counter once a second while a recording runs.
  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const startCall = useCallback(() => {
    // Remember if we came from an open chat so we can restore it on hang-up.
    // (chatActive is declared later in render — read it through a ref to avoid
    // a temporal-dead-zone reference here.)
    callFromChatRef.current = chatActiveRef.current;
    Keyboard.dismiss();
    setMuted(false);
    setCameraOn(false);
    setSpeakerOn(true);
    setCallActive(true);
    haptic.press();
  }, []);
  const endCall = useCallback(() => {
    setCallActive(false);
    haptic.press();
    // If the call was placed from within a chat, drop back into it with the
    // keyboard up (bump the InputBar's focusSignal). Calls started from the
    // resting Home leave the keyboard closed, as before.
    if (callFromChatRef.current) {
      setChatDismissed(false);
      setChatReturnFocus((n) => n + 1);
    }
  }, []);

  const startRecording = useCallback(async () => {
    // A firm press the moment the mic goes hot — "you're recording now".
    haptic.press();
    // Browser speech-to-text (web). Streams the spoken words straight into the
    // input field — we do NOT send; the user reviews the text and hits send.
    transcriptRef.current = '';
    const recog = createSpeechRecognizer({
      lang: lang === 'he' ? 'he-IL' : 'en-US',
      onResult: (text, isFinal) => {
        if (isFinal) transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
        const live = `${transcriptRef.current} ${isFinal ? '' : text}`.trim();
        setChatText(live);
      },
    });
    recognizerRef.current = recog;
    recog?.start();

    // Native audio capture (expo-av) — drives the waveform + timer. On web the
    // recognizer already owns the mic, so we skip expo-av there.
    if (Platform.OS !== 'web') {
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (perm.granted) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          const { recording: rec } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY,
          );
          recordingRef.current = rec;
        }
      } catch (e) {
        console.warn('[HomeScreen] recording start failed:', e);
      }
    }
    setRecording(true);
  }, [lang]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    // Stop the recognizer; the transcript stays in the input for review.
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {
        console.warn('[HomeScreen] recording stop failed:', e);
      }
    }
  }, []);

  const chatActive =
    !chatDismissed && (inputFocused || sessionMessages.length > 0 || chatHeldOpen);
  // Keep a live mirror so callbacks defined earlier in render (startCall) can
  // read the current chat state without a temporal-dead-zone reference.
  chatActiveRef.current = chatActive;

  // Each time chat activates from a fresh state, bump a counter so the
  // broadcast navigator picks a new opening suggestion on each entry.
  const [chatSessionIndex, setChatSessionIndex] = useState(0);
  const lastChatActiveRef = useRef(false);
  useEffect(() => {
    if (chatActive && !lastChatActiveRef.current) {
      setChatSessionIndex((n) => n + 1);
      // Chat just opened → start a FRESH conversation: everything currently in
      // homeChat becomes history, and the visible chat begins empty.
      setSessionStartCount(useMvpStore.getState().homeChat.length);
    }
    lastChatActiveRef.current = chatActive;
  }, [chatActive]);

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    // Back to focus-driven chat state — the + "hold open" bridge is no longer
    // needed once the user is actually in the field again.
    setChatHeldOpen(false);
    // Reopening the chat clears the dismissed flag so the persisted history
    // becomes visible again.
    setChatDismissed(false);
    // If the user tapped the input while scrolled DOWN on the process list,
    // snap the surface back to the top. The chat belongs in the hero
    // context — agent + broadcast centered, exactly like tapping the input
    // from the home rest state. Without this the keyboard opened against the
    // collapsed top-bar (tiny orb up top, no broadcast), which read as broken.
    // scrollRef is a stable useAnimatedRef, so empty deps are correct; it is
    // declared below but only read when this fires (post-mount), never at
    // render time.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const handleInputBlur = useCallback(() => setInputFocused(false), []);

  // When Quick Actions (+) closes, bring the keyboard back IF the user had
  // opened it from chat with the keyboard up. Tracks the previous open-state so
  // we only fire on the true→false edge.
  const prevQuickActionsOpenRef = useRef(quickActionsOpen);
  useEffect(() => {
    const was = prevQuickActionsOpenRef.current;
    prevQuickActionsOpenRef.current = quickActionsOpen;
    if (was && !quickActionsOpen && wantKeyboardBackRef.current) {
      wantKeyboardBackRef.current = false;
      setChatReturnFocus((n) => n + 1);
    }
  }, [quickActionsOpen]);

  // A process (unit) sheet opening over Home: drop the Home chat keyboard so the
  // sheet presents cleanly (otherwise it lingers behind the card). Remember
  // whether we were mid-chat, and when the sheet CLOSES bring the keyboard back
  // so the user lands right back in the conversation.
  const prevUnitOpenRef = useRef(unitOpen);
  const unitOpenedDuringChatRef = useRef(false);
  // Set true when a unit is opened because ONE just CREATED it from the home
  // chat. Closing such a unit should land the user on the processes list (Home
  // at rest), NOT back in the now-cleared chat.
  const justCreatedFromChatRef = useRef(false);
  useEffect(() => {
    const was = prevUnitOpenRef.current;
    prevUnitOpenRef.current = unitOpen;
    if (unitOpen && !was) {
      // A just-created-from-chat unit must NOT queue a keyboard-restore.
      unitOpenedDuringChatRef.current = justCreatedFromChatRef.current ? false : chatActive;
      Keyboard.dismiss();
    } else if (!unitOpen && was) {
      if (justCreatedFromChatRef.current) {
        justCreatedFromChatRef.current = false;
        // Land on Home at REST (the processes list), not back in the chat.
        setChatDismissed(true);
        setInputFocused(false);
        setChatHeldOpen(false);
        Keyboard.dismiss();
      } else if (unitOpenedDuringChatRef.current) {
        unitOpenedDuringChatRef.current = false;
        setChatDismissed(false);
        setChatReturnFocus((n) => n + 1);
      }
    }
  }, [unitOpen, chatActive]);

  const clearChat = useCallback(() => {
    setChatText('');
    // NOTE: we DON'T wipe homeChat here anymore — closing the chat keeps the
    // conversation history (the X used to clear it). Just mark it dismissed so
    // the home returns to rest; the messages persist for next time.
    setChatDismissed(true);
    setChatTyping(false);
    setChatStatus(null);
    setInputFocused(false);
    setChatHeldOpen(false);
    // Ghost mode is per-conversation — closing the chat returns ONE to its
    // normal (non-incognito) presence, and the next chat starts on the record.
    setGhostMode(false);
    Keyboard.dismiss();
  }, []);

  // chatExitProgress: 0 = chat in place, 1 = chat fully slid off-screen.
  // Tapping X starts the slide-down animation; only when the slide finishes
  // do we actually call clearChat (unmounts the overlay). Cards behind the
  // chat ride the same value back up to opacity 1 so the close is one
  // coordinated motion instead of two abrupt boom-boom transitions.
  const chatExitProgress = useSharedValue(0);
  const dismissChatAnimated = useCallback(() => {
    chatExitProgress.value = withTiming(
      1,
      { duration: 320, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          // Just clear the chat state — do NOT reset chatExitProgress here. That
          // reset (while chatActive was momentarily still true) flashed the header
          // back to full opacity for a frame. We reset it on the next OPEN instead.
          runOnJS(clearChat)();
        }
      },
    );
  }, [chatExitProgress, clearChat]);

  // Reset the exit-slide whenever the chat (re)opens, so a reopened conversation
  // starts in place rather than mid-slide. Replaces the in-callback reset above.
  useEffect(() => {
    if (chatActive) chatExitProgress.value = 0;
  }, [chatActive, chatExitProgress]);

  // Ghost mode is per-conversation: the moment the chat is no longer active —
  // however it closed (X, pull-down, OR tapping out above the input / blur) —
  // ONE returns to its normal on-the-record presence.
  useEffect(() => {
    if (!chatActive) setGhostMode(false);
  }, [chatActive]);

  // Intentionally NO scrollToEnd here. Combined with `justifyContent:
  // flex-start` on the content, bubbles stay anchored to the TOP of the
  // chat area in both keyboard-closed and keyboard-open states. Previously
  // the auto-scroll-to-end pushed bubbles to the bottom whenever the chat
  // viewport shrunk (e.g. keyboard opening), which the user reported as a
  // bug. If the user has scrolled up to read older messages and a new one
  // arrives, they can pull down manually — feels more like reading a feed
  // than chasing the latest line.

  // The business ONE just talked about, so a bare follow-up ("רביעי 10", "כן")
  // continues that booking instead of being read as a brand-new process.
  const lastBusinessRef = useRef<string | null>(null);

  const sendChat = useCallback((raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const now = Date.now();
    const userMsg: InlineMessage = { id: `u${now}`, from: 'user', text: value, ts: now };
    setChatMessages((m) => [...m, userMsg]);
    setChatTyping(true);

    // Business-aware: if the user names a business that has its own ONE, my ONE
    // answers from ITS data (hours / prices / slots) — no AI round-trip needed.
    // Search live cloud businesses (created here or on the web) first, then the
    // built-in directory.
    const cloudBiz = useBusinessStore.getState().cloud;
    const namedBiz = findAnyBusiness(value, cloudBiz);
    const lastBiz = lastBusinessRef.current
      ? cloudBiz.find((b) => b.id === lastBusinessRef.current) ??
        DIRECTORY.find((b) => b.id === lastBusinessRef.current)
      : undefined;
    // Continuation of a business chat: a bare slot / "כן" refers to the business
    // we were just discussing, so ONE doesn't forget the context each line.
    const bizHit =
      namedBiz ?? (lastBiz && directoryBookingIntent(lastBiz, value) ? lastBiz : undefined);
    if (bizHit) {
      lastBusinessRef.current = bizHit.id;
      setChatStatus(t('home_chat_status_thinking'));
      const wantsOpen =
        !!onOpenBusiness && /פתח|תפתח|תראה|תראי|open|show|profile|פרופיל/.test(value.toLowerCase());
      setTimeout(() => {
        setChatTyping(false);
        setChatStatus(null);
        if (wantsOpen && onOpenBusiness) {
          onOpenBusiness(bizHit.id);
          const ots = Date.now();
          setChatMessages((m) => [
            ...m,
            {
              id: `o${ots}`,
              from: 'one',
              text: lang === 'he' ? `פותח/ת את הפרופיל של ${bizHit.name.he}…` : `Opening ${bizHit.name.en}…`,
              ts: ots,
            },
          ]);
          return;
        }
        const booking = directoryBookingIntent(bizHit, value);
        let reply: string;
        if (booking) {
          // ONE books on your behalf via the business's ONE → the appointment
          // lands as a real process in your list.
          const bizName = bizHit.name[lang];
          const seed = booking.service ? `${booking.service} ${bizName}` : bizName;
          const base = enrichUnitFromArchetype(desireToUnit(seed, identity?.id ?? undefined), seed, lang);
          const line = lang === 'he' ? `נקבע: ${booking.slot}` : `Booked: ${booking.slot}`;
          addUnit({
            ...base,
            identityId: identity?.id ?? base.identityId,
            emoji: bizHit.emoji,
            title: booking.service ? `${booking.service} — ${bizName}` : bizName,
            relationLabel: bizName,
            latestBroadcastText: [line, undefined] as [string, string?],
          });
          // Cloud businesses: record the booking in the shared marketplace so
          // the owner gets a customer card (same table the web writes to).
          if (bizHit.cloudId) {
            void cloudCreateBooking(
              bizHit.cloudId,
              identity?.name ?? 'A customer',
              booking.service,
              booking.slot,
            );
          }
          // Two-way: the business's ONE follows through — a moment later it
          // confirms back as a unit notification (badge + timeline entry), so a
          // booking reads as a real transaction, not a one-way write. Mirrors web.
          const bookedUnitId = base.id;
          const confirmText =
            lang === 'he'
              ? `${bizName} אישרה את ${booking.slot}`
              : `${bizName} confirmed ${booking.slot}`;
          setTimeout(() => {
            useMvpStore.getState().pushUnitNotification({
              unitId: bookedUnitId,
              text: confirmText,
              emoji: bizHit.emoji,
              kind: 'event',
            });
          }, 2600);
          reply = directoryBookingConfirm(bizHit, booking.slot, booking.service, lang);
          lastBusinessRef.current = null;
        } else {
          reply = businessDirectoryReply(bizHit, value, lang);
        }
        const bts = Date.now();
        setChatMessages((m) => [...m, { id: `o${bts}`, from: 'one', text: reply, ts: bts }]);
      }, HOME_CHAT_TYPING_MS);
      return;
    }

    // Status caption sequence — shown under the small Orb during the turn.
    // We schedule a quick cycle so the user sees something happen even while
    // waiting for the rule-based reply.
    setChatStatus(t('home_chat_status_thinking'));
    const t1 = setTimeout(() => setChatStatus(t('home_chat_status_searching')), 320);
    const t2 = setTimeout(() => setChatStatus(t('home_chat_status_updating')), 640);

    setTimeout(async () => {
      clearTimeout(t1);
      clearTimeout(t2);
      let reply: string;
      try {
        // Structured intent path — let ONE classify what the user just
        // said: chat, create_process, decision, embedded task, missing
        // info. The AI's `reply` is the user-facing message; side
        // effects (create unit, etc.) happen here.
        // Memory retrieval — only when the user seems to be asking
        // about the past. Cheap keyword overlap over units + persisted
        // chat history.
        const memory = looksLikeMemoryQuery(value)
          ? searchMemory(value, {
              units: useMvpStore.getState().units,
              unitChats: useMvpStore.getState().unitChats,
              limit: 5,
            })
          : [];
        // Only feed the AI the units the user could plausibly mean —
        // those under the active identity. Cross-identity matches would
        // surprise (you don't want a fitness reminder landing in your
        // business account).
        const activeUnits = units.filter((u) => u.identityId === identity?.id);
        const intent = await invokeOneIntent(value, {
          identityName: identity?.name,
          unitsCount: units.length,
          voiceStyle: personalityPrompt(useMvpStore.getState().agentPersonality, lang),
          history: chatMessages.slice(-6).map((m) => ({
            role: m.from === 'one' ? ('assistant' as const) : ('user' as const),
            content: m.text,
          })),
          memory: memory.length > 0 ? memory : undefined,
          existingUnits: activeUnits.slice(0, 12).map((u) => ({
            title: u.title,
            emoji: u.emoji,
            tags: u.tagIds,
          })),
        });
        reply = intent.reply;
        if (intent.kind === 'create_process') {
          // Client-side guard: even if the model returns create_process,
          // if the proposed title heavily overlaps with an existing
          // unit's title, redirect the content into that unit instead.
          // This protects against the dup-process bug ("כושר" + "תזכורות
          // לכושר") even when the model ignores the system-prompt rule.
          const proposedTitle = intent.process?.title?.trim() || value;
          const similar = findSimilarUnit(proposedTitle, activeUnits, identity?.id);
          if (similar) {
            const target = activeUnits.find((u) => u.id === similar.id)!;
            const stepTitles =
              intent.process?.nextSteps && intent.process.nextSteps.length > 0
                ? intent.process.nextSteps
                : [proposedTitle];
            const newSteps = stepTitles.slice(0, 3).map((title, i) => ({
              id: `ns_${Date.now()}_${i}`,
              title,
              done: false,
            }));
            updateUnit(target.id, {
              nextSteps: [...(target.nextSteps ?? []), ...newSteps],
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              lastUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: `Captured: ${newSteps.map((s) => s.title).join(', ')}`,
              emoji: target.emoji,
              kind: 'capture',
            });
            // Overwrite reply so ONE acknowledges the existing process
            // rather than pretending it just made a new one.
            reply = /[֐-׿]/.test(value)
              ? `הוספתי ל-${target.title}. ${intent.reply}`
              : `Added to ${target.title}. ${intent.reply}`;
          } else {
            // Born RICH: take the AI's process and enrich the thin sections
            // from the matching domain archetype (a real starter plan, metric
            // scaffolding, advice insights, a just-started progress bar) so a
            // new process never opens as a bare title.
            const base =
              unitFromIntent(intent, identity?.id ?? '', lang) ??
              desireToUnit(value, identity?.id ?? null);
            const created = enrichUnitFromArchetype(base, value, lang);
            addUnit(created);
            // Intent → reality: a process was just born. Mark it with a
            // success tap so the moment is felt, not just seen.
            haptic.success();
            useMvpStore.getState().pushUnitNotification({
              unitId: created.id,
              text: `New process: ${created.title}`,
              emoji: created.emoji,
              kind: 'created',
            });
            // Seed the new unit's chat with the turn that just happened
            // so the conversation reads as continuous once the profile
            // opens. The user's original line becomes the first bubble;
            // ONE's first in-process message is a REAL answer composed from
            // the enriched plan (names the process + lays out the first
            // steps + invites a start) — not the terse "created a process
            // for…" acknowledgement, which read like a system notice.
            // Skip if appendUnitChat isn't reachable yet.
            try {
              const store = useMvpStore.getState();
              const seedTs = Date.now();
              store.appendUnitChat?.(created.id, {
                id: `u_seed_${seedTs}`,
                from: 'user',
                text: value,
                ts: seedTs,
              });
              store.appendUnitChat?.(created.id, {
                id: `o_seed_${seedTs + 1}`,
                from: 'one',
                text: buildProcessOpener(created, lang),
                ts: seedTs + 1,
              });
            } catch (e) {
              console.warn('[HomeScreen] failed to seed unit chat:', e);
            }
            // Hand off to the host: close the chat overlay and open the
            // new unit so the next turn happens INSIDE the process. We
            // wait a beat so the reply bubble is visible before handoff.
            // Also clear the home chat — the conversation now lives
            // inside the unit, showing it twice would confuse.
            if (onCreatedFromChat) {
              setTimeout(() => {
                // Mark this as a create-from-chat handoff so closing the unit
                // lands the user on the processes list, not back in the chat.
                justCreatedFromChatRef.current = true;
                onCreatedFromChat(created.id);
                useMvpStore.getState().clearHomeChat?.();
              }, 700);
            }
          }
        } else if (intent.kind === 'extract_task' && intent.task) {
          const hint = intent.task.processHint?.toLowerCase() ?? '';
          const target = units.find((u) =>
            hint && u.title.toLowerCase().includes(hint),
          );
          if (target) {
            const stepTitle = [
              intent.task.action,
              intent.task.contact ? `→ ${intent.task.contact}` : '',
              intent.task.when ? `(${intent.task.when})` : '',
            ]
              .filter(Boolean)
              .join(' ');
            // Dedupe-add the contact to people[] so the process holds
            // every person it touches, not just buried in subtitles.
            const existingPeople = target.people ?? [];
            const contactName = intent.task.contact?.trim();
            const peopleNext =
              contactName &&
              !existingPeople.find(
                (p) => p.name.toLowerCase() === contactName.toLowerCase(),
              )
                ? [
                    ...existingPeople,
                    {
                      id: `p_${Date.now()}`,
                      name: contactName,
                    },
                  ]
                : existingPeople;
            updateUnit(target.id, {
              nextSteps: [
                ...(target.nextSteps ?? []),
                {
                  id: `ns_${Date.now()}`,
                  title: stepTitle,
                  done: false,
                  subtitle: intent.task.contact ?? undefined,
                },
              ],
              people: peopleNext,
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              updatedAt: new Date().toISOString(),
            });
            // Surface "captured" as a real toast — ONE shows the user
            // it just held what they said.
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: `Captured: ${stepTitle}`,
              emoji: target.emoji,
              kind: 'capture',
            });
          }
        } else if (intent.kind === 'decision' && intent.decision) {
          const hint = intent.decision.processHint?.toLowerCase() ?? '';
          const target = units.find((u) =>
            hint && u.title.toLowerCase().includes(hint),
          );
          if (target) {
            // Append to decisions[] so it persists in the profile, and
            // also reflect it in the broadcast preview so the home card
            // shows the most recent decision.
            const decisionId = `d_${Date.now()}`;
            const nowIso = new Date().toISOString();
            updateUnit(target.id, {
              decisions: [
                ...(target.decisions ?? []),
                {
                  id: decisionId,
                  text: intent.decision.text,
                  createdAt: nowIso,
                },
              ],
              latestBroadcastText: [intent.decision.text, ...target.latestBroadcastText].slice(0, 2) as [string, string?],
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              lastUpdatedAt: nowIso,
              updatedAt: nowIso,
            });
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: `Decision saved: ${intent.decision.text}`,
              emoji: target.emoji,
              kind: 'decision',
            });
          }
        } else if (intent.kind === 'add_reminder' && intent.reminder) {
          // Attach the reminder to the process it belongs to — by hint, else
          // the most recent active process. If the user has none yet, ONE
          // still acknowledges in the reply (nothing to attach to).
          const hint = intent.reminder.processHint?.toLowerCase() ?? '';
          const target =
            (hint && activeUnits.find((u) => u.title.toLowerCase().includes(hint))) ||
            activeUnits[0];
          if (target) {
            const nowIso = new Date().toISOString();
            updateUnit(target.id, {
              reminders: [
                ...(target.reminders ?? []),
                {
                  id: `r_${Date.now()}`,
                  text: intent.reminder.text,
                  dueLabel: intent.reminder.when,
                  dueAt: resolveReminderDue(intent.reminder.when, Date.now()),
                  done: false,
                  createdAt: nowIso,
                },
              ],
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              lastUpdatedAt: nowIso,
              updatedAt: nowIso,
            });
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: `Reminder set: ${intent.reminder.text}${intent.reminder.when ? ` (${intent.reminder.when})` : ''}`,
              emoji: target.emoji,
              kind: 'capture',
            });
          }
        }
      } catch (err) {
        // Network / parse failure → plain-text reply + the old regex
        // path so substantial intentions still become units. Log so
        // we can tell from Expo Go's console whether the AI is reaching
        // the function at all (this used to swallow silently).
        console.warn('[HomeScreen sendChat] invokeOneIntent failed:', err);
        const looksLikeIntention =
          value.length > 25 &&
          /(i want|i need|gain|finish|build|move|plan|launch|book|prepare)/i.test(value);
        if (looksLikeIntention) {
          const unit = enrichUnitFromArchetype(
            desireToUnit(value, identity?.id ?? null),
            value,
            lang,
          );
          addUnit(unit);
          reply = `Added ${unit.emoji} ${unit.title} as a process. Want to open it?`;
        } else {
          reply = await generateOneReply(value, {
            identityName: identity?.name,
            unitsCount: units.length,
            lang,
          });
        }
      }
      setChatTyping(false);
      setChatStatus(null);
      const replyTs = Date.now();
      setChatMessages((m) => [...m, { id: `o${replyTs}`, from: 'one', text: reply, ts: replyTs }]);
    }, HOME_CHAT_TYPING_MS);
  }, [addUnit, chatMessages, identity?.id, identity?.name, units, updateUnit, t, onCreatedFromChat]);

  const handleSendChat = useCallback(() => {
    const v = chatText.trim();
    if (!v) return;
    haptic.tap();
    setChatText('');
    sendChat(v);
  }, [chatText, sendChat]);

  // Cross-surface input handoff. Other surfaces (e.g. the ONE Profile
  // sheet's input bar) can't reach Home's sendChat directly, so they
  // park a message on `pendingHomeInput`. Home owns the one chat brain:
  // when a pending message appears we run it through the SAME AI pipeline
  // as a typed message, then clear the slot. A ref guards against
  // double-fire if the effect re-runs before the store clears.
  const pendingHomeInput = useMvpStore((s) => s.pendingHomeInput);
  const consumedPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingHomeInput) {
      consumedPendingRef.current = null;
      return;
    }
    if (consumedPendingRef.current === pendingHomeInput) return;
    consumedPendingRef.current = pendingHomeInput;
    useMvpStore.getState().setPendingHomeInput(null);
    sendChat(pendingHomeInput);
  }, [pendingHomeInput, sendChat]);

  // A coarse time-bucket (date + part-of-day) that only flips a few times a
  // day. Used to refresh ONE's time-aware lines when morning→afternoon etc.
  // WITHOUT rebuilding every 30s (which would reset the broadcast to line 0).
  const broadcastTimeBucket = React.useMemo(() => timeBucket(nowTick), [nowTick]);

  // Local broadcast loop — used as the immediate fallback while the AI
  // attention lines load in the background.
  const fallbackLoop = React.useMemo(() => {
    if (!hasOnboarded) return onboardingLines(lang);
    return buildBroadcastLoop(units, identity, lang, nowTick);
    // `broadcastTimeBucket` is the real time dependency — it changes only when
    // the part-of-day flips, so the loop (and its embedded clock lines) stays
    // stable within a part-of-day instead of churning on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOnboarded, units, identity?.id, lang, broadcastTimeBucket]);

  // AI-driven attention lines: ONE looks across the user's open
  // processes and surfaces what's hot / stuck / waiting / quick-win.
  // Refreshes when units or identity change; resets on language switch.
  // While we wait, the static fallback above is what cycles — so the UI
  // is never empty.
  const [aiLoop, setAiLoop] = useState<readonly string[] | null>(null);
  useEffect(() => {
    if (!hasOnboarded) {
      setAiLoop(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const now = Date.now();
        const lines = await invokeAttentionLines({
          identityName: identity?.name,
          lang,
          units: units.slice(0, 8).map((u) => ({
            title: u.title,
            emoji: u.emoji,
            latest: u.latestBroadcastText?.[0],
            ageHours:
              (now - new Date(u.lastUpdatedAt).getTime()) / 3600_000,
            openSteps: (u.nextSteps ?? [])
              .filter((s) => !s.done)
              .slice(0, 3)
              .map((s) => s.title),
          })),
        });
        if (!cancelled && lines.length > 0) setAiLoop(lines);
      } catch {
        if (!cancelled) setAiLoop(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasOnboarded, units, identity?.id, identity?.name, lang]);

  const broadcastLoop = React.useMemo(() => {
    if (!aiLoop) return fallbackLoop;
    // Even with AI attention lines, WRAP them so the loop reads like the
    // fallback: it OPENS on a general, time-of-day greeting (never a task) and
    // PARKS on a general, open-ended prompt when it rests (restAtEnd stops on
    // the last line). The AI's specific "what's waiting" lines sit in between.
    const greeting = timeGreeting(lang, nowTick, identity?.name);
    const nowBeat = timeAwareLines(lang, nowTick)[0];
    const closing = translate(lang, 'home_broadcast_closing');
    return [greeting, nowBeat, ...aiLoop, closing].filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLoop, fallbackLoop, lang, identity?.name, broadcastTimeBucket]);
  // Chat-composing prompts — what ONE "asks" while the keyboard is open and
  // the conversation hasn't started yet. A small rotating set so each entry
  // opens on a DIFFERENT line, and an unanswered line quietly switches to
  // another after an idle beat (cycler below).
  // ONE's grammatical gender for the user. When 'unknown', the Hebrew prompts
  // use gender-neutral, non-plural phrasing (no "תרצה/תרצי", no "בוא/בואי") so
  // ONE never assumes a gender it can't be sure of.
  const userGender = useMvpStore((s) => s.userGender);
  const chatPrompts = React.useMemo<string[]>(() => {
    if (lang !== 'he') {
      return [
        'What do you want to work on?',
        "Tell me what's on your mind.",
        'What needs attention most right now?',
        "Let's start with one thing — what is it?",
        'What should I remember or move forward?',
        "Something on your mind? Let's break it down.",
      ];
    }
    if (userGender === 'male') {
      return [
        'על מה תרצה לעבוד?',
        'ספר לי מה במחשבות שלך.',
        'מה הכי דורש תשומת לב עכשיו?',
        'נתחיל ממשהו אחד — מהו?',
        'מה תרצה שאקדם בשבילך?',
        'משהו מעיק? בוא נפרק אותו.',
      ];
    }
    if (userGender === 'female') {
      return [
        'על מה תרצי לעבוד?',
        'ספרי לי מה במחשבות שלך.',
        'מה הכי דורש תשומת לב עכשיו?',
        'נתחיל ממשהו אחד — מהו?',
        'מה תרצי שאקדם בשבילך?',
        'משהו מעיק? בואי נפרק אותו.',
      ];
    }
    // Unknown gender → neutral phrasing: no gendered 2nd-person verbs, no
    // plural address. Built from noun phrases + impersonal forms.
    return [
      'מה הכי דורש תשומת לב עכשיו?',
      'מה הכי מעסיק אותך?',
      'במה אפשר לעזור?',
      'מה הדבר הכי חשוב כרגע?',
      'אפשר להתחיל ממשהו אחד — מהו?',
      'מה על הראש?',
    ];
  }, [lang, userGender]);

  const isComposingFirst = chatActive && sessionMessages.length === 0;

  // Home broadcast loop (rest state). No cycling while chat is active.
  const {
    line: broadcast,
    next: nextBroadcast,
    prev: prevBroadcast,
    resume: resumeBroadcast,
  } = useBroadcastNavigator(broadcastLoop, {
    // Recording a response FREEZES the broadcast on its current line, so the
    // user answers the exact line they long-pressed.
    autoCycle: !chatActive && !recording,
    seedIndex: chatActive ? chatSessionIndex : 0,
    // ONE speaks with a human cadence — each line dwells for its own
    // reading-time, with the occasional longer "thinking" pause.
    dwellFor: broadcastDwellMs,
    // ONE says its piece once — a full round ending on the closing line — then
    // goes quiet. Any touch on the home surface wakes it for another round.
    restAtEnd: true,
  });

  // Chat-prompt cycler — runs ONLY while composing the first message with an
  // empty field. Seeded by chatSessionIndex (fresh opener each entry) and
  // idle-cycles every ~7s so a prompt that's gone unanswered changes on its own.
  const { line: chatPrompt } = useBroadcastNavigator(chatPrompts, {
    autoCycle: isComposingFirst && chatText.trim().length === 0 && !recording,
    seedIndex: chatSessionIndex,
    dwellFor: chatPromptDwell,
  });

  // Ghost mode — while composing, ONE's line keeps reminding the user this is a
  // temporary, off-the-record conversation (nothing is saved to their processes).
  const ghostPrompts = useMemo(
    () =>
      lang === 'he'
        ? [
            'מצב פרטי — השיחה הזו לא נשמרת.',
            'אני כאן, אבל לא אזכור את זה.',
            'אפשר לדבר בחופשיות — כלום לא נכתב לתהליכים.',
            'שיחה זמנית. כשהיא נסגרת — היא נעלמת.',
          ]
        : [
            "Private mode — this chat isn't saved.",
            "I'm here, but I won't remember this.",
            'Speak freely. Nothing is written to your processes.',
            'Temporary chat — close it and it’s gone.',
          ],
    [lang],
  );
  const { line: ghostPrompt } = useBroadcastNavigator(ghostPrompts, {
    autoCycle: ghostMode && isComposingFirst && !recording,
    seedIndex: chatSessionIndex,
    dwellFor: chatPromptDwell,
  });

  // Sign-in sheet open → broadcast reads as the sign-in headline so the
  // home surface frames the sheet. Takes priority over chat prompt / loop.
  const welcomeBackLine = lang === 'he' ? 'ברוך שובך.' : 'Welcome back.';
  const displayedBroadcast = signInOpen
    ? welcomeBackLine
    : isComposingFirst
      ? (ghostMode ? ghostPrompt : chatPrompt)
      : broadcast;
  const broadcastShouldHide =
    chatActive && (sessionMessages.length > 0 || chatText.trim().length > 0);

  // Broadcast interaction:
  //   • Tap — cycle to the next broadcast line.
  //   • HOLD anywhere — freeze the broadcast on its current line and record a
  //     spoken response. RELEASING the hold ends the recording (hold-to-talk),
  //     leaving the transcribed text in the input for review.
  //   • Swipe → prev/next.
  const onBroadcastTap = useCallback(() => {
    wakeChevron();
    nextBroadcast();
  }, [nextBroadcast, wakeChevron]);

  const onBroadcastLongPress = useCallback(() => {
    if (recording) return;
    startRecording();
  }, [recording, startRecording]);

  // Release of the press — if a hold-to-record was running, stop it.
  const onBroadcastRelease = useCallback(() => {
    if (recording) stopRecording();
  }, [recording, stopRecording]);

  const broadcastGesture = React.useMemo(
    () =>
      Gesture.Race(
        // Hold-to-record: start on long-press, stop when the finger lifts.
        Gesture.LongPress()
          .minDuration(400)
          .onStart(() => {
            'worklet';
            runOnJS(onBroadcastLongPress)();
          })
          .onEnd(() => {
            'worklet';
            runOnJS(onBroadcastRelease)();
          }),
        Gesture.Tap().onEnd(() => {
          'worklet';
          runOnJS(onBroadcastTap)();
        }),
        Gesture.Pan()
          .activeOffsetX([-12, 12])
          .failOffsetY([-20, 20])
          .onEnd((e) => {
            'worklet';
            if (e.translationX < -40) runOnJS(nextBroadcast)();
            else if (e.translationX > 40) runOnJS(prevBroadcast)();
          }),
      ),
    [onBroadcastTap, onBroadcastLongPress, onBroadcastRelease, nextBroadcast, prevBroadcast],
  );

  // Tap-grow on the Orb. Driven from native Pressable's onPressIn/onPressOut.
  // Combined multiplicatively with `orbBreathScale` so neither cancels the
  // other.
  const orbTapScale = useSharedValue(1);

  // ── Mount cascade ─────────────────────────────────────────────────────
  // Orb starts at vertical screen-centre (continuing from the splash dot),
  // animates up to HERO_CENTER_TOP. AFTER the Orb settles, the broadcast,
  // chevron and input dock slide up from offscreen-below to their resting
  // positions. The handoff from splash → home reads as one continuous motion.
  // The orb container is positioned inside SafeAreaView, which pads its
  // children by `insets.top`. The splash dot lives in App.tsx OUTSIDE any
  // SafeArea wrap and sits at true screen-centre. So to make the home orb
  // start at the EXACT same screen-Y as the splash dot, we have to
  // subtract `insets.top` from the offset — otherwise the home orb
  // appears ~44 px below the splash dot during the handoff and the user
  // briefly sees two balls.
  const ORB_FROM_CENTER_OFFSET = Math.round(
    SCREEN_H / 2 - insets.top - HERO_CENTER_TOP - HOME_ORB_SIZE / 2,
  );
  const orbMountY = useSharedValue(ORB_FROM_CENTER_OFFSET);
  // Smaller travel for the secondary elements so the entry reads as a
  // single settle, not separate slides. Broadcast row and input dock
  // each just rise a touch into position.
  const elementsMountY = useSharedValue(16);   // broadcast/chevron slide from +16
  const inputMountY = useSharedValue(30);      // input dock slides from +30
  const elementsMountOpacity = useSharedValue(0);
  const inputMountOpacity = useSharedValue(0);
  // Idle-sleep progress: 1 = awake / eyes open, 0 = asleep. Declared UP HERE
  // (before inputMountStyle / broadcastCrossfadeStyle reference it) so those
  // useAnimatedStyle worklets don't read it while it's still undefined during
  // the initial synchronous updater run. The withTiming driver + eye/lid
  // derivations live further below, keyed on `orbAsleep`.
  const sleepSV = useSharedValue(1);
  // Companion to sleepSV for the CHROME around the orb (broadcast line, input
  // dock, chevron). On falling asleep this drops FAST (everything around ONE
  // clears quickly) while sleepSV eases the orb itself down slowly — so ONE
  // reads as settling into a bare centred dot while its surroundings vanish
  // first. 1 = awake, 0 = asleep. Driven alongside sleepSV below.
  const sleepChromeSV = useSharedValue(1);
  // Status bar (the iOS clock/battery row) is HIDDEN through the mount
  // cascade — the intro reads as a clean, chrome-free "splash" — then fades in
  // in sync with the broadcast + input dock arriving (see the reveal timer in
  // the mount effect below).
  const [statusBarHidden, setStatusBarHidden] = useState(true);

  // Eyes start closed (opacity 0) — the agent is just a dot at first.
  const eyesOpacityMount = useSharedValue(0);
  // Dot enter scale: orb starts at scale 0 (invisible — clean blank
  // screen for a beat), then grows from 0 → 1 to "pop into existence"
  // before it wakes up and rises.
  const orbEnterScale = useSharedValue(0);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Plays the whole opening cascade. Runs once on mount, and again whenever the
  // user taps the top status-bar strip ("replay the splash").
  const playIntro = useCallback(() => {
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    // Reset every animated value to its pre-intro state so a REPLAY starts from
    // the very top (on first mount they're already here).
    setStatusBarHidden(true);
    orbEnterScale.value = 0;
    orbMountY.value = ORB_FROM_CENTER_OFFSET;
    eyesOpacityMount.value = 0;
    elementsMountOpacity.value = 0;
    elementsMountY.value = 16;
    inputMountOpacity.value = 0;
    inputMountY.value = 30;

    // Mount cascade — single coordinated opening (no splash overlay).
    // Sequence:
    //   0 ms        — blank screen.
    //   200 ms      — black dot grows in at screen centre (scale 0 → 1).
    //   800 ms      — orb starts rising AND eyes open simultaneously.
    //                  The face only "wakes up" once it's already moving
    //                  toward its Home position — feels like one motion,
    //                  not "wake then go".
    //   1100 ms     — broadcast + input dock fade up TOGETHER as the orb
    //                  is settling. They arrive in sync with the orb's
    //                  final position so the whole page resolves at once.
    //   ~1.85 s total. Reads as one calm settle.
    const DOT_APPEAR_DELAY = 200;
    const GROW_MS = 420;
    const SHRINK_MS = 300;
    // Rise begins only AFTER the dot has settled back to agent size at centre.
    const RISE_DELAY = DOT_APPEAR_DELAY + GROW_MS + SHRINK_MS + 40; // ≈ 960
    const EYES_OPEN_DELAY = RISE_DELAY;        // eyes open THROUGH the rise
    const ELEMENTS_DELAY = RISE_DELAY + 300;   // broadcast + input together

    // Reveal the status bar exactly as the broadcast + input dock arrive, so the
    // clock/battery row fades in as part of the same settle — not a hard cut on
    // a bare intro screen.
    introTimerRef.current = setTimeout(() => setStatusBarHidden(false), ELEMENTS_DELAY);

    // Phase 0: blank screen for a beat, then the dot grows in at centre, swells
    // a touch (a soft "breath" of presence — not a big balloon), then eases
    // back DOWN to the agent's size, still centred. Only once it's settled at
    // agent size does it rise and open its eyes.
    orbEnterScale.value = withDelay(
      DOT_APPEAR_DELAY,
      withSequence(
        withTiming(1.4, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: SHRINK_MS, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    // Phase 1: orb rises from centre to Home rest position.
    orbMountY.value = withDelay(
      RISE_DELAY,
      withTiming(0, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );
    // Phase 1b: eyes open at the same instant the rise starts — the
    // face wakes up THROUGH the upward motion, not before it.
    eyesOpacityMount.value = withDelay(
      EYES_OPEN_DELAY,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    // Phase 2: broadcast + chevron fade and settle. Same delay as the
    // input dock below, so they arrive together — reads as the whole
    // page resolving in one breath, not separate slides.
    elementsMountOpacity.value = withDelay(
      ELEMENTS_DELAY,
      withTiming(1, { duration: 460 }),
    );
    elementsMountY.value = withDelay(
      ELEMENTS_DELAY,
      withTiming(0, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
    // Phase 2 (synchronised): input dock slides in TOGETHER with the
    // broadcast row above. Same delay, matched duration.
    inputMountOpacity.value = withDelay(
      ELEMENTS_DELAY,
      withTiming(1, { duration: 460 }),
    );
    inputMountY.value = withDelay(
      ELEMENTS_DELAY,
      withTiming(0, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [orbMountY, orbEnterScale, elementsMountY, elementsMountOpacity, inputMountY, inputMountOpacity, eyesOpacityMount]);

  // Play the opening once on mount.
  useEffect(() => {
    playIntro();
    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
    };
  }, [playIntro]);
  const elementsMountStyle = useAnimatedStyle(() => ({
    opacity: elementsMountOpacity.value,
    transform: [{ translateY: elementsMountY.value }],
  }));
  const inputMountStyle = useAnimatedStyle(() => ({
    // Mount cascade opacity, folded with the idle-sleep fade. Uses the FAST
    // chrome value (sleepChromeSV) — the dock clears quickly as ONE dozes, well
    // before the orb finishes its slow glide to centre. Only ever leaves 1 while
    // Home is truly at rest (no chat / call / sheet), so it never touches the
    // dock during a conversation.
    opacity: inputMountOpacity.value * sleepChromeSV.value,
    transform: [{ translateY: inputMountY.value }],
  }));
  // Tracks whether the list is currently snapped OPEN (processes) vs at rest,
  // so onMomentumScrollEnd fires the detent haptic only on a real transition.
  const atProcessesRef = useRef(false);

  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Home → Global pull. Negative overscroll (drag DOWN past the top) scrubs
  // 0→1; clamps to 0 the instant the list is scrolled the normal way (positive
  // offset) so it ONLY ever engages from the resting top. Drives the orb
  // re-centre + eyes-close + text fade below — a live, reversible transition.
  const globalPull = useDerivedValue(() => {
    'worklet';
    return interpolate(
      scrollY.value,
      [-GLOBAL_PULL_RANGE, 0],
      [1, 0],
      Extrapolation.CLAMP,
    );
  });
  // Idle-sleep driver: after a long, untouched rest on Home, ONE "falls
  // asleep". Drooping to sleep is slow and heavy; waking is quick and alert.
  // `sleepSV` itself is declared up with the mount values (so earlier worklets
  // can read it); here we just animate it toward the current asleep state. A
  // sleeping ONE returns to the SPLASH look — a bare black dot.
  useEffect(() => {
    sleepSV.value = withTiming(orbAsleep ? 0 : 1, {
      duration: orbAsleep ? 1500 : 300,
      easing: Easing.inOut(Easing.quad),
    });
    // The surroundings clear FAST — gone well before the orb finishes its slow
    // 1.5 s glide to centre — so ONE is left alone as a settling dot.
    sleepChromeSV.value = withTiming(orbAsleep ? 0 : 1, {
      duration: orbAsleep ? 360 : 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [orbAsleep, sleepSV, sleepChromeSV]);

  // The hero's eyes fade in on the splash → home handoff (eyesOpacityMount) and
  // stay open at rest. Pulling toward Global — AND falling asleep — fades the
  // eyes fully out so ONE returns to the bare-dot splash state (the lids also
  // drop via heroEyeOpen below, so it reads as shutting its eyes as it dissolves).
  const heroEyesOpacity = useDerivedValue(() => {
    'worklet';
    const fade = interpolate(globalPull.value, [0, 0.4], [0, 1], Extrapolation.CLAMP);
    return eyesOpacityMount.value * (1 - fade) * sleepSV.value;
  });

  // Combined lid openness for the hero Orb's `eyeOpen`:
  //   • Global pull closes the lids EARLY (fully shut by ~40% of the sweep) so
  //     the orb is a bare dot by the time Global opens.
  //   • Sleep closes them when idle.
  // Multiplied, so whichever is smaller wins — either effect can shut the eyes.
  const heroEyeOpen = useDerivedValue(() => {
    'worklet';
    const pullClose = interpolate(globalPull.value, [0, 0.4], [0, 1], Extrapolation.CLAMP);
    return (1 - pullClose) * sleepSV.value;
  });

  // Subtle crossfade when the broadcast line changes — fade out / fade in.
  // Tiny detail, but it stops the text from snapping between lines and gives
  // ONE a sense of "speaking" rather than flipping cards.
  const broadcastLineOpacity = useSharedValue(1);
  useEffect(() => {
    broadcastLineOpacity.value = 0;
    broadcastLineOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [broadcast, broadcastLineOpacity]);
  const broadcastLineStyle = useAnimatedStyle(() => ({
    opacity: broadcastLineOpacity.value,
  }));

  // Orb scale animation has three states:
  //   • resting (default): slow 2.4s breath — "alive but quiet"
  //   • chat active, not typing: held steady at 1 — input is the focus
  //   • chat active + ONE typing: faster 600ms pulse — "thinking" beat that
  //     visibly accompanies the typing indicator below the chat header.
  const orbBreathScale = useSharedValue(1);
  useEffect(() => {
    if (chatTyping) {
      orbBreathScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.00, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      return;
    }
    if (chatActive) {
      orbBreathScale.value = withTiming(1, { duration: 240 });
      return;
    }
    orbBreathScale.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.000, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => {
      // Halt the loop when the screen unmounts.
      orbBreathScale.value = 1;
    };
  }, [chatActive, chatTyping, orbBreathScale]);

  // Profile hand-off: the home orb collapses away as the ONE profile sheet
  // rises and comes BACK in sync with the close drag. We read the sheet's
  // LIVE animated index (-1 closed … 0 half … 1 full) so the orb tracks the
  // finger in real time — dragging the sheet down grows the orb back
  // continuously, no fixed timer. The worklets below map that index to a
  // 0→1 collapse fraction via interpolate(profileIdx, [-1, 0], [0, 1]).
  //
  // Fallback: when no shared index is wired, drive a local one off the
  // `profileOpen` boolean so the effect still degrades to a quick timer.
  const fallbackProfileIndex = useSharedValue(-1);
  useEffect(() => {
    if (profileSheetIndex) return; // real index in control — skip the fallback
    fallbackProfileIndex.value = withTiming(profileOpen ? 0 : -1, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [profileOpen, profileSheetIndex, fallbackProfileIndex]);
  const profileIdx = profileSheetIndex ?? fallbackProfileIndex;

  // Opening the profile no longer makes the hero VANISH — instead it "goes to
  // sleep": the eyes shut and it becomes the bare black dot (splash state),
  // then the eyes re-open as the profile closes. `profileEyeFactor` is 1 while
  // the profile is closed (idx -1) and 0 once it's open (idx ≥ 0). We fold it
  // into the hero's eye opacity + lid openness (both driven off the SAME
  // underlying values, just multiplied by this).
  const profileEyeFactor = useDerivedValue(() => {
    'worklet';
    return interpolate(profileIdx.value, [-1, 0], [1, 0], Extrapolation.CLAMP);
  });
  const heroEyesOpacityFinal = useDerivedValue(() => {
    'worklet';
    return heroEyesOpacity.value * profileEyeFactor.value;
  });
  const heroEyeOpenFinal = useDerivedValue(() => {
    'worklet';
    return heroEyeOpen.value * profileEyeFactor.value;
  });

  const orbBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbBreathScale.value * orbTapScale.value }],
  }));

  // Hero-lift state on the worklet thread — used to bias the eye gaze
  // upward when the user is typing and to shift the Orb + broadcast up
  // when chat opens. The sign-in sheet does NOT lift the hero: the
  // Orb and "Welcome back." line stay at their default Home positions
  // above the sheet (user request).
  const chatActiveSV = useSharedValue(chatActive ? 1 : 0);
  useEffect(() => {
    chatActiveSV.value = withTiming(chatActive ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [chatActive, chatActiveSV]);

  // Ghost (temporary-chat) mode visibly changes ONE: the face fades back to a
  // quieter, "incognito" presence so the user can SEE they're off the record.
  const ghostSV = useSharedValue(ghostMode ? 1 : 0);
  useEffect(() => {
    ghostSV.value = withTiming(ghostMode ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [ghostMode, ghostSV]);
  const orbGhostStyle = useAnimatedStyle(() => ({ opacity: 1 - ghostSV.value * 0.6 }));
  // The ghost ORB fades further than the broadcast — a faint hollow outline
  // (floor ~0.3) so ONE reads as barely-there / off-the-record.
  const orbGhostDimStyle = useAnimatedStyle(() => ({ opacity: 1 - ghostSV.value * 0.7 }));

  // Eye look-Y: as the user pulls processes up, the eyes drift down to "look
  // at" what they're surfacing. Negative when over-scrolled (looks up). When
  // chat is active, eyes bias slightly UP — reads as ONE making eye contact
  // with the typing user. Mapped from scrollY [0, SNAP_OPEN] → [0, 1].
  const eyeLookY = useDerivedValue(() => {
    'worklet';
    const scroll = Math.max(-0.6, Math.min(1, scrollY.value / SNAP_OPEN));
    return scroll - chatActiveSV.value * 0.35;
  });

  // Track "chat has at least one message" on the worklet thread so we can
  // collapse the hero only AFTER the conversation has actually started — not
  // the moment the input gains focus. Per the latest mockup: chat-just-opened
  // keeps the big Orb + CTA line, sending the first message is what shrinks
  // the face up to the header.
  // Gated on chatActive (not just message count) so that when the chat is
  // DISMISSED — history kept — the hero un-collapses back to the big resting orb.
  const hasChatMessagesSV = useSharedValue(0);
  useEffect(() => {
    hasChatMessagesSV.value = withTiming(chatActive && sessionMessages.length > 0 ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [chatActive, sessionMessages.length, hasChatMessagesSV]);

  // Collapse fraction: 0 = resting hero (big centred Orb + broadcast),
  // 1 = compact header (small Orb up top + identity name). Driven by EITHER
  // scrolling the processes list up OR sending the first chat message —
  // whichever is more collapsed wins. Chat-active alone (input focused but
  // nothing sent) does NOT collapse — the big hero stays put, just lifted a
  // touch for the keyboard.
  const collapseFrac = useDerivedValue(() => {
    'worklet';
    const scrollFrac = Math.max(0, Math.min(1, scrollY.value / SNAP_OPEN));
    return Math.max(scrollFrac, hasChatMessagesSV.value);
  });

  // Lift the hero (orb + CTA) when chat opens so the keyboard doesn't
  // crowd them. Pulled back from −130 to −80 per latest pass — the hero
  // was sitting too high; this gives it a touch more vertical breathing
  // room without colliding with the keyboard.
  const chatOpenLiftSV = useDerivedValue(() => {
    'worklet';
    return chatActiveSV.value * (1 - hasChatMessagesSV.value) * -80;
  });

  /*
   * Keyboard shove for the INPUT DOCK only. The hero (Orb + broadcast) stays
   * put — the user wants the agent visually closer to the centre of the
   * visible-above-keyboard area, which HERO_CENTER_TOP already achieves
   * without a manual lift.
   */
  const heroKeyboardLift = useSharedValue(0);
  const inputKeyboardLift = useSharedValue(0);
  // Capture plain values for use inside worklets (Platform / insets objects
  // aren't worklet-safe; primitives are).
  const isAndroid = Platform.OS === 'android';
  const insetsBottom = insets.bottom;
  const KB_GAP = 14;
  // Reanimated's keyboard tracker drives the ANDROID lift (reliable under
  // edge-to-edge). iOS uses the keyboardWillShow listener + withTiming below,
  // which GUARANTEES a smooth ramp over the keyboard's own duration (the live
  // iOS `useAnimatedKeyboard` height can arrive in a step in Expo Go, which read
  // as the bar snapping). Web has no soft keyboard, so the fallback 0 is right;
  // calling the hook there THROWS. Platform.OS is constant per session, so this
  // conditional hook call keeps a stable hook order per platform (safe here).
  const fallbackKbHeight = useSharedValue(0);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const keyboardHeight = isAndroid ? useAnimatedKeyboard().height : fallbackKbHeight;
  useEffect(() => {
    // iOS only — Android avoidance is handled by `keyboardHeight` worklets.
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      const kbH = e.endCoordinates.height;
      // SafeAreaView already insets the dock by insets.bottom, so add it back;
      // subtract KB_GAP to lift a touch above the keyboard top. Match the
      // SYSTEM keyboard's duration so the ramp rides up in lockstep.
      inputKeyboardLift.value = withTiming(-kbH + insetsBottom - KB_GAP, {
        duration: e.duration || 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      inputKeyboardLift.value = withTiming(0, {
        duration: e.duration || 220,
        easing: Easing.out(Easing.cubic),
      });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [inputKeyboardLift, insetsBottom]);

  // Input dock vertical position. On Android the dock rests `insetsBottom`
  // above the screen bottom (RN's SafeAreaView does NOT inset the bottom under
  // edge-to-edge, so without this the bar tucks under the system nav bar), and
  // rides up to KB_GAP above the keyboard when it opens. On iOS the SafeAreaView
  // already provides the bottom inset, so we only apply the keyboard slide.
  const inputDockStyle = useAnimatedStyle(() => {
    if (isAndroid) {
      const kb = keyboardHeight.value;
      const lift = kb > 1 ? kb + KB_GAP : insetsBottom;
      return { transform: [{ translateY: -lift }] };
    }
    return { transform: [{ translateY: inputKeyboardLift.value }] };
  });

  // Messages area sits ABOVE the input — its bottom edge tracks the dock so
  // bubbles never hide under the keyboard. Mirrors the dock lift per platform.
  const messagesAreaStyle = useAnimatedStyle(() => {
    if (isAndroid) {
      const kb = keyboardHeight.value;
      const lift = kb > 1 ? kb + KB_GAP : insetsBottom;
      return { bottom: INPUT_BAR_H + 8 + lift };
    }
    return { bottom: INPUT_BAR_H + 8 - inputKeyboardLift.value };
  });

  /*
   * Fusion animation (Home → Processes):
   *
   * The resting hero (big Orb + broadcast + chevron) and the opened title bar
   * (small Orb + Ariel ⌄) are NOT two separate elements that fade in/out.
   * They're a SINGLE hero rendered as two animated containers:
   *
   *   - heroOrbStyle: the Orb translates from HERO_CENTER_TOP up to
   *     HERO_OPEN_ORB_TOP and scales 1 → 28/72 simultaneously, so visually
   *     it flies to the top of the screen while shrinking from 72 px to 28 px.
   *
   *   - heroTextStyle: a text container directly below the Orb translates
   *     up by the same delta. Inside it, the broadcast text and the identity
   *     row cross-fade so the "name + arrow" feels like it's the same place
   *     where the broadcast just was.
   *
   * The user sees ONE thing morphing, not two things swapping.
   */
  // Pushed higher in this iteration so the open-state header reads as
  // clearly distinct from the full-screen scroll content below, and so the
  // chat header buttons (X / ⋮) at y=12 don't crowd the orb beneath them.
  const HERO_OPEN_ORB_TOP = 12;
  const HERO_OPEN_ORB_SCALE = 52 / HOME_ORB_SIZE;     // chat-mode orb sized to match the X/⋮ buttons (52 ≈ 48px buttons)
  // In the PROCESSES LIST (scroll collapse) the head reads bigger than in chat —
  // it's the agent presiding over the list, not a compact chat avatar.
  const HERO_PROCESSES_ORB_SCALE = 66 / HOME_ORB_SIZE;
  // How much the hero shrinks when the profile opens — a small recede-to-a-dot,
  // not a vanish (it stays visible with its eyes shut).
  const PROFILE_ORB_SHRINK = 0.72;
  // How much the bare dot GROWS as ONE falls asleep — ends ~18% bigger than the
  // resting hero, a calm splash-like dot at screen centre.
  const SLEEP_ORB_GROW = 0.18;
  // Sits just below the collapsed processes-list Orb (66px tall from top 12 →
  // visual bottom ~87). 90 hugs the face closely without tucking under it —
  // 100 read as floating too far below the head.
  const HERO_OPEN_TEXT_TOP = 90;

  // During a call the home face + broadcast must FULLY disappear. Driven on the
  // UI thread because a static `opacity: 0` after an animated style loses — the
  // orb's own worklet keeps re-writing opacity each frame, so the face peeked
  // through ("another agent below"). Multiplying inside the worklets wins.
  const callHideSV = useSharedValue(0);
  useEffect(() => {
    callHideSV.value = withTiming(callActive ? 1 : 0, { duration: 200 });
  }, [callActive, callHideSV]);

  const heroOrbStyle = useAnimatedStyle(() => {
    const f = collapseFrac.value;
    const ty = f * (HERO_OPEN_ORB_TOP - HERO_CENTER_TOP);
    // Mount "pop in" scale (0 → 1) composes with the collapse scale so
    // the orb starts INVISIBLE on first paint, grows in at centre, and
    // only then begins the cascade to its Home position.
    // The collapsed orb is BIGGER in the processes list (scroll collapse) than
    // in chat, where it matches the X/⋮ buttons. Chat wins when messages exist.
    const collapsedTarget =
      hasChatMessagesSV.value > 0.5 ? HERO_OPEN_ORB_SCALE : HERO_PROCESSES_ORB_SCALE;
    const collapseScale = 1 - f * (1 - collapsedTarget);
    // Profile hand-off: the orb no longer VANISHES — it stays put, shuts its
    // eyes (→ bare black dot, via heroEye*Final) AND shrinks a little, so it
    // reads as ONE receding to a dot as its profile takes over. `pc` is 0 while
    // closed, 1 once the profile is open; the scale eases to PROFILE_ORB_SHRINK.
    const pc = interpolate(profileIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    const profileScale = 1 - pc * (1 - PROFILE_ORB_SHRINK);
    // Global pull: glide DOWN to mid-screen and shrink ~40% toward a bare dot.
    const gp = globalPull.value;
    // Falling asleep: the bare dot glides DOWN to screen centre — the exact
    // splash position (ORB_FROM_CENTER_OFFSET is the rest→centre delta the mount
    // rise uses in reverse). Gated by (1 - f) so it only travels from the RESTING
    // hero, never while collapsed/scrolled into the processes list.
    const sleepDrop = (1 - sleepSV.value) * ORB_FROM_CENTER_OFFSET * (1 - f);
    // As it settles asleep in the centre, the bare black dot swells a touch —
    // ending a bit BIGGER than the resting hero, like the splash dot. Gated by
    // (1 - f) so only the resting hero grows.
    const sleepGrow = 1 + (1 - sleepSV.value) * SLEEP_ORB_GROW * (1 - f);
    return {
      opacity: 1 - callHideSV.value,
      transform: [
        {
          translateY:
            ty +
            heroKeyboardLift.value +
            orbMountY.value +
            chatOpenLiftSV.value +
            gp * PULL_CENTER_DELTA +
            sleepDrop,
        },
        { scale: collapseScale * orbEnterScale.value * (1 - 0.4 * gp) * profileScale * sleepGrow },
      ],
    };
  });

  const heroTextStyle = useAnimatedStyle(() => {
    const f = collapseFrac.value;
    const ty = f * (HERO_OPEN_TEXT_TOP - (HERO_CENTER_TOP + 104));
    return {
      transform: [
        {
          translateY:
            ty +
            heroKeyboardLift.value +
            orbMountY.value +
            chatOpenLiftSV.value,
        },
      ],
    };
  });

  // `chatActiveSV` fires immediately, but we want the broadcast to remain
  // visible (as a static CTA) until the user actually starts composing. Track
  // "should be hidden" on the JS side and animate it onto the worklet via a
  // dedicated shared value.
  const hideBroadcastSV = useSharedValue(0);
  useEffect(() => {
    hideBroadcastSV.value = withTiming(broadcastShouldHide ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [broadcastShouldHide, hideBroadcastSV]);

  const broadcastCrossfadeStyle = useAnimatedStyle(() => {
    // The broadcast line hides for FOUR independent reasons — taken as the
    // min so any one of them can fade it out without disturbing the others
    // (this is the "separately" the orb collapse is kept apart from):
    //   1) the user scrolled the processes list up (scroll fraction)
    //   2) the user opened chat AND started composing (typing/sending)
    //   3) auto: never just from chatActive alone — that keeps the CTA up
    //      while the user looks at the empty chat.
    //   4) the ONE profile sheet rose over it — fades with the sheet slide
    //      and comes back in sync as it's dragged closed.
    const profileHide = interpolate(profileIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: Math.min(
        interpolate(scrollY.value, [0, SNAP_OPEN * 0.5], [1, 0], Extrapolation.CLAMP),
        1 - hideBroadcastSV.value,
        1 - profileHide,
        // 5) pulling DOWN toward Global — the text vanishes EARLY (gone by ~40%
        //    of the sweep) so it's already cleared by the time Global opens.
        1 - interpolate(globalPull.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
        // 6) in a call — the broadcast line goes away with the home face.
        1 - callHideSV.value,
        // 7) ONE fell asleep — the surroundings clear FAST (sleepChromeSV), so
        //    the broadcast line is gone well before the orb finishes its slow
        //    glide down to the centred dot.
        sleepChromeSV.value,
      ),
    };
  });

  const identityCrossfadeStyle = useAnimatedStyle(() => ({
    // Identity row fades in over the SECOND half of collapse — only when
    // not in chat (in chat we show the X+⋮ header instead, so this stays
    // hidden via the multiply by (1 - chatActiveSV)).
    opacity:
      interpolate(collapseFrac.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) *
      (1 - chatActiveSV.value) *
      (1 - globalPull.value) *
      (1 - callHideSV.value),
  }));

  // Chevron hint — deliberately DEAD SIMPLE. No motion, no drift, no idle loop.
  // The two arrows just fade in gently together, hold a moment, and fade out.
  // They reveal on entering Home (after the splash settles) and on ANY touch of
  // the screen — just enough to say "there's more above and below" without ever
  // moving around or hijacking the view.
  const CHEVRON_HOLD_MS = 2000;
  const CHEVRON_PEAK_OPACITY = 0.22;
  // First reveal waits for the splash/intro (dot grows → eyes open → rise →
  // broadcast settles, ~1.8s) so the arrows never flash over the rising face.
  const CHEVRON_INTRO_DELAY_MS = 1900;
  const chevronIdleOpacity = useSharedValue(0);
  const upChevronOpacity = useSharedValue(0);

  // Gentle fade in → hold → fade out, applied to BOTH arrows at once. Pure
  // opacity — nothing moves. (Named `wakeChevron` because several call sites
  // below already reference it.)
  const wakeChevron = useCallback(() => {
    const fade = () =>
      withSequence(
        withTiming(CHEVRON_PEAK_OPACITY, { duration: 450, easing: Easing.out(Easing.cubic) }),
        withDelay(
          CHEVRON_HOLD_MS,
          withTiming(0, { duration: 750, easing: Easing.out(Easing.cubic) }),
        ),
      );
    chevronIdleOpacity.value = fade();
    upChevronOpacity.value = fade();
  }, [chevronIdleOpacity, upChevronOpacity]);

  // Touch-to-reveal — gated so a touch on an overlay (chat/call/sign-in/profile)
  // never lights the arrows up behind it.
  const revealChevrons = useCallback(() => {
    if (chatActive || callActive || signInOpen || profileOpen) return;
    wakeChevron();
  }, [chatActive, callActive, signInOpen, profileOpen, wakeChevron]);

  // ── Idle-sleep. After a long, untouched rest on Home, ONE dozes off. The
  // countdown only runs while Home is truly at rest (no chat / call / sheet);
  // any touch resets it and wakes ONE instantly.
  const IDLE_SLEEP_MS = 45000;
  // ONE only dozes on a truly bare Home — never while a chat, call, OR any
  // overlay sheet is up (a process card, profile, settings, global, +, …).
  const homeAtRest = !chatActive && !callActive && !anySheetOpen;
  const scheduleSleep = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => {
      // If ONE dozed off while scrolled into the processes list, glide back to
      // the Home rest position FIRST, then fall asleep — so it always sleeps as
      // the bare dot at Home, never stranded up in the list. The centre-drop is
      // gated on the scroll fraction, so it engages cleanly once we're back at
      // the top.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setOrbAsleep(true);
    }, IDLE_SLEEP_MS);
  }, []);

  // Any touch on the home surface wakes the chevrons, wakes ONE (and restarts
  // the doze countdown), AND resumes the broadcast if it has gone quiet after
  // its round — "the moment there's action on the screen, ONE speaks again".
  const handleHomeTouch = useCallback(() => {
    revealChevrons();
    if (!chatActive && !callActive && !anySheetOpen) {
      resumeBroadcast();
      setOrbAsleep(false);
      scheduleSleep();
    }
  }, [revealChevrons, resumeBroadcast, chatActive, callActive, anySheetOpen, scheduleSleep]);

  // Start the doze countdown when Home settles at rest; cancel + wake the
  // instant any overlay (chat / call / sheet) takes over.
  useEffect(() => {
    if (!homeAtRest) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      setOrbAsleep(false);
      return;
    }
    scheduleSleep();
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [homeAtRest, scheduleSleep]);

  // The first reveal waits out the splash; later entrances show immediately.
  const didFirstChevronWakeRef = useRef(false);

  useEffect(() => {
    // Any overlay over Home hides the arrows instantly.
    if (chatActive || signInOpen || callActive || profileOpen) {
      chevronIdleOpacity.value = withTiming(0, { duration: 180 });
      upChevronOpacity.value = withTiming(0, { duration: 180 });
      return;
    }
    // Entered Home (fresh mount, or an overlay just closed) — gentle reveal.
    let introTimer: ReturnType<typeof setTimeout> | null = null;
    if (!didFirstChevronWakeRef.current) {
      didFirstChevronWakeRef.current = true;
      introTimer = setTimeout(wakeChevron, CHEVRON_INTRO_DELAY_MS);
    } else {
      wakeChevron();
    }
    return () => {
      if (introTimer) clearTimeout(introTimer);
    };
  }, [chatActive, signInOpen, callActive, profileOpen, chevronIdleOpacity, upChevronOpacity, wakeChevron]);

  const chevronStyle = useAnimatedStyle(() => ({
    opacity:
      chevronIdleOpacity.value *
      interpolate(scrollY.value, [0, SNAP_OPEN * 0.25], [1, 0], Extrapolation.CLAMP),
  }));
  const upChevronStyle = useAnimatedStyle(() => ({
    // Fades out as the user pulls the process list UP (positive scroll) AND as
    // the user pulls DOWN toward Global (globalPull) — it shouldn't linger over
    // the orb folding into a dot.
    opacity:
      upChevronOpacity.value *
      interpolate(scrollY.value, [0, SNAP_OPEN * 0.25], [1, 0], Extrapolation.CLAMP) *
      (1 - globalPull.value),
  }));

  // Cards fade behind the chat overlay when chat is active. Reads as the
  // chat being its own surface rather than an overlay over busy content.
  // When the chat slides off (chatExitProgress → 1) the dim lifts in sync so
  // cards return to full opacity AS the chat leaves, not after a hard cut.
  const cardsBehindChatStyle = useAnimatedStyle(() => ({
    opacity: 1 - chatActiveSV.value * (1 - chatExitProgress.value) * 0.8,
  }));

  // Chat overlay + header close = pure FADE, no slide. The chat leaves by
  // dissolving in place (same for the X button and the pull-down dismiss), so
  // both close paths read identically and there's no off-screen travel.
  const chatExitTranslateStyle = useAnimatedStyle(() => ({
    opacity: 1 - chatExitProgress.value,
  }));

  // Chat header (X + ghost) — fades in with the chat and fades out on close.
  // Pure opacity, no movement.
  const chatHeaderStyle = useAnimatedStyle(() => ({
    opacity: chatActiveSV.value * (1 - chatExitProgress.value),
  }));

  // ── In-call draggable orb. The bubble floats and can be dragged anywhere,
  // WhatsApp-call style, while the rest of the screen stays usable. We track
  // the live translation plus the committed offset so each drag continues
  // from where the last one ended.
  const callOrbX = useSharedValue(0);
  const callOrbY = useSharedValue(0);
  const callOrbStartX = useSharedValue(0);
  const callOrbStartY = useSharedValue(0);
  // Entry "grow": the face scales up from the resting size in PLACE (it sits
  // where the Home agent was), so the call begins with the orb swelling a
  // touch rather than jumping somewhere new.
  const callOrbScale = useSharedValue(0.86);
  // Subtle green ring HUGGING the orb edge — the "you're connected" signal.
  // Barely moves: a very gentle 1 → 1.04 breath so it reads alive, not busy.
  const callRingPulse = useSharedValue(1);
  useEffect(() => {
    if (callActive) {
      callOrbX.value = 0;
      callOrbY.value = 0;
      callOrbScale.value = 0.86;
      callOrbScale.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      callRingPulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      callRingPulse.value = 1;
    }
  }, [callActive, callOrbX, callOrbY, callOrbScale, callRingPulse]);

  // Drag bounds. The orb rests where the Home agent sits (centre matched), and
  // can travel out to any screen corner. `half` is the ring footprint so the
  // glow never clips an edge. Coordinates are relative to the safe-area top.
  const callHalf = (CALL_ORB_SIZE + 20) / 2;
  const callRestY = HERO_CENTER_TOP + HOME_ORB_SIZE / 2;
  const callUsableBottom = SCREEN_H - insets.top - insets.bottom;
  const callSnapX = SCREEN_W / 2 - callHalf - CALL_ORB_EDGE_MARGIN;
  const callMinY = -(callRestY - callHalf - CALL_ORB_EDGE_MARGIN);            // up
  const callMaxY = callUsableBottom - 150 - callHalf - callRestY;            // down (above dock)
  const callOrbGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          callOrbStartX.value = callOrbX.value;
          callOrbStartY.value = callOrbY.value;
        })
        .onUpdate((e) => {
          'worklet';
          // Free movement — follows the finger 1:1, no clamping mid-drag.
          callOrbX.value = callOrbStartX.value + e.translationX;
          callOrbY.value = callOrbStartY.value + e.translationY;
        })
        .onEnd((e) => {
          'worklet';
          const spring = { damping: 18, stiffness: 160, mass: 0.7 };
          const speed = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
          if (speed < 650) {
            // Gentle release → leave it where it is, just clamp on-screen.
            // The drag feels free; it doesn't get yanked to a corner.
            const cx = Math.max(-callSnapX, Math.min(callSnapX, callOrbX.value));
            const cy = Math.max(callMinY, Math.min(callMaxY, callOrbY.value));
            callOrbX.value = withSpring(cx, spring);
            callOrbY.value = withSpring(cy, spring);
          } else {
            // A real throw → fling to the projected corner and snap.
            const projX = callOrbX.value + e.velocityX * 0.05;
            const projY = callOrbY.value + e.velocityY * 0.05;
            const tX = projX >= 0 ? callSnapX : -callSnapX;
            const tY = projY >= (callMinY + callMaxY) / 2 ? callMaxY : callMinY;
            callOrbX.value = withSpring(tX, spring);
            callOrbY.value = withSpring(tY, spring);
          }
        }),
    [callOrbX, callOrbY, callOrbStartX, callOrbStartY, callSnapX, callMinY, callMaxY],
  );
  const callOrbStyle = useAnimatedStyle(() => {
    // Scrolling into the processes list re-centres the orb (drag offset eases
    // back to 0) and glides it UP + a touch smaller, so it docks at the top out
    // of the way. Scroll back down and it returns to where it was.
    const sp = interpolate(scrollY.value, [0, SNAP_OPEN * 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: callOrbX.value * (1 - sp) },
        { translateY: callOrbY.value * (1 - sp) + sp * CALL_TOP_DELTA },
        { scale: callOrbScale.value * (1 - 0.22 * sp) },
      ],
    };
  });
  // Subtle ring hugging the orb — barely breathes.
  const callRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: callRingPulse.value }],
  }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Hidden through the mount cascade (clean, chrome-free intro), then
          fades in as the broadcast + input dock arrive. Bar contents follow
          the theme so the clock stays legible in light AND dark. */}
      <StatusBar
        hidden={statusBarHidden || orbAsleep}
        animated
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {/* Tap the very top (status-bar strip) to REPLAY the opening splash.
          Reaches up into the safe-area inset so the clock row itself is the
          target. Not rendered while chatting / on a call, so it can never fire
          mid-conversation. */}
      {!chatActive && !callActive && (
        <Pressable
          onPress={() => {
            haptic.tap();
            playIntro();
          }}
          style={[styles.splashReplayZone, { top: -insets.top, height: insets.top + 22 }]}
          accessibilityLabel="Replay intro"
        />
      )}
      {/* No KeyboardAvoidingView here. Keyboard avoidance is handled ENTIRELY
          by `inputDockStyle` (input dock, driven off the live keyboard height)
          + `messagesAreaStyle` (messages bottom inset). A KAV with behavior="padding" double-counted
          the lift: it pushed the absolutely-positioned input dock up by the
          keyboard height AND the manual translate lifted it again, leaving a
          tall empty background band between the input and the keyboard top.
          That band visually hid the lower chat and dismissed the keyboard on
          tap (it was just home background catching the touch). One source of
          truth = no gap. */}
      {/* onTouchStart is a PASSIVE listener (it never claims the responder), so
          it gently reveals the up/down arrows on ANY touch without blocking the
          orb tap, scroll, or broadcast gestures underneath. */}
      <View style={styles.flex1} onTouchStart={handleHomeTouch}>
        {/* Single render path — Home and chat-mode are the SAME layout. The
            only differences when chat is active: broadcast lines switch to
            suggestions, and a message overlay appears above the input. */}
        <View style={styles.flex1}>
            <Animated.ScrollView
              ref={scrollRef}
              style={styles.flex1}
              onScroll={scrollHandler}
              // Starting a drag is a touch — gently reveal the arrows.
              onScrollBeginDrag={revealChevrons}
              // Pull DOWN past the top (overscroll bounce) → ONE01 Global.
              // By release the orb has already folded toward a centred dot and
              // the text has faded (see globalPull), so opening Global reads as
              // ONE diving into the world rather than a hard cut.
              onScrollEndDrag={(e) => {
                if (
                  !chatActive &&
                  onOpenGlobal &&
                  e.nativeEvent.contentOffset.y <= -GLOBAL_OPEN_THRESHOLD
                ) {
                  // ONE diving into the world — a firm press marks the crossing.
                  haptic.press();
                  onOpenGlobal();
                }
              }}
              // A light tick each time the list SNAPS between the resting hero
              // and the open processes list (in either direction), so the
              // detent change is felt, not just seen.
              onMomentumScrollEnd={(e) => {
                const open = e.nativeEvent.contentOffset.y > SNAP_OPEN * 0.5;
                if (open !== atProcessesRef.current) {
                  atProcessesRef.current = open;
                  haptic.select();
                }
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              snapToOffsets={[0, SNAP_OPEN]}
              snapToEnd={false}
              decelerationRate="normal"
              // While chat is open the processes list shouldn't scroll —
              // any vertical drag belongs to the chat messages. Locks the
              // underlying cards scroll until the user closes the chat.
              scrollEnabled={!chatActive}
              contentContainerStyle={{
                paddingBottom: INPUT_BAR_H + 12,
              }}
            >
              {/* Hero spacer — the Orb + broadcast are rendered as an overlay
                  ABOVE this; the spacer just reserves the room they occupy
                  inside the scroll content. Doubles as a giant tap target
                  that cycles the broadcast (user request: "tapping anywhere
                  on Home advances the line"). The orb, broadcast text, and
                  cards each capture their own taps before this catches. */}
              <Pressable
                style={{ height: HERO_REST_H }}
                onPress={onBroadcastTap}
                onLongPress={onBroadcastLongPress}
                onPressOut={onBroadcastRelease}
                delayLongPress={450}
                accessibilityLabel="Next broadcast. Hold to answer by voice."
              />

              {/* Cards — real scroll children, but each one is translated by
                  scrollY so they start as a tight stack and SPREAD apart as
                  the user pulls up. Past SNAP_OPEN they're in natural list
                  positions and scroll freely. Fades down when chat is active
                  so the chat reads as its own surface. */}
              <Animated.View style={[styles.cardsList, cardsBehindChatStyle]}>
                {units.length === 0 ? (
                  // Empty-processes state lives HERE — inside the cards
                  // scroll surface, NOT on the resting hero screen. The user
                  // pulls up to where cards would be and finds a quiet,
                  // ONE-voiced line inviting them to start something, rather
                  // than a generic "no items" card. Centered in the surface.
                  <View style={styles.emptyCardsState}>
                    <StackedCardsIcon size={36} color={colors.textSecondary} />
                    <Text style={[styles.emptyCardsLine, { color: colors.textSecondary }]}>
                      {lang === 'he'
                        ? 'עדיין אין כאן תהליכים.\nספרו לי על משהו שתרצו לקדם.'
                        : 'Nothing here yet.\nTell me something you want to move forward.'}
                    </Text>
                  </View>
                ) : (
                  units.map((u, i) => (
                  <StackedCard
                    key={u.id}
                    unit={u}
                    index={i}
                    total={units.length}
                    scrollY={scrollY}
                    onPress={() => {
                      // Onboarding example cards don't open a real unit
                      // sheet (no underlying data). Tapping one nudges
                      // the user toward sign-in instead.
                      if (!hasOnboarded) {
                        onSignIn?.();
                        return;
                      }
                      onTapUnit(u.id);
                    }}
                    onLongPress={
                      hasOnboarded ? () => onLongPressUnit?.(u.id) : undefined
                    }
                    onDelete={() => removeUnit(u.id)}
                    onPin={() =>
                      updateUnit(u.id, {
                        // Pin lifts attention by marking an unread update;
                        // a real pin flag can land later.
                        unreadUpdates: (u.unreadUpdates ?? 0) + 1,
                      })
                    }
                    onShare={() => {
                      // Open the OS share sheet with a short, human summary
                      // of the process. Best-effort: a thrown share (user
                      // cancels, or no share UI on the platform) is swallowed
                      // so a cancel never surfaces as an error.
                      const summary = [
                        `${u.emoji} ${u.title}`,
                        u.latestBroadcastText?.[0] ?? '',
                        lang === 'he' ? '\nנשלח מ-ONE' : '\nShared from ONE',
                      ]
                        .filter(Boolean)
                        .join('\n');
                      Share.share({ message: summary }).catch(() => {});
                    }}
                    // Onboarding cards are illustrative; the pin/share/delete
                    // actions don't apply. Disable the swipe gesture so the
                    // user gets a clean tap-only interaction.
                    swipeDisabled={!hasOnboarded}
                  />
                  ))
                )}
              </Animated.View>
            </Animated.ScrollView>

            {/* EdgeBars sit ABOVE the scroll content + bubbles (zIndex 15)
                but BELOW the orb / broadcast / chat header / input dock
                (zIndex 20-30). Cards and chat bubbles fade behind these
                gradients at the top + bottom edges; the interactive
                surfaces stay crisp on top.

                BOTH bars are hidden during chat. Their job is to fade
                cards into the page background; when chat is open, cards
                are already dimmed behind the chat overlay so the bars
                have nothing to fade into and only end up masking the
                bubbles (top bar covers first bubbles; bottom bar covered
                the lower ones until we hid it). Returning to home brings
                them back. */}
            <EdgeBars top={!chatActive} bottom={!chatActive} />

            {/* ── Fused hero: ONE element that flies to the top.
                Orb (animated container) and text area (animated container)
                animate independently so the text doesn't get awkwardly
                squashed by the Orb's scale. Cross-fade inside the text area
                turns the broadcast into "Ariel ⌄" as the Orb arrives at the
                top of the screen. */}
            {/* AnimatedPressable IS the transformed container — the touch
                handler lives directly on the surface that moves with the
                scroll, so iOS hit-testing is reliable. The inner Animated.View
                only does breath + tap-grow scale. */}
            {/* Global "up" chevron — hints "pull DOWN for ONE01 Global". Lives
                at the very top; same brief reveal + idle reminder as the
                bottom chevron. Hidden in chat / call / sign-in. */}
            {onOpenGlobal && !chatActive && !callActive && !signInOpen && (
              <Animated.View
                // box-none: only the centred arrow Pressable captures taps; the
                // rest of the full-width strip passes touches through.
                pointerEvents="box-none"
                // Exact mirror of the bottom chevron: same size (26), same icon
                // flipped 180° (points up), positioned symmetric ABOVE the orb
                // by the same ~161px the bottom one sits below its centre.
                style={[styles.globalChevron, { top: HERO_CENTER_TOP - 132 }, upChevronStyle]}
              >
                {/* Tap the up arrow → ONE01 Global (same destination as the
                    pull-down gesture). */}
                <Pressable
                  onPress={() => { haptic.press(); onOpenGlobal(); }}
                  hitSlop={18}
                  accessibilityRole="button"
                  accessibilityLabel="Open ONE01 Global"
                  style={styles.flipUp}
                >
                  <ArrowDownIcon size={26} color={colors.textSecondary} />
                </Pressable>
              </Animated.View>
            )}

            <AnimatedPressable
              onPress={() => onTapOrb && onTapOrb()}
              onLongPress={() => { haptic.press(); onLongPressOrb && onLongPressOrb(); }}
              onPressIn={() => {
                orbTapScale.value = withSpring(1.08, { damping: 7, stiffness: 260 });
                wakeChevron();
              }}
              onPressOut={() => {
                orbTapScale.value = withSpring(1, { damping: 10, stiffness: 220 });
              }}
              delayLongPress={450}
              hitSlop={24}
              pointerEvents={callActive ? 'none' : 'auto'}
              style={[
                styles.heroOrb,
                { top: HERO_CENTER_TOP },
                styles.orbHit,
                heroOrbStyle,
                // During a call the live draggable orb takes over — hide the
                // resting hero so there's only ONE face on screen.
                callActive && styles.hiddenDuringCall,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open ONE profile. Long press for identity switch."
            >
              {/* In ghost mode the face becomes a hollow outline AND fades to a
                  low opacity (orbGhostDimStyle) — present but faint, temporary. */}
              <Animated.View style={[orbBreathStyle, orbGhostDimStyle]}>
                <Orb
                  size={HOME_ORB_SIZE}
                  eyeLookY={eyeLookY}
                  eyesOpacityAnim={heroEyesOpacityFinal}
                  eyeOpen={heroEyeOpenFinal}
                  outline={ghostMode}
                  noShadow
                />
              </Animated.View>
            </AnimatedPressable>

            <Animated.View
              // Pushed clear of the Orb's hit-slop region (orb=72 + hitSlop=20)
              // so a tap intended for the face never lands on the broadcast's
              // GestureDetector below. `elementsMountStyle` makes broadcast +
              // chevron slide up from offscreen-below after the Orb settles.
              style={[
                styles.heroText,
                { top: HERO_CENTER_TOP + 104 },
                heroTextStyle,
                elementsMountStyle,
                // During a call the broadcast + identity vanish — the live call
                // orb is the only face/voice on screen, so nothing reads double.
                callActive && styles.hiddenDuringCall,
              ]}
              pointerEvents={callActive ? 'none' : 'box-none'}
            >
              {/* Layer A: broadcast (visible at rest, fades out as user pulls) */}
              <Animated.View
                style={[styles.heroTextLayer, broadcastCrossfadeStyle]}
                pointerEvents="box-none"
              >
                <GestureDetector gesture={broadcastGesture}>
                  <Animated.View style={broadcastLineStyle}>
                    {/* In ghost mode the broadcast text dims with the orb (same
                        animated value). Nested opacity compounds with the
                        line-crossfade above, so the rotation still fades cleanly. */}
                    <Animated.View style={orbGhostStyle}>
                      <Text
                        style={[styles.broadcast, { color: colors.text }]}
                        numberOfLines={2}
                        accessibilityRole="button"
                        accessibilityLabel={`${chatActive ? 'Prompt' : 'Broadcast'}: ${displayedBroadcast}. Tap or swipe to navigate.`}
                      >
                        {displayedBroadcast}
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
                {units.length > 0 && !chatActive && (
                  <Animated.View
                    pointerEvents="box-none"
                    style={[styles.chevronWrap, chevronStyle]}
                  >
                    {/* Tap the down arrow → open the processes list (snap the
                        cards up into view). */}
                    <Pressable
                      onPress={() => {
                        haptic.tap();
                        revealChevrons();
                        scrollRef.current?.scrollTo({ y: SNAP_OPEN, animated: true });
                      }}
                      hitSlop={18}
                      accessibilityRole="button"
                      accessibilityLabel="Show processes"
                    >
                      <ArrowDownIcon size={26} color={colors.textSecondary} />
                    </Pressable>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Layer A2 (above broadcast): tiny grey status caption shown
                  during a chat turn. Per the latest mockup: "חושב…" /
                  "Thinking…" sits directly beneath the small Orb while ONE is
                  generating a reply. Hidden when no active turn. */}
              {sessionMessages.length > 0 && chatStatus && (
                <View style={styles.statusCaptionWrap} pointerEvents="none">
                  <Text
                    style={[styles.statusCaption, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {chatStatus}
                  </Text>
                </View>
              )}

              {/* Layer B: identity row (fades in as user pulls). When there
                  are multiple identities the row is a Pressable that opens
                  the identity switcher; with a single identity the chevron
                  is omitted and the row is rendered as a plain View so the
                  user can't tap into a dead affordance. */}
              <AnimatedPressable
                onPress={showIdentityChevron ? () => onTapHeader && onTapHeader() : undefined}
                onLongPress={() => { haptic.press(); onLongPressOrb && onLongPressOrb(); }}
                delayLongPress={450}
                hitSlop={16}
                style={[styles.heroTextLayer, styles.identityRow, identityCrossfadeStyle]}
                accessibilityRole={showIdentityChevron ? 'button' : 'text'}
                accessibilityLabel={
                  showIdentityChevron
                    ? `${displayedIdentityName} — tap to switch`
                    : displayedIdentityName
                }
              >
                <Text
                  style={[styles.identityName, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayedIdentityName}
                </Text>
                {showIdentityChevron && (
                  <ArrowDownIcon size={14} color={colors.textSecondary} />
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* Chat header — X (close) on one side, ghost-mode toggle opposite.
                Appears as soon as the chat opens (keyboard up), not only after
                the first message. */}
            {chatActive && (
              <Animated.View
                pointerEvents="box-none"
                // Hebrew: X left / ghost right. English: X right / ghost left.
                // The row order is [X, ghost]; `direction` flips which edge each
                // lands on, per language (he → ltr, en → rtl).
                style={[
                  styles.chatHeader,
                  { direction: lang === 'he' ? 'ltr' : 'rtl' },
                  chatHeaderStyle,
                ]}
              >
                {/* Close = the same brand "+" as the input bar, rotated 45° so
                    it reads as an ×. Sits quietly at low opacity, like the
                    chevron arrows. */}
                <Pressable
                  onPress={dismissChatAnimated}
                  hitSlop={14}
                  style={[styles.chatHeaderBtn, { opacity: 0.35 }]}
                  accessibilityLabel="Close conversation"
                >
                  <View style={styles.closeAsPlus}>
                    <PlusThinIcon size={26} color={colors.text} />
                  </View>
                </Pressable>
                {/* Ghost matches that low opacity when OFF, and goes to FULL
                    opacity when ON — the opacity itself signals the state. */}
                <Pressable
                  onPress={() => { haptic.select(); setGhostMode((g) => !g); }}
                  hitSlop={14}
                  style={[styles.chatHeaderBtn, { opacity: ghostMode ? 1 : 0.35 }]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: ghostMode }}
                  accessibilityLabel={ghostMode ? 'Ghost mode on' : 'Ghost mode off'}
                >
                  <GhostModeIcon size={26} color={colors.text} />
                </Pressable>
              </Animated.View>
            )}

            {/* Message overlay — only renders once the user has actually
                sent something. Floats above the cards / hero spacer, sits
                above the input bar. Travels up with the keyboard so bubbles
                never hide under it. */}
            {chatActive && sessionMessages.length > 0 && (
              <Animated.View
                pointerEvents="box-none"
                style={[styles.messagesOverlay, messagesAreaStyle, chatExitTranslateStyle]}
              >
                <ScrollView
                  ref={chatScrollRef}
                  style={styles.flex1}
                  contentContainerStyle={styles.messagesContent}
                  keyboardShouldPersistTaps="handled"
                  // Drag the message list down to dismiss the keyboard
                  // without losing chat context (taps in the input area
                  // re-open it).
                  keyboardDismissMode="on-drag"
                  onScrollEndDrag={(e) => {
                    if (e.nativeEvent.contentOffset.y < -80) dismissChatAnimated();
                  }}
                >
                  {sessionMessages.map((m, idx) => {
                    // Show timestamp under the LAST message in a run of
                    // close-in-time messages from the same speaker. Keeps the
                    // chat from looking like a stamp soup.
                    const next = sessionMessages[idx + 1];
                    const showStamp =
                      !next ||
                      next.from !== m.from ||
                      next.ts - m.ts > 5 * 60 * 1000;
                    // ONE messages render FLAT on the page (no bubble) —
                    // like ChatGPT / Claude. Selectable so the user can
                    // copy fragments. User messages keep their bubble so
                    // the conversation still reads as a back-and-forth.
                    if (m.from === 'one') {
                      return (
                        <View key={m.id} style={styles.oneFlatWrap}>
                          <Text
                            selectable
                            style={[styles.oneFlatText, { color: colors.text }]}
                          >
                            {m.text}
                          </Text>
                          {showStamp && (
                            <Text
                              style={[
                                styles.bubbleStamp,
                                styles.bubbleStampOne,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {formatBubbleTime(m.ts)}
                            </Text>
                          )}
                        </View>
                      );
                    }
                    return (
                      <View key={m.id} style={styles.bubbleWrap}>
                        <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
                          <View
                            style={[
                              styles.bubble,
                              styles.userBubble,
                              { backgroundColor: colors.circle },
                            ]}
                          >
                            <Text
                              selectable
                              style={[styles.bubbleText, { color: colors.circleEye }]}
                            >
                              {m.text}
                            </Text>
                          </View>
                        </View>
                        {showStamp && (
                          <Text
                            style={[
                              styles.bubbleStamp,
                              styles.bubbleStampUser,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {formatBubbleTime(m.ts)}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                  {chatTyping && (
                    <View style={[styles.bubbleRow, styles.bubbleRowOne]}>
                      <View style={[styles.bubbleAvatar, { backgroundColor: colors.circle }]} />
                      <TypingIndicator />
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            )}

            {/* In-call floating orb. It sits exactly where the Home agent was
                (just a touch larger) wrapped in a softly-pulsing GREEN RING —
                the "live" signal. Drag it freely; a real throw flings it to a
                corner and snaps. Only intercepts touches on the orb itself so
                the rest of the screen stays scrollable. */}
            {callActive && (
              <View pointerEvents="box-none" style={styles.callLayer}>
                <GestureDetector gesture={callOrbGesture}>
                  <Animated.View style={[styles.callOrbWrap, callOrbStyle]}>
                    <Orb size={CALL_ORB_SIZE} noShadow />
                    {/* Subtle green ring hugging the orb's edge — the "live"
                        signal. Barely breathes (callRingStyle). */}
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.callRing, callRingStyle]}
                    />
                  </Animated.View>
                </GestureDetector>
              </View>
            )}
          </View>

        {/* Due reminders — ONE surfacing what it promised to remind you of,
            the moment it's due. Sits just above the input at rest; hidden
            during chat / call. Tap a row to open the process; tap ✓ to
            dismiss it. */}
        {dueReminders.length > 0 && !chatActive && !callActive && (
          <View pointerEvents="box-none" style={styles.dueWrap}>
            <View style={[styles.dueCard, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
              <Text style={[styles.dueHeader, { color: colors.textSecondary }, lang === 'he' && styles.textRTLRight]}>
                {lang === 'he' ? '⏰ הגיע הזמן' : '⏰ Due now'}
              </Text>
              {dueReminders.map(({ unit: u, reminder: r }) => (
                <View key={r.id} style={[styles.dueRow, lang === 'he' && styles.rowReverse]}>
                  <Pressable
                    onPress={() => onTapUnit(u.id)}
                    style={[styles.dueRowMain, lang === 'he' && styles.rowReverse]}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.text} — ${u.title}`}
                  >
                    <Text style={styles.dueEmoji}>{u.emoji}</Text>
                    <View style={styles.flex1}>
                      <Text
                        style={[styles.dueText, { color: colors.text }, lang === 'he' && styles.textRTLRight]}
                        numberOfLines={1}
                      >
                        {r.text}
                      </Text>
                      <Text
                        style={[styles.dueSub, { color: colors.textSecondary }, lang === 'he' && styles.textRTLRight]}
                        numberOfLines={1}
                      >
                        {u.title} · {formatDueRelative(r.dueAt, nowTick, lang === 'he')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      haptic.success();
                      updateUnit(u.id, {
                        reminders: (u.reminders ?? []).map((x) =>
                          x.id === r.id ? { ...x, done: true } : x,
                        ),
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    style={[styles.dueCheck, { borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={lang === 'he' ? 'סמן כבוצע' : 'Mark done'}
                  >
                    <Text style={[styles.dueCheckMark, { color: colors.textSecondary }]}>✓</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Input bar — same instance whether or not chat is active. Tapping
            it focuses the TextInput which opens the keyboard, and `onFocus`
            flips chatActive on. Manual translateY lift keeps it above the
            keyboard reliably (KAV.padding was inconsistent). */}
        <Animated.View
          style={[styles.inputDock, inputDockStyle, inputMountStyle]}
          // While ONE sleeps the dock is faded away; let the first tap fall
          // through to the passive wake handler instead of focusing the input,
          // so a tap simply wakes ONE (like the splash) rather than opening chat.
          pointerEvents={orbAsleep ? 'none' : 'auto'}
        >
          {callActive ? (
            // During a call the dock keeps the EXACT home shape — same capsule,
            // + inside on the left — with speaker / mute / camera toggles in the
            // middle and a red hang-up (✕) on the right. Bigger buttons + more
            // spacing than before; mute glows RED when engaged, speaker/camera
            // fill dark with a white glyph when on.
            <InputBar
              value=""
              onChangeText={() => {}}
              callMode
              onEndCall={endCall}
              onPressPlus={onCreateProcess}
              // Keep focusSignal STABLE across the call ↔ normal switch (this is
              // the same reconciled InputBar instance). Without it, ending a
              // call flips focusSignal undefined → chatReturnFocus and re-fires
              // the focus effect, popping the keyboard even though we were never
              // in chat. In call mode there's no TextInput, so this is a no-op
              // here; it just prevents the spurious re-trigger on the way out.
              focusSignal={chatReturnFocus}
              callControls={
                <>
                  {/* State is unmistakable in BOTH themes:
                      • ON  → high-contrast LIT fill (colors.text) + a contrasting
                              glyph (colors.surface), full opacity.
                      • MUTED → red fill + white glyph.
                      • OFF → subtle tint + a DIMMED glyph. */}
                  <Pressable
                    onPress={() => { haptic.select(); setSpeakerOn((v) => !v); }}
                    style={[
                      styles.callCtrlBtn,
                      { backgroundColor: speakerOn ? colors.text : colors.callCtrlRest },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: speakerOn }}
                    accessibilityLabel="Speaker"
                  >
                    <View style={{ opacity: speakerOn ? 1 : 0.45 }}>
                      <SpeakerIcon size={26} color={speakerOn ? colors.surface : colors.text} />
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => { haptic.select(); setMuted((v) => !v); }}
                    style={[
                      styles.callCtrlBtn,
                      { backgroundColor: muted ? '#EF4444' : colors.callCtrlRest },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: muted }}
                    accessibilityLabel="Mute"
                  >
                    <View style={{ opacity: muted ? 1 : 0.45 }}>
                      {muted ? (
                        <MicOffIcon size={26} color="#FFFFFF" />
                      ) : (
                        <MicIcon size={26} color={colors.text} />
                      )}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => { haptic.select(); setCameraOn((v) => !v); }}
                    style={[
                      styles.callCtrlBtn,
                      { backgroundColor: cameraOn ? colors.text : colors.callCtrlRest },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: cameraOn }}
                    accessibilityLabel="Camera"
                  >
                    <View style={{ opacity: cameraOn ? 1 : 0.45 }}>
                      <CameraIcon size={26} color={cameraOn ? colors.surface : colors.text} />
                    </View>
                  </Pressable>
                </>
              }
            />
          ) : (
            <>
              <InputBar
                value={chatText}
                onChangeText={setChatText}
                placeholder={
                  // When the keyboard is open (chat active), drop the
                  // placeholder entirely — the CTA already shows ABOVE the input
                  // as the broadcast text, so repeating it inside the field is
                  // redundant noise. Empty placeholder = just a blinking cursor,
                  // matching the latest mockup.
                  chatActive ? '' : t('home_input_placeholder_rest')
                }
                onSubmit={handleSendChat}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onPressPlus={() => {
                  // Keep the chat alive across the + → Quick Actions hop. The
                  // InputBar dismisses the keyboard first; without this the
                  // blur drops `inputFocused` and an empty chat collapses back
                  // to the home rest state (losing typed text + hero position).
                  if (chatActive) setChatHeldOpen(true);
                  // Remember whether the keyboard was up so we can bring it
                  // back when Quick Actions closes.
                  wantKeyboardBackRef.current = inputFocused;
                  onCreateProcess?.();
                }}
                // Re-focus + reopen the keyboard when we return from Quick
                // Actions (only if it was open when + was pressed). Short delay
                // — the sheet has already closed, so don't make the user wait.
                focusSignal={chatReturnFocus}
                focusDelay={80}
                onPressVoice={handleSendChat}
                // Empty-tap on the mic starts a call; hold records.
                onStartCall={startCall}
                onRecordStart={startRecording}
                onRecordEnd={stopRecording}
                recording={recording}
                // Keyboard closed → + lives inside the capsule.
                // Keyboard open (chat active) → + lifts OUT as its own pill.
                compact={chatActive}
              />
              {/* Sign-in CTA. Shown only when the user hasn't completed
                  onboarding / signed in. Sits as a small row directly under
                  the capsule — discreet but always reachable. Reads as a
                  prompt + link, not a bare command: "Already have ONE?
                  Sign in." Hidden while chat is active (the keyboard would
                  hide the row anyway). */}
              {!hasOnboarded && !chatActive && onSignIn && (
                <View style={styles.signInRow}>
                  <Text style={[styles.signInPrompt, { color: colors.textSecondary }]}>
                    {lang === 'he' ? 'כבר יש לך ONE?' : 'Already have ONE?'}
                  </Text>
                  <Pressable
                    onPress={onSignIn}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={lang === 'he' ? 'התחברות' : 'Sign in'}
                  >
                    <Text style={[styles.signInLink, { color: colors.text }]}>
                      {lang === 'he' ? 'התחבר' : 'Sign in'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Invisible tap target over the status-bar strip — tap to replay the splash.
  splashReplayZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
  },
  flex1: { flex: 1 },

  // ── Chat header (X + ⋮) — only shown once chatMessages.length > 0.
  chatHeader: {
    position: 'absolute',
    top: 12,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // `direction` is set inline per language (he → ltr → X left/ghost right;
    // en → rtl → X right/ghost left).
    // Above EdgeBars (15) so the close + menu buttons don't get washed
    // out by the top gradient.
    zIndex: 25,
  },
  // X + ghost read as BARE icons — like the home chevron arrows: no circle
  // background, no shadow, no opacity chrome. The hit area is kept generous;
  // active/inactive is shown by icon COLOUR, not a filled pill.
  chatHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The "+" glyph rotated 45° so it reads as an × — same brand mark as the
  // input bar's plus, just turned.
  closeAsPlus: {
    transform: [{ rotate: '45deg' }],
  },
  // Call-mode toggle buttons (speaker / mute / camera) inside the dock capsule.
  // Bigger + more breathing room than before; the background fill conveys state
  // (dark = on, red = muted, tint = off).
  callCtrlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Chat message overlay — fills the chat area from just under the
  // chat header down to just above the input. Top pulled up so the chat
  // surface spreads further on the screen (user said the chat wasn't
  // filling enough space). Small orb sits at y=28-76 horizontally centred;
  // bubbles render with maxWidth 82% on left/right so the visual overlap
  // with the centred orb is minimal.
  messagesOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    // bottom is set inline so it can be lifted above the input dock.
    // Bumped down so the first message clears the open-state orb (top
    // ~18, size 52) + the identity row beneath it. Previously messages
    // started at y=80, exactly where the heroText container sits — the
    // hero's container (zIndex 20) ended up rendering ABOVE the messages
    // (zIndex 5) and intercepting layout space even with its broadcast
    // crossfaded to opacity 0, which is why the chat read as blank.
    top: 110,
    // ABOVE the hero text container (zIndex 20) and EdgeBars (15) so the
    // chat reads above whatever sits in the bar zone. The orb / X / ⋮
    // stay above this at their own higher zIndex.
    zIndex: 25,
  },
  messagesContent: {
    // Bubbles anchored to the TOP of the chat area at all times. New
    // messages append below; the auto-scroll-to-end was removed so the
    // chat doesn't jump to the bottom when the keyboard opens and shrinks
    // the viewport.
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  // Wraps a bubble + (optionally) its trailing timestamp so the gap between
  // messages stays tight and the stamp travels with the bubble it belongs to.
  bubbleWrap: { gap: 2 },
  // Row wrapping ONE's avatar dot + bubble. User messages get no avatar
  // (their "voice" is in the message position, right-aligned).
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleRowOne: { justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginBottom: 4,
    opacity: 0.85,
  },
  bubbleStamp: {
    fontSize: 11,
    opacity: 0.7,
    paddingHorizontal: 4,
  },
  bubbleStampOne: { alignSelf: 'flex-start', paddingLeft: 28 },
  bubbleStampUser: { alignSelf: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  oneBubble: { borderTopLeftRadius: 6 },
  userBubble: { borderTopRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  /**
   * Flat ONE message — no bubble, no background. Reads like a
   * ChatGPT/Claude assistant reply rendered directly on the page.
   * Slightly bigger line-height than the user bubble for readability
   * over multi-line content.
   */
  oneFlatWrap: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  oneFlatText: {
    fontSize: 16,
    lineHeight: 24,
  },

  // Fused-hero layout: Orb container + text container, both absolute and
  // animated by scrollY. No separate top header — the hero IS the header.
  heroOrb: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // Above heroText so its tap area always wins on iOS and Android.
    zIndex: 50,
    elevation: 8,
  },
  heroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    // Above EdgeBars (15) so the broadcast text + identity row never get
    // washed out by the top gradient.
    zIndex: 20,
    // The two crossfade layers stack inside; let the container's natural
    // height adapt to the broadcast (taller) at rest.
    minHeight: 80,
  },
  heroTextLayer: {
    // Stack the two crossfade layers on top of one another so the
    // identity row replaces the broadcast in-place.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '600',
  },
  broadcast: {
    // Bumped 20 → 22 to balance against the bigger 88-px Orb. Reserved
    // two-line height grows proportionally.
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 330,
    // Reserve two-line height so the face above and chevron below don't
    // jump when the line length changes (1 line vs 2 lines).
    height: 60,
    textAlignVertical: 'center',
  },

  // ── ONE01 Global "up" chevron (top) ─────────────────────────────────────
  globalChevron: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 24,
  },
  flipUp: { transform: [{ rotate: '180deg' }] },

  // ── Call mode ──────────────────────────────────────────────────────────
  // Resting hero hides while the live call orb takes over.
  hiddenDuringCall: { opacity: 0 },
  // Full-bleed layer that only captures touches on the orb itself (box-none),
  // so the user can still scroll / navigate behind the call.
  callLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    // The call face sits EXACTLY where the resting Home agent is (centre
    // matched), so starting a call reads as the same face waking into a call,
    // not a new orb appearing at the top.
    paddingTop: CALL_ORB_TOP,
    zIndex: 60,
  },
  // Fixed square so the green ring can pulse around the centred face.
  callOrbWrap: {
    width: CALL_ORB_SIZE + 20,
    height: CALL_ORB_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Live-call green ring — hugs the orb's edge (the wrap is CALL_ORB_SIZE + 20,
  // orb centred, so a 10px inset puts the ring exactly on the orb's rim). Subtle
  // soft glow, barely breathes.
  callRing: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: '#22C55E',
    // NO green glow (shadow) here. A soft shadow is rasterised to a bitmap and
    // the OS stretches that bitmap as the ring is dragged / pulses in call mode
    // — which reads as a pixelated green halo. The crisp vector border alone is
    // the "live" signal; the border re-draws each frame so it stays sharp in
    // motion.
  },
  // Tiny "Thinking…" / "Updating…" caption shown under the small Orb during
  // a chat turn. Sits in the same horizontal slot as the broadcast text so
  // both never appear simultaneously (broadcast already hidden in chat-active
  // with messages).
  statusCaptionWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 6,
  },
  statusCaption: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  chevron: {
    // Legacy — replaced by chevronWrap below. Left for any straggler refs.
    marginTop: 26,
  },
  chevronWrap: {
    // Pull-up hint sits LOW — well below the broadcast so it reads as a
    // bottom-of-screen affordance, clearly apart from the message. (Layer A is
    // absolute, so this margin doesn't push the identity row.) Pure fade in/out.
    marginTop: 120,
    alignItems: 'center',
  },
  suggestionsCaption: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  // ── Empty-processes state — rendered INSIDE the cards scroll surface (not
  // on the resting hero). Fills the same minHeight the card list reserves so
  // it lands centered when the user pulls the surface up.
  emptyCardsState: {
    minHeight: SNAP_OPEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyCardsLine: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.85,
  },
  cardsList: {
    paddingHorizontal: 14,
    gap: 10,
    // Clearance below the collapsed header (small Orb + identity name) so the
    // first card doesn't crowd the name or tuck under the top edge at the open
    // snap. The first card lands ~(SCREEN_H - SNAP_OPEN + paddingTop) down.
    paddingTop: 24,
    // Extra breathing room so the last card doesn't touch the input bar.
    paddingBottom: 18,
    // CRITICAL: with only 2-3 cards the natural list height is shorter than
    // SNAP_OPEN, so the user CANNOT scroll the ScrollView far enough to
    // trigger the spread animation — the deck stays glued together. Force
    // a minimum height equal to the snap distance so the scroll target is
    // always reachable regardless of how many cards exist.
    minHeight: SNAP_OPEN,
  },
  orbHit: {
    // Natural-size Pressable wrapping the 72 px Orb — `hitSlop={24}` on the
    // Pressable extends the touch area to ~120 px while keeping the layout
    // box at 72 px so it never overlaps with the broadcast area below.
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // The Pressable spans full width (it inherits heroTextLayer's left:0,
    // right:0). Without justifyContent the name+chevron stack hugs the left.
    // Centre them so the row sits directly below the agent face.
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signInRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    // Generous gap above the row so the input capsule visibly rises off
    // the screen edge during onboarding. The row itself sits with a
    // smaller bottom padding so it still clears the home indicator.
    marginTop: 22,
    paddingBottom: 14,
  },
  signInPrompt: {
    fontSize: 13,
    fontWeight: '400',
  },
  signInLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputDock: {
    position: 'absolute',
    // Flush against the safe-area bottom — sits as low as we can go without
    // overlapping the home indicator. When the keyboard opens, inputDockStyle
    // slides it up by the LIVE keyboard height (useAnimatedKeyboard), so it
    // rides the keyboard top with a small KB_GAP.
    bottom: 0,
    left: 0,
    right: 0,
    // Above EdgeBars (15) so the input capsule + floating + button never
    // get masked by the bottom gradient as cards/bubbles scroll behind.
    zIndex: 30,
  },

  // ── Due-reminders strip (sits just above the input at rest). ────────────
  dueWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: INPUT_BAR_H + 20,
    zIndex: 22,
  },
  dueCard: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  dueHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dueRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dueEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  dueText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  dueSub: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  dueCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueCheckMark: { fontSize: 15, fontWeight: '700' },
  rowReverse: { flexDirection: 'row-reverse' },
  textRTLRight: { textAlign: 'right', writingDirection: 'rtl' },
});
