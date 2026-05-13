/**
 * הגדרות — מוד בהיר/כהה ושפה. כיוון הממשק נגזר אוטומטית מהשפה (עברית RTL / אנגלית LTR).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { useDevModeStore, type DevPreviewProfile } from '../stores/devModeStore';
import { useOnboardingDraftStore } from '../stores/onboardingDraftStore';
import { useOnboardingPresentationStore } from '../stores/onboardingPresentationStore';
import { useOne } from '../core/OneContext';
import { supabaseService } from '../services/supabaseService';
import { translate } from '../i18n/strings';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Settings'>;

const DEV_PROFILE_CHOICES: { id: DevPreviewProfile; he: string; en: string }[] = [
  { id: 'new_user', he: 'משתמש חדש', en: 'New User' },
  { id: 'consumer', he: 'צרכן', en: 'Consumer' },
  { id: 'student', he: 'תלמיד', en: 'Student' },
  { id: 'creator', he: 'יצרן', en: 'Creator' },
  { id: 'teacher_business', he: 'מורה/עסק', en: 'Teacher/Business' },
  { id: 'pro_user', he: 'משתמש פרו', en: 'Pro User' },
  { id: 'max_user', he: 'משתמש מקס', en: 'Max User' },
];

function ChoiceChip({
  label,
  selected,
  onPress,
  colors,
  textAlign,
  writingDirection,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: { text: string; border: string; primary: string; surface: string };
  textAlign: 'left' | 'right';
  writingDirection: 'rtl' | 'ltr';
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? `${colors.primary}18` : colors.surface,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.primary : colors.text, textAlign, writingDirection }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { colors, theme, preference, setPreference } = useThemeStore();
  const { language, layoutDirection, setLanguage } = useLocaleStore();
  const { previewProfile, setPreviewProfile, showAllWorldsExamples, setShowAllWorldsExamples, requestSyntheticHomeProfile } =
    useDevModeStore();
  const { clearUser } = useOne();
  const resetOnboardingDraft = useOnboardingDraftStore((s) => s.reset);
  const presentationVariant = useOnboardingPresentationStore((s) => s.variant);
  const setPresentationVariant = useOnboardingPresentationStore((s) => s.setVariant);
  const isRtl = layoutDirection === 'rtl';
  const ta: 'left' | 'right' = isRtl ? 'right' : 'left';
  const wd: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';

  const runRestartOnboardingFromScratch = useCallback(async () => {
    resetOnboardingDraft();
    try {
      supabaseService.initialize();
      await supabaseService.signOut();
    } catch {
      /* ignore */
    }
    await clearUser();
  }, [clearUser, resetOnboardingDraft]);

  const confirmRestartOnboardingFromScratch = useCallback(() => {
    const title = language === 'he' ? 'איפוס חשבון' : 'Reset account';
    const message =
      language === 'he'
        ? 'נמחק המשתמש המקומי ותחזרו לזרימת יצירת ONE מההתחלה. לא מנתקים סשן Supabase אוטומטית.'
        : 'Clears local ONE data and returns you to onboarding. Does not sign out Supabase remotely.';

    if (Platform.OS === 'web') {
      const ok =
        typeof globalThis !== 'undefined' &&
        typeof (globalThis as unknown as { confirm?: (msg: string) => boolean }).confirm === 'function'
          ? (globalThis as unknown as Window).confirm(`${title}\n\n${message}`)
          : true;
      if (ok) void runRestartOnboardingFromScratch();
      return;
    }

    Alert.alert(title, message, [
      { text: language === 'he' ? 'ביטול' : 'Cancel', style: 'cancel' },
      {
        text: language === 'he' ? 'איפוס' : 'Reset',
        style: 'destructive',
        onPress: () => void runRestartOnboardingFromScratch(),
      },
    ]);
  }, [language, runRestartOnboardingFromScratch]);
  /** שורת כותרת מודאלית: תמיד LTR פיזית — חץ חזרה משמאל, בלי התנגשות עם RTL מערכתי + direction באפליקציה */
  const backGlyph = '‹';
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, direction: isRtl ? 'rtl' : 'ltr' }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, direction: 'ltr' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backGlyph, { color: colors.primary }]}>{backGlyph}</Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            {
              color: colors.text,
              writingDirection: wd,
              textAlign: 'center',
              alignSelf: 'stretch',
              width: '100%',
            },
          ]}
        >
          {t('settings_title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingBottom: insets.bottom + 24,
            direction: isRtl ? 'rtl' : 'ltr',
            alignItems: 'stretch',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.sectionLabel,
            styles.blockText,
            { color: colors.textSecondary, textAlign: ta, writingDirection: wd },
          ]}
        >
          {t('settings_appearance')}
        </Text>
        <View style={styles.chipRow}>
          <ChoiceChip
            label={t('settings_theme_auto')}
            selected={preference === 'auto'}
            onPress={() => setPreference('auto')}
            colors={colors}
            textAlign={ta}
            writingDirection={wd}
          />
          <ChoiceChip
            label={t('settings_theme_light')}
            selected={preference === 'light'}
            onPress={() => setPreference('light')}
            colors={colors}
            textAlign={ta}
            writingDirection={wd}
          />
          <ChoiceChip
            label={t('settings_theme_dark')}
            selected={preference === 'dark'}
            onPress={() => setPreference('dark')}
            colors={colors}
            textAlign={ta}
            writingDirection={wd}
          />
        </View>
        <Text style={[styles.meta, styles.blockText, { color: colors.textSecondary, textAlign: ta, writingDirection: wd }]}>
          {preference === 'auto'
            ? language === 'he'
              ? `מצב נוכחי לפי שעה: ${theme === 'dark' ? 'כהה' : 'בהיר'}`
              : `Current by time: ${theme}`
            : null}
        </Text>

        <Text
          style={[
            styles.sectionLabel,
            styles.blockText,
            { color: colors.textSecondary, marginTop: 22, textAlign: ta, writingDirection: wd },
          ]}
        >
          {t('settings_language')}
        </Text>
        <View style={styles.chipRow}>
          <ChoiceChip
            label={t('settings_lang_he')}
            selected={language === 'he'}
            onPress={() => setLanguage('he')}
            colors={colors}
            textAlign={ta}
            writingDirection={wd}
          />
          <ChoiceChip
            label={t('settings_lang_en')}
            selected={language === 'en'}
            onPress={() => setLanguage('en')}
            colors={colors}
            textAlign={ta}
            writingDirection={wd}
          />
        </View>

        <Text style={[styles.hint, styles.blockText, { color: colors.textSecondary, marginTop: 10, textAlign: ta, writingDirection: wd }]}>
          {t('settings_language_hint')}
        </Text>

        <Text
          style={[
            styles.sectionLabel,
            styles.blockText,
            { color: colors.textSecondary, marginTop: 22, textAlign: ta, writingDirection: wd },
          ]}
        >
          {t('settings_onboarding_experience')}
        </Text>
        <View style={[styles.settingRow, { borderColor: colors.border }]}>
          <Text
            style={[styles.settingRowLabel, { color: colors.text, textAlign: ta, writingDirection: wd }]}
            accessibilityRole="text"
          >
            {t('settings_onboarding_composer_toggle')}
          </Text>
          <Switch
            value={presentationVariant === 'composer'}
            onValueChange={(on) => void setPresentationVariant(on ? 'composer' : 'classic')}
            trackColor={{ false: colors.border, true: `${colors.primary}55` }}
            thumbColor={presentationVariant === 'composer' ? colors.primary : colors.surface}
            ios_backgroundColor={colors.border}
            accessibilityLabel={t('settings_onboarding_composer_toggle')}
          />
        </View>
        <Text style={[styles.hint, styles.blockText, { color: colors.textSecondary, marginTop: 10, textAlign: ta, writingDirection: wd }]}>
          {t('settings_onboarding_composer_hint')}
        </Text>

        <Text
          style={[
            styles.sectionLabel,
            styles.blockText,
            { color: colors.textSecondary, marginTop: 22, textAlign: ta, writingDirection: wd },
          ]}
        >
          {language === 'he' ? 'מצב פיתוח - תצוגת משתמש' : 'Dev Mode - User Preview'}
        </Text>
        <View style={styles.chipRow}>
          {DEV_PROFILE_CHOICES.map((row) => (
            <ChoiceChip
              key={row.id}
              label={language === 'he' ? row.he : row.en}
              selected={previewProfile === row.id}
              onPress={() => setPreviewProfile(row.id)}
              colors={colors}
              textAlign={ta}
              writingDirection={wd}
            />
          ))}
        </View>
        <Text style={[styles.hint, styles.blockText, { color: colors.textSecondary, marginTop: 10, textAlign: ta, writingDirection: wd }]}>
          {language === 'he'
            ? 'להחליף במהירות בין מצבי משתמש כדי לבדוק מסכים, כדורים, פרופיל ותג מסלול.'
            : 'Quickly switch user states to validate orbs, profile cards, and plan badge behavior.'}
        </Text>

        <View style={[styles.settingRow, { borderColor: colors.border, marginTop: 14 }]}>
          <Text style={[styles.settingRowLabel, { color: colors.text, textAlign: ta, writingDirection: wd }]}>
            {language === 'he' ? 'כל העולמות עם דוגמאות' : 'All worlds with examples'}
          </Text>
          <Switch
            value={showAllWorldsExamples}
            onValueChange={(on) => void setShowAllWorldsExamples(on)}
            trackColor={{ false: colors.border, true: `${colors.primary}55` }}
            thumbColor={showAllWorldsExamples ? colors.primary : colors.surface}
            ios_backgroundColor={colors.border}
            accessibilityLabel={language === 'he' ? 'כל העולמות עם דוגמאות' : 'All worlds with examples'}
          />
        </View>
        <Text style={[styles.hint, styles.blockText, { color: colors.textSecondary, marginTop: 10, textAlign: ta, writingDirection: wd }]}>
          {language === 'he'
            ? 'במרחב אישי: דפדוף בין כל העולמות, וכדורי דוגמה מהקטלוג בכל עולם (יחידות אמיתיות שלך נשארות).'
            : 'In General: cycle all worlds and show catalog example orbs per world (your real units stay).'}
        </Text>

        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}12`, marginTop: 12 }]}
          onPress={() => {
            requestSyntheticHomeProfile();
            const msg =
              language === 'he'
                ? 'נוצרו יחידות דמו בעולמות שונים. חזרו למסך הבית לראות את הגלגל.'
                : 'Demo units were created across worlds. Open Home to see the wheel.';
            if (Platform.OS === 'web') {
              try {
                (globalThis as unknown as { alert?: (m: string) => void }).alert?.(msg);
              } catch {
                /* ignore */
              }
              return;
            }
            Alert.alert(language === 'he' ? 'גנרטור פרופיל' : 'Profile generator', msg);
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.resetBtnTxt, { color: colors.primary, textAlign: ta, writingDirection: wd }]}>
            {language === 'he' ? 'גנרט משתמש (יחידות דמו)' : 'Generate user (demo units)'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.hint, styles.blockText, { color: colors.textSecondary, marginTop: 10, textAlign: ta, writingDirection: wd }]}>
          {language === 'he'
            ? 'יוצר אוטומטית פרופיל פוטנציאלי: כדורי «ראשי» מהקטלוג + יחידות פעילות לדוגמה בעולמות עבודה, בריאות, כסף, לימודים, פנאי וקשרים (ללא קריאת שרת — לבדיקות UI).'
            : 'Auto-builds a synthetic potential user: General catalog orbs plus sample active units across Work, Health, Finance, Learning, Leisure, and Relationships (local only, for UI testing).'}
        </Text>

        <Text
          style={[
            styles.sectionLabel,
            styles.blockText,
            { color: colors.textSecondary, marginTop: 28, textAlign: ta, writingDirection: wd },
          ]}
        >
          {language === 'he' ? 'בדיקות' : 'Testing'}
        </Text>
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: '#b91c1c', backgroundColor: language === 'he' ? '#450a0a12' : '#fef2f2' }]}
          onPress={confirmRestartOnboardingFromScratch}
          accessibilityRole="button"
        >
          <Text style={[styles.resetBtnTxt, { color: '#b91c1c', textAlign: ta, writingDirection: wd }]}>
            {language === 'he' ? 'התחל יצירת חשבון מההתחלה' : 'Restart onboarding from scratch'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  /** בלי רוחב מלא `textAlign: right` לא נראה — הטקסט מתכווץ לרוחב התוכן */
  blockText: {
    alignSelf: 'stretch',
    width: '100%',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  settingRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  resetBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    ...Platform.select({ web: { cursor: 'pointer' as const }, default: {} }),
  },
  resetBtnTxt: { fontSize: 15, fontWeight: '700' },
});
