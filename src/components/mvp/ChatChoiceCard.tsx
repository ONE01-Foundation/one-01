/**
 * ChatChoiceCard — a GUIDED CHOICE step rendered as tappable pills (emoji + word).
 *
 * This is how ONE "fills the desire WITH you": a broad intent ("I want a
 * license") doesn't become a process on the spot. ONE asks a short series of
 * questions, each a row of choice pills. Picking one:
 *   • records the answer and marks these pills answered (they stay, highlighted),
 *   • OPENS THE TOPIC (a quiet marker, not a card) after the first choice,
 *   • asks the next question (a fresh pill row below), and
 *   • once the desire is specific enough, opens the real process.
 *
 * Each card is pinned to ONE step of the run (`step`), so earlier rows stay as
 * answered history while the live question sits at the bottom of the thread.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlRow, rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { buildLocalProcess } from '../../utils/localProcess';
import {
  GUIDED_DESIRES,
  visibleSteps,
  guidedTitle,
  guidedSummary,
  type GuidedOption,
} from '../../data/mvp/guidedDesires';

export function ChatChoiceCard({ runId, step }: { runId: string; step: number }) {
  const { colors } = useThemeStore();
  const appLang = useLanguage();
  const run = useMvpStore((s) => s.guidedRuns[runId]);

  if (!run) return null;
  // Follow the CONVERSATION's language (set when the run started), not the app
  // language — a Hebrew ask gets Hebrew pills even on an English UI.
  const lang: 'he' | 'en' = run.lang ?? appLang;
  const he = lang === 'he';
  const desire = GUIDED_DESIRES.find((d) => d.key === run.desireKey);
  if (!desire) return null;

  const steps = visibleSteps(desire, run.answers);
  const stepDef = steps[step];
  if (!stepDef) return null;

  const answeredValue = run.answers[stepDef.id];
  const answered = answeredValue != null;
  // Only the run's current question is live; earlier rows are read-only history.
  const active = run.status === 'active' && run.stepIndex === step && !answered;

  const pick = (opt: GuidedOption) => {
    if (!active) return;
    haptic.select();
    const st = useMvpStore.getState();
    const answers = { ...run.answers, [stepDef.id]: opt.value };
    const nextIndex = step + 1;
    const nextSteps = visibleSteps(desire, answers);
    const pickText = `${opt.emoji ? opt.emoji + ' ' : ''}${he ? opt.label.he : opt.label.en}`;
    let ts = Date.now();
    const newIds: string[] = [];
    const push = (m: { from: 'one' | 'user'; text: string; widget?: any }) => {
      const id = `g_${ts}_${Math.floor(Math.random() * 1e6)}`;
      newIds.push(id);
      st.appendHomeChat({ id, ts: ts++, ...m });
    };

    if (nextIndex < nextSteps.length) {
      // STILL BUILDING — echo the choice, (after the first) open the topic marker,
      // then ask the next question as a fresh pill row. All stays in the home
      // thread for now; it moves into the process once the desire is specific.
      push({ from: 'user', text: pickText });
      if (step === 0) {
        push({ from: 'one', text: he ? 'נפתח נושא — נשלים פרטים ✍️' : "Topic opened — let's fill in the details ✍️" });
      }
      const next = nextSteps[nextIndex];
      push({ from: 'one', text: he ? next.prompt.he : next.prompt.en });
      push({ from: 'one', text: '', widget: { kind: 'choice', runId, step: nextIndex } });
      st.updateGuidedRun(runId, { answers, stepIndex: nextIndex, homeMsgIds: [...(run.homeMsgIds ?? []), ...newIds] });
    } else {
      // SPECIFIC ENOUGH → open the real process, MOVE the whole Q&A into its own
      // chat, and clear it from the home thread (leaving one short breadcrumb).
      const title = guidedTitle(desire, answers, he);
      const summary = guidedSummary(desire, answers, he);
      const created = buildLocalProcess(title, st.identities, st.activeIdentityId);
      st.addUnit(created);
      st.pushUnitNotification({
        unitId: created.id,
        text: he ? `נפתח תהליך: ${created.title}` : `New process: ${created.title}`,
        emoji: created.emoji,
        kind: 'created',
      });
      haptic.success();
      // Seed the PROCESS's own chat so opening it continues the conversation.
      const firstStep = created.nextSteps?.[0]?.title;
      let uts = Date.now();
      st.appendUnitChat(created.id, {
        id: `us_${uts}`,
        from: 'user',
        text: summary ? `${title} · ${summary}` : title,
        ts: uts++,
      });
      st.appendUnitChat(created.id, {
        id: `uo_${uts}`,
        from: 'one',
        text: he
          ? `${created.emoji} ${title}. ${firstStep ? `מתחילים מ: ${firstStep}. ` : ''}אני על זה — נמשיך כאן.`
          : `${created.emoji} ${title}. ${firstStep ? `Starting with: ${firstStep}. ` : ''}I'm on it — let's continue here.`,
        ts: uts++,
      });
      // The Q&A now lives in the process → clear it from the home thread.
      st.removeHomeChat([...(run.homeMsgIds ?? [])]);
      st.updateGuidedRun(runId, { status: 'done', createdUnitId: created.id, stepIndex: nextIndex });
      // One short breadcrumb back in home.
      st.appendHomeChat({
        id: `gdone_${Date.now()}`,
        from: 'one',
        text: he
          ? `פתחתי את ${created.emoji} ${title}${summary ? ' · ' + summary : ''} — זה אצלי.`
          : `Opened ${created.emoji} ${title}${summary ? ' · ' + summary : ''} — I've got it.`,
        ts: Date.now(),
      });
    }
  };

  return (
    <View style={[styles.wrap, rtlRow(lang)]}>
      {stepDef.options.map((opt) => {
        const picked = answeredValue === opt.value;
        const faded = answered && !picked;
        return (
          <Pressable
            key={opt.value}
            disabled={!active}
            onPress={() => pick(opt)}
            style={[
              styles.pill,
              { borderColor: colors.border, backgroundColor: colors.surface },
              picked && { borderColor: colors.primary, backgroundColor: tint(colors.primary) },
              faded && styles.faded,
            ]}
            accessibilityRole="button"
            accessibilityLabel={he ? opt.label.he : opt.label.en}
          >
            {!!opt.emoji && <Text style={styles.pillEmoji}>{opt.emoji}</Text>}
            <Text
              style={[
                styles.pillText,
                { color: picked ? colors.primary : colors.text },
                rtlText(lang),
              ]}
              numberOfLines={1}
            >
              {he ? opt.label.he : opt.label.en}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Faint tint of the accent for the chosen pill. */
function tint(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  faded: { opacity: 0.4 },
  pillEmoji: { fontSize: 15 },
  pillText: { fontSize: 14, fontWeight: '600' },
});
