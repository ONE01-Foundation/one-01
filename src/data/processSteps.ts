/**
 * צעדים וצפי־מציאות לכל תהליך (לפי עולם + orbId).
 * מפתח: worldId_orbId
 */

import type { ProcessStep, ProcessReality } from '../core/types';

export interface ProcessStepsData {
  steps: ProcessStep[];
  reality: ProcessReality;
}

function step(id: string, title: string, completed: boolean, order: number): ProcessStep {
  return { id, title, completed, order };
}

const DATA: Record<string, ProcessStepsData> = {
  personal_license: {
    steps: [
      step('s1', 'בדיקת ראייה ותעודת זהות', true, 1),
      step('s2', 'טופס בקשת רישיון + תמונות', true, 2),
      step('s3', 'תיאום תור ללימודים תאורטיים', false, 3),
      step('s4', 'מבחן תיאוריה', false, 4),
      step('s5', 'בחירת מורה נהיגה והתחלת שיעורים', false, 5),
      step('s6', 'מבחן מעשי', false, 6),
      step('s7', 'קבלת רישיון', false, 7),
    ],
    reality: {
      estimatedCostNis: 3500,
      estimatedTimeDays: 90,
      resources: ['תעודת זהות', '6 תמונות', 'אישור רפואי'],
      targetCostNis: 2800,
      targetTimeDays: 60,
    },
  },
  personal_mass: {
    steps: [
      step('m1', 'הגדרת יעד קלורי יומי', true, 1),
      step('m2', 'תפריט בסיס + תוספת חלבון', false, 2),
      step('m3', 'תוכנית אימונים 3–4 פעמים בשבוע', false, 3),
      step('m4', 'מעקב משקל שבועי', false, 4),
      step('m5', 'הגעה ל־+5 קילו והחזקה', false, 5),
    ],
    reality: {
      estimatedTimeDays: 90,
      estimatedCostNis: 0,
      resources: ['משקל בית', 'אפליקציית קלוריות'],
    },
  },
  business_b1: {
    steps: [
      step('b1', 'בחירת סוג ישות (עוסק/חברה)', true, 1),
      step('b2', 'רישום ברשויות (מס, ביטוח לאומי)', false, 2),
      step('b3', 'פתיחת חשבון בנק עסקי', false, 3),
      step('b4', 'הגדרת מוצרים/שירותים ומחירים', false, 4),
      step('b5', 'הפעלת ערוץ מכירה ראשון', false, 5),
    ],
    reality: {
      estimatedCostNis: 2500,
      estimatedTimeDays: 21,
      resources: ['ת.ז.', 'טופס 101', 'חוזה שכירות אם רלוונטי'],
      targetTimeDays: 14,
    },
  },
  business_b2: {
    steps: [
      step('r1', 'איסוף כל ההכנסות וההוצאות לרבעון', false, 1),
      step('r2', 'סיווג לפי קטגוריות', false, 2),
      step('r3', 'חישוב רווח גולמי ומכירות', false, 3),
      step('r4', 'ייצוא דוח PDF/Excel', false, 4),
    ],
    reality: {
      estimatedTimeMinutes: 120,
      resources: ['חשבוניות', 'תעודות בנק', 'אקסל או תוכנת הנהלת חשבונות'],
    },
  },
  health_h1: {
    steps: [
      step('t1', 'בחירת קופת חולים ורופא משפחה', true, 1),
      step('t2', 'הזמנת תור דרך האפליקציה/טלפון', false, 2),
      step('t3', 'הגעה עם טופס 17 ות.ז.', false, 3),
      step('t4', 'סיכום והמשך טיפול אם נדרש', false, 4),
    ],
    reality: {
      estimatedTimeDays: 14,
      estimatedCostNis: 0,
      resources: ['טופס 17', 'תעודת זהות'],
    },
  },
  health_h2: {
    steps: [
      step('d1', 'רישום כל התרופות והמינונים', true, 1),
      step('d2', 'הגדרת תזכורות יומיות', false, 2),
      step('d3', 'מעקב שבועי – נטילה עקבית', false, 3),
      step('d4', 'תיאום עם רופא לבדיקת דם אם רלוונטי', false, 4),
    ],
    reality: {
      estimatedTimeMinutes: 30,
      resources: ['רשימת תרופות', 'אפליקציית תזכורות'],
    },
  },
  finance_f1: {
    steps: [
      step('i1', 'הגדרת מטרת השקעה וסיכון', true, 1),
      step('i2', 'בחירת פלטפורמה (בנק/ברוקר)', false, 2),
      step('i3', 'פיזור נכסים – מניות/אג\"ח/מזומן', false, 3),
      step('i4', 'הפקדה ראשונה ומעקב חודשי', false, 4),
    ],
    reality: {
      estimatedCostNis: 0,
      estimatedTimeMinutes: 90,
      resources: ['ת.ז.', 'חשבון בנק', 'החלטה על סכום השקעה'],
    },
  },
  finance_f2: {
    steps: [
      step('tax1', 'איסוף טפסים 106 ו־ת.ז.', false, 1),
      step('tax2', 'הגשת בקשה במערכת המס', false, 2),
      step('tax3', 'מעקב אחר אישור והחזר', false, 3),
    ],
    reality: {
      estimatedTimeDays: 60,
      resources: ['טופס 106', 'תעודת זהות', 'פרטי בנק להחזר'],
    },
  },
  personal_passport: {
    steps: [
      step('p1', 'בדיקת תוקף דרכון נוכחי', false, 1),
      step('p2', 'תיאום תור במשרד הפנים / אונליין', false, 2),
      step('p3', 'הכנת תמונות ות.ז.', false, 3),
      step('p4', 'הגעה לתור ותשלום אגרה', false, 4),
      step('p5', 'איסוף דרכון חדש', false, 5),
    ],
    reality: {
      estimatedCostNis: 190,
      estimatedTimeDays: 14,
      resources: ['תעודת זהות', '2 תמונות פספורט', 'דרכון ישן'],
    },
  },
  business_b3: {
    steps: [
      step('g1', 'הגדרת תפקיד ודרישות', false, 1),
      step('g2', 'כתיבת מודעת דרושים', false, 2),
      step('g3', 'פרסום וקבלת קורות חיים', false, 3),
      step('g4', 'ראיונות ובדיקות', false, 4),
      step('g5', 'הצעה וחתימה על חוזה', false, 5),
    ],
    reality: {
      estimatedTimeDays: 45,
      resources: ['תיאור תפקיד', 'משכורת ומסגרת'],
    },
  },
  health_h3: {
    steps: [
      step('bl1', 'בקשת הפניה מרופא משפחה', false, 1),
      step('bl2', 'תיאום במעבדה (צום אם נדרש)', false, 2),
      step('bl3', 'הגעה לבדיקה', false, 3),
      step('bl4', 'קבלת תוצאות ופענוח', false, 4),
    ],
    reality: {
      estimatedTimeDays: 7,
      estimatedCostNis: 0,
      resources: ['הפניה', 'תעודת זהות'],
    },
  },
  finance_f3: {
    steps: [
      step('car1', 'הגדרת יעד סכום ותאריך', true, 1),
      step('car2', 'חישוב חיסכון חודשי נדרש', false, 2),
      step('car3', 'העברה אוטומטית או קופה', false, 3),
      step('car4', 'מעקב חודשי עד היעד', false, 4),
    ],
    reality: {
      estimatedTimeMinutes: 30,
      resources: ['חשבון בנק', 'יעד בסכום ובתאריך'],
    },
  },
};

export function getProcessStepsData(worldId: string, orbId: string): ProcessStepsData | null {
  const key = `${worldId}_${orbId}`;
  return DATA[key] ?? null;
}

export function getProgress(steps: ProcessStep[]): { completed: number; total: number; percent: number } {
  const total = steps.length;
  const completed = steps.filter((s) => s.completed).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}
