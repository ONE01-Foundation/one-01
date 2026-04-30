/**
 * פרופיל יחידה בתוך צ'אט ONE — מגירות (אקורדיון), מטריקות ותוכן מוכן לקהל רחב.
 */
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

type ThemeColors = {
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
};

/** בלוקים בפרופיל יחידה — רקע שחור מלא, ללא מסגרת; טקסט בהיר */
const UNIT_PROFILE_BLOCK_BG = '#000000';
const ON_BLOCK_TEXT = '#f4f4f5';
const ON_BLOCK_TEXT_MUTED = '#a1a1aa';

type UnitChatProfileProps = {
  visible: boolean;
  unit: UnitChatProfileModel | null;
  chatAgentStatus: string;
  colors: ThemeColors;
  isDark: boolean;
  profileAccent: string;
  profileRingR: number;
  profileRingC: number;
  unitProgressPct: number;
  unitStepsDone: number;
  centerContent: ReactNode;
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
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  /** אימוג׳י קטן שמתאים לתוכן המגירה */
  leadingEmoji: string;
  children: ReactNode;
}) {
  /** שורת מגירה: תמיד LTR פיזית (אימוג׳י משמאל, צ׳ברון מימין) — כמו במעטפת שפה אנגלית; הטקסט בעברית עם bidi RTL */
  return (
    <View style={styles.drawerWrap}>
      <TouchableOpacity
        style={styles.drawerHead}
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
                  color: ON_BLOCK_TEXT,
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
                    color: ON_BLOCK_TEXT_MUTED,
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
          <Text style={[styles.drawerChev, { color: ON_BLOCK_TEXT_MUTED }]}>{open ? '⌃' : '⌄'}</Text>
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.drawerBody}>{children}</View> : null}
    </View>
  );
}

export function UnitChatProfile({
  visible,
  unit,
  chatAgentStatus,
  colors,
  isDark,
  profileAccent,
  profileRingR,
  profileRingC,
  unitProgressPct,
  unitStepsDone,
  centerContent,
  onPressOpenUnits,
}: UnitChatProfileProps) {
  const language = useLocaleStore((s) => s.language);
  /** טקסט עברי בקלף: RTL לוגי, אבל שורות flex ב־LTR — נמנע כפל RTL (מערכת + אפליקציה) שמבלבל מגירות */
  const heTa: 'left' = 'left';
  const heWd: 'rtl' | 'ltr' = 'rtl';
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) setOpen({});
  }, [visible]);

  const toggle = useCallback((key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const statusLabel = !unit ? 'מוכן' : unit.status === 'waiting' ? 'ממתין' : unit.status === 'done' ? 'הושלם' : 'פעיל';

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
        <Text style={[styles.title, { color: colors.text, writingDirection: unit ? heWd : 'ltr' }]}>
          {unit ? embedLatinRunsForRtlDisplay(unit.title, language) : 'ONE'}
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textSecondary, writingDirection: heWd }]}
          numberOfLines={2}
        >
          {unit ? unit.subtitle : 'המנהל האישי שלך לתהליכים'}
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
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>זמן משוער</Text>
          <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]}>{etaLabel}</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>תקציב</Text>
          <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]} numberOfLines={2}>
            {budgetLabel}
          </Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, writingDirection: heWd }]}>מעורבים</Text>
          <Text style={[styles.metricValue, { color: colors.text, writingDirection: heWd }]}>
            {unit ? `${peopleCount}` : '1'}
          </Text>
        </View>
      </View>

        <Text style={[styles.metaFoot, { color: colors.textSecondary, writingDirection: heWd }]}>
        {updatedLabel} · {blocksCount} בלוקים במוצר (תיאור, משימות, התקדמות…)
      </Text>

      <DrawerRow
        title="מטרה ומה בתוך היחידה"
        subtitle="בשפה פשוטה"
        open={!!open.goal}
        onToggle={() => toggle('goal')}
        leadingEmoji="🎯"
      >
        <Text style={[styles.body, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>{goalText}</Text>
        <Text
          style={[styles.body, { color: ON_BLOCK_TEXT_MUTED, marginTop: 10, textAlign: heTa, writingDirection: heWd }]}
        >
          בלוקים עוזרים ל-ONE לעקוב אחרי משימות, כסף, אנשים ולו״ז — בלי לאבד פרטים בשיחה.
        </Text>
      </DrawerRow>

      <DrawerRow
        title="צעדים ואבני דרך"
        subtitle={`${unitStepsDone}/${unit?.steps ?? '—'} הושלמו`}
        open={!!open.steps}
        onToggle={() => toggle('steps')}
        leadingEmoji="📋"
      >
        {milestones.map((m) => (
          <View key={m.id} style={styles.milestoneRow}>
            <Text style={[styles.milestoneMark, { color: m.done ? '#22c55e' : ON_BLOCK_TEXT_MUTED }]}>{m.done ? '✓' : '○'}</Text>
            <Text style={[styles.milestoneText, { color: ON_BLOCK_TEXT, textAlign: heTa, writingDirection: heWd }]}>
              {m.title}
            </Text>
          </View>
        ))}
      </DrawerRow>

      <DrawerRow
        title="זמן, מקום ותקציב"
        open={!!open.time}
        onToggle={() => toggle('time')}
        leadingEmoji="🗓️"
      >
        <RowKV label="אזור" value={cityLabel} textAlign={heTa} writingDirection={heWd} />
        <RowKV label="משך משוער" value={etaLabel} textAlign={heTa} writingDirection={heWd} />
        <RowKV label="תקציב משוער" value={budgetLabel} textAlign={heTa} writingDirection={heWd} />
        <Text style={[styles.hint, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>
          המספרים לדוגמה — בגרסה מלאה הם יגיעו מהשיחה או מהעדפות שלך.
        </Text>
      </DrawerRow>

      <DrawerRow
        title="מי מעורב"
        subtitle={`${peopleCount} גורמים`}
        open={!!open.people}
        onToggle={() => toggle('people')}
        leadingEmoji="👥"
      >
        {people.map((p) => (
          <View key={p.id} style={styles.personRow}>
            <View style={[styles.personDot, { backgroundColor: profileAccent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.personRole, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>
                {p.role}
              </Text>
              <Text style={[styles.personName, { color: ON_BLOCK_TEXT, textAlign: heTa, writingDirection: heWd }]}>
                {p.name}
              </Text>
            </View>
          </View>
        ))}
      </DrawerRow>

      <DrawerRow
        title="מסמכים ולו״ז"
        subtitle="מה בדרך כלל נדרש"
        open={!!open.docs}
        onToggle={() => toggle('docs')}
        leadingEmoji="📎"
      >
        <Text style={[styles.body, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>
          • מסמכים מזהים, צילום רפואי או אישור רופא (לפי סוג היחידה){'\n'}
          • תורים במשרד הרישוי / אצל ספק{'\n'}
          • קבלות והוצאות — לשמירת תקציב שקוף
        </Text>
      </DrawerRow>

      <View style={styles.nextCard}>
        <View style={styles.blockTitleRow}>
          <Text style={styles.blockTitleEmoji}>🚀</Text>
          <Text style={[styles.nextLabel, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>
            מה הלאה
          </Text>
        </View>
        <Text style={[styles.nextBody, { color: ON_BLOCK_TEXT, textAlign: heTa, writingDirection: heWd }]}>
          {unit?.nextAction ?? (unit ? 'שלחו בצ׳אט מה הצעד הבא — ONE יעדכן את הרשימה.' : 'בחרו יחידה או תארו מטרה בשורת «עכשיו?» כדי לפתוח יחידה חדשה.')}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.blockTitleRow}>
          <Text style={styles.blockTitleEmoji}>📝</Text>
          <Text style={[styles.summaryTitle, { color: ON_BLOCK_TEXT, textAlign: heTa, writingDirection: heWd }]}>
            סיכום
          </Text>
        </View>
        <Text style={[styles.summaryBody, { color: ON_BLOCK_TEXT_MUTED, textAlign: heTa, writingDirection: heWd }]}>
          {summaryText}
        </Text>
      </View>

      {onPressOpenUnits ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={onPressOpenUnits}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaLeadingEmoji}>⚙️</Text>
          <Text style={[styles.ctaText, { color: ON_BLOCK_TEXT, textAlign: heTa, writingDirection: heWd }]}>
            מסך יחידות מלא (משימות ואישורים)
          </Text>
          <Text style={[styles.ctaChev, { color: ON_BLOCK_TEXT_MUTED }]}>›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RowKV({
  label,
  value,
  textAlign,
  writingDirection,
}: {
  label: string;
  value: string;
  textAlign: 'left' | 'right';
  writingDirection: 'rtl' | 'ltr';
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: ON_BLOCK_TEXT_MUTED, textAlign, writingDirection }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: ON_BLOCK_TEXT, textAlign, writingDirection }]}>{value}</Text>
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
  drawerWrap: { width: '100%' },
  drawerHead: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: UNIT_PROFILE_BLOCK_BG,
    borderWidth: 0,
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
    backgroundColor: UNIT_PROFILE_BLOCK_BG,
    borderWidth: 0,
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
    backgroundColor: UNIT_PROFILE_BLOCK_BG,
    borderWidth: 0,
  },
  nextLabel: { fontSize: 12, fontWeight: '700' },
  nextBody: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  summaryCard: {
    width: '100%',
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: UNIT_PROFILE_BLOCK_BG,
    borderWidth: 0,
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
    backgroundColor: UNIT_PROFILE_BLOCK_BG,
    borderWidth: 0,
    gap: 8,
  },
  ctaLeadingEmoji: { fontSize: 18, lineHeight: 22 },
  ctaText: { flex: 1, fontSize: 15, fontWeight: '600' },
  ctaChev: { fontSize: 22, fontWeight: '300' },
});
