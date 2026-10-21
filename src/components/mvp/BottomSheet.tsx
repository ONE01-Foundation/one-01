/**
 * BottomSheet — shared wrapper.
 *
 * Architecture:
 *   • React Native's <Modal> hosts the sheet. Modal is the most reliable
 *     "above everything" primitive on iOS — no portal target / provider
 *     ordering / native-stack ambiguity. When `visible` flips to true, the
 *     Modal mounts. When the sheet closes (index → -1), onClose fires which
 *     unmounts the Modal.
 *   • Inside the Modal, gorhom's NON-modal <BottomSheet> handles the slide-up
 *     animation, snap-point drag, and pan-down-to-close gesture.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal as RNModal,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  useWindowDimensions,
} from 'react-native';
import GorhomBottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetMethods,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EdgeBars } from './EdgeBars';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Snap points for the sheet. Strings end with "%" (of screen height). */
  snapPoints?: (string | number)[];
  /** Default snap index when opened. 0 = first snap point. */
  initialSnap?: number;
  /** Optional style applied to the inner BottomSheetView container. */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Whether tapping the backdrop dismisses. Default true. */
  dismissOnBackdrop?: boolean;
  /** Max opacity of the dim behind the sheet. Default 0.32. Sheets that
   *  should sit as a clear "card over a dimmed background" (e.g. a process
   *  card opened from the list) pass a stronger value. */
  backdropOpacity?: number;
  /** DESKTOP only: max width of the centered popup card. Default 600. A sheet
   *  that wants a WIDER frame (e.g. Global) passes a larger value; its own
   *  content keeps its width. */
  desktopMaxWidth?: number;
  /** Whether the sheet's handle can be panned. Default true. */
  enablePan?: boolean;
  /** Whether content-area touches drive sheet pan. Default FALSE — the user
   *  reported sheets auto-expanding while trying to scroll inner content;
   *  the only thing that should pan the sheet is the drag handle. */
  enableContentPan?: boolean;
  /** When TRUE, `children` are rendered as DIRECT children of gorhom's
   *  `<BottomSheet>` (no `BottomSheetView` wrapper). */
  bypassDefaultView?: boolean;
  /** When TRUE, the sheet SIZES ITSELF to its content (gorhom dynamic sizing),
   *  using `snapPoints` as the max cap. The content view is no longer flex:1
   *  (so it can measure its natural height). Use for short, content-fitted
   *  sheets like sign-in — no empty space, no touching the edge. */
  enableDynamicSizing?: boolean;
  /** Optional shared value gorhom writes the LIVE animated index into
   *  (-1 = closed … N = snap index, continuous while dragging). Lets a
   *  surface BEHIND the sheet (e.g. the Home orb) track the slide in
   *  real time, including finger-drag-to-close. */
  animatedIndex?: SharedValue<number>;
  /** Fired ONCE while the sheet is being dragged/animated closed, the instant
   *  its live index crosses the dismiss threshold — i.e. the point past which
   *  releasing the finger will auto-close. Lets a caller play a haptic that
   *  feels synced to the GESTURE, instead of a delayed one at onClose. */
  onDragDismissCross?: () => void;
  /** Optional content rendered as a SIBLING of the sheet (stacked ABOVE it),
   *  filling the full-screen Modal — NOT inside gorhom's snap-sized content.
   *  Use for a floating input dock that must stay pinned to the SCREEN bottom
   *  at every snap point: gorhom sizes its content container to the MAX snap, so
   *  a bottom-anchored child hangs off-screen at lower snaps. Rendered here it's
   *  positioned against the real screen instead, so no snap-offset math is
   *  needed. The caller manages its own show/hide (e.g. fade on close). */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}

const DEFAULT_SNAPS = ['50%', '92%'];

// iOS ignores a transparent-modal dismiss that arrives DURING the modal's
// present transition — the dismiss is dropped and the modal window is orphaned
// ON TOP, eating every touch (the "frozen screen" lock). The transparent RN
// Modal renders to its own native window, so flipping `pointerEvents` on the
// React child does NOT make that orphaned window click-through. The only real
// guard is to never ask iOS to dismiss while it's still presenting: hold every
// sheet on screen at least this long before allowing it to unmount.
const MIN_PRESENT_MS = 350;
// gorhom's slide-down takes ~this long; we force-unmount a hair after it as a
// fallback in case gorhom's onChange(-1) is ever missed.
const CLOSE_SLIDE_MS = 320;
// Live index (0 = open … -1 = closed) at which a drag has gone far enough that
// releasing will dismiss — where the close haptic should land so it feels tied
// to the gesture rather than to the end of the slide.
const DISMISS_CROSS_INDEX = -0.15;

export function BottomSheet({
  visible,
  onClose,
  snapPoints = DEFAULT_SNAPS,
  initialSnap = 0,
  sheetStyle,
  dismissOnBackdrop = true,
  enablePan = true,
  enableContentPan = false,
  bypassDefaultView = false,
  enableDynamicSizing = false,
  animatedIndex,
  backdropOpacity = 0.32,
  desktopMaxWidth = 600,
  onDragDismissCross,
  overlay,
  children,
}: BottomSheetProps) {
  const { colors } = useThemeStore();
  const ref = useRef<BottomSheetMethods>(null);

  // DESKTOP WEB: present the sheet as a CENTERED, width-capped popup card
  // (gorhom `detached` + bottomInset) instead of a full-width bottom sheet.
  // Mobile web + native keep the bottom sheet. Kept inside gorhom so the
  // children's BottomSheetScrollView / BottomSheetView still work.
  const { width: winW, height: winH } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && winW >= 768;

  // Stabilise snapPoints across renders so gorhom doesn't reset on every
  // parent re-render.
  const snapsKey = JSON.stringify(snapPoints);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snaps = useMemo(() => snapPoints, [snapsKey]);
  // On desktop a fixed-height card reads best — one tall detent, vertically
  // centered via bottomInset = (100% - cardHeight) / 2. Dynamic-sizing sheets
  // keep measuring their own height and just float off the bottom.
  const DESKTOP_CARD_FRAC = 0.86;
  const desktopSnaps = useMemo(() => [`${Math.round(DESKTOP_CARD_FRAC * 100)}%`], []);
  const snapsForGorhom = enableDynamicSizing
    ? undefined
    : isDesktop
      ? desktopSnaps
      : snaps;
  const bottomInset = isDesktop
    ? enableDynamicSizing
      ? Math.round(winH * 0.1)
      : Math.round((winH * (1 - DESKTOP_CARD_FRAC)) / 2)
    : 0;
  // gorhom applies this to its outer animated container. maxWidth + auto side
  // margins center the card on web; the rounded corners + overflow:hidden CLIP
  // the card's content to the mask so the BOTTOM corners round like the top
  // (content no longer squares off the rounded bottom). Shadow lives here too
  // so clipping the content doesn't clip the float shadow.
  const desktopSheetStyle = useMemo(
    () =>
      ({
        maxWidth: desktopMaxWidth,
        width: '100%',
        marginHorizontal: 'auto',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 14 },
        elevation: 24,
      }) as ViewStyle,
    [desktopMaxWidth],
  );

  // The SharedValue gorhom writes the LIVE animated index into. Use the
  // caller's when they passed one (so their behind-the-sheet tracking keeps
  // working); otherwise an internal one so we can ALWAYS watch the drag for the
  // dismiss-cross haptic.
  const internalAnimatedIndex = useSharedValue(0);
  const indexForGorhom = animatedIndex ?? internalAnimatedIndex;
  // Armed only while the sheet is fully OPEN, so the mount/present ramp
  // (which also passes the threshold) can't fire the haptic. Disarmed the
  // instant it fires, so one close = one haptic.
  const dismissCrossArmed = useSharedValue(false);
  // Keep a stable JS callback the worklet can call via runOnJS even though the
  // prop may be a fresh arrow each render.
  const onDragDismissCrossRef = useRef(onDragDismissCross);
  onDragDismissCrossRef.current = onDragDismissCross;
  const fireDismissCross = useCallback(() => {
    onDragDismissCrossRef.current?.();
  }, []);
  useAnimatedReaction(
    () => indexForGorhom.value,
    (cur, prev) => {
      if (prev == null) return;
      if (
        dismissCrossArmed.value &&
        cur <= DISMISS_CROSS_INDEX &&
        prev > DISMISS_CROSS_INDEX
      ) {
        // Crossed the dismiss line on the way DOWN — fire once.
        dismissCrossArmed.value = false;
        runOnJS(fireDismissCross)();
      }
    },
  );

  // Fade the OVERLAY (floating dock + screen-pinned bottom bar) out as the sheet
  // slides down to close. The overlay is pinned to the screen (not part of the
  // sliding sheet), so without this it hangs at the bottom for the whole slide
  // and then pops out at unmount — the "closes with a delay" the user reported.
  // Keyed off the live index: fully visible while open, fading to 0 by the time
  // the sheet is a quarter of the way off-screen (index -0.25), so the dock +
  // bar disappear BEFORE the close finishes. It also fades back IN as the sheet
  // opens (index climbs through 0), so the dock arrives with the sheet.
  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(indexForGorhom.value, [-0.25, 0], [0, 1], Extrapolation.CLAMP),
  }));

  // Decoupling: `mounted` drives the RN Modal; `visible` is the parent's
  // intent. Open → mount immediately (gorhom slides the opaque sheet up).
  // Close → slide gorhom DOWN first, then unmount — so every close path (drag,
  // backdrop, back-button, internal X) shows the slide-down.
  const [mounted, setMounted] = useState(visible);
  // Wall-clock ms of the LAST present. We hold the modal on screen until at
  // least MIN_PRESENT_MS has passed before letting it dismiss — see the const.
  const mountedAtRef = useRef(0);
  // Has gorhom finished PRESENTING (settled at an open detent)? Until then the
  // sheet is mid-open, and ANY close — a backdrop tap, a pan-down, or a stray
  // SECOND tap that lands on the still-transparent backdrop while the first tap
  // is still opening it — would dismiss the modal DURING iOS's present
  // transition and orphan its window (the frozen screen). So: (a) the backdrop
  // can't even start a close until `canDismiss`, and (b) any close still holds
  // the unmount until MIN_PRESENT_MS has elapsed.
  const presentedRef = useRef(false);
  const [canDismiss, setCanDismiss] = useState(false);

  // Click-through while closing. NOTE: on iOS this does NOT by itself stop an
  // orphaned transparent-modal window from eating touches (that window is above
  // the React view whose pointerEvents we flip). The real freeze guards are
  // (a) never dismissing mid-present and (b) always actually unmounting; this
  // stays as a cheap extra that blocks stray taps while the sheet slides away.
  const [interactive, setInteractive] = useState(true);

  // Close-path timers. One fires gorhom's slide-down once the present-guard
  // wait elapses; the other force-unmounts if gorhom's onChange(-1) is ever
  // missed. Both are cancelled if the sheet re-opens mid-close.
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimers = useCallback(() => {
    if (slideTimer.current) {
      clearTimeout(slideTimer.current);
      slideTimer.current = null;
    }
    if (unmountTimer.current) {
      clearTimeout(unmountTimer.current);
      unmountTimer.current = null;
    }
  }, []);
  // True from the moment a parent-driven close begins until it (or the
  // fallback) unmounts. Lets us detect a re-open that lands MID-close.
  const closingRef = useRef(false);
  // Guards onClose to EXACTLY ONCE per open→close cycle. onClose is what
  // advances the parent's pendingSheet queue (e.g. "close ONE profile → open
  // Settings"), so it MUST fire on every close path — including the fallback
  // unmount below, which previously dropped it whenever gorhom's onChange(-1)
  // was missed, silently stalling the queued sheet.
  const closeFiredRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const fireClose = useCallback(() => {
    if (closeFiredRef.current) return;
    closeFiredRef.current = true;
    onCloseRef.current();
  }, []);

  // Sync parent intent → local Modal lifecycle.
  useEffect(() => {
    if (visible) {
      // Staying / coming open — cancel any pending close.
      clearTimers();
      if (!mounted) {
        mountedAtRef.current = Date.now();
        closingRef.current = false;
        closeFiredRef.current = false; // arm onClose for the next close
        setInteractive(true);
        setMounted(true);
      } else if (closingRef.current) {
        // Re-open race: the parent flipped visible back ON while a close was
        // in flight (timer pending, or gorhom already sliding down). Nudge the
        // sheet back to its open detent instead of letting it vanish.
        closingRef.current = false;
        setInteractive(true);
        ref.current?.snapToIndex(initialSnap);
      }
    } else if (mounted && !closingRef.current) {
      // Begin close. CRUCIAL: never dismiss the native modal during its present
      // transition — iOS drops the dismiss and orphans the window (frozen
      // screen). Hold it on screen until MIN_PRESENT_MS has elapsed, THEN slide
      // gorhom down, THEN unmount. For a normal close (sheet already open a
      // while) the wait is 0, so there's no added latency.
      closingRef.current = true;
      setInteractive(false);
      const elapsed = Date.now() - mountedAtRef.current;
      const wait = Math.max(0, MIN_PRESENT_MS - elapsed);
      clearTimers();
      slideTimer.current = setTimeout(() => {
        slideTimer.current = null;
        ref.current?.close();
      }, wait);
      unmountTimer.current = setTimeout(() => {
        unmountTimer.current = null;
        closingRef.current = false;
        setMounted(false);
        // Fallback path: gorhom's onChange(-1) was missed. Still advance the
        // parent (fires the queued sheet) — guarded so it never double-fires.
        fireClose();
      }, wait + CLOSE_SLIDE_MS + 140);
    }
  }, [visible, mounted, initialSnap, clearTimers]);

  // Drop any pending timers if the component itself unmounts.
  useEffect(() => clearTimers, [clearTimers]);

  // Open the dismiss gate once the present transition has surely finished.
  // gorhom's onChange flips it the instant the sheet settles open; this timer
  // is the guarantee in case the initial programmatic open never emits onChange
  // (then the backdrop would stay forever non-dismissible). Resets the gate
  // whenever the modal is unmounted so the NEXT open starts gated again.
  useEffect(() => {
    if (!mounted) {
      presentedRef.current = false;
      setCanDismiss(false);
      dismissCrossArmed.value = false;
      return;
    }
    const t = setTimeout(() => {
      presentedRef.current = true;
      setCanDismiss(true);
      // Fully open → the next downward threshold cross is a real close.
      dismissCrossArmed.value = true;
    }, MIN_PRESENT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // gorhom settled at a new index. Two jobs:
  //   • index >= 0 → the sheet is fully OPEN; open the dismiss gate now (faster
  //     than the fallback timer above) so the backdrop becomes tap-to-close.
  //   • index === -1 → fully CLOSED (our close(), a pan-down, or a backdrop tap
  //     that slipped through). NEVER unmount the native modal during its present
  //     transition — hold the unmount until MIN_PRESENT_MS since mount, THEN
  //     drop. For a normal close (open a while) the wait is 0; only an
  //     interrupted-open close is held back, which is exactly the freeze case.
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index >= 0) {
        presentedRef.current = true;
        setCanDismiss(true);
        dismissCrossArmed.value = true;
        return;
      }
      if (index === -1) {
        clearTimers();
        setInteractive(false);
        const finish = () => {
          unmountTimer.current = null;
          closingRef.current = false;
          presentedRef.current = false;
          setMounted(false);
          fireClose();
        };
        const wait = Math.max(0, MIN_PRESENT_MS - (Date.now() - mountedAtRef.current));
        if (wait === 0) finish();
        else unmountTimer.current = setTimeout(finish, wait);
      }
    },
    [fireClose, clearTimers],
  );

  // Closing via backdrop / back-button: trigger gorhom's animated close.
  const requestClose = useCallback(() => {
    ref.current?.close();
  }, []);

  // Snap to the requested initial detent on mount. Desktop has a single centered
  // detent (index 0), so there's nothing to snap to there.
  useEffect(() => {
    if (!mounted || initialSnap === 0 || isDesktop) return;
    const t = setTimeout(() => ref.current?.snapToIndex(initialSnap), 50);
    return () => clearTimeout(t);
  }, [mounted, initialSnap, isDesktop]);

  // gorhom's built-in animated backdrop. It interpolates opacity off the
  // sheet's internal animatedIndex — appearing as the sheet slides up and
  // fading as it slides down. We never pass the SharedValue ourselves
  // (that was the suspected source of the "set key `current` undefined on
  // frozen object" crash); gorhom owns the value end-to-end here.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={backdropOpacity}
        // Tap-to-close ONLY once the sheet has fully presented. While it's still
        // sliding open, a backdrop tap is swallowed (no-op) instead of starting
        // a close mid-present — the move that orphaned the modal and froze the
        // screen. This is the direct fix for "tapped the dim area before it
        // finished opening" and for the 2nd tap of a fast double-tap.
        pressBehavior={dismissOnBackdrop && canDismiss ? 'close' : 'none'}
      />
    ),
    [dismissOnBackdrop, backdropOpacity, canDismiss],
  );

  return (
    <RNModal
      visible={mounted}
      transparent
      // "none": the Modal appears INSTANTLY (no opacity fade) and gorhom slides
      // the OPAQUE sheet up from the bottom — so the home is never visible THROUGH
      // a half-faded sheet during the open (the "fade" we used before tinted the
      // whole sheet translucent while it slid up). "fade" also happened to mask
      // the dropped-dismiss freeze (its longer transition serialised present vs.
      // dismiss); we now guard that freeze directly in the lifecycle above —
      // never dismissing during the present transition (MIN_PRESENT_MS) and
      // always sliding down + unmounting — so we keep the clean opaque open
      // WITHOUT reintroducing the freeze.
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      {/* Inner GestureHandlerRootView: iOS Modal renders to its own native
          window, so gesture handlers inside don't see the outer root view
          mounted in App.tsx. `pointerEvents` flips to "none" while the sheet
          is closing so a lingering (dropped-dismiss) modal layer can never
          freeze Home — touches fall straight through to the screen behind. */}
      <GestureHandlerRootView
        style={styles.root}
        pointerEvents={interactive ? 'auto' : 'none'}
      >
        <GorhomBottomSheet
          ref={ref}
          // Present DIRECTLY at the requested detent. Presenting at 0 and then
          // imperatively snapToIndex(initialSnap) at mount+50ms was unreliable
          // on a cold load — the timer could fire before gorhom finished
          // measuring, leaving a chat-open stranded at the low card. gorhom
          // animates here on prop change too, so a later initialSnap change
          // (profile → tap input → chat) still expands.
          index={isDesktop ? 0 : initialSnap}
          // Dynamic-sizing sheets snap ONLY to their content height (no manual
          // snap points); desktop uses the single centered-card detent; mobile
          // uses the caller's snaps.
          snapPoints={snapsForGorhom}
          // Desktop: detach into a floating card, lifted off the bottom + center.
          detached={isDesktop}
          bottomInset={bottomInset}
          style={isDesktop ? desktopSheetStyle : undefined}
          // Live index — out to the caller's SharedValue (behind-the-sheet
          // surfaces like the Home orb) when given, else our internal one. We
          // ALWAYS watch it (see the dismiss-cross reaction above).
          animatedIndex={indexForGorhom}
          enablePanDownToClose
          enableContentPanningGesture={enablePan && enableContentPan}
          enableHandlePanningGesture={enablePan}
          enableDynamicSizing={enableDynamicSizing}
          onChange={handleSheetChanges}
          // gorhom's animated backdrop. Opacity rises/falls with the sheet's
          // slide — no boom-in/boom-out cut. Tap-to-close handled via the
          // `pressBehavior` prop above.
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={[
            styles.indicator,
            { backgroundColor: colors.border },
          ]}
          backgroundStyle={[
            styles.background,
            isDesktop && styles.backgroundDesktop,
            { backgroundColor: colors.background },
          ]}
        >
          {bypassDefaultView ? (
            // Children stay DIRECT children of gorhom (the bypass contract). The
            // desktop in-card bottom fade is an absolutely-positioned sibling —
            // it tucks the scroll content under the card's rounded bottom edge,
            // INSIDE the mask (mobile keeps its screen-pinned overlay fade).
            <>
              {children}
              {isDesktop && !enableDynamicSizing && (
                <EdgeBars top={false} bottomHeight={84} style={styles.desktopFade} />
              )}
            </>
          ) : (
            // Dynamic-sizing sheets must NOT flex:1 (gorhom measures the natural
            // content height); fixed-snap sheets flex:1 to fill the detent.
            <BottomSheetView
              style={[
                enableDynamicSizing ? styles.contentDynamic : styles.content,
                // DESKTOP: clip the content to the rounded card so the scroll
                // content AND the edge-fade gradients live INSIDE the card mask.
                isDesktop && styles.contentDesktopMask,
                sheetStyle,
              ]}
            >
              {children}
              {isDesktop && !enableDynamicSizing && (
                <EdgeBars top={false} bottomHeight={84} style={styles.desktopFade} />
              )}
            </BottomSheetView>
          )}
        </GorhomBottomSheet>
        {/* Overlay — pinned to the full-screen Modal, ABOVE the sheet. Kept a
            sibling of gorhom (not a child) so a floating input dock inside it
            sits at the SCREEN bottom at every snap, instead of being anchored to
            gorhom's max-snap-sized content (which hangs off-screen at low snaps).
            The caller's node manages its own layout + show/hide. Wrapped in a
            fade tied to the sheet's slide so the dock + bottom bar vanish WITH
            the close, not after it. */}
        {overlay != null && (
          <Animated.View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, overlayFadeStyle]}
          >
            {overlay}
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  // Desktop popup card — round the bottom corners too + a soft floating shadow.
  backgroundDesktop: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 14 },
    elevation: 24,
  },
  indicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
  content: { flex: 1 },
  // Dynamic sizing: no flex, so the view reports its natural content height.
  contentDynamic: {},
  // Desktop: clip children + fades to the rounded card mask.
  contentDesktopMask: { overflow: 'hidden', borderRadius: 24 },
  // The in-card bottom fade sits above the content but below interactive chrome.
  desktopFade: { zIndex: 6 },
});
