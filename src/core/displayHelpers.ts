import type { AppLanguage } from '../stores/localeStore';
import type { UnitChatProfileModel, UnitProfilePerson } from '../components/UnitChatProfile';

export type ChatLine = { id: string; sender: 'user' | 'one'; text: string; sentAt?: number };

export function startOfLocalDayMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function inferMessageSentAt(line: ChatLine, index: number, total: number): number {
  if (line.sentAt != null) return line.sentAt;
  const daysBack = Math.max(0, total - 1 - index);
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.getTime();
}

export function formatChatDayStickyLabel(sentAt: number, he: boolean): string {
  const now = Date.now();
  const sodNow = startOfLocalDayMs(now);
  const sodMsg = startOfLocalDayMs(sentAt);
  const diffDays = Math.round((sodNow - sodMsg) / 86400000);
  if (diffDays === 0) return he ? 'היום' : 'Today';
  if (diffDays === 1) return he ? 'אתמול' : 'Yesterday';
  if (diffDays === 2) return he ? 'שלשום' : '2 days ago';
  if (he) {
    return new Date(sentAt).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      ...(new Date(sentAt).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
    });
  }
  return new Date(sentAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(new Date(sentAt).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatUnitLogStatusLine(
  status: UnitChatProfileModel['status'],
  progress: number,
  steps: number,
  language: AppLanguage,
): string {
  if (language === 'he') {
    const statusHe = status === 'active' ? 'פעיל' : status === 'waiting' ? 'ממתין' : 'הושלם';
    return `${statusHe} · ${progress}% · ${steps} צעדים`;
  }
  return `${status} · ${progress}% · ${steps} steps`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/.{2}/g);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export const SPACE_LABEL_HE: Record<string, string> = {
  personal: 'ראשי',
  business: 'עבודה',
  health: 'בריאות',
  finance: 'כסף',
  knowledge: 'לימודים',
  learning: 'לימודים',
  leisure: 'פנאי',
  relations: 'קשרים',
  relationships: 'קשרים',
  clients: 'לקוחות',
  marketing: 'שיווק',
  sales: 'מכירות',
  operations: 'תפעול',
  team: 'צוות',
  personal_growth: 'צמיחה',
};

export const SPACE_LABEL_EN: Record<string, string> = {
  personal: 'General',
  business: 'Work',
  health: 'Health',
  finance: 'Finance',
  knowledge: 'Learning',
  learning: 'Learning',
  leisure: 'Leisure',
  relations: 'Relationships',
  relationships: 'Relationships',
  clients: 'Clients',
  marketing: 'Marketing',
  sales: 'Sales',
  operations: 'Operations',
  team: 'Team',
  personal_growth: 'Personal Growth',
};

export function spaceOrDomainTitle(id: string, language: AppLanguage): string {
  if (language === 'he') return SPACE_LABEL_HE[id] ?? id;
  return SPACE_LABEL_EN[id] ?? id;
}

export function getTimeGreeting(hour: number, name: string, language: AppLanguage): string {
  if (language === 'en') {
    if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
    if (hour >= 12 && hour < 18) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  }
  if (hour >= 5 && hour < 12) return `בוקר טוב, ${name}`;
  if (hour >= 12 && hour < 18) return `צהריים טובים, ${name}`;
  return `ערב טוב, ${name}`;
}

export function progressColorByPct(pct: number, isDark: boolean): string {
  if (pct < 0.15) return isDark ? '#71717a' : '#a1a1aa';
  if (pct < 0.4) return '#f97316';
  if (pct < 0.7) return '#eab308';
  return '#22c55e';
}

export function contactInitials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return t.slice(0, Math.min(2, t.length)).toUpperCase();
}

export function filterUnitChatParticipants(roles: UnitProfilePerson[] | undefined): UnitProfilePerson[] {
  if (!roles?.length) return [];
  return roles.filter((p) => {
    const rawName = (p.name ?? '').trim();
    const name = rawName.toLowerCase();
    const role = (p.role ?? '').trim().toLowerCase();
    if (role === 'סוכן' || role === 'agent') {
      if (name === 'one') return false;
    }
    if (rawName === 'את/ה' || name === 'you') return false;
    return true;
  });
}
