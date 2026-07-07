/**
 * QuickActionsSheet — opens when the user taps the + in the InputBar.
 *
 * Two "drawers", no title/subtitle:
 *   1. TOOLS — a horizontally-scrolling row of rounded square tiles for the
 *      raw capabilities ONE can pull in (photo / camera / document / voice /
 *      scan). These are platform-API placeholders for v0.
 *   2. CONTEXT — a vertical list of actions that change with WHERE the sheet was
 *      opened from. Today it only opens from Home, so it shows Home-context ONE
 *      actions (new process, "what needs me today", a quick overview). The
 *      `contextActions` array is the seam: pass a different set per surface and
 *      this second drawer adapts.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useThemeStore } from '../../stores/themeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { useT, useLanguage } from '../../i18n/useT';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { PlusIcon } from '../../components/mvp/icons';

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Tapping "New process" opens the existing CreateProcessSheet via the
   *  navigation overlay state. */
  onNewProcess: () => void;
}

interface Tile {
  id: string;
  emoji: string;
  label: string;
  onPress: () => void;
}

interface ContextAction {
  id: string;
  emoji: string;
  label: string;
  sub?: string;
  onPress: () => void;
}

// Two snap points + content-pan so the user can drag (or scroll) the
// sheet up. Low snap = compact, high snap = full-card height.
const SNAP_POINTS = ['44%', '80%'];

export function QuickActionsSheet({
  visible,
  onClose,
  onNewProcess,
}: QuickActionsSheetProps) {
  const { colors } = useThemeStore();
  const t = useT();
  const lang = useLanguage();
  const he = lang === 'he';
  // RTL, computed inline. `direction` EXPLICITLY sets a subtree's layout
  // direction (Yoga), overriding the engine's isRTL — so it's immune to the
  // engine flip-flop. On an `rtl` row the first child (icon) lands on the right.
  // textAlign:'right' + width:100% pins the titles physically right (swap off).
  const dir: 'ltr' | 'rtl' = he ? 'rtl' : 'ltr';
  // Align text via `direction`/`writingDirection` (NOT textAlign:'right', which
  // the device swaps to the left). An rtl Text aligns to its leading edge = right.
  const heTitle = he
    ? ({ width: '100%', direction: 'rtl', writingDirection: 'rtl' } as const)
    : null;
  const heText = he ? ({ direction: 'rtl', writingDirection: 'rtl' } as const) : null;
  const setPendingHomeInput = useMvpStore((s) => s.setPendingHomeInput);

  // Live snap index (0 = low/44%, 1 = full/80%). Drives the floating
  // "Add action" button — it fades in only once the sheet is fully open.
  const sheetIndex = useSharedValue(0);
  const fabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetIndex.value, [0.55, 0.92], [0, 1], Extrapolation.CLAMP),
    transform: [
      // Pushed well below the sheet's bottom edge when hidden (low snap) so the
      // invisible button never intercepts taps; slides up into place near full.
      { translateY: interpolate(sheetIndex.value, [0.55, 0.92], [90, 0], Extrapolation.CLAMP) },
    ],
  }));

  const stub = (label: string) => Alert.alert(label, t('qa_stub_alert_body'));

  // Drawer 1 — raw tools, horizontal tiles.
  const tiles: Tile[] = [
    { id: 'photo', emoji: '🖼', label: he ? 'תמונה' : 'Photo', onPress: () => stub(he ? 'תמונה' : 'Photo') },
    { id: 'camera', emoji: '📷', label: he ? 'מצלמה' : 'Camera', onPress: () => stub(he ? 'מצלמה' : 'Camera') },
    { id: 'document', emoji: '📄', label: he ? 'מסמך' : 'Document', onPress: () => stub(he ? 'מסמך' : 'Document') },
    { id: 'voice', emoji: '🎙', label: he ? 'הקלטה' : 'Voice', onPress: () => stub(he ? 'הקלטה' : 'Voice') },
    { id: 'scan', emoji: '🔎', label: he ? 'סריקה' : 'Scan', onPress: () => stub(he ? 'סריקה' : 'Scan') },
  ];

  // Drawer 2 — context actions. THIS is the part that varies by where the
  // sheet was opened from (Home, for now).
  const contextActions: ContextAction[] = [
    {
      id: 'new',
      emoji: '✨',
      label: he ? 'תהליך חדש' : 'New process',
      sub: he ? 'התחל מאפס' : 'Start one from scratch',
      onPress: () => {
        onClose();
        // Defer so the close animation can begin before the next sheet mounts.
        setTimeout(onNewProcess, 240);
      },
    },
    {
      id: 'today',
      emoji: '🗓',
      label: he ? 'מה מחכה לי היום' : 'What needs me today',
      sub: he ? 'ONE יסכם לך' : 'ONE sums it up',
      onPress: () => {
        setPendingHomeInput(he ? 'מה מחכה לי היום?' : 'What needs me today?');
        onClose();
      },
    },
    {
      id: 'overview',
      emoji: '📊',
      label: he ? 'סקירה מהירה' : 'Quick overview',
      sub: he ? 'מצב כל התהליכים' : 'Across all your processes',
      onPress: () => {
        setPendingHomeInput(
          he
            ? 'תן לי סקירה מהירה של כל התהליכים שלי'
            : 'Give me a quick overview of all my processes',
        );
        onClose();
      },
    },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      enableContentPan={true}
      bypassDefaultView={true}
      animatedIndex={sheetIndex}
    >
      <View style={styles.flex1}>
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* No close button — the sheet dismisses by dragging down or tapping
            the backdrop (the X was removed per the latest design pass). */}

        {/* Drawer 1 — Tools (horizontal tiles), no title.
            `directionalLockEnabled` keeps a sideways swipe purely horizontal so
            it never drifts vertically into the sheet's pan (which moved the whole
            card up/down). `overflow:hidden` on the row masks tiles at the screen
            edges so they never spill outside. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
          style={styles.tilesScroll}
          contentContainerStyle={styles.tilesRow}
        >
          {tiles.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={tile.onPress}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
            >
              <Text style={styles.tileEmoji}>{tile.emoji}</Text>
              <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={1}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Drawer 2 — Context actions (vertical list) */}
        <Text style={[styles.drawerLabel, styles.drawerLabelSecond, { color: colors.textSecondary }, heTitle]}>
          {he ? 'פעולות מהירות' : 'Quick actions'}
        </Text>
        <View style={styles.list}>
          {contextActions.map((a) => (
            <Pressable
              key={a.id}
              onPress={a.onPress}
              style={({ pressed }) => [
                styles.row,
                {
                  direction: dir,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <View style={styles.rowIcon}>
                <Text style={styles.rowEmoji}>{a.emoji}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.text }, heText]}>
                  {a.label}
                </Text>
                {!!a.sub && (
                  <Text style={[styles.rowSub, { color: colors.textSecondary }, heText]}>
                    {a.sub}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheetScrollView>

        {/* Floating "Add action" — fades in only once the sheet is dragged
            open to its full snap. */}
        <Animated.View style={[styles.fabWrap, fabStyle]} pointerEvents="box-none">
          <Pressable
            onPress={() => stub(he ? 'הוסף פעולה מהירה' : 'Add quick action')}
            style={({ pressed }) => [
              styles.fab,
              // Same surface colour as the tiles on the page (was a dark fill).
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={he ? 'הוסף פעולה מהירה' : 'Add quick action'}
          >
            <PlusIcon size={20} color={colors.text} />
            <Text style={[styles.fabText, { color: colors.text }]}>
              {he ? 'הוסף פעולה מהירה' : 'Add quick action'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    // Clearance so the last action isn't hidden behind the floating button
    // (bigger + raised now, so a touch more room).
    paddingBottom: 108,
  },
  // Floating "Add action" pill — centred near the sheet's bottom edge.
  // Full-width primary action, styled like the SignIn "Continue with Email"
  // button: side margins matching the content, so the button stretches across.
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Raised a touch off the bottom edge so it reads as a floating primary action.
    bottom: 34,
    paddingHorizontal: 22,
  },
  // Same shape as SignInSheet's ProviderButton: centred icon+label, deep 32
  // radius, weight-600 label — a full-width pill rather than a compact chip.
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: { fontSize: 16, fontWeight: '600' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },

  // Close-button header — hard-LTR so the X sits left in Hebrew, right in
  // English, with a single child positioned by justifyContent.
  headerRow: {
    direction: 'ltr',
    flexDirection: 'row',
    marginBottom: 10,
  },
  pillBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  drawerLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.9,
    marginBottom: 12,
  },
  drawerLabelSecond: { marginTop: 24 },

  // Drawer 1 — horizontal tiles. Negative margin lets the row scroll edge-to-
  // edge while the inner padding keeps the first/last tile inset. `overflow:
  // hidden` masks the tiles at the screen edges so a scrolling tile never spills
  // off-screen. Vertical padding gives the tile shadows room inside the mask.
  tilesScroll: { marginHorizontal: -20, overflow: 'hidden', paddingVertical: 6 },
  tilesRow: {
    paddingHorizontal: 20,
    paddingVertical: 2,
    gap: 12,
  },
  // Smaller tiles so MORE fit on screen and the next one PEEKS at the edge —
  // a visible cue that the row scrolls sideways.
  tile: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tileEmoji: { fontSize: 30 },
  tileLabel: { fontSize: 13, fontWeight: '600' },

  // Drawer 2 — vertical context list.
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  rowEmoji: { fontSize: 20 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
