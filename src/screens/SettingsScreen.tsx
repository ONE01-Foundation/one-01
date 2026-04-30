/**
 * הגדרות — מוד בהיר/כהה ושפה. כיוון הממשק נגזר אוטומטית מהשפה (עברית RTL / אנגלית LTR).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { translate } from '../i18n/strings';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Settings'>;

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
  const isRtl = layoutDirection === 'rtl';
  const ta: 'left' | 'right' = isRtl ? 'right' : 'left';
  const wd: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';
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
});
