/**
 * OneProfileSheet — agent profile, redesigned 6/24 to match user mockup.
 *
 * Sticky top: kebab (⋮) → settings, "Ariel ⌄" identity row → switch, X → close.
 * Body: big breathing Orb, "ONE" title, broadcast line, 3-column stats row
 *       (CONNECTIONS / TRUST POINTS / POSSESSES), chevron-down hint.
 * Below: Appearance + Language segmented controls, Identities list,
 *        Settings link card.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
  TextInput,
  Alert,
  type KeyboardEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Orb } from '../../components/mvp/Orb';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { CloseIcon, MenuIcon, ArrowDownIcon } from '../../components/mvp/icons';
import { useThemeStore } from '../../stores/themeStore';
import { useT, useLanguage } from '../../i18n/useT';
import { useMvpStore, useActiveIdentity } from '../../stores/mvpStore';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { SubscriptionPanel } from './SubscriptionPanel';
import { ActionMenu, type ActionMenuItem } from '../../components/mvp/ActionMenu';
import { CONNECTORS } from '../../data/mvp/connectors';
import { entitlementsFor } from '../../utils/entitlements';
import { buildAgenda, agendaHeadline, type AgendaItem } from '../../utils/agenda';
import { SNOOZE_OPTIONS, snoozeOptionLabel, snoozeTarget } from '../../utils/snooze';
import { buildRecentActivity, activityKindMeta, relativeWhen, type ActivityEntry } from '../../utils/activity';
import { rtlText, rtlRow } from '../../utils/rtl';
import { unitStatusLine } from '../../utils/unitStatusLine';
import { haptic } from '../../utils/haptics';

interface OneProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenIdentitySwitch: () => void;
  onOpenSettings: () => void;
  /**
   * Optional — open a specific process from the All-processes list. When
   * provided, the list is rendered (with search). Without it, the list
   * is hidden, keeping the older surface intact.
   */
  onOpenUnit?: (unitId: string) => void;
  /** Open the create-identity flow — fired by the "+ Add profile" chip in the
   *  floating profile switcher. */
  onAddIdentity?: () => void;
  /** Open the create-business flow (a business gets its own ONE). */
  onCreateBusiness?: () => void;
  /** Shared value the sheet writes its LIVE animated index into, so Home can
   *  track the slide and bring its orb back in sync with the close drag. */
  animatedIndex?: SharedValue<number>;
}

// Open as a HALF card by default (matching UnitProfileSheet's pattern).
// A touch higher than a strict half (72%) so the hero + stats + Today land
// comfortably without an immediate drag. User can pull up to 92% for the rest.
const SNAP_POINTS = ['72%', '92%'];

export function OneProfileSheet({
  visible,
  onClose,
  onOpenSettings,
  onOpenUnit,
  onAddIdentity,
  onCreateBusiness,
  animatedIndex,
}: OneProfileSheetProps) {
  const { colors } = useThemeStore();
  const t = useT();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();
  const identity = useActiveIdentity();
  const identities = useMvpStore((s) => s.identities);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const setActiveIdentity = useMvpStore((s) => s.setActiveIdentity);
  const units = useMvpStore((s) => s.units);
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const snoozeReminder = useMvpStore((s) => s.snoozeReminder);
  const plan = useMvpStore((s) => s.plan);
  const connections = useMvpStore((s) => s.connections);
  const setConnection = useMvpStore((s) => s.setConnection);
  // What the current plan unlocks (limits + capabilities).
  const ent = entitlementsFor(plan);
  // The plan badge shown INLINE next to "ONE" — its own colour per tier.
  const planMeta =
    plan === 'max'
      ? { word: 'MAX', color: '#8B5CF6' }
      : plan === 'pro'
        ? { word: 'PRO', color: '#3B82F6' }
        : { word: 'FREE', color: colors.textSecondary };
  const connectedCount = useMemo(
    () => Object.values(connections).filter(Boolean).length,
    [connections],
  );
  // Subscription panel — an INLINE slide-up over this sheet (not a separate
  // Modal), so it opens instantly and doesn't dismiss the profile first.
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  // Set when the panel is opened from a gated action, so it explains why.
  const [subscriptionReason, setSubscriptionReason] = useState<string | undefined>(undefined);
  const openUpgrade = useCallback((reason?: string) => {
    setSubscriptionReason(reason);
    setSubscriptionOpen(true);
  }, []);

  // ── ⋮ action menu (context-aware by the active profile) ─────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const comingSoon = useCallback(() => {
    Alert.alert(he ? 'בקרוב' : 'Coming soon', he ? 'עוד רגע — היכולת הזו בדרך.' : "This one's on the way.");
  }, [he]);
  const menuItems: ActionMenuItem[] =
    identity?.type === 'business'
      ? [
          { icon: '🏪', label: he ? 'צור/ערוך עסק ONE' : 'Create / edit business ONE', onPress: onCreateBusiness ?? comingSoon },
          { icon: '🌐', label: he ? 'תצוגה ציבורית' : 'Public view', onPress: comingSoon },
          { icon: '🔗', label: he ? 'חיבורים ומקורות' : 'Connections & sources', onPress: comingSoon },
          { icon: '⭐', label: he ? 'תוכנית ומנוי' : 'Plan & subscription', onPress: () => openUpgrade(undefined) },
          { icon: '⚙️', label: he ? 'הגדרות ONE' : 'ONE settings', onPress: onOpenSettings },
        ]
      : [
          { icon: '✏️', label: he ? 'ערוך פרופיל' : 'Edit profile', onPress: comingSoon },
          { icon: '🏪', label: he ? 'צור עסק ONE' : 'Create a business ONE', onPress: onCreateBusiness ?? comingSoon },
          { icon: '🎨', label: he ? 'התאם את ONE' : 'Customize ONE', onPress: onOpenSettings },
          { icon: '🔗', label: he ? 'חיבורים ומקורות' : 'Connections & sources', onPress: comingSoon },
          { icon: '⭐', label: he ? 'תוכנית ומנוי' : 'Plan & subscription', onPress: () => openUpgrade(undefined) },
          { icon: '⚙️', label: he ? 'הגדרות ONE' : 'ONE settings', onPress: onOpenSettings },
        ];

  // Connect / disconnect a source. Disconnecting is always allowed; connecting
  // is gated by the plan's `maxConnections` (free = a taste, Pro = all).
  const toggleConnection = useCallback(
    (id: string) => {
      if (connections[id]) {
        haptic.select();
        setConnection(id, false);
        return;
      }
      if (connectedCount >= ent.maxConnections) {
        openUpgrade(
          he
            ? 'במסלול החינמי אפשר לחבר מקור אחד. שדרג כדי לחבר את כל המקורות שלך.'
            : 'The free plan connects one source. Upgrade to connect them all.',
        );
        return;
      }
      haptic.success();
      setConnection(id, true);
    },
    [connections, connectedCount, ent.maxConnections, he, openUpgrade, setConnection],
  );

  // Add a profile — gated by `maxProfiles` (free = 2). Over the limit nudges
  // an upgrade instead of opening the create flow.
  const handleAddProfile = useCallback(() => {
    haptic.select();
    if (identities.length >= ent.maxProfiles) {
      openUpgrade(
        he
          ? `במסלול החינמי יש עד ${ent.maxProfiles} פרופילים. שדרג לפרופילים ללא הגבלה.`
          : `The free plan allows ${ent.maxProfiles} profiles. Upgrade for unlimited.`,
      );
      return;
    }
    onAddIdentity?.();
  }, [identities.length, ent.maxProfiles, he, openUpgrade, onAddIdentity]);

  // Ticks every minute so the "Today" agenda re-evaluates due/overdue state
  // while the sheet is open. Only runs while visible.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, [visible]);

  // "Today" — ONE assembles what needs the user across the active identity's
  // processes (due reminders, deadlined steps, hot + stuck processes).
  const agenda = useMemo<AgendaItem[]>(() => {
    const mine = units.filter((u) => u.identityId === activeIdentityId);
    return buildAgenda(mine, nowTick, lang);
  }, [units, activeIdentityId, nowTick, lang]);

  // "Recent activity" — a single newest-first feed of everything ONE has done
  // across this identity's processes (created, captured, decided, updated,
  // completed). Opening ONE's profile becomes "here's what I've been doing for
  // you", which is the whole promise made tangible.
  const recentActivity = useMemo<ActivityEntry[]>(() => {
    const mine = units.filter((u) => u.identityId === activeIdentityId);
    return buildRecentActivity(mine, nowTick, lang, 7);
  }, [units, activeIdentityId, nowTick, lang]);

  // The profile title is simply "ONE" — the account/identity is chosen via the
  // floating profile switcher at the bottom, not baked into the title.
  const oneName = 'ONE';

  // Compact sticky title — once the big "<account>'s ONE" scrolls up under the
  // header, a small copy fades into the bar centre (between ⋮ and X). Plain-JS
  // onScroll (gorhom wraps it in runOnJS, so it's safe on the scroll bridge).
  const COMPACT_TITLE_THRESHOLD = 120;
  const compactTitleSV = useSharedValue(0);
  const compactShownRef = React.useRef(false);
  const handleProfileScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const show = y > COMPACT_TITLE_THRESHOLD;
      if (show !== compactShownRef.current) {
        compactShownRef.current = show;
        compactTitleSV.value = withTiming(show ? 1 : 0, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [compactTitleSV],
  );
  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: compactTitleSV.value,
    transform: [{ translateY: (1 - compactTitleSV.value) * 6 }],
  }));

  const completeAgendaItem = useCallback(
    (item: AgendaItem) => {
      const u = units.find((x) => x.id === item.unitId);
      if (!u) return;
      haptic.success();
      const ts = new Date().toISOString();
      if (item.reminderId) {
        updateUnit(u.id, {
          reminders: (u.reminders ?? []).map((r) =>
            r.id === item.reminderId ? { ...r, done: true } : r,
          ),
          updatedAt: ts,
        });
      } else if (item.stepId) {
        updateUnit(u.id, {
          nextSteps: (u.nextSteps ?? []).map((s) =>
            s.id === item.stepId ? { ...s, done: true } : s,
          ),
          updatedAt: ts,
        });
      }
    },
    [units, updateUnit],
  );

  // Snooze a due reminder straight from the agenda — "not now, bring it back
  // later". Same three quick choices as the process sheet.
  const promptSnoozeAgenda = useCallback(
    (item: AgendaItem) => {
      const u = units.find((x) => x.id === item.unitId);
      const rem = u?.reminders?.find((r) => r.id === item.reminderId);
      if (!u || !rem) return;
      Alert.alert(
        he ? 'דחיית תזכורת' : 'Snooze reminder',
        rem.text,
        [
          ...SNOOZE_OPTIONS.map((o) => ({
            text: snoozeOptionLabel(o, lang),
            onPress: () => {
              const { dueAt, dueLabel } = snoozeTarget(o, Date.now(), lang);
              snoozeReminder(u.id, rem.id, dueAt, dueLabel, lang);
            },
          })),
          { text: he ? 'ביטול' : 'Cancel', style: 'cancel' as const },
        ],
      );
    },
    [units, he, lang, snoozeReminder],
  );

  const activeUnitsCount = units.filter((u) => u.identityId === activeIdentityId).length;
  // Live aggregates of what ONE is actually holding for this identity — a
  // truthful "here's what I'm tracking" instead of vanity numbers.
  const liveStats = useMemo(() => {
    const mine = units.filter((u) => u.identityId === activeIdentityId);
    let openSteps = 0;
    let openReminders = 0;
    for (const u of mine) {
      openSteps += (u.nextSteps ?? []).filter((s) => !s.done).length;
      openReminders += (u.reminders ?? []).filter((r) => !r.done).length;
    }
    return { processes: mine.length, openSteps, openReminders };
  }, [units, activeIdentityId]);

  // Role label for an identity type (personal / business / family).
  const roleLabelFor = (type?: string) =>
    type === 'business'
      ? t('identity_role_business')
      : type === 'family'
        ? t('identity_role_family')
        : t('identity_role_personal');

  // ── Control-center content ──────────────────────────────────────────────
  // Channels ONE follows to feed the broadcast, Sources it grounds itself on,
  // Abilities it can perform, what it remembers, and what's verified. The DATA
  // here is illustrative (mock) — the information architecture is the point;
  // real feeds/verification land later. Connections + Profiles + metrics below
  // are all live.
  const CHANNELS = he
    ? ['פוליטיקה בישראל', 'טכנולוגיה', 'AI', 'שוק ההון', 'בריאות']
    : ['Israeli politics', 'Technology', 'AI', 'Markets', 'Health'];
  const SOURCES = he
    ? [
        { emoji: '🌐', name: 'אתר רשמי', desc: 'מקור רשמי לפרופיל' },
        { emoji: '📄', name: 'מסמכים', desc: 'חוזים, אישורים, מדיניות' },
        { emoji: '❓', name: 'שאלות נפוצות', desc: 'תשובות מאומתות' },
      ]
    : [
        { emoji: '🌐', name: 'Official site', desc: 'Verified profile source' },
        { emoji: '📄', name: 'Documents', desc: 'Contracts, approvals, policy' },
        { emoji: '❓', name: 'FAQ', desc: 'Verified answers' },
      ];
  // Some abilities unlock with the plan (advanced model / proactive).
  const ABILITIES = he
    ? [
        { name: 'לפתוח תהליך', locked: false },
        { name: 'לסכם את היום', locked: false },
        { name: 'לקבוע תזכורות', locked: false },
        { name: 'לקרוא אימיילים', locked: !ent.advancedModel },
        { name: 'לנתח קבצים', locked: !ent.advancedModel },
        { name: 'לפעול אוטומטית בשמך', locked: !ent.proactive },
      ]
    : [
        { name: 'Open a process', locked: false },
        { name: 'Summarise your day', locked: false },
        { name: 'Set reminders', locked: false },
        { name: 'Read emails', locked: !ent.advancedModel },
        { name: 'Analyse files', locked: !ent.advancedModel },
        { name: 'Act on your behalf', locked: !ent.proactive },
      ];
  const MEMORY_CATS = he
    ? ['העדפות', 'החלטות', 'נתונים חשובים', 'אנשים ותהליכים']
    : ['Preferences', 'Decisions', 'Key facts', 'People & processes'];
  const VERIFICATION = he
    ? [
        { label: 'אימייל', ok: true },
        { label: 'טלפון', ok: true },
        { label: 'גיל', ok: false },
        { label: 'עסק', ok: false },
      ]
    : [
        { label: 'Email', ok: true },
        { label: 'Phone', ok: true },
        { label: 'Age', ok: false },
        { label: 'Business', ok: false },
      ];
  // Status carousel — the horizontal metrics strip under the header. A mix of
  // live aggregates and structural counts, so opening ONE reads as "here's what
  // I'm holding for you", not vanity stats.
  const metrics: { label: string; value: string; color?: string }[] = [
    { label: he ? 'תהליכים' : 'Processes', value: `${liveStats.processes}` },
    { label: he ? 'צעדים' : 'Open steps', value: `${liveStats.openSteps}` },
    { label: he ? 'תזכורות' : 'Reminders', value: `${liveStats.openReminders}` },
    { label: he ? 'חיבורים' : 'Connections', value: `${connectedCount}` },
    { label: he ? 'ערוצים' : 'Channels', value: `${CHANNELS.length}` },
    { label: he ? 'מקורות' : 'Sources', value: `${SOURCES.length}` },
    { label: he ? 'זיכרון' : 'Memory', value: he ? 'פעיל' : 'Active' },
    { label: he ? 'תוכנית' : 'Plan', value: planMeta.word, color: planMeta.color },
  ];

  // ── ONE's own broadcast (the line under the name) ───────────────────────
  // NOT the Home "what's waiting" feed — this is the PROFILE's own context:
  // who ONE is for this identity, what it's holding, why it's here. It rotates
  // with a fade so ONE feels like it's quietly speaking about itself.
  const oneLines = useMemo(() => {
    const name = identity?.name?.trim();
    return he
      ? [
          name ? `אני ה‑ONE של ${name}.` : 'אני ה‑ONE שלך.',
          `מחזיק ${liveStats.processes} תהליכים ו‑${liveStats.openSteps} צעדים פתוחים בשבילך.`,
          'כאן כדי להפוך כוונות למציאות.',
          'אני זוכר כל מה שהפקדת בידיי.',
        ]
      : [
          name ? `I'm ${name}'s ONE.` : "I'm your ONE.",
          `Holding ${liveStats.processes} processes and ${liveStats.openSteps} open steps for you.`,
          'Here to turn intentions into reality.',
          "I remember everything you've trusted me with.",
        ];
  }, [identity?.name, liveStats.processes, liveStats.openSteps, he]);
  const [lineIdx, setLineIdx] = useState(0);
  const lineOpacity = useSharedValue(1);
  const broadcastLineStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value }));
  useEffect(() => {
    setLineIdx(0);
  }, [activeIdentityId]);
  useEffect(() => {
    if (!visible || oneLines.length <= 1) return;
    const id = setInterval(() => setLineIdx((i) => (i + 1) % oneLines.length), 4500);
    return () => clearInterval(id);
  }, [visible, oneLines.length]);
  useEffect(() => {
    lineOpacity.value = 0;
    lineOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [lineIdx, lineOpacity]);

  // Identity switching lives ONLY on the tappable name row below (→ opens the
  // identity-switch sheet). The old sideways "flip" swipe over the hero was
  // removed: a horizontal Pan wrapping the top of the scroll view competed
  // with the vertical scroll (the user couldn't reliably scroll up) and just
  // duplicated the tap path. One affordance, no gesture conflict.

  // All-processes search query. Reset when the sheet closes so the next
  // open starts fresh — the user shouldn't have to clear it themselves.
  const [search, setSearch] = useState('');
  React.useEffect(() => {
    if (!visible) {
      setSearch('');
      compactShownRef.current = false;
      compactTitleSV.value = 0;
    }
  }, [visible, compactTitleSV]);

  // Filter is intentionally simple — case-insensitive substring across
  // title, primary broadcast line, emoji, and tagIds. With ~50 processes
  // it's < 1ms; if it ever grows we can swap to the token-overlap utility
  // already used for memory retrieval.
  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Active processes only — completed ones live in their own "Completed"
    // shelf below, so the working list stays focused on what's in motion.
    const sorted = [...units].filter((u) => u.status !== 'completed').sort((a, b) => {
      // Newest update first so the most active processes lead the list.
      const ta = new Date(a.lastUpdatedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const tb = new Date(b.lastUpdatedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return tb - ta;
    });
    if (!q) return sorted;
    return sorted.filter((u) => {
      const hay = `${u.title} ${u.emoji} ${u.latestBroadcastText?.[0] ?? ''} ${(u.tagIds ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [units, search]);

  // Completed processes — the "reality reached" shelf. ONE keeps a visible,
  // proud record of everything you carried from intent to done; most-recently
  // finished first. This is the payoff half of "All processes".
  const completedUnits = useMemo(
    () =>
      units
        .filter((u) => u.status === 'completed')
        .sort((a, b) => {
          const ta = new Date(a.completedAt ?? a.updatedAt ?? a.createdAt).getTime();
          const tb = new Date(b.completedAt ?? b.updatedAt ?? b.createdAt).getTime();
          return tb - ta;
        }),
    [units],
  );

  // Floating-dock keyboard lift, same pattern as UnitProfileSheet. The dock
  // (profile switcher) is `position: absolute, bottom: 0`; when the keyboard
  // opens (e.g. the All-processes search field) it would be hidden, so we
  // translate the dock up by the keyboard height to keep it reachable.
  const dockLift = useSharedValue(0);
  React.useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      dockLift.value = withTiming(-h, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
    };
    const onHide = () => {
      dockLift.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    };
    const a = Keyboard.addListener(showEv, onShow);
    const b = Keyboard.addListener(hideEv, onHide);
    return () => {
      a.remove();
      b.remove();
    };
  }, [dockLift]);
  // The sheet's LIVE animated index — the caller's SharedValue when given (Home
  // uses it to track the slide), else a local fallback. We read it to fade the
  // floating switcher out as the sheet slides closed (index → -1) so it doesn't
  // hang pinned at the screen bottom during the close.
  const fallbackIndex = useSharedValue(0);
  const sheetIndex = animatedIndex ?? fallbackIndex;
  const dockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: dockLift.value }],
  }));

  // Resting breath on the Orb.
  const breathScale = useSharedValue(1);
  // Slow, autonomous gaze drift — the face glances down then back to centre on
  // a long loop so it reads as alive and present (on top of the random blink
  // the Orb already does internally).
  const eyeLookY = useSharedValue(0);
  // Entrance: the face POPS into the card each time the sheet opens — it
  // doesn't grow from nothing but from ~0.8, springing slightly past full
  // size then settling, so it reads like the ONE "jumped into" the profile
  // (a clean hand-off from the home orb collapsing behind the sheet).
  const enterScale = useSharedValue(0.8);
  const enterOpacity = useSharedValue(0);
  React.useEffect(() => {
    if (!visible) {
      breathScale.value = 1;
      eyeLookY.value = 0;
      enterScale.value = 0.8;
      enterOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      return;
    }
    enterScale.value = 0.8;
    enterScale.value = withSequence(
      withTiming(1.06, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 240, easing: Easing.inOut(Easing.quad) }),
    );
    enterOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.00, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    eyeLookY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(-0.35, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [visible, breathScale, enterScale, enterOpacity, eyeLookY]);
  const breathStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: breathScale.value * enterScale.value }],
  }));

  // Floating profile switcher — rendered into the sheet's OVERLAY slot (a
  // sibling pinned to the SCREEN bottom, NOT inside gorhom's max-snap-sized
  // content). That's what keeps it visible at BOTH snaps: anchored inside the
  // content it hangs off the bottom of the screen at the half card. A
  // horizontal strip of the user's profiles + an "add profile" chip; switching
  // who ONE works for is one tap away. Lifts with the keyboard + fades on close.
  const switcherDockNode = (
    <Animated.View
      style={[styles.switcherDock, { paddingBottom: Math.max(insets.bottom, 12) }, dockStyle]}
      pointerEvents="box-none"
    >
      <View style={[styles.switcherBar, { backgroundColor: colors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.switcherContent, he && styles.switcherContentRTL]}
        >
          {identities.map((id) => {
            const active = id.id === activeIdentityId;
            return (
              <Pressable
                key={id.id}
                onPress={() => {
                  haptic.select();
                  if (id.id === activeIdentityId) return;
                  setActiveIdentity(id.id);
                  // Jump home ONLY from the HALF card (index ~0): you feel the
                  // change instead of staying in the profile card. When the card
                  // is dragged up to FULL (index ~1), switching stays in place —
                  // the profile just re-renders under the new identity.
                  if (sheetIndex.value < 0.5) {
                    onClose();
                  }
                }}
                style={[
                  styles.profilePill,
                  he && styles.rowReverse,
                  {
                    backgroundColor: active ? colors.text : colors.background,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={id.name}
              >
                <View
                  style={[
                    styles.profilePillAvatar,
                    { backgroundColor: active ? colors.background : colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.profilePillInitial,
                      { color: active ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {id.initials ?? id.name.slice(0, 1)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.profilePillName,
                    { color: active ? colors.background : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {id.name}
                </Text>
              </Pressable>
            );
          })}
          {/* Add profile → create-identity flow (gated by the plan). */}
          <Pressable
            onPress={handleAddProfile}
            style={[styles.addPill, he && styles.rowReverse, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={he ? 'הוסף פרופיל' : 'Add profile'}
          >
            <Text style={[styles.addPillPlus, { color: colors.textSecondary }]}>+</Text>
            <Text style={[styles.addPillText, { color: colors.textSecondary }]} numberOfLines={1}>
              {he ? 'הוסף פרופיל' : 'Add profile'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Animated.View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      // Open at the HALF card (65%) — like UnitProfileSheet. The home orb
      // collapses behind it and this sheet grows its own face in, so the
      // hand-off reads even though we're not full-height. Drag up for more.
      initialSnap={0}
      // Content-pan ON + bypass the default BottomSheetView wrapper so
      // BottomSheetScrollView sits as a DIRECT child of gorhom — this
      // is the wiring gorhom's scroll-pan bridge expects. Matches
      // UnitProfileSheet. Without bypass, the wrapper intercepts the
      // gesture at the high snap and snaps the scroll back to the top.
      enableContentPan={true}
      bypassDefaultView={true}
      animatedIndex={sheetIndex}
      // The profile switcher + the subscription panel ride the SCREEN-pinned
      // overlay slot so they stay put at every snap (not anchored inside
      // gorhom's content). The panel slides up OVER the profile — no Modal swap.
      overlay={
        <>
          {/* Screen-pinned bottom fade — sits at the sheet's bottom at EVERY
              snap (incl. the half card), BEHIND the profile-switcher dock
              (zIndex 10). Rendered in the overlay (not content) so it doesn't
              hang off-screen at the low snap. */}
          <EdgeBars top={false} bottomHeight={130} style={{ zIndex: 5 }} />
          {switcherDockNode}
          <SubscriptionPanel
            visible={subscriptionOpen}
            reason={subscriptionReason}
            onClose={() => setSubscriptionOpen(false)}
          />
        </>
      }
      sheetStyle={styles.sheet}
    >
      {/* Soft top gradient behind the header — content scrolls UNDER it, same
          treatment as the process sheet. The header (zIndex 20) stays crisp. */}
      <EdgeBars bottom={false} topHeight={112} topLinear />
      {/* Sticky top header — kebab / Ariel / X. Renders OUTSIDE the scroll
          view so it stays visible when the user scrolls for more. */}
      <View style={styles.topHeader} pointerEvents="box-none">
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          style={[styles.pillBtn, { backgroundColor: colors.surface }]}
          accessibilityLabel={he ? 'עוד אפשרויות' : 'More options'}
        >
          <MenuIcon size={22} color={colors.text} />
        </Pressable>
        {/* Compact sticky title — empty at the top (clean header), fades in
            "ONE <PLAN>" (plan word in its tier colour) once the big title
            scrolls off. Mirrors the hero title. */}
        <Animated.View
          style={[styles.headerTitleSlot, compactTitleStyle]}
          pointerEvents="none"
        >
          <Text
            style={[styles.headerTitleText, { color: colors.text }]}
            numberOfLines={1}
          >
            {oneName}
            {identity?.name ? (
              <Text style={{ color: colors.textSecondary }}>{`  ·  ${identity.name}`}</Text>
            ) : null}
          </Text>
        </Animated.View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={[styles.pillBtn, { backgroundColor: colors.surface }]}
          accessibilityLabel={t('common_close')}
        >
          <CloseIcon size={22} color={colors.text} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        style={styles.flex1}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Plain-JS scroll callback (gorhom routes it through runOnJS) — drives
        // the compact sticky title once the big name scrolls off the top.
        onScroll={handleProfileScroll}
      >
        {/* Hero: big breathing Orb + "<account>'s ONE" + ONE's live broadcast.
            The name row is the identity switcher (tap → switch sheet). No
            sideways swipe here — it fought the scroll; tap is the one path. */}
        <View style={styles.heroBlock}>
          <Animated.View style={breathStyle}>
            <Orb size={120} eyeLookY={eyeLookY} noShadow />
          </Animated.View>
          {/* Title is just "ONE" — the agent. Below it: which profile ONE is
              acting through (name · role), and the plan as a SMALL badge, not
              the title. Tap the row → plans panel (upgrade / manage). */}
          <Text style={[styles.heroTitle, { color: colors.text }]}>{oneName}</Text>
          <Pressable
            onPress={() => openUpgrade(undefined)}
            hitSlop={8}
            style={[styles.identityLineRow, rtlRow(lang)]}
            accessibilityRole="button"
            accessibilityLabel={`${identity?.name ?? ''} · ${roleLabelFor(identity?.type)} — ${planMeta.word}`}
          >
            <Text style={[styles.identityLine, { color: colors.textSecondary }]} numberOfLines={1}>
              {[identity?.name, roleLabelFor(identity?.type)].filter(Boolean).join(' · ')}
            </Text>
            <View style={[styles.planBadge, { borderColor: planMeta.color }]}>
              <Text style={[styles.planBadgeText, { color: planMeta.color }]}>{planMeta.word}</Text>
            </View>
          </Pressable>
          <Animated.Text
            style={[styles.heroSubline, { color: colors.textSecondary }, broadcastLineStyle]}
            numberOfLines={2}
          >
            {oneLines[lineIdx % oneLines.length]}
          </Animated.Text>
        </View>

        {/* Status carousel — a horizontal strip of what ONE holds for this
            profile. Scrolls sideways so it can carry more than three metrics
            without crowding the hero. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.metricsScroll, { borderColor: colors.border }]}
          contentContainerStyle={[styles.metricsRow, rtlRow(lang)]}
        >
          {metrics.map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.metricCell}>
                <Text style={[styles.metricValue, { color: m.color ?? colors.text }]}>{m.value}</Text>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {m.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </ScrollView>

        {/* Today — ONE's command center. A prioritized, cross-process agenda
            of what actually needs the user now, one tap to act. This is the
            promise ("I complete your processes") made concrete. */}
        {units.some((u) => u.identityId === activeIdentityId) && (
          <Section title={he ? 'היום' : 'Today'} colors={colors}>
            <Text
              style={[styles.todayHeadline, { color: colors.text }, he && styles.todayRtl]}
            >
              {agendaHeadline(agenda.length, lang)}
            </Text>
            {agenda.length > 0 && (
              <View style={styles.todayList}>
                {agenda.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.todayRow,
                      { backgroundColor: colors.surface },
                      he && styles.todayRowRTL,
                    ]}
                  >
                    <Pressable
                      onPress={() => onOpenUnit?.(item.unitId)}
                      style={[styles.todayMain, he && styles.todayRowRTL]}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.text} — ${item.unitTitle}`}
                    >
                      <View style={[styles.todayDot, { backgroundColor: agendaColor(item) }]} />
                      <Text style={styles.todayEmoji}>{item.unitEmoji}</Text>
                      <View style={styles.flex1}>
                        <Text
                          style={[styles.todayText, { color: colors.text }, he && styles.todayRtl]}
                          numberOfLines={1}
                        >
                          {item.text}
                        </Text>
                        <Text
                          style={[styles.todaySub, { color: colors.textSecondary }, he && styles.todayRtl]}
                          numberOfLines={1}
                        >
                          {item.sub}
                        </Text>
                      </View>
                    </Pressable>
                    {/* Reminders can be pushed forward as well as ticked off. */}
                    {item.reminderId && (
                      <Pressable
                        onPress={() => promptSnoozeAgenda(item)}
                        hitSlop={8}
                        style={[styles.todayCheck, { borderColor: colors.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={he ? 'דחה תזכורת' : 'Snooze reminder'}
                      >
                        <Text style={styles.todaySnoozeGlyph}>⏰</Text>
                      </Pressable>
                    )}
                    {(item.reminderId || item.stepId) && (
                      <Pressable
                        onPress={() => completeAgendaItem(item)}
                        hitSlop={10}
                        style={[styles.todayCheck, { borderColor: colors.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={he ? 'סמן כבוצע' : 'Mark done'}
                      >
                        <Text style={[styles.todayCheckMark, { color: colors.textSecondary }]}>✓</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Section>
        )}

        {/* Recent activity now lives at the END of the profile (below). */}

        {/* Appearance + Language used to live here. Per the latest design
            pass they belong in Settings (a single source of truth for
            preferences), not on the profile surface. Removed here; still
            available via the "All settings" link below. */}

        {/* Connections — the sources ONE plugs into to actually DO things.
            This is the "digital intermediary" made tangible. Connecting is
            gated by the plan (free = one source), so the wall nudges Pro. */}
        <Section
          title={`${he ? 'חיבורים' : 'Connections'}${connectedCount ? ` · ${connectedCount}` : ''}`}
          colors={colors}
        >
          <Text style={[styles.connectionsIntro, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'ONE הופך למתווך אמיתי כשהוא מחובר למקורות שלך.'
              : 'ONE becomes a real intermediary once it’s connected to your sources.'}
          </Text>
          <View style={styles.connectorsList}>
            {CONNECTORS.map((c) => {
              const connected = !!connections[c.id];
              return (
                <View
                  key={c.id}
                  style={[styles.connectorRow, { backgroundColor: colors.surface }, rtlRow(lang)]}
                >
                  <Text style={styles.connectorEmoji}>{c.emoji}</Text>
                  <View style={styles.connectorBody}>
                    <Text
                      style={[styles.connectorName, { color: colors.text }, rtlText(lang)]}
                      numberOfLines={1}
                    >
                      {he ? c.name.he : c.name.en}
                    </Text>
                    <Text
                      style={[styles.connectorDesc, { color: colors.textSecondary }, rtlText(lang)]}
                      numberOfLines={2}
                    >
                      {he ? c.desc.he : c.desc.en}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleConnection(c.id)}
                    style={[
                      styles.connectBtn,
                      connected
                        ? { backgroundColor: colors.background, borderColor: '#10B981', borderWidth: 1 }
                        : { backgroundColor: colors.text },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${he ? c.name.he : c.name.en} — ${
                      connected ? (he ? 'מחובר' : 'connected') : (he ? 'חבר' : 'connect')
                    }`}
                  >
                    <Text
                      style={[
                        styles.connectBtnText,
                        { color: connected ? '#10B981' : colors.background },
                      ]}
                    >
                      {connected ? (he ? 'מחובר ✓' : 'Connected ✓') : (he ? 'חבר' : 'Connect')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Section>

        {/* Channels — topics ONE follows to feed your broadcast. */}
        <Section title={`${he ? 'ערוצים' : 'Channels'} · ${CHANNELS.length}`} colors={colors}>
          <Text style={[styles.connectionsIntro, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'ערוצים מזינים את הברודקאסט שלך בתובנות רלוונטיות.'
              : 'Channels feed your broadcast with relevant insight.'}
          </Text>
          <View style={[styles.tagWrap, rtlRow(lang)]}>
            {CHANNELS.map((c) => (
              <View key={c} style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.tagChipText, { color: colors.text }]}>{c}</Text>
              </View>
            ))}
            <View style={[styles.tagChip, { borderColor: colors.border, borderStyle: 'dashed' }]}>
              <Text style={[styles.tagChipText, { color: colors.textSecondary }]}>{he ? '+ הוסף' : '+ Add'}</Text>
            </View>
          </View>
        </Section>

        {/* Sources — what ONE grounds itself on to represent you accurately. */}
        <Section title={he ? 'מקורות' : 'Sources'} colors={colors}>
          <Text style={[styles.connectionsIntro, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'ככל של-ONE יש יותר מקורות, כך הוא מייצג אותך מדויק יותר.'
              : 'The more sources ONE has, the more accurately it represents you.'}
          </Text>
          <View style={styles.connectorsList}>
            {SOURCES.map((s) => (
              <View key={s.name} style={[styles.connectorRow, { backgroundColor: colors.surface }, rtlRow(lang)]}>
                <Text style={styles.connectorEmoji}>{s.emoji}</Text>
                <View style={styles.connectorBody}>
                  <Text style={[styles.connectorName, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={[styles.connectorDesc, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={2}>
                    {s.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* Abilities — what ONE can do; some unlock with the plan. */}
        <Section title={he ? 'יכולות' : 'Abilities'} colors={colors}>
          <View style={[styles.tagWrap, rtlRow(lang)]}>
            {ABILITIES.map((a) => (
              <View
                key={a.name}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: a.locked ? colors.background : colors.surface,
                    borderColor: colors.border,
                    opacity: a.locked ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.tagChipText, { color: colors.text }]}>
                  {a.locked ? '🔒 ' : ''}{a.name}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Memory — what ONE remembers (categories, not the raw data). */}
        <Section title={he ? 'זיכרון' : 'Memory'} colors={colors}>
          <View style={[styles.tagWrap, rtlRow(lang)]}>
            {MEMORY_CATS.map((m) => (
              <View key={m} style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.tagChipText, { color: colors.text }]}>{m}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.manageRow,
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
              rtlRow(lang),
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.manageRowText, { color: colors.text }]}>
              {he ? 'נהל זיכרון' : 'Manage memory'}
            </Text>
            <Text style={[styles.settingsLinkChev, { color: colors.textSecondary }]}>›</Text>
          </Pressable>
        </Section>

        {/* Verification & privacy — ONE verifies you, shares only what's needed. */}
        <Section title={he ? 'אימות ופרטיות' : 'Verification & privacy'} colors={colors}>
          <Text style={[styles.connectionsIntro, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'ONE מאמת אותך — ומשתף רק את מה שנדרש.'
              : 'ONE verifies you — and shares only what’s needed.'}
          </Text>
          <View style={[styles.tagWrap, rtlRow(lang)]}>
            {VERIFICATION.map((v) => (
              <View
                key={v.label}
                style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: v.ok ? '#10B981' : colors.border }]}
              >
                <Text style={[styles.tagChipText, { color: v.ok ? '#10B981' : colors.textSecondary }]}>
                  {v.ok ? '✓ ' : ''}{v.label}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Profiles — who ONE represents. Quick switching lives in the floating
            dock; this is the full managed list. */}
        <Section title={he ? 'פרופילים' : 'Profiles'} colors={colors}>
          <View style={styles.identitiesCard}>
            {identities.map((id) => {
              const active = id.id === activeIdentityId;
              const roleLabel =
                id.type === 'business'
                  ? t('identity_role_business')
                  : id.type === 'family'
                    ? t('identity_role_family')
                    : t('identity_role_personal');
              return (
                <Pressable
                  key={id.id}
                  onPress={() => { haptic.select(); setActiveIdentity(id.id); }}
                  style={({ pressed }) => [
                    styles.identityRowCard,
                    rtlRow(lang),
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[styles.identityAvatar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.identityInitial, { color: colors.text }]}>
                      {id.initials ?? id.name.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={styles.identityBody}>
                    <Text style={[styles.identityRowName, { color: colors.text }, rtlText(lang)]}>
                      {id.name}
                    </Text>
                    <Text style={[styles.identityRowSub, { color: colors.textSecondary }, rtlText(lang)]}>
                      {roleLabel}
                    </Text>
                  </View>
                  {active && <Text style={styles.activeMark}>●</Text>}
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* All processes — search + tap to open. Hidden when caller hasn't
            wired onOpenUnit (e.g. older entrypoints) or when there are no
            processes yet. The list spans ALL identities so the user can
            jump between business / personal / family without first
            switching identity. */}
        {!!onOpenUnit && units.length > 0 && (
          <Section title={he ? 'כל התהליכים' : 'All processes'} colors={colors}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={he ? 'חיפוש…' : 'Search…'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.processSearch,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  textAlign: he ? 'right' : 'left',
                },
              ]}
            />
            <View style={{ marginTop: 10 }}>
              {filteredUnits.length === 0 ? (
                <Text style={[styles.processEmpty, { color: colors.textSecondary }]}>
                  {he ? 'אין התאמות.' : 'Nothing matches.'}
                </Text>
              ) : (
                filteredUnits.map((u) => {
                  const identityName = identities.find((i) => i.id === u.identityId)?.name;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => onOpenUnit(u.id)}
                      style={({ pressed }) => [
                        styles.processRow,
                        rtlRow(lang),
                        {
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={u.title}
                    >
                      <Text style={styles.processEmoji}>{u.emoji}</Text>
                      <View style={styles.processBody}>
                        <Text
                          style={[styles.processTitle, { color: colors.text }, rtlText(lang)]}
                          numberOfLines={1}
                        >
                          {u.title}
                        </Text>
                        {(() => {
                          // Same LIVE status the Home cards show — so the list and
                          // the cards never disagree about what's happening.
                          const sub = [identityName, unitStatusLine(u, he)]
                            .filter(Boolean)
                            .join(' · ');
                          return sub ? (
                            <Text
                              style={[styles.processSub, { color: colors.textSecondary }, rtlText(lang)]}
                              numberOfLines={1}
                            >
                              {sub}
                            </Text>
                          ) : null;
                        })()}
                      </View>
                      {!!u.unreadUpdates && u.unreadUpdates > 0 && (
                        <View style={[styles.processBadge, { backgroundColor: colors.text }]}>
                          <Text style={[styles.processBadgeText, { color: colors.background }]}>
                            {u.unreadUpdates}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          </Section>
        )}

        {/* Completed — the "reality reached" shelf. Everything ONE carried from
            intent to done. Tap to reopen the process (and, from there, reopen
            its lifecycle if needed). */}
        {!!onOpenUnit && completedUnits.length > 0 && (
          <Section title={`${he ? 'הושלמו' : 'Completed'} · ${completedUnits.length}`} colors={colors}>
            <View style={{ marginTop: 4 }}>
              {completedUnits.slice(0, 8).map((u) => {
                const identityName = identities.find((i) => i.id === u.identityId)?.name;
                const when = relativeWhen(
                  u.completedAt ?? u.updatedAt ?? u.createdAt,
                  Date.now(),
                  lang,
                );
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => onOpenUnit(u.id)}
                    style={({ pressed }) => [
                      styles.processRow,
                      rtlRow(lang),
                      {
                        backgroundColor: colors.surface,
                        opacity: pressed ? 0.85 : 0.92,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={u.title}
                  >
                    <Text style={styles.processEmoji}>{u.emoji}</Text>
                    <View style={styles.processBody}>
                      <Text
                        style={[styles.processTitle, { color: colors.text }, rtlText(lang)]}
                        numberOfLines={1}
                      >
                        {u.title}
                      </Text>
                      <Text
                        style={[styles.processSub, { color: colors.textSecondary }, rtlText(lang)]}
                        numberOfLines={1}
                      >
                        {[identityName, when].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.completedCheck}>✓</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Recent activity — moved to the END per the design. A newest-first
            feed of what ONE has done across this identity's processes. */}
        {recentActivity.length > 0 && (
          <Section title={he ? 'פעילות אחרונה' : 'Recent activity'} colors={colors}>
            <View style={styles.activityList}>
              {recentActivity.map((a) => {
                const meta = activityKindMeta(a.kind, lang);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => onOpenUnit?.(a.unitId)}
                    disabled={!onOpenUnit}
                    style={({ pressed }) => [
                      styles.activityRow,
                      rtlRow(lang),
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityRole={onOpenUnit ? 'button' : 'text'}
                    accessibilityLabel={`${meta.label}: ${a.text} — ${a.unitTitle}`}
                  >
                    <View style={[styles.activityDot, { backgroundColor: meta.color }]} />
                    <View style={styles.flex1}>
                      <Text
                        style={[styles.activityText, { color: colors.text }, rtlText(lang)]}
                        numberOfLines={2}
                      >
                        {a.text}
                      </Text>
                      <Text
                        style={[styles.activitySub, { color: colors.textSecondary }, rtlText(lang)]}
                        numberOfLines={1}
                      >
                        {a.unitEmoji} {a.unitTitle} · {a.when}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Plan — current tier + manage/upgrade. No prices here; the plans
            panel owns pricing. */}
        <Section title={he ? 'תוכנית' : 'Plan'} colors={colors}>
          <Pressable
            onPress={() => openUpgrade(undefined)}
            style={({ pressed }) => [
              styles.manageRow,
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
              rtlRow(lang),
            ]}
            accessibilityRole="button"
            accessibilityLabel={plan === 'free' ? (he ? 'שדרג את ONE' : 'Upgrade ONE') : (he ? 'ניהול מנוי' : 'Manage plan')}
          >
            <View style={[styles.planBadge, { borderColor: planMeta.color }]}>
              <Text style={[styles.planBadgeText, { color: planMeta.color }]}>{planMeta.word}</Text>
            </View>
            <Text style={[styles.manageRowText, { color: colors.text, flex: 1 }, rtlText(lang)]}>
              {plan === 'free' ? (he ? 'שדרג את ONE' : 'Upgrade ONE') : (he ? 'ניהול מנוי' : 'Manage plan')}
            </Text>
            <Text style={[styles.settingsLinkChev, { color: colors.textSecondary }]}>›</Text>
          </Pressable>
        </Section>

        {/* Settings link */}
        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.settingsLink,
            {
              backgroundColor: colors.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.settingsLinkText, { color: colors.text }]}>
            {t('one_profile_all_settings')}
          </Text>
          <Text style={[styles.settingsLinkChev, { color: colors.textSecondary }]}>
            ›
          </Text>
        </Pressable>
      </BottomSheetScrollView>

      {/* ⋮ dropdown — floats over the whole sheet, anchored under the button. */}
      <ActionMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} top={58} />
    </BottomSheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

/** Urgency dot colour for a Today agenda item. */
function agendaColor(item: AgendaItem): string {
  if (item.overdue) return '#EF4444'; // overdue — red
  if (item.kind === 'reminder' || item.kind === 'step') return '#F59E0B'; // due soon — amber
  if (item.kind === 'hot') return '#3B82F6'; // new updates — blue
  return '#94A3B8'; // stuck — gray
}

function Stat({
  label,
  value,
  colors,
  muted,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
  muted?: boolean;
}) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          { color: muted ? colors.textSecondary : colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

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
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }, rtlText(lang)]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  options,
  selected,
  onChange,
  colors,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.segmentedOption,
              active && { backgroundColor: colors.background },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[
                styles.segmentedLabel,
                {
                  color: active ? colors.text : colors.textSecondary,
                  fontWeight: active ? '600' : '500',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: { flex: 1 },

  // Sticky top header: kebab / identity row / X. ABSOLUTE overlay (like the
  // process sheet) so content scrolls fully UNDER it and fades cleanly into the
  // top gradient — no rough clip at a header seam. Padding matches Global /
  // Settings. zIndex 20 keeps it crisp ABOVE the EdgeBars top gradient (15).
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 20,
  },
  pillBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    // backgroundColor is set per-instance from theme.surface so the button
    // works in dark mode.
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '500',
  },

  content: {
    paddingHorizontal: 22,
    // Clears the absolute header so the hero starts just below it.
    paddingTop: 70,
    // Bottom clearance for the floating profile-switcher dock — the last item
    // needs air above the bar, not behind it.
    paddingBottom: 104,
    gap: 22,
  },
  /** Floating dock that pins the profile switcher to the sheet's bottom edge,
   *  above scroll content. Translates up with the keyboard. */
  switcherDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    zIndex: 10,
  },
  switcherBar: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  switcherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  // Hebrew: profiles read right-to-left (first one hugs the right edge).
  switcherContentRTL: {
    flexDirection: 'row-reverse',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profilePillAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePillInitial: {
    fontSize: 12,
    fontWeight: '700',
  },
  profilePillName: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 130,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addPillPlus: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 19,
  },
  addPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Hero: big Orb + ONE + rotating subline + upgrade.
  heroBlock: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // The rotating "broadcast" line right under the ONE title (fades between lines).
  heroSubline: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  // The plan badge (FREE / PRO / MAX) rendered INLINE inside the ONE title,
  // in its own tier colour — SAME size/weight as "ONE" so they read as one line.
  planWord: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Identity line under the ONE title: "<name> · <role>" + a small plan badge.
  identityLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  identityLine: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Status carousel — clean columns of value-over-label separated by thin
  // vertical dividers, no top/bottom rules, no filled cards. Bleeds to edges.
  metricsScroll: {
    marginHorizontal: -22,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    alignSelf: 'center',
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  // Wrapped chip rows (channels / abilities / memory / verification).
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagWrapRTL: {
    flexDirection: 'row-reverse',
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // A tappable "manage / upgrade" row (memory, plan).
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  manageRowText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  // Centre slot in the sticky header — holds the compact title that fades in
  // as the big name scrolls away. Flexes so ⋮ / X stay pinned to the edges.
  headerTitleSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    maxWidth: 220,
  },
  broadcast: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
    // Generous breathing room above + below — the profile broadcast sits as its
    // own calm beat between the name and the stats row.
    marginTop: 16,
    marginBottom: 12,
  },

  // 3-column stats row.
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  statCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  chevronDown: {
    alignItems: 'center',
    opacity: 0.5,
  },

  section: { gap: 10 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.9,
  },
  sectionTitleRtl: { textAlign: 'right', writingDirection: 'rtl' },

  // ── Today agenda ─────────────────────────────────────────────────────
  todayHeadline: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  todayList: { gap: 8, marginTop: 2 },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  todayRowRTL: { flexDirection: 'row-reverse' },
  todayMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todayDot: { width: 8, height: 8, borderRadius: 4 },
  todayEmoji: { fontSize: 20 },
  todayText: { fontSize: 14, fontWeight: '600' },
  todaySub: { fontSize: 12, marginTop: 1 },
  todayRtl: { textAlign: 'right', writingDirection: 'rtl' },
  todayCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCheckMark: { fontSize: 14, fontWeight: '700' },
  todaySnoozeGlyph: { fontSize: 14 },

  // ── Recent activity ──────────────────────────────────────────────────
  activityList: { gap: 2 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 9,
  },
  activityRowRTL: { flexDirection: 'row-reverse' },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityText: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  activitySub: { fontSize: 12, marginTop: 2 },

  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentedLabel: { fontSize: 14 },

  // Identities list rendered as a single card with internal rows.
  identitiesCard: {
    backgroundColor: 'transparent',
  },
  identityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  identityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  identityInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  identityRowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  identityRowSub: {
    fontSize: 13,
  },
  activeMark: {
    color: '#10B981',
    fontSize: 10,
  },

  // ── Connections ──────────────────────────────────────────────────────
  connectionsIntro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  connectorsList: { gap: 8 },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  connectorEmoji: {
    fontSize: 24,
    width: 30,
    textAlign: 'center',
  },
  connectorBody: {
    flex: 1,
    gap: 2,
  },
  connectorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  connectorDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  connectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  processSearch: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 15,
  },
  processEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  processRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
  },
  processEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  processBody: {
    flex: 1,
    gap: 2,
  },
  processTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  processSub: {
    fontSize: 12,
  },
  processBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rowReverse: { flexDirection: 'row-reverse' },
  completedCheck: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22C55E',
  },

  settingsLink: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  settingsLinkText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingsLinkChev: {
    fontSize: 22,
  },
});
