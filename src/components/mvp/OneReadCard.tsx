/**
 * OneReadCard — surfaces ONE's proactive read on a process.
 *
 * Renders the verdict from `analyzeUnit` (processIntelligence.ts): a colored
 * state dot, ONE's headline, a one-line "why", and — when there's an obvious
 * move — a single filled CTA that performs it. Purely presentational; the
 * parent owns what each CTA actually does (it maps to writes the profile sheet
 * already performs), so this card never invents behavior.
 *
 * Borderless by house style — it separates from the page with a soft tint of
 * its state color, not a frame.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../utils/theme';
import { rtlText, rtlRow } from '../../utils/rtl';
import type { UnitFocus, FocusState, UnitFocusCta } from '../../utils/processIntelligence';

const STATE_COLOR: Record<FocusState, string> = {
  overdue: '#E5484D',
  due_soon: '#F5A623',
  almost_done: '#10B981',
  stalled: '#8A8F98',
  next_step: '#6366F1',
  on_track: '#10B981',
  done: '#10B981',
};

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function OneReadCard({
  focus,
  colors,
  lang,
  onCta,
}: {
  focus: UnitFocus;
  colors: ThemeColors;
  lang: 'en' | 'he';
  onCta: (cta: UnitFocusCta) => void;
}) {
  const he = lang === 'he';
  const color = STATE_COLOR[focus.state];

  return (
    <View style={[styles.card, { backgroundColor: withAlpha(color, 0.1) }]}>
      <View style={[styles.headerRow, rtlRow(lang)]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.label, { color }, rtlText(lang)]}>
          {he ? 'ONE רואה' : 'ONE’s read'}
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.text }, rtlText(lang)]}>
        {focus.headline}
      </Text>
      <Text style={[styles.reason, { color: colors.textSecondary }, rtlText(lang)]}>
        {focus.reason}
      </Text>

      {focus.cta && (
        <Pressable
          onPress={() => onCta(focus.cta as UnitFocusCta)}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: color, alignSelf: he ? 'flex-end' : 'flex-start', opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={focus.cta.label}
        >
          <Text style={styles.ctaText}>{focus.cta.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  reason: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cta: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
