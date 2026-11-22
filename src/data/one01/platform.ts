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
export type MarkId = 'one' | 'winzi' | 'mixstar' | 'xit' | 'sodex' | 'one01' | 'dargwin';

/** Resolved per-home palette (shared by the shell and detail pages). */
export interface ShellTheme {
  homeId: 'one01' | ProductId;
  mode: 'light' | 'dark';
  mark: MarkId;
  name: string;
  accent: string;
  glow: string;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
}
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
  /** Row CTA label (ONE01 projects), e.g. "Play". */
  cta?: string;
  /** Card gradient [from, to] (games/shows). */
  bg?: [string, string];
  /** Corner metric, e.g. "48", "13k". */
  metric?: string;
  live?: boolean;
  /** Category id for filtering (matches the home's category chips). */
  cat?: string;
  /** Long description (Market detail "About"). */
  blurb?: string;
  /** Price label for a Market listing, e.g. "◎ 40". */
  priceLabel?: string;
}

/** App switcher grid (long-press the logo). ONE01 is shown separately on top. */
export interface SwitcherApp {
  id: string;
  label: string;
  mark: MarkId;
  product?: ProductId;
}

export const SWITCHER_APPS: SwitcherApp[] = [
  { id: 'one', label: 'One', mark: 'one', product: 'one' },
  { id: 'winzi', label: 'Winzi', mark: 'winzi', product: 'winzi' },
  { id: 'mixstar', label: 'MixStar', mark: 'mixstar', product: 'mixstar' },
  { id: 'xit', label: 'Xit', mark: 'xit' },
  { id: 'dargwin', label: 'DargWin', mark: 'dargwin' },
  { id: 'sodex', label: 'Sodex', mark: 'sodex' },
];

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
      { id: 'games', label: 'Games', emoji: '🎮' },
      { id: 'media', label: 'Media', emoji: '📺' },
      { id: 'finance', label: 'Finance', emoji: '💰' },
      { id: 'social', label: 'Social', emoji: '💬' },
      { id: 'tools', label: 'Tools', emoji: '🛠️' },
    ],
    sectionIcon: '🚀',
    sectionTitle: 'Projects',
    sectionCount: 5,
    layout: 'rows',
    items: [
      { id: 'one', title: 'ONE', subtitle: 'Your representative', mark: 'one', product: 'one', cta: 'Open', bg: ['#123A2E', '#071A14'], cat: 'social' },
      { id: 'winzi', title: 'Winzi', subtitle: 'Play Games, Win Money', mark: 'winzi', product: 'winzi', cta: 'Play', bg: ['#3A3312', '#171205'], cat: 'games' },
      { id: 'mixstar', title: 'MixStar', subtitle: 'AI Reality TV', mark: 'mixstar', product: 'mixstar', cta: 'Watch', bg: ['#2A1A4D', '#140A26'], cat: 'media' },
      { id: 'xit', title: 'Xit', subtitle: 'News & trends coins', mark: 'xit', cta: 'Open', bg: ['#103826', '#07160F'], cat: 'finance' },
      { id: 'sodex', title: 'Sodex', subtitle: 'Spiritual intelligence', mark: 'sodex', cta: 'Open', bg: ['#26282B', '#131416'], cat: 'tools' },
      { id: 'dargwin', title: 'DargWin', subtitle: 'Prediction arena', mark: 'dargwin', cta: 'Open', bg: ['#3A2E0B', '#171205'], cat: 'games' },
      { id: 'onepay', title: 'ONE Pay', subtitle: 'Wallet & transfers', emoji: '💳', cta: 'Open', bg: ['#0E2A4D', '#071424'], cat: 'finance' },
      { id: 'circle', title: 'Circle', subtitle: 'Your people, one feed', emoji: '💬', cta: 'Open', bg: ['#3A1240', '#1A071D'], cat: 'social' },
      { id: 'reel', title: 'Reel', subtitle: 'Short live media', emoji: '🎞️', cta: 'Open', bg: ['#3A0E24', '#1A0610'], cat: 'media' },
      { id: 'vault', title: 'Vault', subtitle: 'Docs & disclosure', emoji: '🔐', cta: 'Open', bg: ['#25282B', '#121416'], cat: 'tools' },
    ],
  },
  one: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'business', label: 'Business', emoji: '💼' },
      { id: 'finance', label: 'Finance', emoji: '💰' },
      { id: 'health', label: 'Health', emoji: '❤️' },
      { id: 'legal', label: 'Legal', emoji: '⚖️' },
      { id: 'home', label: 'Home', emoji: '🏠' },
      { id: 'vehicle', label: 'Vehicle', emoji: '🚗' },
    ],
    sectionIcon: '◎',
    sectionTitle: 'Processes',
    layout: 'cards',
    items: [
      { id: 'license', title: 'Renew license', emoji: '🪪', bg: ['#065F46', '#032A20'], metric: '3', cat: 'vehicle' },
      { id: 'car', title: 'Car deal', emoji: '🚗', bg: ['#1E40AF', '#0F1F4D'], metric: '2', cat: 'vehicle' },
      { id: 'handyman', title: 'Handyman', emoji: '🔧', bg: ['#374151', '#1F2937'], metric: '1', cat: 'home' },
      { id: 'moving', title: 'Moving home', emoji: '📦', bg: ['#6D28D9', '#2E1065'], metric: '2', cat: 'home' },
      { id: 'tax', title: 'File taxes', emoji: '📑', bg: ['#0E7490', '#073947'], metric: '1', cat: 'finance' },
      { id: 'insurance', title: 'Insurance', emoji: '🛡️', bg: ['#1E3A8A', '#0F1F4D'], metric: '2', cat: 'finance' },
      { id: 'doctor', title: 'Book a doctor', emoji: '🩺', bg: ['#9D174D', '#4A0E27'], metric: '1', cat: 'health' },
      { id: 'lawyer', title: 'Legal advice', emoji: '⚖️', bg: ['#4A044E', '#240127'], metric: '1', cat: 'legal' },
      { id: 'startup', title: 'Register company', emoji: '🏢', bg: ['#374151', '#1F2937'], metric: '1', cat: 'business' },
    ],
  },
  winzi: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'action', label: 'Action', emoji: '🔫' },
      { id: 'sports', label: 'Sports', emoji: '🏀' },
      { id: 'arcade', label: 'Arcade', emoji: '🕹️' },
      { id: 'racing', label: 'Racing', emoji: '🏎️' },
      { id: 'puzzle', label: 'Puzzle', emoji: '🧩' },
      { id: 'strategy', label: 'Strategy', emoji: '♟️' },
    ],
    sectionIcon: '🎮',
    sectionTitle: 'Games',
    layout: 'cards',
    items: [
      { id: 'pong', title: 'Pong', emoji: '🏓', bg: ['#1E3A8A', '#0F1F4D'], metric: '48', cat: 'arcade' },
      { id: 'sniper', title: 'Sniper', emoji: '🎯', bg: ['#14532D', '#0A2A17'], metric: '85', cat: 'action' },
      { id: 'jets', title: 'Jets', emoji: '✈️', bg: ['#3730A3', '#1E1B4B'], metric: '62', cat: 'action' },
      { id: 'racer', title: 'Racer', emoji: '🏎️', bg: ['#7C2D12', '#3B1206'], metric: '30', cat: 'racing' },
      { id: 'hoops', title: 'Hoops', emoji: '🏀', bg: ['#9A3412', '#431407'], metric: '54', cat: 'sports' },
      { id: 'chess', title: 'Chess', emoji: '♟️', bg: ['#1F2937', '#0B0F19'], metric: '21', cat: 'strategy' },
      { id: 'blocks', title: 'Blocks', emoji: '🧩', bg: ['#4C1D95', '#2A1065'], metric: '39', cat: 'puzzle' },
      { id: 'drift', title: 'Drift', emoji: '🏁', bg: ['#1E40AF', '#0F1F4D'], metric: '41', cat: 'racing' },
      { id: 'striker', title: 'Striker', emoji: '⚽', bg: ['#065F46', '#032A20'], metric: '77', cat: 'sports' },
      { id: 'dungeon', title: 'Dungeon', emoji: '🗡️', bg: ['#4A044E', '#240127'], metric: '33', cat: 'action' },
      { id: 'tetro', title: 'Tetro', emoji: '🔲', bg: ['#0E7490', '#073947'], metric: '28', cat: 'puzzle' },
      { id: 'raid', title: 'Raid', emoji: '👾', bg: ['#3730A3', '#1E1B4B'], metric: '46', cat: 'arcade' },
    ],
  },
  mixstar: {
    categories: [
      { id: 'all', label: 'All' },
      { id: 'reality', label: 'Reality', emoji: '🎭' },
      { id: 'comedy', label: 'Comedy', emoji: '😂' },
      { id: 'drama', label: 'Drama', emoji: '🎬' },
      { id: 'music', label: 'Music', emoji: '🎵' },
      { id: 'sports', label: 'Sports', emoji: '🏀' },
    ],
    sectionIcon: '📺',
    sectionTitle: 'Shows',
    sectionCount: 18,
    layout: 'cards',
    items: [
      { id: 'survive', title: 'Survive', emoji: '💀', bg: ['#166534', '#0A2A17'], metric: '13k', live: true, cat: 'reality' },
      { id: 'villa', title: 'Villa', emoji: '🏝️', bg: ['#9D174D', '#4A0E27'], metric: '8k', live: true, cat: 'reality' },
      { id: 'studio', title: 'Studio', emoji: '🎬', bg: ['#5B21B6', '#2E1065'], metric: '21k', live: true, cat: 'music' },
      { id: 'cookoff', title: 'Cook Off', emoji: '🍳', bg: ['#B45309', '#5C2A06'], metric: '9k', live: true, cat: 'reality' },
      { id: 'standup', title: 'Standup', emoji: '🎤', bg: ['#B91C1C', '#5A0E0E'], metric: '6k', cat: 'comedy' },
      { id: 'mansion', title: 'Mansion', emoji: '🏚️', bg: ['#1F2937', '#0B0F19'], metric: '11k', live: true, cat: 'drama' },
      { id: 'idol', title: 'Idol', emoji: '🎵', bg: ['#6D28D9', '#2E1065'], metric: '18k', live: true, cat: 'music' },
      { id: 'arena', title: 'Arena', emoji: '🏟️', bg: ['#065F46', '#032A20'], metric: '15k', live: true, cat: 'sports' },
      { id: 'roast', title: 'Roast', emoji: '🔥', bg: ['#9A3412', '#431407'], metric: '7k', cat: 'comedy' },
    ],
  },
};

/* ───────────────────────────── Home drawers (per product shelves) ─────────────────────────────
 * Below the main section each home shows extra "drawers": People, Events, Stats, and a
 * live-cycling Feed — content tuned to how each product is used. */

export interface PersonChip { id: string; emoji: string; name: string; meta: string; }
export interface EventChip { id: string; emoji: string; title: string; meta: string; bg?: [string, string]; live?: boolean; }
export interface StatTile { k: string; label: string; value: string; delta?: string; }
export interface FeedLine { id: string; emoji: string; text: string; }

export interface HomeExtras {
  people: { label: string; items: PersonChip[] };
  events: { label: string; items: EventChip[] };
  stats: { label: string; tiles: StatTile[] };
  feed: { label: string; lines: FeedLine[] };
}

export const HOME_EXTRAS: Record<'one01' | ProductId, HomeExtras> = {
  one01: {
    people: {
      label: 'Makers', items: [
        { id: 'm1', emoji: '🧑‍💻', name: 'devk', meta: '3 products' },
        { id: 'm2', emoji: '👩‍🎨', name: 'lune', meta: 'Creator · ⟡21k' },
        { id: 'm3', emoji: '🧑‍🚀', name: 'orbit', meta: 'Agents' },
        { id: 'm4', emoji: '👩‍💼', name: 'mira', meta: 'Org · verified' },
        { id: 'm5', emoji: '🧑‍🔧', name: 'bolt', meta: 'Protocols' },
      ],
    },
    events: {
      label: 'Launches', items: [
        { id: 'e1', emoji: '🚀', title: 'Winzi season reset', meta: 'Monday · UTC', bg: ['#3B5BDB', '#1E2A6B'], live: true },
        { id: 'e2', emoji: '🏝️', title: 'MixStar S1 finale', meta: 'Sunday night', bg: ['#6D28D9', '#2E1065'] },
        { id: 'e3', emoji: '🛒', title: 'New Market feeds', meta: 'Live now', bg: ['#0E7C5A', '#06331F'], live: true },
        { id: 'e4', emoji: '🪪', title: 'Verified orgs wave', meta: 'This week', bg: ['#B45309', '#5C2A06'] },
      ],
    },
    stats: {
      label: 'Platform stats', tiles: [
        { k: 'flow', label: 'Credits flowing', value: '⟡3.1M', delta: '+4.2%' },
        { k: 'accounts', label: 'Accounts', value: '128k', delta: '+1.1%' },
        { k: 'active', label: 'Active now', value: '6,240', delta: '+3.0%' },
        { k: 'products', label: 'Live products', value: '4' },
      ],
    },
    feed: {
      label: 'Across ONE01', lines: [
        { id: 'f1', emoji: '🏓', text: 'ace_27 won ⟡840 on Winzi' },
        { id: 'f2', emoji: '📺', text: 'a MixStar bet settled ⟡294' },
        { id: 'f3', emoji: '◎', text: 'a process reached a provider' },
        { id: 'f4', emoji: '🧱', text: 'a creation earned ⟡30' },
        { id: 'f5', emoji: '🪙', text: 'lune topped up ⟡1,000' },
        { id: 'f6', emoji: '📈', text: 'Winzi shares up 7.5%' },
        { id: 'f7', emoji: '🤖', text: 'orbit published an Agent' },
      ],
    },
  },
  one: {
    people: {
      label: 'Providers', items: [
        { id: 'p1', emoji: '🏛️', name: 'City Licensing', meta: '★ 4.8' },
        { id: 'p2', emoji: '🚗', name: 'AutoDeal Co', meta: '★ 4.6' },
        { id: 'p3', emoji: '🔧', name: 'QuickFix', meta: '★ 4.9' },
        { id: 'p4', emoji: '🏥', name: 'HealthLine', meta: '★ 4.7' },
        { id: 'p5', emoji: '📑', name: 'TaxDesk', meta: '★ 4.5' },
      ],
    },
    events: {
      label: 'Coming up', items: [
        { id: 'e1', emoji: '🪪', title: 'License — step 2', meta: 'Provider replying', bg: ['#065F46', '#032A20'], live: true },
        { id: 'e2', emoji: '🚗', title: 'Car viewing', meta: 'Tomorrow · 16:00', bg: ['#1E40AF', '#0F1F4D'] },
        { id: 'e3', emoji: '🔧', title: 'Handyman quote', meta: 'Due today', bg: ['#374151', '#1F2937'] },
      ],
    },
    stats: {
      label: 'Your ONE', tiles: [
        { k: 'active', label: 'Active processes', value: '3' },
        { k: 'reached', label: 'Providers reached', value: '7', delta: '+2' },
        { k: 'saved', label: 'Saved via ONE', value: '⟡2,400' },
        { k: 'priv', label: 'Kept private', value: '92%' },
      ],
    },
    feed: {
      label: 'Live', lines: [
        { id: 'f1', emoji: '📨', text: 'your ONE reached a provider' },
        { id: 'f2', emoji: '🔒', text: 'only city + budget were shared' },
        { id: 'f3', emoji: '💬', text: 'a quote came back' },
        { id: 'f4', emoji: '✅', text: 'a step completed' },
        { id: 'f5', emoji: '🪪', text: 'license renewal advanced' },
        { id: 'f6', emoji: '🤝', text: 'a provider accepted' },
      ],
    },
  },
  winzi: {
    people: {
      label: 'Top players', items: [
        { id: 'p1', emoji: '🥇', name: 'ace_27', meta: '⟡12,480' },
        { id: 'p2', emoji: '🥈', name: 'nova', meta: '⟡11,905' },
        { id: 'p3', emoji: '🥉', name: 'k1ng', meta: '⟡10,772' },
        { id: 'p4', emoji: '🎮', name: 'zephyr', meta: '⟡9,310' },
        { id: 'p5', emoji: '⚡', name: 'pulse', meta: '⟡8,540' },
      ],
    },
    events: {
      label: 'Tournaments', items: [
        { id: 'e1', emoji: '🏆', title: 'Neon Cup', meta: '⟡50k pool · starts 2h', bg: ['#3B5BDB', '#1E2A6B'], live: true },
        { id: 'e2', emoji: '⚔️', title: 'Duel ladder', meta: 'Live now', bg: ['#14532D', '#0A2A17'], live: true },
        { id: 'e3', emoji: '🎟️', title: 'Bracket night', meta: 'Tonight · 21:00', bg: ['#7C2D12', '#3B1206'] },
        { id: 'e4', emoji: '🏓', title: 'Pong rush', meta: 'Weekend', bg: ['#3730A3', '#1E1B4B'] },
      ],
    },
    stats: {
      label: 'Winzi stats', tiles: [
        { k: 'play', label: 'Credits in play', value: '⟡1.2M', delta: '+6.1%' },
        { k: 'players', label: 'Players', value: '48k' },
        { k: 'live', label: 'Live matches', value: '312', delta: '+18' },
        { k: 'pots', label: 'Pots today', value: '⟡86k' },
      ],
    },
    feed: {
      label: 'Live on Winzi', lines: [
        { id: 'f1', emoji: '🏓', text: 'ace_27 won ⟡840 in Pong' },
        { id: 'f2', emoji: '⚔️', text: 'a duel started for ⟡200' },
        { id: 'f3', emoji: '🎯', text: 'nova entered Neon Cup' },
        { id: 'f4', emoji: '💎', text: 'k1ng climbed to Diamond' },
        { id: 'f5', emoji: '🏆', text: 'Bracket night filled up' },
        { id: 'f6', emoji: '💰', text: 'pulse cashed out ⟡1,120' },
        { id: 'f7', emoji: '🔥', text: 'zephyr on a 7 win streak' },
      ],
    },
  },
  mixstar: {
    people: {
      label: 'Contestants', items: [
        { id: 'c1', emoji: '🧑‍🎤', name: 'Remy', meta: '28% · 3.6×' },
        { id: 'c2', emoji: '👩‍🎤', name: 'Nalee', meta: '34% · 2.9×' },
        { id: 'c3', emoji: '🧑‍🎨', name: 'Kofi', meta: '21% · 4.8×' },
        { id: 'c4', emoji: '👨‍🚀', name: 'Vex', meta: '17% · 5.9×' },
      ],
    },
    events: {
      label: 'Airing now', items: [
        { id: 'e1', emoji: '🔴', title: 'Episode 4 — Immunity', meta: 'Voting open', bg: ['#9D174D', '#4A0E27'], live: true },
        { id: 'e2', emoji: '🎬', title: 'Backstage cut', meta: 'In 20 min', bg: ['#5B21B6', '#2E1065'] },
        { id: 'e3', emoji: '🏝️', title: 'Villa finale', meta: 'Sunday', bg: ['#166534', '#0A2A17'] },
      ],
    },
    stats: {
      label: 'Show stats', tiles: [
        { k: 'watch', label: 'Watching now', value: '13k', delta: '+1.4k' },
        { k: 'votes', label: 'Votes cast', value: '2.4M' },
        { k: 'pool', label: 'Prize pool', value: '⟡40k' },
        { k: 'live', label: 'Live shows', value: '6' },
      ],
    },
    feed: {
      label: 'Live on MixStar', lines: [
        { id: 'f1', emoji: '🗳️', text: 'someone bet ⟡50 on Vex' },
        { id: 'f2', emoji: '📈', text: 'Nalee took the lead' },
        { id: 'f3', emoji: '🛡️', text: 'a save token was used' },
        { id: 'f4', emoji: '🔴', text: 'Episode 4 is live' },
        { id: 'f5', emoji: '💸', text: 'a ⟡294 bet just paid out' },
        { id: 'f6', emoji: '🌟', text: 'Remy trending in Comedy' },
        { id: 'f7', emoji: '🎭', text: 'Kofi pulled an upset' },
      ],
    },
  },
};

/* ───────────────────────────── Network (followers / following) ───────────────────────────── */

export interface Person {
  id: string;
  name: string;
  handle: string;
  emoji: string;
  accent: string;
  /** Short line under the name (what they do on ONE01). */
  meta: string;
  /** This person follows your ONE. */
  followsYou: boolean;
  /** Seed: you follow them by default (store overrides can change it). */
  followsBack: boolean;
  /** One-line bio shown on their ONE (person profile). */
  bio?: string;
  /** Products / roles they're known for — rendered as chips on their profile. */
  tags?: string[];
}

/** A curated slice of the people around your ONE (the "128" is the full community). */
export const NETWORK: Person[] = [
  { id: 'nova', name: 'nova', handle: '@nova', emoji: '🛰️', accent: '#6366F1', meta: 'Just followed your ONE', followsYou: true, followsBack: false, bio: 'Signal-hunter. Maps new ONEs the day they go live.', tags: ['ONE', 'Xit'] },
  { id: 'lune', name: 'lune', handle: '@lune', emoji: '👩‍🎨', accent: '#8B5CF6', meta: 'Creator · ⟡21k earned', followsYou: true, followsBack: true, bio: 'Illustrator building a MixStar show one frame at a time.', tags: ['MixStar', 'Creator'] },
  { id: 'bolt', name: 'bolt', handle: '@bolt', emoji: '🧑‍🔧', accent: '#F59E0B', meta: 'Builds protocols', followsYou: true, followsBack: false, bio: 'Writes the rails everyone else builds on.', tags: ['ONE', 'Sodex'] },
  { id: 'remy', name: 'Remy', handle: '@remy', emoji: '🎭', accent: '#8B5CF6', meta: 'MixStar · Comedy', followsYou: true, followsBack: true, bio: 'Stand-up on MixStar. Here for the bits.', tags: ['MixStar'] },
  { id: 'kofi', name: 'Kofi', handle: '@kofi', emoji: '🏓', accent: '#F9D800', meta: 'Winzi · Gold I', followsYou: true, followsBack: false, bio: 'Table-tennis grinder. Gold I and climbing.', tags: ['Winzi'] },
  { id: 'mira', name: 'mira', handle: '@mira', emoji: '👩‍💼', accent: '#10B981', meta: 'Verified org', followsYou: true, followsBack: true, bio: 'Verified org running real processes through ONE.', tags: ['ONE', 'Sodex'] },
  { id: 'orbit', name: 'orbit', handle: '@orbit', emoji: '🧑‍🚀', accent: '#6366F1', meta: 'Agents & automations', followsYou: true, followsBack: false, bio: 'Ships little agents that do the boring parts.', tags: ['ONE', 'Xit'] },
  { id: 'vex', name: 'Vex', handle: '@vex', emoji: '🔥', accent: '#EF4444', meta: 'MixStar · Survive', followsYou: true, followsBack: false, bio: 'Survival-mode regular. Never folds.', tags: ['MixStar', 'Winzi'] },
  { id: 'devk', name: 'devk', handle: '@devk', emoji: '🧑‍💻', accent: '#10B981', meta: 'Ships 3 products', followsYou: false, followsBack: true, bio: 'Three products live, two more in the oven.', tags: ['Creator', 'Xit'] },
  { id: 'zara', name: 'Zara', handle: '@zara', emoji: '🎤', accent: '#8B5CF6', meta: 'MixStar · Music', followsYou: false, followsBack: true, bio: 'Makes music on MixStar. Loud.', tags: ['MixStar'] },
  { id: 'pulse', name: 'pulse', handle: '@pulse', emoji: '⚡', accent: '#F59E0B', meta: 'Winzi streamer', followsYou: false, followsBack: true, bio: 'Streams Winzi runs most nights.', tags: ['Winzi'] },
  { id: 'sol', name: 'sol', handle: '@sol', emoji: '🌞', accent: '#10B981', meta: 'ONE power user', followsYou: false, followsBack: true, bio: 'Power-uses ONE for everything. Early.', tags: ['ONE'] },
];

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
