/**
 * GlobalSheet — ONE01 Global. The world OUTSIDE the user, as a live MARKETPLACE
 * OF WANTS.
 *
 * Top: a never-ending loop of the wants moving through the world right now
 * (the front card drops away and the next rises). Then a category filter and
 * topic hashtags. Scroll down for the durable sources, organised as collapsible
 * "drawers" by world — Business, Processes, Templates, Insights — plus, for a
 * business identity, the owner's own business ONE at the top.
 *
 * Every action routes through the real process engine: "Start" mints a rich
 * process; "Respond" / "Explore" hands the intent to ONE. Identity-aware: same
 * world, filtered by who the user is operating as.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SpaceSwitcher } from '../../components/mvp/SpaceSwitcher';
import { type SharedValue } from 'react-native-reanimated';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { CardLoop } from '../../components/mvp/CardLoop';
import { CloseIcon, ArrowDownIcon, HeartIcon, BookIcon, HouseIcon, PlaneIcon, BriefcaseIcon, DocIcon, PlusIcon } from '../../components/mvp/icons';
import { Orb } from '../../components/mvp/Orb';

/** Per-"world" accent colour + icon for the circular category selector. 'all'
 *  is ONE itself (rendered as the orb), so it isn't in this map. */
const WORLD_META: Partial<Record<CategoryKey, { color: string; Icon: (p: { size?: number; color?: string }) => React.ReactElement }>> = {
  health: { color: '#34D399', Icon: HeartIcon },
  learning: { color: '#A78BFA', Icon: BookIcon },
  home: { color: '#60A5FA', Icon: HouseIcon },
  travel: { color: '#38BDF8', Icon: PlaneIcon },
  business: { color: '#FBBF24', Icon: BriefcaseIcon },
  bureaucracy: { color: '#94A3B8', Icon: DocIcon },
};
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeColors } from '../../utils/theme';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { useMvpStore, useActiveIdentity } from '../../stores/mvpStore';
import { buildGlobalFeed, type CategoryKey } from '../../data/mvp/global';
import { generateRichUnitByKey, type ArchetypeKey } from '../../data/mvp/unitArchetype';

interface GlobalSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Open the "join a shared process by code" sheet (provider side). */
  onJoinShared?: () => void;
  /** Live animated index (-1 closed … 0 open), written as the sheet slides so
   *  Home can fade its input dock back in sync with the close drag. */
  animatedIndex?: SharedValue<number>;
}

// One unified card in the top wants-loop.
interface LoopCard {
  id: string;
  emoji: string;
  kind: string;
  meta?: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
}

const LOOP_CARD_H = 300;

// Short, clean unit titles per archetype — so "Start this" mints a process with
// a real name rather than the whole want sentence.
const ARCHETYPE_TITLE: Record<ArchetypeKey, [string, string]> = {
  fitness: ['Weight gain', 'עלייה במשקל'],
  license: ['Driving license', 'רישיון נהיגה'],
  moving: ['Move apartment', 'מעבר דירה'],
  learning: ['Learning', 'לימודים'],
  business: ['My business', 'העסק שלי'],
  travel: ['Plan a trip', 'תכנון טיול'],
};

export function GlobalSheet({ visible, onClose, onJoinShared, animatedIndex }: GlobalSheetProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  // Desktop = centered card; its bottom edge-fade lives INSIDE the card (via
  // BottomSheet), so the screen-pinned one is skipped there.
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;
  const identity = useActiveIdentity();
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const addUnit = useMvpStore((s) => s.addUnit);
  const setPendingHomeInput = useMvpStore((s) => s.setPendingHomeInput);

  const feed = useMemo(() => buildGlobalFeed(lang, identity?.type), [lang, identity?.type]);

  const credits = 1240;
  const rtl = rtlText(lang);

  // Filters — category chip + free-text (tapped hashtag).
  const [selectedCat, setSelectedCat] = useState<CategoryKey>('all');
  const [query, setQuery] = useState('');
  // Collapsible "drawer" worlds — all open by default so scrolling reveals content.
  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>({
    business: true,
    processes: true,
    templates: true,
    insights: true,
  });
  const q = query.trim().toLowerCase();
  const match = useCallback(
    (...parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q)),
    [q],
  );
  const inCat = useCallback(
    // Fitness folds into Health — selecting Health also shows fitness items.
    (c: CategoryKey) =>
      selectedCat === 'all' ||
      c === selectedCat ||
      (selectedCat === 'health' && c === 'fitness'),
    [selectedCat],
  );

  // Reset filters each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSelectedCat('all');
      setQuery('');
      setOpenDrawers({ business: true, processes: true, templates: true, insights: true });
    }
  }, [visible]);

  // ── Filtered datasets ────────────────────────────────────────────────────
  const wants = feed.wants.filter((w) => inCat(w.category) && match(w.text));
  const officials = feed.officials.filter((o) => inCat(o.cat) && match(o.name, o.category));
  const publicProcesses = feed.publicProcesses.filter((p) => inCat(p.cat) && match(p.title, p.by));
  const templates = feed.templates.filter((t) => inCat(t.cat) && match(t.title, ...t.steps));
  const insights = feed.insights.filter((i) => inCat(i.cat) && match(i.title, ...i.points));
  const signals = feed.signals.filter((s) => inCat(s.cat) && match(s.text));

  // ── Actions ──────────────────────────────────────────────────────────────
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

  const askOne = useCallback(
    (prompt: string) => {
      setPendingHomeInput(prompt);
      onClose();
    },
    [setPendingHomeInput, onClose],
  );

  // ── The wants loop (top banner) ────────────────────────────────────────────
  const loopCards: LoopCard[] = useMemo(
    () =>
      wants.map((w) => {
        const catLabel = feed.categories.find((c) => c.key === w.category)?.label ?? '';
        return {
          id: w.id,
          emoji: w.emoji,
          kind: catLabel,
          meta: w.meta,
          title: w.text,
          actionLabel: w.archetype
            ? he
              ? 'התחל גם'
              : 'Start this'
            : he
              ? 'בדוק'
              : 'Explore',
          onAction: () =>
            w.archetype
              ? createFromArchetype(w.archetype, ARCHETYPE_TITLE[w.archetype][he ? 1 : 0])
              : askOne(w.text),
        };
      }),
    [wants, feed.categories, he, createFromArchetype, askOne],
  );

  // ── Drawers (collapsible worlds) ──────────────────────────────────────────
  const toggleDrawer = useCallback((key: string) => {
    haptic.select();
    setOpenDrawers((d) => ({ ...d, [key]: !d[key] }));
  }, []);

  // Owner's own business ONE — surfaces for a business identity.
  const showOwnBusiness =
    identity?.type === 'business' && (selectedCat === 'all' || selectedCat === 'business');

  const stripTag = (tag: string) => tag.replace(/^#/, '').replace(/[_-]/g, ' ').trim();
  const hashtags = feed.hashtagsByCategory[selectedCat] ?? [];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      animatedIndex={animatedIndex}
      snapPoints={['92%']}
      enableContentPan={true}
      bypassDefaultView={true}
      onDragDismissCross={() => haptic.press()}
      overlay={
        /* Screen-pinned bottom fade — content scrolls into it. On desktop the
           card gets an in-card fade instead (via BottomSheet). */
        !isDesktop ? <EdgeBars top={false} bottomHeight={110} style={{ zIndex: 5 }} /> : null
      }
      sheetStyle={styles.sheet}
    >
      <EdgeBars bottom={false} topHeight={112} topLinear />

      {/* Sticky header — credits wallet (left) + close (right). */}
      <View style={styles.topHeader} pointerEvents="box-none">
        <Pressable
          onPress={() =>
            Alert.alert(
              he ? 'הארנק שלך' : 'Your wallet',
              he ? `יש לך ${credits.toLocaleString()} קרדיטים של ONE.` : `You have ${credits.toLocaleString()} ONE credits.`,
            )
          }
          style={[styles.walletPill, { backgroundColor: colors.surface }]}
          accessibilityLabel={he ? 'ארנק קרדיטים' : 'Credits wallet'}
        >
          <View style={[styles.walletDot, { backgroundColor: colors.text }]} />
          <Text style={[styles.walletAmount, { color: colors.text }]}>{credits.toLocaleString()}</Text>
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
        {/* Space switcher — Global is scoped to the active space (its feed reads
            the identity type), same component as the home list. */}
        <SpaceSwitcher style={styles.globalSpaceSwitcher} />

        {/* Provider side: join a process someone shared with you, by code. */}
        {onJoinShared && (
          <Pressable
            onPress={() => { haptic.tap(); onJoinShared(); }}
            style={({ pressed }) => [styles.joinRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }, rtlRow(lang)]}
            accessibilityRole="button"
          >
            <Text style={styles.joinEmoji}>🔗</Text>
            <Text style={[styles.joinText, { color: colors.text }, rtl]} numberOfLines={1}>
              {he ? 'הצטרף לתהליך משותף בעזרת קוד' : 'Join a shared process with a code'}
            </Text>
            <Text style={[styles.joinChev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
          </Pressable>
        )}

        {/* 1) LIVE WANTS — the loop, first, breathing space below the header. */}
        {loopCards.length > 0 ? (
          <CardLoop
            items={loopCards}
            cardHeight={LOOP_CARD_H}
            renderCard={(c) => (
              <View style={[styles.loopCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.loopBadgeRow, rtlRow(lang)]}>
                  <View style={styles.loopBadge}>
                    <Text style={styles.loopBadgeText}>{c.kind}</Text>
                  </View>
                  {c.meta ? (
                    <Text style={[styles.loopMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {c.meta}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.loopEmoji}>{c.emoji}</Text>
                <Text style={[styles.loopTitle, { color: colors.text }, rtl]} numberOfLines={4}>
                  {c.title}
                </Text>
                <View style={styles.flex1} />
                <View style={[styles.actionRow, rtlRow(lang)]}>
                  <PillAction colors={colors} primary onPress={c.onAction}>
                    {c.actionLabel}
                  </PillAction>
                </View>
              </View>
            )}
          />
        ) : (
          <View style={[styles.loopEmpty, { height: LOOP_CARD_H }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }, rtl]}>
              {he ? 'אין רצונות בקטגוריה הזו כרגע' : 'No live wants in this category right now'}
            </Text>
          </View>
        )}

        {/* Everything below the loop sits on an OPAQUE band (page colour) so the
            front card, as it drops away, slides BEHIND this content and vanishes
            — it never runs over the chips / drawers. Shadows stay intact (unlike
            an overflow mask). */}
        <View style={[styles.belowLoop, { backgroundColor: colors.background }]}>
        {/* 2) "Worlds" — the categories as circular, colour-coded icons with a
            label beneath (ONE leads, shown as its orb). A "+" trails to add a
            world. Selecting one filters the feed below. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.worldsContent}
        >
          {feed.categories.map((cat) => {
            const active = selectedCat === cat.key;
            const meta = WORLD_META[cat.key];
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  haptic.select();
                  setSelectedCat(cat.key);
                }}
                style={styles.world}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={cat.label}
              >
                <View
                  style={[
                    styles.worldCircle,
                    { backgroundColor: colors.circle },
                    active && { borderWidth: 2.5, borderColor: meta?.color ?? colors.text },
                  ]}
                >
                  {cat.key === 'all' ? (
                    // ONE itself — the orb fills the circle (its eyes ARE the mark).
                    <Orb size={58} noBlink noShadow />
                  ) : meta ? (
                    // The category's icon sits where ONE's eyes would be — big,
                    // nudged up to the eye line — so the circle reads as ONE
                    // "wearing" that world, not a small glyph in a dot.
                    <View style={styles.worldIconEye}>
                      <meta.Icon size={30} color={meta.color} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.worldLabel,
                    { color: active ? colors.text : colors.textSecondary },
                    active && styles.worldLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
          {/* Add a world (coming soon). */}
          <Pressable
            onPress={() =>
              Alert.alert(he ? 'הוספת עולם' : 'Add a world', he ? 'עוד רגע — היכולת הזו בדרך.' : 'Coming soon.')
            }
            style={styles.world}
            accessibilityRole="button"
            accessibilityLabel={he ? 'הוסף עולם' : 'Add a world'}
          >
            <View style={[styles.worldCircle, styles.worldAdd, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <PlusIcon size={24} color={colors.text} />
            </View>
          </Pressable>
        </ScrollView>

        {/* 3) Topic hashtags for the selected category. */}
        {hashtags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsScroll}
            contentContainerStyle={styles.tagsContent}
          >
            {hashtags.map((tag) => {
              const active = q.length > 0 && stripTag(tag).toLowerCase() === q;
              return (
                <Pressable
                  key={tag}
                  onPress={() => {
                    haptic.select();
                    setQuery(active ? '' : stripTag(tag));
                  }}
                  style={[styles.tag, active && { backgroundColor: colors.circle, borderColor: colors.circle }]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: active ? colors.circleEye : colors.textSecondary },
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 4) Drawers — the durable sources, by world. */}
        {showOwnBusiness ? (
          <View style={[styles.ownerCard, { backgroundColor: colors.text }]}>
            <View style={[styles.ownerRow, rtlRow(lang)]}>
              <Text style={styles.ownerEmoji}>💼</Text>
              <View style={styles.flex1}>
                <Text style={[styles.ownerName, { color: colors.background }, rtl]} numberOfLines={1}>
                  {identity?.name}
                </Text>
                <Text style={[styles.ownerSub, { color: colors.background }, rtl]} numberOfLines={1}>
                  {he ? 'ה-ONE העסקי שלך · בעלים' : 'Your business ONE · Owner'}
                </Text>
              </View>
              <Pressable
                onPress={() => askOne(he ? 'הצג לי את לוח הבקרה של העסק שלי' : 'Show me my business dashboard')}
                style={[styles.ownerBtn, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.ownerBtnText, { color: colors.text }]}>{he ? 'נהל' : 'Manage'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Drawer
          colors={colors}
          lang={lang}
          emoji="💼"
          title={he ? 'עסקים' : 'Business'}
          count={officials.length + signals.length}
          open={openDrawers.business}
          onToggle={() => toggleDrawer('business')}
        >
          {officials.map((o) => (
            <DrawerRow
              key={o.id}
              colors={colors}
              lang={lang}
              emoji={o.emoji}
              title={o.name}
              sub={`${o.category} · ${o.status}`}
              actionLabel={he ? 'הזמנה' : 'Book'}
              onAction={() => askOne(he ? `קבע תור ב-${o.name}` : `Book an appointment at ${o.name}`)}
            />
          ))}
          {signals.map((s) => (
            <DrawerRow
              key={s.id}
              colors={colors}
              lang={lang}
              emoji={s.emoji}
              title={s.text}
              actionLabel={he ? 'בדוק' : 'Explore'}
              onAction={() => askOne(s.text)}
            />
          ))}
        </Drawer>

        <Drawer
          colors={colors}
          lang={lang}
          emoji="🔄"
          title={he ? 'תהליכים' : 'Processes'}
          count={publicProcesses.length}
          open={openDrawers.processes}
          onToggle={() => toggleDrawer('processes')}
        >
          {publicProcesses.map((p) => (
            <DrawerRow
              key={p.id}
              colors={colors}
              lang={lang}
              emoji={p.emoji}
              title={p.title}
              sub={`${he ? 'מאת' : 'By'} ${p.by} · ${p.meta}`}
              actionLabel={he ? 'הצטרף' : 'Join'}
              onAction={() => createFromArchetype(p.archetype, p.title)}
            />
          ))}
        </Drawer>

        <Drawer
          colors={colors}
          lang={lang}
          emoji="📋"
          title={he ? 'תבניות' : 'Templates'}
          count={templates.length}
          open={openDrawers.templates}
          onToggle={() => toggleDrawer('templates')}
        >
          {templates.map((tpl) => (
            <DrawerRow
              key={tpl.id}
              colors={colors}
              lang={lang}
              emoji={tpl.emoji}
              title={tpl.title}
              sub={
                (he ? `בשימוש ${tpl.usedBy.toLocaleString()} אנשים` : `Used by ${tpl.usedBy.toLocaleString()} people`) +
                ` · ${tpl.steps.join(' · ')}`
              }
              actionLabel={he ? 'צור תהליך' : 'Create'}
              onAction={() => createFromArchetype(tpl.archetype, tpl.title)}
            />
          ))}
        </Drawer>

        <Drawer
          colors={colors}
          lang={lang}
          emoji="💡"
          title={he ? 'תובנות' : 'Insights'}
          count={insights.length}
          open={openDrawers.insights}
          onToggle={() => toggleDrawer('insights')}
        >
          {insights.map((ins) => (
            <DrawerRow
              key={ins.id}
              colors={colors}
              lang={lang}
              emoji={ins.emoji}
              title={ins.title}
              sub={ins.points.join(' · ')}
              actionLabel={he ? 'צור מזה' : 'Create'}
              onAction={() => createFromArchetype(ins.archetype, ins.title)}
            />
          ))}
        </Drawer>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Drawer({
  colors,
  lang,
  emoji,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  colors: ThemeColors;
  lang: string;
  emoji: string;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  // Hide a world entirely when the active filter empties it.
  if (count === 0) return null;
  return (
    <View style={styles.drawer}>
      <Pressable onPress={onToggle} style={[styles.drawerHeader, rtlRow(lang)]}>
        <Text style={styles.drawerEmoji}>{emoji}</Text>
        <Text style={[styles.drawerTitle, { color: colors.text }, rtlText(lang)]}>{title}</Text>
        <View style={[styles.drawerCount, { backgroundColor: colors.surface }]}>
          <Text style={[styles.drawerCountText, { color: colors.textSecondary }]}>{count}</Text>
        </View>
        <View style={styles.flex1} />
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <ArrowDownIcon size={18} color={colors.textSecondary} />
        </View>
      </Pressable>
      {open ? <View style={styles.drawerBody}>{children}</View> : null}
    </View>
  );
}

function DrawerRow({
  colors,
  lang,
  emoji,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  colors: ThemeColors;
  lang: string;
  emoji: string;
  title: string;
  sub?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={[styles.drawerRow, { backgroundColor: colors.surface }, rtlRow(lang)]}>
      <Text style={styles.drawerRowEmoji}>{emoji}</Text>
      <View style={styles.flex1}>
        <Text style={[styles.drawerRowTitle, { color: colors.text }, rtlText(lang)]} numberOfLines={2}>
          {title}
        </Text>
        {sub ? (
          <Text style={[styles.drawerRowSub, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <PillAction colors={colors} primary onPress={onAction}>
        {actionLabel}
      </PillAction>
    </View>
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
      <Text style={[styles.pillActionText, { color: primary ? colors.circleEye : colors.text }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: {},

  // Header (shared metrics with the other sheets).
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
  walletPill: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  // paddingTop clears the absolute header AND gives the banner room to breathe
  // below the credits / close row. paddingBottom leaves a little breathing room
  // above the bottom gradient (the floating input dock was removed).
  // maxWidth + centre so the content column doesn't stretch edge-to-edge on wide
  // (web/desktop) viewports even though the sheet is full-width. No effect on a
  // phone (screen narrower than the cap).
  content: { paddingHorizontal: 22, paddingTop: 84, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 620, alignSelf: 'center' },
  globalSpaceSwitcher: { marginBottom: 2 },

  // "Join a shared process by code" — the provider entry into the two-sided Unit.
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  joinEmoji: { fontSize: 18 },
  joinText: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  joinChev: { fontSize: 18, fontWeight: '700' },

  // Opaque band that everything below the loop sits on — the dropping front card
  // slides behind it and disappears (page colour → seamless, no visible seam).
  belowLoop: { gap: 14 },

  // "Worlds" — circular, colour-coded category selector.
  chipsScroll: { marginTop: 2 },
  worldsContent: { paddingHorizontal: 2, gap: 16, paddingVertical: 4, alignItems: 'flex-start' },
  world: { width: 66, alignItems: 'center', gap: 7 },
  worldCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  worldAdd: { borderWidth: StyleSheet.hairlineWidth },
  // Lifts the category icon to the orb's eye line (eyes sit just above centre).
  worldIconEye: { transform: [{ translateY: -2 }] },
  worldLabel: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  worldLabelActive: { fontWeight: '800' },

  // Topic hashtags.
  tagsScroll: {},
  tagsContent: { paddingHorizontal: 2, gap: 8, paddingVertical: 2 },
  tag: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  tagText: { fontSize: 13, fontWeight: '600' },

  // Actions.
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pillAction: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActionText: { fontSize: 14, fontWeight: '600' },

  // ── Wants loop card ──────────────────────────────────────────────────────
  loopCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  loopBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loopBadge: {
    backgroundColor: '#34D8A0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  loopBadgeText: { fontSize: 12, fontWeight: '800', color: '#062018', letterSpacing: 0.3 },
  loopMeta: { fontSize: 12, fontWeight: '600' },
  loopEmoji: { fontSize: 40, marginTop: 16 },
  loopTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginTop: 8, lineHeight: 30 },
  loopEmpty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },

  // ── Drawers ────────────────────────────────────────────────────────────────
  drawer: { marginTop: 6 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  drawerEmoji: { fontSize: 18 },
  drawerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  drawerCount: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  drawerCountText: { fontSize: 12, fontWeight: '700' },
  chevron: { transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  drawerBody: { gap: 8, marginTop: 2 },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
  },
  drawerRowEmoji: { fontSize: 26 },
  drawerRowTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  drawerRowSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  // ── Owner's own business ONE ───────────────────────────────────────────────
  ownerCard: { borderRadius: 20, padding: 16, marginTop: 6 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerEmoji: { fontSize: 30 },
  ownerName: { fontSize: 17, fontWeight: '800' },
  ownerSub: { fontSize: 12, marginTop: 2, opacity: 0.75 },
  ownerBtn: { paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  ownerBtnText: { fontSize: 14, fontWeight: '700' },
});
