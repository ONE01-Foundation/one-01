/**
 * One01Platform — an Expo port of the ONE Platform. ONE01 and every product
 * (ONE / Winzi / MixStar) share ONE home skeleton, responsive across phone and
 * desktop widths:
 *   • Phone  — top bar (wallet + profile) with a gradient fade, content, and a
 *              bottom bar (shop · bigger centered product mark · create) with a
 *              gradient fade. Long-press the center mark → app switcher.
 *   • Desktop — a top nav bar (wordmark + Home / Market / Creator + wallet +
 *              profile) over centered content; no bottom bar; long-press the
 *              wordmark → app switcher; profile → account dropdown.
 * Content: a Featured / News banner, category pills (with search + filter),
 * then a section (Projects for ONE01 · Games / Shows for products). Background
 * is the product's canvas with a per-product glow at the top.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  PanResponder,
  StatusBar,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import {
  One01Mark,
  One01Wordmark,
  OneMark,
  WinziMark,
  MixStarMark,
  XitMark,
  SodexMark,
  DargWinMark,
  WalletIcon,
  UserIcon,
  ShopIcon,
  CreateIcon,
  SearchIcon,
  FilterIcon,
  BellIcon,
  PeopleIcon,
  CalendarIcon,
  ChartIcon,
  BoltIcon,
  ProjectsIcon,
  GamesIcon,
  ShowsIcon,
  ProcessesIcon,
} from '../../components/one01/brand';
import { ProductOnboarding } from '../../components/one01/ProductOnboarding';
import { DetailPage, type DetailKind } from '../../components/one01/DetailPage';
import { SheetWindow, ProfilePage, WalletPage, SettingsPage } from '../../components/one01/Panels';
import { MiniPlayer, type PlayKind } from '../../components/one01/MiniPlay';
import { useOne01PlatformStore, pendingEarnings, type UserCreation, type PlatformTx } from '../../stores/one01PlatformStore';
import { onboardingFor } from '../../data/one01/onboarding';
import { tr, type Lang } from '../../data/one01/i18n';
import {
  PRODUCTS,
  ECOSYSTEM_APPS,
  FEATURED_SLIDES,
  MARKET,
  CREATOR,
  HOME,
  HOME_EXTRAS,
  SWITCHER_APPS,
  type HomeExtras,
  type ProductId,
  type MarkId,
  type HomeItem,
  type EcosystemApp,
  type ShellTheme,
  type ShellHero,
  type SurfacePillar,
} from '../../data/one01/platform';

type HomeId = 'one01' | ProductId;
type Tab = 'home' | 'market' | 'create';
type DrawerKind = 'main' | 'people' | 'events' | 'stats' | 'feed';
/** Descriptor for the main-section ("Projects"/"Games"/…) focused drawer page. */
type MainDrawer = { label: string; homeId: HomeId; items: HomeItem[]; layout: 'rows' | 'cards'; onOpenItem: (item: HomeItem) => void };
/** A platform search result (a home item or a Market listing). */
type SearchResult = { type: 'item'; item: HomeItem } | { type: 'market'; pillar: SurfacePillar };

/** A notification (from your real activity + seeded platform updates). */
interface Notif { id: string; emoji: string; title: string; body: string; ts: number; }
const NOTIF_T0 = Date.now();
const NOTIF_SEED: Notif[] = [
  { id: 's1', emoji: '🏆', title: 'You reached Level 13', body: 'Keep the streak going', ts: NOTIF_T0 - 2 * 60000 },
  { id: 's2', emoji: '💬', title: 'nova started following you', body: 'Now following your ONE', ts: NOTIF_T0 - 9 * 60000 },
  { id: 's3', emoji: '🎯', title: 'Winzi rank updated', body: 'You climbed to Gold II', ts: NOTIF_T0 - 24 * 60000 },
  { id: 's4', emoji: '📺', title: 'Episode 4 voting is open', body: 'MixStar · Survive', ts: NOTIF_T0 - 52 * 60000 },
  { id: 's5', emoji: '🤝', title: 'A provider replied', body: 'Renew license · step 2', ts: NOTIF_T0 - 95 * 60000 },
  { id: 's6', emoji: '⚡', title: 'New on ONE01 Market', body: 'Fresh signals & feeds dropped', ts: NOTIF_T0 - 3 * 3600000 },
];
/** Merge seeded platform updates with the wallet's real transactions, newest first. */
function buildNotifs(transactions: PlatformTx[]): Notif[] {
  const txn: Notif[] = transactions.map((t) => ({
    id: t.id,
    emoji: t.amount >= 0 ? '💰' : '🧾',
    title: t.label,
    body: `${t.amount >= 0 ? '+' : ''}⟡${t.amount.toLocaleString()}`,
    ts: t.ts,
  }));
  return [...txn, ...NOTIF_SEED].sort((a, b) => b.ts - a.ts).slice(0, 40);
}

const GLOWS: Record<HomeId, string> = { one01: '#E8B923', one: '#6B7280', winzi: '#3B5BDB', mixstar: '#8B5CF6' };
const DARK_TILE = '#131317';
const CW = 700; // desktop content column
const WIDE_AT = 900;

function shellTheme(homeId: HomeId, appearance: 'light' | 'dark' = 'light'): ShellTheme {
  if (homeId === 'one01') {
    if (appearance === 'dark') {
      return {
        homeId, mode: 'dark', mark: 'one01', name: 'ONE01', accent: '#10B981', glow: GLOWS.one01,
        bg: '#0B0D10', surface: '#15181C', surface2: '#1D2126', text: '#F3F6F4', muted: '#8A938E', border: '#262B30',
      };
    }
    return {
      homeId, mode: 'light', mark: 'one01', name: 'ONE01', accent: '#10B981', glow: GLOWS.one01,
      bg: '#F6F7F9', surface: '#FFFFFF', surface2: '#EDEFF3', text: '#0E1116', muted: '#6B7280', border: '#E4E7EC',
    };
  }
  const p = PRODUCTS[homeId];
  return { homeId, mode: 'dark', mark: p.mark, name: p.name, accent: p.accent, glow: GLOWS[homeId], ...p.canvas };
}

function markAccent(mark: MarkId): string {
  return mark === 'one' ? '#2ED8A7' : mark === 'one01' ? '#111318' : '#10B981';
}

function Mark({ mark, size, accent, eye }: { mark: MarkId; size: number; accent: string; eye?: string }) {
  switch (mark) {
    case 'one': return <OneMark size={size} color="#FFFFFF" eye="#0A0A0A" />;
    case 'winzi': return <WinziMark size={size} />;
    case 'mixstar': return <MixStarMark size={size} />;
    case 'xit': return <XitMark size={size} />;
    case 'sodex': return <SodexMark size={size} color="#FFFFFF" />;
    case 'dargwin': return <DargWinMark size={size} />;
    case 'one01': default: return <One01Mark size={size} color={accent} />;
  }
}

/** The per-home main-section icon (Projects / Games / Shows / Processes). */
function MainSectionIcon({ homeId, color, size = 20 }: { homeId: HomeId; color: string; size?: number }) {
  switch (homeId) {
    case 'winzi': return <GamesIcon size={size} color={color} />;
    case 'mixstar': return <ShowsIcon size={size} color={color} />;
    case 'one': return <ProcessesIcon size={size} color={color} />;
    case 'one01': default: return <ProjectsIcon size={size} color={color} />;
  }
}

/* ══════════════════════════════════ root ══════════════════════════════════ */

export function One01Platform({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_AT;

  // persisted platform state — onboard once, one live credit balance
  const appearance = useOne01PlatformStore((s) => s.appearance);
  const lang = useOne01PlatformStore((s) => s.lang);
  const entered = useOne01PlatformStore((s) => s.entered);
  const setEntered = useOne01PlatformStore((s) => s.setEntered);
  const onboarded = useOne01PlatformStore((s) => s.onboarded);
  const markOnboarded = useOne01PlatformStore((s) => s.markOnboarded);
  const debit = useOne01PlatformStore((s) => s.debit);
  const publishCreation = useOne01PlatformStore((s) => s.publishCreation);
  const markNotifsSeen = useOne01PlatformStore((s) => s.markNotifsSeen);
  const openNotifs = () => { markNotifsSeen(); setSheet('notifs'); };

  const [homeId, setHomeId] = useState<HomeId>('one01');
  const [tab, setTab] = useState<Tab>('home');
  const [onboardFor, setOnboardFor] = useState<ProductId | null>(null);
  const [sheet, setSheet] = useState<null | 'wallet' | 'profile' | 'switch' | 'settings' | 'notifs'>(null);
  const [externalApp, setExternalApp] = useState<EcosystemApp | null>(null);
  const [detail, setDetail] = useState<{ kind: DetailKind; item: HomeItem } | null>(null);
  const [play, setPlay] = useState<{ kind: PlayKind; item: HomeItem } | null>(null);
  const [drawer, setDrawer] = useState<{ kind: DrawerKind } | null>(null);
  const [bannerSlide, setBannerSlide] = useState<ShellHero | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // a focused drawer view belongs to the current home/tab — drop it on any switch
  useEffect(() => { setDrawer(null); }, [tab, homeId]);

  const enterProduct = (id: ProductId) => {
    markOnboarded(id);
    setOnboardFor(null); setHomeId(id); setTab('home');
  };
  const openProduct = (id: ProductId) => {
    haptic.select();
    if (onboarded.includes(id)) { setHomeId(id); setTab('home'); } else setOnboardFor(id);
  };
  const buyPillar = (price: string, title: string, kind: 'market' | 'create'): boolean => {
    if (kind === 'create') { haptic.success(); showToast(`Opened “${title}” in Creator`); return true; }
    const n = parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;
    if (n === 0) { haptic.success(); showToast(`Added “${title}”`); return true; }
    if (debit(n, `Market · ${title}`)) { haptic.success(); showToast(`Got “${title}”  ·  −⟡${n}`); return true; }
    haptic.warning(); showToast('Not enough credits'); return false;
  };
  const openDetail = (kind: DetailKind, item: HomeItem) => { haptic.select(); setDetail({ kind, item }); };
  const openMarketDetail = (p: SurfacePillar) => {
    haptic.select();
    setDetail({ kind: 'market', item: { id: `mk_${p.id}`, title: p.title, subtitle: p.tagline, emoji: p.emoji, priceLabel: p.price, blurb: p.detail } });
  };
  const buildPillar = (p: SurfacePillar, surface: string) => {
    publishCreation({ title: p.title, emoji: p.emoji, kind: p.id, surface });
    haptic.success();
    showToast(`Published “${p.title}” — now earning`);
  };
  const onSearchResult = (res: SearchResult) => {
    setSearchOpen(false);
    if (res.type === 'item') {
      const kind: DetailKind = homeId === 'winzi' ? 'game' : homeId === 'mixstar' ? 'show' : homeId === 'one' ? 'process' : 'project';
      openDetail(kind, res.item);
    } else {
      openMarketDetail(res.pillar);
    }
  };
  const detailPrimary = () => {
    if (!detail) return;
    const it = detail.item;
    if (detail.kind === 'project') {
      setDetail(null);
      if (it.product) openProduct(it.product);
      else { const app = ECOSYSTEM_APPS.find((a) => a.id === it.id); if (app) setExternalApp(app); }
    } else if (detail.kind === 'game' || detail.kind === 'show') {
      setDetail(null);
      setPlay({ kind: detail.kind, item: it });
    } else if (detail.kind === 'market') {
      if (buyPillar(it.priceLabel ?? '', it.title, 'market')) setDetail(null);
    } else {
      haptic.success(); // process: Continue
    }
  };
  const pickApp = (id: string) => {
    setSheet(null);
    if (id === 'one01') { haptic.select(); setHomeId('one01'); setTab('home'); return; }
    const a = SWITCHER_APPS.find((s) => s.id === id);
    if (a?.product) openProduct(a.product);
    else { const app = ECOSYSTEM_APPS.find((e) => e.id === id); if (app) setExternalApp(app); }
  };

  if (!entered) return <ProductOnboarding config={onboardingFor('one01')} onFinish={() => setEntered(true)} />;
  if (onboardFor) return <ProductOnboarding config={onboardingFor(onboardFor)} onFinish={() => enterProduct(onboardFor)} />;

  const th = shellTheme(homeId, appearance);
  const topPad = wide ? 88 : 100;
  const bottomPad = (wide ? 40 : 120) + insets.bottom;

  // the main section ("Projects"/"Games"/…) as a focused drawer page
  const homeCfg = HOME[homeId];
  const mainCardKind: DetailKind = homeId === 'winzi' ? 'game' : homeId === 'mixstar' ? 'show' : homeId === 'one' ? 'process' : 'project';
  const drawerMain: MainDrawer = {
    label: homeCfg.sectionTitle,
    homeId,
    items: homeCfg.items,
    layout: homeCfg.layout,
    onOpenItem: (item) => { setDrawer(null); openDetail(homeCfg.layout === 'rows' ? 'project' : mainCardKind, item); },
  };

  if (play) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <MiniPlayer kind={play.kind} th={th} item={play.item} onClose={() => setPlay(null)} />
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: th.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={th.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <TopGlow th={th} w={width} h={Math.round(height * 0.5)} />

      <View style={styles.flex}>
        {tab === 'home' && <HomeContent key={homeId} th={th} wide={wide} topPad={topPad} bottomPad={bottomPad} onOpen={openDetail} onOpenDrawer={(k) => setDrawer({ kind: k })} onOpenBanner={(s) => setBannerSlide(s)} onOpenSearch={() => setSearchOpen(true)} lang={lang} />}
        {tab === 'market' && <SurfaceView th={th} wide={wide} kind="market" topPad={topPad} bottomPad={bottomPad} onBuy={buyPillar} onOpenMarket={openMarketDetail} onBuild={buildPillar} onToast={showToast} lang={lang} />}
        {tab === 'create' && <SurfaceView th={th} wide={wide} kind="create" topPad={topPad} bottomPad={bottomPad} onBuy={buyPillar} onOpenMarket={openMarketDetail} onBuild={buildPillar} onToast={showToast} lang={lang} />}
      </View>

      {/* bottom bar sits below the detail overlay */}
      {!wide && <MobileBottomBar th={th} tab={tab} setTab={setTab} onSwitch={() => setSheet('switch')} bottomInset={insets.bottom} />}

      {/* detail opens as a card sheet (mobile) / centered card (desktop); the top bar stays above it */}
      {detail && (
        <DetailOverlay th={th} wide={wide} kind={detail.kind} item={detail.item} topInset={insets.top} onBack={() => setDetail(null)} onPrimary={detailPrimary} onToast={showToast} />
      )}

      {/* a focused drawer: desktop = full page, mobile = bottom sheet */}
      {drawer && tab === 'home' && (
        <DrawerOverlay th={th} wide={wide} kind={drawer.kind} extras={HOME_EXTRAS[homeId]} main={drawerMain} topInset={insets.top} onBack={() => setDrawer(null)} lang={lang} />
      )}

      {wide ? (
        <DesktopNav th={th} tab={tab} setTab={setTab} onWallet={() => setSheet('wallet')} onProfile={() => setSheet('profile')} onSwitch={() => setSheet('switch')} onNotifs={openNotifs} lang={lang} />
      ) : (
        <MobileTopBar th={th} onWallet={() => setSheet('wallet')} onProfile={() => setSheet('profile')} onNotifs={openNotifs} topInset={insets.top} />
      )}

      {toast && (
        <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 64 }]}>
          <View style={[styles.toast, { backgroundColor: th.text }]}><Text style={[styles.toastTxt, { color: th.bg }]}>{toast}</Text></View>
        </View>
      )}

      <SheetWindow visible={sheet === 'profile'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => (
          <ProfilePage
            th={th}
            close={close}
            onScroll={onScroll}
            lang={lang}
            onExit={onExit}
            onCreate={() => { setTab('create'); close(); }}
            onSettings={() => setSheet('settings')}
            onOne01={th.homeId !== 'one01' ? () => { haptic.select(); setHomeId('one01'); setTab('home'); close(); } : undefined}
          />
        )}
      </SheetWindow>
      <SheetWindow visible={sheet === 'wallet'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => <WalletPage th={th} close={close} onScroll={onScroll} lang={lang} />}
      </SheetWindow>
      <SheetWindow visible={sheet === 'settings'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => <SettingsPage th={th} close={close} onScroll={onScroll} lang={lang} />}
      </SheetWindow>
      <SheetWindow visible={sheet === 'notifs'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => <NotificationsPage th={th} lang={lang} close={close} onScroll={onScroll} />}
      </SheetWindow>
      <SheetWindow visible={!!bannerSlide} wide={wide} th={th} onClose={() => setBannerSlide(null)}>
        {(close, onScroll) => (bannerSlide ? <BannerPage th={th} slide={bannerSlide} close={close} onScroll={onScroll} onCta={() => { setBannerSlide(null); setTab('market'); }} /> : null)}
      </SheetWindow>
      <SheetWindow visible={searchOpen} wide={wide} th={th} onClose={() => setSearchOpen(false)}>
        {(close) => <SearchSheet th={th} homeId={homeId} lang={lang} close={close} onResult={onSearchResult} />}
      </SheetWindow>
      <AppSwitcher visible={sheet === 'switch'} wide={wide} th={th} current={homeId} onClose={() => setSheet(null)} onPick={pickApp} />
      <ExternalModal app={externalApp} onClose={() => setExternalApp(null)} />
    </View>
  );
}

/* ─────────────────────────────── top glow ─────────────────────────────── */

function TopGlow({ th, w, h }: { th: ShellTheme; w: number; h: number }) {
  const gid = `tg_${th.homeId}`;
  const dark = th.mode === 'dark';
  return (
    <View pointerEvents="none" style={[styles.topGlow, { height: h }]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gid} cx={w / 2} cy={0} rx={w * 0.95} ry={h} fx={w / 2} fy={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={th.glow} stopOpacity={dark ? 0.5 : 0.16} />
            <Stop offset="0.5" stopColor={th.glow} stopOpacity={dark ? 0.13 : 0.05} />
            <Stop offset="1" stopColor={th.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

/* ─────────────────────────────── mobile bars ─────────────────────────────── */

function WalletChip({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  const balance = useOne01PlatformStore((s) => s.balance);
  return (
    <Pressable onPress={onPress} style={styles.walletBtn} hitSlop={8}>
      <WalletIcon size={24} color={th.text} />
      <Text style={[styles.walletAmt, { color: th.text }]}>${balance.toLocaleString()}</Text>
    </Pressable>
  );
}

function ProfileBtn({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.profileBtn} hitSlop={8}>
      <View style={[styles.lvlPill, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Text style={[styles.lvlTxt, { color: th.text }]}>LVL 13</Text>
      </View>
      <View style={[styles.avatar, { borderColor: th.accent, backgroundColor: th.surface2 }]}>
        <UserIcon size={22} color={th.muted} />
      </View>
    </Pressable>
  );
}

/** Bell with an unread badge driven by real activity. */
function NotifBell({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const seenAt = useOne01PlatformStore((s) => s.notifsSeenAt);
  const unread = useMemo(() => buildNotifs(transactions).filter((n) => n.ts > seenAt).length, [transactions, seenAt]);
  const badgeFg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <Pressable onPress={onPress} style={styles.bellBtn} hitSlop={8}>
      <BellIcon size={23} color={th.text} />
      {unread > 0 && (
        <View style={[styles.bellBadge, { backgroundColor: th.accent, borderColor: th.bg }]}>
          <Text style={[styles.bellBadgeTxt, { color: badgeFg }]}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

function MobileTopBar({ th, onWallet, onProfile, onNotifs, topInset }: { th: ShellTheme; onWallet: () => void; onProfile: () => void; onNotifs: () => void; topInset: number }) {
  return (
    // the absolute bar must clear the status bar itself (root padding doesn't offset absolute children)
    <LinearGradient colors={[th.bg, th.bg, `${th.bg}00`]} locations={[0, 0.58, 1]} style={[styles.topBar, { paddingTop: topInset }]} pointerEvents="box-none">
      <View style={styles.topRow}>
        <WalletChip th={th} onPress={onWallet} />
        <View style={styles.topRight}>
          <NotifBell th={th} onPress={onNotifs} />
          <ProfileBtn th={th} onPress={onProfile} />
        </View>
      </View>
    </LinearGradient>
  );
}

function MobileBottomBar({ th, tab, setTab, onSwitch, bottomInset }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onSwitch: () => void; bottomInset: number }) {
  return (
    <LinearGradient colors={[`${th.bg}00`, th.bg]} style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 10) }]} pointerEvents="box-none">
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('market'); }}>
        <ShopIcon size={26} color={tab === 'market' ? th.accent : th.muted} />
      </Pressable>
      <Pressable
        style={styles.navCenterWrap}
        onPress={() => { haptic.select(); if (tab === 'home') onSwitch(); else setTab('home'); }}
        onLongPress={() => { haptic.press(); onSwitch(); }}
        delayLongPress={320}
      >
        <View style={[styles.navCenter, { opacity: tab === 'home' ? 1 : 0.5 }]}>
          <Mark mark={th.mark} size={60} accent={th.homeId === 'one01' ? th.text : th.accent} eye={th.bg} />
        </View>
      </Pressable>
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('create'); }}>
        <CreateIcon size={26} color={tab === 'create' ? th.accent : th.muted} />
      </Pressable>
    </LinearGradient>
  );
}

/* ─────────────────────────────── desktop nav ─────────────────────────────── */

function DesktopNav({ th, tab, setTab, onWallet, onProfile, onSwitch, onNotifs, lang }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onWallet: () => void; onProfile: () => void; onSwitch: () => void; onNotifs: () => void; lang: Lang }) {
  const links: { k: Tab; label: string }[] = [
    { k: 'home', label: tr(lang, 'Home') },
    { k: 'market', label: tr(lang, 'Market') },
    { k: 'create', label: tr(lang, 'Creator') },
  ];
  return (
    <LinearGradient colors={[th.bg, `${th.bg}00`]} style={styles.desktopNav} pointerEvents="box-none">
      <View style={styles.desktopRow}>
        <Pressable onPress={() => { haptic.select(); onSwitch(); }} style={styles.desktopLogo}>
          {th.homeId === 'one01' ? (
            <One01Wordmark height={26} color={th.text} />
          ) : (
            <View style={styles.row}>
              <Mark mark={th.mark} size={30} accent={th.accent} />
              <Text style={[styles.navWordmark, { color: th.text }]}>{th.name}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.desktopLinks}>
          {links.map((l) => (
            <Pressable key={l.k} onPress={() => setTab(l.k)}>
              <Text style={[styles.navLink, { color: l.k === tab ? th.text : th.muted }]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.flex} />
        <WalletChip th={th} onPress={onWallet} />
        <View style={{ width: 18 }} />
        <NotifBell th={th} onPress={onNotifs} />
        <View style={{ width: 12 }} />
        <ProfileBtn th={th} onPress={onProfile} />
      </View>
    </LinearGradient>
  );
}

/* ─────────────────────────────── home content ─────────────────────────────── */

function HomeContent({ th, wide, topPad, bottomPad, onOpen, onOpenDrawer, onOpenBanner, onOpenSearch, lang }: { th: ShellTheme; wide: boolean; topPad: number; bottomPad: number; onOpen: (kind: DetailKind, item: HomeItem) => void; onOpenDrawer: (k: DrawerKind) => void; onOpenBanner: (s: ShellHero) => void; onOpenSearch: () => void; lang: Lang }) {
  const home = HOME[th.homeId];
  const extras = HOME_EXTRAS[th.homeId];
  const slides = th.homeId === 'one01' ? FEATURED_SLIDES.one : FEATURED_SLIDES[th.homeId];
  const { width } = useWindowDimensions();
  const colW = wide ? CW : Math.min(width, 600) - 36;
  const [cat, setCat] = useState('all');
  const items = cat === 'all' ? home.items : home.items.filter((it) => it.cat === cat);
  const cardKind: DetailKind = th.homeId === 'winzi' ? 'game' : th.homeId === 'mixstar' ? 'show' : th.homeId === 'one' ? 'process' : 'project';

  // auto-rotating featured banner
  const bannerRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const bannerIdx = useRef(0);
  const [bannerI, setBannerI] = useState(0);
  const step = colW + 12;
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      bannerIdx.current = (bannerIdx.current + 1) % slides.length;
      setBannerI(bannerIdx.current);
      bannerRef.current?.scrollTo({ x: bannerIdx.current * step, animated: true });
    }, 4500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, step]);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width: colW }}>
        {/* featured / news banner — tap to open, auto-rotates, clipped on desktop so the next slide can't peek */}
        <ScrollView
          ref={bannerRef}
          horizontal
          pagingEnabled
          snapToInterval={step}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / step); bannerIdx.current = i; setBannerI(i); }}
          style={{ overflow: wide ? 'hidden' : 'visible', width: colW, borderRadius: 22 }}
        >
          {slides.map((s, i) => {
            const colors: [string, string] = th.mode === 'dark' ? [`${th.glow}CC`, th.surface] : ['#EDEFF3', '#DCE1E8'];
            return (
              <Pressable key={i} onPress={() => onOpenBanner(s)}>
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { width: colW }]}>
                  <View style={styles.bannerBadge}><Text style={styles.bannerBadgeTxt}>{s.badge}</Text></View>
                  <View style={styles.bannerFooter}>
                    <View style={styles.flex}>
                      <Text style={[styles.bannerTitle, { color: th.text }]} numberOfLines={2}>{s.title}</Text>
                      <Text style={[styles.bannerSub, { color: th.muted }]} numberOfLines={1}>{s.subtitle}</Text>
                    </View>
                    {wide && (
                      <View style={styles.bannerCta}><Text style={styles.bannerCtaTxt}>{s.ctaLabel}</Text></View>
                    )}
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>
        {slides.length > 1 && (
          <View style={styles.bannerDots}>
            {slides.map((_, i) => <View key={i} style={[styles.bannerDot, { backgroundColor: i === bannerI ? th.text : th.border, width: i === bannerI ? 18 : 6 }]} />)}
          </View>
        )}

        {/* categories */}
        <View style={styles.catRow}>
          <Pressable onPress={onOpenSearch} style={[styles.catIcon, { backgroundColor: th.surface, borderColor: th.border, borderWidth: StyleSheet.hairlineWidth }]}><SearchIcon size={16} color={th.muted} /></Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={styles.flex}>
            {home.categories.map((c) => {
              const on = c.id === cat;
              return (
                <Pressable key={c.id} onPress={() => { haptic.select(); setCat(c.id); }} style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : 'transparent', borderColor: on ? 'transparent' : th.border }]}>
                  {c.emoji ? <Text style={{ fontSize: 14 }}>{c.emoji}</Text> : null}
                  <Text style={[styles.pillTxt, { color: on ? th.text : th.muted }]}>{tr(lang, c.label)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {wide && <View style={[styles.catIcon, { backgroundColor: th.surface }]}><FilterIcon size={16} color={th.muted} /></View>}
        </View>

        {/* section header — opens the main section as a focused drawer page */}
        <Pressable onPress={() => onOpenDrawer('main')} style={({ pressed }) => [styles.sectionHead, pressed && { opacity: 0.6 }]}>
          <View style={styles.sectionIconBox}><MainSectionIcon homeId={th.homeId} color={th.text} size={19} /></View>
          <Text style={[styles.sectionTitle, { color: th.text }]}>{tr(lang, home.sectionTitle)}</Text>
          <Text style={[styles.sectionCount, { color: th.muted }]}>({items.length})</Text>
          <View style={styles.flex} />
          <Text style={[styles.sectionArrow, { color: th.muted }]}>›</Text>
        </Pressable>

        {/* items (filtered by the selected category) */}
        {home.layout === 'rows' ? (
          <View style={[styles.rowsWrap, wide && styles.rowsWrapWide]}>
            {items.map((it) => (
              <Pressable key={it.id} onPress={() => onOpen('project', it)} style={({ pressed }) => [styles.projRow, wide && styles.projRowWide, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={it.bg ?? [DARK_TILE, '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.projTile}>
                  {it.mark ? <Mark mark={it.mark} size={38} accent={markAccent(it.mark)} eye={DARK_TILE} /> : <Text style={{ fontSize: 30 }}>{it.emoji}</Text>}
                </LinearGradient>
                <View style={styles.flex}>
                  <Text style={[styles.projName, { color: th.text }]}>{it.title}</Text>
                  <Text style={[styles.projSub, { color: th.muted }]}>{it.subtitle}</Text>
                </View>
                <View style={[styles.getPill, { backgroundColor: th.surface2 }]}>
                  <Text style={[styles.getPillTxt, { color: th.accent }]}>{tr(lang, it.cta ?? 'Open')}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }} style={{ overflow: 'visible' }}>
            {items.map((it) => (
              it.mark ? (
                /* project "cube" — square brand tile with a label below */
                <Pressable key={it.id} onPress={() => onOpen(cardKind, it)} style={styles.projCubeWrap}>
                  <LinearGradient colors={it.bg ?? [DARK_TILE, '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.projCube}>
                    <Mark mark={it.mark} size={56} accent={markAccent(it.mark)} eye={DARK_TILE} />
                    {it.cta ? <View style={styles.projCubeCta}><Text style={styles.artCtaTxt}>{tr(lang, it.cta)}</Text></View> : null}
                  </LinearGradient>
                  <Text style={[styles.projCubeName, { color: th.text }]} numberOfLines={1}>{it.title}</Text>
                  <Text style={[styles.projCubeSub, { color: th.muted }]} numberOfLines={1}>{it.subtitle}</Text>
                </Pressable>
              ) : (
                <Pressable key={it.id} onPress={() => onOpen(cardKind, it)}>
                  <LinearGradient colors={it.bg ?? ['#333', '#111']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.artCard}>
                    {it.live && (
                      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveTxt}>{it.metric}</Text></View>
                    )}
                    <Text style={styles.artEmoji}>{it.emoji}</Text>
                    <View style={styles.artFooter}>
                      <Text style={styles.artTitle}>{it.title}</Text>
                      {!it.live && it.metric ? (
                        <View style={styles.artMetric}><View style={styles.artDot} /><Text style={styles.artMetricTxt}>{it.metric}</Text></View>
                      ) : null}
                    </View>
                  </LinearGradient>
                </Pressable>
              )
            ))}
          </ScrollView>
        )}

        {/* per-product drawers: people · events · stats · live feed */}
        {extras && <HomeDrawers th={th} extras={extras} wide={wide} onOpenDrawer={onOpenDrawer} lang={lang} />}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────── home drawers (shelves) ─────────────────────────────── */

function drawerIcon(kind: DrawerKind, color: string, size = 17) {
  switch (kind) {
    case 'people': return <PeopleIcon size={size} color={color} />;
    case 'events': return <CalendarIcon size={size} color={color} />;
    case 'stats': return <ChartIcon size={size} color={color} />;
    case 'feed': default: return <BoltIcon size={size} color={color} />;
  }
}

function DrawerHead({ th, kind, title, count, onOpen }: { th: ShellTheme; kind: DrawerKind; title: string; count?: number; onOpen?: () => void }) {
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.drawerHead, pressed && onOpen && { opacity: 0.6 }]}>
      <View style={styles.drawerHeadIcon}>{drawerIcon(kind, th.text)}</View>
      <Text style={[styles.sectionTitle, { color: th.text }]}>{title}</Text>
      {count != null && <Text style={[styles.sectionCount, { color: th.muted }]}>({count})</Text>}
      <View style={styles.flex} />
      <Text style={[styles.sectionArrow, { color: th.muted }]}>›</Text>
    </Pressable>
  );
}

function HomeDrawers({ th, extras, wide, onOpenDrawer, lang }: { th: ShellTheme; extras: HomeExtras; wide: boolean; onOpenDrawer: (k: DrawerKind) => void; lang: Lang }) {
  return (
    <>
      {/* people */}
      <DrawerHead th={th} kind="people" title={tr(lang, extras.people.label)} count={extras.people.items.length} onOpen={() => onOpenDrawer('people')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }} style={{ overflow: 'visible' }}>
        {extras.people.items.map((p) => (
          <View key={p.id} style={[styles.personCard, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={[styles.personAv, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 26 }}>{p.emoji}</Text></View>
            <Text style={[styles.personName, { color: th.text }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[styles.personMeta, { color: th.muted }]} numberOfLines={1}>{p.meta}</Text>
          </View>
        ))}
      </ScrollView>

      {/* events */}
      <DrawerHead th={th} kind="events" title={tr(lang, extras.events.label)} count={extras.events.items.length} onOpen={() => onOpenDrawer('events')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }} style={{ overflow: 'visible' }}>
        {extras.events.items.map((e) => (
          <LinearGradient key={e.id} colors={e.bg ?? [`${th.glow}CC`, th.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.eventCard}>
            {e.live && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveTxt}>LIVE</Text></View>}
            <Text style={styles.eventEmoji}>{e.emoji}</Text>
            <View>
              <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
              <Text style={styles.eventMeta} numberOfLines={1}>{e.meta}</Text>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>

      {/* stats + live feed combined (the separate Live drawer was folded in here) */}
      <DrawerHead th={th} kind="stats" title={tr(lang, extras.stats.label)} onOpen={() => onOpenDrawer('stats')} />
      <View style={styles.statGrid}>
        {extras.stats.tiles.map((t) => (
          <View key={t.k} style={[styles.statTile, wide && styles.statTileWide, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.statBig, { color: th.text }]} numberOfLines={1}>{t.value}</Text>
            <Text style={[styles.statLabel, { color: th.muted }]} numberOfLines={1}>{t.label}</Text>
            {t.delta ? <Text style={[styles.statDelta, { color: t.delta.startsWith('-') ? '#ef4444' : '#22c55e' }]}>{t.delta}</Text> : null}
          </View>
        ))}
      </View>
      <View style={styles.statFeedHead}>
        <View style={styles.feedDot} />
        <Text style={[styles.statFeedTitle, { color: th.muted }]}>{tr(lang, extras.feed.label)}</Text>
      </View>
      <FeedDrawer th={th} lines={extras.feed.lines} />
    </>
  );
}

/* ─────────────────────────────── drawer detail (focused view) ─────────────────────────────── */

function DrawerContent({ th, kind, extras, main, wide = false, topPad = 0, onBack, onScroll, lang }: { th: ShellTheme; kind: DrawerKind; extras: HomeExtras; main?: MainDrawer; wide?: boolean; topPad?: number; onBack: () => void; onScroll?: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void; lang: Lang }) {
  const insets = useSafeAreaInsets();
  const rawTitle = kind === 'main' ? (main?.label ?? '') : kind === 'people' ? extras.people.label : kind === 'events' ? extras.events.label : kind === 'stats' ? extras.stats.label : extras.feed.label;
  const title = tr(lang, rawTitle);

  const headIcon = kind === 'main' ? <MainSectionIcon homeId={main?.homeId ?? 'one01'} color={th.text} size={22} /> : drawerIcon(kind, th.text, 22);

  return (
    <View style={styles.flex}>
      {/* pinned header — title stays while the body scrolls; ✕ on the right */}
      <View style={[styles.drawerHeader, { paddingTop: wide ? topPad + 44 : 8, borderBottomColor: th.border }]}>
        <View style={[styles.drawerHeaderRow, wide && styles.drawerBodyWide]}>
          <View style={styles.drawerHeadIcon}>{headIcon}</View>
          <Text style={[styles.drawerBigTitle, { color: th.text }]} numberOfLines={1}>{title}</Text>
          <View style={styles.flex} />
          <Pressable onPress={onBack} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.xmark, { color: th.text }]}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 10, paddingBottom: insets.bottom + 40, alignItems: wide ? 'center' : 'stretch' }}>
        <View style={[styles.drawerBody, wide && styles.drawerBodyWide]}>
          {kind === 'main' && main && (
            main.layout === 'rows' ? (
              <View style={styles.drawerList}>
                {main.items.map((it) => (
                  <Pressable key={it.id} onPress={() => main.onOpenItem(it)} style={({ pressed }) => [styles.drawerRow, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                    <LinearGradient colors={it.bg ?? [DARK_TILE, '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.projTile}>
                      {it.mark ? <Mark mark={it.mark} size={36} accent={markAccent(it.mark)} eye={DARK_TILE} /> : <Text style={{ fontSize: 28 }}>{it.emoji}</Text>}
                    </LinearGradient>
                    <View style={styles.flex}>
                      <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{it.title}</Text>
                      <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{it.subtitle}</Text>
                    </View>
                    <View style={[styles.getPill, { backgroundColor: th.surface2 }]}>
                      <Text style={[styles.getPillTxt, { color: th.accent }]}>{tr(lang, it.cta ?? 'Open')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.drawerCardGrid}>
                {main.items.map((it) => (
                  <Pressable key={it.id} onPress={() => main.onOpenItem(it)} style={styles.drawerCardWrap}>
                    <LinearGradient colors={it.bg ?? ['#333', '#111']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.drawerArtCard}>
                      {it.live && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveTxt}>{it.metric}</Text></View>}
                      {it.mark ? <View style={styles.artMark}><Mark mark={it.mark} size={46} accent={markAccent(it.mark)} eye={DARK_TILE} /></View> : <Text style={styles.artEmoji}>{it.emoji}</Text>}
                      <View style={styles.artFooter}>
                        <Text style={styles.artTitle}>{it.title}</Text>
                        {!it.live && it.metric ? <View style={styles.artMetric}><View style={styles.artDot} /><Text style={styles.artMetricTxt}>{it.metric}</Text></View> : it.cta ? <View style={styles.artCta}><Text style={styles.artCtaTxt}>{tr(lang, it.cta)}</Text></View> : null}
                      </View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            )
          )}

          {kind === 'people' && (
            <View style={styles.drawerList}>
              {extras.people.items.map((p) => (
                <View key={p.id} style={[styles.drawerRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <View style={[styles.drawerAv, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 24 }}>{p.emoji}</Text></View>
                  <View style={styles.flex}>
                    <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{p.meta}</Text>
                  </View>
                  <Text style={[styles.sectionArrow, { color: th.muted }]}>›</Text>
                </View>
              ))}
            </View>
          )}

          {kind === 'events' && (
            <View style={styles.drawerList}>
              {extras.events.items.map((e) => (
                <LinearGradient key={e.id} colors={e.bg ?? [`${th.glow}CC`, th.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.drawerEventCard}>
                  {e.live && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveTxt}>LIVE</Text></View>}
                  <Text style={{ fontSize: 34 }}>{e.emoji}</Text>
                  <View>
                    <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>{e.meta}</Text>
                  </View>
                </LinearGradient>
              ))}
            </View>
          )}

          {kind === 'stats' && (
            <>
              <View style={styles.statGrid}>
                {extras.stats.tiles.map((t) => (
                  <View key={t.k} style={[styles.statTile, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <Text style={[styles.statBig, { color: th.text }]} numberOfLines={1}>{t.value}</Text>
                    <Text style={[styles.statLabel, { color: th.muted }]} numberOfLines={1}>{t.label}</Text>
                    {t.delta ? <Text style={[styles.statDelta, { color: t.delta.startsWith('-') ? '#ef4444' : '#22c55e' }]}>{t.delta}</Text> : null}
                  </View>
                ))}
              </View>
              <View style={[styles.statFeedHead, { marginTop: 22 }]}>
                <View style={styles.feedDot} />
                <Text style={[styles.statFeedTitle, { color: th.muted }]}>{extras.feed.label}</Text>
              </View>
              <View style={styles.drawerList}>
                {extras.feed.lines.map((l, i) => (
                  <View key={l.id} style={[styles.feedPill, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <View style={[styles.feedDot, i > 0 && { backgroundColor: th.muted, opacity: 0.4 }]} />
                    <Text style={{ fontSize: 15 }}>{l.emoji}</Text>
                    <Text style={[styles.feedTxt, { color: th.text }]} numberOfLines={1}>{l.text}</Text>
                    <View style={styles.flex} />
                    <Text style={[styles.feedTime, { color: th.muted }]}>{i === 0 ? 'now' : `${i * 4}s`}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {kind === 'feed' && (
            <View style={styles.drawerList}>
              {extras.feed.lines.map((l, i) => (
                <View key={l.id} style={[styles.feedPill, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <View style={[styles.feedDot, i > 0 && { backgroundColor: th.muted, opacity: 0.4 }]} />
                  <Text style={{ fontSize: 15 }}>{l.emoji}</Text>
                  <Text style={[styles.feedTxt, { color: th.text }]} numberOfLines={1}>{l.text}</Text>
                  <View style={styles.flex} />
                  <Text style={[styles.feedTime, { color: th.muted }]}>{i === 0 ? 'now' : `${i * 4}s`}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DrawerOverlay({ th, wide, kind, extras, main, topInset, onBack, lang }: { th: ShellTheme; wide: boolean; kind: DrawerKind; extras: HomeExtras; main?: MainDrawer; topInset: number; onBack: () => void; lang: Lang }) {
  const { height: winH } = useWindowDimensions();
  const sheetTop = topInset + 74;
  const sheetH = winH - sheetTop;
  const ty = useRef(new Animated.Value(sheetH)).current;
  const scrollY = useRef(0);

  useEffect(() => {
    if (wide) return;
    Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 13 }).start();
  }, [wide, ty]);

  const close = () => Animated.timing(ty, { toValue: sheetH, duration: 220, useNativeDriver: true }).start(() => onBack());

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5 && scrollY.current <= 2,
      onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.8) close();
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (wide) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, paddingTop: topInset }]}>
        <DrawerContent th={th} wide kind={kind} extras={extras} main={main} topPad={56} onBack={onBack} lang={lang} />
      </View>
    );
  }

  const scrimOpacity = ty.interpolate({ inputRange: [0, sheetH], outputRange: [0.42, 0], extrapolate: 'clamp' });
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: scrimOpacity }]} pointerEvents="none" />
      </Pressable>
      <Animated.View {...pan.panHandlers} style={[styles.detailSheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: ty }] }]}>
        <View style={styles.detailDrag}><View style={[styles.detailGrab, { backgroundColor: th.border }]} /></View>
        <DrawerContent th={th} kind={kind} extras={extras} main={main} onBack={close} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} lang={lang} />
      </Animated.View>
    </View>
  );
}

type FeedLineLite = { id: string; emoji: string; text: string };

function FeedDrawer({ th, lines }: { th: ShellTheme; lines: FeedLineLite[] }) {
  const MAX = 5;
  const seq = useRef(0);
  const take = (l: FeedLineLite) => ({ ...l, key: `f${seq.current++}` });
  // start with a few, then let new ones pile up to MAX so it reads as a live feed
  const [shown, setShown] = useState(() => lines.slice(0, 3).map(take));
  const nextIdx = useRef(3 % Math.max(1, lines.length));
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (lines.length < 2) return;
    const t = setInterval(() => {
      const l = lines[nextIdx.current % lines.length];
      nextIdx.current += 1;
      setShown((prev) => [take(l), ...prev].slice(0, MAX));
      enter.setValue(0);
      Animated.timing(enter, { toValue: 1, duration: 440, useNativeDriver: true }).start();
    }, 2300);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  return (
    <View style={{ gap: 8 }}>
      {shown.map((l, i) => (
        <Animated.View
          key={l.key}
          style={[
            styles.feedPill,
            { backgroundColor: th.surface, borderColor: th.border },
            i === 0 && { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
          ]}
        >
          <View style={[styles.feedDot, i > 0 && { backgroundColor: th.muted, opacity: 0.4 }]} />
          <Text style={{ fontSize: 15 }}>{l.emoji}</Text>
          <Text style={[styles.feedTxt, { color: th.text }]} numberOfLines={1}>{l.text}</Text>
          <View style={styles.flex} />
          <Text style={[styles.feedTime, { color: th.muted }]}>{i === 0 ? 'now' : `${i * 4}s`}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

/* ─────────────────────────────── market / create ─────────────────────────────── */

function SurfaceView({ th, wide, kind, topPad, bottomPad, onBuy, onOpenMarket, onBuild, onToast, lang }: { th: ShellTheme; wide: boolean; kind: 'market' | 'create'; topPad: number; bottomPad: number; onBuy: (price: string, title: string, kind: 'market' | 'create') => boolean; onOpenMarket: (p: SurfacePillar) => void; onBuild: (p: SurfacePillar, surface: string) => void; onToast: (m: string) => void; lang: Lang }) {
  const pid: ProductId = th.homeId === 'one01' ? 'one' : th.homeId;
  const s = kind === 'market' ? MARKET[pid] : CREATOR[pid];
  const sectionTitle = kind === 'market' ? tr(lang, 'Market') : tr(lang, CREATOR[pid].title);
  const cats = HOME[th.homeId].categories;
  const { width } = useWindowDimensions();
  const colW = wide ? CW : Math.min(width, 600) - 36;
  const [cat, setCat] = useState('all');
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';

  return (
    <ScrollView contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width: colW }}>
        {/* headline + structure line (banner removed) */}
        <Text style={[styles.surfaceHeadline, { color: th.text }]}>{s.headline}</Text>
        <View style={[styles.structure, { borderColor: th.border, backgroundColor: th.surface }]}>
          <Text style={[styles.structureTxt, { color: th.muted }]}>{s.structureLine}</Text>
        </View>

        {/* categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 16 }}>
          {cats.map((c) => {
            const on = c.id === cat;
            return (
              <Pressable key={c.id} onPress={() => { haptic.select(); setCat(c.id); }} style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : 'transparent', borderColor: on ? 'transparent' : th.border }]}>
                {c.emoji ? <Text style={{ fontSize: 14 }}>{c.emoji}</Text> : null}
                <Text style={[styles.pillTxt, { color: on ? th.text : th.muted }]}>{tr(lang, c.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* section header */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionIcon}>{kind === 'market' ? '🛍️' : '✦'}</Text>
          <Text style={[styles.sectionTitle, { color: th.text }]}>{sectionTitle}</Text>
          <Text style={[styles.sectionCount, { color: th.muted }]}>({s.pillars.length})</Text>
        </View>

        {/* pillars as cards — a Market listing opens its detail page; Creator builds */}
        <View style={[styles.rowsWrap, wide && styles.rowsWrapWide]}>
          {s.pillars.map((p) => {
            const isMarket = kind === 'market';
            const onCta = () => (isMarket ? onOpenMarket(p) : onBuild(p, th.name));
            return (
              <Pressable key={p.id} onPress={isMarket ? () => onOpenMarket(p) : undefined} disabled={!isMarket} style={({ pressed }) => [styles.pillar, wide && styles.projRowWide, { backgroundColor: th.surface, borderColor: th.border }, pressed && isMarket && { opacity: 0.9 }]}>
                <View style={styles.pillarTop}>
                  <View style={[styles.pillarEmoji, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 20 }}>{p.emoji}</Text></View>
                  <View style={styles.flex}>
                    <Text style={[styles.projName, { color: th.text }]}>{p.title}</Text>
                    <Text style={[styles.projSub, { color: th.muted }]}>{p.tagline}</Text>
                  </View>
                  <Pressable onPress={onCta} style={({ pressed }) => [styles.ctaPill, { backgroundColor: th.accent }, pressed && { opacity: 0.8 }]}><Text style={[styles.ctaPillTxt, { color: ctaFg }]}>{isMarket ? (p.price.replace(/[^0-9]/g, '') ? `${tr(lang, 'Get')} ⟡${parseInt(p.price.replace(/[^0-9]/g, ''), 10)}` : tr(lang, 'Get')) : tr(lang, 'Build')}</Text></Pressable>
                </View>
                <Text style={[styles.pillarDetail, { color: th.muted }]}>{p.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        {kind === 'create' && <CreatorCreations th={th} onToast={onToast} lang={lang} />}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────── your creations (Creator earns) ─────────────────────────────── */

function CreatorCreations({ th, onToast, lang }: { th: ShellTheme; onToast: (m: string) => void; lang: Lang }) {
  const creations = useOne01PlatformStore((s) => s.creations);
  const collect = useOne01PlatformStore((s) => s.collectEarnings);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!creations.length) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [creations.length]);

  if (!creations.length) return null;
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';

  const doCollect = (c: UserCreation) => {
    const got = collect(c.id);
    if (got > 0) onToast(`Collected +⟡${got} from “${c.title}”`);
    else onToast('Nothing to collect yet');
  };

  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIcon}>🧱</Text>
        <Text style={[styles.sectionTitle, { color: th.text }]}>{tr(lang, 'Your creations')}</Text>
        <Text style={[styles.sectionCount, { color: th.muted }]}>({creations.length})</Text>
      </View>
      <View style={styles.rowsWrap}>
        {creations.map((c) => {
          const pending = pendingEarnings(c);
          return (
            <View key={c.id} style={[styles.projRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.pillarEmoji, { backgroundColor: th.surface2, width: 48, height: 48, borderRadius: 14 }]}><Text style={{ fontSize: 22 }}>{c.emoji}</Text></View>
              <View style={styles.flex}>
                <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{c.title}</Text>
                <Text style={[styles.projSub, { color: th.muted }]}>Live on {c.surface} · ⟡{c.rate}/min · earned ⟡{c.collected.toLocaleString()}</Text>
              </View>
              <Pressable onPress={() => doCollect(c)} style={({ pressed }) => [styles.ctaPill, { backgroundColor: pending > 0 ? th.accent : th.surface2 }, pressed && { opacity: 0.8 }]}>
                <Text style={[styles.ctaPillTxt, { color: pending > 0 ? ctaFg : th.muted }]}>{tr(lang, 'Collect')} ⟡{pending}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ─────────────────────────────── sheets ─────────────────────────────── */

function ProfileMenu({ visible, th, wide, topInset, onClose, onOne01, onCreate, onExit }: { visible: boolean; th: ShellTheme; wide: boolean; topInset: number; onClose: () => void; onOne01: () => void; onCreate: () => void; onExit: () => void }) {
  const items = [
    { label: 'Settings', onPress: onClose },
    { label: 'Legal', onPress: onClose },
    { label: 'Feature Updates', onPress: onClose },
    { label: 'Support', onPress: onClose },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, wide && styles.scrimWide]} onPress={onClose}>
        <Pressable style={[wide ? styles.dropdown : styles.menu, { backgroundColor: th.surface, borderColor: th.border }, wide && { marginTop: topInset + 66 }]} onPress={() => {}}>
          {!wide && <View style={[styles.avatarLg, { backgroundColor: th.surface2, borderColor: th.accent }]}><UserIcon size={28} color={th.muted} /></View>}
          <Text style={[styles.menuSmall, { color: th.muted }]}>ACCOUNT</Text>
          <View style={[styles.menuRow, { borderColor: th.border }]}>
            <UserIcon size={18} color={th.muted} />
            <Text style={[styles.menuRowTxt, { color: th.text }]}>Nobody</Text>
            <View style={styles.flex} />
            <Text style={{ color: th.accent }}>✓</Text>
          </View>
          <Pressable onPress={onCreate} style={styles.menuRow}><CreateIcon size={18} color={th.muted} /><Text style={[styles.menuRowTxt, { color: th.text }]}>Create</Text></Pressable>
          <View style={[styles.menuDivider, { backgroundColor: th.border }]} />
          {th.homeId !== 'one01' && (
            <Pressable onPress={onOne01} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.text }]}>← ONE01 home</Text></Pressable>
          )}
          {items.map((it) => (
            <Pressable key={it.label} onPress={it.onPress} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.text }]}>{it.label}</Text></Pressable>
          ))}
          <Pressable onPress={onExit} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.muted }]}>Log Out</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WalletSheet({ visible, th, onClose }: { visible: boolean; th: ShellTheme; onClose: () => void }) {
  const fg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.menu, { backgroundColor: th.surface, borderColor: th.border }]} onPress={() => {}}>
          <View style={[styles.walletCard, { backgroundColor: th.accent }]}>
            <Text style={[styles.walletCardLbl, { color: fg }]}>Balance</Text>
            <Text style={[styles.walletCardAmt, { color: fg }]}>$3,500</Text>
          </View>
          <View style={styles.walletRow}>
            <View style={[styles.menuItem, styles.flex, { borderColor: th.border }]}><Text style={[styles.menuItemTxt, { color: th.text, textAlign: 'center' }]}>Deposit</Text></View>
            <View style={[styles.menuItem, styles.flex, { borderColor: th.border }]}><Text style={[styles.menuItemTxt, { color: th.text, textAlign: 'center' }]}>Withdraw</Text></View>
          </View>
          <Text style={[styles.menuSmall, { color: th.muted, textAlign: 'center' }]}>Virtual balance · same identity across every app</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AppSwitcher({ visible, wide, th, current, onClose, onPick }: { visible: boolean; wide: boolean; th: ShellTheme; current: HomeId; onClose: () => void; onPick: (id: string) => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || wide) return;
    prog.setValue(0); drag.setValue(0);
    Animated.spring(prog, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
  }, [visible, wide, prog, drag]);
  const requestClose = (cb: () => void) => Animated.timing(prog, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => cb());

  // drag the glass sheet down to dismiss
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) drag.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) requestClose(onClose);
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (wide) {
    const rows: { id: HomeId; label: string; mark: MarkId }[] = [
      { id: 'one01', label: 'ONE01', mark: 'one01' },
      { id: 'one', label: 'One', mark: 'one' },
      { id: 'winzi', label: 'Winzi', mark: 'winzi' },
      { id: 'mixstar', label: 'MixStar', mark: 'mixstar' },
    ];
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={[styles.scrim, styles.scrimWideLeft]} onPress={onClose}>
          <Pressable style={[styles.appsDropdown, { backgroundColor: th.surface, borderColor: th.border }]} onPress={() => {}}>
            <View style={styles.appsHead}>
              <Text style={[styles.menuSmall, { color: th.muted }]}>APPS</Text>
              <View style={styles.flex} />
              <Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text>
            </View>
            {rows.map((a) => (
              <Pressable key={a.id} onPress={() => onPick(a.id)} style={styles.appsRow}>
                <View style={[styles.appsTile, { backgroundColor: a.mark === 'one01' ? (th.mode === 'dark' ? '#fff' : DARK_TILE) : DARK_TILE }]}>
                  <Mark mark={a.mark} size={22} accent={a.mark === 'one01' ? (th.mode === 'dark' ? '#111318' : '#fff') : markAccent(a.mark)} eye={DARK_TILE} />
                </View>
                <Text style={[styles.appsRowTxt, { color: th.text }]}>{a.label}</Text>
                <View style={styles.flex} />
                {current === a.id ? <Text style={{ color: '#22c55e', fontWeight: '800' }}>✓</Text> : null}
              </Pressable>
            ))}
            <View style={[styles.menuDivider, { backgroundColor: th.border }]} />
            <Pressable onPress={onClose} style={styles.appsRow}><Text style={[styles.appsRowTxt, { color: th.muted }]}>+ Add to favorites</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }
  const scrimOpacity = prog.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const sheetTy = prog.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => requestClose(onClose)}>
      <View style={styles.flex}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => requestClose(onClose)}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: scrimOpacity }]} pointerEvents="none" />
        </Pressable>
        <View style={styles.switchBottom} pointerEvents="box-none">
          <Animated.View {...pan.panHandlers} style={{ transform: [{ translateY: Animated.add(sheetTy, drag) }] }}>
            <BlurView intensity={48} tint="dark" style={styles.switchSheet}>
              <View style={styles.switchGlass} pointerEvents="none" />
              <View style={styles.switchGrab} />
              <Pressable onPress={() => requestClose(() => onPick('one01'))} style={styles.switchTop}>
                <View style={[styles.appTile, styles.appTileBig, { backgroundColor: '#fff', borderColor: current === 'one01' ? '#fff' : 'transparent' }]}><One01Mark size={38} color="#111318" /></View>
                <Text style={styles.appLabel}>One01</Text>
              </Pressable>
              <View style={styles.switchGrid}>
                {SWITCHER_APPS.map((a) => (
                  <Pressable key={a.id} onPress={() => requestClose(() => onPick(a.id))} style={styles.switchItem}>
                    <View style={[styles.appTile, { backgroundColor: DARK_TILE, borderColor: current === a.id ? a.mark === 'winzi' ? '#F9D800' : '#8B5CF6' : 'transparent' }]}>
                      <Mark mark={a.mark} size={32} accent={markAccent(a.mark)} eye={DARK_TILE} />
                    </View>
                    <Text style={styles.appLabel}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => requestClose(onClose)} style={styles.switchClose} hitSlop={12}><Text style={styles.switchCloseTxt}>✕</Text></Pressable>
            </BlurView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function ExternalModal({ app, onClose }: { app: EcosystemApp | null; onClose: () => void }) {
  return (
    <Modal visible={!!app} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.menu, { backgroundColor: '#15161B', borderColor: 'rgba(255,255,255,0.1)' }]} onPress={() => {}}>
          {app && (
            <>
              <View style={[styles.projTile, { backgroundColor: DARK_TILE, alignSelf: 'center', width: 60, height: 60, borderRadius: 16 }]}>
                <Mark mark={app.mark} size={34} accent={markAccent(app.mark)} eye={DARK_TILE} />
              </View>
              <Text style={[styles.menuName, { color: '#fff' }]}>{app.name}</Text>
              <Text style={[styles.menuSmall, { color: 'rgba(255,255,255,0.6)', textAlign: 'center' }]}>{app.tagline} · {app.domain}</Text>
              <Pressable onPress={onClose} style={[styles.menuItem, { borderColor: app.accent }]}><Text style={[styles.menuItemTxt, { color: app.accent, textAlign: 'center' }]}>Got it</Text></Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailOverlay({ th, wide, kind, item, topInset, onBack, onPrimary, onToast }: { th: ShellTheme; wide: boolean; kind: DetailKind; item: HomeItem; topInset: number; onBack: () => void; onPrimary: () => void; onToast?: (m: string) => void }) {
  const { height: winH } = useWindowDimensions();
  const sheetTop = topInset + 74;
  const sheetH = winH - sheetTop;
  const ty = useRef(new Animated.Value(sheetH)).current;
  const scrollY = useRef(0);

  useEffect(() => {
    if (wide) return;
    Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 13 }).start();
  }, [wide, ty]);

  // close = slide the sheet down (the scrim fades with it via interpolation), then unmount
  const close = () => Animated.timing(ty, { toValue: sheetH, duration: 220, useNativeDriver: true }).start(() => onBack());

  // drag to dismiss from anywhere on the card — but only once the content is scrolled to the top
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5 && scrollY.current <= 2,
      onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.8) close();
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // desktop: a regular full page (nav bar stays above it), not a popup card
  if (wide) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, paddingTop: topInset }]}>
        <DetailPage th={th} wide kind={kind} item={item} topPad={56} onBack={onBack} onPrimary={onPrimary} onToast={onToast} />
      </View>
    );
  }

  const scrimOpacity = ty.interpolate({ inputRange: [0, sheetH], outputRange: [0.42, 0], extrapolate: 'clamp' });

  // mobile: sheet rises from the bottom; the scrim behind FADES (opacity), never slides
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: scrimOpacity }]} pointerEvents="none" />
      </Pressable>
      <Animated.View {...pan.panHandlers} style={[styles.detailSheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: ty }] }]}>
        <View style={styles.detailDrag}>
          <View style={[styles.detailGrab, { backgroundColor: th.border }]} />
        </View>
        <DetailPage th={th} kind={kind} item={item} onBack={close} onPrimary={onPrimary} onToast={onToast} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }} />
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────────── banner sheet ─────────────────────────────── */

function BannerPage({ th, slide, close, onScroll, onCta }: { th: ShellTheme; slide: ShellHero; close: () => void; onScroll?: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void; onCta: () => void }) {
  const insets = useSafeAreaInsets();
  const colors: [string, string] = th.mode === 'dark' ? [`${th.glow}CC`, th.surface] : ['#EDEFF3', '#DCE1E8'];
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: 12 }]}>
        <View style={styles.flex} />
        <Pressable onPress={close} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.xmark, { color: th.text }]}>✕</Text>
        </Pressable>
      </View>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bannerHero}>
          <View style={styles.bannerBadge}><Text style={styles.bannerBadgeTxt}>{slide.badge}</Text></View>
          <Text style={[styles.bannerHeroTitle, { color: th.text }]}>{slide.title}</Text>
        </LinearGradient>
        <Text style={[styles.bannerPageBody, { color: th.muted }]}>{slide.subtitle}</Text>
        <Pressable onPress={onCta} style={[styles.bannerPageCta, { backgroundColor: th.accent }]}>
          <Text style={[styles.bannerPageCtaTxt, { color: ctaFg }]}>{slide.ctaLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── notifications ─────────────────────────────── */

function agoShort(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function NotificationsPage({ th, lang, close, onScroll }: { th: ShellTheme; lang: Lang; close: () => void; onScroll?: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void }) {
  const insets = useSafeAreaInsets();
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const notifs = useMemo(() => buildNotifs(transactions), [transactions]);
  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: 12 }]}>
        <Text style={[styles.notifTitle, { color: th.text }]}>{tr(lang, 'Notifications')}</Text>
        <View style={styles.flex} />
        <Pressable onPress={close} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.xmark, { color: th.text }]}>✕</Text>
        </Pressable>
      </View>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30, gap: 10 }}>
        {notifs.length === 0 ? (
          <Text style={[styles.searchHint, { color: th.muted }]}>{tr(lang, 'Nothing new')}</Text>
        ) : notifs.map((n) => (
          <View key={n.id} style={[styles.notifRow, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={[styles.notifTile, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 20 }}>{n.emoji}</Text></View>
            <View style={styles.flex}>
              <Text style={[styles.notifRowTitle, { color: th.text }]} numberOfLines={1}>{n.title}</Text>
              <Text style={[styles.notifRowBody, { color: th.muted }]} numberOfLines={1}>{n.body}</Text>
            </View>
            <Text style={[styles.notifTime, { color: th.muted }]}>{agoShort(n.ts)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── search sheet ─────────────────────────────── */

function SearchSheet({ th, homeId, lang, close, onResult }: { th: ShellTheme; homeId: HomeId; lang: Lang; close: () => void; onResult: (r: SearchResult) => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const pid: ProductId = homeId === 'one01' ? 'one' : homeId;
  const home = HOME[homeId];
  const results = useMemo<SearchResult[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: SearchResult[] = [];
    home.items.forEach((it) => {
      if (it.title.toLowerCase().includes(term) || (it.subtitle ?? '').toLowerCase().includes(term)) out.push({ type: 'item', item: it });
    });
    MARKET[pid].pillars.forEach((p) => {
      if (p.title.toLowerCase().includes(term) || p.tagline.toLowerCase().includes(term)) out.push({ type: 'market', pillar: p });
    });
    return out.slice(0, 30);
  }, [q, home, pid]);

  return (
    <View style={styles.flex}>
      <View style={styles.searchHead}>
        <View style={[styles.searchBox, { backgroundColor: th.surface2, borderColor: th.border }]}>
          <SearchIcon size={17} color={th.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={`${tr(lang, 'Search')}…`} placeholderTextColor={th.muted} style={[styles.searchInput, { color: th.text }]} autoFocus returnKeyType="search" />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text style={{ color: th.muted, fontSize: 15 }}>✕</Text></Pressable> : null}
        </View>
        <Pressable onPress={close} hitSlop={10}><Text style={[styles.searchCancel, { color: th.accent }]}>{tr(lang, 'Cancel')}</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }}>
        {!q.trim() ? (
          <Text style={[styles.searchHint, { color: th.muted }]}>{tr(lang, 'Search games, projects, listings…')}</Text>
        ) : results.length === 0 ? (
          <Text style={[styles.searchHint, { color: th.muted }]}>{tr(lang, 'No results')}</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 4 }}>
            {results.map((r, i) => {
              const title = r.type === 'item' ? r.item.title : r.pillar.title;
              const sub = r.type === 'item' ? r.item.subtitle : r.pillar.tagline;
              const emoji = r.type === 'item' ? r.item.emoji : r.pillar.emoji;
              const mark = r.type === 'item' ? r.item.mark : undefined;
              const bg = r.type === 'item' ? r.item.bg : undefined;
              const tag = r.type === 'market' ? tr(lang, 'Market') : tr(lang, home.sectionTitle);
              return (
                <Pressable key={`${r.type}_${i}`} onPress={() => onResult(r)} style={({ pressed }) => [styles.searchRow, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                  <LinearGradient colors={bg ?? [DARK_TILE, '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchTile}>
                    {mark ? <Mark mark={mark} size={24} accent={markAccent(mark)} eye={DARK_TILE} /> : <Text style={{ fontSize: 22 }}>{emoji}</Text>}
                  </LinearGradient>
                  <View style={styles.flex}>
                    <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{title}</Text>
                    <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{sub}</Text>
                  </View>
                  <Text style={[styles.searchTag, { color: th.muted }]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════ styles ══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0 },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 60 },
  toast: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  toastTxt: { fontSize: 13.5, fontWeight: '700' },

  /* mobile top bar */
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 26 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  surfaceHeadline: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  walletBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletAmt: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeTxt: { fontSize: 10, fontWeight: '800' },
  notifTitle: { fontSize: 20, fontWeight: '800' },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 12 },
  notifTile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifRowTitle: { fontSize: 14.5, fontWeight: '700' },
  notifRowBody: { fontSize: 12.5, marginTop: 2 },
  notifTime: { fontSize: 11.5, fontWeight: '600' },
  lvlPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  lvlTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  avatarWrap: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  avBadgeTxt: { fontSize: 11, fontWeight: '800' },

  /* mobile bottom bar */
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 34, paddingTop: 46, paddingHorizontal: 24 },
  navBtn: { width: 52, alignItems: 'center' },
  navCenterWrap: { alignItems: 'center' },
  navCenter: { alignItems: 'center', justifyContent: 'center', marginTop: -20 },

  /* desktop nav */
  desktopNav: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 24 },
  desktopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, paddingTop: 8, gap: 34 },
  desktopLogo: { marginRight: 6 },
  navWordmark: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  desktopLinks: { flexDirection: 'row', gap: 26 },
  navLink: { fontSize: 15, fontWeight: '600' },

  /* banner */
  banner: { height: 240, borderRadius: 22, padding: 22, marginRight: 12, justifyContent: 'space-between' },
  bannerBadge: { alignSelf: 'flex-start', backgroundColor: '#33E17A', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  bannerBadgeTxt: { fontSize: 12, fontWeight: '800', color: '#05331c' },
  bannerFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bannerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 26 },
  bannerSub: { fontSize: 14, marginTop: 6 },
  bannerCta: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  bannerCtaTxt: { fontSize: 14, fontWeight: '700', color: '#111' },
  bannerDots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 12 },
  bannerDot: { height: 6, borderRadius: 3 },

  /* search sheet */
  searchHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 13, height: 44 },
  searchInput: { flex: 1, fontSize: 15.5, fontWeight: '600', paddingVertical: 0 },
  searchCancel: { fontSize: 15, fontWeight: '700' },
  searchHint: { fontSize: 14, lineHeight: 20, marginTop: 24, textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 11 },
  searchTile: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchTag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },

  /* banner sheet */
  bannerHero: { height: 200, borderRadius: 22, padding: 22, justifyContent: 'space-between', overflow: 'hidden', marginTop: 4 },
  bannerHeroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  bannerPageBody: { fontSize: 15, lineHeight: 22, marginTop: 18 },
  bannerPageCta: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  bannerPageCtaTxt: { fontSize: 16, fontWeight: '800' },

  /* categories */
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  catIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  pillTxt: { fontSize: 14, fontWeight: '600' },

  /* section */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 14 },
  sectionIcon: { fontSize: 18 },
  sectionIconBox: { alignItems: 'center', justifyContent: 'center', minWidth: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  sectionCount: { fontSize: 15, fontWeight: '600' },
  sectionArrow: { fontSize: 20, fontWeight: '600' },

  /* project rows */
  rowsWrap: { gap: 12 },
  rowsWrapWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  projRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 12 },
  projRowWide: { width: '48.5%' },
  projTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  projName: { fontSize: 17, fontWeight: '700' },
  projSub: { fontSize: 13.5, marginTop: 3 },
  ctaPill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  ctaPillTxt: { fontSize: 13.5, fontWeight: '700' },
  getPill: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  getPillTxt: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  /* artwork cards */
  artCard: { width: 168, height: 196, borderRadius: 18, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
  artEmoji: { fontSize: 54, textAlign: 'center', marginTop: 16 },
  artMark: { alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  artCta: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  artCtaTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },

  /* project cubes (square brand tiles) */
  projCubeWrap: { width: 140 },
  projCube: { width: 140, height: 140, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  projCubeCta: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.34)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  projCubeName: { fontSize: 15, fontWeight: '800', marginTop: 9 },
  projCubeSub: { fontSize: 12, marginTop: 1 },
  artFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  artTitle: { fontSize: 16, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3 },
  artMetric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  artDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  artMetricTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },

  /* drawers: people */
  personCard: { width: 108, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4 },
  personAv: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  personName: { fontSize: 14, fontWeight: '800' },
  personMeta: { fontSize: 11.5, fontWeight: '600' },

  /* drawers: events */
  eventCard: { width: 190, height: 116, borderRadius: 18, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
  eventEmoji: { fontSize: 30 },
  eventTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  eventMeta: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.82)', marginTop: 2 },

  /* drawers: stats */
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { width: '48%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 3 },
  statTileWide: { width: '23.5%' },
  statBig: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statDelta: { fontSize: 12, fontWeight: '800', marginTop: 2 },

  /* drawers: live feed (now folded under Stats) */
  statFeedHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 10 },
  statFeedTitle: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  feedPill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  feedTxt: { fontSize: 13.5, fontWeight: '600' },
  feedTime: { fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },

  /* drawer header (shelf) — more space above each */
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 42, marginBottom: 16 },
  drawerHeadIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },

  /* drawer detail (focused page / sheet) */
  corner: { position: 'absolute', zIndex: 5, width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, fontWeight: '400', lineHeight: 30 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  xmark: { fontSize: 17, fontWeight: '600' },
  drawerHeader: { paddingHorizontal: 18, paddingBottom: 14, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  drawerHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  drawerBody: { width: '100%', paddingHorizontal: 18 },
  drawerBodyWide: { width: 640, maxWidth: '100%' },
  drawerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 18 },
  drawerBigTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  drawerList: { gap: 10 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12 },
  drawerAv: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  drawerEventCard: { borderRadius: 18, padding: 16, height: 118, justifyContent: 'space-between', overflow: 'hidden' },
  drawerCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  drawerCardWrap: { width: '48%' },
  drawerArtCard: { width: '100%', height: 180, borderRadius: 18, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },

  /* surface view */
  surfaceHead: { fontSize: 22, fontWeight: '800' },
  surfaceSub: { fontSize: 14, lineHeight: 20 },
  structure: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 12 },
  structureTxt: { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  pillar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  pillarTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillarEmoji: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pillarDetail: { fontSize: 13, lineHeight: 19 },
  price: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  priceTxt: { fontSize: 13, fontWeight: '700' },

  /* sheets */
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  scrimWide: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingHorizontal: 40 },
  scrimWideLeft: { alignItems: 'flex-start', justifyContent: 'flex-start', paddingLeft: 40, paddingTop: 58, backgroundColor: 'transparent' },

  /* detail overlay */
  detailScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  detailCard: { width: '100%', maxWidth: 560, height: '86%', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  detailSheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  detailDrag: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  detailGrab: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },

  /* desktop apps dropdown */
  appsDropdown: { width: 248, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 10, gap: 2 },
  appsHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 },
  appsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 11 },
  appsTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  appsRowTxt: { fontSize: 15, fontWeight: '700' },
  menu: { width: '100%', maxWidth: 360, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 18, gap: 8 },
  dropdown: { width: 240, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 2 },
  avatarLg: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  menuSmall: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 6, paddingTop: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10 },
  menuRowTxt: { fontSize: 15, fontWeight: '600' },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  menuName: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  menuItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  menuItemTxt: { fontSize: 15, fontWeight: '700' },
  walletCard: { borderRadius: 18, padding: 20, gap: 4 },
  walletCardLbl: { fontSize: 13, fontWeight: '600' },
  walletCardAmt: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  walletRow: { flexDirection: 'row', gap: 10 },

  /* app switcher */
  switchRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  switchBottom: { flex: 1, justifyContent: 'flex-end' },
  switchSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden' },
  switchGlass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,18,24,0.42)', borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  switchGrab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 18 },
  switchTop: { alignItems: 'center', gap: 8, marginBottom: 22 },
  switchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: 320 },
  switchItem: { width: 86, alignItems: 'center', gap: 8 },
  appTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  appTileBig: { width: 72, height: 72, borderRadius: 20 },
  appLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  switchClose: { marginTop: 26, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  switchCloseTxt: { fontSize: 20, color: 'rgba(255,255,255,0.6)' },
});
