import type { AppLanguage } from '../stores/localeStore';
import type { DevPreviewProfile } from '../stores/devModeStore';
import { legacyWorldIdToSpaceDomain } from '../core/spaces';
import type { FlowUnit, OrbItem } from '../core/flowUnit';
import { ORB_DATA_BY_WORLD, ORB_DATA_BY_WORLD_EN } from './orbCatalog';

export function generateAiSyntheticProfile(language: AppLanguage): { personalOrbs: OrbItem[]; flowUnits: FlowUnit[] } {
  const catalog = language === 'he' ? ORB_DATA_BY_WORLD : ORB_DATA_BY_WORLD_EN;
  const personal = [...(catalog.personal ?? [])];
  const salt = Date.now();
  const flowUnits: FlowUnit[] = [];
  const syntheticOrbs: OrbItem[] = [];
  const lensWorlds = ['business', 'health', 'finance', 'knowledge', 'leisure', 'relations'] as const;
  lensWorlds.forEach((wid, wi) => {
    const rows = (catalog[wid] ?? []).filter((o) => o.id !== 'origin');
    const pickCount = 1 + (wi % 2);
    rows.slice(0, pickCount).forEach((orb, j) => {
      const id = `syn_${wid}_${j}_${salt}`;
      const he = language === 'he';
      const { spaceId: _sp, domainId: _dm } = legacyWorldIdToSpaceDomain(wid);
      flowUnits.push({
        id,
        spaceId: _sp,
        domainId: _dm,
        title: orb.title,
        subtitle: orb.subtitle,
        emoji: orb.emoji,
        status: 'active',
        progress: 12 + ((wi * 7 + j * 3 + salt) % 40),
        steps: 10 + j * 2,
        messages: [
          {
            id: `m_${id}`,
            sender: 'one',
            text: he
              ? `יחידת דוגמה שנוצרה אוטומטית — פרופיל משתמש פוטנציאלי לבדיקת ממשק.`
              : `Auto-generated demo unit — synthetic potential-user profile for UI testing.`,
            sentAt: Date.now(),
          },
        ],
        goal: orb.subtitle,
        nextAction: he ? 'צעד הבא לדוגמה' : 'Sample next step',
        peopleRoles: [
          { id: 'p1', role: he ? 'סוכן' : 'Agent', name: 'ONE' },
          { id: 'p2', role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
        ],
        lastUpdatedLabel: he ? 'נוצר בגנרטור' : 'Generated',
        blockCount: 4,
      });
      syntheticOrbs.push({ id, emoji: orb.emoji, title: orb.title, subtitle: orb.subtitle });
    });
  });
  return { personalOrbs: [...personal, ...syntheticOrbs], flowUnits };
}

export function generateBusinessWorkspaceSeed(language: AppLanguage): { personalOrbs: OrbItem[]; flowUnits: FlowUnit[] } {
  const catalog = language === 'he' ? ORB_DATA_BY_WORLD : ORB_DATA_BY_WORLD_EN;
  const he = language === 'he';
  const businessRoot = [...(catalog.business ?? [{ id: 'origin', emoji: '🏢', title: he ? 'סקירת עסק' : 'Business overview', subtitle: '' }])];
  const worldIds: Array<'clients' | 'marketing' | 'sales' | 'operations' | 'finance' | 'team'> = [
    'clients',
    'marketing',
    'sales',
    'operations',
    'finance',
    'team',
  ];
  const flowUnits: FlowUnit[] = [];
  const orbs: OrbItem[] = [...businessRoot];
  worldIds.forEach((wid, wi) => {
    const rows = (catalog[wid] ?? []).filter((o) => o.id !== 'origin').slice(0, 2);
    rows.forEach((orb, j) => {
      const id = `biz_seed_${wid}_${j}`;
      const { spaceId: _bsp, domainId: _bdm } = legacyWorldIdToSpaceDomain(wid);
      flowUnits.push({
        id,
        spaceId: _bsp,
        domainId: _bdm,
        title: orb.title,
        subtitle: orb.subtitle,
        emoji: orb.emoji,
        status: 'active',
        progress: 18 + wi * 7 + j * 6,
        steps: 10 + wi + j,
        messages: [
          {
            id: `seed_msg_${id}`,
            sender: 'one',
            text: he
              ? `יחידת עסק לדוגמה נוצרה כדי שתוכל לראות תפעול אמיתי במוצר.`
              : `Business demo unit created so you can simulate real operations in-product.`,
            sentAt: Date.now(),
          },
        ],
        goal: orb.subtitle,
        nextAction: he ? 'לעדכן סטטוס יומי ולהתקדם לצעד הבא' : 'Update daily status and move to the next step',
        peopleRoles: [
          { id: `owner_${id}`, role: he ? 'אחראי/ת' : 'Owner', name: he ? 'את/ה' : 'You' },
          { id: `agent_${id}`, role: he ? 'סוכן' : 'Agent', name: 'ONE' },
        ],
        lastUpdatedLabel: he ? 'נזרע במרחב עסקי' : 'Seeded in business workspace',
        blockCount: 5,
      });
      orbs.push({ id, emoji: orb.emoji, title: orb.title, subtitle: orb.subtitle });
    });
  });
  return { personalOrbs: orbs, flowUnits };
}

export const DEV_PROFILE_PRESETS: Record<DevPreviewProfile, { personalOrbs: OrbItem[]; flowUnits: FlowUnit[]; planTier: 'FREE' | 'PRO' | 'MAX' }> = {
  new_user: {
    personalOrbs: [{ id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' }],
    flowUnits: [],
    planTier: 'FREE',
  },
  consumer: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'license', emoji: '🚗', title: 'רישיון נהיגה', subtitle: 'תיאוריה, שיעורים, מבחן' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  student: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'study_plan', emoji: '📚', title: 'תוכנית למידה', subtitle: 'נושאים, תרגול, מבחן' },
      { id: 'exam', emoji: '📝', title: 'הכנה למבחן', subtitle: 'סילבוס, תרגול, חזרות' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  creator: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'content', emoji: '🎬', title: 'הפקת תוכן', subtitle: 'רעיון, צילום, עריכה' },
      { id: 'launch', emoji: '🚀', title: 'השקה', subtitle: 'עמוד נחיתה, פרסום, מדידה' },
    ],
    flowUnits: [],
    planTier: 'FREE',
  },
  teacher_business: {
    personalOrbs: [
      { id: 'origin', emoji: '👤', title: 'ראשי', subtitle: '' },
      { id: 'class_plan', emoji: '👩‍🏫', title: 'מערך שיעור', subtitle: 'מבנה, משימות, משוב' },
      { id: 'business_ops', emoji: '💼', title: 'תפעול עסק', subtitle: 'לקוחות, גביה, מעקב' },
    ],
    flowUnits: [],
    planTier: 'PRO',
  },
  pro_user: {
    personalOrbs: ORB_DATA_BY_WORLD.personal,
    flowUnits: [],
    planTier: 'PRO',
  },
  max_user: {
    personalOrbs: ORB_DATA_BY_WORLD.personal,
    flowUnits: [],
    planTier: 'MAX',
  },
};
