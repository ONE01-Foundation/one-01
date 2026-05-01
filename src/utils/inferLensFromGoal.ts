import type { LifeLens } from '../core/types';

export function inferLensFromGoal(text: string): LifeLens {
  const t = text.toLowerCase();
  if (/health|wellness|doctor|fitness|medical|רפוא|בריא|כושר|תור/.test(t)) return 'health';
  if (/money|finance|budget|invest|bank|tax|כסף|כלכלה|מס|בנק/.test(t)) return 'finance';
  if (/business|startup|client|sale|לקוח|עסק|צוות/.test(t)) return 'business';
  return 'knowledge';
}
