/**
 * GlobalSheet — ONE01 Global. The world OUTSIDE the user.
 *
 * Not a content feed: a PROCESS NETWORK. Official ONEs, public processes you
 * can join, templates you can create from, aggregate insights, and (for a
 * business identity) market signals. Every action routes through the real
 * process engine — "Create" / "Join" actually mints a rich process; "Ask" /
 * "Connect" hands the intent to ONE.
 *
 * Identity-aware: same world, filtered by who the user is operating as.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { CloseIcon, SearchIcon, FilterIcon } from '../../components/mvp/icons';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeColors } from '../../utils/theme';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { useMvpStore, useActiveIdentity } from '../../stores/mvpStore';
import {
  buildGlobalFeed,
  type OfficialOne,
  type PublicProcessCard,
  type TemplateCard,
  type InsightCard,
  type SignalCard,
} from '../../data/mvp/global';
import { generateRichUnitByKey, type ArchetypeKey } from '../../data/mvp/unitArchetype';

interface GlobalSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function GlobalSheet({ visible, onClose }: GlobalSheetProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const identity = useActiveIdentity();
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const addUnit = useMvpStore((s) => s.addUnit);
  const setPendingHomeInput = useMvpStore((s) => s.setPendingHomeInput);

  const feed = useMemo(() => buildGlobalFeed(lang, identity?.type), [lang, identity?.type]);

  // Rotating world-level broadcast — now the big centred headline of the sheet.
  const [bIndex, setBIndex] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setBIndex(0);
    const id = setInterval(
      () => setBIndex((i) => (i + 1) % Math.max(1, feed.broadcasts.length)),
      5000,
    );
    return () => clearInterval(id);
  }, [visible, feed.broadcasts.length]);
  // Fade the headline on each rotation so it reads as ONE speaking, not flipping.
  const bOpacity = useSharedValue(1);
  const bStyle = useAnimatedStyle(() => ({ opacity: bOpacity.value }));
  useEffect(() => {
    bOpacity.value = 0;
    bOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [bIndex, bOpacity]);

  // ONE credits wallet — placeholder balance until a real credits system lands.
  const credits = 1240;

  // A scrollable "data bar" of world-level stats — mirrors the unit's metrics
  // row (swipe sideways for more). Counts come from the UNFILTERED feed.
  const globalStats: { label: string; value: string }[] = [
    { label: he ? 'קרדיטים' : 'Credits', value: credits.toLocaleString() },
    { label: he ? 'ONE רשמיים' : 'Official ONEs', value: String(feed.officials.length) },
    { label: he ? 'ציבוריים' : 'Public', value: String(feed.publicProcesses.length) },
    { label: he ? 'תבניות' : 'Templates', value: String(feed.templates.length) },
    { label: he ? 'תובנות' : 'Insights', value: String(feed.insights.length) },
  ];

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = useCallback((...parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q)), [q]);

  const officials = feed.officials.filter((o) => match(o.name, o.category));
  const publicProcesses = feed.publicProcesses.filter((p) => match(p.title, p.by));
  const templates = feed.templates.filter((t) => match(t.title, ...t.steps));
  const insights = feed.insights.filter((i) => match(i.title, ...i.points));
  const signals = feed.signals.filter((s) => match(s.text));

  // Create a real, rich process from a Global card and drop it on Home.
  const createFromArchetype = useCallback(
    (key: ArchetypeKey, title: string) => {
      const unit = generateRichUnitByKey(key, activeIdentityId, lang, Date.now(), title);
      addUnit(unit);
      onClose();
      Alert.alert(
        he ? 'תהליך נוצר' : 'Process created',
        `${unit.emoji} ${unit.title} — ${he ? 'נוסף לתהליכים שלך, מלא וערוך לפעולה.' : 'added to your processes, full and ready to act on.'}`,
      );
    },
    [activeIdentityId, lang, addUnit, onClose, he],
  );

  // Hand an intent to ONE — lands back on Home with ONE answering.
  const askOne = useCallback(
    (prompt: string) => {
      setPendingHomeInput(prompt);
      onClose();
    },
    [setPendingHomeInput, onClose],
  );

  const rtl = rtlText(lang);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      // Single snap — no half-card detent. A downward drag closes it in one
      // motion (there's no lower snap to catch on). Close also via the X or a
      // backdrop tap.
      snapPoints={['92%']}
      enableContentPan={true}
      bypassDefaultView={true}
      // Fire the close haptic the instant the drag passes the dismiss point —
      // synced to the gesture, not delayed to the end of the slide.
      onDragDismissCross={() => haptic.press()}
      // Screen-pinned bottom fade so content scrolls into a soft bar at the
      // sheet's bottom edge (matches the profile / unit sheets). In the overlay
      // (not content) so it sits at the sheet bottom rather than gorhom's
      // content bottom.
      overlay={<EdgeBars top={false} bottomHeight={130} style={{ zIndex: 5 }} />}
      sheetStyle={styles.sheet}
    >
      {/* Soft top gradient behind the header — content scrolls UNDER it, same
          treatment as the process sheet. The header (zIndex 20) stays crisp
          above it. */}
      <EdgeBars bottom={false} topHeight={112} topLinear />
      {/* Sticky header — credits wallet (left) + close (right). */}
      <View style={styles.topHeader} pointerEvents="box-none">
        <Pressable
          onPress={() =>
            Alert.alert(
              he ? 'הארנק שלך' : 'Your wallet',
              he
                ? `יש לך ${credits.toLocaleString()} קרדיטים של ONE.`
                : `You have ${credits.toLocaleString()} ONE credits.`,
            )
          }
          style={[styles.walletPill, { backgroundColor: colors.surface }]}
          accessibilityLabel={he ? 'ארנק קרדיטים' : 'Credits wallet'}
        >
          {/* ONE's mark — a small black dot, ALWAYS to the left of the amount
              (the pill row is hard-LTR so it never flips in Hebrew). */}
          <View style={[styles.walletDot, { backgroundColor: colors.text }]} />
          <Text style={[styles.walletAmount, { color: colors.text }]}>
            {credits.toLocaleString()}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={18}
          style={[styles.pillBtn, { backgroundColor: colors.surface }]}
          accessibilityLabel={he ? 'סגור' : 'Close'}
        >
          <CloseIcon size={22} color={colors.text} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        style={styles.flex1}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero — just ONE's big, centred world broadcast. */}
        <View style={styles.hero}>
          <Animated.Text
            style={[styles.heroBroadcast, { color: colors.text }, bStyle]}
            numberOfLines={3}
          >
            {feed.broadcasts[bIndex]}
          </Animated.Text>
        </View>

        {/* World data bar — swipe sideways for more (mirrors the unit metrics). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContent}
        >
          {globalStats.map((s) => (
            <View key={s.label} style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {s.label.toUpperCase()}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Search ONE — a capsule like the input bar, with a filter button. */}
        <View style={[styles.searchRow, { backgroundColor: colors.surface }, rtlRow(lang)]}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={he ? 'חיפוש ב-ONE' : 'Search ONE'}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }, rtlText(lang)]}
          />
          <Pressable
            onPress={() =>
              Alert.alert(
                he ? 'סינון' : 'Filters',
                he ? 'סינון תוצאות — בקרוב.' : 'Filter results — coming soon.',
              )
            }
            hitSlop={8}
            style={styles.filterBtn}
            accessibilityLabel={he ? 'סינון' : 'Filter'}
          >
            <FilterIcon size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Market signals — business identities only. Highest value at top. */}
        {signals.length > 0 && (
          <SectionTitle colors={colors} rtl={rtl}>
            {he ? 'אותות שוק' : 'Market signals'}
          </SectionTitle>
        )}
        {signals.map((s: SignalCard) => (
          <View
            key={s.id}
            style={[styles.signalCard, { backgroundColor: colors.surface }, rtlRow(lang)]}
          >
            <Text style={styles.cardEmoji}>{s.emoji}</Text>
            <Text style={[styles.signalText, { color: colors.text }, rtl]}>{s.text}</Text>
          </View>
        ))}

        {/* Official ONEs */}
        {officials.length > 0 && (
          <SectionTitle colors={colors} rtl={rtl}>
            {he ? 'ONE רשמיים' : 'Official ONEs'}
          </SectionTitle>
        )}
        {officials.map((o: OfficialOne) => (
          <View
            key={o.id}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cardHead, rtlRow(lang)]}>
              <Text style={styles.cardEmoji}>{o.emoji}</Text>
              <View style={styles.flex1}>
                <View style={[styles.titleRow, rtlRow(lang)]}>
                  <Text style={[styles.cardTitle, { color: colors.text }, rtl]} numberOfLines={1}>
                    {o.name}
                  </Text>
                  <View style={[styles.verifiedTag, { backgroundColor: colors.text }]}>
                    <Text style={[styles.verifiedText, { color: colors.background }]}>
                      {he ? 'רשמי' : 'Official'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardSub, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {o.category}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {o.status}
                </Text>
              </View>
            </View>
            <View style={[styles.actionRow, rtlRow(lang)]}>
              <PillAction colors={colors} primary onPress={() => askOne(he ? `קבע תור ב-${o.name}` : `Book an appointment at ${o.name}`)}>
                {he ? 'הזמנה' : 'Book'}
              </PillAction>
              <PillAction colors={colors} onPress={() => askOne(he ? `יש לי שאלה ל-${o.name}` : `I have a question for ${o.name}`)}>
                {he ? 'שאל' : 'Ask'}
              </PillAction>
              <PillAction colors={colors} onPress={() => askOne(he ? `חבר אותי ל-${o.name}` : `Connect me with ${o.name}`)}>
                {he ? 'התחבר' : 'Connect'}
              </PillAction>
            </View>
          </View>
        ))}

        {/* Public processes */}
        {publicProcesses.length > 0 && (
          <SectionTitle colors={colors} rtl={rtl}>
            {he ? 'תהליכים ציבוריים' : 'Public processes'}
          </SectionTitle>
        )}
        {publicProcesses.map((p: PublicProcessCard) => (
          <View
            key={p.id}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cardHead, rtlRow(lang)]}>
              <Text style={styles.cardEmoji}>{p.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={[styles.cardTitle, { color: colors.text }, rtl]} numberOfLines={1}>
                  {p.title}
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {he ? 'מאת' : 'By'} {p.by}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {p.meta}
                </Text>
              </View>
            </View>
            <View style={[styles.actionRow, rtlRow(lang)]}>
              <PillAction colors={colors} primary onPress={() => createFromArchetype(p.archetype, p.title)}>
                {he ? 'הצטרף לתהליך' : 'Join process'}
              </PillAction>
            </View>
          </View>
        ))}

        {/* Templates */}
        {templates.length > 0 && (
          <SectionTitle colors={colors} rtl={rtl}>
            {he ? 'תבניות' : 'Templates'}
          </SectionTitle>
        )}
        {templates.map((tpl: TemplateCard) => (
          <View
            key={tpl.id}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cardHead, rtlRow(lang)]}>
              <Text style={styles.cardEmoji}>{tpl.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={[styles.cardTitle, { color: colors.text }, rtl]} numberOfLines={1}>
                  {tpl.title}
                </Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {he ? `תבנית בשימוש ${tpl.usedBy.toLocaleString()} אנשים` : `Used by ${tpl.usedBy.toLocaleString()} people`}
                </Text>
              </View>
            </View>
            <Text style={[styles.steps, { color: colors.textSecondary }, rtl]} numberOfLines={2}>
              {tpl.steps.join('  ·  ')}
            </Text>
            <View style={[styles.actionRow, rtlRow(lang)]}>
              <PillAction colors={colors} primary onPress={() => createFromArchetype(tpl.archetype, tpl.title)}>
                {he ? 'צור תהליך' : 'Create process'}
              </PillAction>
            </View>
          </View>
        ))}

        {/* Aggregate intelligence */}
        {insights.length > 0 && (
          <SectionTitle colors={colors} rtl={rtl}>
            {he ? 'תובנות מאגרגציה' : 'Aggregate intelligence'}
          </SectionTitle>
        )}
        {insights.map((ins: InsightCard) => (
          <View
            key={ins.id}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cardHead, rtlRow(lang)]}>
              <Text style={styles.cardEmoji}>{ins.emoji}</Text>
              <Text style={[styles.cardTitle, { color: colors.text }, rtl]} numberOfLines={1}>
                {ins.title}
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }, rtl]}>
              {he ? 'איפה רוב האנשים נתקעים:' : 'Where most people get stuck:'}
            </Text>
            {ins.points.map((pt, i) => (
              <Text key={i} style={[styles.insightPoint, { color: colors.text }, rtl]}>
                {`${i + 1}. ${pt}`}
              </Text>
            ))}
            <View style={[styles.actionRow, rtlRow(lang)]}>
              <PillAction colors={colors} primary onPress={() => createFromArchetype(ins.archetype, ins.title)}>
                {he ? 'צור מזה' : 'Create from this'}
              </PillAction>
            </View>
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function SectionTitle({
  children,
  colors,
  rtl,
}: {
  children: React.ReactNode;
  colors: ThemeColors;
  rtl: object | null;
}) {
  return (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }, rtl]}>{children}</Text>
  );
}

function PillAction({
  children,
  onPress,
  colors,
  primary,
}: {
  children: React.ReactNode;
  onPress: () => void;
  colors: ThemeColors;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillAction,
        primary
          ? { backgroundColor: colors.circle }
          : { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.pillActionText, { color: primary ? colors.circleEye : colors.text }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: {},
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },

  // Shared header metrics across the Global / Settings / ONE-profile sheets so
  // the close button + header height sit identically when switching between them.
  // ABSOLUTE overlay (like the process sheet) so content scrolls fully UNDER it
  // and fades out cleanly into the top gradient — no rough clip at a header seam.
  // zIndex 20 keeps the header crisp ABOVE the EdgeBars top gradient (zIndex 15).
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    zIndex: 20,
  },
  // Credits wallet — an input-like capsule on the left of the header. Hard-LTR
  // (never row-reverse) so the ONE dot stays to the LEFT of the amount even in
  // Hebrew. Carries the same shadow weight as the close button so the two read
  // as a balanced pair across the header.
  walletPill: {
    // Hard LTR so the ONE dot stays to the LEFT of the amount even in Hebrew —
    // `direction` is immune to the engine's RTL flipping.
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Match the X button's height (44) so the two header pills read as a pair.
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  walletDot: { width: 12, height: 12, borderRadius: 6 },
  walletAmount: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
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

  // paddingTop clears the absolute header so the first row starts just below it.
  content: { paddingHorizontal: 22, paddingTop: 70, paddingBottom: 48, gap: 14 },

  // Hero — ONE's big centred world broadcast (the headline of the sheet).
  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 8, paddingHorizontal: 6 },
  // Matches Home's broadcast size/weight so the two read as the same voice.
  heroBroadcast: {
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 30,
    textAlign: 'center',
  },

  // Horizontal "data bar" of world stats (same cell shape as the unit metrics).
  statsScroll: { marginTop: 2 },
  statsContent: { paddingHorizontal: 4, gap: 22 },
  statCell: { alignItems: 'center', gap: 5, minWidth: 78 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '700' },

  // Search — a capsule like the input bar: search icon, field, filter button.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  filterBtn: { padding: 4 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.9,
    marginTop: 8,
  },

  card: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji: { fontSize: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  cardSub: { fontSize: 13, marginTop: 2 },
  cardMeta: { fontSize: 13, marginTop: 1 },
  verifiedTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { fontSize: 10, fontWeight: '700' },

  steps: { fontSize: 13, lineHeight: 19 },
  insightPoint: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pillAction: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActionText: { fontSize: 14, fontWeight: '600' },

  signalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  signalText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
});
