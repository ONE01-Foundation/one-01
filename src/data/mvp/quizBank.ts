/**
 * quizBank — ONE's first TOOL: multiple-choice quizzes it can deploy inside the
 * conversation to help a process along (e.g. a driving-theory quiz for a
 * "driving license" process). Bilingual, like the archetypes. When the user
 * asks to practice / take a test and the active process matches a quiz here,
 * ONE drops the quiz widget into the thread; the score flows back onto a unit
 * metric when finished.
 *
 * Adding a new quiz = add a QuizDef to BANK. Everything else (store, widget,
 * deploy heuristic) is generic.
 */

import type { QuizQuestion, QuizRun } from '../../core/mvp/types';

type Lang = 'he' | 'en';

export interface QuizDef {
  topic: string;
  /** Keywords on the PROCESS title/message that make this quiz relevant. */
  match: RegExp;
  title: (he: boolean) => string;
  /** The unit metric the final score is written onto (matched fuzzily). */
  metricLabel: (he: boolean) => string;
  questions: (he: boolean) => QuizQuestion[];
}

const DRIVING_THEORY: QuizDef = {
  topic: 'driving_theory',
  match: /רישיון|נהיג|תיאורי|theory|driving|licen[sc]e/i,
  title: (he) => (he ? 'מבחן תיאוריה' : 'Theory quiz'),
  metricLabel: (he) => (he ? 'תיאוריה' : 'Theory'),
  questions: (he) =>
    he
      ? [
          {
            q: 'מהו המרחק הבטוח מהרכב שלפניך בנסיעה?',
            options: ['חצי מטר', 'כלל "שתי שניות"', '10 מטר קבוע'],
            correct: 1,
            why: 'המרחק נמדד בזמן — שתי שניות מספיקות לעצירה בטוחה בכל מהירות.',
          },
          {
            q: 'מה המהירות המרבית המותרת בדרך עירונית (אם אין תמרור אחר)?',
            options: ['50 קמ״ש', '70 קמ״ש', '90 קמ״ש'],
            correct: 0,
            why: 'ברירת המחדל בעיר היא 50 קמ״ש, אלא אם תמרור קובע אחרת.',
          },
          {
            q: 'מתי חובה להדליק אורות בנסיעה בין־עירונית?',
            options: ['רק בלילה', 'לאורך כל שעות היממה', 'רק כשיורד גשם'],
            correct: 1,
            why: 'בדרך בין־עירונית חובה אור קדמי דולק גם ביום.',
          },
          {
            q: 'מתקרב רכב חירום עם סירנה — מה עליך לעשות?',
            options: ['להאיץ ולהתרחק', 'לפנות דרך ולעצור בצד אם צריך', 'להמשיך כרגיל'],
            correct: 1,
            why: 'חובה לפנות דרך לרכב חירום, גם אם צריך לעצור בצד.',
          },
          {
            q: 'מה המשמעות של קו הפרדה רצוף?',
            options: ['מותר לעקוף בזהירות', 'אסור לחצות ואסור לעקוף', 'מותר רק בלילה'],
            correct: 1,
            why: 'קו רצוף אוסר חצייה ועקיפה.',
          },
        ]
      : [
          {
            q: 'What is a safe following distance from the car ahead?',
            options: ['Half a metre', 'The "two-second" rule', 'A fixed 10 metres'],
            correct: 1,
            why: 'Distance is measured in time — two seconds allows a safe stop at any speed.',
          },
          {
            q: 'Default maximum speed in a built-up area (no other sign)?',
            options: ['50 km/h', '70 km/h', '90 km/h'],
            correct: 0,
            why: 'The urban default is 50 km/h unless a sign says otherwise.',
          },
          {
            q: 'When must headlights be on when driving between cities?',
            options: ['Only at night', 'At all hours', 'Only when raining'],
            correct: 1,
            why: 'Inter-urban roads require headlights on, day and night.',
          },
          {
            q: 'An emergency vehicle approaches with its siren — what do you do?',
            options: ['Speed up and move away', 'Make way, pull over if needed', 'Carry on as normal'],
            correct: 1,
            why: 'You must give way to emergency vehicles, pulling over if necessary.',
          },
          {
            q: 'What does a solid lane-separation line mean?',
            options: ['Overtaking allowed carefully', 'No crossing and no overtaking', 'Allowed at night only'],
            correct: 1,
            why: 'A solid line forbids crossing and overtaking.',
          },
        ],
};

const BANK: QuizDef[] = [DRIVING_THEORY];

/** A quiz relevant to a process (by its title / the user's words), or null. */
export function quizForText(text: string): QuizDef | null {
  return BANK.find((def) => def.match.test(text)) ?? null;
}

/** Build a fresh quiz run from a def, for a unit. */
export function buildQuizRun(def: QuizDef, unitId: string | undefined, lang: Lang): QuizRun {
  const he = lang === 'he';
  const questions = def.questions(he);
  return {
    id: `quiz_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    unitId,
    title: def.title(he),
    metricLabel: def.metricLabel(he),
    questions,
    answers: questions.map(() => null),
  };
}
