/**
 * InputBar — the shared bottom dock used on Home, OneChat, and inside
 * UnitProfileSheet's chat mode.
 *
 * Two layout modes driven by the `compact` prop:
 *
 *   compact={false} (default, at rest):
 *     [ + ─ input ───────── 🎙/↑ ]      ← single capsule, + inside
 *
 *   compact={true}  (keyboard open / chat active):
 *     [ + ] [ ─ input ─── 🎙/↑ ]        ← + lifted OUT as its own pill
 *
 * The user's mental model: at rest the bar reads as one solid object with
 * a discoverable + on the side; once they start a conversation the + pulls
 * out to make room for typing and the capsule reads tighter, more like a
 * messages-app input. Same touch targets either way.
 *
 * Always a real TextInput — the SAME instance lives across both modes.
 * Tapping the input focuses the field, which opens the keyboard and lets
 * the parent flip `compact` on. `onFocus` is the signal the parent uses
 * to enter "chat mode".
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Keyboard,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { PlusIcon, CloseIcon } from './icons';
import { haptic } from '../../utils/haptics';

/** Live-recording green — voice button + waveform while the user holds. */
const RECORD_GREEN = '#22C55E';
/** Hang-up red — the call-mode end-call button (replaces the voice button). */
const HANGUP_RED = '#EF4444';

/** One pulsing bar of the recording waveform. */
function WaveBar({ index }: { index: number }) {
  const h = useSharedValue(6);
  React.useEffect(() => {
    h.value = withDelay(
      index * 100,
      withRepeat(
        withSequence(
          withTiming(20, { duration: 320, easing: Easing.inOut(Easing.quad) }),
          withTiming(6, { duration: 320, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [h, index]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

/** Green waveform shown INSIDE the capsule while holding the voice button. */
function RecordingWave() {
  return (
    <View style={styles.waveRow}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <WaveBar key={i} index={i} />
      ))}
    </View>
  );
}

/** One bar of the voice glyph. STATIC at its resting height; when `pulse`
 *  changes (the keyboard just opened) it ripples once — rises past its base
 *  then settles, staggered by index so the three bars read as a left-to-right
 *  wave. This replaces the old scale "bop" with a one-shot waveform. */
function VoiceWaveBar({ index, color, pulse }: { index: number; color: string; pulse: number }) {
  // Resting heights mirror the brand 3-bar icon: short · tall · medium.
  const BASE = [12, 22, 16];
  const base = BASE[index] ?? 16;
  const h = useSharedValue(base);
  React.useEffect(() => {
    if (!pulse) return; // no animation at rest — the bars hold their shape
    const peak = Math.min(26, base + 8);
    h.value = withDelay(
      index * 80,
      withSequence(
        withTiming(peak, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(base, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    // Fire only on a pulse change; base/index are stable for a given bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[{ width: 3.4, borderRadius: 1.7, backgroundColor: color }, style]}
    />
  );
}

/** The voice glyph — three bars that hold a static waveform shape and ripple
 *  once each time `pulse` ticks (the keyboard opening). */
function VoiceWave({ color = '#fff', pulse = 0 }: { color?: string; pulse?: number }) {
  return (
    <View style={styles.voiceWaveRow}>
      {[0, 1, 2].map((i) => (
        <VoiceWaveBar key={i} index={i} color={color} pulse={pulse} />
      ))}
    </View>
  );
}

/** Look at the first STRONG character in the input. Hebrew range = RTL,
 *  Latin = LTR. Empty/punctuation-only falls back to the app default. */
function detectRTL(value: string, defaultRTL: boolean): boolean {
  for (const ch of value) {
    // Hebrew block
    if (ch >= '֐' && ch <= '׿') return true;
    // Arabic blocks (treat as RTL too, for future Arabic support)
    if (ch >= '؀' && ch <= 'ۿ') return true;
    if (ch >= 'ݐ' && ch <= 'ݿ') return true;
    // Latin uppercase + lowercase + Latin-1 supplement letters
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) return false;
    if (ch >= 'À' && ch <= 'ɏ') return false;
  }
  return defaultRTL;
}

/** Lightweight send arrow rendered as text — no extra SVG dependency. */
function SendArrow({ color }: { color: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 22,
        // Bring the glyph's optical center to the geometric center.
        marginTop: -2,
      }}
    >
      ↑
    </Text>
  );
}

export interface InputBarProps {
  /** Controlled text value. */
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  /** Submit (return key on keyboard). */
  onSubmit?: () => void;
  /** Fires when the TextInput gains focus → parent flips into "chat mode". */
  onFocus?: () => void;
  /** Fires when the TextInput loses focus. */
  onBlur?: () => void;
  autoFocus?: boolean;
  /**
   * One-shot focus trigger. Whenever this number CHANGES to a truthy value
   * the field focuses (opening the keyboard). Unlike `autoFocus` — a native
   * mount-only prop — this works on an already-mounted InputBar, so a parent
   * can pop the keyboard when it switches the bar into chat mode (e.g. a
   * process sheet that opens straight into a conversation). Bump it; don't
   * hold it true — re-focusing only happens on a value change, so dismissing
   * the keyboard won't be undone.
   */
  focusSignal?: number;
  /** Delay (ms) before the `focusSignal` actually focuses. Defaults to 380 to
   *  let a host SHEET finish opening before the keyboard pushes up. When the
   *  trigger fires AFTER a sheet has already closed (e.g. returning from Quick
   *  Actions), pass a small value so the keyboard comes back promptly. */
  focusDelay?: number;
  /** Tap on the + button (left). Opens quick-actions on Home. */
  onPressPlus?: () => void;
  /** Tap on the mic button (right) WHILE text is present → send. */
  onPressVoice?: () => void;
  /**
   * Tap on the voice button while the field is EMPTY → start a voice call
   * with ONE. When omitted, an empty-tap falls back to focusing the input
   * (so the system keyboard's dictation mic is one tap away) — keeps the
   * shared InputBar's old behaviour on screens that don't wire calls.
   */
  onStartCall?: () => void;
  /** Long-press (hold) the voice button while empty → begin mic recording. */
  onRecordStart?: () => void;
  /** Release after a hold → stop recording. */
  onRecordEnd?: () => void;
  /** True while recording — capsule shows the green waveform, button greens. */
  recording?: boolean;
  /** Elapsed recording time as "MM:SS" — shown next to the waveform. */
  recordingTime?: string;
  /** Layout mode — see top comment. Defaults to false (resting layout). */
  compact?: boolean;
  /** Draw a hairline ring around the capsule — used inside sheets where the
   *  white capsule would otherwise melt into the near-white surface. */
  bordered?: boolean;
  /** Deepen the capsule's shadow so the bar visibly floats above content. */
  elevated?: boolean;
  /**
   * Call mode. The dock keeps the EXACT home shape — same capsule, the +
   * inside on the left — but the text field is replaced by `callControls`
   * (speaker / mute / camera) and the right voice button becomes a red
   * hang-up (✕) wired to `onEndCall`.
   */
  callMode?: boolean;
  /** End-call handler — the red ✕ in call mode. */
  onEndCall?: () => void;
  /** Call-control cluster rendered inside the capsule (speaker/mute/camera). */
  callControls?: React.ReactNode;
  /** Outer container style override. */
  style?: StyleProp<ViewStyle>;
  textInputProps?: TextInputProps;
}

export function InputBar({
  value,
  onChangeText,
  placeholder = '',
  onSubmit,
  onFocus,
  onBlur,
  autoFocus,
  focusSignal,
  focusDelay = 380,
  onPressPlus,
  onPressVoice,
  onStartCall,
  onRecordStart,
  onRecordEnd,
  recording = false,
  recordingTime,
  compact = false,
  bordered = false,
  elevated = false,
  callMode = false,
  onEndCall,
  callControls,
  style,
  textInputProps,
}: InputBarProps) {
  const { colors, theme } = useThemeStore();
  const lang = useLanguage();
  // Local ref so the voice button can focus the input — this gives
  // iOS users zero-step access to the system keyboard's built-in
  // dictation mic when the field is empty. (Real on-device speech-
  // to-text would need a custom dev client and is out of scope here.)
  const inputRef = React.useRef<TextInput>(null);
  // One-shot focus: when the parent bumps `focusSignal`, open the keyboard.
  // A small delay lets a host sheet finish its open/snap animation before the
  // keyboard pushes up, so the layout settles in one motion instead of two.
  React.useEffect(() => {
    if (!focusSignal) return;
    const t = setTimeout(() => inputRef.current?.focus(), focusDelay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);
  // Direction follows the CONTENT once the user starts typing: a Hebrew
  // first character pulls the input to RTL, a Latin first character pulls
  // it to LTR. While the field is empty we fall back to the app language —
  // the cursor sits where the user is most likely to type next.
  const isRTL = detectRTL(value, lang === 'he');

  // Resting "ready to type" signal: instead of placeholder text, an empty +
  // unfocused field shows a calm, slowly-blinking caret. Tracks focus so the
  // native caret takes over the moment the user taps in.
  const [focused, setFocused] = React.useState(false);
  // Stays inside a faint band — almost-transparent up to gently-visible, never
  // a hard full-opacity blink. Calm, not attention-grabbing.
  const caretPulse = useSharedValue(0.5);
  React.useEffect(() => {
    caretPulse.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.5, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [caretPulse]);
  const caretStyle = useAnimatedStyle(() => ({ opacity: caretPulse.value }));
  // The custom resting caret is ONLY the keyboard-closed "ready to type" hint.
  // Hide it the moment the field is focused OR the bar is in chat/compact mode
  // (keyboard open) — otherwise it sat alongside the real native cursor and
  // read as two carets. `!compact` makes the hide robust even if the focus
  // state lags a frame across the rest→chat transition.
  const showCaret = value.length === 0 && !focused && !compact;

  // Voice glyph ripple — bumped the moment the field gains focus (the keyboard
  // opens) so the three bars do ONE wave, then settle. Replaces the old scale
  // "bop". At rest the counter never changes, so the bars hold their shape.
  const [wavePulse, setWavePulse] = React.useState(0);
  const pulseWave = React.useCallback(() => setWavePulse((n) => n + 1), []);

  // The Plus pill — identical visuals in both modes; just rendered in two
  // different layout positions (inside the capsule vs. outside next to it).
  const plusButton = (
    <Pressable
      onPress={() => {
        haptic.tap();
        Keyboard.dismiss();
        onPressPlus?.();
      }}
      hitSlop={14}
      accessibilityLabel="Quick actions"
      style={[
        compact ? styles.plusBtnFloating : styles.plusBtnInline,
        compact && { backgroundColor: colors.surface, shadowColor: '#000' },
        // Always full opacity — the + stays a solid, reachable affordance even
        // while typing (it no longer dims when text is present).
      ]}
    >
      <PlusIcon size={22} color={colors.text} />
    </Pressable>
  );

  const capsule = (
    <View
      style={[
        styles.capsule,
        compact ? styles.capsuleCompact : styles.capsuleFull,
        {
          backgroundColor: colors.surface,
          shadowColor: '#000',
          // Pin the + / send buttons to the BOTTOM so they hold their position
          // as the capsule grows with multi-line text. A single line still
          // reads CENTRED because minHeight === button height + symmetric
          // padding, so "bottom" and "centre" coincide at rest.
          alignItems: 'flex-end',
        },
        elevated && styles.capsuleElevated,
        bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      {/* + inside the capsule ONLY in resting mode */}
      {!compact && plusButton}

      {/* While recording, the field is replaced by a live green waveform so
          the user sees the mic is hot. Otherwise the normal text input. */}
      {recording ? (
        <View style={styles.recordingRow}>
          <RecordingWave />
          {!!recordingTime && (
            <Text style={styles.recordingTime}>{`● ${recordingTime}`}</Text>
          )}
        </View>
      ) : (
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            // No placeholder text — the gentle blinking caret IS the resting
            // "ready to type" signal (replaces "Talk to ONE" etc.).
            placeholder=""
            cursorColor={colors.text}
            selectionColor={colors.text}
            // Match the system keyboard chrome to the app theme — a light
            // keyboard under a dark UI (and vice-versa) reads as a glitch.
            keyboardAppearance={theme === 'dark' ? 'dark' : 'light'}
            style={[
              styles.input,
              {
                color: colors.text,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
            // Enter inserts a newline (multiline) — sending is via the send
            // arrow, not the return key.
            multiline
            returnKeyType="default"
            autoFocus={autoFocus}
            {...(textInputProps ?? {})}
            onFocus={(e) => {
              setFocused(true);
              // Tapping into the box is a touch moment — give it a light tap.
              haptic.tap();
              pulseWave();
              onFocus?.();
              textInputProps?.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.();
              textInputProps?.onBlur?.(e);
            }}
          />
          {showCaret && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.caret,
                caretStyle,
                { backgroundColor: colors.text },
                // Sit EXACTLY where the native cursor lands once focused — at
                // the TextInput's own paddingHorizontal (6), not 8. At 8 the
                // resting caret read ~2px "forward" of the real one and the
                // cursor appeared to hop the moment the keyboard opened.
                isRTL ? { right: 6 } : { left: 6 },
              ]}
            />
          )}
        </View>
      )}

      {/* Right action. Three jobs depending on state:
          • text present  → TAP sends (onPressVoice).
          • empty + call  → TAP starts a voice call (onStartCall), HOLD records
            (onRecordStart / onRecordEnd). delayLongPress distinguishes them.
          • empty, no call host → TAP focuses the field (legacy: keyboard mic).
          Glyph is always white; the pill greens while recording. */}
      <Pressable
        onPress={() => {
          if (value.trim().length > 0) {
            onPressVoice?.();
          } else if (onStartCall) {
            onStartCall();
          } else {
            inputRef.current?.focus();
          }
        }}
        onLongPress={() => {
          if (value.trim().length === 0 && onRecordStart) onRecordStart();
        }}
        onPressOut={() => {
          if (recording && onRecordEnd) onRecordEnd();
        }}
        delayLongPress={250}
        hitSlop={14}
        accessibilityLabel={value.trim().length > 0 ? 'Send' : 'Voice — tap to call, hold to record'}
        style={[
          styles.voiceBtn,
          { backgroundColor: recording ? RECORD_GREEN : colors.circle },
        ]}
      >
        {value.trim().length > 0 ? (
          <SendArrow color="#FFFFFF" />
        ) : (
          <VoiceWave color="#FFFFFF" pulse={wavePulse} />
        )}
      </Pressable>
    </View>
  );

  // Call mode: same home capsule (+ inside on the left), call-control cluster
  // in the middle, red ✕ hang-up where the voice button normally sits.
  if (callMode) {
    return (
      <View style={[styles.outer, style]}>
        <View
          style={[
            styles.capsule,
            styles.capsuleFull,
            { backgroundColor: colors.surface, shadowColor: '#000' },
          ]}
        >
          {plusButton}
          <View style={styles.callControlsSlot}>{callControls}</View>
          <Pressable
            onPress={onEndCall}
            hitSlop={14}
            accessibilityLabel="End call"
            style={[styles.voiceBtn, { backgroundColor: HANGUP_RED }]}
          >
            <CloseIcon size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outer, compact && styles.outerCompact, style]}>
      {/* In compact mode the + sits OUTSIDE the capsule to its left. */}
      {compact && plusButton}
      {capsule}
    </View>
  );
}

const styles = StyleSheet.create({
  // RESTING: single capsule, + inside.
  outer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  // COMPACT (chat active): row layout — [+ pill] [capsule]. Locked LTR so
  // the + always sits on the visual LEFT, regardless of app language. In
  // Hebrew, an unlocked container would flip and put both the + and the
  // voice button on the right edge, crowding the layout.
  outerCompact: {
    flexDirection: 'row',
    // Bottom-align so the floating + pill holds its position (level with the
    // send button) while the capsule grows upward with multi-line text.
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    ...(Platform.OS !== 'web' ? { direction: 'ltr' as const } : {}),
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    // Lock to LTR so + stays on the left and voice/send on the right.
    ...(Platform.OS !== 'web' ? { direction: 'ltr' as const } : {}),
  },
  capsuleFull: {
    // minHeight (not height) so the capsule GROWS with multi-line text — the
    // resting look is unchanged (52px buttons + 20px vertical padding = 72).
    minHeight: 72,
    borderRadius: 36,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    gap: 6,
  },
  // Deeper float — used inside sheets so the dock clearly sits above content.
  capsuleElevated: {
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  capsuleCompact: {
    flex: 1,
    // Grows with content (52px buttons + 12px vertical padding = 64 at rest).
    minHeight: 64,
    borderRadius: 32,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 8,
  },
  // + INSIDE the capsule — no background, just the glyph.
  plusBtnInline: {
    width: 48,
    // Match the voice button's HEIGHT (52) so the two glyphs line up on the
    // same centre line — at 48 the bottom-anchored + sat ~2px lower than send.
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // + OUTSIDE the capsule — its own round pill, sibling to the capsule. Sized
  // to MATCH the X / ghost header buttons (48). `marginBottom` lifts it so its
  // centre lines up with the voice button INSIDE the capsule (which is inset by
  // the capsule's 6px bottom padding) — otherwise the bottom-anchored + sat
  // slightly lower than the send button.
  plusBtnFloating: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Wraps the TextInput so the resting caret can sit absolutely at the text's
  // start without disturbing the flex row. No fixed height — it sizes to the
  // input's content so the capsule (alignItems:center) keeps the text block
  // vertically CENTRED at one line and grows cleanly as lines are added.
  inputWrap: {
    flex: 1,
    justifyContent: 'center',
    // Floor at the button height so a single line (and the resting caret) sits
    // vertically CENTRED — bottom-anchored inside symmetric padding, this lands
    // the text on the capsule's centre line. Grows past this as lines are added.
    minHeight: 52,
  },
  input: {
    alignSelf: 'stretch',
    fontSize: 18,
    lineHeight: 22,
    paddingHorizontal: 6,
    paddingVertical: 0,
    // Sizes to content between one line and ~6 lines, then scrolls internally.
    minHeight: 24,
    maxHeight: 22 * 6,
    // Centre a single line vertically; Android needs this explicitly.
    textAlignVertical: 'center',
    // textAlign / writingDirection are set inline based on language.
  },
  // The calm resting caret — a thin bar where typing would begin. Vertically
  // centred; left/right inset set inline per text direction.
  caret: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  // Recording waveform — fills the same slot the TextInput occupies.
  waveRow: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: RECORD_GREEN,
  },
  // Idle voice glyph — three softly-waving bars, centred in the voice button.
  voiceWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    gap: 3,
  },
  recordingRow: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  recordingTime: {
    color: RECORD_GREEN,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  voiceBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Call-mode middle slot — holds the speaker/mute/camera cluster in the same
  // space the TextInput normally occupies.
  callControlsSlot: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // More breathing room between the three toggles (was 4).
    gap: 14,
  },
});
