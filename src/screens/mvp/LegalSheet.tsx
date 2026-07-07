/**
 * LegalSheet — renders Privacy Policy / Terms of Use / Open Source Licenses
 * IN-APP, per Apple §5.1.1(i). Apple frequently rejects apps that only link
 * to a web URL for these.
 *
 * Content is plain text (not markdown — keeps it dependency-free) with
 * minimal styling: H1/H2 lines start with "#" / "##" prefixes.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import {
  PRIVACY_POLICY_TEXT,
  TERMS_OF_USE_TEXT,
  OSS_LICENSES_TEXT,
} from '../../data/mvp/legalContent';

const SCREEN_H = Dimensions.get('window').height;

export type LegalDoc = 'privacy' | 'terms' | 'oss' | null;

interface LegalSheetProps {
  doc: LegalDoc;
  onClose: () => void;
}

const TITLES: Record<Exclude<LegalDoc, null>, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  oss: 'Open Source Licenses',
};

const CONTENT: Record<Exclude<LegalDoc, null>, string> = {
  privacy: PRIVACY_POLICY_TEXT,
  terms: TERMS_OF_USE_TEXT,
  oss: OSS_LICENSES_TEXT,
};

export function LegalSheet({ doc, onClose }: LegalSheetProps) {
  const { colors } = useThemeStore();
  if (!doc) {
    return (
      <BottomSheet visible={false} onClose={onClose} sheetStyle={styles.sheet}>
        <View />
      </BottomSheet>
    );
  }

  const title = TITLES[doc];
  const text = CONTENT[doc];

  return (
    <BottomSheet
      visible={!!doc}
      onClose={onClose}
      snapPoints={['65%', '92%']}
      sheetStyle={[styles.sheet]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[styles.closeX, { color: colors.textSecondary }]}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {text.split(/\n\n+/).map((para, i) => {
          const trimmed = para.trim();
          if (trimmed.startsWith('## ')) {
            return (
              <Text key={i} style={[styles.h2, { color: colors.text }]}>
                {trimmed.slice(3)}
              </Text>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <Text key={i} style={[styles.h1, { color: colors.text }]}>
                {trimmed.slice(2)}
              </Text>
            );
          }
          return (
            <Text key={i} style={[styles.p, { color: colors.text }]}>
              {trimmed}
            </Text>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  title: { fontSize: 22, fontWeight: '600' },
  closeX: { fontSize: 20 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  h1: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 10 },
  p: { fontSize: 14, lineHeight: 22 },
});
