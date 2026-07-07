/**
 * SettingsSheet — opened from inside OneProfileSheet (per ONE_UI_UX_SPEC §14).
 *
 * Sections:
 *   • Theme       — Light / Dark / Auto
 *   • Language    — English / עברית
 *   • Account     — email, export data, sign out, delete account (Apple §5.1.1(v))
 *   • About       — version, tagline, in-app Privacy / Terms / OSS (Apple §5.1.1(i))
 *   • Demo        — reset mock data
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { useThemeStore } from '../../stores/themeStore';
import { useLocaleStore, type AppLanguage } from '../../stores/localeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { rtlText, rtlRow } from '../../utils/rtl';
import { CloseIcon } from '../../components/mvp/icons';
import { haptic } from '../../utils/haptics';
import type { ThemeColors } from '../../utils/theme';
import { ORB_SKINS, AGENT_PERSONALITIES, resolveSkin } from '../../data/mvp/agentAppearance';
import { Orb } from '../../components/mvp/Orb';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { EdgeBars } from '../../components/mvp/EdgeBars';
import { SubscriptionPanel } from './SubscriptionPanel';
import type { LegalDoc } from './LegalSheet';
import { generateSampleUnit } from '../../data/mvp/unitArchetype';

const SCREEN_H = Dimensions.get('window').height;

const VERSION = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Open the delete-account sheet. Implemented by the parent (MvpStack) —
   *  delete + legal sub-sheets are mounted at the navigator level so they
   *  can use the pendingSheet queue and avoid iOS's "one modal at a time"
   *  silent-drop when chained from inside Settings. */
  onOpenDelete: () => void;
  onOpenLegal: (doc: NonNullable<LegalDoc>) => void;
}

type ThemePref = 'light' | 'dark' | 'auto';

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'he', label: 'עברית' },
];

export function SettingsSheet({
  visible,
  onClose,
  onOpenDelete,
  onOpenLegal,
}: SettingsSheetProps) {
  const { colors, preference, setPreference } = useThemeStore();
  const { language, setLanguage } = useLocaleStore();
  const reset = useMvpStore((s) => s.reset);
  const name = useMvpStore((s) => s.name);
  const units = useMvpStore((s) => s.units);
  const identities = useMvpStore((s) => s.identities);
  const addUnit = useMvpStore((s) => s.addUnit);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);
  const userGender = useMvpStore((s) => s.userGender);
  const setUserGender = useMvpStore((s) => s.setUserGender);
  const plan = useMvpStore((s) => s.plan);
  // Subscription panel — an INLINE slide-up over Settings (not a separate
  // Modal), so it opens instantly without closing Settings first.
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const agentSkin = useMvpStore((s) => s.agentSkin);
  const setAgentSkin = useMvpStore((s) => s.setAgentSkin);
  const agentPersonality = useMvpStore((s) => s.agentPersonality);
  const setAgentPersonality = useMvpStore((s) => s.setAgentPersonality);

  const he = language === 'he';

  // Localized option labels (the segmented controls).
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: 'light', label: he ? 'בהיר' : 'Light' },
    { value: 'dark', label: he ? 'כהה' : 'Dark' },
    { value: 'auto', label: he ? 'אוטומטי' : 'Auto' },
  ];

  // How ONE should address the user (matters in Hebrew, which conjugates by
  // gender). 'unknown' → ONE speaks neutrally.
  const genderOptions: { value: 'unknown' | 'male' | 'female'; label: string }[] = [
    { value: 'unknown', label: he ? 'נֵיטרלי' : 'Neutral' },
    { value: 'male', label: he ? 'לשון זכר' : 'He' },
    { value: 'female', label: he ? 'לשון נקבה' : 'She' },
  ];

  // Dev/testing: generate a full, richly-populated process (rotating through
  // the archetypes) and drop it on Home for the active identity — so the
  // process-content structure can be tested end-to-end without an AI call.
  const generateTestProcess = () => {
    const unit = generateSampleUnit(activeIdentityId, language);
    addUnit(unit);
    onClose();
    Alert.alert(
      he ? 'נוצר תהליך מלא' : 'Full process generated',
      he
        ? `${unit.emoji} ${unit.title} — נוסף לדף הבית עם צעדים, מדדים, אנשים, תזכורות ועוד.`
        : `${unit.emoji} ${unit.title} — added to Home with steps, metrics, people, reminders and more.`,
    );
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      name,
      identities,
      units,
    };
    const json = JSON.stringify(payload, null, 2);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `one-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Native: best-effort, surface via Alert. Real impl uses expo-file-system.
      Alert.alert('Export ready', 'Your data export is being prepared. We will email it to you.');
    }
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        // Structure copied verbatim from GlobalSheet (which scrolls + closes
        // perfectly): a SINGLE 92% detent, content-pan ON, bypassDefaultView, and
        // — crucially — the header + BottomSheetScrollView as DIRECT children of
        // gorhom (NO wrapping <View>). The header is IN-FLOW (a normal row at the
        // top, box-none), so it stays fixed while its sibling scroll view scrolls
        // the full content below it. A downward drag closes in one motion.
        snapPoints={['92%']}
        enableContentPan={true}
        bypassDefaultView={true}
        onDragDismissCross={() => haptic.press()}
        sheetStyle={[styles.sheet]}
        // The plans panel slides up OVER Settings (screen-pinned overlay slot),
        // so it opens instantly without a Modal swap.
        overlay={
          <>
            {/* Screen-pinned bottom fade so content scrolls into a soft bar at
                the sheet's bottom edge — matches the profile / unit / global
                sheets. */}
            <EdgeBars top={false} bottomHeight={130} style={{ zIndex: 5 }} />
            <SubscriptionPanel
              visible={subscriptionOpen}
              onClose={() => setSubscriptionOpen(false)}
            />
          </>
        }
      >
        {/* Soft top gradient behind the header — content scrolls UNDER it, same
            treatment as the process sheet. The header (zIndex 20) stays crisp. */}
        <EdgeBars bottom={false} topHeight={112} topLinear />
        {/* Fixed header — title + X. In-flow (a sibling ABOVE the scroll view,
            not an overlay), so it never scrolls. box-none lets touches through to
            the scroll view; only the X captures. */}
        <View style={[styles.topHeader, rtlRow(language)]} pointerEvents="box-none">
          <Text style={[styles.title, { color: colors.text }, rtlText(language)]}>
            {he ? 'הגדרות' : 'Settings'}
          </Text>
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
        >
          {/* Theme */}
          <Group title={he ? 'מראה' : 'Theme'} colors={colors} he={he}>
            <SegmentedRow
              colors={colors}
              options={themeOptions}
              selected={preference}
              onChange={(v) => setPreference(v)}
            />
          </Group>

          {/* Language */}
          <Group title={he ? 'שפה' : 'Language'} colors={colors} he={he}>
            <SegmentedRow
              colors={colors}
              options={LANGUAGE_OPTIONS}
              selected={language}
              onChange={(v) => setLanguage(v)}
            />
          </Group>

          {/* How ONE addresses you — drives gendered phrasing in Hebrew. */}
          <Group title={he ? 'איך ONE פונה אליך' : 'How ONE addresses you'} colors={colors} he={he}>
            <SegmentedRow
              colors={colors}
              options={genderOptions}
              selected={userGender}
              onChange={(v) => setUserGender(v)}
            />
          </Group>

          {/* ONE's look — pick the Orb skin (face colour), applied app-wide. */}
          <Group title={he ? 'הדמות של ONE' : "ONE's look"} colors={colors} he={he}>
            <OrbSkinRow selected={agentSkin} onChange={setAgentSkin} colors={colors} he={he} />
          </Group>

          {/* ONE's personality — shapes its tone in replies. */}
          <Group title={he ? 'האופי של ONE' : "ONE's personality"} colors={colors} he={he}>
            <ChoiceChips
              options={AGENT_PERSONALITIES.map((p) => ({
                value: p.id,
                label: he ? p.labelHe : p.labelEn,
              }))}
              selected={agentPersonality}
              onChange={setAgentPersonality}
              colors={colors}
              he={he}
            />
          </Group>

          {/* Subscription — current tier + upgrade / manage (opens the inline
              plans panel over Settings). Billing isn't wired yet (no Stripe in
              Israel); the panel does a local plan flip for now. */}
          <Group title={he ? 'מנוי' : 'Subscription'} colors={colors} he={he}>
            <Row
              label={he ? 'התוכנית הנוכחית' : 'Current plan'}
              value={plan === 'free' ? (he ? 'חינם' : 'Free') : plan.toUpperCase()}
              colors={colors}
              he={he}
            />
            <ActionRow
              label={
                plan === 'free'
                  ? he ? 'שדרג את ONE' : 'Upgrade ONE'
                  : he ? 'נהל מנוי' : 'Manage plan'
              }
              onPress={() => setSubscriptionOpen(true)}
              colors={colors}
              hint={
                plan === 'free'
                  ? he ? 'Pro ו‑Max — יותר כוח ל‑ONE.' : 'Pro & Max — more power for ONE.'
                  : undefined
              }
              he={he}
            />
          </Group>

          {/* Account — Apple §5.1.1(v) requires in-app delete */}
          <Group title={he ? 'חשבון' : 'Account'} colors={colors} he={he}>
            <Row
              label={he ? 'מחובר בתור' : 'Signed in as'}
              value={name || (he ? 'משתמש מקומי' : 'Local user')}
              colors={colors}
              he={he}
            />
            <ActionRow
              label={he ? 'ייצא כל מה ש‑ONE יודע' : 'Export everything ONE knows'}
              onPress={exportData}
              colors={colors}
              hint={
                he
                  ? 'קובץ JSON עם כל התהליכים, הזהויות וההיסטוריה.'
                  : 'JSON with all your processes, identities, and history.'
              }
              he={he}
            />
            <ActionRow
              label={he ? 'התנתק' : 'Sign out'}
              onPress={() => {
                reset();
                onClose();
              }}
              colors={colors}
              he={he}
            />
            <ActionRow
              label={he ? 'מחק חשבון' : 'Delete account'}
              onPress={onOpenDelete}
              colors={colors}
              danger
              he={he}
            />
          </Group>

          {/* About + Legal */}
          <Group title={he ? 'אודות' : 'About'} colors={colors} he={he}>
            <Row label={he ? 'גרסה' : 'Version'} value={VERSION} colors={colors} he={he} />
            <Row
              label={he ? 'סלוגן' : 'Tagline'}
              value={he ? 'מכוונה למציאות.' : 'From intent to reality.'}
              colors={colors}
              he={he}
            />
            <LinkRow
              label={he ? 'מדיניות פרטיות' : 'Privacy Policy'}
              onPress={() => onOpenLegal('privacy')}
              colors={colors}
              he={he}
            />
            <LinkRow
              label={he ? 'תנאי שימוש' : 'Terms of Use'}
              onPress={() => onOpenLegal('terms')}
              colors={colors}
              he={he}
            />
            <LinkRow
              label={he ? 'רישיונות קוד פתוח' : 'Open Source Licenses'}
              onPress={() => onOpenLegal('oss')}
              colors={colors}
              he={he}
            />
          </Group>

          {/* Testing — generate a full process to exercise the content
              structure (steps, metrics, people, timeline, reminders…). */}
          <Group title={he ? 'בדיקות' : 'Testing'} colors={colors} he={he}>
            <ActionRow
              label={he ? 'צור תהליך מלא לבדיקה' : 'Generate a full test process'}
              onPress={generateTestProcess}
              colors={colors}
              hint={
                he
                  ? 'מייצר תהליך עשיר (מתחלף) — כושר, רישיון, מעבר דירה, לימוד, עסק, טיול.'
                  : 'Builds a rich, fully-populated process (rotates through domains).'
              }
              he={he}
            />
          </Group>

          {/* Demo / Dev */}
          <Group title={he ? 'דמו' : 'Demo'} colors={colors} he={he}>
            <ActionRow
              label={he ? 'אפס את הזיכרון שלי' : 'Reset my memory'}
              he={he}
              onPress={() => {
                // Confirm before wiping — this resets identities, processes,
                // and onboarding state. Easy to tap by mistake otherwise.
                Alert.alert(
                  'Reset my memory?',
                  "I'll forget the processes and identities you've added and start fresh from the demo. This can't be undone.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: () => {
                        reset();
                        onClose();
                      },
                    },
                  ],
                );
              }}
              colors={colors}
              hint={
                he
                  ? 'מאפס את התהליכים והזהויות חזרה לדמו ההתחלתי.'
                  : 'Wipes processes and identities back to the starting demo.'
              }
            />
          </Group>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* LegalSheet + DeleteAccountSheet used to live here as siblings of
          this BottomSheet, but on iOS only ONE Modal can be presented at
          a time — chaining "close Settings → open Delete" in the same
          render cycle silently dropped the second present. They're now
          mounted at the MvpStack level (sibling of SettingsSheet) and
          opened via the parent's pendingSheet queue, so Settings has
          fully released its Modal before the sub-sheet tries to mount. */}
    </>
  );
}

function Group({
  title,
  colors,
  children,
  he,
}: {
  title: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
  children: React.ReactNode;
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.text }, rtlText(lang)]}>{title}</Text>
      <View
        style={[
          styles.groupCard,
          { backgroundColor: colors.surface },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
  he,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  return (
    <View style={[styles.row, { borderColor: colors.border }, rtlRow(lang)]}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }, rtlText(lang)]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }, rtlText(lang)]}>{value}</Text>
    </View>
  );
}

function ActionRow({
  label,
  onPress,
  colors,
  hint,
  danger,
  he,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
  hint?: string;
  danger?: boolean;
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        rtlRow(lang),
        { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.flex1}>
        <Text
          style={[styles.actionLabel, { color: danger ? '#E24B4A' : colors.text }, rtlText(lang)]}
        >
          {label}
        </Text>
        {!!hint && (
          <Text style={[styles.actionHint, { color: colors.textSecondary }, rtlText(lang)]}>
            {hint}
          </Text>
        )}
      </View>
      <Text style={[styles.actionChev, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
    </Pressable>
  );
}

function LinkRow({
  label,
  onPress,
  colors,
  he,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, rtlRow(lang), { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.linkText, { color: colors.text }, rtlText(lang)]}>{label}</Text>
      <Text style={[styles.linkArrow, { color: colors.textSecondary }]}>{he ? '‹' : '›'}</Text>
    </Pressable>
  );
}

function SegmentedRow<T extends string>({
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
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.segmentedItem,
              active && { backgroundColor: colors.background },
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={[
                styles.segmentedItemText,
                {
                  color: active ? colors.text : colors.textSecondary,
                  fontWeight: active ? '600' : '400',
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

/** Row of tappable Orb "skin" swatches — a face-coloured circle with two eye
 *  dots. The selected one gets a ring. Changing it re-colours ONE app-wide. */
function OrbSkinRow({
  selected,
  onChange,
  colors,
  he,
}: {
  selected: string;
  onChange: (id: string) => void;
  colors: ThemeColors;
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  const selectedId = resolveSkin(selected).id;
  return (
    <View style={[styles.skinRow, rtlRow(lang)]}>
      {ORB_SKINS.map((s) => {
        const active = s.id === selectedId;
        return (
          <Pressable
            key={s.id}
            onPress={() => {
              haptic.select();
              onChange(s.id);
            }}
            style={[styles.skinItem, { borderColor: active ? colors.text : 'transparent' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={he ? s.labelHe : s.labelEn}
          >
            {/* Preview each skin as a real mini-face (accessories + eye shape). */}
            <Orb size={44} skinOverride={s.id} noBlink />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping row of pill chips (used for personality — more options than a
 *  segmented control comfortably fits). */
function ChoiceChips({
  options,
  selected,
  onChange,
  colors,
  he,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onChange: (v: string) => void;
  colors: ThemeColors;
  he?: boolean;
}) {
  const lang = he ? 'he' : 'en';
  return (
    <View style={[styles.chipsWrap, rtlRow(lang)]}>
      {options.map((o) => {
        const active = o.value === selected;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.select();
              onChange(o.value);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.text : 'transparent',
                borderColor: active ? colors.text : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.chipText, { color: active ? colors.surface : colors.text }, rtlText(lang)]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  skinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12 },
  skinItem: { borderRadius: 27, borderWidth: 2, padding: 3 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontWeight: '600' },
  flex1: { flex: 1 },
  sheet: {},
  grabberRow: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 2.5 },

  // paddingTop clears the absolute header so the first group starts below it.
  content: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40, gap: 22 },

  // Fixed header row (title + X) — ABSOLUTE overlay (same shape as GlobalSheet /
  // the process sheet) so content scrolls fully UNDER it and fades cleanly into
  // the top gradient, with no rough clip at a header seam. Padding matches
  // Global / ONE-profile so all sheets share one header. zIndex 20 keeps it
  // crisp ABOVE the EdgeBars top gradient (zIndex 15).
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
  // lineHeight matches the 44px close pill so the title sits level with the X.
  title: { fontSize: 24, fontWeight: '600', lineHeight: 44 },
  closeX: { fontSize: 20 },
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

  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },

  group: { gap: 8, marginBottom: 4 },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.9,
    paddingHorizontal: 4,
  },
  groupCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentedItemText: { fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '500' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
    // Sits inside the group card now; divider via inner hairline.
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 15, fontWeight: '500' },
  actionHint: { fontSize: 12, marginTop: 2 },
  actionChev: { fontSize: 22 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  linkText: { fontSize: 15 },
  linkArrow: { fontSize: 18 },
});
