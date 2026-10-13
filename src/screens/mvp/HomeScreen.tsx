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
  AppState,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedReaction,
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
  FadeIn,
  FadeInDown,
  type SharedValue,
} from 'react-native-reanimated';

// Pressable wrapped to accept Reanimated styles. Lets the Pressable itself be
// the transformed container so iOS hit-testing happens on the actual touch
// surface (Pressable inside a transformed Animated.View was unreliable).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Orb } from '../../components/mvp/Orb';
import { UnitCard } from '../../components/mvp/UnitCard';
import { InputBar } from '../../components/mvp/InputBar';
import { ArrowDownIcon, PlusThinIcon, StackedCardsIcon, GhostModeIcon, MicIcon, MicOffIcon, CameraIcon, SpeakerIcon, PersonIcon, BriefcaseIcon, HouseIcon, PlusIcon, CloseIcon } from '../../components/mvp/icons';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { useThemeStore } from '../../stores/themeStore';
import { useT, useLanguage } from '../../i18n/useT';
import { localizedGreeting, translate } from '../../i18n/strings';
import { useActiveIdentity, useActiveUnits, useMvpStore, disclosureForIdentity, type ChatWidget } from '../../stores/mvpStore';
import { ChatProcessCard } from '../../components/mvp/ChatProcessCard';
import { ChatQuizCard } from '../../components/mvp/ChatQuizCard';
import { ChatBookingCard } from '../../components/mvp/ChatBookingCard';
import { ChatFormCard } from '../../components/mvp/ChatFormCard';
import { quizForText, buildQuizRun } from '../../data/mvp/quizBank';
import { bookingForText, buildBookingRun } from '../../data/mvp/booking';
import { formForText, buildFormRun } from '../../data/mvp/forms';
import { toolEnabled } from '../../data/mvp/tools';
import { ONBOARDING_EXAMPLE_UNITS } from '../../data/mvp/onboardingExamples';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { generateOneReply } from '../../utils/mvpChatReply';
import { extractRememberFact } from '../../utils/rememberIntent';
import { rtlText, rtlRow } from '../../utils/rtl';
import { sortByAttention } from '../../core/mvp/attentionScore';
import { haptic } from '../../utils/haptics';
import { desireToUnit } from '../../utils/mvpInferUnit';
import { invokeOneIntent, invokeAttentionLines } from '../../services/aiChat';
import { openDisclosureStrings } from '../../data/mvp/disclosure';
import { oneHomeMessages } from '../../utils/oneOpener';
import { unitFromIntent, findSimilarUnit, buildProcessOpener } from '../../utils/intentToUnit';
import { matchMetricIndex, completeStepsFromUpdates } from '../../utils/metricMatch';
import { localOneIntent, cleanProcessTitle, metricQuestion } from '../../utils/localIntent';
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
import { enrichUnitFromArchetype, generateRichUnit, detectArchetypeStrict } from '../../data/mvp/unitArchetype';

const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;

// The up/down hint chevrons sit SYMMETRICALLY about the screen's vertical
// centre — the top one this far above centre, the bottom one the same distance
// below — so they read as one matched pair framing the figure + composer.
const CHEVRON_CENTER_GAP = Math.round(SCREEN_H * 0.34);

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
const SNAP_OPEN = SCREEN_H - TITLE_BAR_H - 12;  // pull this far for full open
/** Resting agent face on Home. Splash dot uses the same value so the
 *  hand-off is seamless (splash dot grows to this size and lands here).
 *  Nudged up a touch (84 → 92) — the resting face carries a bit more presence
 *  as the home's focal point, still calm against the broadcast text. */
const HOME_ORB_SIZE = 100;
/** Vertical position of the resting hero. Sits ABOVE screen center so the
 *  broadcast text reads in the upper third — leaves room for the input dock
 *  and feels less crowded against the bottom bar. */
const HERO_CENTER_TOP = Math.round(SCREEN_H * 0.085);

/** Home → Global transition. Pulling DOWN past the top (negative overscroll)
 *  scrubs this 0→1: ONE slides back to screen-centre, CLOSES its eyes (so only
 *  the bare dot is left) and the broadcast/identity text fades out — a visible
 *  "ONE folds into a dot and dives into the world" hand-off into ONE01 Global.
 *  GLOBAL_PULL_RANGE is the overscroll distance (px) for a full 0→1 sweep;
 *  GLOBAL_OPEN_THRESHOLD (released-at offset) is where Global actually opens. */
// Opening Global takes a DELIBERATE, STRONG pull — a long overscroll with a
// far release point — so light back-scrolling (reading earlier chat) never
// trips it by accident.
const GLOBAL_PULL_RANGE = 170;
const GLOBAL_OPEN_THRESHOLD = 125;
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
// The call orb sits EXACTLY where the home orb is (centre matched), just a
// touch bigger + a live ring — so home → call is a seamless transition, not a
// jump. paddingTop of the (CALL_ORB_SIZE + 20)-tall wrap that centres it there.
const CALL_ORB_TOP = HERO_CENTER_TOP + HOME_ORB_SIZE / 2 - (CALL_ORB_SIZE + 20) / 2;
const CALL_ORB_EDGE_MARGIN = 18;    // gap from the screen edge at a corner
// When the user scrolls into the processes list DURING a call, the orb glides
// UP toward the top (re-centred + smaller) so it never sits over the cards.
// This is how far up it travels from its resting centre.
const CALL_TOP_DELTA = -(CALL_ORB_TOP - 14);

/**
 * Convert 1–999 to a Hebrew-numeral (gematria) string with geresh/gershayim —
 * e.g. 13 → "י״ג", 787 → "תשפ״ז", 5 → "ה׳". We do this by hand because the
 * device's ICU renders the Hebrew CALENDAR but NOT the Hebrew numbering system
 * (`-nu-hebr`), so it falls back to Latin digits ("13 בתשרי 5787"). For the
 * civil YEAR we pass year % 1000 (the millennium is dropped by convention:
 * 5787 → תשפ״ז).
 */
function hebrewGematria(num: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  let n = Math.floor(num) % 1000;
  if (n <= 0) return '';
  let out = hundreds[Math.floor(n / 100)];
  n %= 100;
  // 15 / 16 use ט״ו / ט״ז (never י-ה / י-ו — those spell parts of the Name).
  if (n === 15) out += 'טו';
  else if (n === 16) out += 'טז';
  else {
    out += tens[Math.floor(n / 10)];
    out += ones[n % 10];
  }
  if (out.length === 1) return out + '׳'; // geresh on a single letter
  return out.slice(0, -1) + '״' + out.slice(-1); // gershayim before the last
}

/** Compact "time ago" for the timeline ledger. */
function relTimeShort(ts: number, he: boolean): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.round(diff / 60000);
  if (m < 1) return he ? 'עכשיו' : 'now';
  if (m < 60) return he ? `לפני ${m} ד׳` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return he ? `לפני ${h} ש׳` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return he ? `לפני ${d} י׳` : `${d}d ago`;
  const w = Math.round(d / 7);
  return he ? `לפני ${w} שב׳` : `${w}w ago`;
}

/** Day-section label for the timeline (today / yesterday / date). */
function dayLabel(ts: number, he: boolean): string {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff <= 0) return he ? 'היום' : 'Today';
  if (diff === 1) return he ? 'אתמול' : 'Yesterday';
  return d.toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long' });
}

/** Distance from the timeline's leading edge to the vertical axis line. */
const TL_NODE_X = 34;

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
  /** Tap the "Upgrade" line under the input → opens plans (Settings). */
  onUpgrade?: () => void;
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
  /** True while ONE's Settings sheet is open (long-press the orb). Treated like
   *  the profile for the figure hand-off: the figure shrinks to a dot in place
   *  (no rise / box-drop). */
  settingsOpen?: boolean;
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
  /** Reports the live voice-call state up to the navigator, so a sheet opened
   *  over Home during a call (e.g. ONE's profile) can show the call ring on its
   *  own orb. Home keeps owning the call; this only mirrors the flag up. */
  onCallActiveChange?: (active: boolean) => void;
  /** Live animated index of the ONE profile sheet (-1 closed … 1 full).
   *  Drives the home orb's collapse/return IN SYNC with the sheet slide —
   *  so dragging the sheet down brings the orb back in real time, not on a
   *  fixed timer. Falls back to `profileOpen` when not provided. */
  profileSheetIndex?: SharedValue<number>;
  /** Live animated index of the sign-in sheet (-1 closed … 0 open). Drives
   *  the home orb + connect line drop IN SYNC with the sheet slide, so they
   *  rise back with the close drag instead of on a delayed timer. Falls back
   *  to the `signInOpen` boolean when not provided. */
  signInSheetIndex?: SharedValue<number>;
  /** Open ONE01 Global — the world of processes (official ONEs, public
   *  processes, templates, insights, signals). Entry pill at the top. */
  onOpenGlobal?: () => void;
  /** True while ONE01 Global is open over Home. Keeps the input dock + upgrade
   *  line faded out (they fade during the pull) until Global is exited. */
  globalOpen?: boolean;
  /** Live animated index of the Global sheet (-1 closed … 0 open). Drives the
   *  input dock + upgrade line fade IN SYNC with the Global close drag, so they
   *  return the instant Global slides away — no delay. Falls back to `globalOpen`. */
  globalSheetIndex?: SharedValue<number>;
  /** Open a business's ONE profile sheet (from a chat "open <business>"). */
  onOpenBusiness?: (id: string) => void;
  /** Bumped counter — each increment opens the Timeline (the "past"). The
   *  timeline lives here (it reads the home's cross-profile history), but it's
   *  triggered from ONE's profile menu, so the navigator signals it via this. */
  openTimelineSignal?: number;
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
  scrollY: SharedValue<number>;
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
  // `index` / `count` drive the story-style progress ring around the Orb.
  return { line: safe, next, prev, resume, index, count: Math.max(1, lines.length) };
}

interface InlineMessage {
  id: string;
  from: 'one' | 'user';
  text: string;
  /** Wall-clock ms when the message was sent. Stamped at create-time so the
   *  displayed time doesn't shift on re-renders. */
  ts: number;
  /** When present, ONE sent an interactive WIDGET (e.g. the process it just
   *  opened) rather than a plain text bubble. */
  widget?: ChatWidget;
  /** The process this turn is about — stamped when a turn creates/updates a
   *  unit, so a process's bubbles can fold into its drawer. */
  unitId?: string;
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
  onUpgrade,
  onCreatedFromChat,
  signInOpen = false,
  profileOpen = false,
  settingsOpen = false,
  quickActionsOpen = false,
  unitOpen = false,
  anySheetOpen = false,
  onCallActiveChange,
  profileSheetIndex,
  signInSheetIndex,
  onOpenGlobal,
  globalOpen = false,
  globalSheetIndex,
  onOpenBusiness,
  openTimelineSignal,
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
  // Profiles = identities (personal / business / family). Rendered as a pill
  // row under the Orb so the user sees + switches profile at a glance.
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const setActiveIdentity = useMvpStore((s) => s.setActiveIdentity);

  // First-time users haven't completed onboarding. Their broadcast loop is
  // the "Hi, I'm ONE…" intro that previously lived on WelcomeScreen — the
  // home itself does the introduction now. Returning / signed-in users get
  // the time-aware greeting + identity-driven lines.
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);
  const userName = useMvpStore((s) => s.name);
  const setUserName = useMvpStore((s) => s.setName);
  // Conversational onboarding on the classic home: ONE introduces itself and
  // walks you through small steps IN the conversation — asks your name, then
  // what to start on — not a fat setup card. 'name' → 'go'.
  const [onboardStep, setOnboardStep] = useState<'name' | 'go'>('name');
  useEffect(() => {
    // Start at 'name' for a fresh visitor; if a name is already known (returning
    // mid-onboarding), skip straight to inviting the first thing.
    if (!hasOnboarded) setOnboardStep(useMvpStore.getState().name.trim() ? 'go' : 'name');
  }, [hasOnboarded]);

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
  // Onboarding invite — one example (emoji + short label) that cycles through
  // the kinds of things ONE can take on, so the intro reads alive.
  const [exampleRot, setExampleRot] = useState(0);
  useEffect(() => {
    if (hasOnboarded) return;
    const id = setInterval(() => setExampleRot((n) => n + 1), 2600);
    return () => clearInterval(id);
  }, [hasOnboarded]);
  const onboardExamples =
    lang === 'he'
      ? [
          { emoji: '🚗', label: 'רישיון נהיגה' },
          { emoji: '🏋️', label: 'אימון כושר' },
          { emoji: '✈️', label: 'טיול לחו״ל' },
          { emoji: '🏠', label: 'מעבר דירה' },
          { emoji: '🩺', label: 'תור לרופא' },
          { emoji: '💰', label: 'ניהול תקציב' },
        ]
      : [
          { emoji: '🚗', label: 'a license' },
          { emoji: '🏋️', label: 'training' },
          { emoji: '✈️', label: 'a trip abroad' },
          { emoji: '🏠', label: 'a move' },
          { emoji: '🩺', label: 'a doctor visit' },
          { emoji: '💰', label: 'a budget' },
        ];
  const onboardExample = onboardExamples[exampleRot % onboardExamples.length];

  // Onboarding HEADLINE — NOT a per-second carousel. It settles: the timed
  // greeting → "I'm ONE" and STAYS there. Only when the home sits IDLE for a
  // while does it offer a hint (scroll to Global / to processes), and never a
  // hint for something the user has already done (ONE knows they know).
  const [headlineStage, setHeadlineStage] = useState<'greeting' | 'identity' | 'hint'>('greeting');
  const [hintRot, setHintRot] = useState(0);
  const seenGlobalRef = useRef(false);
  const seenProcessesRef = useRef(false);
  const lastInteractRef = useRef(Date.now());
  const noteInteract = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);
  // While the connect sheet is open, the headline above it cycles through the
  // reasons to sign in (see connectReasons).
  const [connectRot, setConnectRot] = useState(0);
  useEffect(() => {
    if (!signInOpen) {
      setConnectRot(0);
      return;
    }
    const id = setInterval(() => setConnectRot((n) => n + 1), 3200);
    return () => clearInterval(id);
  }, [signInOpen]);
  // Idle → surface an unseen hint for a beat, then settle back to identity.
  useEffect(() => {
    if (hasOnboarded) return;
    const id = setInterval(() => {
      setHeadlineStage((prev) => {
        if (prev === 'hint') return 'identity';
        if (prev === 'identity') {
          const idle = Date.now() - lastInteractRef.current;
          const hasHint = !seenGlobalRef.current || !seenProcessesRef.current;
          // Long idle only — never interrupt someone mid-read with a hint.
          if (idle > 24000 && hasHint) {
            setHintRot((n) => n + 1);
            return 'hint';
          }
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [hasOnboarded]);
  // Rotates the opening greeting line — but NOT on a fast ticking clock (that
  // read as "changing every second"). It advances only when something actually
  // HAPPENED: the app was brought back to the foreground, or the home sat idle
  // for a good while (the idle bump is armed in handleHomeTouch, below). The line
  // crossfades on change (see the hero render).
  const [greetingRot, setGreetingRot] = useState(0);
  const bumpGreeting = useCallback(() => setGreetingRot((n) => n + 1), []);
  // Returning to the app should NOT re-load ONE's message each time (minimize /
  // window switch / foreground). If ONE already spoke, it's simply there. We
  // only refresh the opener when the calendar DAY has changed since last active.
  const lastActiveDayRef = useRef(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const today = new Date().toISOString().slice(0, 10);
      if (today !== lastActiveDayRef.current) {
        lastActiveDayRef.current = today;
        bumpGreeting();
      }
    });
    return () => sub.remove();
  }, [bumpGreeting]);
  // Onboarding headline: greeting → identity on each fresh landing (greetingRot
  // bumps on events). Declared here, after greetingRot exists.
  useEffect(() => {
    if (hasOnboarded) return;
    setHeadlineStage('greeting');
    const t = setTimeout(() => setHeadlineStage('identity'), 2600);
    return () => clearTimeout(t);
  }, [hasOnboarded, greetingRot]);
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

  // Cards grouped into collapsible PROFILE drawers (personal / business /
  // family). Each identity that has cards becomes a drawer the user can fold
  // or expand. `allProfileUnits` is every identity's units (not just the
  // active one) so all profiles are reachable from the list.
  const allProfileUnits = useMvpStore((s) => s.units);
  const cardGroups = React.useMemo(() => {
    const lastTouched = (items: Unit[]) =>
      items.reduce(
        (max, u) => Math.max(max, new Date(u.lastUpdatedAt).getTime() || 0),
        0,
      );
    return identities
      .map((idn) => ({
        idn,
        items: sortByAttention(
          // Completed processes drop OUT of the home list — they live on in
          // ONE's profile / the timeline, but the working list stays to what's
          // still open. (They were lingering with a ✓ "done" card.)
          allProfileUnits.filter((u) => u.identityId === idn.id && u.status !== 'completed'),
        ),
      }))
      // Every profile shows as a drawer — INCLUDING a freshly added, still-empty
      // one (it was being filtered out, so a new space never appeared). Empty
      // groups have lastTouched 0, so they sort to the bottom.
      .sort((a, b) => lastTouched(b.items) - lastTouched(a.items));
  }, [identities, allProfileUnits]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  // ── Timeline (the "past") ──────────────────────────────────────────────
  // Pulling the hero DOWN at the top reveals a chronological ledger of ONE's
  // updates across every process — the intent→reality history.
  const [timelineOpen, setTimelineOpen] = useState(false);
  const timelineScrollRef = useRef<ScrollView>(null);
  // Opened from ONE's profile menu: the navigator bumps `openTimelineSignal`
  // (after closing the profile), and we raise the timeline drawer. Skip the
  // first render (0 / undefined) so it only reacts to real bumps.
  const timelineSignalRef = useRef(openTimelineSignal);
  useEffect(() => {
    if (openTimelineSignal !== timelineSignalRef.current) {
      timelineSignalRef.current = openTimelineSignal;
      setTimelineOpen(true);
    }
  }, [openTimelineSignal]);
  // ── Timeline as a TOP DRAWER ──
  // Pulling the home DOWN opens it: it comes DOWN from the top, and closes back
  // UP (returning where it came from). The inner list scrolls FREELY (no gesture
  // wraps it — a Pan there was swallowing the scroll). Content reads from the TOP
  // (oldest first); flinging UP past the bottom (overscroll) closes it, or the
  // chevron. `tlDragY`: 0 = open, -SCREEN_H = off (above).
  const tlDragY = useSharedValue(-SCREEN_H);
  const closeTimeline = useCallback(() => setTimelineOpen(false), []);
  // Comes DOWN from the top into place whenever the timeline opens.
  useEffect(() => {
    if (timelineOpen) {
      tlDragY.value = -SCREEN_H;
      tlDragY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    }
  }, [timelineOpen, tlDragY]);
  // Animate the overlay UP and off, then unmount — shared by the overscroll fling
  // and the dismiss chevron.
  const dismissTimeline = useCallback(() => {
    tlDragY.value = withTiming(
      -SCREEN_H,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (fin) => {
        if (fin) runOnJS(closeTimeline)();
      },
    );
  }, [tlDragY, closeTimeline]);
  const timelineDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tlDragY.value }],
  }));
  const timelineEntries = React.useMemo(() => {
    type Entry = { id: string; unitId: string; emoji: string; title: string; text: string; ts: number };
    const out: Entry[] = [];
    for (const u of allProfileUnits) {
      for (const h of u.history ?? []) {
        const ts = new Date(h.createdAt).getTime();
        if (Number.isNaN(ts)) continue;
        out.push({ id: `${u.id}_${h.id}`, unitId: u.id, emoji: u.emoji, title: u.title, text: h.title, ts });
      }
      // The process's own birth is the first ledger beat.
      const cts = new Date(u.createdAt).getTime();
      if (!Number.isNaN(cts)) {
        out.push({
          id: `${u.id}_born`,
          unitId: u.id,
          emoji: u.emoji,
          title: u.title,
          text: lang === 'he' ? 'התהליך נוצר' : 'Process created',
          ts: cts,
        });
      }
    }
    // Keep the 40 most-recent beats, then order OLDEST → NEWEST so the list
    // reads like a chat: today sits at the BOTTOM (nearest the reader) and
    // scrolling UP travels back in time.
    return out
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 40)
      .reverse();
  }, [allProfileUnits, lang]);
  const toggleGroup = useCallback((id: string) => {
    haptic.tap();
    setCollapsedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  // Long-press a space header → confirm, then delete the space and every process
  // in it. Never the last space (there must always be one). Done via setState so
  // the persisted store file isn't touched.
  const promptDeleteSpace = useCallback(
    (id: string, name: string) => {
      const he = lang === 'he';
      const store = useMvpStore.getState();
      if (store.identities.length <= 1) return; // keep at least one space
      haptic.press();
      Alert.alert(
        he ? `למחוק את "${name}"?` : `Delete "${name}"?`,
        he
          ? 'כל התהליכים במרחב הזה יימחקו. אי אפשר לשחזר.'
          : 'Every process in this space will be removed. This cannot be undone.',
        [
          { text: he ? 'ביטול' : 'Cancel', style: 'cancel' as const },
          {
            text: he ? 'מחק מרחב' : 'Delete space',
            style: 'destructive' as const,
            onPress: () => {
              const s = useMvpStore.getState();
              const remaining = s.identities.filter((i) => i.id !== id);
              useMvpStore.setState({
                identities: remaining,
                units: s.units.filter((u) => u.identityId !== id),
                activeIdentityId:
                  s.activeIdentityId === id ? remaining[0]?.id ?? null : s.activeIdentityId,
              });
            },
          },
        ],
      );
    },
    [lang],
  );

  // Display name shown in the identity row below the orb. Before the user
  // has signed in / introduced themselves, default to "ONE" — using the
  // seeded "Ariel" mock name would look like ONE already knows them.
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
  // Live mirror for worklet-free callbacks (scrollToLatest reads it from
  // onLayout without a stale closure).
  const inputFocusedRef = useRef(false);
  useEffect(() => { inputFocusedRef.current = inputFocused; }, [inputFocused]);
  // The process the conversation is currently ABOUT (last one ONE touched in
  // chat) — threaded to ONE as the active context so follow-ups keep filling it.
  const [activeChatUnitId, setActiveChatUnitId] = useState<string | null>(null);
  const activeChatUnitIdRef = useRef<string | null>(null);
  useEffect(() => { activeChatUnitIdRef.current = activeChatUnitId; }, [activeChatUnitId]);
  // The metric ONE is currently asking the user to fill (so the next answer
  // lands on it, and ONE asks the next empty one). Drives the "build the process
  // through the conversation" loop. A ref so sendChat reads it without re-create.
  const pendingFillRef = useRef<{ unitId: string; metricLabel: string } | null>(null);
  // Processes whose chat bubbles are FOLDED into their drawer — "collapse" on a
  // process card hides that process's back-and-forth, leaving the clean card.
  const [foldedProcessIds, setFoldedProcessIds] = useState<Set<string>>(() => new Set());
  const toggleFoldProcess = useCallback((unitId: string) => {
    haptic.tap();
    setFoldedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);
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
  // Once you engage the chat it STAYS open (showing the full continuous thread,
  // scrollable back to earlier conversations) until you dismiss it with the X —
  // it no longer resets to a fresh session each time or closes the moment the
  // keyboard drops. Set on focus, cleared on dismiss.
  const [chatOpen, setChatOpen] = useState(false);
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
  // The chat shows the FULL continuous thread — no per-open "session" slice, so
  // you always continue from where you were and can scroll back to earlier
  // conversations. (Kept the name `sessionMessages` to avoid churn; it's now the
  // whole homeChat.)
  const sessionMessages = chatMessages;
  // A folded process hides its back-and-forth bubbles, leaving just its drawer
  // (the widget) as the folded representation.
  const visibleMessages = useMemo(
    () => sessionMessages.filter((m) => !(m.unitId && !m.widget && foldedProcessIds.has(m.unitId))),
    [sessionMessages, foldedProcessIds],
  );
  // Index (in the VISIBLE list) of the NEWEST process drawer — only that one
  // opens expanded (you just acted on it), older drawers mount collapsed so the
  // thread stays tidy. Each drawer keeps its own state after mount.
  let lastProcessWidgetIdx = -1;
  for (let i = visibleMessages.length - 1; i >= 0; i--) {
    if (visibleMessages[i].widget?.kind === 'process') {
      lastProcessWidgetIdx = i;
      break;
    }
  }
  const [chatTyping, setChatTyping] = useState(false);
  // Status caption shown UNDER the small Orb during a turn — "Thinking…",
  // "Searching memory…", "Updating process…" — replaces the broadcast text
  // once the user has sent a message. null = no caption (resting between
  // turns). Lifecycle is driven by sendChat below.
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  // Bottom edge (Y within the scroll content) of the inline conversation
  // thread, captured on layout. The thread now lives INSIDE the one home scroll
  // (not a separate overlay), so to pin to the newest turn we scroll the MAIN
  // scroll to just past this.
  const threadBottomRef = useRef(0);

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
  // expo-audio recorder (hook-based). We only use it to hold the mic hot and
  // drive the waveform/timer on native; the transcript comes from the recognizer.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingActiveRef = useRef(false);
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
    // Do NOT jump back home — a call starts IN PLACE (wherever you are, even
    // scrolled into the processes), like ONE joining you where you're looking (a
    // "shared screen"). The dock is screen-pinned so it stays reachable.
    // A call means ONE is awake — never leave the dock dimmed by a pending doze.
    setOrbAsleep(false);
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

    // Native audio capture (expo-audio) — drives the waveform + timer. On web the
    // recognizer already owns the mic, so we skip native capture there.
    if (Platform.OS !== 'web') {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (perm.granted) {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          await audioRecorder.prepareToRecordAsync();
          audioRecorder.record();
          recordingActiveRef.current = true;
        }
      } catch (e) {
        console.warn('[HomeScreen] recording start failed:', e);
      }
    }
    setRecording(true);
  }, [lang, audioRecorder]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    // Stop the recognizer; the transcript stays in the input for review.
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    if (recordingActiveRef.current) {
      recordingActiveRef.current = false;
      try {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch (e) {
        console.warn('[HomeScreen] recording stop failed:', e);
      }
    }
  }, [audioRecorder]);

  const chatActive =
    !chatDismissed && (inputFocused || chatHeldOpen || (chatOpen && chatMessages.length > 0));
  // Keep a live mirror so callbacks defined earlier in render (startCall) can
  // read the current chat state without a temporal-dead-zone reference.
  chatActiveRef.current = chatActive;

  // Continuous thread: the home IS the chat scroll. Keep the newest turn in
  // view, but ONLY scroll when the thread is actually taller than the space
  // above the input (and the keyboard, when open). A short thread that already
  // fits stays pinned at the TOP under the orb — never scrolled down into empty
  // space. You scroll UP for earlier conversation.
  // Bring the newest turn (incl. a just-added process widget) to just above the
  // input + keyboard. Empty thread → target 0, so it stays pinned at the top.
  // Called both when the message count changes AND from the thread's onLayout,
  // because the widget's height lands in `threadBottomRef` only after layout —
  // scrolling on the count change alone left the newest card under the keyboard.
  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      // Use the LIVE keyboard height when it's actually up (falls back to an
      // estimate) so the newest message lands just ABOVE the keyboard + input,
      // not behind it.
      const liveKb = keyboardHeight.value;
      const kb = inputFocusedRef.current ? (liveKb > 60 ? liveKb : SCREEN_H * 0.42) : 0;
      const available = SCREEN_H - insets.top - INPUT_BAR_H - 24 - kb;
      const target = Math.max(0, threadBottomRef.current - available);
      scrollRef.current?.scrollTo({ y: target, animated });
    });
  }, [insets.top]);
  useEffect(() => {
    if (!chatActive && chatMessages.length === 0) return;
    scrollToLatest();
  }, [chatActive, chatMessages.length, inputFocused, insets.top, scrollToLatest]);


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

  // ONE always speaks FIRST: when the chat or a call opens on a fresh thread
  // (no history yet), ONE posts an opening greeting, so the conversation begins
  // with ONE reaching out — never an empty box. Once a thread exists its own
  // history already leads, so we don't double-greet.
  const openerPostedRef = useRef(false);
  useEffect(() => {
    const active = chatActive || callActive;
    if (!active) { openerPostedRef.current = false; return; }
    if (openerPostedRef.current) return;
    openerPostedRef.current = true;
    // Entering the chat/call always FOCUSES the latest message (scroll to it).
    scrollToLatest();
    // ONE writes FIRST on EVERY open — even when there's already history (not
    // just the first ever message). Skip only if ONE's own greeting is already
    // the last thing said (it's still waiting on you — no need to repeat it).
    const store = useMvpStore.getState();
    const last = store.homeChat[store.homeChat.length - 1] as InlineMessage | undefined;
    if (last && last.from === 'one' && last.id.startsWith('one_opener_')) return;
    const greeting = timeGreeting(lang, Date.now(), identity?.name, 0);
    const text = lang === 'he' ? `${greeting} במה אפשר לעזור?` : `${greeting} How can I help?`;
    store.appendHomeChat({ id: `one_opener_${Date.now()}`, from: 'one', text, ts: Date.now() });
    // Bring the fresh greeting into view (above the keyboard if it's open).
    requestAnimationFrame(() => scrollToLatest());
  }, [chatActive, callActive, identity?.name, lang, scrollToLatest]);

  // The chat/call shares the home's single ScrollView, so scrolling the thread
  // moves the same scrollY. When we LEAVE chat/call, reliably reset it to 0 so
  // the home returns to its CENTRED rest — otherwise a scrolled thread (esp.
  // with history) left the home collapsed and the return "sometimes" failed.
  useEffect(() => {
    if (chatActive || callActive) return;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }, [chatActive, callActive]);

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    // Back to focus-driven chat state — the + "hold open" bridge is no longer
    // needed once the user is actually in the field again.
    setChatHeldOpen(false);
    // Reopening the chat clears the dismissed flag so the persisted history
    // becomes visible again, and keeps the chat open (full thread) until the X.
    setChatDismissed(false);
    setChatOpen(true);
    // Bring the newest turn into focus above the keyboard. On an EMPTY thread
    // this resolves to the top (hero context — agent + broadcast centered, like
    // tapping the input at rest); with a conversation it scrolls so the last
    // bubble / process widget sits just above the keyboard instead of hiding
    // under it.
    scrollToLatest();
  }, [scrollToLatest]);
  const handleInputBlur = useCallback(() => setInputFocused(false), []);

  // Safety: when the keyboard fully hides, the TextInput can stay "focused" in
  // RN state on some dismiss paths (system / gesture), which left Home stuck in
  // the half-open compose state (orb lowered, single prompt, no keyboard). If
  // we're not mid-conversation and not bridging to Quick Actions / a unit,
  // force focus off so Home returns cleanly to rest — one consistent close.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (!chatHeldOpen && sessionMessages.length === 0 && !unitOpen && !quickActionsOpen) {
        setInputFocused(false);
      }
    });
    return () => sub.remove();
  }, [chatHeldOpen, sessionMessages.length, unitOpen, quickActionsOpen]);

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
    setChatOpen(false);
    setChatTyping(false);
    setChatStatus(null);
    setInputFocused(false);
    setChatHeldOpen(false);
    // Ghost mode is per-conversation — closing the chat returns ONE to its
    // normal (non-incognito) presence, and the next chat starts on the record.
    setGhostMode(false);
    Keyboard.dismiss();
    // Reset the scroll so the home lands on its proper CENTRED rest — otherwise
    // a chat left scrolled dropped you onto a collapsed/mis-arranged home.
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
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
    // Discovery-conversation onboarding: NO name-first step. ONE opens by asking
    // what you want it to manage/represent; your FIRST real answer completes
    // onboarding and flows straight through the normal pipeline below (opens the
    // process / sets up what's needed). The name + preferences are learned as we
    // go, never as a blocking step.
    if (!useMvpStore.getState().hasCompletedOnboarding) {
      useMvpStore.getState().markOnboardingComplete();
    }
    const now = Date.now();
    const userMsg: InlineMessage = { id: `u${now}`, from: 'user', text: value, ts: now };
    setChatMessages((m) => [...m, userMsg]);

    // TOOL — deploy a QUIZ. When the user asks to practice / be tested and ONE
    // has a quiz for the topic (the active process, or the message itself), ONE
    // drops a live quiz widget into the thread; its score flows back onto the
    // process metric when finished. Client-side, so it works with or without AI.
    if (
      toolEnabled(useMvpStore.getState().enabledTools, 'quiz') &&
      /מבחן|תרגול|תרגל|בחן אותי|תבחן|שאלות תרגול|quiz|test me|practice|מבחן אמריקאי/i.test(value)
    ) {
      const qActiveUnits = units.filter((u) => u.identityId === identity?.id);
      const qActiveId = activeChatUnitIdRef.current;
      const qActiveU = qActiveId ? qActiveUnits.find((u) => u.id === qActiveId) : undefined;
      let def = qActiveU ? quizForText(qActiveU.title) : null;
      let qUnit = def ? qActiveU : undefined;
      if (!def) {
        def = quizForText(value);
        if (def) qUnit = qActiveU;
      }
      if (!def) {
        for (const u of qActiveUnits) {
          const d = quizForText(u.title);
          if (d) { def = d; qUnit = u; break; }
        }
      }
      if (def) {
        const qHe = /[֐-׿]/.test(value) || lang === 'he';
        const run = buildQuizRun(def, qUnit?.id, qHe ? 'he' : 'en');
        useMvpStore.getState().startQuizRun(run);
        if (qUnit) setActiveChatUnitId(qUnit.id);
        const ots = now + 1;
        const intro = qHe
          ? `יאללה — ${run.title} קצר, נראה איפה אתה עומד 👇`
          : `Let's go — a quick ${run.title}, see where you stand 👇`;
        setChatMessages((m) => [
          ...m,
          { id: `o${ots}`, from: 'one' as const, text: intro, ts: ots, ...(qUnit ? { unitId: qUnit.id } : {}) },
          { id: `w${ots + 1}`, from: 'one' as const, text: '', ts: ots + 2, widget: { kind: 'quiz', runId: run.id }, ...(qUnit ? { unitId: qUnit.id } : {}) },
        ]);
        return;
      }
      // No quiz for this topic → fall through; ONE replies normally.
    }

    // TOOL — deploy a BOOKING. When the user asks ONE to set up a time /
    // appointment, ONE drops a live booking widget with concrete slots; the
    // confirmed slot flows back onto the process as a timeline entry. Client-side.
    if (toolEnabled(useMvpStore.getState().enabledTools, 'booking') && bookingForText(value)) {
      const bHe = /[֐-׿]/.test(value) || lang === 'he';
      const bActiveId = activeChatUnitIdRef.current;
      const bUnit = bActiveId ? units.find((u) => u.id === bActiveId && u.identityId === identity?.id) : undefined;
      const provider = bUnit?.people?.[0]?.name;
      const run = buildBookingRun({
        unitId: bUnit?.id,
        title: bHe ? 'קביעת תור' : 'Booking',
        provider,
        lang: bHe ? 'he' : 'en',
      });
      useMvpStore.getState().startBookingRun(run);
      if (bUnit) setActiveChatUnitId(bUnit.id);
      const bts = now + 1;
      const intro = bHe
        ? 'בטח — הנה כמה זמנים פנויים, בחר מה שנוח 👇'
        : 'Sure — here are a few open times, pick what works 👇';
      setChatMessages((m) => [
        ...m,
        { id: `o${bts}`, from: 'one' as const, text: intro, ts: bts, ...(bUnit ? { unitId: bUnit.id } : {}) },
        { id: `w${bts + 1}`, from: 'one' as const, text: '', ts: bts + 2, widget: { kind: 'booking', runId: run.id }, ...(bUnit ? { unitId: bUnit.id } : {}) },
      ]);
      return;
    }

    // TOOL — deploy a FORM. When the user asks ONE to collect structured details
    // (contact info, address, "fill in details"), ONE drops a form widget; on
    // submit the values save into disclosure + a process note. Client-side.
    if (toolEnabled(useMvpStore.getState().enabledTools, 'forms')) {
      const fDef = formForText(value);
      if (fDef) {
        const fHe = /[֐-׿]/.test(value) || lang === 'he';
        const fActiveId = activeChatUnitIdRef.current;
        const fUnit = fActiveId ? units.find((u) => u.id === fActiveId && u.identityId === identity?.id) : undefined;
        const run = buildFormRun(fDef, fUnit?.id, fHe ? 'he' : 'en');
        useMvpStore.getState().startFormRun(run);
        if (fUnit) setActiveChatUnitId(fUnit.id);
        const fts = now + 1;
        const intro = fHe ? 'בטח — מלא את הפרטים ואשמור 👇' : 'Sure — fill these in and I\'ll keep them 👇';
        setChatMessages((m) => [
          ...m,
          { id: `o${fts}`, from: 'one' as const, text: intro, ts: fts, ...(fUnit ? { unitId: fUnit.id } : {}) },
          { id: `w${fts + 1}`, from: 'one' as const, text: '', ts: fts + 2, widget: { kind: 'form', runId: run.id }, ...(fUnit ? { unitId: fUnit.id } : {}) },
        ]);
        return;
      }
    }

    // BUILD-THROUGH-CONVERSATION: if ONE just asked the user to fill a metric,
    // treat a short answer as that value — fill it, acknowledge, ask the next
    // empty one (or wrap up). Deterministic, so the process visibly fills itself
    // turn by turn (works with or without the AI). A clearly-new intent (starts
    // with a want/command) instead cancels the fill and flows on normally.
    const pf = pendingFillRef.current;
    if (pf) {
      // Language of the PROCESS (its metric label), not the answer — "12" is
      // language-neutral but a Hebrew process should still get a Hebrew reply.
      const fillHe = /[֐-׿]/.test(pf.metricLabel) || /[֐-׿]/.test(value) || lang === 'he';
      const isNewIntent = /^(אני\s+רוצה|אני\s+צריך|תכתוב|כתוב|נסח|תשלח|שלח|תזכיר|i\s+want|i\s+need|write|draft|send|remind)/i.test(value);
      const target = units.find((u) => u.id === pf.unitId);
      if (target && !isNewIntent && value.length <= 40) {
        const nowIso = new Date().toISOString();
        const nextMetrics = (target.metrics ?? []).map((m) =>
          m.label === pf.metricLabel ? { ...m, value: value.trim() } : m,
        );
        updateUnit(target.id, {
          metrics: nextMetrics,
          unreadUpdates: (target.unreadUpdates ?? 0) + 1,
          lastUpdatedAt: nowIso,
          updatedAt: nowIso,
        });
        useMvpStore.getState().updateHomeChatMessage(userMsg.id, { unitId: target.id });
        const nextEmpty = nextMetrics.find((m) => !m.value || m.value === '');
        pendingFillRef.current = nextEmpty ? { unitId: target.id, metricLabel: nextEmpty.label } : null;
        setActiveChatUnitId(target.id);
        const ots = now + 1;
        const ack = nextEmpty
          ? (fillHe ? `נרשם ✓ ${metricQuestion(nextEmpty.label, true)}` : `Got it ✓ ${metricQuestion(nextEmpty.label, false)}`)
          : (fillHe ? 'נרשם ✓ יש לנו תמונה — נמשיך מכאן מתי שתרצה.' : "Got it ✓ We've got the picture — carry on whenever you like.");
        setChatMessages((m) => [
          ...m,
          { id: `o${ots}`, from: 'one' as const, text: ack, ts: ots, unitId: target.id },
          { id: `w${ots + 1}`, from: 'one' as const, text: '', ts: ots + 2, widget: { kind: 'process', unitId: target.id }, unitId: target.id },
        ]);
        return;
      }
      // Not an answer → drop the fill and continue as a normal message.
      pendingFillRef.current = null;
    }

    // "Remember that…" → ONE stores it in his memory of you and confirms, no AI
    // round-trip. (The saved facts live in the ONE profile → "What ONE remembers".)
    const rememberFact = extractRememberFact(value);
    if (rememberFact) {
      useMvpStore.getState().addMemory(rememberFact);
      const ots = now + 1;
      setChatMessages((m) => [
        ...m,
        {
          id: `o${ots}`,
          from: 'one',
          text: lang === 'he' ? `שמרתי לזיכרון 🧠 — ${rememberFact}` : `Got it 🧠 — I'll remember: ${rememberFact}`,
          ts: ots,
        },
      ]);
      return;
    }

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
      // Set when this turn opened a NEW process — ONE then sends it as a widget
      // CARD in the thread (the conversation stays the center; you open it when
      // you want) instead of jumping you into it.
      let createdUnitId: string | null = null;
      // A process ONE UPDATED (not created) this turn — it gets its own drawer
      // in the thread too, so "update the Cyprus trip date" brings up the
      // Cyprus drawer right there in the conversation.
      let updatedUnitId: string | null = null;
      // An interactive tool widget ONE chose to deploy this turn (deploy_tool).
      let toolWidget: ChatWidget | null = null;
      let toolWidgetUnitId: string | null = null;
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
        // The process the conversation is currently building — so ONE keeps
        // filling IT (update/task/reminder/draft) instead of spawning duplicates.
        const activeU = activeChatUnitIdRef.current
          ? activeUnits.find((u) => u.id === activeChatUnitIdRef.current)
          : undefined;
        const intent = await invokeOneIntent(value, {
          identityName: identity?.name,
          unitsCount: units.length,
          voiceStyle: personalityPrompt(useMvpStore.getState().agentPersonality, lang),
          activeUnit: activeU
            ? {
                title: activeU.title,
                emoji: activeU.emoji,
                broadcast: activeU.latestBroadcastText?.[0],
                metricLabels: (activeU.metrics ?? []).map((m) => m.label),
                openSteps: (activeU.nextSteps ?? []).filter((s) => !s.done).map((s) => s.title),
                progress: activeU.nextSteps?.length
                  ? `${activeU.nextSteps.filter((s) => s.done).length}/${activeU.nextSteps.length} steps`
                  : undefined,
              }
            : undefined,
          history: chatMessages.slice(-6).map((m) => ({
            role: m.from === 'one' ? ('assistant' as const) : ('user' as const),
            content: m.text,
          })),
          memory: memory.length > 0 ? memory : undefined,
          userMemories: useMvpStore.getState().memories.map((m) => m.text),
          userDisclosure: openDisclosureStrings(disclosureForIdentity(useMvpStore.getState().activeIdentityId), lang === 'he'),
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
              desireToUnit(value, identity?.id ?? undefined);
            const created = enrichUnitFromArchetype(base, value, lang);
            addUnit(created);
            createdUnitId = created.id;
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
            // The conversation stays the center: ONE sends the new process as a
            // WIDGET CARD in the thread (added after the reply, below) rather
            // than jumping the user into it. They open it from the card when
            // they want. The unit chat was seeded above so it has context.
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
        } else if (intent.kind === 'update_process') {
          // ONE said it updated something inside an existing process. The
          // intent has no structured payload, so route to the best-matching
          // active process and make the change VISIBLE everywhere: the actual
          // METRIC value inside the unit, the card line, the unit's own chat,
          // the timeline + an unread — otherwise ONE claims "updated" but the
          // data never changes ("I don't see the update" bug).
          const tokenize = (s: string) =>
            (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1);
          // Route to the RIGHT process. First the shared fuzzy matcher; if that
          // is unsure, pick the unit whose TITLE tokens are most covered by what
          // the user said (+ ONE's reply, which usually names the process). We
          // do NOT fall back to "the first unit" — mis-routing "update the
          // Cyprus trip date" onto the weight process is worse than doing
          // nothing, so an unclear update just replies without touching data.
          const matchTokens = new Set(tokenize(`${value} ${intent.reply ?? ''}`));
          const similar = findSimilarUnit(value, activeUnits, identity?.id);
          let target = similar
            ? activeUnits.find((u) => u.id === similar.id)
            : undefined;
          if (!target) {
            let best: Unit | undefined;
            let bestCov = 0;
            for (const u of activeUnits) {
              const tt = tokenize(u.title);
              if (tt.length === 0) continue;
              const cov = tt.filter((tkn) => matchTokens.has(tkn)).length / tt.length;
              if (cov > bestCov) {
                bestCov = cov;
                best = u;
              }
            }
            if (bestCov >= 0.5) target = best;
          }
          if (target) {
            updatedUnitId = target.id;
            const nowIso = new Date().toISOString();
            const line = (intent.reply || value).replace(/\s+/g, ' ').trim().slice(0, 120);

            // Prefer the AI's STRUCTURED updates (label → value): match each to
            // an existing metric (Hebrew-aware fuzzy), set its value, append an
            // unmatched one (≤6), and check off any open step the value answers
            // — same precise handling as inside the process sheet, so a
            // multi-value update from Home isn't lossy. Fall back to the
            // single-number heuristic only when the model gave no structured
            // updates (tokens matched against each metric label, with a
            // goal/target boost so "update my weight GOAL to 72" lands right).
            let metricsNext = target.metrics;
            let nextStepsNext = target.nextSteps;
            let stepsCompleted: string[] = [];
            if (intent.updates?.length) {
              const updated = [...(target.metrics ?? [])];
              for (const u of intent.updates.slice(0, 3)) {
                const idx = matchMetricIndex(updated, u.metricLabel);
                if (idx >= 0) {
                  updated[idx] = { ...updated[idx], value: u.value, unit: u.unit ?? updated[idx].unit };
                } else if (updated.length < 6) {
                  updated.push({
                    id: `m_${Date.now()}_${updated.length}`,
                    label: u.metricLabel.trim(),
                    value: u.value,
                    unit: u.unit?.trim() || undefined,
                  });
                }
              }
              metricsNext = updated;
              const res = completeStepsFromUpdates(target.nextSteps, intent.updates);
              nextStepsNext = res.steps;
              stepsCompleted = res.completed;
            } else {
              const numMatch = value.match(/(\d[\d,.]*)/);
              const GOAL = ['יעד', 'מטרה', 'target', 'goal'];
              if (numMatch && target.metrics && target.metrics.length > 0) {
                const valTokens = tokenize(value);
                const valGoal = GOAL.some((g) => valTokens.includes(g));
                let bestIdx = -1;
                let bestScore = 0;
                target.metrics.forEach((m, i) => {
                  const lblTokens = tokenize(m.label);
                  let score = lblTokens.filter((tkn) => valTokens.includes(tkn)).length;
                  const lblGoal = GOAL.some((g) => lblTokens.includes(g));
                  if (valGoal && lblGoal) score += 2;
                  if (valGoal && !lblGoal) score -= 0.5;
                  if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                  }
                });
                if (bestIdx < 0 && target.metrics.length === 1) bestIdx = 0;
                if (bestIdx >= 0) {
                  const num = numMatch[1];
                  metricsNext = target.metrics.map((m, i) =>
                    i === bestIdx ? { ...m, value: num } : m,
                  );
                }
              }
            }

            updateUnit(target.id, {
              metrics: metricsNext,
              ...(stepsCompleted.length ? { nextSteps: nextStepsNext } : null),
              latestBroadcastText: [line, target.latestBroadcastText?.[1]] as [string, string?],
              history: [
                ...(target.history ?? []),
                { id: `h_${Date.now()}`, title: line, createdAt: nowIso },
              ],
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              lastUpdatedAt: nowIso,
              updatedAt: nowIso,
            });
            // Mirror the exchange into the unit's OWN chat so opening the
            // process shows the conversation that changed it.
            const uts = Date.now();
            useMvpStore.getState().appendUnitChat?.(target.id, {
              id: `u_${uts}`,
              from: 'user',
              text: value,
              ts: uts,
            });
            useMvpStore.getState().appendUnitChat?.(target.id, {
              id: `o_${uts + 1}`,
              from: 'one',
              text: intent.reply || line,
              ts: uts + 1,
            });
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: line,
              emoji: target.emoji,
              kind: 'event',
            });
          }
        } else if (intent.kind === 'draft_message' && intent.draft?.body) {
          // ONE composed the actual outward message. Make "I drafted it" TRUE:
          // drop it into a process as an editable, sendable draft (the intent →
          // reality bridge). Route to the best-matching process; if none fits,
          // spin up a lightweight process so the draft always has a home.
          const draftObj = {
            id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
            channel: intent.draft.channel ?? ('note' as const),
            to: intent.draft.to?.trim() || undefined,
            subject: intent.draft.subject?.trim() || undefined,
            body: intent.draft.body.trim(),
            status: 'draft' as const,
            createdAt: new Date().toISOString(),
          };
          const hint = intent.draft.processHint?.toLowerCase() ?? '';
          const similar = findSimilarUnit(`${intent.draft.processHint ?? ''} ${value}`, activeUnits, identity?.id);
          let target = similar ? activeUnits.find((u) => u.id === similar.id) : undefined;
          if (!target && hint) {
            target = activeUnits.find(
              (u) => u.title.toLowerCase().includes(hint) || hint.includes(u.title.toLowerCase()),
            );
          }
          if (target) {
            useMvpStore.getState().addDraft(target.id, draftObj, lang);
            updatedUnitId = target.id;
            useMvpStore.getState().pushUnitNotification({
              unitId: target.id,
              text: draftObj.to ? `Draft ready → ${draftObj.to}` : 'Draft ready to review',
              emoji: target.emoji,
              kind: 'event',
            });
          } else {
            const created = enrichUnitFromArchetype(
              desireToUnit(value, identity?.id ?? undefined),
              value,
              lang,
            );
            addUnit(created);
            useMvpStore.getState().addDraft(created.id, draftObj, lang);
            createdUnitId = created.id;
          }
        } else if (intent.kind === 'deploy_tool' && intent.tool) {
          // ONE chose to drop an interactive tool into the thread. Build the
          // matching widget (tied to the active process when there is one) —
          // same widgets the local keyword path deploys, reached via the AI.
          const tHe = /[֐-׿]/.test(value) || lang === 'he';
          const tUnit = activeChatUnitIdRef.current
            ? activeUnits.find((u) => u.id === activeChatUnitIdRef.current)
            : undefined;
          const topic = intent.tool.topic ?? value;
          if (intent.tool.kind === 'quiz') {
            const def = quizForText(topic) ?? (tUnit ? quizForText(tUnit.title) : null) ?? quizForText(value);
            if (def) {
              const run = buildQuizRun(def, tUnit?.id, tHe ? 'he' : 'en');
              useMvpStore.getState().startQuizRun(run);
              toolWidget = { kind: 'quiz', runId: run.id };
              toolWidgetUnitId = tUnit?.id ?? null;
            }
          } else if (intent.tool.kind === 'booking') {
            const run = buildBookingRun({ unitId: tUnit?.id, title: tHe ? 'קביעת תור' : 'Booking', provider: tUnit?.people?.[0]?.name, lang: tHe ? 'he' : 'en' });
            useMvpStore.getState().startBookingRun(run);
            toolWidget = { kind: 'booking', runId: run.id };
            toolWidgetUnitId = tUnit?.id ?? null;
          } else if (intent.tool.kind === 'form') {
            const def = formForText(topic) ?? formForText(value) ?? formForText('טופס');
            if (def) {
              const run = buildFormRun(def, tUnit?.id, tHe ? 'he' : 'en');
              useMvpStore.getState().startFormRun(run);
              toolWidget = { kind: 'form', runId: run.id };
              toolWidgetUnitId = tUnit?.id ?? null;
            }
          }
        }
      } catch (err) {
        // Network / parse failure → plain-text reply + the old regex
        // path so substantial intentions still become units. Log so
        // we can tell from Expo Go's console whether the AI is reaching
        // the function at all (this used to swallow silently).
        console.warn('[HomeScreen sendChat] invokeOneIntent failed; using local intent:', err);
        // OFFLINE BRAIN: the AI is unreachable (no network / not signed in /
        // blocked edge function). Classify the message locally and ACT, so the
        // conversation still GENERATES real things — a process, a draft, a
        // reminder — instead of a dead reply. Hebrew + English.
        const activeUnits = units.filter((u) => u.identityId === identity?.id);
        // Content-aware language: a Hebrew message gets a Hebrew process + reply
        // even if the app's UI language is English (and vice-versa) — the process
        // IS the user's words. (The AI path already does this via pickOneSystemPrompt.)
        const contentHe = /[֐-׿]/.test(value);
        const cLang: 'he' | 'en' = contentHe ? 'he' : 'en';
        const li = localOneIntent(value, { lang: cLang });
        if (li.kind === 'create_process') {
          // A recognised domain (fitness / license / moving / learning /
          // business / travel) → the FULLY-BILINGUAL archetype so steps+metrics
          // read in the message's language. Otherwise the generic desire→unit
          // path (enriched) for anything unrecognised.
          const archKey = detectArchetypeStrict(value);
          const enriched = archKey
            ? generateRichUnit(value, identity?.id ?? 'identity_ariel', cLang)
            : enrichUnitFromArchetype(
                desireToUnit(value, identity?.id ?? undefined),
                value,
                cLang,
              );
          // A short NAME, not the whole sentence, as the process title. Build a
          // new object (the enriched unit may be frozen — don't mutate it).
          // ZERO-PROGRESS start: the archetype is born "rich" with sample
          // progress (checked steps, 18/28, "theory passed") — misleading for a
          // brand-new intent. Keep the PLAN (step titles, metric labels +
          // realistic baselines) but reset the done-state so the user fills it
          // through the conversation (matches "build it together").
          const created = {
            ...enriched,
            title: cleanProcessTitle(value, contentHe),
            nextSteps: (enriched.nextSteps ?? []).map((s) => ({ ...s, done: false })),
            progress: enriched.progress ? { ...enriched.progress, current: 0 } : enriched.progress,
            latestBroadcastText: [contentHe ? 'בדיוק התחלנו.' : 'Just getting started.', undefined] as [string, string?],
            broadcast: [],
            // Keep the metric LABELS (what ONE will track) but clear the sample
            // VALUES — a fraction resets to 0/N, everything else empties, so
            // nothing claims progress the user hasn't made. ONE fills them
            // through the conversation.
            metrics: (enriched.metrics ?? []).map((m) => {
              const frac = String(m.value ?? '').match(/^(\d+)\s*\/\s*(\d+)$/);
              return { ...m, value: frac ? `0/${frac[2]}` : '', trend: undefined };
            }),
            history: [],
            decisions: [],
            reminders: [],
            timeline: [],
            unreadUpdates: 0,
          };
          addUnit(created);
          createdUnitId = created.id;
          haptic.success();
          useMvpStore.getState().pushUnitNotification({
            unitId: created.id,
            text: `New process: ${created.title}`,
            emoji: created.emoji,
            kind: 'created',
          });
          try {
            const store = useMvpStore.getState();
            const seedTs = Date.now();
            store.appendUnitChat?.(created.id, { id: `u_seed_${seedTs}`, from: 'user', text: value, ts: seedTs });
            store.appendUnitChat?.(created.id, { id: `o_seed_${seedTs + 1}`, from: 'one', text: buildProcessOpener(created, lang), ts: seedTs + 1 });
          } catch (e) {
            console.warn('[HomeScreen] seed unit chat (local) failed:', e);
          }
          // Invite the conversation to CONTINUE (don't just drop a card) and
          // show ONE already filled a first step — we build the process together.
          // Start building it together: ask for the first empty metric, so the
          // next answer fills it and ONE asks the next (the fill loop above).
          const firstEmptyMetric = (created.metrics ?? []).find((m) => !m.value || m.value === '');
          if (firstEmptyMetric) {
            pendingFillRef.current = { unitId: created.id, metricLabel: firstEmptyMetric.label };
          }
          const firstStep = created.nextSteps?.[0]?.title;
          reply = contentHe
            ? `פתחתי את ${created.emoji} ${created.title} 👇${firstEmptyMetric ? ` בוא נמלא אותו יחד — ${metricQuestion(firstEmptyMetric.label, true)}` : firstStep ? ` התחלתי עם "${firstStep}". נתחיל מזה?` : ' מאיפה נתחיל?'}`
            : `Opened ${created.emoji} ${created.title} 👇${firstEmptyMetric ? ` Let's fill it in together — ${metricQuestion(firstEmptyMetric.label, false)}` : firstStep ? ` I started with "${firstStep}". Begin there?` : ' Where shall we start?'}`;
        } else if (li.kind === 'draft_message' && li.draft?.body) {
          const draftObj = {
            id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
            channel: li.draft.channel ?? ('note' as const),
            to: li.draft.to?.trim() || undefined,
            subject: li.draft.subject?.trim() || undefined,
            body: li.draft.body.trim(),
            status: 'draft' as const,
            createdAt: new Date().toISOString(),
          };
          const similar = findSimilarUnit(value, activeUnits, identity?.id);
          const target = similar ? activeUnits.find((u) => u.id === similar.id) : undefined;
          if (target) {
            useMvpStore.getState().addDraft(target.id, draftObj, cLang);
            updatedUnitId = target.id;
          } else {
            // No matching process → a CLEAN message-holder (not an archetype
            // process with unrelated steps). It just carries the draft.
            const base = desireToUnit(value, identity?.id ?? undefined);
            const created = {
              ...base,
              title: draftObj.to
                ? (contentHe ? `הודעה ל${draftObj.to}` : `Message to ${draftObj.to}`)
                : (contentHe ? 'הודעה' : 'Message'),
              emoji: draftObj.channel === 'email' ? '✉️' : '💬',
              nextSteps: [],
              metrics: [],
              quickActions: [],
              insights: [],
            };
            addUnit(created);
            useMvpStore.getState().addDraft(created.id, draftObj, cLang);
            createdUnitId = created.id;
          }
          reply = li.reply;
        } else if (li.kind === 'add_reminder' && li.reminder) {
          // Land the reminder on the best process, or a light new one, so it's
          // real and visible (not just an acknowledgement).
          const similar = findSimilarUnit(`${li.reminder.text} ${value}`, activeUnits, identity?.id);
          let target = similar ? activeUnits.find((u) => u.id === similar.id) : undefined;
          if (!target) {
            target = enrichUnitFromArchetype(desireToUnit(value, identity?.id ?? undefined), value, cLang);
            addUnit(target);
            createdUnitId = target.id;
          } else {
            updatedUnitId = target.id;
          }
          const nowIso = new Date().toISOString();
          updateUnit(target.id, {
            reminders: [
              ...(target.reminders ?? []),
              {
                id: `r_${Date.now()}`,
                text: li.reminder.text,
                dueLabel: li.reminder.when,
                dueAt: resolveReminderDue(li.reminder.when, Date.now()),
                done: false,
                createdAt: nowIso,
              },
            ],
            unreadUpdates: (target.unreadUpdates ?? 0) + 1,
            lastUpdatedAt: nowIso,
            updatedAt: nowIso,
          });
          reply = li.reminder.when
            ? (contentHe ? `קבעתי תזכורת: ${li.reminder.text} · ${li.reminder.when} 🔔` : `Reminder set: ${li.reminder.text} · ${li.reminder.when} 🔔`)
            : li.reply;
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
      const widgetUnitId = createdUnitId ?? updatedUnitId;
      // A tool widget deployed this turn (deploy_tool) that is tied to a process
      // but didn't create/update one → still move the conversation into it.
      if (!widgetUnitId && toolWidgetUnitId) {
        setActiveChatUnitId(toolWidgetUnitId);
        useMvpStore.getState().updateHomeChatMessage(userMsg.id, { unitId: toolWidgetUnitId });
      }
      // This turn is ABOUT a process → remember it, so the next turns continue
      // in its context (fed to ONE) and the whole thread can fold into its card.
      if (widgetUnitId) {
        // Self-organizing timeline: moving the conversation to a NEW process
        // auto-folds the one we're leaving into its card, and un-folds the one
        // we're now on — so the thread stays the active conversation + tidy
        // cards for the rest. (The user can still fold/unfold any by hand.)
        const prevActive = activeChatUnitIdRef.current;
        setFoldedProcessIds((prev) => {
          if (prevActive === widgetUnitId && !prev.has(widgetUnitId)) return prev;
          const n = new Set(prev);
          if (prevActive && prevActive !== widgetUnitId) n.add(prevActive);
          n.delete(widgetUnitId);
          return n;
        });
        setActiveChatUnitId(widgetUnitId);
        // Stamp the ALREADY-SENT user message in place (setChatMessages only
        // appends; it can't edit an existing one) so the whole turn — question,
        // reply, and card — folds together into the process.
        useMvpStore.getState().updateHomeChatMessage(userMsg.id, { unitId: widgetUnitId });
      }
      setChatMessages((m) => {
        const next = [
          ...m,
          { id: `o${replyTs}`, from: 'one' as const, text: reply, ts: replyTs, ...(widgetUnitId ? { unitId: widgetUnitId } : {}) },
        ];
        // ONE sends the process it just opened OR updated as an interactive
        // drawer in-thread — you keep working it in the same conversation.
        if (widgetUnitId) {
          next.push({ id: `w${replyTs}`, from: 'one' as const, text: '', ts: replyTs + 1, widget: { kind: 'process', unitId: widgetUnitId }, unitId: widgetUnitId });
        }
        // A tool widget ONE chose to deploy (deploy_tool) — drop it in-thread.
        if (toolWidget) {
          next.push({ id: `wt${replyTs}`, from: 'one' as const, text: '', ts: replyTs + 2, widget: toolWidget, ...(toolWidgetUnitId ? { unitId: toolWidgetUnitId } : {}) });
        }
        return next;
      });
    }, HOME_CHAT_TYPING_MS);
  }, [addUnit, chatMessages, identity?.id, identity?.name, units, updateUnit, t, onCreatedFromChat, onboardStep, setUserName]);

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
          userMemories: useMvpStore.getState().memories.map((m) => m.text),
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
  // Neutral — the sign-in sheet is used both to CONNECT for the first time and
  // to return, so "welcome back" would be wrong for a first-timer. "Let's
  // connect" fits both (signing in with a provider IS creating the account).
  // The sign-in headline (shown above the connect sheet) ROTATES through
  // reasons to connect — signing in with a provider IS the account, so the copy
  // sells WHY: save your ONE, use it on every device, never lose anything.
  const connectReasons =
    lang === 'he'
      ? ['בוא נתחבר.', 'כדי לשמור את ONE שלך.', 'כדי להשתמש בכל המכשירים.', 'כדי שלא תאבד כלום.', 'כדי שאהיה איתך בכל מקום.']
      : ["Let's connect.", 'To save your ONE.', 'To use it on every device.', 'So you never lose a thing.', "So I'm with you everywhere."];
  const welcomeBackLine = connectReasons[connectRot % connectReasons.length];
  const displayedBroadcast = signInOpen
    ? welcomeBackLine
    : isComposingFirst
      ? (ghostMode ? ghostPrompt : chatPrompt)
      : broadcast;
  // The resting OPENER (greeting + ONE's proactive bubbles under the orb) is
  // ONE speaking first — shown only while there's NO conversation yet. The
  // moment a thread exists it steps aside for the inline chat (which lives in
  // the same home scroll), so at rest you see the CONVERSATION, not a separate
  // broadcast line. One continuous surface, no mode switch.
  const broadcastShouldHide = sessionMessages.length > 0;

  // ONE's own clock/status — date + live time. Shown in the hero sequence at
  // rest AND kept under the collapsed orb in the cards view (the system status
  // bar is hidden at the resting home).
  const heroStatus = React.useMemo(() => {
    const now = new Date(nowTick);
    const time = now.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (lang !== 'he') {
      const g = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
      return `${g} · ${time}`;
    }
    // The weekday ALWAYS stays (short, e.g. "יום ה׳"); the DATE beside it
    // alternates Hebrew ↔ civil on EVENTS (greetingRot) — once when you land,
    // then when ONE refreshes the home — NOT a per-second loop.
    const wd = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'][now.getDay()];
    const gregDate = now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
    // Hebrew (Jewish-calendar) date in gematria letters — built by hand because
    // the device's ICU has the calendar but not `-nu-hebr` (renders Latin
    // digits). Guarded; falls back to the civil date if the calendar is missing.
    let hebrewDate = '';
    try {
      const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).formatToParts(now);
      hebrewDate = parts
        .map((p) => {
          // If the device already rendered Hebrew numerals (parseInt → NaN),
          // keep its value; otherwise convert the Latin digits to gematria.
          if (p.type === 'day') {
            const d = parseInt(p.value, 10);
            return Number.isNaN(d) ? p.value : hebrewGematria(d);
          }
          if (p.type === 'year') {
            const y = parseInt(p.value, 10);
            return Number.isNaN(y) ? p.value : hebrewGematria(y % 1000);
          }
          return p.value;
        })
        .join('');
    } catch {
      hebrewDate = '';
    }
    const useHebrew = hebrewDate && greetingRot % 2 === 0;
    return `${wd} · ${useHebrew ? hebrewDate : gregDate} · ${time}`;
  }, [lang, nowTick, greetingRot]);

  // ONE's resting message is composed synchronously from the real process state
  // (see heroLines below) — instant and persistent, so it's "simply there" when
  // you return rather than re-loading. No per-foreground AI fetch / typing swap.

  // Rest-state hero copy — ONE talking to you, like a message from a contact
  // who's always around. NOT a passive dashboard ("you have 4 processes") and
  // NOT a list of chips that duplicate the cards below. ONE reads across your
  // processes and, in his OWN voice, tells you what's worth knowing right now:
  // what's waiting, what moved, what he'd do next — proactive, personal, present.
  const heroLines = React.useMemo<{ text: string; kind: 'greeting' | 'date' | 'beat' | 'prompt' | 'heading' | 'typing' | 'status' }[]>(() => {
    if (!hasOnboarded) {
      // First run — a DISCOVERY CONVERSATION (not a form, not "what's your
      // name"). ONE introduces itself by VALUE and asks what you want it to
      // manage / represent. Your first answer flows straight through (sendChat
      // completes onboarding + opens the process).
      const he = lang === 'he';
      return [
        { text: he ? 'היי 👋 אני וואן — הנציג הדיגיטלי שלך.' : "Hi 👋 I'm ONE — your digital representative.", kind: 'beat' as const },
        {
          text: he
            ? 'אני מנהל בשבילך תהליכים ומייצג אותך מול העולם — חושף רק מה שתרשה.'
            : 'I run your processes and represent you to the world — sharing only what you allow.',
          kind: 'beat' as const,
        },
        { text: he ? 'מה בא לך שאנהל או אייצג בשבילך?' : 'What would you like me to manage or represent for you?', kind: 'beat' as const },
      ];
    }
    // Clean rest home: the figure sits alone over the composer — NO broadcast
    // bubbles. ONE speaks through the under-box channel line now (and through the
    // chat once you open it), so the resting home stays quiet and uncrowded
    // (matches the target home mock). The first-run discovery beats above are
    // kept — onboarding still needs ONE to introduce itself.
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOnboarded, onboardStep, userName, lang, identity?.id, identity?.name, allProfileUnits, nowTick, heroStatus, greetingRot, headlineStage, hintRot]);

  // Broadcast interaction:
  //   • Tap — cycle to the next broadcast line.
  //   • HOLD anywhere — freeze the broadcast on its current line and record a
  //     spoken response. RELEASING the hold ends the recording (hold-to-talk),
  //     leaving the transcribed text in the input for review.
  //   • Swipe → prev/next.
  const onBroadcastTap = useCallback(() => {
    wakeChevron();
    nextBroadcast();
    // `wakeChevron` is a STABLE useCallback declared further down; referencing it
    // in the deps array here reads it during render (before its declaration) and
    // throws a TDZ ReferenceError — fatal on web/React-19, latent on native. The
    // closure call above is fine, so we just omit it from the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextBroadcast]);

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

  // Swipe the Home sideways → switch profile (identity), showing that
  // profile's cards. A FIRM horizontal drag (55px to arm, 70px / a fling to
  // commit) + fails on vertical, so the list still scrolls and each card's own
  // smaller-threshold swipe (pin/share/delete) wins when you drag on a card.
  const switchProfile = useCallback((delta: number) => {
    const list = useMvpStore.getState().identities;
    if (list.length < 2) return;
    const curId = useMvpStore.getState().activeIdentityId;
    const i = Math.max(0, list.findIndex((x) => x.id === curId));
    const nextId = list[(i + delta + list.length) % list.length].id;
    if (nextId !== curId) { haptic.select(); setActiveIdentity(nextId); }
  }, [setActiveIdentity]);

  const profileSwipe = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!chatActive)
        .activeOffsetX([-55, 55])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          'worklet';
          if (Math.abs(e.translationX) < 70 && Math.abs(e.velocityX) < 350) return;
          runOnJS(switchProfile)(e.translationX < 0 ? 1 : -1); // swipe left → next profile
        }),
    [chatActive, switchProfile],
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
  // ── Idle-rest ("sleep") geometry ───────────────────────────────────────
  // When ONE goes idle it no longer shrinks to a bare dot. Instead the FIGURE
  // (eyes open) and the input capsule gather into one calm CENTRED PAIR — the
  // orb just above the composer, like being handed the mic. These are the
  // offsets that bring them together: the orb rises a touch above dead-centre
  // and the input lifts up from the bottom to sit just beneath it.
  const SLEEP_PAIR_GAP = 56; // gap between the orb's bottom and the input's top
  const SLEEP_ORB_RAISE = Math.round((SLEEP_PAIR_GAP + INPUT_BAR_H) / 2);
  const SLEEP_INPUT_LIFT = Math.max(
    0,
    Math.round(
      SCREEN_H -
        insets.bottom -
        INPUT_BAR_H -
        (SCREEN_H / 2 - SLEEP_ORB_RAISE + HOME_ORB_SIZE / 2 + SLEEP_PAIR_GAP),
    ),
  );
  // 1 only when the orb is the big CENTRED figure (empty / fresh home) — the
  // sleep pair-centering (lifting the input up to the figure) is allowed then.
  // 0 once a conversation exists: the orb is a compact TOP header, so the input
  // must stay at the bottom (lifting it to centre would float it away from the
  // header). Declared up here so inputMountStyle below can read it.
  const sleepCenterOK = useSharedValue(1);
  const orbMountY = useSharedValue(ORB_FROM_CENTER_OFFSET);
  // Smaller travel for the secondary elements so the entry reads as a
  // single settle, not separate slides. Broadcast row and input dock
  // each just rise a touch into position.
  const elementsMountY = useSharedValue(16);   // broadcast/chevron slide from +16
  const inputMountY = useSharedValue(30);      // input dock slides from +30
  const elementsMountOpacity = useSharedValue(0);
  const inputMountOpacity = useSharedValue(0);
  // ── Rest-pair ("calm home") ─────────────────────────────────────────────
  // The DEFAULT resting home is the centred pair: the awake figure just above
  // the composer, near screen-centre, with NO broadcast bubbles (ONE speaks
  // through the under-box channel line instead). This used to happen only when
  // ONE dozed (sleepSV); now it's the steady rest pose. `restPairGate` is 1 at
  // rest and eases to 0 whenever the home leaves rest (chat/call/sheet/sign-in/
  // profile); `scrollRestFactor` is 1 at scrollY≈0 and unwinds to 0 as the user
  // scrolls into the processes — written from the scroll handler so the early
  // dock worklets (declared above scrollY) can still read it. Both are plain
  // SharedValues so inputMountStyle (declared before scrollY) can read them
  // without a decl-order crash. See [[reanimated-worklet-decl-order]].
  // Starts engaged (1) so the figure rests in the centred pair from the very
  // first frame — the splash dot grows in AT screen-centre and simply stays
  // there (no rise-to-top then drop-back, which read as a jump). Eases to 0 only
  // when the home leaves rest. Paired with orbMountY starting at 0 (the centring
  // now comes from the rest-pair offset, not from an upward mount travel).
  const restPairGate = useSharedValue(1);
  const scrollRestFactor = useSharedValue(1);
  // Idle-sleep progress: 1 = awake / eyes open, 0 = asleep. Declared UP HERE
  // (before inputMountStyle / broadcastCrossfadeStyle reference it) so those
  // useAnimatedStyle worklets don't read it while it's still undefined during
  // the initial synchronous updater run. The withTiming driver + eye/lid
  // derivations live further below, keyed on `orbAsleep`.
  const sleepSV = useSharedValue(1);
  // When the sign-in sheet opens over Home, the orb + "let's connect" line
  // glide DOWN a touch — so they sit centred in the space ABOVE the sheet
  // instead of stranded up top. We read the sheet's LIVE animated index
  // (-1 closed … 0 open) so the orb drops on the way in AND rises back in
  // sync with the close drag — no fixed timer, so there's no lag before the
  // orb returns when the sheet slides down. Worklets map the index to a 0→1
  // drop fraction via interpolate(signInIdx, [-1, 0], [0, 1]).
  //
  // Fallback: when no shared index is wired, drive a local one off the
  // `signInOpen` boolean so it still degrades to a quick timer.
  const fallbackSignInIndex = useSharedValue(-1);
  useEffect(() => {
    if (signInSheetIndex) return; // real index in control — skip the fallback
    fallbackSignInIndex.value = withTiming(signInOpen ? 0 : -1, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [signInOpen, signInSheetIndex, fallbackSignInIndex]);
  const signInIdx = signInSheetIndex ?? fallbackSignInIndex;
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
  // TRUE once the user has scrolled into the cards list. Drives the system
  // status bar: hidden at the resting home (ONE shows its own clock in the
  // date line), visible once you're in the cards.
  const [inCards, setInCards] = useState(false);

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
    // Start at SLEEP_ORB_RAISE so the dot grows in at TRUE screen-centre (the
    // rest-pair offset lands the figure a touch ABOVE centre, so +raise cancels
    // that back to dead-centre); it then RISES by `raise` into the figure's
    // paired resting spot — "a dot that comes up into the figure".
    orbMountY.value = SLEEP_ORB_RAISE;
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
    // Phase 1: the dot RISES from true centre into the figure's paired resting
    // spot (orbMountY: SLEEP_ORB_RAISE → 0) — a small, deliberate "come up".
    orbMountY.value = withDelay(
      RISE_DELAY,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    // Phase 1b: eyes open as the dot rises — it becomes the figure THROUGH the
    // upward motion.
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
  }, [orbMountY, orbEnterScale, elementsMountY, elementsMountOpacity, inputMountY, inputMountOpacity, eyesOpacityMount, SLEEP_ORB_RAISE]);

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
  // 1 during a voice call (fades in over 200ms), 0 otherwise. Declared HERE —
  // above inputMountStyle — so that worklet can read it (a SharedValue must be
  // declared above the worklet that reads it). The driving effect lives below.
  const callHideSV = useSharedValue(0);
  // INSTANT (non-animated) call flag — 1 the moment a call is active. Used to
  // hard-force the dock fully opaque during a call; the animated callHideSV was
  // leaving the call controls semi-transparent (the idle/mount fade dimming the
  // shared dock container), so this bypasses any fade math entirely.
  const callActiveSV = useSharedValue(0);
  const inputMountStyle = useAnimatedStyle(() => {
    // During a CALL the dock is ALWAYS fully solid — no idle/mount fade touches
    // it. (Hard override, not a blend, so it can't end up semi-transparent.)
    if (callActiveSV.value > 0.5) {
      return { opacity: 1, transform: [{ translateY: inputMountY.value }] };
    }
    // Idle rest: the input STAYS present (no sleep fade) and RISES up to sit
    // just beneath the centred figure — ONE + composer as one calm centred
    // pair, not a lone dot. (sleepSV: 1 awake → 0 idle, so (1-sleepSV) ramps
    // the lift in.) Only for the empty home (sleepCenterOK) — with a
    // conversation the orb is a top header, so the input stays put. Only the
    // mount cascade still fades the opacity.
    // Lift to the centred pair whenever EITHER ONE is dozing (1-sleepSV) OR the
    // home is simply at rest (restPairGate × scrollRestFactor) — the latter is
    // the new default so the composer sits just under the figure at steady rest.
    const centerAmt = Math.max(1 - sleepSV.value, restPairGate.value * scrollRestFactor.value);
    const sleepLift = centerAmt * SLEEP_INPUT_LIFT * sleepCenterOK.value;
    return {
      // The composer FADES OUT as ONE dozes (sleepChromeSV) — on sleep the home
      // clears to just the bare black dot at centre; it fades back in on wake.
      opacity: inputMountOpacity.value * sleepChromeSV.value,
      transform: [{ translateY: inputMountY.value - sleepLift }],
    };
  });
  // Tracks whether the list is currently snapped OPEN (processes) vs at rest,
  // so onMomentumScrollEnd fires the detent haptic only on a real transition.
  const atProcessesRef = useRef(false);

  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Deepest NEGATIVE overscroll reached during the current drag (drag DOWN past
  // the top). Checked on release to open Global — the opposite-direction gesture
  // to scrolling UP into the processes.
  const overscrollMin = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      if (e.contentOffset.y < overscrollMin.value) overscrollMin.value = e.contentOffset.y;
      // Unwind the centred rest pair as the user scrolls up into the processes.
      // Written here (not a useDerivedValue) so the dock worklets declared above
      // scrollY can read it without a decl-order crash.
      scrollRestFactor.value = interpolate(
        e.contentOffset.y,
        [0, SNAP_OPEN * 0.25],
        [1, 0],
        Extrapolation.CLAMP,
      );
    },
  });

  // System status bar follows the scroll ITSELF (during the drag, animated) —
  // hidden at the resting home, fading in as soon as the user scrolls up toward
  // the cards, and back out on the way home. Not tied to a settle point.
  useAnimatedReaction(
    () => scrollY.value > 40,
    (isIn, was) => {
      if (isIn !== was) runOnJS(setInCards)(isIn);
    },
  );

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
  // Holds the "hidden" state WHILE Global is open, so the input dock + upgrade
  // line (which fade out during the pull via globalPull) don't snap back while
  // Global is up — and come BACK in sync with the close drag, via the Global
  // sheet's LIVE animated index (-1 closed … 0 open). Reading the live index
  // (not the globalOpen boolean, which only flips AFTER the sheet finishes
  // closing) is what removes the delay before the input returns to the bottom.
  // Falls back to a boolean-timed index when none is wired.
  const fallbackGlobalIndex = useSharedValue(-1);
  useEffect(() => {
    if (globalSheetIndex) return;
    fallbackGlobalIndex.value = withTiming(globalOpen ? 0 : -1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [globalOpen, globalSheetIndex, fallbackGlobalIndex]);
  const globalIdx = globalSheetIndex ?? fallbackGlobalIndex;
  // The single Home→Global transition progress (0 = home at rest, 1 = fully in
  // Global). It takes the MAX of the live pull (finger-tracked open gesture) and
  // the open-sheet state (from the sheet's live index), so the orb stays DIVED
  // into the world the whole time Global is open and only rises back in sync
  // with the close drag — the orb never snaps back to its home spot while Global
  // is still up (mirrors the profile sheet's finger-tracked exit/entry).
  const globalProgress = useDerivedValue(() => {
    'worklet';
    const openP = interpolate(globalIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    return Math.max(globalPull.value, openP);
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

  // The home rest ALWAYS centres the figure + composer now — the chat lives in
  // its own mode (chatActive), so a persisted conversation no longer pins the
  // orb as a top header on the rest home. Only chat mode disables the pair
  // centring (the composer drops to the bottom for the thread).
  useEffect(() => {
    sleepCenterOK.value = chatActive ? 0 : 1;
  }, [chatActive, sleepCenterOK]);

  // The centred rest pair is the DEFAULT home pose — eased in whenever the home
  // is simply at rest, and eased out the moment it leaves rest (opening the
  // chat, a call, a sheet, sign-in or a profile). Scroll unwinding is handled
  // separately by scrollRestFactor.
  useEffect(() => {
    // Profile / settings / GLOBAL are an EXCEPTION: the figure + composer stay
    // centred (Global's own transition dives the figure + fades the composer),
    // so don't unwind the pair for them even though they count as an open sheet —
    // otherwise the figure rises + the composer drops (the same bad animation the
    // profile had).
    const overlayUnwinds = anySheetOpen && !profileOpen && !settingsOpen && !globalOpen;
    const atRest = !chatActive && !callActive && !overlayUnwinds && !signInOpen && !inputFocused;
    restPairGate.value = withTiming(atRest ? 1 : 0, {
      duration: atRest ? 320 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [chatActive, callActive, anySheetOpen, signInOpen, profileOpen, settingsOpen, globalOpen, inputFocused, restPairGate]);

  // ONE's status line INSIDE the composer — shown ONLY in the HOME rest pose
  // (gone the moment you scroll into the processes / open the chat). It is a
  // quiet, ALWAYS-present subtle word/short line that softly CROSSFADES as it
  // changes (InputBar animates the opacity) — never an empty box that a full
  // sentence suddenly pops into (that read as startling). ONE is simply, calmly
  // present. Short + gentle; neutral Hebrew so it fits any gender.
  const statusPool = useMemo<string[]>(() => {
    const he = lang === 'he';
    return he
      ? ['אני כאן', 'מקשיב', 'כאן בשבילך', 'על מה נדבר?', 'אפשר לדבר על הכול', 'ONE']
      : ["I'm here", 'Listening', 'Here for you', "What's on your mind?", 'We can talk about anything', 'ONE'];
  }, [lang]);
  const [idleLineIdx, setIdleLineIdx] = useState(0);
  const idleLineActive = hasOnboarded && !chatActive && !inCards;
  useEffect(() => {
    if (!idleLineActive) return;
    // A calm, slow cadence — ONE isn't announcing, just quietly there.
    const id = setInterval(() => setIdleLineIdx((i) => i + 1), 5200);
    return () => clearInterval(id);
  }, [idleLineActive]);
  const idleLine = idleLineActive ? statusPool[idleLineIdx % statusPool.length] : undefined;

  // The hero's eyes fade in on the splash → home handoff (eyesOpacityMount) and
  // stay open at rest. Pulling toward Global fades them out, AND idle-sleep now
  // closes them too: as ONE dozes (sleepSV 1→0) it returns to the bare black dot
  // it started as (the splash dot), still centred.
  const heroEyesOpacity = useDerivedValue(() => {
    'worklet';
    const fade = interpolate(globalProgress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP);
    return eyesOpacityMount.value * (1 - fade) * sleepSV.value;
  });

  // Combined lid openness for the hero Orb's `eyeOpen`: Global pull closes the
  // lids EARLY (fully shut by ~40% of the sweep), and idle-sleep closes them as
  // ONE settles to a dot (sleepSV 1→0).
  const heroEyeOpen = useDerivedValue(() => {
    'worklet';
    const pullClose = interpolate(globalProgress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP);
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

  // Settings (long-press the orb) uses the SAME figure→dot hand-off as the
  // profile, but it has no finger-tracked index, so drive a simple 0→1 value
  // off the boolean.
  const settingsDotSV = useSharedValue(0);
  useEffect(() => {
    settingsDotSV.value = withTiming(settingsOpen ? 1 : 0, {
      duration: settingsOpen ? 220 : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [settingsOpen, settingsDotSV]);

  // How far the figure has become its bare dot for the profile / settings
  // hand-off (0 = full figure, 1 = shrunk dot). Opening EITHER shrinks the
  // figure in place (eyes shut) — it does NOT rise or drop the composer.
  const dotProgress = useDerivedValue(() => {
    'worklet';
    const profilePc = interpolate(profileIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    return Math.max(profilePc, settingsDotSV.value);
  });

  // Opening the profile/settings no longer makes the hero VANISH — instead it
  // "goes to sleep": the eyes shut and it becomes the bare black dot (splash
  // state), then re-open on close. 1 while closed, 0 once open. Folded into the
  // hero's eye opacity + lid openness.
  const profileEyeFactor = useDerivedValue(() => {
    'worklet';
    return 1 - dotProgress.value;
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

  // Keyboard-open signal (the TextInput is focused). The header orb SHRINKS
  // only while the keyboard is up — when it closes the orb eases back to its
  // bigger resting size. 1 = keyboard up, 0 = closed.
  const kbOpenSV = useSharedValue(0);
  useEffect(() => {
    kbOpenSV.value = withTiming(inputFocused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [inputFocused, kbOpenSV]);

  // 0 closed → 1 open for the processes pull-up sheet; drives the backdrop that
  // dims the chat behind the sheet while it's open.
  // Kept at 0 (the processes are inline now, no sheet) — still read by the
  // chevron's opacity math below.
  const sheetProgress = useSharedValue(0);
  // Idle-fade opacity shared by BOTH hint chevrons (declared here so the bottom
  // chevron's style below can read it). 0 at rest/during the splash; wakeChevron
  // fades them in → holds → fades out, and any home touch wakes them again.
  const chevronIdleOpacity = useSharedValue(0);
  const upChevronOpacity = useSharedValue(0);
  // The down-chevron (opens the processes list) — the SAME idle fade as the top
  // one (so it never flashes over the splash and disappears after its hold),
  // further faded out as the user scrolls into the cards / the keyboard opens /
  // the sheet opens.
  const processesChevronStyle = useAnimatedStyle(() => ({
    opacity:
      chevronIdleOpacity.value *
      interpolate(scrollY.value, [0, SNAP_OPEN * 0.25], [1, 0], Extrapolation.CLAMP) *
      (1 - kbOpenSV.value) *
      (1 - sheetProgress.value),
  }));

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

  // Track "there's a conversation" on the worklet thread. The MOMENT a thread
  // exists (at rest too, not only while focused) the big centred orb shrinks up
  // into a COMPACT HEADER at the top, so the conversation reads from just under
  // it — the chat sits HIGH on the page, never pushed down toward the bottom by
  // a big orb. The big resting orb is for the empty / fresh home only.
  const hasChatMessagesSV = useSharedValue(0);
  useEffect(() => {
    hasChatMessagesSV.value = withTiming(sessionMessages.length > 0 ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [sessionMessages.length, hasChatMessagesSV]);

  // Collapse fraction: 0 = resting hero (big centred Orb + broadcast),
  // 1 = compact header (small Orb up top + identity name). Driven by EITHER
  // scrolling the processes list up OR sending the first chat message —
  // whichever is more collapsed wins. Chat-active alone (input focused but
  // nothing sent) does NOT collapse — the big hero stays put, just lifted a
  // touch for the keyboard.
  const collapseFrac = useDerivedValue(() => {
    'worklet';
    // On the home, collapse is driven by SCROLL (big at rest, shrinks to the
    // compact header as you scroll into the processes).
    const scrollP = Math.max(0, Math.min(1, scrollY.value / SNAP_OPEN));
    // In CHAT the figure is PINNED small at the top — a fixed size/place, NOT
    // linked to the chat scroll (only the eyes track the scroll, via eyeLookY).
    // So force full collapse while chatActive.
    return Math.max(scrollP, chatActiveSV.value);
  });

  // Lift the hero (orb + CTA) when chat opens so the keyboard doesn't
  // crowd them. Pulled back from −130 to −80 per latest pass — the hero
  // was sitting too high; this gives it a touch more vertical breathing
  // room without colliding with the keyboard.
  const chatOpenLiftSV = useDerivedValue(() => {
    'worklet';
    // Keyboard open (composing, with OR without a thread): the orb + bubbles ease
    // UP a little to leave room above the keyboard — it's the same page, just
    // lifting. Driven by the keyboard (kbOpenSV), so the chat behaves exactly
    // like the empty home: same lift whether or not a conversation exists.
    return kbOpenSV.value * -34;
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
    // Rest-pair lift — carried in BOTH dock transforms so the input rises to the
    // centred pair no matter which style wins the flatten. Active at steady rest
    // (restPairGate × scrollRestFactor) as well as while dozing (1-sleepSV).
    const centerAmt = Math.max(1 - sleepSV.value, restPairGate.value * scrollRestFactor.value);
    const sleepLift = centerAmt * SLEEP_INPUT_LIFT * sleepCenterOK.value;
    if (isAndroid) {
      const kb = keyboardHeight.value;
      const lift = kb > 1 ? kb + KB_GAP : insetsBottom;
      return { transform: [{ translateY: -lift - sleepLift }] };
    }
    return { transform: [{ translateY: inputKeyboardLift.value - sleepLift }] };
  });

  // A bottom gradient fade that RIDES UP with the keyboard (like the home's
  // bottom EdgeBar, but above the keyboard) so the chat fades softly behind the
  // input instead of cutting off hard against the keyboard. Only while the
  // keyboard is up.
  const kbBottomFadeStyle = useAnimatedStyle(() => {
    const kb = isAndroid
      ? (keyboardHeight.value > 1 ? keyboardHeight.value : 0)
      : Math.max(0, -inputKeyboardLift.value);
    return { opacity: kbOpenSV.value, transform: [{ translateY: -kb }] };
  });

  // Input capsule GROWS at the resting hero and SHRINKS back to normal as the
  // user scrolls down into the cards (and whenever a chat is active). Gives the
  // composer presence as "now" without crowding the list.
  const inputScaleStyle = useAnimatedStyle(() => {
    const p = interpolate(
      scrollY.value,
      [0, SNAP_OPEN * 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    );
    // The capsule keeps its size (no shrink) — it only DROPS to the bottom as
    // the user scrolls into the cards (its small rest-lift returns to 0).
    const lift = (1 - p) * (1 - chatActiveSV.value) * -8;
    return { transform: [{ translateY: lift }] };
  });

  // The right call button is LARGER at the resting Home (a prominent invitation
  // to talk to ONE). It stays LARGE everywhere — at rest, in the processes
  // list, AND while composing (keyboard open): ONE's voice is always one big
  // tap away, and the button doesn't shrink when the keyboard opens.
  const voiceBtnScaleStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: 1.2 }] };
  });

  // Rest-only chrome (the upgrade line): fades AND collapses to zero height as
  // the user scrolls toward the cards, so it stops holding the input up — the
  // capsule then drops flush to the very bottom.
  const restChromeStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, SNAP_OPEN * 0.25], [1, 0], Extrapolation.CLAMP);
    // Collapse + fade the upgrade line while the keyboard is up, and ease it
    // smoothly back in when the keyboard closes (kbOpenSV ramps over ~220ms) —
    // no abrupt pop under the input.
    const kb = 1 - kbOpenSV.value;
    return { opacity: p * kb, height: p * kb * 30, marginTop: p * kb * 8 };
  });

  // Fades the input dock + upgrade line out with the SAME Global transition
  // progress as the orb (globalProgress), so input + figure move together.
  const globalHideStyle = useAnimatedStyle(() => ({ opacity: 1 - globalProgress.value }));
  // The upgrade line already fades + collapses as the user scrolls DOWN into the
  // cards (restChrome). Fold the Global fade in by MULTIPLYING, so both gestures
  // work without one clobbering the other's opacity.
  const homeUpgradeStyle = useAnimatedStyle(() => {
    const scrollP = interpolate(scrollY.value, [0, SNAP_OPEN * 0.25], [1, 0], Extrapolation.CLAMP);
    // Also fades away with the composer as ONE dozes (sleepChromeSV) — on sleep
    // the whole surface clears to the bare dot.
    return { opacity: scrollP * (1 - globalProgress.value) * sleepChromeSV.value, height: scrollP * 30, marginTop: scrollP * 8 };
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
  const HERO_OPEN_ORB_SCALE = 52 / HOME_ORB_SIZE;     // chat-mode orb WHILE TYPING (keyboard up) — matches the X/⋮ buttons
  // Chat header at REST (keyboard closed): the orb is noticeably BIGGER — it
  // steps back to a compact size only when you open the keyboard to type.
  const HERO_HEADER_REST_SCALE = 82 / HOME_ORB_SIZE;
  // In the PROCESSES LIST (scroll collapse) the head reads bigger than in chat —
  // it's the agent presiding over the list, not a compact chat avatar.
  const HERO_PROCESSES_ORB_SCALE = 80 / HOME_ORB_SIZE;
  // Chat keeps the smaller, compact head (the size the user confirmed is right).
  const HERO_CHAT_ORB_SCALE = 66 / HOME_ORB_SIZE;
  // How much the hero shrinks as the profile opens — it dives DOWN to screen
  // centre while shrinking, so it reads as ONE gliding into its profile (and
  // rising back out on close). Shrinks to ~half, not a vanish.
  const PROFILE_ORB_SHRINK = 0.52;
  // Idle rest keeps ONE as the FIGURE, and it SHRINKS a touch so it reads as a
  // calm resting face that sits clearly ABOVE the composer (never touching it),
  // not a big orb crowding the box.
  const SLEEP_ORB_GROW = -0.18;
  // Sits just below the collapsed processes-list Orb (66px tall from top 12 →
  // visual bottom ~87). 90 hugs the face closely without tucking under it —
  // 100 read as floating too far below the head.
  const HERO_OPEN_TEXT_TOP = 90;

  // During a call the home face + broadcast must FULLY disappear. Driven on the
  // UI thread because a static `opacity: 0` after an animated style loses — the
  // orb's own worklet keeps re-writing opacity each frame, so the face peeked
  // through ("another agent below"). Multiplying inside the worklets wins.
  // (callHideSV is declared higher up, above inputMountStyle, so that worklet can
  // read it too.)
  useEffect(() => {
    // Snappy hero↔call crossfade (the call orb's opacity is callHideSV too), so
    // the swap is quick and the two orbs don't co-exist as solids on the list.
    callHideSV.value = withTiming(callActive ? 1 : 0, { duration: 130 });
    // Instant flag (no timing) — the dock's hard "solid during call" override.
    callActiveSV.value = callActive ? 1 : 0;
    // Force BOTH inputs to the dock's opacity fully OPEN during a call, at the JS
    // level, so it can NEVER be dimmed regardless of home state or a stale
    // worklet: sleepChromeSV (idle-doze fade) AND inputMountOpacity (mount
    // cascade). dock opacity = inputMountOpacity × sleepChromeSV = 1 × 1 = 1.
    if (callActive) {
      sleepChromeSV.value = 1;
      inputMountOpacity.value = 1;
    }
  }, [callActive, callHideSV, callActiveSV, sleepChromeSV, inputMountOpacity]);
  // Mirror the call flag up to the navigator (so a sheet over Home can wear the
  // call ring). Home still owns the call itself.
  useEffect(() => {
    onCallActiveChange?.(callActive);
  }, [callActive, onCallActiveChange]);

  const heroOrbStyle = useAnimatedStyle(() => {
    const f = collapseFrac.value;
    const ty = f * (HERO_OPEN_ORB_TOP - HERO_CENTER_TOP);
    // Mount "pop in" scale (0 → 1) composes with the collapse scale so
    // the orb starts INVISIBLE on first paint, grows in at centre, and
    // only then begins the cascade to its Home position.
    // Scrolling down collapses the orb to the processes-list header size — same
    // as the empty home. (No separate "chat header" size: the chat uses the
    // identical big-orb-at-rest treatment as the home.)
    // Chat uses the smaller compact head; the processes list uses the bigger
    // one (blend by chatActiveSV so each mode lands at its own size).
    const collapsedTarget =
      HERO_PROCESSES_ORB_SCALE + (HERO_CHAT_ORB_SCALE - HERO_PROCESSES_ORB_SCALE) * chatActiveSV.value;
    const collapseScale = 1 - f * (1 - collapsedTarget);
    // Profile / settings hand-off: the figure STAYS in place and just shrinks
    // (eyes shut via heroEye*Final) into a bare black dot — it does NOT rise or
    // drop the composer (restPairGate is kept engaged for these). `pc` = 0 while
    // closed, 1 once open (profile finger-tracked OR settings). The scale eases
    // to PROFILE_ORB_SHRINK.
    const pc = dotProgress.value;
    const profileScale = 1 - pc * (1 - PROFILE_ORB_SHRINK);
    // A SMALL glide (just the pair-raise) so the shrinking dot settles to TRUE
    // centre — consistent with the splash / sleep dot. Gated by (1 - f): only
    // the resting hero travels.
    const profileDrop = pc * SLEEP_ORB_RAISE * (1 - f);
    // Global pull: glide DOWN to mid-screen and shrink ~40% toward a bare dot.
    const gp = globalProgress.value;
    // Idle rest: the figure glides DOWN toward screen centre, but stops a touch
    // ABOVE it (minus SLEEP_ORB_RAISE) so that it + the input lifting up from the
    // bottom land as one pair centred together (figure over composer). Gated by
    // (1 - f) so it only travels from the RESTING hero, never while scrolled into
    // the processes list.
    // Glide DOWN to the centred pose at steady rest (restPairGate) as well as
    // while dozing (1-sleepSV); `(1 - f)` unwinds it as the user scrolls up into
    // the processes. The pair RAISE (figure sitting a touch above centre, over
    // the composer) only applies while awake — as ONE dozes (sleepSV→0) the
    // figure settles to TRUE centre, back to the bare splash dot, as the
    // composer fades away.
    const centerAmt = Math.max(1 - sleepSV.value, restPairGate.value * scrollRestFactor.value);
    const pairRaise = SLEEP_ORB_RAISE * sleepSV.value;
    const sleepDrop = centerAmt * (ORB_FROM_CENTER_OFFSET - pairRaise) * (1 - f);
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
            // NO keyboard lift for the figure — in chat it's pinned at the top at
            // a fixed size/place; the old chatOpenLiftSV made it ride too HIGH
            // when the keyboard opened. (The composer still rises with the kb.)
            gp * PULL_CENTER_DELTA +
            sleepDrop +
            profileDrop +
            interpolate(signInIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP) * 130,
        },
        {
          scale:
            collapseScale *
            orbEnterScale.value *
            (1 - 0.4 * gp) *
            profileScale *
            sleepGrow,
          // NO keyboard shrink — the keyboard-closed size (collapseScale) is the
          // right size in chat; shrinking it further on keyboard-open made the
          // figure too small.
        },
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
            chatOpenLiftSV.value +
            // Move down with the orb when the sign-in sheet is open — tracked
            // to the sheet's live index so it rises back in sync on close.
            interpolate(signInIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP) * 130,
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
        1 - interpolate(globalProgress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
        // 6) in a call — the broadcast line goes away with the home face.
        1 - callHideSV.value,
        // 7) ONE fell asleep — the surroundings clear FAST (sleepChromeSV), so
        //    the broadcast line is gone well before the orb finishes its slow
        //    glide down to the centred dot.
        sleepChromeSV.value,
      ),
    };
  });

  // The inline conversation thread fades out as ONE goes idle (same fast
  // sleepChromeSV as the opener), leaving just the centred figure + composer.
  const threadSleepFadeStyle = useAnimatedStyle(() => ({
    opacity: sleepChromeSV.value,
  }));

  const identityCrossfadeStyle = useAnimatedStyle(() => ({
    // Identity row fades in over the SECOND half of collapse — only when
    // not in chat (in chat we show the X+⋮ header instead, so this stays
    // hidden via the multiply by (1 - chatActiveSV)).
    opacity:
      interpolate(collapseFrac.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) *
      (1 - chatActiveSV.value) *
      (1 - globalProgress.value) *
      (1 - callHideSV.value),
  }));

  // Chevron hint — deliberately DEAD SIMPLE. No motion, no drift, no idle loop.
  // The two arrows just fade in gently together, hold a moment, and fade out.
  // They reveal on entering Home (after the splash settles) and on ANY touch of
  // the screen — just enough to say "there's more above and below" without ever
  // moving around or hijacking the view.
  const CHEVRON_HOLD_MS = 2000;
  const CHEVRON_PEAK_OPACITY = 0.4;
  // First reveal waits for the splash/intro (dot grows → eyes open → rise →
  // broadcast settles, ~1.8s) so the arrows never flash over the rising face.
  const CHEVRON_INTRO_DELAY_MS = 1900;
  // (chevronIdleOpacity / upChevronOpacity are declared higher up, above
  // processesChevronStyle, so that worklet can read the idle fade.)

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
    // Sleep used to be native-only — its transform-heavy centre-drop mis-rendered
    // on web (orb vanished). The figure now rests centred already (rest-pair), so
    // sleep no longer moves it — it just closes the eyes to a bare dot in place —
    // which is web-safe, so it runs on every platform now.
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
    noteInteract(); // resets the onboarding-hint idle timer
    revealChevrons();
    if (!chatActive && !callActive && !anySheetOpen) {
      resumeBroadcast();
      // Waking after a long idle doze counts as "coming back" → a fresh opener.
      if (orbAsleep) bumpGreeting();
      setOrbAsleep(false);
      scheduleSleep();
    }
  }, [noteInteract, revealChevrons, resumeBroadcast, chatActive, callActive, anySheetOpen, scheduleSleep, orbAsleep, bumpGreeting]);

  // Start the doze countdown when Home settles at rest; cancel + wake the
  // instant any overlay (chat / call / sheet) takes over. Returning to a bare
  // home (a chat / call / sheet just closed) also refreshes the opening line —
  // an actual state change, not a ticking clock. `prevHomeRestRef` keeps it to
  // the false→true transition (never on the initial mount).
  const prevHomeRestRef = useRef(true);
  useEffect(() => {
    if (homeAtRest && !prevHomeRestRef.current) bumpGreeting();
    prevHomeRestRef.current = homeAtRest;
    if (!homeAtRest) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      setOrbAsleep(false);
      return;
    }
    scheduleSleep();
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [homeAtRest, scheduleSleep, bumpGreeting]);

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
      (1 - globalProgress.value),
  }));

  // Cards fade behind the chat overlay when chat is active. Reads as the
  // chat being its own surface rather than an overlay over busy content.
  // When the chat slides off (chatExitProgress → 1) the dim lifts in sync so
  // cards return to full opacity AS the chat leaves, not after a hard cut.
  const cardsBehindChatStyle = useAnimatedStyle(() => ({
    opacity: 1 - chatActiveSV.value * (1 - chatExitProgress.value) * 0.8,
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
  // Small autonomous "I'm here" drift of the call orb — NOT a mechanical circle
  // loop, but occasional gentle shifts to the side with pauses between, so it
  // reads alive rather than stuck. X and Y run independent, differently-timed
  // sequences so the motion never looks like a repeating pattern.
  const callDriftX = useSharedValue(0);
  const callDriftY = useSharedValue(0);
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
      // Occasional gentle shifts with pauses between — not a constant loop.
      // Different offsets/durations/pauses per axis → organic wander.
      const ease = Easing.inOut(Easing.quad);
      callDriftX.value = 0;
      callDriftX.value = withRepeat(
        withSequence(
          withDelay(2200, withTiming(7, { duration: 1500, easing: ease })),
          withDelay(2600, withTiming(-6, { duration: 1700, easing: ease })),
          withDelay(1900, withTiming(3, { duration: 1400, easing: ease })),
          withDelay(3000, withTiming(0, { duration: 1600, easing: ease })),
        ),
        -1,
        false,
      );
      callDriftY.value = 0;
      callDriftY.value = withRepeat(
        withSequence(
          withDelay(3400, withTiming(-5, { duration: 1600, easing: ease })),
          withDelay(2100, withTiming(4, { duration: 1500, easing: ease })),
          withDelay(3200, withTiming(-2, { duration: 1400, easing: ease })),
          withDelay(2400, withTiming(0, { duration: 1600, easing: ease })),
        ),
        -1,
        false,
      );
    } else {
      callRingPulse.value = 1;
      callDriftX.value = 0;
      callDriftY.value = 0;
    }
  }, [callActive, callOrbX, callOrbY, callOrbScale, callRingPulse, callDriftX, callDriftY]);

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
  // Computed IN-render (not a module const) so Fast Refresh actually applies
  // the position: the call orb sits at the home orb's spot (top), and the
  // scroll-glide delta is relative to that.
  const callOrbTop = HERO_CENTER_TOP + HOME_ORB_SIZE / 2 - (CALL_ORB_SIZE + 20) / 2;
  const callTopDelta = -(callOrbTop - 14);
  const callOrbStyle = useAnimatedStyle(() => {
    // FIXED in place like the home orb — no free drag (the orb must not move
    // from its spot, and can't be dragged). The only motion is the shared home
    // behaviour: scrolling into the processes list glides it UP + a touch
    // smaller so it docks at the top, and scrolling back returns it.
    const sp = interpolate(scrollY.value, [0, SNAP_OPEN * 0.5], [0, 1], Extrapolation.CLAMP);
    // Autonomous "I'm here" drift — occasional gentle shifts (callDriftX/Y run
    // eased sequences with pauses), fading out as the orb docks up on scroll.
    const f = 1 - sp;
    // Profile hand-off DURING a call — the SAME dive as the resting hero: the
    // call orb glides DOWN to screen centre + shrinks + fades as ONE's profile
    // rises over it, and rises back out on close (finger-tracked via profileIdx).
    const pc = interpolate(profileIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    const profileDrop = pc * ORB_FROM_CENTER_OFFSET * f;
    const profileScale = 1 - pc * (1 - PROFILE_ORB_SHRINK);
    return {
      // CROSSFADE with the hero orb: the call orb fades IN (callHideSV 0→1) at
      // the exact rate the hero orb fades OUT (opacity 1 − callHideSV), so the
      // two never both read as solid at once — no "double orb" on call start,
      // even in the collapsed list where their heights differ.
      opacity: callHideSV.value * (1 - pc),
      transform: [
        { translateX: callDriftX.value * f * (1 - pc) },
        { translateY: sp * callTopDelta + callDriftY.value * f + profileDrop },
        { scale: callOrbScale.value * (1 - 0.22 * sp) * profileScale },
      ],
    };
  });
  // Subtle ring hugging the orb — barely breathes.
  const callRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: callRingPulse.value }],
  }));
  // The call's "on what shall we talk" line behaves like the home broadcast:
  // it sits at the top under the orb and FADES + glides up as the user scrolls
  // into the cards (so it never overlaps them), reappearing on scroll back.
  const callTalkStyle = useAnimatedStyle(() => {
    const sp = interpolate(scrollY.value, [0, SNAP_OPEN * 0.4], [0, 1], Extrapolation.CLAMP);
    // Fade the call line out too as the profile rises over the call (pc 0→1).
    const pc = interpolate(profileIdx.value, [-1, 0], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: (1 - sp) * (1 - pc),
      transform: [{ translateY: sp * callTopDelta }],
    };
  });

  // The call dock, rendered at the TOP LEVEL (a sibling of the whole home tree),
  // so NOTHING in the home layout can ever cover or dim it — the source of the
  // stubborn "faded call bar from home". Plain opacity (no inputMountStyle), so
  // the idle-doze / mount fades that live in the home tree can't touch it. The
  // bottom fade sits before it (below it) to blur the cards.
  const callDockNode = (
    <>
      <EdgeBars top={false} bottomHeight={150} style={styles.callBottomFade} />
      {/* bottom: insets.bottom — the home dock gets this from sitting inside the
          SafeAreaView's padded content; this dock is a direct child, so it must
          add the safe-area inset itself (otherwise it sat flush at the very
          bottom, ignoring the home-indicator gap). */}
      <Animated.View style={[styles.inputDock, styles.dockOnTop, { bottom: insets.bottom }, inputDockStyle]}>
        {/* Same inputNarrow + inputScaleStyle wrapper as the home dock, so the
            capsule's width, side margins and vertical rest-lift (-8) match it
            exactly. */}
        <Animated.View style={[styles.inputNarrow, inputScaleStyle]}>
          <InputBar
            value=""
            onChangeText={() => {}}
            callMode
            onEndCall={endCall}
            onPressPlus={onCreateProcess}
            focusSignal={chatReturnFocus}
            voiceBtnStyle={voiceBtnScaleStyle as never}
            callControls={
              <>
                <Pressable
                  onPress={() => { haptic.select(); setSpeakerOn((v) => !v); }}
                  style={[styles.callCtrlBtn, { backgroundColor: speakerOn ? colors.text : colors.callCtrlRest }]}
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
                  style={[styles.callCtrlBtn, { backgroundColor: muted ? '#EF4444' : colors.callCtrlRest }]}
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
                  style={[styles.callCtrlBtn, { backgroundColor: cameraOn ? colors.text : colors.callCtrlRest }]}
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
        </Animated.View>
        {/* No Upgrade line in call mode — the call surface stays clean. */}
      </Animated.View>
    </>
  );

  // Spaces / processes — rendered inside the pull-up sheet (below), not in the
  // chat scroll. Same content as before, just relocated. Only when onboarded.
  const processesContent =
    cardGroups.length === 0 ? (
      <View style={styles.emptyCardsState}>
        <StackedCardsIcon size={36} color={colors.textSecondary} />
        <Text style={[styles.emptyCardsLine, { color: colors.textSecondary }]}>
          {lang === 'he'
            ? 'עדיין אין כאן תהליכים.\nספרו לי על משהו שתרצו לקדם.'
            : 'Nothing here yet.\nTell me something you want to move forward.'}
        </Text>
      </View>
    ) : (
      <>
        {cardGroups.map(({ idn, items }) => {
          const collapsed = collapsedGroups.has(idn.id);
          const ProfileIcon =
            idn.type === 'business'
              ? BriefcaseIcon
              : idn.type === 'family'
                ? HouseIcon
                : PersonIcon;
          return (
            <View key={idn.id} style={styles.drawer}>
              <Pressable
                onPress={() => toggleGroup(idn.id)}
                onLongPress={() => promptDeleteSpace(idn.id, idn.name)}
                delayLongPress={450}
                style={[styles.drawerHeader, { direction: lang === 'he' ? 'rtl' : 'ltr' }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: !collapsed }}
                accessibilityLabel={idn.name}
              >
                <ProfileIcon size={17} color={colors.text} />
                <Text style={[styles.drawerTitle, { color: colors.text }]} numberOfLines={1}>
                  {idn.name || (lang === 'he' ? 'אישי' : 'Personal')}
                </Text>
                <View style={[styles.drawerCountPill, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.drawerCount, { color: colors.textSecondary }]}>
                    {items.length}
                  </Text>
                </View>
                <View style={styles.flex1} />
                <View
                  style={{
                    transform: [
                      { rotate: collapsed ? (lang === 'he' ? '90deg' : '-90deg') : '0deg' },
                    ],
                  }}
                >
                  <ArrowDownIcon size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
              {!collapsed && (
                <View style={styles.drawerBody}>
                  {items.length === 0 && (
                    <Text style={[styles.drawerEmptyHint, { color: colors.textSecondary }, rtlText(lang)]}>
                      {lang === 'he' ? 'עדיין אין תהליכים במרחב הזה.' : 'No processes in this space yet.'}
                    </Text>
                  )}
                  {items.map((u, ci) => (
                    <Animated.View key={u.id} entering={FadeIn.duration(240).delay(ci * 40)}>
                      <UnitCard
                        unit={u}
                        onPress={() => onTapUnit(u.id)}
                        onLongPress={() => onLongPressUnit?.(u.id)}
                        onDelete={() => removeUnit(u.id)}
                        onPin={() =>
                          updateUnit(u.id, { unreadUpdates: (u.unreadUpdates ?? 0) + 1 })
                        }
                        onShare={() => {
                          const summary = [
                            `${u.emoji} ${u.title}`,
                            u.latestBroadcastText?.[0] ?? '',
                            lang === 'he' ? '\nנשלח מ-ONE' : '\nShared from ONE',
                          ]
                            .filter(Boolean)
                            .join('\n');
                          Share.share({ message: summary }).catch(() => {});
                        }}
                      />
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Pressable
          onPress={() => { haptic.tap(); onTapHeader?.(); }}
          style={[styles.addSpaceBtn, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={lang === 'he' ? 'מרחב חדש' : 'New space'}
        >
          <PlusIcon size={16} color={colors.textSecondary} />
          <Text style={[styles.addSpaceText, { color: colors.textSecondary }]}>
            {lang === 'he' ? 'מרחב חדש' : 'New space'}
          </Text>
        </Pressable>
      </>
    );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Hidden through the mount cascade (clean, chrome-free intro), then
          fades in as the broadcast + input dock arrive. Bar contents follow
          the theme so the clock stays legible in light AND dark. */}
      {/* Home owns the status bar ONLY while no unit sheet is open. When a unit
          sheet opens, THIS one unmounts and the sheet's own <StatusBar> becomes
          the SOLE controller — so there are never two StatusBars fighting (that
          competition was the white-clock "flick" on open). No system clock bar at
          the resting home (ONE shows its own time in the hero's date line); it
          appears only in the cards list or while writing. */}
      {!unitOpen && (
        <StatusBar
          hidden={statusBarHidden || (!inCards && !chatActive)}
          animated
          barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        />
      )}
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
            <GestureDetector gesture={profileSwipe}>
            <Animated.ScrollView
              ref={scrollRef}
              style={styles.flex1}
              onScroll={scrollHandler}
              // Starting a drag is a touch — gently reveal the arrows + reset the
              // overscroll tracker for the Global gesture.
              onScrollBeginDrag={() => {
                noteInteract();
                revealChevrons();
                overscrollMin.value = 0;
              }}
              // Bounce at the top so a DOWNWARD drag overscrolls into negative
              // offset — that's the Global gesture (the opposite of scrolling UP
              // into the processes).
              alwaysBounceVertical
              // Drag DOWN past the top (a deliberate overscroll) → open Global —
              // the OPPOSITE-direction gesture to scrolling up into the processes.
              onScrollEndDrag={() => {
                if (
                  overscrollMin.value <= -GLOBAL_OPEN_THRESHOLD &&
                  onOpenGlobal && !chatActive && !callActive && !anySheetOpen && !signInOpen
                ) {
                  seenGlobalRef.current = true;
                  onOpenGlobal();
                }
                overscrollMin.value = 0;
              }}
              // After the natural momentum settles, GENTLY glide to the nearest
              // ideal position (home 0 or the open list SNAP_OPEN) if it stopped
              // part-way — a smooth animated scroll, not a hard snap. Only in the
              // home↔list band; past the list the longer list free-scrolls.
              onMomentumScrollEnd={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                const open = y > SNAP_OPEN * 0.5;
                if (open) seenProcessesRef.current = true; // learned it
                if (open !== atProcessesRef.current) {
                  atProcessesRef.current = open;
                  haptic.select();
                }
                if (!chatActiveRef.current && y > 4 && y < SNAP_OPEN - 4) {
                  scrollRef.current?.scrollTo({ y: open ? SNAP_OPEN : 0, animated: true });
                }
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              // Drag the conversation to lower the keyboard — no X / close
              // button; the keyboard just opens and closes on the same page.
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              // Free-scroll between the resting home and the processes — the hard
              // snapToOffsets snap read as too aggressive (it yanked you to 0 or
              // SNAP_OPEN). Natural deceleration lets the list settle where you
              // leave it; the down-chevron still scrolls it open programmatically.
              snapToEnd={false}
              decelerationRate="normal"
              // The conversation is inline scroll content now, so the list must
              // stay scrollable while composing — you scroll UP through the
              // thread with the keyboard open. (It used to lock here because the
              // chat was a separate overlay that owned the drag.)
              scrollEnabled
              contentContainerStyle={{
                // In chat/call the hero region is bottom-anchored (its own
                // paddingBottom lifts the newest bubble above the input), so no
                // extra bottom padding here; on the home it clears the dock.
                paddingBottom: (chatActive || callActive) ? 8 : INPUT_BAR_H + 58,
              }}
            >
              {/* Hero spacer — the Orb + broadcast are rendered as an overlay
                  ABOVE this; the spacer just reserves the room they occupy
                  inside the scroll content. Doubles as a giant tap target
                  that cycles the broadcast (user request: "tapping anywhere
                  on Home advances the line"). The orb, broadcast text, and
                  cards each capture their own taps before this catches. */}
              {/* Hero region — fills the screen at rest (minHeight) so the cards
                  stay below the fold and the fusion geometry is preserved. The
                  Orb + greeting are absolute overlays ABOVE this. It holds the
                  big tap target AND the inline CONVERSATION THREAD, so the home
                  is literally ONE scroll: orb → conversation → cards. No
                  separate chat window, no mode switch — focusing the input just
                  raises the keyboard over the same page. */}
              <View style={[{ minHeight: HERO_REST_H }, (chatActive || callActive) && styles.heroChatBottom]}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={onBroadcastTap}
                  onLongPress={onBroadcastLongPress}
                  onPressOut={onBroadcastRelease}
                  delayLongPress={450}
                  accessibilityLabel="Next broadcast. Hold to answer by voice."
                />
                {(chatActive || callActive) && sessionMessages.length > 0 && (
                  <Animated.View
                    style={[styles.threadInline, threadSleepFadeStyle]}
                    onLayout={(e) => {
                      threadBottomRef.current =
                        e.nativeEvent.layout.y + e.nativeEvent.layout.height;
                      // The thread grew (new bubble / process widget) — pull it
                      // up above the keyboard now that its real height is known.
                      if (chatActiveRef.current) scrollToLatest();
                    }}
                  >
                    {visibleMessages.map((m, idx) => {
                      // Timestamp under the LAST message in a close-in-time run
                      // from one speaker — keeps the thread from stamp-soup.
                      const next = visibleMessages[idx + 1];
                      const showStamp =
                        !next ||
                        next.from !== m.from ||
                        next.ts - m.ts > 5 * 60 * 1000;
                      // A WIDGET ONE sent (e.g. the process it opened) — a live
                      // card inline in the thread, tap to open. Carries the
                      // fold control for this process's conversation bubbles.
                      if (m.widget?.kind === 'quiz') {
                        return (
                          <View key={m.id} style={styles.chatWidgetWrap}>
                            <ChatQuizCard runId={m.widget.runId} />
                          </View>
                        );
                      }
                      if (m.widget?.kind === 'booking') {
                        return (
                          <View key={m.id} style={styles.chatWidgetWrap}>
                            <ChatBookingCard runId={m.widget.runId} />
                          </View>
                        );
                      }
                      if (m.widget?.kind === 'form') {
                        return (
                          <View key={m.id} style={styles.chatWidgetWrap}>
                            <ChatFormCard runId={m.widget.runId} />
                          </View>
                        );
                      }
                      if (m.widget?.kind === 'process') {
                        const uId = m.widget.unitId;
                        const convoCount = sessionMessages.filter(
                          (x) => x.unitId === uId && !x.widget,
                        ).length;
                        return (
                          <View key={m.id} style={styles.chatWidgetWrap}>
                            <ChatProcessCard
                              unitId={uId}
                              onOpen={onTapUnit}
                              defaultExpanded={idx === lastProcessWidgetIdx}
                              folded={foldedProcessIds.has(uId)}
                              convoCount={convoCount}
                              onToggleFold={() => toggleFoldProcess(uId)}
                            />
                          </View>
                        );
                      }
                      // ONE and the user share ONE bubble language (styles
                      // .hlBubble) — the same bubble ONE uses in its opener — so
                      // the thread reads as one continuous conversation.
                      const isOne = m.from === 'one';
                      return (
                        <View key={m.id} style={styles.bubbleWrap}>
                          <View
                            style={[
                              styles.hlBubble,
                              styles.threadBubble,
                              isOne
                                ? { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomStartRadius: 6 }
                                : { backgroundColor: colors.circle, alignSelf: 'flex-end', borderBottomEndRadius: 6 },
                            ]}
                          >
                            <Text
                              selectable
                              style={[
                                styles.hlBubbleText,
                                { color: isOne ? colors.text : colors.circleEye },
                                rtlText(lang),
                              ]}
                            >
                              {m.text}
                            </Text>
                          </View>
                          {showStamp && (
                            <Text
                              style={[
                                styles.bubbleStamp,
                                { color: colors.textSecondary, alignSelf: isOne ? 'flex-start' : 'flex-end' },
                              ]}
                            >
                              {formatBubbleTime(m.ts)}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    {chatTyping && (
                      <View
                        style={[
                          styles.hlBubble,
                          styles.threadBubble,
                          { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomStartRadius: 6 },
                        ]}
                      >
                        <TypingIndicator />
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>

              {/* Processes/spaces live INLINE in the scroll now (no sheet):
                  below the full-screen hero, so they're revealed by scrolling
                  down past the figure — as ONE shrinks up to the top bar, the
                  process list slides into view. */}
              {hasOnboarded && !chatActive && !callActive && (
                <View style={styles.processesInline}>
                  {processesContent}
                </View>
              )}
            </Animated.ScrollView>
            </GestureDetector>

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
            <EdgeBars
              // Gradient fades stay ON in chat too (user: "gradient top+bottom
              // like at home, under the keyboard and the figure") — the thread
              // fades behind the orb header at the top and behind the input /
              // keyboard at the bottom. Top stays on during a call as well; the
              // bottom fade is off during a call (the call dock renders its own).
              top
              bottom={!callActive}
              // Fade ends around the orb's bottom edge — covers behind the orb
              // without dimming the first drawer below it.
              topHeight={HERO_CENTER_TOP + HOME_ORB_SIZE - 16}
            />

            {/* A SECOND bottom fade that rides up with the keyboard, so the
                thread fades behind the input above the keyboard (not a hard cut).
                Invisible while the keyboard is down. */}
            {!callActive && (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.kbFadeHost, kbBottomFadeStyle]}
              >
                <EdgeBars top={false} bottom bottomHeight={150} />
                {/* SOLID base right above the keyboard — the gradient alone left
                    thread content faintly peeking in the gap between the composer
                    and the keyboard; this fully covers it. */}
                <View style={[styles.kbSolidBase, { backgroundColor: colors.background }]} />
              </Animated.View>
            )}

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
                style={[styles.globalChevron, { top: Math.round(SCREEN_H / 2) - CHEVRON_CENTER_GAP }, upChevronStyle]}
              >
                {/* Tap the up arrow → ONE01 Global (same destination as the
                    pull-down gesture). */}
                <Pressable
                  onPress={() => { haptic.press(); seenGlobalRef.current = true; onOpenGlobal(); }}
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
              hitSlop={6}
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
                  alive={!callActive}
                  // Before the user connects, ONE wears the DEFAULT face — a
                  // custom skin belongs to a specific account, so it shouldn't
                  // linger into onboarding after a sign-out.
                  skinOverride={!hasOnboarded ? 'classic' : undefined}
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
                {signInOpen ? (
                  // Sign-in sheet open → the sheet carries the message; no line
                  // behind it (keep the area clean under the orb).
                  null
                ) : (
                  // At rest AND while composing: ONE's update SEQUENCE as a
                  // STATIC block — no tap-to-cycle, no per-line crossfade (those
                  // read as a carousel flickering on the same text). It just
                  // fades with the whole layer as the user pulls to the cards.
                  <Animated.View style={orbGhostStyle} pointerEvents="none">
                    <View style={styles.heroLines}>
                      {heroLines.map((ln, i) => {
                        const isGreeting = ln.kind === 'greeting';
                        // Greeting, date AND the status line rotate — key them by
                        // TEXT so they remount and FadeIn crossfades the swap (the
                        // status changes as ONE's state changes).
                        const rotates = isGreeting || ln.kind === 'date' || ln.kind === 'status';
                        // ONE's MESSAGE BODY (the sentences + prompt) cascades in
                        // when the message refreshes (greetingRot bumps on events)
                        // or on mount — so it reads as ONE actively sending it,
                        // line by line, not a static block. Keyed by greetingRot
                        // so it re-plays on a refresh, but NOT on the 30s clock.
                        const isBody = ln.kind === 'beat' || ln.kind === 'prompt';
                        // ONE's message is a CHAT BUBBLE (ONE texting you), on
                        // ONE's side (start/left) under the centered greeting —
                        // both at rest AND during onboarding (ONE's intro reads
                        // as a first message, on the calm classic layout).
                        if (ln.kind === 'beat') {
                          return (
                            <Animated.View
                              key={`beat-${greetingRot}-${i}`}
                              // Cascade in at rest. But NOT while composing — a
                              // reanimated entering can get interrupted by the
                              // keyboard's layout shift and stick at low opacity
                              // ("the chat looks transparent"). While the keyboard
                              // is up the bubbles render solid, instantly.
                              entering={chatActive ? undefined : FadeInDown.duration(420).delay(120 + i * 140)}
                              style={[
                                styles.hlBubble,
                                { backgroundColor: colors.surface, alignSelf: 'flex-start' },
                                { borderBottomStartRadius: 6 },
                              ]}
                            >
                              <Text
                                style={[styles.hlBubbleText, { color: colors.text }, rtlText(lang)]}
                                numberOfLines={6}
                              >
                                {ln.text}
                              </Text>
                            </Animated.View>
                          );
                        }
                        return (
                          <Animated.Text
                            key={
                              rotates
                                ? `${ln.kind}-${ln.text}`
                                : isBody
                                  ? `${ln.kind}-${greetingRot}-${i}`
                                  : `${i}-${ln.kind}`
                            }
                            entering={
                              // No entering while composing — avoids the
                              // keyboard-shift interrupting it and leaving the
                              // line stuck semi-transparent.
                              chatActive
                                ? undefined
                                : rotates
                                  ? FadeIn.duration(500)
                                  : isBody
                                    ? FadeInDown.duration(420).delay(120 + i * 90)
                                    : undefined
                            }
                            numberOfLines={ln.kind === 'heading' ? 1 : undefined}
                            style={[
                              ln.kind === 'greeting'
                                ? styles.hlGreeting
                                : ln.kind === 'status'
                                  ? styles.hlStatus
                                  : ln.kind === 'date'
                                    ? styles.hlDate
                                    : ln.kind === 'prompt'
                                      ? styles.hlPrompt
                                      : ln.kind === 'heading'
                                        ? styles.hlHeading
                                        : styles.hlBeat,
                              {
                                // Only the greeting reads at full strength; the
                                // date + prompt are softer — they sit gently under
                                // the bold opener.
                                color:
                                  ln.kind === 'greeting' ? colors.text : colors.textSecondary,
                              },
                              // Greeting + status read as a CENTERED header block;
                              // the prompt below aligns by reading direction
                              // (device-safe Yoga direction, not textAlign).
                              ln.kind === 'greeting' || ln.kind === 'date' || ln.kind === 'status'
                                ? { textAlign: 'center', writingDirection: lang === 'he' ? 'rtl' : 'ltr' }
                                : rtlText(lang),
                            ]}
                          >
                            {ln.text}
                          </Animated.Text>
                        );
                      })}

                      {/* Onboarding — the two REPRESENTATION directions as a
                          calm example line (consumer / provider), so you see
                          both paths without a form or a hard fork. */}
                      {!hasOnboarded && !chatActive && (
                        <Text
                          style={[styles.hlBeat, styles.hlInvite, { color: colors.textSecondary }, rtlText(lang)]}
                          numberOfLines={2}
                        >
                          {lang === 'he'
                            ? 'למשל: "נהל לי את התהליכים" · או "ענה ללקוחות שלי במקומי"'
                            : 'e.g. "manage my processes" · or "answer my customers for me"'}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                )}
                {/* The open-processes chevron moved to just above the input
                    dock (see below), so it sits where the user reaches. */}
              </Animated.View>

              {/* No status under the orb in the cards view — the phone's clock
                  bar shows there and each card carries its own time, so ONE's
                  clock stays with the resting home only. */}

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

              {/* Profile pills removed — profiles now live as collapsible
                  drawers in the cards list. Switching / adding identities is
                  reachable via the ONE profile (tap the orb). */}
            </Animated.View>

            {/* No chat header / X. The home IS the chat — there's no separate
                chat window to close. Opening the keyboard just raises it on the
                same page; closing it (drag the thread, or the keyboard's own
                dismiss) lowers it. Nothing to "return home" from. */}

            {/* The conversation thread is no longer a floating overlay — it's
                inline scroll content in the hero region above (one home scroll:
                orb → conversation → cards). Nothing renders here. */}

            {/* In-call floating orb + call line. Kept mounted while ONE's
                profile opens over the home so it can DIVE to centre + fade as
                the profile takes over (and rise back out on close), instead of
                a hard cut — the call "moves into" the profile, whose own orb
                then wears the green ring. Its opacity is driven to 0 by pc. */}
            {callActive && (
              <>
                {/* No talk line under the figure in a call — ONE's opener shows
                    in the chat view instead. */}
                {/* box-none: the layer passes touches through (so cards behind
                    stay scrollable), but the orb itself captures its tap. */}
                <View pointerEvents="box-none" style={styles.callLayer}>
                  {/* Orb wrap pinned with an EXPLICIT absolute top (same recipe
                      as callTalk, which lands correctly). Tapping it opens ONE's
                      profile — the same as tapping the home face. */}
                  <AnimatedPressable
                    onPress={() => onTapOrb && onTapOrb()}
                    accessibilityRole="button"
                    accessibilityLabel="Open ONE profile"
                    style={[styles.callOrbWrap, styles.callOrbPinned, { top: callOrbTop }, callOrbStyle]}
                  >
                    <Orb size={CALL_ORB_SIZE} noShadow />
                    {/* Subtle green ring hugging the orb's edge — the "live"
                        signal. Barely breathes (callRingStyle). */}
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.callRing, callRingStyle]}
                    />
                  </AnimatedPressable>
                </View>
              </>
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

        {/* Down-chevron → scrolls the home DOWN into the inline process list
            (no sheet). box-none so only the small arrow captures taps; it fades
            out on scroll, while typing, etc. */}
        {hasOnboarded && !callActive && (
          <Animated.View
            pointerEvents="box-none"
            style={[styles.processesChevron, { bottom: Math.round(SCREEN_H / 2) - CHEVRON_CENTER_GAP }, processesChevronStyle]}
          >
            <Pressable
              onPress={() => { haptic.press(); Keyboard.dismiss(); scrollRef.current?.scrollTo({ y: SNAP_OPEN, animated: true }); }}
              hitSlop={18}
              accessibilityRole="button"
              accessibilityLabel={lang === 'he' ? 'פתח תהליכים ומרחבים' : 'Open processes'}
            >
              {/* Points DOWN — the exact mirror of the top (Global) chevron, same
                  size, so the two read as one symmetric pair (per the home mock). */}
              <ArrowDownIcon size={26} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        )}

        {/* Home / chat input dock. During a CALL this does NOT render — the call
            dock is rendered separately at the TOP LEVEL (callDockNode) so no home
            layer can cover or dim it. */}
        {!callActive && (
        <Animated.View
          // Flush at the very bottom (the processes sheet slides up OVER it).
          style={[styles.inputDock, inputDockStyle, inputMountStyle]}
          // While ONE sleeps the dock is faded away; let the first tap fall
          // through to the passive wake handler instead of focusing the input,
          // so a tap simply wakes ONE (like the splash) rather than opening chat.
          pointerEvents={orbAsleep ? 'none' : 'auto'}
        >
          {callActive ? (
            <>
            {/* During a call the dock keeps the EXACT home shape — same capsule,
                + inside on the left — with speaker / mute / camera toggles in the
                middle and a red hang-up on the right, and the upgrade line still
                beneath it, so it matches the home dock. Wrapped in the SAME
                inputNarrow + inputScaleStyle as the home dock so the capsule's
                width, side margins and vertical position are IDENTICAL. */}
            <Animated.View style={[styles.inputNarrow, inputScaleStyle]}>
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
              voiceBtnStyle={voiceBtnScaleStyle as never}
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
            </Animated.View>
            {onUpgrade && (
              // Same style as the home upgrade row (upgradeRow + restChromeStyle)
              // so its size, margins and position match exactly.
              <AnimatedPressable
                onPress={onUpgrade}
                hitSlop={8}
                style={[styles.upgradeRow, restChromeStyle]}
                accessibilityRole="button"
                accessibilityLabel={lang === 'he' ? 'שדרוג' : 'Upgrade'}
              >
                <Text style={[styles.upgradePrompt, { color: colors.textSecondary }]}>
                  {lang === 'he' ? 'רוצה יותר יכולות? ' : 'Want more from ONE? '}
                </Text>
                <Text style={[styles.upgradeLink, { color: colors.text }]}>
                  {lang === 'he' ? 'שדרוג' : 'Upgrade'}
                </Text>
              </AnimatedPressable>
            )}
            </>
          ) : (
            <>
              {/* (The old "show processes" chevron is gone — processes now live
                  in the pull-up sheet, reached by its own grabber above.) */}
              <Animated.View style={[styles.inputNarrow, inputScaleStyle, globalHideStyle]}>
              <InputBar
                value={chatText}
                onChangeText={setChatText}
                placeholder={
                  // Normally the resting field is just a blinking caret. During
                  // ONBOARDING it invites the first thing to manage/represent.
                  !hasOnboarded && !chatActive
                    ? lang === 'he' ? 'ספר לי…' : 'Tell me…'
                    : ''
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
                // Bigger call button at rest, easing back to normal as the cards
                // come up (and never enlarged while composing). Cast: reanimated's
                // animated-style handle vs StyleProp typing (same quirk as the
                // project's other reanimated types).
                voiceBtnStyle={voiceBtnScaleStyle as never}
                // Keep it the SAME box as the resting home — it just rises with
                // the keyboard, no shape change (the + stays inside the capsule).
                compact={false}
                // ONE's rotating status — shown only in the home rest pose (the
                // idleLine itself is gated on !inCards / !chatActive).
                idleLine={idleLine}
              />
              </Animated.View>
              {/* One line under the input, in the SAME prominent spot:
                  • signed in  → "Want more from ONE? Upgrade" (plans panel).
                  • not yet     → "Already have ONE? Sign in" (connect first).
                  Hidden while chatting. */}
              {/* One line under the input, in the SAME prominent spot:
                  • signed in  → "Want more from ONE? Upgrade" (plans panel).
                  • not yet     → "Already have ONE? Sign in" (connect first).
                  A STATIC invite — ONE's own voice lives INSIDE the box (idleLine),
                  not here. Hidden while chatting, collapses on scroll. */}
              {!chatActive && (hasOnboarded ? onUpgrade : onSignIn) && (
                <AnimatedPressable
                  onPress={() => (hasOnboarded ? onUpgrade?.() : onSignIn?.())}
                  hitSlop={8}
                  style={[styles.upgradeRow, homeUpgradeStyle]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasOnboarded
                      ? lang === 'he' ? 'שדרוג' : 'Upgrade'
                      : lang === 'he' ? 'התחברות' : 'Sign in'
                  }
                >
                  <Text style={[styles.upgradePrompt, { color: colors.textSecondary }]}>
                    {hasOnboarded
                      ? lang === 'he' ? 'רוצה יותר יכולות? ' : 'Want more from ONE? '
                      : lang === 'he' ? 'כבר יש לך ONE? ' : 'Already have ONE? '}
                  </Text>
                  <Text style={[styles.upgradeLink, { color: colors.text }]}>
                    {hasOnboarded
                      ? lang === 'he' ? 'שדרוג' : 'Upgrade'
                      : lang === 'he' ? 'התחבר' : 'Sign in'}
                  </Text>
                </AnimatedPressable>
              )}
            </>
          )}
        </Animated.View>
        )}
      </View>

      {/* Chat / call header — X (close → home) on one side, the temporary-chat
          ("ghost") toggle on the other. Shown in chat AND call mode. Bare icons
          over the top of the surface (per the chatHeader style). */}
      {(chatActive || callActive) && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.chatHeader,
            { direction: lang === 'he' ? 'ltr' : 'rtl', top: insets.top + 8 },
            chatHeaderStyle,
          ]}
        >
          <Pressable
            onPress={() => (callActive ? endCall() : dismissChatAnimated())}
            hitSlop={12}
            style={styles.chatHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel={lang === 'he' ? 'סגור' : 'Close'}
          >
            {/* A chevron (same type + soft colour as the home chevrons), not an
                X — pointing to the SIDE (rotated 90°) so it reads as "back / out"
                rather than "down". */}
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <ArrowDownIcon size={26} color={colors.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => { haptic.select(); setGhostMode((v) => !v); }}
            hitSlop={12}
            style={styles.chatHeaderBtn}
            accessibilityRole="switch"
            accessibilityState={{ checked: ghostMode }}
            accessibilityLabel={lang === 'he' ? 'שיחה זמנית' : 'Temporary chat'}
          >
            <GhostModeIcon size={26} color={ghostMode ? colors.text : colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Call dock — rendered at the TOP LEVEL (sibling of the home tree) so no
          home layer can cover/dim it. Only while a call is active. */}
      {callActive && callDockNode}

      {/* ── Timeline (the "past") — pull the hero DOWN to open. A vertical
          AXIS with nodes + time-section pills; pull down again to close (no
          modal window). ────────────────────────────────────────────────── */}
      {timelineOpen && (
        <Animated.View
          // Rises up into place on open (tlDragY: SCREEN_H → 0). Dismissed by
          // DRAGGING it back DOWN with the finger (timelineDragGesture) — a sheet
          // gesture, the reverse of the rise, not a canned slide.
          style={[
            styles.timelineOverlay,
            { backgroundColor: colors.background, paddingTop: insets.top },
            timelineDragStyle,
          ]}
        >
          <ScrollView
            ref={timelineScrollRef}
            contentContainerStyle={styles.timelineContent}
            showsVerticalScrollIndicator={false}
            // Bounce enabled (both edges, even when short) so flinging UP past the
            // bottom overscrolls — that's the close gesture.
            alwaysBounceVertical
            // Released after flinging UP past the bottom (today) → close, like
            // pushing the drawer back up. A downward drag just scrolls to older.
            onScrollEndDrag={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const pastBottom =
                contentOffset.y - Math.max(0, contentSize.height - layoutMeasurement.height);
              if (pastBottom > 80) dismissTimeline();
            }}
          >
            {timelineEntries.length === 0 ? (
              <Text style={[styles.timelineEmpty, { color: colors.textSecondary }, rtlText(lang)]}>
                {lang === 'he'
                  ? 'עדיין אין עדכונים. כל מה ש‑ONE יעשה יופיע כאן.'
                  : "No updates yet. Everything ONE does will show up here."}
              </Text>
            ) : (
              <View style={styles.tlAxisWrap}>
                {/* The axis line runs down the leading edge; nodes sit on it. */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.tlLine,
                    { backgroundColor: colors.border },
                    lang === 'he' ? { right: TL_NODE_X } : { left: TL_NODE_X },
                  ]}
                />
                {(() => {
                  let lastDay = '';
                  const nodes: React.ReactNode[] = [];
                  timelineEntries.forEach((en) => {
                    const dl = dayLabel(en.ts, lang === 'he');
                    if (dl !== lastDay) {
                      lastDay = dl;
                      nodes.push(
                        <View key={`d_${en.id}`} style={[styles.tlPillRow, { alignItems: 'center' }]}>
                          <View style={[styles.tlPill, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.tlPillText, { color: colors.textSecondary }]}>{dl}</Text>
                          </View>
                        </View>,
                      );
                    }
                    nodes.push(
                      <Pressable
                        key={en.id}
                        onPress={() => {
                          setTimelineOpen(false);
                          onTapUnit(en.unitId);
                        }}
                        style={[
                          styles.tlNodeRow,
                          lang === 'he' ? { paddingRight: TL_NODE_X + 22 } : { paddingLeft: TL_NODE_X + 22 },
                        ]}
                      >
                        {/* Node = the process's emoji, centred on the axis line. */}
                        <View
                          style={[
                            styles.tlNode,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            lang === 'he' ? { right: TL_NODE_X - 15 } : { left: TL_NODE_X - 15 },
                          ]}
                        >
                          <Text style={styles.tlNodeEmoji}>{en.emoji}</Text>
                        </View>
                        <Text style={[styles.tlText, { color: colors.text }, rtlText(lang)]} numberOfLines={2}>
                          {en.text}
                        </Text>
                        <Text style={[styles.tlMeta, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                          {en.title} · {relTimeShort(en.ts, lang === 'he')}
                        </Text>
                      </Pressable>,
                    );
                  });
                  return nodes;
                })()}
              </View>
            )}
          </ScrollView>
          {/* Soft dissolve at the top edge. */}
          <EdgeBars bottom={false} topHeight={insets.top + 70} />
          {/* Dismiss affordance — an UP chevron (fling the timeline up to close,
              like pushing a drawer back up, or tap here). */}
          <Pressable
            onPress={dismissTimeline}
            hitSlop={20}
            style={[styles.timelineDismiss, { bottom: insets.bottom + 14 }]}
            accessibilityRole="button"
            accessibilityLabel={lang === 'he' ? 'חזרה' : 'Back'}
          >
            <View style={styles.flipUp}>
              <ArrowDownIcon size={26} color={colors.textSecondary} />
            </View>
          </Pressable>
        </Animated.View>
      )}
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

  // ── Inline conversation thread (lives in the ONE home scroll). ──────────
  // Wraps a bubble + (optionally) its trailing timestamp so the gap between
  // messages stays tight and the stamp travels with the bubble it belongs to.
  bubbleWrap: { gap: 2 },
  bubbleStamp: {
    fontSize: 11,
    opacity: 0.7,
    paddingHorizontal: 4,
  },
  chatWidgetWrap: { marginVertical: 8 },

  // Fused-hero layout: Orb container + text container, both absolute and
  // animated by scrollY. No separate top header — the hero IS the header.
  heroOrb: {
    position: 'absolute',
    // A fixed-width box centred on screen (not full-width) so the profile-open
    // tap target hugs the orb instead of spanning the whole row.
    left: '50%',
    marginLeft: -(HOME_ORB_SIZE / 2 + 14),
    width: HOME_ORB_SIZE + 28,
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
  // Rest-state "update" sequence on the background — a clean typographic
  // hierarchy: a calm greeting, a muted date, the content beats, a soft prompt.
  // Explicit full-SCREEN width + centred, so the block spans edge-to-edge (the
  // flex-stretch chain inside the centred hero container wouldn't) and the RTL
  // text lands right against the right margin.
  heroLines: {
    width: SCREEN_W,
    alignSelf: 'center',
    paddingHorizontal: 18,
  },
  // Greeting — the calm HEADER line, clearly the largest so it leads the block
  // (the beats below must read as subordinate content, not headlines).
  hlGreeting: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '600',
    marginBottom: 3,
  },
  // Date — quiet subtitle under the greeting, with a gap before the content.
  hlDate: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 20,
  },
  // ONE's live STATUS — the small, quiet presence line directly under the orb
  // (second line). Sits above ONE's message bubbles with a little breathing room.
  hlStatus: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  // Attention beats — the CONTENT. Distinctly smaller than the greeting so the
  // hierarchy reads header → content (they were nearly the same size, so the
  // wrapping beats visually dominated the header).
  hlBeat: {
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
  },
  // ONE's message rendered as a chat bubble (onboarded resting home) — reads
  // like a text from ONE rather than a flat dashboard line. Sits under the
  // centered greeting, aligned to ONE's side.
  hlBubble: {
    maxWidth: '90%',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 18,
    marginTop: 14,
  },
  // Same bubble as the opener, but in the CHAT THREAD: no top margin (the
  // scroll content's `gap` already spaces turns) and a touch narrower so the
  // back-and-forth reads as a conversation.
  threadBubble: { marginTop: 0, maxWidth: '84%' },
  // Inline conversation thread — real content INSIDE the one home scroll. A
  // conversation collapses the orb to a COMPACT top header, so this clears just
  // that (~92) and the chat reads from HIGH on the page, flowing downward: orb
  // header → these bubbles → cards. No overlay, never pinned to the bottom.
  threadInline: {
    // Top padding clears the pinned figure when scrolled to the top of a long
    // thread; the thread is bottom-anchored in chat (heroChatBottom) so a short
    // thread sits just above the composer.
    paddingTop: 112,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  // Chat/call: bottom-anchor the thread — the newest bubble sits just above the
  // composer and older history fills UPWARD (scroll up to peek). The composer +
  // keyboard are cleared by the paddingBottom.
  heroChatBottom: {
    justifyContent: 'flex-end',
    paddingBottom: INPUT_BAR_H + 20,
  },
  hlBubbleText: {
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: '500',
  },
  // The cycling example word inside ONE's onboarding invite line.
  hlExampleWord: { fontWeight: '700' },
  // The emoji in that example — enlarged so it reads as a real icon.
  hlExampleEmoji: { fontSize: 22 },
  // The invite line sits a touch below ONE's description.
  hlInvite: { marginTop: 6 },
  // Extra breathing room between the onboarding HEADLINE and the description.
  hlOnboardGap: { marginTop: 18 },
  // Section divider inside the long briefing (e.g. "— What matters now —").
  // Muted + spaced so it reads as a quiet chapter marker between beat groups.
  hlHeading: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    opacity: 0.75,
    marginTop: 10,
    marginBottom: 8,
  },
  // Prompt — a soft, open-ended closer (sits below the attached chips).
  hlPrompt: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    marginTop: 14,
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
    // Explicit absolute fill — NOT `...StyleSheet.absoluteFillObject`, whose
    // type is missing here and which, if it resolves to undefined at runtime,
    // strips the absolute positioning and drops this layer to the BOTTOM of the
    // flex column (the "call orb stuck at the bottom" bug).
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    // Top-anchored at the home orb's position (paddingTop set inline), so the
    // call face appears exactly where the home face was.
    justifyContent: 'flex-start',
    zIndex: 60,
  },
  // ── Timeline overlay (the past) ─────────────────────────────────────────
  timelineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
  },
  // TOP-anchored — reads from just under the top bar downward (oldest first,
  // today at the bottom of the list), filling from the top with any empty room
  // BELOW. Bottom padding clears the dismiss chevron.
  timelineContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 72,
  },
  timelineDismiss: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.7,
  },
  timelineEmpty: { fontSize: 15, lineHeight: 22, opacity: 0.85, paddingVertical: 20, textAlign: 'center' },
  // Axis
  tlAxisWrap: { position: 'relative', paddingTop: 4 },
  tlLine: { position: 'absolute', top: 6, bottom: 6, width: 2, borderRadius: 1, opacity: 0.7 },
  tlPillRow: { paddingVertical: 8 },
  tlPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  tlPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  tlNodeRow: { position: 'relative', paddingVertical: 12 },
  tlNode: {
    position: 'absolute',
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlNodeEmoji: { fontSize: 15 },
  tlText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  tlMeta: { fontSize: 12.5, marginTop: 2 },
  // ONE's call talk — flat, to the side, like the home hero text.
  callTalk: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    zIndex: 61,
  },
  callTalkText: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  // Fixed square so the green ring can pulse around the centred face.
  callOrbWrap: {
    width: CALL_ORB_SIZE + 20,
    height: CALL_ORB_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pins the call orb at an explicit top (set inline), horizontally centred —
  // so it can't drop to the bottom of the flex column.
  callOrbPinned: {
    position: 'absolute',
    alignSelf: 'center',
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
  // Processes list, inline in the home scroll (below the hero). Reserves at
  // least a screen so even a short/empty list still lets the home scroll far
  // enough to fully collapse the figure up to the top bar. The top padding
  // drops the list clear of the collapsed figure + the top gradient (otherwise
  // the gradient hides the first rows when snapped open).
  processesInline: {
    minHeight: SNAP_OPEN,
    paddingHorizontal: 18,
    paddingTop: 58,
  },
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
  // ── Profile drawers (collapsible per-profile groups in the cards list) ──
  drawer: { marginBottom: 6 },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  drawerTitle: { fontSize: 16, fontWeight: '700' },
  drawerCountPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  drawerBody: { gap: 10, paddingBottom: 6 },
  drawerEmptyHint: { fontSize: 14, lineHeight: 20, opacity: 0.7, paddingVertical: 6, paddingHorizontal: 4 },
  // "New space" button below the last drawer — a quiet dashed affordance.
  addSpaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addSpaceText: { fontSize: 14, fontWeight: '600' },
  cardsList: {
    paddingHorizontal: 14,
    gap: 10,
    // Clearance below the collapsed orb so the first drawer sits a touch LOWER
    // at the open snap — it was landing crammed right under the head. Enough
    // breathing room that the list reads as starting below ONE, not glued to it.
    paddingTop: 34,
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
  // Profile switcher pills (personal / business / family + add).
  profilePills: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: 17,
  },
  // Active profile → a pill that shows its name.
  profilePillActive: {
    paddingHorizontal: 14,
  },
  // Inactive profiles → a plain icon "ball".
  profilePillBall: {
    width: 34,
  },
  profilePillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  profilePillAdd: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Open-processes chevron, centred well above the input capsule so there's a
  // clear gap and no overlap.
  dockChevron: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 22,
  },
  // Upgrade line under the input ("Want more? · Upgrade"). Height + marginTop
  // are animated (restChromeStyle) so it collapses on scroll; overflow hidden
  // clips the text as it shrinks.
  upgradeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  upgradePrompt: { fontSize: 13, fontWeight: '400' },
  upgradeLink: { fontSize: 13, fontWeight: '700' },
  // Tiny horizontal inset only — the capsule reads at a comfortable width.
  inputNarrow: { paddingHorizontal: 3 },
  // Dims the chat behind the processes sheet while it's open. Sits below the
  // sheet (31) and above the chat/EdgeBars (15). Tappable to close when open.
  sheetScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 27,
  },
  // The keyboard-lifted bottom fade — above the chat bubbles (0-5) and the
  // static EdgeBars (15), below the input dock (30).
  kbFadeHost: { zIndex: 16 },
  // Solid fill covering the composer→keyboard band (inside the kb fade host,
  // which rides up with the keyboard). The composer (zIndex 30) sits on top.
  kbSolidBase: { position: 'absolute', left: 0, right: 0, bottom: 0, height: INPUT_BAR_H + 44 },
  // The up-chevron strip above the input dock (full width for centering; only
  // the arrow inside captures taps). Below the sheet (31) so the open sheet
  // covers it.
  processesChevron: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 29,
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
  // Static full-opacity for the dock during a call — used INSTEAD of the animated
  // inputMountStyle so nothing can dim the call controls.
  dockSolid: { opacity: 1 },
  // Lift the dock ABOVE every home/call layer during a call so it's never
  // covered (or dimmed) by the receding home chrome or the scrolled card list.
  dockOnTop: { zIndex: 95 },
  // Call-mode bottom fade — a sibling of the dock, ABOVE the cards (z 90) but
  // BELOW the dock (z 95), so it blurs the cards without washing the dock.
  callBottomFade: { zIndex: 90 },

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
