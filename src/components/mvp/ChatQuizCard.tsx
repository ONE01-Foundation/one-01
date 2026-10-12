/**
 * ChatQuizCard — the first TOOL widget ONE deploys in the thread: a
 * multiple-choice quiz. Reads its run live from the store (survives reloads /
 * resumes at the first unanswered question), shows correct/wrong feedback with a
 * one-line why, and when finished writes the score onto the process's metric —
 * the tool result flows back into the process it was helping with.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { matchMetricIndex } from '../../utils/metricMatch';

const GOOD = '#1CA06B';
const WARN = '#C8841A';

export function ChatQuizCard({ runId }: { runId: string }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const run = useMvpStore((s) => s.quizRuns[runId]);
  const answerQuizQuestion = useMvpStore((s) => s.answerQuizQuestion);
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const wroteRef = useRef(false);

  // Which question is on screen — resume at the first unanswered one.
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!run) return;
    const f = run.answers.findIndex((a) => a == null);
    setIdx(f === -1 ? run.questions.length : f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // When all answered, write the score onto the process's matching metric (once).
  useEffect(() => {
    if (!run?.finishedAt || wroteRef.current) return;
    wroteRef.current = true;
    if (!run.unitId || !run.metricLabel) return;
    const unit = useMvpStore.getState().units.find((u) => u.id === run.unitId);
    if (!unit) return;
    const score = run.answers.reduce<number>((acc, a, i) => acc + (a === run.questions[i].correct ? 1 : 0), 0);
    const scoreStr = `${score}/${run.questions.length}`;
    const metrics = unit.metrics ?? [];
    const mi = matchMetricIndex(metrics, run.metricLabel);
    const nextMetrics =
      mi >= 0
        ? metrics.map((m, i) => (i === mi ? { ...m, value: scoreStr } : m))
        : [...metrics, { id: `m_${Date.now()}`, label: run.metricLabel, value: scoreStr }];
    const nowIso = new Date().toISOString();
    updateUnit(unit.id, {
      metrics: nextMetrics,
      unreadUpdates: (unit.unreadUpdates ?? 0) + 1,
      lastUpdatedAt: nowIso,
      updatedAt: nowIso,
    });
  }, [run?.finishedAt, run?.unitId, run?.metricLabel, updateUnit]);

  if (!run) return null;
  const total = run.questions.length;
  const score = run.answers.reduce<number>((acc, a, i) => acc + (a === run.questions[i].correct ? 1 : 0), 0);

  // ── RESULTS ──
  if (idx >= total) {
    const good = score >= Math.ceil(total * 0.6);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.accent, { backgroundColor: good ? GOOD : WARN }]} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]}>
            🧠 {run.title}
          </Text>
          <Text style={[styles.resultBig, { color: good ? GOOD : WARN }, rtlText(lang)]}>
            {he ? `הציון שלך: ${score}/${total}` : `Your score: ${score}/${total}`}
          </Text>
          <Text style={[styles.resultSub, { color: colors.textSecondary }, rtlText(lang)]}>
            {good
              ? (he ? 'יפה! נשמר בתהליך.' : 'Nice! Saved to the process.')
              : (he ? 'שווה סיבוב נוסף. נשמר בתהליך.' : 'Worth another round. Saved to the process.')}
          </Text>
          <Pressable
            onPress={() => { haptic.tap(); setIdx(0); }}
            style={[styles.nextBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.nextText, { color: colors.text }]}>{he ? 'לסקור שוב' : 'Review again'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── A QUESTION ──
  const q = run.questions[idx];
  const chosen = run.answers[idx];
  const answered = chosen != null;
  const last = idx + 1 >= total;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={styles.body}>
        <Text style={[styles.head, { color: colors.textSecondary }, rtlText(lang)]}>
          🧠 {run.title} · {he ? `שאלה ${idx + 1}/${total}` : `Q${idx + 1}/${total}`} · {he ? `ציון ${score}` : `score ${score}`}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={{ height: '100%', width: `${(idx / total) * 100}%`, backgroundColor: colors.primary }} />
        </View>

        <Text style={[styles.question, { color: colors.text }, rtlText(lang)]}>{q.q}</Text>

        {q.options.map((opt, i) => {
          const isChosen = chosen === i;
          const isCorrect = i === q.correct;
          const showGood = answered && isCorrect;
          const showBad = answered && isChosen && !isCorrect;
          return (
            <Pressable
              key={i}
              disabled={answered}
              onPress={() => { haptic.select(); answerQuizQuestion(runId, idx, i); }}
              style={[
                styles.opt,
                { borderColor: colors.border },
                showGood && { borderColor: GOOD, backgroundColor: withTint(GOOD) },
                showBad && { borderColor: WARN, backgroundColor: withTint(WARN) },
              ]}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.dot,
                  { borderColor: colors.border },
                  showGood && { borderColor: GOOD, backgroundColor: GOOD },
                  showBad && { borderColor: WARN },
                ]}
              />
              <Text style={[styles.optText, { color: colors.text }, rtlText(lang)]}>{opt}</Text>
            </Pressable>
          );
        })}

        {answered && q.why && (
          <Animated.Text
            entering={FadeInDown.duration(220)}
            style={[styles.why, { color: colors.textSecondary }, rtlText(lang)]}
          >
            {chosen === q.correct ? '✓ ' : ''}{q.why}
          </Animated.Text>
        )}

        {answered && (
          <Pressable
            onPress={() => { haptic.tap(); setIdx(idx + 1); }}
            style={[styles.nextBtn, { backgroundColor: colors.text }]}
            accessibilityRole="button"
          >
            <Text style={[styles.nextText, { color: colors.surface }]}>
              {last ? (he ? 'לסיום ולראות ציון' : 'Finish & see score') : (he ? 'הבא →' : 'Next →')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** A faint tint of a semantic colour for the option fill. */
function withTint(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    borderBottomStartRadius: 6,
    overflow: 'hidden',
  },
  accent: { width: 4 },
  body: { flex: 1, padding: 15, gap: 10 },
  title: { fontSize: 15.5, fontWeight: '700' },
  head: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  question: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  optText: { fontSize: 14, fontWeight: '600', flex: 1 },
  why: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  nextBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 11,
    alignItems: 'center',
  },
  nextText: { fontSize: 14, fontWeight: '700' },
  resultBig: { fontSize: 22, fontWeight: '800' },
  resultSub: { fontSize: 13.5, lineHeight: 18 },
});
