/**
 * deployTool — one place that turns a tool kind + context into a live run and
 * the ChatWidget to drop in the thread. Used by the "+" launcher (and anywhere
 * a surface wants to deploy a tool directly). The keyword-intercept and AI
 * `deploy_tool` paths build the same runs; this keeps a single source of truth
 * for new deploy surfaces.
 *
 * Returns null when the tool can't apply (e.g. no quiz matches the topic).
 */
import { useMvpStore, type ChatWidget } from '../../stores/mvpStore';
import { quizForText, buildQuizRun } from './quizBank';
import { buildBookingRun } from './booking';
import { formForText, buildFormRun } from './forms';

export type ToolKind = 'quiz' | 'booking' | 'form';

export interface ToolContext {
  unitId?: string;
  /** Used to pick a quiz when no explicit topic (e.g. the process title). */
  unitTitle?: string;
  provider?: string;
  /** Topic hint for quiz / form template matching. */
  topic?: string;
  lang: 'en' | 'he';
}

export function startToolRun(kind: ToolKind, ctx: ToolContext): ChatWidget | null {
  const store = useMvpStore.getState();

  if (kind === 'quiz') {
    const def =
      (ctx.topic ? quizForText(ctx.topic) : null) ??
      (ctx.unitTitle ? quizForText(ctx.unitTitle) : null);
    if (!def) return null;
    const run = buildQuizRun(def, ctx.unitId, ctx.lang);
    store.startQuizRun(run);
    return { kind: 'quiz', runId: run.id };
  }

  if (kind === 'booking') {
    const run = buildBookingRun({
      unitId: ctx.unitId,
      title: ctx.lang === 'he' ? 'קביעת תור' : 'Booking',
      provider: ctx.provider,
      lang: ctx.lang,
    });
    store.startBookingRun(run);
    return { kind: 'booking', runId: run.id };
  }

  // form — fall back to the generic template when no topic matches.
  const def = (ctx.topic ? formForText(ctx.topic) : null) ?? formForText('טופס');
  if (!def) return null;
  const run = buildFormRun(def, ctx.unitId, ctx.lang);
  store.startFormRun(run);
  return { kind: 'form', runId: run.id };
}

/** Does a quiz exist for this topic / process title? Used to decide whether to
 *  offer the quiz launcher (quiz is topic-specific; booking/form are generic). */
export function quizAvailableFor(topic?: string): boolean {
  return !!(topic && quizForText(topic));
}
