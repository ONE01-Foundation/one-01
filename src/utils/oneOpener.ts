/**
 * oneOpener — ONE's proactive home message, shared across every home mode
 * (classic / presence / chat) so they never drift.
 *
 * Deliberately NOT a restatement of the process cards (the user scrolls and
 * sees those; ONE echoing them is noise). Just one short, proactive line: a
 * nudge on what's waiting or moved, or an open invitation. Synchronous + pure,
 * so ONE's message is instant and "simply there" — no AI round-trip, no typing
 * swap, no re-load on foreground.
 */

import type { Unit } from '../core/mvp/types';

/** Rank open processes the way the home does: unread first, then stalest. */
function rankOpen(units: Unit[]): Unit[] {
  return units
    .filter((u) => u.status !== 'completed')
    .sort((a, b) => {
      const ua = (a.unreadUpdates ?? 0) > 0 ? 1 : 0;
      const ub = (b.unreadUpdates ?? 0) > 0 ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return +new Date(a.lastUpdatedAt ?? 0) - +new Date(b.lastUpdatedAt ?? 0);
    });
}

type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night';
function timeOfDay(now: number): TimeOfDay {
  const h = new Date(now).getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'noon';
  if (h < 22) return 'evening';
  return 'night';
}

/**
 * ONE's RICHER home message — a short, TIME-AWARE note that can be more than one
 * line (rendered as separate chat bubbles): a state summary (sometimes just a
 * warm presence line) + the single most useful move (an update that landed, a
 * nudge on what's waiting, or an open invitation). Still never a flat echo of
 * the cards. Synchronous + pure, so it's instant and persistent.
 *
 * `rot` rotates the phrasing so ONE never reads the same canned line twice — the
 * caller passes a value that bumps on events / each day (e.g. greetingRot).
 */
export function oneHomeMessages(units: Unit[], he: boolean, now = Date.now(), rot = 0): string[] {
  const open = (units ?? []).filter((u) => u.status !== 'completed');
  const tod = timeOfDay(now);
  const pick = <T,>(arr: T[]): T => arr[Math.abs(Math.trunc(rot)) % arr.length];

  if (open.length === 0) {
    const calm: Record<TimeOfDay, string[]> = he
      ? {
          morning: ['בוקר חדש ודף חלק. על מה בא לך שנתחיל היום?', 'בוקר טוב — הכול פנוי. מה הדבר הראשון שנקדם?'],
          noon: ['רגוע עכשיו, שום דבר פתוח. בא לך שנתחיל משהו?', 'דף נקי. על מה נעבוד?'],
          evening: ['ערב רגוע — שום דבר פתוח כרגע. נתחיל משהו?', 'סוף יום שקט. יש משהו שתרצה לקדם למחר?'],
          night: ['הכול רגוע אצלך כרגע. בא לך שנתחיל משהו חדש? אני כאן.', 'שקט הלילה. אני כאן אם בא לך להתחיל משהו.'],
        }
      : {
          morning: ['A fresh morning, a clean slate. What would you like to start today?', "Good morning — nothing open. What's the first thing to move?"],
          noon: ["Calm right now, nothing open. Want to start something?", 'A clean slate. What should we work on?'],
          evening: ['A calm evening — nothing open right now. Shall we start something?', 'A quiet end of day. Anything to line up for tomorrow?'],
          night: ["Everything's calm right now. Want to start something new? I'm here.", "Quiet tonight. I'm here whenever you want to start something."],
        };
    return [pick(calm[tod])];
  }

  const n = open.length;
  const nWord = he
    ? n === 1 ? 'תהליך אחד פתוח' : `${n} תהליכים פתוחים`
    : n === 1 ? '1 open process' : `${n} open processes`;

  // Bubble 1 — a time-aware line. Sometimes a state summary, sometimes a warm
  // presence line (so it reads as "something ONE says", not only a stat).
  const summaryPool: Record<TimeOfDay, string[]> = he
    ? {
        morning: [`${nWord} הבוקר — אני עוקב אחרי הכול.`, `אני כאן, מוכן ליום. ${nWord} על הרדאר.`, `בוקר של התחלות. ${nWord} ממתינים לנו.`],
        noon: [`${nWord} באוויר כרגע — הכול תחת מעקב.`, `אני על זה. ${nWord} פתוחים.`, `אמצע היום — ${nWord}, הכול אצלי.`],
        evening: [`לקראת סוף היום — ${nWord} עדיין פתוחים.`, `ערב. ${nWord} ממתינים, בקצב שלך.`, `מסכמים את היום? ${nWord} על השולחן.`],
        night: [`שעה מאוחרת — ${nWord} ממתינים למחר.`, `רגוע עכשיו. ${nWord} שמורים אצלי.`, `לילה. ${nWord} פתוחים, אבל שום דבר בוער.`],
      }
    : {
        morning: [`${nWord} this morning — I'm across all of it.`, `I'm here, ready for the day. ${nWord} on my radar.`, `A morning for starts. ${nWord} waiting for us.`],
        noon: [`${nWord} in the air right now — all tracked.`, `I'm on it. ${nWord} open.`, `Midday — ${nWord}, all with me.`],
        evening: [`Toward the end of the day — ${nWord} still open.`, `Evening. ${nWord} waiting, at your pace.`, `Wrapping the day? ${nWord} on the table.`],
        night: [`Late now — ${nWord} waiting for tomorrow.`, `Calm right now. ${nWord} safe with me.`, `Night. ${nWord} open, nothing urgent.`],
      };
  const summary = pick(summaryPool[tod]);

  // Bubble 2 — the one move worth surfacing: what MOVED since you last looked,
  // what's been WAITING, or an open invitation. Rotated for variety.
  const unread = open.filter((u) => (u.unreadUpdates ?? 0) > 0);
  const ranked = rankOpen(open);
  const stalest = ranked[0];
  const daysSince = stalest ? Math.floor((now - +new Date(stalest.lastUpdatedAt ?? now)) / 86_400_000) : 0;

  let action: string;
  if (unread.length > 0) {
    const u = unread[0];
    const name = `${u.emoji} ${u.title}`;
    const more = unread.length - 1;
    action = he
      ? pick([
          `מאז שבדקת — ${name} זז${more > 0 ? ` (ועוד ${more})` : ''}. נעבור על זה?`,
          `יש תנועה ב${name}${more > 0 ? ` ובעוד ${more}` : ''} — רוצה לראות?`,
        ])
      : pick([
          `Since you last looked — ${name} moved${more > 0 ? ` (and ${more} more)` : ''}. Shall we go over it?`,
          `There's movement on ${name}${more > 0 ? ` and ${more} more` : ''} — want to see?`,
        ]);
  } else if (stalest && daysSince >= 2) {
    const name = `${stalest.emoji} ${stalest.title}`;
    action = he
      ? pick([`${name} מחכה כבר כמה ימים — שאקח את זה קדימה?`, `${name} לא זז מזמן. רוצה שאדחוף?`])
      : pick([`${name} has been waiting a few days — want me to take it forward?`, `${name} hasn't moved in a while. Want me to push it?`]);
  } else {
    action = he
      ? pick(['מה תרצה לקדם עכשיו?', 'במה נתחיל?', 'על מה נעבוד היום?'])
      : pick(['What would you like to move now?', 'What should we start with?', 'What should we work on today?']);
  }

  return [summary, action];
}
