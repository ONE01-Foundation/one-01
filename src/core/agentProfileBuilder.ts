import type { AgentChatProfileModel } from '../components/UnitChatProfile';
import type { FlowUnit } from './flowUnit';
import type { SpaceId, DomainId } from './spaces';
import type { AppLanguage } from '../stores/localeStore';
import { HAT_LABELS, PERSONA_LABELS, type Hat, type AgentPersona } from './types';
import { spaceOrDomainTitle } from './displayHelpers';

type BuildArgs = {
  language: AppLanguage;
  agent: { name?: string; persona?: string; hats?: Hat[] } | undefined;
  userName: string | undefined;
  effectiveChatWorldId: string;
  effectiveChatSpaceId: SpaceId;
  effectiveChatDomainId: DomainId | undefined;
  flowUnits: FlowUnit[];
  /** ephemeral: current session message count, not persisted truth */
  sessionMessageCount: number;
  worlds: Array<{ id: string; label: string; color: string }>;
};

export function buildAgentChatProfileModel(args: BuildArgs): AgentChatProfileModel {
  const {
    language, agent, userName,
    effectiveChatWorldId, effectiveChatSpaceId, effectiveChatDomainId,
    flowUnits, sessionMessageCount, worlds: WORLDS,
  } = args;

  const he = language === 'he';
  const name = agent?.name?.trim() || 'ONE';
  const personaKey = (agent?.persona ?? 'friendly') as AgentPersona;
  const personaLine = `${he ? 'סגנון שיחה' : 'Persona'}: ${PERSONA_LABELS[personaKey]}`;
  const hats = (agent?.hats ?? ['base']).filter((h: Hat) => h !== 'base');
  const hatLabels = hats.length
    ? hats.map((h: Hat) => `${HAT_LABELS[h]} — ${he ? 'הקשר פעיל לפי הצורך' : 'context when relevant'}`)
    : [he ? 'מצב כללי — ללא כובע ממוקד' : 'General mode — no focused hat'];

  const generalWorldLabel = he ? 'כללי' : 'General';
  const activeWorldChatLabel =
    effectiveChatWorldId === 'personal' ? generalWorldLabel : spaceOrDomainTitle(effectiveChatWorldId, language);

  const worlds = WORLDS.map((w) => ({
    id: w.id,
    label: spaceOrDomainTitle(w.id, language),
    color: w.color,
    active: w.id === effectiveChatWorldId,
    detail:
      w.id === 'personal'
        ? he
          ? 'כל היחידות והיסטוריה — ללא סינון מרחב.'
          : 'All units and history — no world filter.'
        : he
          ? `יחידות מתויגות לעולם «${w.label}» והקשר ${w.label} לסוכן.`
          : `Units tagged to «${spaceOrDomainTitle(w.id, 'en')}» and matching context.`,
  }));

  const worldUnitsList =
    effectiveChatSpaceId === 'personal' && !effectiveChatDomainId
      ? flowUnits
      : flowUnits.filter((u) =>
          u.spaceId === effectiveChatSpaceId &&
          (!effectiveChatDomainId || u.domainId === effectiveChatDomainId)
        );
  const activeUnitsInWorld = worldUnitsList.filter((u) => u.status !== 'done').length;
  const worldNameHe = WORLDS.find((w) => w.id === effectiveChatWorldId)?.label ?? 'כללי';
  const worldNameEn = spaceOrDomainTitle(effectiveChatWorldId, 'en');

  const broadcastPrimary = he
    ? effectiveChatWorldId === 'personal'
      ? `יש לך ${activeUnitsInWorld} יחידות פעילות במרחב הכללי.`
      : `יש לך ${activeUnitsInWorld} יחידות פעילות במרחב «${worldNameHe}».`
    : effectiveChatWorldId === 'personal'
      ? `You have ${activeUnitsInWorld} active units in General.`
      : `You have ${activeUnitsInWorld} active units in «${worldNameEn}».`;
  const broadcastSecondary = he ? 'המשך מה שפתחת או התחל משהו חדש.' : 'Continue what you started or begin something new.';

  const msgCount = sessionMessageCount;
  const stats: AgentChatProfileModel['stats'] = he
    ? [
        {
          label: 'יחידות במעקב',
          value: String(worldUnitsList.length),
          hint: `${activeUnitsInWorld} פתוחות, ${worldUnitsList.length - activeUnitsInWorld} אחרות`,
        },
        {
          label: 'הודעות בשיחה',
          value: String(msgCount),
          hint: effectiveChatWorldId === 'personal' ? 'בצ׳אט ONE הנוכחי' : `מיקוד: «${worldNameHe}»`,
        },
        { label: 'מרחבים זמינים', value: String(WORLDS.length), hint: 'כללי, עבודה, בריאות, כסף, לימודים, פנאי, קשרים' },
      ]
    : [
        {
          label: 'Units tracked',
          value: String(worldUnitsList.length),
          hint: `${activeUnitsInWorld} open, ${worldUnitsList.length - activeUnitsInWorld} other`,
        },
        {
          label: 'Messages (chat)',
          value: String(msgCount),
          hint: effectiveChatWorldId === 'personal' ? 'In this ONE chat' : `Focus: «${worldNameEn}»`,
        },
        { label: 'Worlds', value: String(WORLDS.length), hint: 'General + 6 life lenses' },
      ];

  const permissions: AgentChatProfileModel['permissions'] = he
    ? [
        { label: 'התראות ועדכונים', state: 'on', note: 'תזכורות ליחידות וסטטוס סוכן.' },
        { label: 'גלריה / מצלמה', state: 'limited', note: 'רק אחרי שתאשרו בבחירת קובץ.' },
        { label: 'מיקרופון (הקלטה)', state: 'limited', note: 'לשימוש בצ׳אט כשתפעילו הקלטה.' },
        { label: 'אנשי קשר מהמכשיר', state: 'off', note: 'מתוכנן — שיתוף אנשי קשר בבחירה מפורשת.' },
        { label: 'מיקום', state: 'off', note: 'לא נאסף אוטומטית בגרסה זו.' },
      ]
    : [
        { label: 'Notifications', state: 'on', note: 'Unit reminders and agent status.' },
        { label: 'Gallery / camera', state: 'limited', note: 'Only after you approve a picker flow.' },
        { label: 'Microphone', state: 'limited', note: 'When you start voice capture in chat.' },
        { label: 'Device contacts', state: 'off', note: 'Planned — explicit sharing only.' },
        { label: 'Location', state: 'off', note: 'Not collected automatically in this build.' },
      ];

  const userDisplay = userName?.trim() || (he ? 'את/ה' : 'You');
  const contacts: AgentChatProfileModel['contacts'] = he
    ? [
        { role: 'בעלים של החשבון', name: userDisplay, note: 'העדפות, שפה ומראה נשמרים אצלך במכשיר ובחשבון.' },
        { role: 'סוכן אישי', name, note: 'מנוע אחד — כובעים שונים לפי מרחב.' },
        { role: 'ספקים חיצוניים', name: he ? 'לפי יחידה' : 'Per unit', note: he ? 'יופיעו כשתחברו שירות או איש קשר לתהליך.' : 'Appear when you link a service or person to a unit.' },
      ]
    : [
        { role: 'Account owner', name: userDisplay, note: 'Preferences, language, appearance.' },
        { role: 'Personal agent', name, note: 'One engine — different hats per world.' },
        { role: 'External parties', name: 'Per unit', note: 'Shown when you attach providers to a process.' },
      ];

  const dataRows: AgentChatProfileModel['dataRows'] = he
    ? [
        { label: 'יחידות במערכת', value: String(worldUnitsList.length) },
        { label: 'מרחב נוכחי בצ׳אט', value: activeWorldChatLabel },
        { label: 'כובעים פעילים', value: hats.map((h: Hat) => HAT_LABELS[h]).join(', ') || HAT_LABELS.base },
        { label: 'זיכרון שיחה', value: 'שמירת הקשר בתוך היחידה' },
      ]
    : [
        { label: 'Units in workspace', value: String(worldUnitsList.length) },
        { label: 'Current chat world', value: activeWorldChatLabel },
        { label: 'Active hats', value: hats.map((h: Hat) => HAT_LABELS[h]).join(', ') || HAT_LABELS.base },
        { label: 'Conversation memory', value: 'Context is kept per unit' },
      ];

  return {
    name,
    tagline: he
      ? 'מנהל אישי אחד — מסונכרן בין מרחבים, יחידות והרשאות.'
      : 'One personal manager — synced across worlds, units, and permissions.',
    personaLine,
    broadcastPrimary,
    broadcastSecondary,
    worlds,
    hatsIntro: he
      ? 'הכובעים מצמצמים את ההקשר: אותו סוכן, פרשנות שונה לפי חיים / עבודה / בריאות / כסף.'
      : 'Hats narrow context: same agent, different emphasis per life area.',
    hatLabels,
    permissions,
    contacts,
    dataRows,
    stats,
    privacyLead: he
      ? 'המידע משמש לתאם משימות ולהציג לך סיכומים. לא מוכרים פרופילים לצד שלישי לצורכי פרסום.'
      : 'Data is used to coordinate tasks and show you summaries. No ad-profile resale.',
    opsBullets: he
      ? [
          'מודל שפה בענן — תוכן השיחה נשלח לעיבוד לפי בקשתך.',
          'גיבויים: חשבון ONE וסנכרון מכשיר לפי ההגדרות שלך.',
          'מפתחות API ואינטגרציות — יופיעו כאן כשיתווספו.',
        ]
      : [
          'Language model in the cloud — chat content is sent when you ask.',
          'Backups: ONE account and device sync per your settings.',
          'API keys & integrations — will appear here when connected.',
        ],
    nextHint: he
      ? 'פתחו יחידה מהגלגל או חברו איש קשר לתהליך — הסוכן יעדכן כאן הרשאות ונתונים לפי הצורך.'
      : 'Open a unit from the wheel or attach a contact — permissions and data update as you go.',
    summary: he
      ? 'זהו כרטיס בית לסוכן: איפה הוא עובד, מה מותר לו, מי מחובר, ומה נמדד. השאר נבנה מתוך השיחה והיחידות.'
      : 'Home card for your agent: where it works, what is allowed, who is involved, and what we measure — grown from chat and units.',
    metaFoot: he
      ? 'נתונים מינימליים — שקיפות מקסימלית. לשינוי הרשאות: הגדרות המערכת והנחיות בצ׳אט.'
      : 'Minimal data — maximal clarity. Change permissions via system settings and chat.',
  };
}
