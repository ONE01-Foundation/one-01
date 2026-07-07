/**
 * פרופס ויזואליים לכדור הסוכן במרכז הבית (HomePager) — משותף ללנדינג כדי שיופיע אותו פרצוף/הילה/שורות.
 */
import { getHatColor, type Hat, type OneUser } from '../core/types';

export function glowColorForHomeOrb(user: OneUser | null | undefined): string {
  const hats = user?.agent?.hats ?? (['base'] as Hat[]);
  const primary = hats.filter((h: Hat) => h !== 'base')[0] ?? 'base';
  return getHatColor(primary);
}

/** שורות משנה שמסתובבות מתחת לכדור במרכז הבית (כמו ב־HomePager). */
export function buildHomeRotatingLines(user: OneUser | null | undefined): string[] {
  if (!user) return [];
  const lines: string[] = ['What are we building today?', 'Momentum is high today — good time to execute'];
  const active = user.processes.filter((p) => p.status === 'active');
  if (active.length > 0) lines.push(`Process active: ${active[0].title}`);
  return lines;
}

/**
 * אותה לוגיקת שורות כמו עמוד הבית האמצעי ב־HomePager (לא כולל Discovery / Timeline).
 */
export function labelLinesForHomeCenterOrbFromHomeState(
  user: OneUser | null | undefined,
  agentStatusText: string | null,
  rotatingLines: string[],
  labelIndex: number
): string[] {
  if (agentStatusText) return ['One Agent', agentStatusText];
  if (user) {
    const active = user.processes.filter((p) => p.status === 'active');
    if (active.length > 0) return ['One Agent', `Process active: ${active[0].title}`];
    if (rotatingLines.length > 0) return ['One Agent', rotatingLines[labelIndex % rotatingLines.length]];
    return ['One Agent'];
  }
  return ['One Agent', 'What are we building today?'];
}
