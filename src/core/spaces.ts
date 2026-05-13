/**
 * ONE – Spaces & Domains architecture.
 *
 * Space  = top-level identity / context layer  (personal, business, family …)
 * Domain = topic filter inside a Space          (health, learning, finance …)
 * Unit   = the living object that advances      (belongs to a Space + optional Domain)
 *
 * MVP: only `personal` and `business` are fully enabled.
 * `public` is a placeholder — long-term it may become a visibility / discovery layer.
 */

// ─── Ids ────────────────────────────────────────────────────────────────────

export type SpaceId =
  | 'personal'
  | 'business'
  | 'family'
  | 'project'
  | 'community'
  | 'public';

export type DomainId =
  // Personal
  | 'health'
  | 'learning'
  | 'finance'
  | 'relationships'
  | 'leisure'
  | 'personal_growth'
  // Business
  | 'clients'
  | 'sales'
  | 'marketing'
  | 'operations'
  | 'team'
  | 'product'
  // Family
  | 'events'
  | 'kids'
  | 'home'
  | 'travel'
  | 'shopping'
  | 'memories'
  | (string & {}); // custom domains (keeps autocomplete for known ids)

// ─── Config types ───────────────────────────────────────────────────────────

export interface DomainConfig {
  id: DomainId;
  labelHe: string;
  labelEn: string;
  color: string;
}

export interface SpaceConfig {
  id: SpaceId;
  labelHe: string;
  labelEn: string;
  color: string;
  enabled: boolean;
  domains: DomainConfig[];
}

// ─── Domain configs per Space ───────────────────────────────────────────────

const PERSONAL_DOMAINS: DomainConfig[] = [
  { id: 'health',          labelHe: 'בריאות',    labelEn: 'Health',          color: '#22c55e' },
  { id: 'learning',        labelHe: 'לימודים',   labelEn: 'Learning',        color: '#a855f7' },
  { id: 'finance',         labelHe: 'כסף',       labelEn: 'Finance',         color: '#eab308' },
  { id: 'relationships',   labelHe: 'קשרים',     labelEn: 'Relationships',   color: '#f472b6' },
  { id: 'leisure',         labelHe: 'פנאי',      labelEn: 'Leisure',         color: '#fde047' },
  { id: 'personal_growth', labelHe: 'צמיחה',     labelEn: 'Personal Growth', color: '#60a5fa' },
];

const BUSINESS_DOMAINS: DomainConfig[] = [
  { id: 'clients',    labelHe: 'לקוחות',  labelEn: 'Clients',    color: '#38bdf8' },
  { id: 'sales',      labelHe: 'מכירות',  labelEn: 'Sales',      color: '#22c55e' },
  { id: 'marketing',  labelHe: 'שיווק',   labelEn: 'Marketing',  color: '#f59e0b' },
  { id: 'operations', labelHe: 'תפעול',   labelEn: 'Operations', color: '#a78bfa' },
  { id: 'team',       labelHe: 'צוות',    labelEn: 'Team',       color: '#f472b6' },
  { id: 'product',    labelHe: 'מוצר',    labelEn: 'Product',    color: '#06b6d4' },
];

const FAMILY_DOMAINS: DomainConfig[] = [
  { id: 'events',   labelHe: 'אירועים', labelEn: 'Events',   color: '#fb923c' },
  { id: 'kids',     labelHe: 'ילדים',   labelEn: 'Kids',     color: '#f472b6' },
  { id: 'home',     labelHe: 'בית',     labelEn: 'Home',     color: '#a78bfa' },
  { id: 'travel',   labelHe: 'טיולים',  labelEn: 'Travel',   color: '#34d399' },
  { id: 'shopping', labelHe: 'קניות',   labelEn: 'Shopping', color: '#fbbf24' },
  { id: 'memories', labelHe: 'זכרונות', labelEn: 'Memories', color: '#f9a8d4' },
];

// ─── Master SPACES array ────────────────────────────────────────────────────

export const SPACES: SpaceConfig[] = [
  {
    id: 'personal',
    labelHe: 'אישי',
    labelEn: 'Personal',
    color: '#ffffff',
    enabled: true,
    domains: PERSONAL_DOMAINS,
  },
  {
    id: 'business',
    labelHe: 'עסקי',
    labelEn: 'Business',
    color: '#0ea5e9',
    enabled: true,
    domains: BUSINESS_DOMAINS,
  },
  {
    id: 'family',
    labelHe: 'משפחה',
    labelEn: 'Family',
    color: '#f97316',
    enabled: false,
    domains: FAMILY_DOMAINS,
  },
  {
    id: 'project',
    labelHe: 'פרויקט',
    labelEn: 'Project',
    color: '#8b5cf6',
    enabled: false,
    domains: [],
  },
  {
    id: 'community',
    labelHe: 'קהילה',
    labelEn: 'Community',
    color: '#14b8a6',
    enabled: false,
    domains: [],
  },
  {
    id: 'public',
    labelHe: 'ציבורי',
    labelEn: 'Public',
    color: '#64748b',
    enabled: false,
    domains: [],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export const ENABLED_SPACES = SPACES.filter((s) => s.enabled);

export function getSpaceConfig(id: SpaceId): SpaceConfig | undefined {
  return SPACES.find((s) => s.id === id);
}

export function getDomainConfig(spaceId: SpaceId, domainId: DomainId): DomainConfig | undefined {
  return getSpaceConfig(spaceId)?.domains.find((d) => d.id === domainId);
}

export function spaceLabel(id: SpaceId, lang: 'he' | 'en'): string {
  const cfg = getSpaceConfig(id);
  if (!cfg) return id;
  return lang === 'he' ? cfg.labelHe : cfg.labelEn;
}

export function domainLabel(spaceId: SpaceId, domainId: DomainId, lang: 'he' | 'en'): string {
  const cfg = getDomainConfig(spaceId, domainId);
  if (!cfg) return domainId;
  return lang === 'he' ? cfg.labelHe : cfg.labelEn;
}

// ─── Legacy bridge (temporary) ──────────────────────────────────────────────

/**
 * Maps a legacy worldId to the new { spaceId, domainId } pair.
 * Used during migration -- remove once all worldId references are gone.
 */
export function legacyWorldIdToSpaceDomain(worldId: string): { spaceId: SpaceId; domainId?: DomainId } {
  if (worldId === 'personal') return { spaceId: 'personal' };
  if (worldId === 'business') return { spaceId: 'business' };

  for (const space of SPACES) {
    const domain = space.domains.find((d) => d.id === worldId);
    if (domain) return { spaceId: space.id, domainId: domain.id };
  }

  const LEGACY_PERSONAL_WORLD_IDS = ['health', 'finance', 'knowledge', 'learning', 'leisure', 'relations', 'personal_growth', 'relationships'];
  if (LEGACY_PERSONAL_WORLD_IDS.includes(worldId)) {
    const mapped = worldId === 'knowledge' ? 'learning' : worldId === 'relations' ? 'relationships' : worldId;
    return { spaceId: 'personal', domainId: mapped as DomainId };
  }

  const LEGACY_BUSINESS_WORLD_IDS = ['clients', 'marketing', 'sales', 'operations', 'team', 'product'];
  if (LEGACY_BUSINESS_WORLD_IDS.includes(worldId)) {
    return { spaceId: 'business', domainId: worldId as DomainId };
  }

  return { spaceId: 'personal' };
}
