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
import { useMvpStore, useActiveIdentity, disclosureForIdentity } from '../../stores/mvpStore';
import { buildGlobalFeed, type CategoryKey } from '../../data/mvp/global';
import { generateRichUnitByKey, type ArchetypeKey } from '../../data/mvp/unitArchetype';
import { shareUnit, postSharedMessage } from '../../services/cloudShared';
import { openDisclosureStrings, openMemoryStrings } from '../../data/mvp/disclosure';
import { unitStatusLine } from '../../utils/unitStatusLine';

/** A stable hash of a string → a deterministic pseudo-count, so a desire's
 *  anonymous "aggregate" reads the same every time (not a flickering random). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Infer a desire's world from its title, so ONE can match it to the right
 *  providers in Global. Order matters (fitness before health; bureaucracy
 *  catches license/insurance/passport). */
const CAT_PATTERNS: [CategoryKey, RegExp][] = [
  ['fitness', /כושר|אימון|שריר|מסה|fitness|gym|workout/i],
  ['health', /רופא|עור|מרפאה|בריאות|שיניים|doctor|clinic|health|dentist|dermatolog/i],
  ['learning', /ללמוד|לימוד|קורס|מורה|תואר|learn|course|tutor|study|degree/i],
  ['home', /דירה|מעבר|שיפוץ|הובלה|home|moving|renovat|handyman|movers/i],
  ['travel', /טיול|נסיעה|טיסה|חופשה|מלון|travel|trip|flight|vacation|hotel/i],
  ['business', /עסק|לקוחות|חברה|business|clients|company/i],
  ['bureaucracy', /רישיון|רשיון|רשות|ביטוח|דרכון|ממשל|עירייה|license|insurance|passport|government|tax|permit|visa/i],
];
function desireCategory(title: string): CategoryKey {
  for (const [cat, re] of CAT_PATTERNS) if (re.test(title)) return cat;
  return 'all';
}

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

  // The user's OWN active desires, shown as ANONYMOUS AGGREGATE posts — their
  // private processes join the collective ("you and N others…"), the human-layer
  // vision made concrete. Counts are deterministic (hashed), so they stay stable.
  const allUnits = useMvpStore((s) => s.units);
  const myDesires = useMemo(() => {
    const mine = allUnits.filter((u) => u.identityId === activeIdentityId && u.status !== 'completed');
    const frames = he ? ['החודש', 'השבוע', 'לידך', 'בימים אלה'] : ['this month', 'this week', 'near you', 'these days'];
    return mine.slice(0, 8).map((u) => {
      const n = 3 + (hashStr(u.title) % 46);
      const frame = frames[hashStr(u.id) % frames.length];
      const cat = desireCategory(u.title);
      // The supply side: providers in Global who can take this desire on.
      const helpers = cat === 'all' ? [] : feed.officials.filter((o) => o.cat === cat);
      return {
        id: u.id,
        emoji: u.emoji,
        title: u.title,
        aggregate: he ? `את/ה ו-${n} אחרים · ${frame}` : `you and ${n} others · ${frame}`,
        helpers,
      };
    });
  }, [allUnits, activeIdentityId, he, feed.officials]);

  // Which desire's "who can help" panel is expanded (tap a desire card).
  const [selectedDesireId, setSelectedDesireId] = useState<string | null>(null);
  const selectedDesire = myDesires.find((d) => d.id === selectedDesireId) ?? null;

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
      setSelectedDesireId(null);
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

  // Reach a provider on a desire's behalf — through ONE, disclosure-safe, and
  // it actually PERFORMS: ONE composes the outward message, publishes a
  // disclosure-safe snapshot (open facts + open memories + the message only —
  // never ask/private), and opens a live shared thread the provider can join by
  // code. The proof of the wedge: ONE does something real for you, with no
  // network of users required. Degrades to a local-only draft if the backend is
  // unreachable.
  const doReach = useCallback(
    async (providerName: string, unitId: string) => {
      const store = useMvpStore.getState();
      const unit = store.units.find((u) => u.id === unitId);
      if (!unit) return;
      const policy = disclosureForIdentity(unit.identityId);
      const sharedByName =
        policy.find((d) => d.key === 'name' && d.tier === 'open' && !!d.value?.trim())?.value?.trim() ||
        store.name;

      // 1) The actual outward message ONE sends — addressed to the provider.
      const body = he
        ? `שלום ${providerName},\n${sharedByName ? `מדבר ${sharedByName}` : 'פונה אליך'} דרך ONE בנוגע ל${unit.title}.\nאשמח לתאם — אשתף רק את מה שאישרתי. תודה.`
        : `Hi ${providerName},\n${sharedByName ? `${sharedByName} here` : 'Reaching out'} via ONE about ${unit.title}.\nHappy to set it up — I'll share only what I approved. Thanks.`;
      store.addDraft(
        unit.id,
        {
          id: `dr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
          channel: 'whatsapp',
          to: providerName,
          body,
          status: 'draft',
          createdAt: new Date().toISOString(),
        },
        lang,
      );

      // 2) Record the provider on the process + flip it to shared.
      const ts = new Date().toISOString();
      const hasPerson = (unit.people ?? []).some((p) => p.name.toLowerCase() === providerName.toLowerCase());
      store.updateUnit(unit.id, {
        people: hasPerson
          ? unit.people
          : [
              ...(unit.people ?? []),
              { id: `p_${Date.now()}`, name: providerName, role: he ? 'ספק' : 'Provider', connectionType: 'partner' as const },
            ],
        visibility: 'shared',
        relationLabel: he ? `דרך ONE · ${providerName}` : `Via ONE · ${providerName}`,
        lastUpdatedAt: ts,
        updatedAt: ts,
      });

      // 3) Publish the disclosure-safe snapshot → a live join code.
      const row = await shareUnit(
        {
          title: unit.title,
          emoji: unit.emoji,
          status: unitStatusLine(unit, he),
          openFacts: [...openDisclosureStrings(policy, he), ...openMemoryStrings(store.memories)],
          message: body,
          sharedByName,
          providerName,
        },
        sharedByName || 'ONE',
      );

      if (row?.code) {
        store.updateUnit(unit.id, { shareCode: row.code });
        // Open the conversation: the provider sees ONE's message the moment they join.
        void postSharedMessage(row.code, sharedByName || 'ONE', 'one', body);
        store.pushUnitNotification({
          unitId: unit.id,
          text: he ? `פניתי ל${providerName} · קוד: ${row.code}` : `Reached ${providerName} · code: ${row.code}`,
          emoji: '🔗',
          kind: 'event',
        });
        Alert.alert(
          he ? 'ONE יצר קשר' : 'ONE reached out',
          he
            ? `פתחתי שיחה עם ${providerName} על "${unit.title}".\nקוד הצטרפות: ${row.code}\nהוא רואה רק מה שאישרת.`
            : `I opened a thread with ${providerName} about "${unit.title}".\nJoin code: ${row.code}\nThey see only what you allowed.`,
        );
      } else {
        // Backend unreachable — the draft still exists locally, nothing crossed.
        store.pushUnitNotification({
          unitId: unit.id,
          text: he ? `ניסחתי פנייה ל${providerName}` : `Drafted a message to ${providerName}`,
          emoji: '✍️',
          kind: 'update',
        });
        Alert.alert(
          he ? 'הכנתי פנייה' : 'Draft ready',
          he
            ? `ניסחתי את ההודעה ל${providerName} בתהליך "${unit.title}". פתח אותה כדי לשלוח.`
            : `I drafted the message to ${providerName} in "${unit.title}". Open it to send.`,
        );
      }
    },
    [he, lang],
  );

  const reachProvider = useCallback(
    (providerName: string, unitId: string) => {
      haptic.tap();
      const unit = useMvpStore.getState().units.find((u) => u.id === unitId);
      const title = unit?.title ?? '';
      Alert.alert(
        he ? 'לפנות דרך ONE' : 'Reach via ONE',
        he
          ? `ONE ינסח הודעה ל${providerName} על "${title}", יפתח קישור משותף — ויחשוף רק מה שאישרת.`
          : `ONE will draft a message to ${providerName} about "${title}" and open a shared link — revealing only what you allowed.`,
        [
          { text: he ? 'ביטול' : 'Cancel', style: 'cancel' },
          { text: he ? 'פנה' : 'Reach', onPress: () => void doReach(providerName, unitId) },
        ],
      );
    },
    [he, doReach],
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
      // Global gets a WIDER desktop card than the other sheets.
      desktopMaxWidth={760}
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

        {/* YOUR desires, as anonymous aggregate posts — your private processes
            joining the collective. The bridge between you and the network. */}
        {myDesires.length > 0 && (
          <View style={styles.mineSection}>
            <Text style={[styles.mineTitle, { color: colors.text }, rtl]}>
              {he ? 'הרצונות שלך ב-Global' : 'Your desires in Global'}
            </Text>
            <Text style={[styles.mineSub, { color: colors.textSecondary }, rtl]}>
              {he ? 'מצטרפים לכולם — באופן אנונימי.' : 'Joined to everyone — anonymously.'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mineRow}
              keyboardShouldPersistTaps="handled"
            >
              {myDesires.map((d) => {
                const open = selectedDesireId === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => { haptic.select(); setSelectedDesireId(open ? null : d.id); }}
                    style={({ pressed }) => [
                      styles.mineCard,
                      { backgroundColor: colors.surface, borderColor: open ? colors.text : colors.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={d.title}
                  >
                    <View style={[styles.mineTag, rtlRow(lang)]}>
                      <Text style={styles.mineLock}>🔒</Text>
                      <Text style={[styles.mineTagText, { color: colors.textSecondary }]}>
                        {he ? 'אנונימי' : 'anonymous'}
                      </Text>
                    </View>
                    <Text style={styles.mineEmoji}>{d.emoji}</Text>
                    <Text style={[styles.mineCardTitle, { color: colors.text }, rtl]} numberOfLines={2}>
                      {d.title}
                    </Text>
                    <Text style={[styles.mineAgg, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                      {d.aggregate}
                    </Text>
                    <Text style={[styles.mineHelp, { color: colors.text }, rtl]} numberOfLines={1}>
                      {d.helpers.length > 0
                        ? (he ? `👥 ${d.helpers.length} יכולים לעזור` : `👥 ${d.helpers.length} can help`)
                        : (he ? '✨ ONE ימצא' : '✨ ONE will find')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* WHO CAN HELP — the supply side for the selected desire. Reaching a
                provider goes THROUGH ONE, disclosure-safe. */}
            {selectedDesire && (
              <View style={[styles.helpPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.helpPanelTitle, { color: colors.text }, rtl]} numberOfLines={1}>
                  {he ? `מי יכול לעזור · ${selectedDesire.title}` : `Who can help · ${selectedDesire.title}`}
                </Text>
                {selectedDesire.helpers.length === 0 ? (
                  <Pressable
                    onPress={() => askOne(he ? `מצא מי שיכול לעזור עם ${selectedDesire.title}` : `Find who can help with ${selectedDesire.title}`)}
                    style={styles.helpFind}
                  >
                    <Text style={[styles.helpFindText, { color: colors.text }, rtl]}>
                      {he ? 'שאל את ONE למצוא עבורך ›' : 'Ask ONE to find for you ›'}
                    </Text>
                  </Pressable>
                ) : (
                  selectedDesire.helpers.slice(0, 5).map((o) => (
                    <View key={o.id} style={[styles.helpRow, rtlRow(lang)]}>
                      <Text style={styles.helpEmoji}>{o.emoji}</Text>
                      <View style={styles.flex1}>
                        <Text style={[styles.helpName, { color: colors.text }, rtl]} numberOfLines={1}>{o.name}</Text>
                        <Text style={[styles.helpCat, { color: colors.textSecondary }, rtl]} numberOfLines={1}>{o.category}</Text>
                      </View>
                      <Pressable
                        onPress={() => reachProvider(o.name, selectedDesire.id)}
                        style={[styles.helpReach, { backgroundColor: colors.text }]}
                      >
                        <Text style={[styles.helpReachText, { color: colors.background }]}>
                          {he ? 'פנה דרך ONE' : 'Reach via ONE'}
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

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
  mineSection: { marginTop: 6, marginBottom: 14 },
  mineTitle: { fontSize: 15, fontWeight: '800' },
  mineSub: { fontSize: 12.5, marginTop: 2, marginBottom: 10 },
  mineRow: { gap: 10, paddingVertical: 2, paddingHorizontal: 2 },
  mineCard: { width: 158, borderWidth: 1, borderRadius: 16, padding: 13, gap: 5 },
  mineTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mineLock: { fontSize: 10 },
  mineTagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  mineEmoji: { fontSize: 22, marginTop: 2 },
  mineCardTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 19 },
  mineAgg: { fontSize: 12, lineHeight: 16 },
  mineHelp: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  helpPanel: { marginTop: 10, borderWidth: 1, borderRadius: 16, padding: 13, gap: 10 },
  helpPanelTitle: { fontSize: 13.5, fontWeight: '800' },
  helpFind: { paddingVertical: 4 },
  helpFindText: { fontSize: 13.5, fontWeight: '700' },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpEmoji: { fontSize: 20 },
  helpName: { fontSize: 14, fontWeight: '700' },
  helpCat: { fontSize: 11.5, marginTop: 1 },
  helpReach: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  helpReachText: { fontSize: 12.5, fontWeight: '700' },

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
