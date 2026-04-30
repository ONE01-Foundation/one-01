/**
 * פרופיל יחידה בתוך צ'אט ONE — מגירות (אקורדיון), מטריקות ותוכן מוכן לקהל רחב.
 */
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLocaleStore } from '../stores/localeStore';
import { embedLatinRunsForRtlDisplay } from '../i18n/strings';

export type UnitProfilePerson = { id: string; role: string; name: string };
export type UnitProfileMilestone = { id: string; title: string; done: boolean };

/** מודל תצוגה לפרופיל — כל השדות האופציונליים ממולאים ברירות מחדל בקומפוננטה */
export type UnitChatProfileModel = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  status: 'active' | 'waiting' | 'done';
  progress: number;
  steps: number;
  goal?: string;
  city?: string;
  budgetMinIls?: number;
  budgetMaxIls?: number;
  etaWeeks?: number;
  peopleRoles?: UnitProfilePerson[];
  milestones?: UnitProfileMilestone[];
  nextAction?: string;
  lastUpdatedLabel?: string;
  blockCount?: number;
};

/** פרופיל סוכן (בלי יחידה פעילה) — כל המחרוזות בשפת הממשק שנבחרה בבנייה */
export type AgentChatProfileWorldRow = {
  id: string;
  label: string;
  color: string;
  active: boolean;
  detail: string;
};
export type AgentChatProfilePermissionRow = { label: string; state: 'on' | 'off' | 'limited'; note: string };
export type AgentChatProfileContactRow = { role: string; name: string; note?: string };
export type AgentChatProfileKv = { label: string; value: string };
export type AgentChatProfileStat = { label: string; value: string; hint?: string };

export type AgentChatProfileModel = {
  name: string;
  tagline: string;
  personaLine: string;
  worlds: AgentChatProfileWorldRow[];
  hatsIntro: string;
  hatLabels: string[];
  permissions: AgentChatProfilePermissionRow[];
  contacts: AgentChatProfileContactRow[];
  dataRows: AgentChatProfileKv[];
  stats: AgentChatProfileStat[];
  privacyLead: string;
  opsBullets: string[];
  nextHint: string;
  summary: string;
  metaFoot: string;
};

type ThemeColors = {
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
};

type UnitChatProfileProps = {
  visible: boolean;
  unit: UnitChatProfileModel | null;
  /** כשאין יחידה — תוכן פרופיל הסוכן (מרחבים, הרשאות, נתונים…) */
  agentProfile: AgentChatProfileModel | null;
  chatAgentStatus: string;
  colors: ThemeColors;
  isDark: boolean;
  profileAccent: string;
  profileRingR: number;
  profileRingC: number;
  unitProgressPct: number;
  unitStepsDone: number;
  centerContent: ReactNode;
  editMode?: boolean;
  onRenameUnit?: (title: string) => void;
  onPressOpenUnits?: () => void;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatBudgetRange(min?: number, max?: number): string {
  if (min != null && max != null && max >= min) {
    return `בערך ₪${min.toLocaleString('he-IL')}–₪${max.toLocaleString('he-IL')}`;
  }
  if (min != null) return `מ־₪${min.toLocaleString('he-IL')}`;
  return '—';
}

function inferMilestones(unit: UnitChatProfileModel | null, stepsDone: number, stepsTotal: number): UnitProfileMilestone[] {
  if (unit?.milestones?.length) return unit.milestones;
  const isLicense =
    unit?.id === 'license' ||
    unit?.title.toLowerCase().includes('license') ||
    unit?.title.includes('רישיון') ||
    unit?.title.includes('נהיגה');
  const titles = isLicense
    ? [
        'איסוף מסמכים (ת.ז., צילום רפואי)',
        'מבחן תיאוריה במשרד הרישוי',
        'שיעורי נהיגה (מינימום שעות לפי הדרישה)',
        'מבחן מעשי',
        'קבלת הרישיון בדואר / באיסוף',
      ]
    : [
        'הגדרת מטרה ותוצרים',
        'איסוף מידע ומסמכים',
        'ביצוע צעדים עם מעקב',
        'בדיקה וסגירה',
      ];
  const cap = Math.max(3, Math.min(titles.length, stepsTotal || titles.length));
  const slice = titles.slice(0, cap);
  const ratio = stepsTotal > 0 ? Math.min(1, stepsDone / stepsTotal) : 0;
  const doneMilestoneCount = Math.min(slice.length, Math.floor(ratio * slice.length));
  return slice.map((title, i) => ({
    id: `m_${unit?.id ?? 'x'}_${i}`,
    title,
    done: i < doneMilestoneCount,
  }));
}

function DrawerRow({
  title,
  subtitle,
  open,
  onToggle,
  leadingEmoji,
  blockBg,
  blockFg,
  blockFgMuted,
  blockBorder,
  editMode,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  leadingEmoji: string;
  blockBg: string;
  blockFg: string;
  blockFgMuted: string;
  blockBorder: string;
  editMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  children: ReactNode;
}) {
  /** שורת מגירה: תמיד LTR פיזית (אימוג׳י משמאל, צ׳ברון מימין) — כמו במעטפת שפה אנגלית; הטקסט בעברית עם bidi RTL */
  return (
    <View style={styles.drawerWrap}>
      <TouchableOpacity
        style={[styles.drawerHead, { backgroundColor: blockBg, borderColor: blockBorder }]}
        onPress={onToggle}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={styles.drawerHeadRow}>
          <Text style={styles.drawerEmoji}>{leadingEmoji}</Text>
          <View style={styles.drawerHeadText}>
            <Text
              style={[
                styles.drawerTitle,
                {
                  color: blockFg,
                  textAlign: 'left',
                  writingDirection: 'rtl',
                  alignSelf: 'stretch',
                  width: '100%',
                },
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.drawerSubtitle,
                  {
                    color: blockFgMuted,
                    textAlign: 'left',
                    writingDirection: 'rtl',
                    alignSelf: 'stretch',
                    width: '100%',
                  },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {editMode ? (
            <View style={styles.drawerInlineActions}>
              <TouchableOpacity
                style={styles.drawerInlineBtn}
                onPress={onMoveUp}
                disabled={!canMoveUp}
                activeOpacity={0.7}
              >
                <Text style={[styles.drawerInlineBtnText, { color: canMoveUp ? blockFg : blockFgMuted }]}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.drawerInlineBtn}
                onPress={onMoveDown}
                disabled={!canMoveDown}
                activeOpacity={0.7}
              >
                <Text style={[styles.drawerInlineBtnText, { color: canMoveDown ? blockFg : blockFgMuted }]}>↓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerInlineBtn} onPress={onRemove} activeOpacity={0.7}>
                <Text style={[styles.drawerInlineBtnText, { color: blockFg }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={[styles.drawerChev, { color: blockFgMuted }]}>{open ? '⌃' : '⌄'}</Text>
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={[styles.drawerBody, { backgroundColor: blockBg, borderColor: blockBorder }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

function RowKV({
  label,
  value,
  textAlign,
  writingDirection,
  fgMuted,
  fg,
}: {
  label: string;
  value: string;
  textAlign: 'left' | 'right';
  writingDirection: 'rtl' | 'ltr';
  fgMuted: string;
  fg: string;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: fgMuted, textAlign, writingDirection }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: fg, textAlign, writingDirection }]}>{value}</Text>
    </View>
  );
}

function permissionMark(state: AgentChatProfilePermissionRow['state']): string {
  if (state === 'on') return '✓';
  if (state === 'off') return '○';
  return '◐';
}

const AGENT_DRAWER_KEYS = ['worlds', 'caps', 'perms', 'contacts', 'data', 'stats', 'privacy'] as const;
type AgentDrawerKey = (typeof AGENT_DRAWER_KEYS)[number];

function agentDrawerCopy(lang: 'he' | 'en'): Record<AgentDrawerKey, { title: string; subtitle?: string }> {
  if (lang === 'he') {
    return {
      worlds: { title: 'מרחבים ועולמות', subtitle: 'איפה ONE ממוקם כרגע — כל מרחב עם הקשר משלו' },
      caps: { title: 'יכולות וכובעים', subtitle: 'מה הסוכן יודע לעשות לפי ההקשר שבחרת' },
      perms: { title: 'הרשאות וגישה', subtitle: 'מה אפשר לסוכן לעשות במכשיר ובשירות' },
      contacts: { title: 'אנשי קשר וגורמים', subtitle: 'מי מופיע בשיחות ובתהליכים' },
      data: { title: 'נתונים וזיכרון', subtitle: 'מה נשמר מקומית ובשרת לשיפור התוצאות' },
      stats: { title: 'סטטיסטיקות', subtitle: 'מבט על פעילות בתקופה האחרונה' },
      privacy: { title: 'פרטיות ואבטחה', subtitle: 'איך אנחנו מטפלים במידע שלך' },
    };
  }
  return {
    worlds: { title: 'Worlds & spaces', subtitle: 'Where your agent is focused — each space has its own context' },
    caps: { title: 'Capabilities & hats', subtitle: 'What the agent can do based on the lenses you use' },
    perms: { title: 'Permissions', subtitle: 'What the agent may access on device and in the service' },
    contacts: { title: 'Contacts & parties', subtitle: 'Who shows up in chats and processes' },
    data: { title: 'Data & memory', subtitle: 'What is stored to improve outcomes' },
    stats: { title: 'Statistics', subtitle: 'Recent activity at a glance' },
    privacy: { title: 'Privacy & security', subtitle: 'How your information is handled' },
  };
}

export function UnitChatProfile({
  visible,
  unit,
  agentProfile,
  chatAgentStatus,
  colors,
  isDark,
  profileAccent,
  profileRingR,
  profileRingC,
  unitProgressPct,
  unitStepsDone,
  centerContent,
  editMode = false,
  onRenameUnit,
  onPressOpenUnits,
}: UnitChatProfileProps) {
  const language = useLocaleStore((s) => s.language);
  const agentLang: 'he' | 'en' = language === 'he' ? 'he' : 'en';
  const agentUi = useMemo(() => agentDrawerCopy(agentLang), [agentLang]);
  /** במצב בהיר — בלוקים אפורים רכים; בכהה — כמעט שחור עם טקסט בהיר */
  const blockPalette = useMemo(() => {
    if (isDark) {
      return {
        bg: '#101012',
        fg: '#f4f4f5',
        muted: '#a1a1aa',
        border: 'rgba(255,255,255,0.1)',
      };
    }
    return {
      bg: '#e8ebf0',
      fg: '#18181b',
      muted: '#52525b',
      border: colors.border,
    };
  }, [isDark, colors.border]);
  /** טקסט עברי בקלף: RTL לוגי, אבל שורות flex ב־LTR — נמנע כפל RTL (מערכת + אפליקציה) שמבלבל מגירות */
  const heTa: 'left' = 'left';
  const heWd: 'rtl' | 'ltr' = 'rtl';
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [draftTitle, setDraftTitle] = useState('');
  const defaultUnitDrawerOrder = useMemo(() => ['goal', 'steps', 'time', 'people', 'docs'] as const, []);
  const defaultAgentDrawerOrder = useMemo(() => [...AGENT_DRAWER_KEYS] as string[], []);
  const [drawerOrder, setDrawerOrder] = useState<string[]>([...defaultUnitDrawerOrder]);
  const [hiddenDrawerKeys, setHiddenDrawerKeys] = useState<string[]>([]);
  const isAgentCard = !unit && !!agentProfile;
  const ap = agentProfile;

  useEffect(() => {
    if (!visible) setOpen({});
  }, [visible]);

  useEffect(() => {
    if (unit) {
      setDraftTitle(unit.title ?? '');
      setDrawerOrder([...defaultUnitDrawerOrder]);
      setHiddenDrawerKeys([]);
    } else {
      setDrawerOrder([...defaultAgentDrawerOrder]);
      setHiddenDrawerKeys([]);
    }
  }, [unit?.id, unit?.title, defaultUnitDrawerOrder, defaultAgentDrawerOrder]);

  const toggle = useCallback((key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const moveDrawer = useCallback((key: string, dir: -1 | 1) => {
    setDrawerOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const clone = [...prev];
      const [picked] = clone.splice(idx, 1);
      clone.splice(next, 0, picked);
      return clone;
    });
  }, []);
  const removeDrawer = useCallback((key: string) => {
    setHiddenDrawerKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setOpen((prev) => ({ ...prev, [key]: false }));
  }, []);
  const milestones = useMemo(
    () => inferMilestones(unit, unitStepsDone, unit?.steps ?? 5),
    [unit, unitStepsDone]
  );

  const people = useMemo(() => {
    if (unit?.peopleRoles?.length) return unit.peopleRoles;
    if (unit)
      return [
        { id: 'p1', role: 'סוכן', name: 'ONE' },
        { id: 'p2', role: 'אחראי/ת', name: 'את/ה' },
      ];
    return [{ id: 'p0', role: 'סוכן', name: 'ONE' }];
  }, [unit]);

  const statusStyle = useMemo(() => {
    if (!unit) return { bg: hexToRgba(profileAccent, isDark ? 0.22 : 0.12), fg: profileAccent };
    if (unit.status === 'waiting')
      return { bg: isDark ? 'rgba(234,179,8,0.22)' : 'rgba(250,204,21,0.22)', fg: '#a16207' };
    if (unit.status === 'done') return { bg: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(203,213,225,0.5)', fg: colors.textSecondary };
    return { bg: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.14)', fg: '#166534' };
  }, [unit, profileAccent, isDark, colors.textSecondary]);

  const statusLabel = isAgentCard
    ? agentLang === 'he'
      ? 'מוכן'
      : 'Ready'
    : !unit
      ? agentLang === 'he'
        ? 'מוכן'
        : 'Ready'
      : unit.status === 'waiting'
        ? agentLang === 'he'
          ? 'ממתין'
          : 'Waiting'
        : unit.status === 'done'
          ? agentLang === 'he'
            ? 'הושלם'
            : 'Done'
          : agentLang === 'he'
            ? 'פעיל'
            : 'Active';

  const goalText =
    unit?.goal ??
    (unit
      ? `לנהל את «${embedLatinRunsForRtlDisplay(unit.title, language)}» עד הסיום — עם צעדים ברורים ותזכורות.`
      : 'ONE מארגן מטרות ליחידות עם צעדים, אנשים ותקציב במקום אחד.');

  const summaryText = unit
    ? 'הכל נשאר מסונכרן עם הצ׳אט: צעדים, אנשים ותקציב במקום אחד — בלי לאבד הקשר בין הודעה להודעה.'
    : 'כאן יופיע פירוט היחידה: מה נשאר לעשות, מי מעורב, וכמה זה אמור לקחת. פתחו יחידה מהגלגל או מהיסטוריה כדי להתחיל.';

  const etaLabel = unit?.etaWeeks != null ? `בערך ${unit.etaWeeks} שבועות` : unit ? 'לפי הקצב שלך' : '—';
  const budgetLabel = formatBudgetRange(unit?.budgetMinIls, unit?.budgetMaxIls);
  const cityLabel = unit?.city ?? (unit ? 'לא הוגדר' : '—');
  const peopleCount = people.length;
  const blocksCount = unit?.blockCount ?? (unit ? 6 : 3);
  const updatedLabel = unit?.lastUpdatedLabel ?? 'מתעדכן אוטומטית מהשיחה';

  const heroTitle = unit
    ? embedLatinRunsForRtlDisplay(unit.title, language)
    : ap
      ? embedLatinRunsForRtlDisplay(ap.name, language)
      : 'ONE';
  const heroSubtitle = unit ? unit.subtitle : ap?.tagline ?? (agentLang === 'he' ? 'המנהל האישי שלך לתהליכים' : 'Your personal process manager');
  const heroPersonaLine = !unit && ap?.personaLine ? ap.personaLine : null;
  const metricTriple =
    isAgentCard && ap && ap.stats.length >= 3
      ? [
          { label: ap.stats[0].label, value: ap.stats[0].value },
          { label: ap.stats[1].label, value: ap.stats[1].value },
          { label: ap.stats[2].label, value: ap.stats[2].value },
        ]
      : null;
  const metaFootText = isAgentCard && ap ? ap.metaFoot : `${updatedLabel} · ${blocksCount} בלוקים במוצר (תיאור, משימות, התקדמות…)`;
  const nextBodyText = isAgentCard && ap ? ap.nextHint : unit?.nextAction ?? (unit ? 'שלחו בצ׳אט מה הצעד הבא — ONE יעדכן את הרשימה.' : 'בחרו יחידה או תארו מטרה בשורת «עכשיו?» כדי לפתוח יחידה חדשה.');
  const summaryBodyText = isAgentCard && ap ? ap.summary : summaryText;

  return (
    <View style={[styles.root, { direction: 'ltr' }]}>
      <View style={styles.hero}>
        <View style={styles.ringWrap}>
          <Svg width={88} height={88} viewBox="0 0 88 88" style={StyleSheet.absoluteFillObject}>
            <Circle
              cx={44}
              cy={44}
              r={profileRingR}
              stroke={hexToRgba(colors.textSecondary, isDark ? 0.35 : 0.22)}
              strokeWidth={6}
              fill="none"
            />
            <Circle
              cx={44}
              cy={44}
              r={profileRingR}
              stroke={profileAccent}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${profileRingC * unitProgressPct} ${profileRingC}`}
              transform="rotate(-90 44 44)"
            />
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            {centerContent}
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text, writingDirection: unit ? heWd : heWd }]}>
          {heroTitle}
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textSecondary, writingDirection: heWd }]}
          numberOfLines={4}
        >
          {[heroSubtitle, heroPersonaLine].filter(Boolean).join('\n')}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg, direction: 'ltr' }]}>
          <Text style={[styles.statusPillText, { color: statusStyle.fg, writingDirection: heWd }]}>{statusLabel}</Text>
          <Text style={[styles.statusDot, { color: colors.textSecondary }]}> · </Text>
          <Text style={[styles.statusMeta, { color: colors.textSecondary, writingDirection: heWd }]}>
            {unit ? `${unit.progress}%` : chatAgentStatus}
          </Text>
        </View>
      </View>

      <View style={[styles.metricsRow, { direction: 'ltr' }]}>
        {metricTriple ? (
          metricTriple.map((m, i) => (
            <View key={`m_${i}`} style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>{m.label}</Text>
              <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]} numberOfLines={2}>
                {m.value}
              </Text>
            </View>
          ))
        ) : (
          <>
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>
                {agentLang === 'he' ? 'זמן משוער' : 'Est. time'}
              </Text>
              <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]}>{etaLabel}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>
                {agentLang === 'he' ? 'תקציב' : 'Budget'}
              </Text>
              <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]} numberOfLines={2}>
                {budgetLabel}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>
                {agentLang === 'he' ? 'מעורבים' : 'People'}
              </Text>
              <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]}>
                {unit ? `${peopleCount}` : '1'}
              </Text>
            </View>
          </>
        )}
      </View>

      <Text style={[styles.metaFoot, { color: colors.textSecondary, writingDirection: heWd }]}>{metaFootText}</Text>

      {editMode && unit ? (
        <TextInput
          style={[styles.editTitleInlineInput, { color: blockPalette.fg, borderColor: blockPalette.border }]}
          value={draftTitle}
          onChangeText={setDraftTitle}
          onBlur={() => {
            const next = draftTitle.trim();
            if (next && next !== unit.title) onRenameUnit?.(next);
          }}
          placeholder="שם יחידה"
          placeholderTextColor={blockPalette.muted}
        />
      ) : null}

      {isAgentCard && ap
        ? drawerOrder
            .filter((key) => !hiddenDrawerKeys.includes(key))
            .map((key, index, visibleKeys) => {
              const dc = agentUi[key as AgentDrawerKey];
              if (key === 'worlds') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.worlds}
                    onToggle={() => toggle('worlds')}
                    leadingEmoji="🌐"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    {ap.worlds.map((w) => (
                      <View key={w.id} style={styles.worldRow}>
                        <View style={[styles.worldDot, { backgroundColor: w.color }]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.worldTitleRow}>
                            <Text style={[styles.personName, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
                              {embedLatinRunsForRtlDisplay(w.label, language)}
                            </Text>
                            {w.active ? (
                              <View style={[styles.activePill, { borderColor: profileAccent }]}>
                                <Text style={[styles.activePillText, { color: profileAccent }]}>
                                  {agentLang === 'he' ? 'פעיל' : 'Active'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
                            {w.detail}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </DrawerRow>
                );
              }
              if (key === 'caps') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.caps}
                    onToggle={() => toggle('caps')}
                    leadingEmoji="🎩"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{ap.hatsIntro}</Text>
                    {ap.hatLabels.map((line, i) => (
                      <View key={`hat_${i}`} style={styles.milestoneRow}>
                        <Text style={[styles.milestoneMark, { color: '#22c55e' }]}>✓</Text>
                        <Text style={[styles.milestoneText, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>{line}</Text>
                      </View>
                    ))}
                  </DrawerRow>
                );
              }
              if (key === 'perms') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.perms}
                    onToggle={() => toggle('perms')}
                    leadingEmoji="🔐"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    {ap.permissions.map((p, i) => (
                      <View key={`perm_${i}`} style={styles.permRow}>
                        <Text style={[styles.permMark, { color: p.state === 'on' ? '#22c55e' : blockPalette.muted }]}>
                          {permissionMark(p.state)}
                        </Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.personName, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>{p.label}</Text>
                          <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{p.note}</Text>
                        </View>
                      </View>
                    ))}
                  </DrawerRow>
                );
              }
              if (key === 'contacts') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.contacts}
                    onToggle={() => toggle('contacts')}
                    leadingEmoji="👤"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    {ap.contacts.map((c, i) => (
                      <View key={`c_${i}`} style={styles.personRow}>
                        <View style={[styles.personDot, { backgroundColor: profileAccent }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.personRole, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{c.role}</Text>
                          <Text style={[styles.personName, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>{c.name}</Text>
                          {c.note ? (
                            <Text style={[styles.hint, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{c.note}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </DrawerRow>
                );
              }
              if (key === 'data') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.data}
                    onToggle={() => toggle('data')}
                    leadingEmoji="💾"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    {ap.dataRows.map((row, i) => (
                      <RowKV
                        key={`d_${i}`}
                        label={row.label}
                        value={row.value}
                        textAlign={heTa}
                        writingDirection={heWd}
                        fgMuted={blockPalette.muted}
                        fg={blockPalette.fg}
                      />
                    ))}
                  </DrawerRow>
                );
              }
              if (key === 'stats') {
                return (
                  <DrawerRow
                    key={key}
                    title={dc.title}
                    subtitle={dc.subtitle}
                    open={!!open.stats}
                    onToggle={() => toggle('stats')}
                    leadingEmoji="📊"
                    blockBg={blockPalette.bg}
                    blockFg={blockPalette.fg}
                    blockFgMuted={blockPalette.muted}
                    blockBorder={blockPalette.border}
                    editMode={editMode}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleKeys.length - 1}
                    onMoveUp={() => moveDrawer(key, -1)}
                    onMoveDown={() => moveDrawer(key, 1)}
                    onRemove={() => removeDrawer(key)}
                  >
                    {ap.stats.map((st, i) => (
                      <View key={`st_${i}`} style={styles.statBlock}>
                        <Text style={[styles.statValueBig, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>{st.value}</Text>
                        <Text style={[styles.statLabelBig, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{st.label}</Text>
                        {st.hint ? (
                          <Text style={[styles.hint, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd, marginTop: 4 }]}>
                            {st.hint}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </DrawerRow>
                );
              }
              return (
                <DrawerRow
                  key={key}
                  title={dc.title}
                  subtitle={dc.subtitle}
                  open={!!open.privacy}
                  onToggle={() => toggle('privacy')}
                  leadingEmoji="🛡️"
                  blockBg={blockPalette.bg}
                  blockFg={blockPalette.fg}
                  blockFgMuted={blockPalette.muted}
                  blockBorder={blockPalette.border}
                  editMode={editMode}
                  canMoveUp={index > 0}
                  canMoveDown={index < visibleKeys.length - 1}
                  onMoveUp={() => moveDrawer(key, -1)}
                  onMoveDown={() => moveDrawer(key, 1)}
                  onRemove={() => removeDrawer(key)}
                >
                  <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{ap.privacyLead}</Text>
                  {ap.opsBullets.map((b, i) => (
                    <Text
                      key={`op_${i}`}
                      style={[styles.body, { color: blockPalette.fg, marginTop: i === 0 ? 10 : 6, textAlign: heTa, writingDirection: heWd }]}
                    >
                      • {b}
                    </Text>
                  ))}
                </DrawerRow>
              );
            })
        : drawerOrder
        .filter((key) => !hiddenDrawerKeys.includes(key))
        .map((key, index, visibleKeys) => {
          if (key === 'goal') {
            return (
              <DrawerRow
                key={key}
                title="מטרה ומה בתוך היחידה"
                subtitle="בשפה פשוטה"
                open={!!open.goal}
                onToggle={() => toggle('goal')}
                leadingEmoji="🎯"
                blockBg={blockPalette.bg}
                blockFg={blockPalette.fg}
                blockFgMuted={blockPalette.muted}
                blockBorder={blockPalette.border}
                editMode={editMode}
                canMoveUp={index > 0}
                canMoveDown={index < visibleKeys.length - 1}
                onMoveUp={() => moveDrawer(key, -1)}
                onMoveDown={() => moveDrawer(key, 1)}
                onRemove={() => removeDrawer(key)}
              >
                <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>{goalText}</Text>
                <Text
                  style={[styles.body, { color: blockPalette.muted, marginTop: 10, textAlign: heTa, writingDirection: heWd }]}
                >
                  בלוקים עוזרים ל-ONE לעקוב אחרי משימות, כסף, אנשים ולו״ז — בלי לאבד פרטים בשיחה.
                </Text>
              </DrawerRow>
            );
          }
          if (key === 'steps') {
            return (
              <DrawerRow
                key={key}
                title="צעדים ואבני דרך"
                subtitle={`${unitStepsDone}/${unit?.steps ?? '—'} הושלמו`}
                open={!!open.steps}
                onToggle={() => toggle('steps')}
                leadingEmoji="📋"
                blockBg={blockPalette.bg}
                blockFg={blockPalette.fg}
                blockFgMuted={blockPalette.muted}
                blockBorder={blockPalette.border}
                editMode={editMode}
                canMoveUp={index > 0}
                canMoveDown={index < visibleKeys.length - 1}
                onMoveUp={() => moveDrawer(key, -1)}
                onMoveDown={() => moveDrawer(key, 1)}
                onRemove={() => removeDrawer(key)}
              >
                {milestones.map((m) => (
                  <View key={m.id} style={styles.milestoneRow}>
                    <Text style={[styles.milestoneMark, { color: m.done ? '#22c55e' : blockPalette.muted }]}>{m.done ? '✓' : '○'}</Text>
                    <Text style={[styles.milestoneText, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
                      {m.title}
                    </Text>
                  </View>
                ))}
              </DrawerRow>
            );
          }
          if (key === 'time') {
            return (
              <DrawerRow
                key={key}
                title="זמן, מקום ותקציב"
                open={!!open.time}
                onToggle={() => toggle('time')}
                leadingEmoji="🗓️"
                blockBg={blockPalette.bg}
                blockFg={blockPalette.fg}
                blockFgMuted={blockPalette.muted}
                blockBorder={blockPalette.border}
                editMode={editMode}
                canMoveUp={index > 0}
                canMoveDown={index < visibleKeys.length - 1}
                onMoveUp={() => moveDrawer(key, -1)}
                onMoveDown={() => moveDrawer(key, 1)}
                onRemove={() => removeDrawer(key)}
              >
                <RowKV label="אזור" value={cityLabel} textAlign={heTa} writingDirection={heWd} fgMuted={blockPalette.muted} fg={blockPalette.fg} />
                <RowKV label="משך משוער" value={etaLabel} textAlign={heTa} writingDirection={heWd} fgMuted={blockPalette.muted} fg={blockPalette.fg} />
                <RowKV label="תקציב משוער" value={budgetLabel} textAlign={heTa} writingDirection={heWd} fgMuted={blockPalette.muted} fg={blockPalette.fg} />
                <Text style={[styles.hint, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
                  המספרים לדוגמה — בגרסה מלאה הם יגיעו מהשיחה או מהעדפות שלך.
                </Text>
              </DrawerRow>
            );
          }
          if (key === 'people') {
            return (
              <DrawerRow
                key={key}
                title="מי מעורב"
                subtitle={`${peopleCount} גורמים`}
                open={!!open.people}
                onToggle={() => toggle('people')}
                leadingEmoji="👥"
                blockBg={blockPalette.bg}
                blockFg={blockPalette.fg}
                blockFgMuted={blockPalette.muted}
                blockBorder={blockPalette.border}
                editMode={editMode}
                canMoveUp={index > 0}
                canMoveDown={index < visibleKeys.length - 1}
                onMoveUp={() => moveDrawer(key, -1)}
                onMoveDown={() => moveDrawer(key, 1)}
                onRemove={() => removeDrawer(key)}
              >
                {people.map((p) => (
                  <View key={p.id} style={styles.personRow}>
                    <View style={[styles.personDot, { backgroundColor: profileAccent }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personRole, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
                        {p.role}
                      </Text>
                      <Text style={[styles.personName, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
                        {p.name}
                      </Text>
                    </View>
                  </View>
                ))}
              </DrawerRow>
            );
          }
          return (
            <DrawerRow
              key={key}
              title="מסמכים ולו״ז"
              subtitle="מה בדרך כלל נדרש"
              open={!!open.docs}
              onToggle={() => toggle('docs')}
              leadingEmoji="📎"
              blockBg={blockPalette.bg}
              blockFg={blockPalette.fg}
              blockFgMuted={blockPalette.muted}
              blockBorder={blockPalette.border}
              editMode={editMode}
              canMoveUp={index > 0}
              canMoveDown={index < visibleKeys.length - 1}
              onMoveUp={() => moveDrawer(key, -1)}
              onMoveDown={() => moveDrawer(key, 1)}
              onRemove={() => removeDrawer(key)}
            >
              <Text style={[styles.body, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
                • מסמכים מזהים, צילום רפואי או אישור רופא (לפי סוג היחידה){'\n'}
                • תורים במשרד הרישוי / אצל ספק{'\n'}
                • קבלות והוצאות — לשמירת תקציב שקוף
              </Text>
            </DrawerRow>
          );
        })}

      <View style={[styles.nextCard, { backgroundColor: blockPalette.bg, borderColor: blockPalette.border }]}>
        <View style={styles.blockTitleRow}>
          <Text style={styles.blockTitleEmoji}>🚀</Text>
          <Text style={[styles.nextLabel, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
            {agentLang === 'he' ? 'מה הלאה' : "What's next"}
          </Text>
        </View>
        <Text style={[styles.nextBody, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
          {nextBodyText}
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: blockPalette.bg, borderColor: blockPalette.border }]}>
        <View style={styles.blockTitleRow}>
          <Text style={styles.blockTitleEmoji}>📝</Text>
          <Text style={[styles.summaryTitle, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
            {agentLang === 'he' ? 'סיכום' : 'Summary'}
          </Text>
        </View>
        <Text style={[styles.summaryBody, { color: blockPalette.muted, textAlign: heTa, writingDirection: heWd }]}>
          {summaryBodyText}
        </Text>
      </View>

      {onPressOpenUnits ? (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: blockPalette.bg, borderColor: blockPalette.border }]}
          onPress={onPressOpenUnits}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaLeadingEmoji}>⚙️</Text>
          <Text style={[styles.ctaText, { color: blockPalette.fg, textAlign: heTa, writingDirection: heWd }]}>
            {isAgentCard
              ? agentLang === 'he'
                ? 'מסך יחידות, משימות והרשאות'
                : 'Units, tasks & permissions'
              : agentLang === 'he'
                ? 'מסך יחידות מלא (משימות ואישורים)'
                : 'Full units screen (tasks & approvals)'}
          </Text>
          <Text style={[styles.ctaChev, { color: blockPalette.muted }]}>›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 8,
    gap: 8,
  },
  hero: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  ringWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusDot: { fontSize: 13 },
  statusMeta: { fontSize: 13, fontWeight: '600' },
  metricsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 10,
  },
  metricCol: { flex: 1, alignItems: 'center', gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  metricValue: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  metaFoot: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  editTitleInlineInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    writingDirection: 'rtl',
    textAlign: 'left',
    marginTop: 2,
    marginBottom: 2,
  },
  drawerWrap: { width: '100%' },
  drawerHead: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  drawerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    direction: 'ltr',
  },
  drawerEmoji: {
    fontSize: 22,
    lineHeight: 26,
    marginRight: 10,
  },
  drawerHeadText: { flex: 1, gap: 2, minWidth: 0, alignSelf: 'stretch' },
  drawerTitle: { fontSize: 15, fontWeight: '700' },
  drawerSubtitle: { fontSize: 12 },
  drawerChev: { fontSize: 15, fontWeight: '600', marginLeft: 6 },
  drawerInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginInlineStart: 8,
  },
  drawerInlineBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  drawerInlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  blockTitleEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  drawerBody: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { fontSize: 14, lineHeight: 21 },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    direction: 'ltr',
  },
  milestoneMark: { fontSize: 16, width: 22, textAlign: 'center', marginTop: 1 },
  milestoneText: { flex: 1, fontSize: 14, lineHeight: 20 },
  kvRow: { marginBottom: 10 },
  kvLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  kvValue: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 8, fontStyle: 'italic' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, direction: 'ltr' },
  personDot: { width: 8, height: 8, borderRadius: 4 },
  personRole: { fontSize: 12 },
  personName: { fontSize: 15, fontWeight: '600' },
  nextCard: {
    width: '100%',
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nextLabel: { fontSize: 12, fontWeight: '700' },
  nextBody: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  summaryCard: {
    width: '100%',
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryBody: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  ctaLeadingEmoji: { fontSize: 18, lineHeight: 22 },
  ctaText: { flex: 1, fontSize: 15, fontWeight: '600' },
  ctaChev: { fontSize: 22, fontWeight: '300' },
  worldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
    direction: 'ltr',
  },
  worldDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  worldTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  activePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activePillText: { fontSize: 11, fontWeight: '700' },
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    direction: 'ltr',
  },
  permMark: { fontSize: 16, width: 22, textAlign: 'center', marginTop: 2, fontWeight: '700' },
  statBlock: { marginBottom: 14 },
  statValueBig: { fontSize: 22, fontWeight: '800' },
  statLabelBig: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
