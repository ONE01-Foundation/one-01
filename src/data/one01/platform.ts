/**
 * ONE01 platform model — ported from the ONE Platform web app
 * (`Main/one/apps/web/lib/theme.ts`, `one01-surfaces.ts`,
 * `product-shell-content.ts`). Pure data, RN-safe (no web imports), consumed by
 * `screens/mvp/One01Platform.tsx`.
 *
 * ONE01 is the shared layer. Products (ONE / Winzi / MixStar) are apps that live
 * on it — same rails (wallet, identity, Market, Creator), different skin. The
 * hub lists the whole ecosystem; each product opens its own themed shell.
 */

export type ProductId = 'one' | 'winzi' | 'mixstar';
export type MarkId = 'one' | 'winzi' | 'mixstar' | 'xit' | 'sodex' | 'one01';
export type CategoryId = 'all' | 'business' | 'finance' | 'health' | 'knowledge' | 'leisure';

export interface NavItem {
  icon: string;
  label: string;
  /** Which shell tab this routes to. */
  tab: 'home' | 'market' | 'wallet' | 'creator' | 'profile';
  isCenter?: boolean;
}

export interface ProductCanvas {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
}

export interface ProductTheme {
  id: ProductId;
  name: string;
  tagline: string;
  mark: MarkId;
  accent: string;
  accentFg: string;
  secondaryAccent: string;
  canvas: ProductCanvas;
  nav: NavItem[];
  features: {
    battles: boolean;
    characters: boolean;
    processes: boolean;
    betting: boolean;
    crypto: boolean;
    fiat: boolean;
  };
}

export const PRODUCTS: Record<ProductId, ProductTheme> = {
  one: {
    id: 'one',
    name: 'ONE',
    tagline: 'ONE01 hub — market, creator & wallet in one place',
    mark: 'one',
    accent: '#10B981',
    accentFg: '#000000',
    secondaryAccent: '#6366F1',
    canvas: { bg: '#0A0C0B', surface: '#14171A', surface2: '#1C2024', text: '#F3F6F4', muted: '#9BA6A1', border: '#242A28' },
    nav: [
      { icon: '◉', label: 'Home', tab: 'home' },
      { icon: '◈', label: 'Market', tab: 'market' },
      { icon: '◎', label: '', tab: 'wallet', isCenter: true },
      { icon: '✦', label: 'Creator', tab: 'creator' },
      { icon: '👤', label: 'Profile', tab: 'profile' },
    ],
    features: { battles: false, characters: false, processes: true, betting: false, crypto: false, fiat: true },
  },
  winzi: {
    id: 'winzi',
    name: 'Winzi',
    tagline: 'Skill games on ONE01 — ranked play & wallet',
    mark: 'winzi',
    accent: '#F9D800',
    accentFg: '#000000',
    secondaryAccent: '#8B5CF6',
    canvas: { bg: '#121006', surface: '#1D1A0C', surface2: '#272212', text: '#F8F5E8', muted: '#B3AA86', border: '#2E2914' },
    nav: [
      { icon: '🎮', label: 'Home', tab: 'home' },
      { icon: '🛒', label: 'Market', tab: 'market' },
      { icon: '👑', label: '', tab: 'wallet', isCenter: true },
      { icon: '🏆', label: 'Ranks', tab: 'creator' },
      { icon: '👤', label: 'Profile', tab: 'profile' },
    ],
    features: { battles: true, characters: false, processes: false, betting: true, crypto: true, fiat: false },
  },
  mixstar: {
    id: 'mixstar',
    name: 'MixStar',
    tagline: 'Interactive seasons on ONE01 — vote, bet, watch',
    mark: 'mixstar',
    accent: '#8B5CF6',
    accentFg: '#ffffff',
    secondaryAccent: '#EC4899',
    canvas: { bg: '#0F0A1C', surface: '#191130', surface2: '#221842', text: '#F3EEFB', muted: '#A99BC4', border: '#2A1F4A' },
    nav: [
      { icon: '📺', label: 'Home', tab: 'home' },
      { icon: '🎲', label: 'Market', tab: 'market' },
      { icon: '✦', label: '', tab: 'wallet', isCenter: true },
      { icon: '🗳️', label: 'Vote', tab: 'creator' },
      { icon: '👤', label: 'Profile', tab: 'profile' },
    ],
    features: { battles: false, characters: true, processes: false, betting: true, crypto: true, fiat: true },
  },
};

export const PRODUCT_ORDER: ProductId[] = ['one', 'winzi', 'mixstar'];

/* ───────────────────────────── Featured slides (per product) ───────────────────────────── */

export interface ShellHero {
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
}

export const FEATURED_SLIDES: Record<ProductId, ShellHero[]> = {
  one: [
    { badge: 'ONE01', title: 'Open digital square for makers & fans', subtitle: 'ONE01 is the shared layer: brands, landing pages, and live products meet in one automated marketplace — produce, list, and spend without splitting your stack.', ctaLabel: 'Explore Market' },
    { badge: 'News', title: 'Faster settlement on fiat rails', subtitle: 'Deposits and withdrawals clear with fewer steps. Wallet limits and corridors apply per product on the same ONE01 identity.', ctaLabel: 'Open wallet' },
    { badge: 'Featured', title: 'Creator — publish in one flow', subtitle: 'Ship drops and workflows from ONE; reach audiences across apps born on ONE01. Early access for verified accounts.', ctaLabel: 'Try Creator' },
  ],
  winzi: [
    { badge: 'Live', title: 'Winzi — skill matches, real stakes', subtitle: 'Built on ONE01: queue into battles, climb ranks, and cash out to your product wallet with the same rails as the rest of the ecosystem.', ctaLabel: 'Browse battles' },
    { badge: 'News', title: 'Ranked season reset', subtitle: 'Leaderboards refresh Monday UTC. Placement matches determine your starting tier — play three to lock in.', ctaLabel: 'View ranks' },
    { badge: 'Featured', title: 'Battle rooms — new pools', subtitle: 'Higher buy-ins this week on duel and bracket formats. Spectate live before you jump in.', ctaLabel: 'Enter lobby' },
  ],
  mixstar: [
    { badge: 'S1', title: 'MixStar — votes that change the show', subtitle: 'A ONE01 show product: follow contestants, place calls, and watch odds move live as episodes air.', ctaLabel: 'Open market' },
    { badge: 'News', title: 'Episode 6 — voting closes tonight', subtitle: 'Odds shift after the immunity round. Lock your picks before the window ends in your timezone.', ctaLabel: 'See contestants' },
    { badge: 'Featured', title: 'Wildcard drop — limited calls', subtitle: 'Double your vote weight on a single contestant this week. One use per account.', ctaLabel: 'Go to market' },
  ],
};

/* ───────────────────────────── Ecosystem apps (ONE01 hub grid) ───────────────────────────── */

export interface EcosystemApp {
  id: string;
  name: string;
  tagline: string;
  domain: string;
  mark: MarkId;
  /** 'accent' → tinted tile; 'dark' → near-black tile (for marks designed on black). */
  tile: 'accent' | 'dark';
  accent: string;
  cta: string;
  /** Opens a product shell in-app when set; otherwise an external product. */
  product?: ProductId;
}

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  { id: 'winzi', name: 'Winzi', tagline: 'Skill games on ONE01', domain: 'winzi.one', mark: 'winzi', tile: 'dark', accent: '#F9D800', cta: 'Play', product: 'winzi' },
  { id: 'mixstar', name: 'MixStar TV', tagline: 'Reality seasons on ONE01', domain: 'mixstar.one', mark: 'mixstar', tile: 'dark', accent: '#8B5CF6', cta: 'Watch', product: 'mixstar' },
  { id: 'xit', name: 'Xit', tagline: 'News & trends coins', domain: 'xit.one', mark: 'xit', tile: 'dark', accent: '#48FC84', cta: 'Open' },
  { id: 'sodex', name: 'Sodex', tagline: 'Spiritual intelligence', domain: 'sodex.one', mark: 'sodex', tile: 'dark', accent: '#D4D4D4', cta: 'Open' },
  { id: 'market', name: 'ONE Market', tagline: 'Liquidity across ONE01 apps', domain: 'one.market', mark: 'one01', tile: 'accent', accent: '#CA8A04', cta: 'Trade', product: 'one' },
  { id: 'creator', name: 'ONE Creator', tagline: 'Publish into the ONE01 graph', domain: 'creator.one', mark: 'one01', tile: 'accent', accent: '#9333EA', cta: 'Create', product: 'one' },
];

/* ───────────────────────────── Category filter chips ───────────────────────────── */

export const CATEGORY_FILTERS: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'business', label: 'Business' },
  { id: 'finance', label: 'Finance' },
  { id: 'health', label: 'Health' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'leisure', label: 'Leisure' },
];

/* ───────────────────────────── Market / Creator surfaces ───────────────────────────── */

export interface SurfacePillar {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  detail: string;
  category: CategoryId;
  price: string;
}

export interface MarketSurface {
  headline: string;
  subtitle: string;
  structureLine: string;
  pillars: SurfacePillar[];
}

export interface CreatorSurface {
  headline: string;
  subtitle: string;
  structureLine: string;
  title: string;
  pillars: SurfacePillar[];
}

export const MARKET: Record<ProductId, MarketSurface> = {
  one: {
    headline: 'Market on ONE01',
    subtitle: 'Acquire listings, services, and capacity — same settlement and identity as every other app on the platform.',
    structureLine: 'Market = buy. Creator = build. Both sit on ONE01 rails.',
    pillars: [
      { id: 'listings', title: 'Listings & SKUs', emoji: '◈', tagline: 'Digital goods, templates, and packs.', detail: 'Protocol packs, workflow templates, agent presets, and third-party services published into the ONE01 graph.', category: 'business', price: '◎ 40' },
      { id: 'services', title: 'Org & agent time', emoji: '◇', tagline: 'Book human or automated capacity.', detail: 'Blocks from verified organizations and agents — onboarding, compliance checks, or scripted automations.', category: 'business', price: '◎ 120' },
      { id: 'liquidity', title: 'Liquidity & credits', emoji: '◆', tagline: 'Top up product-specific balance.', detail: 'Move value into this product wallet to spend across Market odds, Creator publishes, and in-flow charges.', category: 'finance', price: '◎ —' },
      { id: 'data', title: 'Signals & feeds', emoji: '⬡', tagline: 'Data products and webhooks.', detail: 'Curated feeds, analytics slices, and webhook bundles for builders wiring agents on top of ONE01.', category: 'knowledge', price: '◎ 25' },
    ],
  },
  winzi: {
    headline: 'Winzi Market',
    subtitle: 'Everything you buy to play harder — still settled on ONE01, same Market pattern as ONE and MixStar.',
    structureLine: 'Market acquires assets; Studio authors new ones. Winzi focuses on play.',
    pillars: [
      { id: 'maps', title: 'Maps & arenas', emoji: '🗺️', tagline: 'Community maps and room layouts.', detail: 'Licensed or community-built maps, seasonal arenas, and featured playlists you drop into matchmaking.', category: 'leisure', price: '◎ 15' },
      { id: 'skins', title: 'Skins & cosmetics', emoji: '🎨', tagline: 'Visual identity for your profile.', detail: 'Character skins, weapon wraps, and profile flair — tradable or minted editions where applicable.', category: 'leisure', price: '◎ 30' },
      { id: 'modes', title: 'Modes & mutators', emoji: '⚙️', tagline: 'Rulesets and modifiers.', detail: 'Official or creator-authored game mutators: low-gravity weeks, draft rules, or ranked twists.', category: 'leisure', price: '◎ 10' },
      { id: 'tickets', title: 'Tournament tickets', emoji: '🏆', tagline: 'Entry and season passes.', detail: 'Paid brackets, league passes, and spectator bundles — pooled prizes settle through your Winzi wallet.', category: 'finance', price: '◎ 50' },
    ],
  },
  mixstar: {
    headline: 'MixStar Market',
    subtitle: 'Fan economy layer for the show — purchases mirror the same ONE01 Market shell as ONE and Winzi.',
    structureLine: 'Buy boosts and packs here; author formats and promos in Vote.',
    pillars: [
      { id: 'votes', title: 'Vote packs', emoji: '🗳️', tagline: 'Weighted votes and saves.', detail: 'Bundles that increase vote weight, redemption windows, or immunity tokens for specific episodes.', category: 'leisure', price: '◎ 12' },
      { id: 'odds', title: 'Odds & hedges', emoji: '📈', tagline: 'Market-priced calls.', detail: 'Liquidity around contestant outcomes — always labeled, always settled against your MixStar balance.', category: 'finance', price: '◎ —' },
      { id: 'merch', title: 'Digital merch', emoji: '✨', tagline: 'Collectibles and badges.', detail: 'Episode stamps, limited badges, and AR overlays tied to live moments.', category: 'leisure', price: '◎ 20' },
      { id: 'access', title: 'Access passes', emoji: '🎫', tagline: 'Backstage and early cuts.', detail: 'Time-boxed access to bonus scenes, rehearsal feeds, or director-commentary tracks.', category: 'leisure', price: '◎ 35' },
    ],
  },
};

export const CREATOR: Record<ProductId, CreatorSurface> = {
  one: {
    headline: 'Creator on ONE01',
    subtitle: 'Author the graph: organizations, agents, protocols, and processes — the control plane for how work runs.',
    structureLine: 'ONE Creator is the build surface; ONE Market is where those assets are discovered and purchased.',
    title: 'Creator',
    pillars: [
      { id: 'orgs', title: 'Organizations', emoji: '🏢', tagline: 'Legal and operating entities.', detail: 'Register teams, DAOs, or brands as first-class orgs with roles, treasury hooks, and shared wallets.', category: 'business', price: 'Build' },
      { id: 'agents', title: 'Agents', emoji: '🤖', tagline: 'Automations with guardrails.', detail: 'Deploy AI or scripted agents with scoped permissions: draft protocols, file tasks, or call APIs you approve.', category: 'knowledge', price: 'Build' },
      { id: 'protocols', title: 'Protocols', emoji: '📜', tagline: 'Rules encoded as flows.', detail: 'Turn policies and checklists into executable protocol graphs others can fork, audit, or buy on Market.', category: 'knowledge', price: 'Build' },
      { id: 'processes', title: 'Processes', emoji: '◎', tagline: 'Guided runs for humans.', detail: 'Step-by-step flows with milestones, costs, and handoffs — onboarding, launches, or compliance journeys.', category: 'business', price: 'Build' },
    ],
  },
  winzi: {
    headline: 'Winzi Studio',
    subtitle: 'Author what players buy: maps, skins, modes, and tournaments — same ONE01 Creator pattern, game-native tools.',
    structureLine: 'Studio outputs land in Market; rankings and wallet stay on Winzi / ONE01 rails.',
    title: 'Ranks',
    pillars: [
      { id: 'maps', title: 'Maps', emoji: '🗺️', tagline: 'Build arenas players queue into.', detail: 'Terrain kits, spawn logic, and lighting presets. Submit for review, publish editions, price on Market.', category: 'leisure', price: 'Build' },
      { id: 'skins', title: 'Skins', emoji: '🎨', tagline: 'Cosmetics with rarity curves.', detail: 'Mesh swaps, VFX trails, and audio stingers — bundle as drops or season passes.', category: 'leisure', price: 'Build' },
      { id: 'modes', title: 'Game modes', emoji: '🎮', tagline: 'Mutators and rule stacks.', detail: 'Compose official APIs into new modes: timers, loadouts, and scoring tables validated before going live.', category: 'leisure', price: 'Build' },
      { id: 'tournaments', title: 'Tournaments', emoji: '🏆', tagline: 'Brackets and prize pools.', detail: 'Define entry fees, seeding rules, and payout curves. Results post to ranks.', category: 'finance', price: 'Build' },
    ],
  },
  mixstar: {
    headline: 'MixStar Creator',
    subtitle: 'Shape the show: vote mechanics, promos, and fan-facing assets — still ONE01 Creator, tuned for episodic TV.',
    structureLine: 'What you author here is what fans later buy or unlock through MixStar Market.',
    title: 'Vote',
    pillars: [
      { id: 'formats', title: 'Vote formats', emoji: '🗳️', tagline: 'Mechanics per episode arc.', detail: 'Configure how votes land: ranked choice, duels, or team saves — with caps and anti-abuse defaults.', category: 'leisure', price: 'Build' },
      { id: 'promos', title: 'Promos & drops', emoji: '📣', tagline: 'Timed fan campaigns.', detail: 'Schedule double-vote windows, sponsor integrations, and social unlocks tied to broadcast beats.', category: 'business', price: 'Build' },
      { id: 'assets', title: 'Show assets', emoji: '🎬', tagline: 'Clips, AR, and overlays.', detail: 'Upload or link creative packs that Market sells as merch or access passes.', category: 'leisure', price: 'Build' },
      { id: 'story', title: 'Story branches', emoji: '✦', tagline: 'Optional narrative forks.', detail: 'Lightweight branching metadata so apps and agents know which storyline a fan is following.', category: 'knowledge', price: 'Build' },
    ],
  },
};

/* ───────────────────────────── Home skeleton content (per product) ───────────────────────────── */

export interface HomeCategory {
  id: string;
  label: string;
  emoji?: string;
}

export interface HomeItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Card artwork stand-in (games/shows). */
  emoji?: string;
  /** Project-row brand mark (ONE01). */
  mark?: MarkId;
  /** Tap → open this product's shell. */
  product?: ProductId;
  /** Card gradient [from, to] (games/shows). */
  bg?: [string, string];
  /** Corner metric, e.g. "48", "13k". */
  metric?: string;
  live?: boolean;
}

export interface HomeConfig {
  categories: HomeCategory[];
  sectionIcon: string;
  sectionTitle: string;
  sectionCount?: number;
  /** 'rows' = vertical project rows (ONE01); 'cards' = horizontal artwork cards. */
  layout: 'rows' | 'cards';
  items: HomeItem[];
}

export const HOME: Record<'one01' | ProductId, HomeConfig> = {
  one01: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'health', label: 'Health', emoji: '❤️' },
      { id: 'business', label: 'Business', emoji: '💼' },
    ],
    sectionIcon: '🚀',
    sectionTitle: 'Projects',
    sectionCount: 4,
    layout: 'rows',
    items: [
      { id: 'winzi', title: 'Winzi', subtitle: 'Play Games, Win Money', mark: 'winzi', product: 'winzi' },
      { id: 'mixstar', title: 'MixStar', subtitle: 'AI Reality TV', mark: 'mixstar', product: 'mixstar' },
      { id: 'xit', title: 'Xit', subtitle: 'News & trends coins', mark: 'xit' },
      { id: 'sodex', title: 'Sodex', subtitle: 'Spiritual intelligence', mark: 'sodex' },
    ],
  },
  one: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'business', label: 'Business', emoji: '💼' },
      { id: 'finance', label: 'Finance', emoji: '💰' },
    ],
    sectionIcon: '◎',
    sectionTitle: 'Processes',
    layout: 'cards',
    items: [
      { id: 'license', title: 'Renew license', emoji: '🪪', bg: ['#065F46', '#032A20'], metric: '3' },
      { id: 'car', title: 'Car deal', emoji: '🚗', bg: ['#1E40AF', '#0F1F4D'], metric: '2' },
      { id: 'handyman', title: 'Handyman', emoji: '🔧', bg: ['#374151', '#1F2937'], metric: '1' },
    ],
  },
  winzi: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'action', label: 'Action', emoji: '🔫' },
      { id: 'sports', label: 'Sports', emoji: '🏀' },
    ],
    sectionIcon: '🎮',
    sectionTitle: 'Games',
    layout: 'cards',
    items: [
      { id: 'pong', title: 'Pong', emoji: '🏓', bg: ['#1E3A8A', '#0F1F4D'], metric: '48' },
      { id: 'sniper', title: 'Sniper', emoji: '🎯', bg: ['#14532D', '#0A2A17'], metric: '85' },
      { id: 'jets', title: 'Jets', emoji: '✈️', bg: ['#3730A3', '#1E1B4B'], metric: '62' },
      { id: 'racer', title: 'Racer', emoji: '🏎️', bg: ['#7C2D12', '#3B1206'], metric: '30' },
    ],
  },
  mixstar: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'comedy', label: 'Comedy', emoji: '😂' },
      { id: 'sports', label: 'Sports', emoji: '🏀' },
    ],
    sectionIcon: '📺',
    sectionTitle: 'Shows',
    sectionCount: 18,
    layout: 'cards',
    items: [
      { id: 'survive', title: 'Survive', emoji: '💀', bg: ['#166534', '#0A2A17'], metric: '13k', live: true },
      { id: 'villa', title: 'Villa', emoji: '🏝️', bg: ['#9D174D', '#4A0E27'], metric: '8k', live: true },
      { id: 'studio', title: 'Studio', emoji: '🎬', bg: ['#5B21B6', '#2E1065'], metric: '21k', live: true },
    ],
  },
};

/* ───────────────────────────── Hub (ONE01 landing) copy ───────────────────────────── */

export const HUB = {
  name: 'ONE01',
  tagline: 'The shared layer for makers & fans',
  intro: 'Brands, landing pages, and live products meet in one automated marketplace. Same wallet, identity, and rails — every app, one account.',
  stats: [
    { label: 'Live products', value: '4' },
    { label: 'Same rails', value: '1' },
    { label: 'Your account', value: '◉' },
  ],
};
