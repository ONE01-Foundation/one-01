import type { AppLanguage } from '../stores/localeStore';
import { spaceOrDomainTitle } from './displayHelpers';
import { formatUnitLogStatusLine } from './displayHelpers';
import type { FlowUnit, OrbItem, BroadcastMessage } from './flowUnit';

export function getGlobalBroadcastMessages(
  spaceId: string,
  language: AppLanguage,
  crowdSignals: { key: string; labelHe: string; labelEn: string; count: number }[]
): BroadcastMessage[] {
  const name = spaceOrDomainTitle(spaceId, language);
  const crowd: BroadcastMessage[] = [];
  const top = crowdSignals.filter((s) => s.count > 0).slice(0, 4);
  if (language === 'he') {
    for (const s of top) {
      crowd.push({
        type: 'ציבורי · אנונימי',
        body: `${s.count} אנשים פתחו לאחרונה תהליך דומה: «${s.labelHe}» — אגרגט בלבד, בלי זהויות.`,
      });
    }
  } else {
    for (const s of top) {
      crowd.push({
        type: 'Public · anonymous',
        body: `${s.count} people recently started a similar journey: "${s.labelEn}"—aggregate only, no identities.`,
      });
    }
  }
  if (language === 'he') {
    return [
      ...crowd,
      {
        type: 'גילוי',
        body: `«${name}» — כאן כל סוכני האנשים נפגשים כדי לחפש ספק שירות, מוצר או תהליך; רואים שכבת אגרגציה אחת שמזינה אתכם ואת ה-AI.`,
      },
      {
        type: 'אגרגט',
        body: 'מחירים, זמינות, ביקורות מאומתות, נפח חיפושים ומגמות ביקוש — מרוכזים לפי עולם ולפי אזור.',
      },
      {
        type: 'שוק',
        body: 'דירוג היצע מול ביקוש, מי מגיב מהר, ומה נפתח הכי הרבה כיחידות בבית — כדי להחליט מה לרדוף אחריו.',
      },
      {
        type: 'סוכנים',
        body: 'שאילתות מסוכנים שונים משלימות תמונה אחת: פחות רעש, יותר התאמה לפני שבוחרים ספק או מוצר.',
      },
    ];
  }
  return [
    ...crowd,
    {
      type: 'Discovery',
      body: `"${name}" — where everyone's agents search for services, products, and flows; one aggregated layer for people and for AI.`,
    },
    {
      type: 'Aggregate',
      body: 'Prices, availability, verified reviews, search volume, and demand trends — rolled up by world and region.',
    },
    {
      type: 'Market',
      body: 'Supply vs demand, who responds fast, and what becomes a home unit most often — so you pick what to chase.',
    },
    {
      type: 'Agents',
      body: 'Queries from many agents complete one picture: less noise, better fit before you commit to a provider or product.',
    },
  ];
}

export function broadcastMessagesForOrbItem(item: OrbItem, units: FlowUnit[], language: AppLanguage): BroadcastMessage[] {
  const he = language === 'he';
  const t = {
    next: he ? 'צעד הבא' : 'Next step',
    goal: he ? 'מטרה' : 'Goal',
    progress: he ? 'התקדמות' : 'Progress',
    update: he ? 'עדכון' : 'Update',
    area: he ? 'אזור' : 'Area',
    unit: he ? 'יחידה' : 'Unit',
    reminder: he ? 'תזכורת' : 'Reminder',
    ready: he ? 'מוכן לביצוע' : 'Ready to go',
    chatHint: he ? 'פתחו בצ׳אט למעקב אחר צעדים' : 'Open chat to track steps',
    need: he ? 'צריך ממך' : 'Need from you',
    status: he ? 'סטטוס' : 'Status',
  };
  const unit = units.find((u) => u.id === item.id);
  if (unit) {
    const out: BroadcastMessage[] = [];
    const slots = unit.profileSlots?.filter((s) => !s.optional) ?? [];
    const missing = slots.filter((s) => !s.value?.trim());
    if (missing.length > 0) {
      out.push({
        type: t.need,
        body: he ? `${missing.length} שדות חסרים בפרופיל — ${missing[0].label}` : `${missing.length} profile fields missing — ${missing[0].label}`,
      });
      for (const s of missing.slice(1, 4)) {
        out.push({ type: t.need, body: s.label });
      }
    }
    const stLine = formatUnitLogStatusLine(unit.status, unit.progress, unit.steps, language);
    out.push({ type: t.status, body: stLine });
    if (unit.nextAction?.trim()) out.push({ type: t.next, body: unit.nextAction.trim() });
    if (unit.goal?.trim()) out.push({ type: t.goal, body: unit.goal.trim() });
    out.push({ type: t.progress, body: `${unit.progress}% · ${unit.subtitle}` });
    if (unit.lastUpdatedLabel?.trim()) out.push({ type: t.update, body: unit.lastUpdatedLabel.trim() });
    if (unit.city?.trim()) out.push({ type: t.area, body: unit.city.trim() });
    return out.length > 0 ? out : [{ type: t.unit, body: unit.subtitle || item.subtitle }];
  }
  return [
    { type: t.update, body: item.subtitle || t.ready },
    { type: t.reminder, body: `«${item.title}» — ${t.chatHint}` },
  ];
}

export const BROADCAST_BY_SPACE_HE: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'עדכון', body: 'הודעות חדשות מחכות' },
    { type: 'תזכורת', body: 'תזכורת לרישיון נהיגה' },
    { type: 'עדכון', body: 'פרופיל עודכן בהצלחה' },
    { type: 'הודעה', body: '3 משימות ממתינות' },
    { type: 'תזכורת', body: 'פגישה עם דני מחר' },
    { type: 'עדכון', body: 'סיסמה שונתה' },
  ],
  business: [
    { type: 'הודעה', body: 'דוח רבעוני הועלה' },
    { type: 'תזכורת', body: 'פגישה מחר 09:00' },
    { type: 'עדכון', body: 'חוזה אושר לחתימה' },
    { type: 'תזכורת', body: 'דדליין לפרויקט ביום חמישי' },
    { type: 'עדכון', body: 'הצעת מחיר נשלחה' },
    { type: 'הודעה', body: 'סטטוס לקוח עודכן' },
  ],
  health: [
    { type: 'עדכון', body: 'תוצאות הבדיקות התקבלו' },
    { type: 'תזכורת', body: 'תור לרופא מחר 10:00' },
    { type: 'הודעה', body: 'בדיקות תקינות' },
    { type: 'עדכון', body: 'תור לבדיקת דם אושר' },
    { type: 'תזכורת', body: 'זמן לקחת תרופה' },
    { type: 'עדכון', body: 'רשומות רפואיות זמינות' },
  ],
  finance: [
    { type: 'עדכון', body: 'ההשקעה עלתה 2%' },
    { type: 'תזכורת', body: 'תשלום חודשי מחר' },
    { type: 'הודעה', body: 'דוח מס הוכן' },
    { type: 'עדכון', body: 'העברה הושלמה' },
    { type: 'תזכורת', body: 'חשבון עובר ושב נמוך' },
    { type: 'עדכון', body: 'דיבידנד התקבל' },
  ],
  knowledge: [
    { type: 'עדכון', body: 'התווסף יעד לימוד חדש' },
    { type: 'תזכורת', body: 'זמן לתרגול של 20 דקות' },
    { type: 'הודעה', body: 'שיעור חדש זמין' },
    { type: 'עדכון', body: 'סיכום שיעור נשמר' },
    { type: 'תזכורת', body: 'חזרה לפני מבחן' },
    { type: 'עדכון', body: 'התקדמות הלמידה עודכנה' },
  ],
  leisure: [
    { type: 'תזכורת', body: 'סרט מחר ב־20:00 — כרטיסים ברשימה' },
    { type: 'עדכון', body: 'נוספה המלצה לטיול קצר' },
    { type: 'הודעה', body: 'חברים אישרו פגישה בסופ״ש' },
    { type: 'תזכורת', body: 'זמן לסגור רשימת ציוד לקמפינג' },
    { type: 'עדכון', body: 'מוזיקה חדשה בפלייליסט הפנאי' },
    { type: 'הודעה', body: 'אירוע בשכונה בסוף השבוע' },
  ],
  relations: [
    { type: 'תזכורת', body: 'יום הולדת לסבתא בשבוע הבא — לבחור מתנה' },
    { type: 'הודעה', body: 'חבר שאל מתי ניפגשים' },
    { type: 'עדכון', body: 'נוספה הערה לפגישה עם המשפחה' },
    { type: 'תזכורת', body: 'להחזיר שיחה לדני מהשבוע שעבר' },
    { type: 'עדכון', body: 'רשימת אורחים לערב עודכנה' },
    { type: 'הודעה', body: 'הוזמנתם לאירוע ביום שישי' },
  ],
};

export const BROADCAST_BY_SPACE_EN: Record<string, BroadcastMessage[]> = {
  personal: [
    { type: 'Update', body: 'New messages are waiting' },
    { type: 'Reminder', body: 'Driver license reminder' },
    { type: 'Update', body: 'Profile updated successfully' },
    { type: 'Message', body: '3 tasks pending' },
    { type: 'Reminder', body: 'Meeting with Dani tomorrow' },
    { type: 'Update', body: 'Password changed' },
  ],
  business: [
    { type: 'Message', body: 'Quarterly report uploaded' },
    { type: 'Reminder', body: 'Meeting tomorrow 09:00' },
    { type: 'Update', body: 'Contract ready for signature' },
    { type: 'Reminder', body: 'Project deadline Thursday' },
    { type: 'Update', body: 'Quote sent' },
    { type: 'Message', body: 'Client status updated' },
  ],
  health: [
    { type: 'Update', body: 'Test results received' },
    { type: 'Reminder', body: 'Doctor appointment tomorrow 10:00' },
    { type: 'Message', body: 'Tests within range' },
    { type: 'Update', body: 'Blood test slot confirmed' },
    { type: 'Reminder', body: 'Time to take medication' },
    { type: 'Update', body: 'Medical records available' },
  ],
  finance: [
    { type: 'Update', body: 'Portfolio up 2%' },
    { type: 'Reminder', body: 'Monthly payment due tomorrow' },
    { type: 'Message', body: 'Tax report prepared' },
    { type: 'Update', body: 'Transfer completed' },
    { type: 'Reminder', body: 'Checking account balance low' },
    { type: 'Update', body: 'Dividend received' },
  ],
  knowledge: [
    { type: 'Update', body: 'New study goal added' },
    { type: 'Reminder', body: 'Time for 20 minutes of practice' },
    { type: 'Message', body: 'New lesson available' },
    { type: 'Update', body: 'Lesson summary saved' },
    { type: 'Reminder', body: 'Review before exam' },
    { type: 'Update', body: 'Learning progress updated' },
  ],
  leisure: [
    { type: 'Reminder', body: 'Movie tomorrow 8:00 PM — tickets on your list' },
    { type: 'Update', body: 'Short trip suggestion added' },
    { type: 'Message', body: 'Friends confirmed weekend plans' },
    { type: 'Reminder', body: 'Time to finish the camping gear list' },
    { type: 'Update', body: 'New tracks in your leisure playlist' },
    { type: 'Message', body: 'Neighborhood event this weekend' },
  ],
  relations: [
    { type: 'Reminder', body: "Grandma's birthday next week — pick a gift" },
    { type: 'Message', body: 'Friend asked when to meet' },
    { type: 'Update', body: 'Note added for family dinner' },
    { type: 'Reminder', body: "Return Dani's call from last week" },
    { type: 'Update', body: 'Evening guest list updated' },
    { type: 'Message', body: 'Invited to an event on Friday' },
  ],
};

export function broadcastMessagesForSpace(spaceId: string, language: AppLanguage, units: FlowUnit[]): BroadcastMessage[] {
  const he = language === 'he';
  const open = units
    .filter((u) => u.spaceId === spaceId && u.status !== 'done')
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  if (open.length === 0) {
    return he
      ? [{ type: 'סטטוס', body: 'אין עדיין יחידות פתוחות במרחב הזה. פתחו יחידה חדשה מהצ׳אט.' }]
      : [{ type: 'Status', body: 'No active units in this space yet. Create one from chat.' }];
  }
  const top = open.slice(0, 3);
  return top.map((u) => ({
    type: he ? 'יחידה פעילה' : 'Active unit',
    body: he
      ? `${u.title} · ${u.progress}% · ${u.nextAction || 'ממתין לצעד הבא'}`
      : `${u.title} · ${u.progress}% · ${u.nextAction || 'Waiting for next action'}`,
  }));
}
