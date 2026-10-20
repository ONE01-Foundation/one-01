/**
 * OneProfileSheet — the ONE profile: who ONE is, what it knows & may share on
 * your behalf, what it can do, and your network.
 *
 * Sticky: kebab (⋮) menu, a compact "ONE · <name>" title, X close; a floating
 * profile switcher dock; an inline SubscriptionPanel.
 * Body: hero (breathing Orb + identity + plan + "share my ONE"), the NETWORK
 * row (followers / following), a live metrics strip, Today agenda,
 * "What ONE knows about you" (memory + selective disclosure unified — each fact
 * carries a share tier), the TOOLBOX (ONE's live capabilities), Connections &
 * sources, how ONE looks & sounds, All processes / Completed / Recent activity,
 * Plan, Settings.
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
  Dimensions,
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
import { CloseIcon, MenuIcon, ArrowDownIcon, PlusIcon, PersonIcon, BriefcaseIcon, HouseIcon, PencilIcon, GearIcon, LinkIcon, StarIcon, SlidersIcon, GlobeIcon, VerifiedIcon, ClockIcon } from '../../components/mvp/icons';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeColors } from '../../utils/theme';
import { useT, useLanguage } from '../../i18n/useT';
import { useMvpStore, useActiveIdentity, useActiveDisclosure } from '../../stores/mvpStore';
import { disclosureLabel } from '../../data/mvp/disclosure';
import type { DisclosureTier } from '../../core/mvp/types';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { InlinePrompt, type InlinePromptConfig } from '../../components/mvp/InlinePrompt';
import { SubscriptionPanel } from './SubscriptionPanel';
import { ActionMenu, type ActionMenuItem } from '../../components/mvp/ActionMenu';
import { CONNECTORS } from '../../data/mvp/connectors';
import { TOOLS, toolEnabled } from '../../data/mvp/tools';
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
  /** Open the Timeline (the "past") — ONE's cross-process history. Lives on
   *  Home; the navigator closes this sheet then raises it. */
  onOpenTimeline?: () => void;
  /** Shared value the sheet writes its LIVE animated index into, so Home can
   *  track the slide and bring its orb back in sync with the close drag. */
  animatedIndex?: SharedValue<number>;
  /** True while a voice call is active. The profile orb then wears the live
   *  green call ring — the call "moved into" the profile with you. */
  callActive?: boolean;
}

// Open as a HALF card by default (matching UnitProfileSheet's pattern).
// A touch higher than a strict half (72%) so the hero + stats + Today land
// comfortably without an immediate drag. User can pull up to 92% for the rest.
const SNAP_POINTS = ['92%'];

export function OneProfileSheet({
  visible,
  onClose,
  onOpenSettings,
  onOpenUnit,
  onAddIdentity,
  onCreateBusiness,
  onOpenTimeline,
  animatedIndex,
  callActive = false,
}: OneProfileSheetProps) {
  const { colors } = useThemeStore();
  const t = useT();
  const lang = useLanguage();
  // Desktop = centered card; its bottom edge-fade lives INSIDE the card (via
  // BottomSheet), so the screen-pinned one is skipped there.
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;
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
  const enabledTools = useMvpStore((s) => s.enabledTools);
  const setToolEnabled = useMvpStore((s) => s.setToolEnabled);
  const memories = useMvpStore((s) => s.memories);
  const addMemory = useMvpStore((s) => s.addMemory);
  const removeMemory = useMvpStore((s) => s.removeMemory);
  const setMemoryTier = useMvpStore((s) => s.setMemoryTier);
  const name = useMvpStore((s) => s.name);
  const disclosure = useActiveDisclosure();
  const setDisclosureTier = useMvpStore((s) => s.setDisclosureTier);
  const setDisclosureValue = useMvpStore((s) => s.setDisclosureValue);
  const addDisclosureField = useMvpStore((s) => s.addDisclosureField);
  const removeDisclosureField = useMvpStore((s) => s.removeDisclosureField);
  // What the current plan unlocks (limits + capabilities).
  const ent = entitlementsFor(plan);
  // The plan badge shown INLINE next to "ONE" — its own colour per tier.
  const planMeta =
    plan === 'max'
      ? { word: 'MAX', color: '#BF9B30' }   // gold
      : plan === 'pro'
        ? { word: 'PRO', color: '#9A9CA3' } // silver
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

  // Cross-platform text prompt (replaces iOS-only Alert.prompt) — rides the
  // sheet's screen-pinned overlay slot, see render below.
  const [promptConfig, setPromptConfig] = useState<InlinePromptConfig | null>(null);

  // ── ⋮ action menu (context-aware by the active profile) ─────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  // Verified badge next to "ONE" — grey/translucent until the identity is
  // verified, blue once it is. No verification backend yet, so it's off; tapping
  // opens the (placeholder) verification flow.
  const oneVerified = false;
  const comingSoon = useCallback(() => {
    Alert.alert(he ? 'בקרוב' : 'Coming soon', he ? 'עוד רגע — היכולת הזו בדרך.' : "This one's on the way.");
  }, [he]);
  // Add a memory by hand. iOS has Alert.prompt; Android points to the chat
  // (where "remember that…" is captured automatically).
  const promptAddMemory = useCallback(() => {
    haptic.tap();
    setPromptConfig({
      title: he ? 'מה שאזכור' : 'Remember this',
      message: he ? 'משהו שחשוב שאזכור עליך' : 'Something I should remember about you',
      placeholder: he ? 'למשל: אני אלרגי לפניצילין' : 'e.g. I’m allergic to penicillin',
      multiline: true,
      onSubmit: (v) => { if (v) addMemory(v); },
    });
  }, [he, addMemory]);

  // ── Selective disclosure — ONE as a permissioned representative ──────────
  const discFields = disclosure ?? [];
  // Pre-fill the name field from the profile name the first time — feels alive —
  // but never overwrite a value the user set.
  useEffect(() => {
    const nameField = (disclosure ?? []).find((d) => d.key === 'name');
    if (nameField && !nameField.value && name.trim()) {
      setDisclosureValue(nameField.id, name.trim());
    }
  }, [name, disclosure, setDisclosureValue]);
  const tierMeta = useCallback(
    (tier: DisclosureTier): { label: string; color: string } => {
      if (tier === 'open') return { label: he ? 'גלוי' : 'Open', color: '#10B981' };
      if (tier === 'ask') return { label: he ? 'באישור' : 'Ask', color: '#F59E0B' };
      return { label: he ? 'פרטי' : 'Private', color: colors.textSecondary };
    },
    [he, colors.textSecondary],
  );
  const cycleDisclosureTier = useCallback(
    (id: string, cur: DisclosureTier) => {
      haptic.select();
      const next: DisclosureTier = cur === 'open' ? 'ask' : cur === 'ask' ? 'private' : 'open';
      setDisclosureTier(id, next);
    },
    [setDisclosureTier],
  );
  const cycleMemoryTier = useCallback(
    (id: string, cur: DisclosureTier) => {
      haptic.select();
      const next: DisclosureTier = cur === 'open' ? 'ask' : cur === 'ask' ? 'private' : 'open';
      setMemoryTier(id, next);
    },
    [setMemoryTier],
  );
  const editDisclosureValue = useCallback(
    (id: string, label: string, current?: string) => {
      haptic.tap();
      setPromptConfig({
        title: label,
        message: he ? 'מה שוואן ישתף עבור פרט זה' : 'What ONE would share for this',
        initialValue: current ?? '',
        placeholder: he ? 'הקלד ערך' : 'Enter a value',
        onSubmit: (v) => setDisclosureValue(id, v),
      });
    },
    [he, setDisclosureValue],
  );
  const promptAddDisclosure = useCallback(() => {
    haptic.tap();
    setPromptConfig({
      title: he ? 'הוספת פרט' : 'Add a detail',
      message: he ? 'איזה פרט וואן יכול לייצג? (למשל: כתובת, מקצוע)' : 'Which detail can ONE represent? (e.g. address, profession)',
      placeholder: he ? 'שם הפרט' : 'Detail name',
      onSubmit: (v) => { if (v) addDisclosureField(v); },
    });
  }, [he, addDisclosureField]);
  // Plain-language summary of the live policy — makes the control read as
  // "what ONE will actually do", not just a settings list.
  const disclosureSummary = useMemo(() => {
    const open = discFields.filter((d) => d.tier === 'open').map((d) => disclosureLabel(d, he));
    const ask = discFields.filter((d) => d.tier === 'ask').map((d) => disclosureLabel(d, he));
    return { open, ask };
  }, [discFields, he]);

  const menuItems: ActionMenuItem[] =
    identity?.type === 'business'
      ? [
          { iconNode: <ClockIcon size={19} color={colors.text} />, label: he ? 'ציר זמן' : 'Timeline', onPress: onOpenTimeline ?? comingSoon },
          { iconNode: <BriefcaseIcon size={19} color={colors.text} />, label: he ? 'צור/ערוך עסק ONE' : 'Create / edit business ONE', onPress: onCreateBusiness ?? comingSoon },
          { iconNode: <GlobeIcon size={19} color={colors.text} />, label: he ? 'תצוגה ציבורית' : 'Public view', onPress: comingSoon },
          { iconNode: <LinkIcon size={19} color={colors.text} />, label: he ? 'חיבורים ומקורות' : 'Connections & sources', onPress: comingSoon },
          { iconNode: <StarIcon size={19} color={colors.text} />, label: he ? 'תוכנית ומנוי' : 'Plan & subscription', onPress: () => openUpgrade(undefined) },
          { iconNode: <GearIcon size={19} color={colors.text} />, label: he ? 'הגדרות ONE' : 'ONE settings', onPress: onOpenSettings },
          { label: he ? 'התנתק' : 'Log out', destructive: true, onPress: () => { useMvpStore.getState().reset(); onClose(); } },
        ]
      : [
          { iconNode: <ClockIcon size={19} color={colors.text} />, label: he ? 'ציר זמן' : 'Timeline', onPress: onOpenTimeline ?? comingSoon },
          { iconNode: <PencilIcon size={19} color={colors.text} />, label: he ? 'ערוך פרופיל' : 'Edit profile', onPress: comingSoon },
          { iconNode: <BriefcaseIcon size={19} color={colors.text} />, label: he ? 'צור עסק ONE' : 'Create a business ONE', onPress: onCreateBusiness ?? comingSoon },
          { iconNode: <SlidersIcon size={19} color={colors.text} />, label: he ? 'התאם את ONE' : 'Customize ONE', onPress: onOpenSettings },
          { iconNode: <LinkIcon size={19} color={colors.text} />, label: he ? 'חיבורים ומקורות' : 'Connections & sources', onPress: comingSoon },
          { iconNode: <StarIcon size={19} color={colors.text} />, label: he ? 'תוכנית ומנוי' : 'Plan & subscription', onPress: () => openUpgrade(undefined) },
          { iconNode: <GearIcon size={19} color={colors.text} />, label: he ? 'הגדרות ONE' : 'ONE settings', onPress: onOpenSettings },
          { label: he ? 'התנתק' : 'Log out', destructive: true, onPress: () => { useMvpStore.getState().reset(); onClose(); } },
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
  // Drives the bottom switcher dock's tappability (only when it's faded in).
  const [dockShown, setDockShown] = useState(false);
  const handleProfileScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const show = y > COMPACT_TITLE_THRESHOLD;
      if (show !== compactShownRef.current) {
        compactShownRef.current = show;
        setDockShown(show);
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
    let shared = 0;
    for (const u of mine) {
      openSteps += (u.nextSteps ?? []).filter((s) => !s.done).length;
      openReminders += (u.reminders ?? []).filter((r) => !r.done).length;
      if (u.shareCode || u.visibility === 'shared' || u.visibility === 'public') shared += 1;
    }
    return { processes: mine.length, openSteps, openReminders, shared };
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
  // Status carousel — the horizontal metrics strip under the header. A mix of
  // live aggregates and structural counts, so opening ONE reads as "here's what
  // I'm holding for you", not vanity stats.
  // The status carousel opens with `direction: rtl` (Hebrew), which lays the
  // FIRST metric (Processes) at the right edge — but a horizontal ScrollView
  // still rests at offset 0 (the LEFT edge = the last metric, Plan). Snap it to
  // the right on open so the reading starts from Processes, as it should.
  const metricsScrollRef = React.useRef<ScrollView>(null);
  const metricsSnappedRef = React.useRef(false);
  useEffect(() => {
    if (visible) metricsSnappedRef.current = false;
  }, [visible]);
  const metrics: { label: string; value: string; color?: string }[] = [
    { label: he ? 'תהליכים' : 'Processes', value: `${liveStats.processes}` },
    { label: he ? 'צעדים' : 'Open steps', value: `${liveStats.openSteps}` },
    { label: he ? 'תזכורות' : 'Reminders', value: `${liveStats.openReminders}` },
    { label: he ? 'משותפים' : 'Shared', value: `${liveStats.shared}` },
    { label: he ? 'חיבורים' : 'Connections', value: `${connectedCount}` },
    { label: he ? 'ערוצים' : 'Channels', value: `${CHANNELS.length}` },
    { label: he ? 'מקורות' : 'Sources', value: `${SOURCES.length}` },
    { label: he ? 'זיכרון' : 'Memory', value: memories.length > 0 ? `${memories.length}` : (he ? 'פעיל' : 'Active') },
    { label: he ? 'תוכנית' : 'Plan', value: planMeta.word, color: planMeta.color },
  ];

  // ── ONE's own broadcast (the line under the name) ───────────────────────
  // NOT the Home "what's waiting" feed — this is the PROFILE's own context:
  // who ONE is for this identity, what it's holding, why it's here. It rotates
  // with a fade so ONE feels like it's quietly speaking about itself.
  const oneLines = useMemo(() => {
    const name = identity?.name?.trim();
    // The memory line reflects the REAL count once ONE remembers things.
    const memLine = he
      ? memories.length > 0
        ? `זוכר ${memories.length} דברים חשובים עליך.`
        : 'זוכר כל מה שתפקיד בידיי.'
      : memories.length > 0
        ? `Remembering ${memories.length} things that matter about you.`
        : "I remember everything you trust me with.";
    return he
      ? [
          name ? `אני ה‑ONE של ${name}.` : 'אני ה‑ONE שלך.',
          `מחזיק ${liveStats.processes} תהליכים ו‑${liveStats.openSteps} צעדים פתוחים בשבילך.`,
          'כאן כדי להפוך כוונות למציאות.',
          memLine,
        ]
      : [
          name ? `I'm ${name}'s ONE.` : "I'm your ONE.",
          `Holding ${liveStats.processes} processes and ${liveStats.openSteps} open steps for you.`,
          'Here to turn intentions into reality.',
          memLine,
        ];
  }, [identity?.name, liveStats.processes, liveStats.openSteps, he, memories.length]);
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
  // The bottom switcher dock now appears ONLY once the header space chips have
  // scrolled away (compactTitleSV → 1), so the selector is always reachable:
  // in the hero at the top, at the bottom once you scroll past it. Also fades
  // out as the sheet slides closed.
  const dockStyle = useAnimatedStyle(() => ({
    opacity:
      compactTitleSV.value * interpolate(sheetIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: dockLift.value + (1 - compactTitleSV.value) * 14 }],
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
  // Live call ring — barely-there breath (1 → 1.045), matching the home call
  // ring, so it reads "alive" while a call is active.
  const callRingPulse = useSharedValue(1);
  React.useEffect(() => {
    if (callActive) {
      callRingPulse.value = withRepeat(
        withSequence(
          withTiming(1.045, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      callRingPulse.value = 1;
    }
  }, [callActive, callRingPulse]);
  const callRingStyle = useAnimatedStyle(() => ({ transform: [{ scale: callRingPulse.value }] }));
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
  // Icon for an identity by its type (person / briefcase / house).
  const identityIcon = (type: string, color: string, size: number) =>
    type === 'business' ? (
      <BriefcaseIcon size={size} color={color} />
    ) : type === 'family' ? (
      <HouseIcon size={size} color={color} />
    ) : (
      <PersonIcon size={size} color={color} />
    );
  const activeIdentity = identities.find((id) => id.id === activeIdentityId) ?? null;
  const inactiveIdentities = identities.filter((id) => id.id !== activeIdentityId);
  // Floating profile switcher — NOT a boxed bar. A centred row of plain circular
  // buttons: + to add, one circle per OTHER profile (its type icon), and the
  // ACTIVE profile as a solid dark pill with its name. Locked LTR so + sits on
  // the left and the active pill on the right (matches the reference), in both
  // languages.
  const switcherDockNode = (
    <Animated.View
      style={[styles.switcherDock, { paddingBottom: Math.max(insets.bottom, 12) }, dockStyle]}
      pointerEvents={dockShown ? 'box-none' : 'none'}
    >
      <View style={styles.switcherRow}>
        {/* Add profile → create-identity flow (gated by the plan). */}
        <Pressable
          onPress={handleAddProfile}
          style={[styles.switcherCircle, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'הוסף פרופיל' : 'Add profile'}
          hitSlop={8}
        >
          <PlusIcon size={22} color={colors.text} />
        </Pressable>
        {/* Other profiles — a circle each, tap to switch. */}
        {inactiveIdentities.map((id) => (
          <Pressable
            key={id.id}
            onPress={() => {
              haptic.select();
              setActiveIdentity(id.id);
              // From the HALF card, jump home so the switch is felt; at the FULL
              // card, switch in place (the profile re-renders).
              if (sheetIndex.value < 0.5) onClose();
            }}
            style={[styles.switcherCircle, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={id.name}
            hitSlop={8}
          >
            {identityIcon(id.type, colors.text, 20)}
          </Pressable>
        ))}
        {/* Active profile — solid dark pill with the name + its type icon. */}
        {activeIdentity && (
          <View
            style={[styles.switcherActivePill, { backgroundColor: colors.text }]}
            accessibilityRole="text"
            accessibilityLabel={activeIdentity.name}
          >
            <Text
              style={[styles.switcherActiveName, { color: colors.background }]}
              numberOfLines={1}
            >
              {activeIdentity.name}
            </Text>
            {identityIcon(activeIdentity.type, colors.background, 18)}
          </View>
        )}
      </View>
    </Animated.View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      // One mode: opens tall (92%) with breathing room above (clear of the
      // clock / safe area). No intermediate snap — drag down to dismiss.
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
          {!isDesktop && <EdgeBars top={false} bottomHeight={130} style={{ zIndex: 5 }} />}
          {switcherDockNode}
          {/* Close is the top-corner Global-style X (see topHeader) — no bottom
              close dock any more. */}
          <SubscriptionPanel
            visible={subscriptionOpen}
            reason={subscriptionReason}
            onClose={() => setSubscriptionOpen(false)}
          />
          <InlinePrompt
            config={promptConfig}
            onClose={() => setPromptConfig(null)}
            colors={colors}
            lang={lang}
          />
        </>
      }
      sheetStyle={styles.sheet}
    >
      {/* Soft top gradient behind the header — content scrolls UNDER it, same
          treatment as the process sheet. The header (zIndex 20) stays crisp. */}
      <EdgeBars bottom={false} topHeight={112} topLinear />
      {/* Sticky top header — now just the compact title (the X + ⋮ moved: X is a
          big button at the bottom centre, the ⋮ menu lives on the orb). Renders
          OUTSIDE the scroll view so the title stays visible when scrolling. */}
      <View style={styles.topHeader} pointerEvents="box-none">
        {/* Close (X) — same size + place as the Global sheet's X (44×44 surface
            pill), on the LEADING corner (left in Hebrew / RTL, right in English). */}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={[styles.pillBtn, styles.headerClose, he ? { left: 20 } : { right: 20 }, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={t('common_close')}
        >
          <CloseIcon size={22} color={colors.text} />
        </Pressable>
        {/* Settings (gear) — on the corner OPPOSITE the X (trailing side). */}
        <Pressable
          onPress={onOpenSettings}
          hitSlop={10}
          style={[styles.pillBtn, styles.headerClose, he ? { right: 20 } : { left: 20 }, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'הגדרות' : 'Settings'}
        >
          <GearIcon size={20} color={colors.text} />
        </Pressable>
        {/* Compact sticky title — empty at the top (clean header), fades in
            "ONE <PLAN>" once the big title scrolls off. */}
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
            <View style={styles.oneOrbWrap}>
              <Orb size={120} eyeLookY={eyeLookY} trackPointer noShadow />
              {/* Live green call ring — shown while a voice call is active, so
                  the call reads as having "moved into" the profile with you.
                  Breathes gently, like the home call ring. */}
              {callActive && (
                <Animated.View style={[styles.oneCallRing, callRingStyle]} pointerEvents="none" />
              )}
              {/* Pencil on the orb's corner — edit ONE (opens the options tab:
                  edit profile, customize, …). Settings moved to the gear in the
                  top header. */}
              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={8}
                style={[styles.editOrbBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={he ? 'ערוך' : 'Edit'}
              >
                <PencilIcon size={16} color={colors.text} />
              </Pressable>
            </View>
          </Animated.View>
          {/* Title "ONE" + a verified badge AFTER the word. "ONE" is always
              Latin, so the row is fixed LTR (name first, badge after) in every
              language — the badge stays to the right of ONE in Hebrew too. Grey
              when unverified (tap → verify), blue when verified. */}
          {/* Title: ONE + the subscription plan. The plan is ACCOUNT-level (one
              ONE, one plan) — so it lives on the name, not on a space. */}
          <View style={styles.heroTitleRow}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{oneName}</Text>
            <Pressable
              onPress={() => openUpgrade(undefined)}
              hitSlop={10}
              style={styles.planInline}
              accessibilityRole="button"
              accessibilityLabel={planMeta.word}
            >
              <View style={[styles.planDot, { backgroundColor: colors.text }]} />
              <Text style={[styles.planLabel, { color: planMeta.color }]}>{planMeta.word}</Text>
            </Pressable>
          </View>
          {/* Space selector — switch which ONE (profile/space) you're viewing,
              right under the name where identity lives. + adds a profile; tap
              another space to switch; the plan badge taps through to upgrade. */}
          <View style={[styles.spaceRow, rtlRow(lang)]}>
            <Pressable
              onPress={handleAddProfile}
              style={[styles.spaceCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={he ? 'הוסף פרופיל' : 'Add profile'}
              hitSlop={6}
            >
              <PlusIcon size={18} color={colors.text} />
            </Pressable>
            {inactiveIdentities.map((id) => (
              <Pressable
                key={id.id}
                onPress={() => { haptic.select(); setActiveIdentity(id.id); }}
                style={[styles.spaceCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={id.name}
                hitSlop={6}
              >
                {identityIcon(id.type, colors.text, 17)}
              </Pressable>
            ))}
            {activeIdentity && (
              <Pressable
                onPress={comingSoon}
                style={[styles.spaceActivePill, { backgroundColor: colors.text }]}
                accessibilityRole="button"
                accessibilityLabel={`${activeIdentity.name} · ${oneVerified ? (he ? 'מאומת' : 'Verified') : (he ? 'אימות' : 'Verify')}`}
                hitSlop={6}
              >
                {identityIcon(activeIdentity.type, colors.background, 15)}
                <Text style={[styles.spaceActiveName, { color: colors.background }]} numberOfLines={1}>
                  {activeIdentity.name}
                </Text>
                {/* Verification is PER-SPACE: "this really is you, as this
                    identity." Blue when verified, muted placeholder otherwise. */}
                <VerifiedIcon size={15} color={oneVerified ? '#60A5FA' : 'rgba(255,255,255,0.45)'} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Status carousel — a horizontal strip of what ONE holds for this
            profile. Scrolls sideways so it can carry more metrics without
            crowding the hero. */}
        <ScrollView
          ref={metricsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.metricsScroll, { borderColor: colors.border }]}
          contentContainerStyle={[styles.metricsRow, rtlRow(lang)]}
          onContentSizeChange={() => {
            // Once per open (Hebrew only): jump to the right edge so the row
            // reads from Processes, not Plan.
            if (he && !metricsSnappedRef.current) {
              metricsSnappedRef.current = true;
              metricsScrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
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

        {/* Toolbox — what ONE can DO: live capabilities it deploys in the chat.
            Live tools toggle on/off; the chat checks this before deploying. */}
        <Section title={he ? 'מה ONE יודע לעשות' : 'What ONE can do'} colors={colors}>
          <View style={styles.toolList}>
            {TOOLS.map((tool) => {
              const live = tool.status === 'live';
              const on = live && toolEnabled(enabledTools, tool.id);
              return (
                <View
                  key={tool.id}
                  style={[styles.toolRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: live ? 1 : 0.7 }]}
                >
                  <Text style={styles.toolEmoji}>{tool.emoji}</Text>
                  <View style={styles.flex1}>
                    <View style={[styles.toolTitleRow, rtlRow(lang)]}>
                      <Text style={[styles.toolName, { color: colors.text }, rtlText(lang)]}>
                        {tool.label(he)}
                      </Text>
                      {tool.pro && (
                        <Text style={[styles.toolProTag, { color: colors.textSecondary, borderColor: colors.border }]}>Pro</Text>
                      )}
                    </View>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                      {tool.desc(he)}
                    </Text>
                  </View>
                  {live ? (
                    <Pressable
                      onPress={() => { haptic.select(); setToolEnabled(tool.id, !on); }}
                      style={[styles.toolTgl, { backgroundColor: on ? colors.primary : colors.border }]}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={tool.label(he)}
                    >
                      <View style={[styles.toolKnob, on ? styles.toolKnobOn : styles.toolKnobOff]} />
                    </Pressable>
                  ) : (
                    <Text style={[styles.toolSoon, { color: colors.textSecondary, backgroundColor: colors.background }]}>
                      {he ? 'בקרוב' : 'Soon'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </Section>

        {/* Memory — what ONE remembers (categories, not the raw data). */}
        {/* What ONE knows about you — the single trust surface. Every fact ONE
            holds, whether a structured detail you filled in or something you
            told it to remember, carries a share-tier: Open (shares freely) ·
            Ask (asks first) · Private (never shares). This permissioned model is
            what sets ONE apart from agents that act AS you with full credentials.
            Tap a detail to set its value; tap any pill to cycle the tier. */}
        <Section title={he ? 'מה ONE יודע עליך' : 'What ONE knows about you'} colors={colors}>
          <Text style={[styles.connectionsIntro, { color: colors.textSecondary }, rtlText(lang)]}>
            {he
              ? 'וואן מייצג אותך — לא מתחזה אליך. לכל פרט שהוא יודע יש כלל שיתוף: גלוי · באישור · פרטי.'
              : 'ONE represents you — never impersonates you. Every fact it knows has a sharing rule: Open · Ask · Private.'}
          </Text>

          {/* Group 1 — structured details (name, city, contact, IDs…). */}
          <Text style={[styles.knowGroupLabel, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'פרטים' : 'Details'}
          </Text>
          <View style={styles.discList}>
            {discFields.map((d) => {
              const meta = tierMeta(d.tier);
              const label = disclosureLabel(d, he);
              return (
                <View
                  key={d.id}
                  style={[styles.discRow, { backgroundColor: colors.surface }, rtlRow(lang)]}
                >
                  <Pressable
                    style={styles.discMain}
                    onPress={() => editDisclosureValue(d.id, label, d.value)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text style={[styles.discLabel, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text
                      style={[styles.discValue, { color: colors.textSecondary, opacity: d.value ? 1 : 0.6 }, rtlText(lang)]}
                      numberOfLines={1}
                    >
                      {d.value || (he ? 'הקש להוספה' : 'Tap to add')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cycleDisclosureTier(d.id, d.tier)}
                    style={[styles.discTier, { borderColor: meta.color }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}: ${meta.label}`}
                  >
                    <View style={[styles.discTierDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.discTierText, { color: meta.color }]}>{meta.label}</Text>
                  </Pressable>
                  {!d.system && (
                    <Pressable
                      onPress={() => { haptic.select(); removeDisclosureField(d.id); }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={he ? 'הסר' : 'Remove'}
                    >
                      <CloseIcon size={13} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {/* Group 2 — things you've told ONE to remember. Each is a fact with
              its own tier, private by default. */}
          <Text style={[styles.knowGroupLabel, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'מה שסיפרת לי' : "What you've told me"}
          </Text>
          {memories.length === 0 ? (
            <Text style={[styles.memoryEmpty, { color: colors.textSecondary }, rtlText(lang)]}>
              {he
                ? 'עוד כלום. אמור לי «תזכור ש…» בצ׳אט ואשמור, או הוסף כאן.'
                : "Nothing yet. Tell me “remember that…” in chat and I'll keep it, or add one here."}
            </Text>
          ) : (
            <View style={styles.memoryList}>
              {memories.slice(0, 8).map((m) => {
                const mTier = m.tier ?? 'private';
                const meta = tierMeta(mTier);
                return (
                  <View
                    key={m.id}
                    style={[styles.memoryRow, { backgroundColor: colors.surface }, rtlRow(lang)]}
                  >
                    <Text style={[styles.memoryText, { color: colors.text }, rtlText(lang)]} numberOfLines={2}>
                      {m.text}
                    </Text>
                    <Pressable
                      onPress={() => cycleMemoryTier(m.id, mTier)}
                      style={[styles.discTier, { borderColor: meta.color }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.text}: ${meta.label}`}
                    >
                      <View style={[styles.discTierDot, { backgroundColor: meta.color }]} />
                      <Text style={[styles.discTierText, { color: meta.color }]}>{meta.label}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { haptic.select(); removeMemory(m.id); }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={he ? 'שכח' : 'Forget'}
                    >
                      <CloseIcon size={14} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Live summary — what the policy actually does right now. */}
          {(disclosureSummary.open.length > 0 || disclosureSummary.ask.length > 0) && (
            <Text style={[styles.discSummary, { color: colors.textSecondary }, rtlText(lang)]}>
              {disclosureSummary.open.length > 0
                ? he
                  ? `וואן ישתף באופן חופשי: ${disclosureSummary.open.join(', ')}.`
                  : `ONE shares freely: ${disclosureSummary.open.join(', ')}.`
                : ''}
              {disclosureSummary.ask.length > 0
                ? he
                  ? ` יבקש רשות ל: ${disclosureSummary.ask.join(', ')}.`
                  : ` Asks first for: ${disclosureSummary.ask.join(', ')}.`
                : ''}
            </Text>
          )}

          {/* Add either kind of fact — a structured detail or a free memory. */}
          <View style={[styles.knowActionsRow, rtlRow(lang)]}>
            <Pressable
              onPress={promptAddDisclosure}
              style={({ pressed }) => [
                styles.manageRow,
                styles.knowAction,
                { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
                rtlRow(lang),
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.manageRowText, { color: colors.text }]}>
                {he ? 'הוסף פרט' : 'Add detail'}
              </Text>
              <Text style={[styles.settingsLinkChev, { color: colors.textSecondary }]}>+</Text>
            </Pressable>
            <Pressable
              onPress={promptAddMemory}
              style={({ pressed }) => [
                styles.manageRow,
                styles.knowAction,
                { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
                rtlRow(lang),
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.manageRowText, { color: colors.text }]}>
                {he ? 'הוסף זיכרון' : 'Add memory'}
              </Text>
              <Text style={[styles.settingsLinkChev, { color: colors.textSecondary }]}>+</Text>
            </Pressable>
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

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemeColors;
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
  // The header close X — absolutely placed in the leading corner so it doesn't
  // shift the centred sticky title. Leading side (left/right) is set inline.
  headerClose: {
    position: 'absolute',
    top: 10,
    zIndex: 3,
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
    // Cap + centre so the content doesn't stretch edge-to-edge on a wide
    // (web/desktop) viewport (the sheet itself stays full-width).
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
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
  // Big bottom-centre close button (the X moved out of the top header).
  // Centred row of floating buttons — locked LTR so + stays left, active pill
  // right, regardless of app language.
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...(Platform.OS !== 'web' ? { direction: 'ltr' as const } : {}),
  },
  // A plain floating circle — the + and each inactive profile. Soft shadow so it
  // reads as a button on the page, no enclosing bar.
  switcherCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // The active profile — a solid dark pill with the name + its type icon.
  switcherActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  switcherActiveName: {
    fontSize: 17,
    fontWeight: '700',
    maxWidth: 150,
  },

  // Hero: big Orb + ONE + rotating subline + upgrade.
  heroBlock: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },
  // Orb + its call ring. 132 square = the 120 orb centred with ~6px around it,
  // so the ring hugs the orb's edge.
  oneOrbWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneCallRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2.5,
    borderColor: '#22C55E',
  },
  // Small pencil on the orb's corner (edit ONE's look).
  editOrbBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // "ONE" + its verified badge, on one centred row. Fixed LTR so the badge
  // always sits AFTER (to the right of) the Latin "ONE", regardless of language.
  heroTitleRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
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
  // Header space selector — compact row under the name (replaces the bottom dock).
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  spaceCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  spaceActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  spaceActiveName: { fontSize: 14.5, fontWeight: '700', maxWidth: 150 },
  // Plan shown as a coloured dot + word next to ONE (not a boxed badge).
  planInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  // Same size as "ONE", just lighter weight so it reads as secondary.
  planLabel: { fontSize: 28, fontWeight: '500', letterSpacing: 1 },
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
  // Toolbox — ONE's capabilities as rows with a toggle (live) or "soon" tag.
  toolList: { gap: 8, marginTop: 4 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  toolEmoji: { fontSize: 19 },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolName: { fontSize: 14, fontWeight: '700' },
  toolProTag: {
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  toolDesc: { fontSize: 12, marginTop: 2 },
  toolTgl: { width: 42, height: 26, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 3 },
  toolKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toolKnobOn: { alignSelf: 'flex-end' },
  toolKnobOff: { alignSelf: 'flex-start' },
  toolSoon: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
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
  // "What ONE knows about you" — group labels + the paired add actions.
  knowGroupLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4, marginTop: 16, marginBottom: 2 },
  knowActionsRow: { flexDirection: 'row', gap: 8 },
  knowAction: { flex: 1, justifyContent: 'center' },
  // "What ONE remembers" — the memory list.
  memoryEmpty: { fontSize: 14, lineHeight: 20 },
  memoryList: { gap: 8 },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  memoryText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  // ── Selective disclosure — the permissioned-representative control. ──────
  discList: { gap: 8, marginTop: 6 },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  discMain: { flex: 1, gap: 2 },
  discLabel: { fontSize: 14.5, fontWeight: '600' },
  discValue: { fontSize: 12.5, lineHeight: 16 },
  discTier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  discTierDot: { width: 7, height: 7, borderRadius: 4 },
  discTierText: { fontSize: 12.5, fontWeight: '700' },
  discSummary: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
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
