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
  KeyboardAvoidingView,
  Platform,
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
import { SheetWindow, ProfilePage, WalletPage, SettingsPage, NetworkPage } from '../../components/one01/Panels';
import { MiniPlayer, type PlayKind } from '../../components/one01/MiniPlay';
import { useOne01PlatformStore, pendingEarnings, buildNotifs, VENTURE_LADDER, type UserCreation, type Venture, type NotifNav } from '../../stores/one01PlatformStore';
import { onboardingFor } from '../../data/one01/onboarding';
import { tr, type Lang } from '../../data/one01/i18n';
import {
  PRODUCTS,
  ECOSYSTEM_APPS,
  FEATURED_SLIDES,
  MARKET,
  MARKET_ONE01,
  VENTURE_KIT,
  CREATOR,
  FRESH_LISTINGS,
  CREATABLES,
  CREATABLES_ONE01,
  RARITIES,
  RARITY_COLOR,
  type Creatable,
  type Rarity,
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
type ProfileTab = 'posts' | 'notifs' | 'about';

const GLOWS: Record<HomeId, string> = { one01: '#E8B923', one: '#6B7280', winzi: '#3B5BDB', mixstar: '#8B5CF6' };
const DARK_TILE = '#131317';
const CW = 700; // desktop content column
const WIDE_AT = 900;

function shellTheme(homeId: HomeId, appearance: 'light' | 'dark' = 'light'): ShellTheme {
  if (homeId === 'one01') {
    if (appearance === 'dark') {
      return {
        homeId, mode: 'dark', mark: 'one01', name: 'ONE01', accent: '#2DD4A7', glow: '#1E9E8A',
        bg: '#0A0C12', surface: '#161A24', surface2: '#212736', text: '#EEF1F7', muted: '#8C93A6', border: '#2A3040',
      };
    }
    return {
      homeId, mode: 'light', mark: 'one01', name: 'ONE01', accent: '#10B981', glow: GLOWS.one01,
      bg: '#F6F7F9', surface: '#FFFFFF', surface2: '#EDEFF3', text: '#0E1116', muted: '#6B7280', border: '#E4E7EC',
    };
  }
  // products keep their own dark brand canvas (the appearance toggle is ONE01-only)
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
  const openProfile = () => {
    const { transactions, notifsSeenAt } = useOne01PlatformStore.getState();
    const unread = buildNotifs(transactions).filter((n) => n.ts > notifsSeenAt).length;
    // the profile avatar now carries the unread dot — if there's anything new,
    // open straight on Notifications and clear it; otherwise land on Posts
    if (unread > 0) { markNotifsSeen(); setProfileTab('notifs'); } else setProfileTab('posts');
    setSheet('profile');
  };

  const [homeId, setHomeId] = useState<HomeId>('one01');
  const [tab, setTab] = useState<Tab>('home');
  const [onboardFor, setOnboardFor] = useState<ProductId | null>(null);
  const [sheet, setSheet] = useState<null | 'wallet' | 'profile' | 'switch' | 'settings' | 'network'>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('posts');
  const [externalApp, setExternalApp] = useState<EcosystemApp | null>(null);
  const [detail, setDetail] = useState<{ kind: DetailKind; item: HomeItem } | null>(null);
  const [play, setPlay] = useState<{ kind: PlayKind; item: HomeItem } | null>(null);
  const [drawer, setDrawer] = useState<{ kind: DrawerKind } | null>(null);
  const [ventureId, setVentureId] = useState<string | null>(null);
  const [bannerSlide, setBannerSlide] = useState<ShellHero | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // web mobile: tint the browser chrome (status bar / toolbar) + the root paint to
  // the current product, so the safe-area regions match instead of the ONE app's light
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = shellTheme(homeId, appearance).bg;
    // replace any existing theme-color metas (the base build ships light ones)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.parentNode && m.parentNode.removeChild(m));
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', bg);
    document.head.appendChild(meta);
    try {
      document.documentElement.style.backgroundColor = bg;
      if (document.body) document.body.style.backgroundColor = bg;
    } catch { /* no DOM */ }
  }, [homeId, appearance]);

  // tapping a notification / feed post jumps to whatever it's about
  const onNotifNav = (nav: NotifNav) => {
    if (nav.kind === 'wallet') { setSheet('wallet'); return; }
    if (nav.kind === 'network') { setSheet('network'); return; }
    setSheet(null);
    if (nav.kind === 'home') { haptic.select(); setHomeId(nav.homeId as HomeId); setTab('home'); }
    else if (nav.kind === 'market') { setTab('market'); }
    else if (nav.kind === 'create') { setTab('create'); }
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
    showToast(`Published “${p.title}” — now live on the Market`);
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
      <TopGlow th={th} w={width} h={Math.round(height * 0.62)} />

      <View style={styles.flex}>
        {tab === 'home' && <HomeContent key={homeId} th={th} wide={wide} topPad={topPad} bottomPad={bottomPad} onOpen={openDetail} onOpenDrawer={(k) => setDrawer({ kind: k })} onOpenBanner={(s) => setBannerSlide(s)} onOpenSearch={() => setSearchOpen(true)} onOpenVenture={(id) => setVentureId(id)} lang={lang} />}
        {tab === 'market' && <SurfaceView th={th} wide={wide} kind="market" topPad={topPad} bottomPad={bottomPad} onBuy={buyPillar} onOpenMarket={openMarketDetail} onBuild={buildPillar} onToast={showToast} lang={lang} onGoCreate={() => setTab('create')} onOpenVenture={(id) => setVentureId(id)} />}
        {tab === 'create' && <CreatorChat th={th} wide={wide} topPad={topPad} bottomPad={bottomPad} onToast={showToast} onOpenWallet={() => setSheet('wallet')} onOpenVenture={(id) => setVentureId(id)} lang={lang} />}
      </View>

      {/* concave "VR" curve — soft edge vignette over the content (desktop only) */}
      {wide && <ScreenCurve th={th} />}

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
        <DesktopNav th={th} tab={tab} setTab={setTab} onWallet={() => setSheet('wallet')} onProfile={openProfile} onPickApp={pickApp} onSettings={() => setSheet('settings')} onExit={onExit} lang={lang} />
      ) : (
        <MobileTopBar th={th} onWallet={() => setSheet('wallet')} onProfile={openProfile} topInset={insets.top} />
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
            initialTab={profileTab}
            onNavigate={onNotifNav}
            onOpenNetwork={() => setSheet('network')}
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
      <SheetWindow visible={sheet === 'network'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => <NetworkPage th={th} close={close} onScroll={onScroll} lang={lang} />}
      </SheetWindow>
      <SheetWindow visible={sheet === 'settings'} wide={wide} th={th} onClose={() => setSheet(null)}>
        {(close, onScroll) => <SettingsPage th={th} close={close} onScroll={onScroll} lang={lang} />}
      </SheetWindow>
      <SheetWindow visible={!!bannerSlide} wide={wide} th={th} onClose={() => setBannerSlide(null)}>
        {(close, onScroll) => (bannerSlide ? <BannerPage th={th} slide={bannerSlide} close={close} onScroll={onScroll} onCta={() => { setBannerSlide(null); setTab('market'); }} /> : null)}
      </SheetWindow>
      <SheetWindow visible={searchOpen} wide={wide} th={th} onClose={() => setSearchOpen(false)}>
        {(close) => <SearchSheet th={th} homeId={homeId} lang={lang} close={close} onResult={onSearchResult} />}
      </SheetWindow>
      <SheetWindow visible={!!ventureId} wide={wide} th={th} onClose={() => setVentureId(null)}>
        {(close, onScroll) => <VentureSheet ventureId={ventureId} th={th} lang={lang} close={close} onScroll={onScroll} onToast={showToast} onOpenMarket={() => { close(); setTab('market'); }} />}
      </SheetWindow>
      <AppSwitcher visible={sheet === 'switch'} wide={wide} th={th} current={homeId} onClose={() => setSheet(null)} onPick={pickApp} />
      <ExternalModal app={externalApp} onClose={() => setExternalApp(null)} />
    </View>
  );
}

/* ─────────────────────────────── screen curve (VR concavity) ─────────────────────────────── */

/** A soft left/right edge vignette so the flat page reads like the centre of a
 *  gently concave, curved screen — the edges fall away from the viewer. Desktop only. */
function ScreenCurve({ th }: { th: ShellTheme }) {
  const edge = th.mode === 'dark' ? 'rgba(0,0,0,0.20)' : 'rgba(10,12,20,0.06)';
  const clear = 'rgba(0,0,0,0)';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[edge, clear]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.curveEdge, { left: 0 }]} />
      <LinearGradient colors={[clear, edge]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.curveEdge, { right: 0 }]} />
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
          <RadialGradient id={gid} cx={w / 2} cy={0} rx={w * 1.2} ry={h} fx={w / 2} fy={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={th.glow} stopOpacity={dark ? 0.42 : 0.15} />
            <Stop offset="0.4" stopColor={th.glow} stopOpacity={dark ? 0.16 : 0.06} />
            <Stop offset="0.72" stopColor={th.glow} stopOpacity={dark ? 0.04 : 0.015} />
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

/** Profile button — its avatar carries the unread-notifications dot. */
function ProfileBtn({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const seenAt = useOne01PlatformStore((s) => s.notifsSeenAt);
  const unread = useMemo(() => buildNotifs(transactions).filter((n) => n.ts > seenAt).length, [transactions, seenAt]);
  const badgeFg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <Pressable onPress={onPress} style={styles.profileBtn} hitSlop={8}>
      <View style={[styles.lvlPill, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Text style={[styles.lvlTxt, { color: th.text }]}>LVL 13</Text>
      </View>
      <View style={[styles.avatar, { borderColor: th.accent, backgroundColor: th.surface2 }]}>
        <UserIcon size={22} color={th.muted} />
        {unread > 0 && (
          <View style={[styles.profileBadge, { backgroundColor: th.accent, borderColor: th.bg }]}>
            <Text style={[styles.profileBadgeTxt, { color: badgeFg }]}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function MobileTopBar({ th, onWallet, onProfile, topInset }: { th: ShellTheme; onWallet: () => void; onProfile: () => void; topInset: number }) {
  return (
    // the absolute bar must clear the status bar itself (root padding doesn't offset absolute children)
    <LinearGradient colors={[th.bg, th.bg, `${th.bg}00`]} locations={[0, 0.58, 1]} style={[styles.topBar, { paddingTop: topInset }]} pointerEvents="box-none">
      <View style={styles.topRow}>
        <WalletChip th={th} onPress={onWallet} />
        <View style={styles.topRight}>
          <ProfileBtn th={th} onPress={onProfile} />
        </View>
      </View>
    </LinearGradient>
  );
}

function MobileBottomBar({ th, tab, setTab, onSwitch, bottomInset }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onSwitch: () => void; bottomInset: number }) {
  return (
    <LinearGradient colors={[`${th.bg}00`, th.bg]} style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('market'); }}>
        <ShopIcon size={26} color={tab === 'market' ? th.text : th.muted} />
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
        <CreateIcon size={26} color={tab === 'create' ? th.text : th.muted} />
      </Pressable>
    </LinearGradient>
  );
}

/* ─────────────────────────────── desktop nav ─────────────────────────────── */

function DesktopNav({ th, tab, setTab, onWallet, onProfile, onPickApp, onSettings, onExit, lang }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onWallet: () => void; onProfile: () => void; onPickApp: (id: string) => void; onSettings: () => void; onExit: () => void; lang: Lang }) {
  const [menu, setMenu] = useState<null | 'apps' | 'wallet' | 'profile'>(null);
  const links: { k: Tab; label: string }[] = [
    { k: 'home', label: tr(lang, 'Home') },
    { k: 'market', label: tr(lang, 'Market') },
    { k: 'create', label: tr(lang, 'Creator') },
  ];
  const close = () => setMenu(null);
  return (
    <LinearGradient colors={[th.bg, `${th.bg}00`]} style={styles.desktopNav} pointerEvents="box-none">
      <View style={styles.desktopRow}>
        {/* logo → apps menu on hover */}
        <View onPointerEnter={() => setMenu('apps')} onPointerLeave={close} style={styles.navHover}>
          <Pressable onPress={() => setMenu((m) => (m === 'apps' ? null : 'apps'))} style={styles.desktopLogo}>
            {th.homeId === 'one01' ? (
              <One01Wordmark height={38} color={th.text} />
            ) : (
              <View style={styles.row}>
                <Mark mark={th.mark} size={34} accent={th.accent} />
                <Text style={[styles.navWordmark, { color: th.text }]}>{th.name}</Text>
              </View>
            )}
          </Pressable>
          {menu === 'apps' && <AppsDrop th={th} current={th.homeId} onPick={(id) => { close(); onPickApp(id); }} />}
        </View>

        <View style={styles.desktopLinks}>
          {links.map((l) => (
            <Pressable key={l.k} onPress={() => setTab(l.k)}>
              <Text style={[styles.navLink, { color: l.k === tab ? th.text : th.muted }]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.flex} />

        {/* wallet → quick menu on hover, full window on click */}
        <View onPointerEnter={() => setMenu('wallet')} onPointerLeave={close} style={styles.navHover}>
          <WalletChip th={th} onPress={() => { close(); onWallet(); }} />
          {menu === 'wallet' && <WalletDrop th={th} lang={lang} onOpenFull={() => { close(); onWallet(); }} />}
        </View>

        <View style={{ width: 16 }} />

        {/* profile → account menu on hover, full window on click */}
        <View onPointerEnter={() => setMenu('profile')} onPointerLeave={close} style={styles.navHover}>
          <ProfileBtn th={th} onPress={() => { close(); onProfile(); }} />
          {menu === 'profile' && <ProfileDrop th={th} lang={lang} onSettings={() => { close(); onSettings(); }} onExit={() => { close(); onExit(); }} onOpenFull={() => { close(); onProfile(); }} />}
        </View>
      </View>
    </LinearGradient>
  );
}

/* ─────────────────────────────── desktop hover dropdowns ─────────────────────────────── */

const APP_ROWS: { id: HomeId; label: string; mark: MarkId }[] = [
  { id: 'one01', label: 'ONE01', mark: 'one01' },
  { id: 'one', label: 'One', mark: 'one' },
  { id: 'winzi', label: 'Winzi', mark: 'winzi' },
  { id: 'mixstar', label: 'MixStar', mark: 'mixstar' },
];

function AppsDrop({ th, current, onPick }: { th: ShellTheme; current: HomeId; onPick: (id: string) => void }) {
  return (
    <View style={[styles.navDrop, styles.navDropLeft]}>
      <View style={[styles.appsDropdown, { backgroundColor: th.surface, borderColor: th.border }]}>
        <View style={styles.appsHead}><Text style={[styles.menuSmall, { color: th.muted }]}>APPS</Text><View style={styles.flex} /><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></View>
        {APP_ROWS.map((a) => (
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
        <Pressable style={styles.appsRow}><Text style={[styles.appsRowTxt, { color: th.muted }]}>+ Add to favorites</Text></Pressable>
      </View>
    </View>
  );
}

function WalletDrop({ th, lang, onOpenFull }: { th: ShellTheme; lang: Lang; onOpenFull: () => void }) {
  const t = (en: string) => tr(lang, en);
  const balance = useOne01PlatformStore((s) => s.balance);
  const creations = useOne01PlatformStore((s) => s.creations);
  const credit = useOne01PlatformStore((s) => s.credit);
  const earned = creations.reduce((a, c) => a + c.collected, 0);
  return (
    <View style={[styles.navDrop, styles.navDropRight]}>
      <View style={[styles.menuPanel, { backgroundColor: th.surface, borderColor: th.border }]}>
        <View style={styles.appsHead}><Text style={[styles.menuSmall, { color: th.muted }]}>{t('Wallet')}</Text><View style={styles.flex} /><Pressable onPress={onOpenFull}><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></Pressable></View>
        <Text style={[styles.menuBal, { color: th.text }]}>${balance.toLocaleString()}</Text>
        <Text style={[styles.menuSmall, { color: th.muted, marginTop: 2 }]}>USD</Text>
        <View style={{ gap: 12, marginTop: 14 }}>
          <View style={styles.menuHold}>
            <View style={[styles.appsTile, { backgroundColor: DARK_TILE }]}><Mark mark="one01" size={16} accent={th.mode === 'dark' ? '#111318' : '#fff'} /></View>
            <Text style={[styles.appsRowTxt, { color: th.text }]} numberOfLines={1}>ONE01 Credits</Text><View style={styles.flex} /><Text style={[styles.appsRowTxt, { color: th.text }]}>⟡{balance.toLocaleString()}</Text>
          </View>
          {earned > 0 && (
            <View style={styles.menuHold}>
              <View style={[styles.appsTile, { backgroundColor: DARK_TILE }]}><Text style={{ fontSize: 14 }}>🧱</Text></View>
              <Text style={[styles.appsRowTxt, { color: th.text }]} numberOfLines={1}>Creator earnings</Text><View style={styles.flex} /><Text style={[styles.appsRowTxt, { color: '#22c55e' }]}>⟡{earned.toLocaleString()}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable onPress={() => { haptic.success(); credit(1000, 'Deposit · virtual rails'); }} style={[styles.menuBtn, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.menuBtnTxt, { color: th.text }]}>↓ {t('Deposit')}</Text></Pressable>
          <Pressable onPress={onOpenFull} style={[styles.menuBtn, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.menuBtnTxt, { color: th.text }]}>↑ {t('Withdraw')}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function ProfileDrop({ th, lang, onSettings, onExit, onOpenFull }: { th: ShellTheme; lang: Lang; onSettings: () => void; onExit: () => void; onOpenFull: () => void }) {
  const t = (en: string) => tr(lang, en);
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <View style={[styles.navDrop, styles.navDropRight]}>
      <View style={[styles.menuPanel, { backgroundColor: th.surface, borderColor: th.border }]}>
        <View style={styles.appsHead}><Text style={[styles.menuSmall, { color: th.muted }]}>{t('Account')}</Text><View style={styles.flex} /><Pressable onPress={onSettings}><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></Pressable></View>
        <Pressable onPress={onOpenFull} style={styles.menuAcct}>
          <View style={[styles.avatarSm, { backgroundColor: th.surface2, borderColor: th.accent }]}><UserIcon size={16} color={th.muted} /></View>
          <Text style={[styles.appsRowTxt, { color: th.text }]}>Nobody</Text><View style={styles.flex} /><Text style={{ color: '#22c55e', fontWeight: '800' }}>✓</Text>
        </Pressable>
        <View style={styles.menuUpgrade}>
          <View style={[styles.upPill, { backgroundColor: th.accent }]}><Text style={[styles.upPillTxt, { color: ctaFg }]}>{t('Upgrade')}</Text></View>
          <View style={[styles.upBar, { backgroundColor: th.surface2 }]}><View style={[styles.upBarFill, { backgroundColor: th.accent, width: '62%' }]} /></View>
          <Text style={[styles.menuSmall, { color: th.muted }]}>Level 13</Text>
        </View>
        <View style={[styles.menuDivider, { backgroundColor: th.border }]} />
        <Pressable onPress={onOpenFull} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.muted }]}>＋  {t('Create Organization')}</Text></Pressable>
        <Pressable onPress={onSettings} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.text }]}>⚙  {t('Settings')}</Text></Pressable>
        <Pressable onPress={onOpenFull} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.text }]}>⚖  {t('Legal')}</Text></Pressable>
        <Pressable onPress={onOpenFull} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.text }]}>?  {t('Support')}</Text></Pressable>
        <Pressable onPress={onExit} style={styles.menuRow}><Text style={[styles.menuRowTxt, { color: th.muted }]}>⤷  {t('Log out')}</Text></Pressable>
        <View style={[styles.menuDivider, { backgroundColor: th.border }]} />
        <View style={styles.menuFoot}><Text style={[styles.menuSmall, { color: th.muted }]}>V1.3</Text><View style={styles.flex} /><Text style={{ color: th.muted }}>☀  EN</Text></View>
      </View>
    </View>
  );
}

/* ─────────────────────────────── home content ─────────────────────────────── */

/** A horizontal shelf with a fade mask on its right edge, where cards run off the
 *  side of the screen (same idea as the bottom-bar gradient, turned sideways). */
function Shelf({ th, gap = 12, children }: { th: ShellTheme; gap?: number; children: React.ReactNode }) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // web: mask the content itself to transparent at the right edge (reveals whatever is
  // behind — glow included), instead of painting a solid-colour fade over it
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const node = (ref.current as unknown as { getScrollableNode?: () => { style?: Record<string, string> } } | null)?.getScrollableNode?.();
      if (node?.style) {
        const m = 'linear-gradient(to right, #000 calc(100% - 56px), transparent 100%)';
        node.style.maskImage = m;
        (node.style as Record<string, string>).WebkitMaskImage = m;
      }
    } catch { /* non-web or no DOM node */ }
  }, []);
  return (
    <View style={styles.shelf}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap, paddingRight: 8 }} style={styles.shelfScroll}>
        {children}
      </ScrollView>
      {Platform.OS !== 'web' && (
        <LinearGradient pointerEvents="none" colors={[`${th.bg}00`, th.bg]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.shelfFade} />
      )}
    </View>
  );
}

function HomeContent({ th, wide, topPad, bottomPad, onOpen, onOpenDrawer, onOpenBanner, onOpenSearch, onOpenVenture, lang }: { th: ShellTheme; wide: boolean; topPad: number; bottomPad: number; onOpen: (kind: DetailKind, item: HomeItem) => void; onOpenDrawer: (k: DrawerKind) => void; onOpenBanner: (s: ShellHero) => void; onOpenSearch: () => void; onOpenVenture?: (id: string) => void; lang: Lang }) {
  const home = HOME[th.homeId];
  const extras = HOME_EXTRAS[th.homeId];
  const slides = th.homeId === 'one01' ? FEATURED_SLIDES.one : FEATURED_SLIDES[th.homeId];
  const { width } = useWindowDimensions();
  const colW = wide ? CW : Math.min(width, 600) - 36;
  const [cat, setCat] = useState('all');
  const ventures = useOne01PlatformStore((s) => s.ventures);
  const baseItems = cat === 'all' ? home.items : home.items.filter((it) => it.cat === cat);
  // only graduated ventures ("unicorns" — reached the final stage) join the home Projects;
  // fresh ones live in the Store until they get there
  const ventureItems: HomeItem[] = th.homeId === 'one01'
    ? ventures
        .filter((v) => { const l = VENTURE_LADDER[v.kind] ?? ['Live']; return v.status === l[l.length - 1]; })
        .map((v) => ({ id: v.id, title: v.name, subtitle: `🦄 ${v.sector} ${v.kind}`, emoji: v.emoji, cta: 'Open', status: v.status, ventureId: v.id }))
    : [];
  const items = [...ventureItems, ...baseItems];
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
                <Pressable key={c.id} onPress={() => { haptic.select(); setCat(c.id); }} style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : 'transparent', borderColor: 'transparent' }]}>
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
              <Pressable key={it.id} onPress={() => (it.ventureId ? onOpenVenture?.(it.ventureId) : onOpen('project', it))} style={({ pressed }) => [styles.projRow, wide && styles.projRowWide, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                {it.ventureId ? (
                  <CreationArt emoji={it.emoji ?? '🚀'} seed={it.title} size={54} />
                ) : (
                  <LinearGradient colors={it.bg ?? [DARK_TILE, '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.projTile}>
                    {it.mark ? <Mark mark={it.mark} size={38} accent={markAccent(it.mark)} eye={DARK_TILE} /> : <Text style={{ fontSize: 30 }}>{it.emoji}</Text>}
                  </LinearGradient>
                )}
                <View style={styles.flex}>
                  <Text style={[styles.projName, { color: th.text }]}>{it.title}</Text>
                  <Text style={[styles.projSub, { color: th.muted }]}>{it.subtitle}</Text>
                </View>
                {it.status ? <View style={[styles.statusChip, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.statusChipTxt, { color: th.text }]}>{it.status}</Text></View> : (
                  <View style={[styles.getPill, { backgroundColor: th.surface2 }]}>
                    <Text style={[styles.getPillTxt, { color: th.accent }]}>{tr(lang, it.cta ?? 'Open')}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <Shelf th={th} gap={12}>
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
          </Shelf>
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
      <Shelf th={th} gap={10}>
        {extras.people.items.map((p) => (
          <View key={p.id} style={[styles.personCard, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={[styles.personAv, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 26 }}>{p.emoji}</Text></View>
            <Text style={[styles.personName, { color: th.text }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[styles.personMeta, { color: th.muted }]} numberOfLines={1}>{p.meta}</Text>
          </View>
        ))}
      </Shelf>

      {/* events */}
      <DrawerHead th={th} kind="events" title={tr(lang, extras.events.label)} count={extras.events.items.length} onOpen={() => onOpenDrawer('events')} />
      <Shelf th={th} gap={12}>
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
      </Shelf>

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

function SurfaceView({ th, wide, kind, topPad, bottomPad, onBuy, onOpenMarket, onBuild, onToast, lang, onGoCreate, onOpenVenture }: { th: ShellTheme; wide: boolean; kind: 'market' | 'create'; topPad: number; bottomPad: number; onBuy: (price: string, title: string, kind: 'market' | 'create') => boolean; onOpenMarket: (p: SurfacePillar) => void; onBuild: (p: SurfacePillar, surface: string) => void; onToast: (m: string) => void; lang: Lang; onGoCreate?: () => void; onOpenVenture?: (id: string) => void }) {
  const ventures = useOne01PlatformStore((s) => s.ventures);
  const pid: ProductId = th.homeId === 'one01' ? 'one' : th.homeId;
  const s = kind === 'market' ? (th.homeId === 'one01' ? MARKET_ONE01 : MARKET[pid]) : CREATOR[pid];
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
              <Pressable key={c.id} onPress={() => { haptic.select(); setCat(c.id); }} style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : 'transparent', borderColor: 'transparent' }]}>
                {c.emoji ? <Text style={{ fontSize: 14 }}>{c.emoji}</Text> : null}
                <Text style={[styles.pillTxt, { color: on ? th.text : th.muted }]}>{tr(lang, c.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* your ventures in the factory — fresh ones live here until they graduate to the home */}
        {kind === 'market' && th.homeId === 'one01' && ventures.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionIcon}>🚀</Text>
              <Text style={[styles.sectionTitle, { color: th.text }]}>{tr(lang, 'Your ventures')}</Text>
              <Text style={[styles.sectionCount, { color: th.muted }]}>({ventures.length})</Text>
            </View>
            <View style={styles.rowsWrap}>
              {ventures.map((v) => {
                const l = VENTURE_LADDER[v.kind] ?? ['Live'];
                const grad = v.status === l[l.length - 1];
                return (
                  <Pressable key={v.id} onPress={() => onOpenVenture?.(v.id)} style={({ pressed }) => [styles.projRow, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                    <CreationArt emoji={v.emoji} seed={v.name} size={50} />
                    <View style={styles.flex}>
                      <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{grad ? `🦄 ${v.name}` : v.name}</Text>
                      <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{v.sector} {v.kind}{v.goal > 0 ? ` · ⟡${v.raised.toLocaleString()}/${v.goal.toLocaleString()}` : ''}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.statusChipTxt, { color: th.text }]}>{v.status}</Text></View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* fresh creator listings — the Creator → Market loop (Market tab only) */}
        {kind === 'market' && <FreshMarket th={th} pid={pid} onBuy={onBuy} onToast={onToast} lang={lang} onGoCreate={onGoCreate} />}

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

/* ─────────────────────────────── creator chat (chat-style creation studio) ─────────────────────────────── */

type CCPhase = 'home' | 'type' | 'style' | 'rarity' | 'name' | 'confirm' | 'done';
const CC_GREETINGS = ['What do you want to make?', 'Let us create something.', 'Dream it up.', 'Build something new.'];
const CC_ADJ = ['Astral', 'Phantom', 'Neon', 'Golden', 'Shadow', 'Crystal', 'Rogue', 'Vortex', 'Lunar', 'Hyper'];

type CCMsg = { id: string; role: 'ai' | 'you'; text: string };
const ccMid = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const ccArt = (w: string) => (/^[aeiou]/i.test(w.trim()) ? 'an' : 'a');

/** A deterministic hue (0–359) from a string, for creation preview tiles. */
function ccHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** A generated preview tile for a creation: a hashed gradient + the emoji, framed by rarity. */
function CreationArt({ emoji, seed, rarity, size = 46 }: { emoji: string; seed: string; rarity?: string; size?: number }) {
  const h = ccHue(seed);
  const frame = rarity ? RARITY_COLOR[rarity] : undefined;
  return (
    <LinearGradient
      colors={[`hsl(${h}, 68%, 46%)`, `hsl(${(h + 42) % 360}, 66%, 26%)`]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.28, alignItems: 'center', justifyContent: 'center', borderWidth: frame ? 2 : 0, borderColor: frame }}
    >
      <Text style={{ fontSize: size * 0.46 }}>{emoji}</Text>
    </LinearGradient>
  );
}

/** The guided build chat, shown inside a sheet: choice pills render inline in the
 *  thread (below each message), with a persistent input box at the bottom. Minting costs credits. */
function CreateFlowSheet({ th, pid, surface, initial, seed, onToast, onOpenWallet, onOpenVenture, lang, close, onScroll }: { th: ShellTheme; pid: ProductId; surface: string; initial: Creatable | null; seed: string; onToast: (m: string) => void; onOpenWallet: () => void; onOpenVenture?: (id: string) => void; lang: Lang; close: () => void; onScroll?: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void }) {
  const insets = useSafeAreaInsets();
  const isVenture = th.homeId === 'one01';
  const creatables = isVenture ? CREATABLES_ONE01 : CREATABLES[pid];
  const balance = useOne01PlatformStore((s) => s.balance);
  const debit = useOne01PlatformStore((s) => s.debit);
  const publishCreation = useOne01PlatformStore((s) => s.publishCreation);
  const createVenture = useOne01PlatformStore((s) => s.createVenture);
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';

  const [phase, setPhase] = useState<Exclude<CCPhase, 'home'>>(initial ? 'style' : 'type');
  const [sel, setSel] = useState<Creatable | null>(initial);
  const [style, setStyle] = useState('');
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [name, setName] = useState('');
  const [compose, setCompose] = useState('');
  const [msgs, setMsgs] = useState<CCMsg[]>(
    initial
      ? [{ id: 'u0', role: 'you', text: `Create ${ccArt(initial.noun)} ${initial.noun}` }, { id: 'a0', role: 'ai', text: `Nice — ${ccArt(initial.title)} ${initial.title.toLowerCase()} on ${surface}. ${initial.styleQ}` }]
      : [{ id: 'u0', role: 'you', text: seed || 'Make something' }, { id: 'a0', role: 'ai', text: `Love it. What are we making on ${surface}?` }],
  );
  const [made, setMade] = useState<UserCreation | null>(null);
  const [madeV, setMadeV] = useState<Venture | null>(null);
  const scRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const price = sel ? Math.round(sel.basePrice * (rarity?.mult ?? 1)) : 0;
  const scrollDown = () => setTimeout(() => scRef.current?.scrollToEnd({ animated: true }), 60);
  const push = (role: 'ai' | 'you', text: string) => setMsgs((m) => [...m, { id: ccMid(), role, text }]);

  const begin = (c: Creatable) => {
    setSel(c); setStyle(''); setRarity(null); setName('');
    push('you', `Create ${ccArt(c.noun)} ${c.noun}`); push('ai', `Nice — ${ccArt(c.title)} ${c.title.toLowerCase()} on ${surface}. ${c.styleQ}`);
    setPhase('style'); haptic.select(); scrollDown();
  };
  const pickStyle = (sName: string) => {
    setStyle(sName); push('you', sName);
    if (sel?.hasRarity) { push('ai', 'Love it. Which rarity? Rarer means fewer editions and higher earnings.'); setPhase('rarity'); }
    else { push('ai', `Great. Name your ${sel?.noun} below — or tap Surprise me.`); setPhase('name'); }
    haptic.select(); scrollDown();
  };
  const pickRarity = (r: Rarity) => {
    setRarity(r); push('you', `${r.emoji} ${r.label}`);
    push('ai', `${r.label} — ${r.editions.toLocaleString()} editions. Name it below, or tap Surprise me.`);
    setPhase('name'); haptic.select(); scrollDown();
  };
  const genName = () => `${CC_ADJ[Math.floor(Math.random() * CC_ADJ.length)]} ${style || sel?.title || 'One'}`;
  const genStage = () => (VENTURE_LADDER[sel?.id ?? '']?.[0] ?? 'Live');
  const confirmName = (raw: string) => {
    const nm = raw.trim() || genName();
    setName(nm); setCompose(''); push('you', nm);
    if (isVenture) {
      push('ai', `Ready to launch “${nm}” — ${ccArt(style)} ${style} ${sel?.noun}. Costs ⟡${price}; it starts in your Store at ${genStage()}.`);
    } else {
      const ed = rarity ? ` · ${rarity.editions.toLocaleString()} editions` : '';
      push('ai', `Ready to mint “${nm}”${ed}. Publishing costs ⟡${price} and it lists on the ${surface} Market right away.`);
    }
    setPhase('confirm'); scrollDown();
  };
  const doCreate = () => {
    if (balance < price) { push('ai', 'You are a little short on credits — top up in your Wallet and we will finish here.'); haptic.warning(); scrollDown(); return; }
    if (isVenture) {
      debit(price, `Launched · ${name}`);
      createVenture({ name, emoji: sel!.emoji, kind: sel!.id, sector: style });
      const v = useOne01PlatformStore.getState().ventures[0];
      setMadeV(v ?? null);
      push('ai', `🚀 “${name}” is incubating in your Store at ${v?.status ?? genStage()}. Advance its stages to raise and graduate it into the home — or grab a pitch deck.`);
      setPhase('done'); onToast(`Launched “${name}” · −⟡${price}`); haptic.success(); scrollDown();
      return;
    }
    debit(price, `Created · ${name}`);
    publishCreation({ title: name, emoji: sel!.emoji, kind: sel!.id, surface, rarity: rarity?.id, editions: rarity?.editions, rateMult: rarity?.mult });
    const c = useOne01PlatformStore.getState().creations[0];
    setMade(c ?? null);
    push('ai', `✨ “${name}” is live on the ${surface} Market! Earning ⟡${c?.rate ?? ''}/min${rarity ? ` · ${rarity.label}` : ''}. Find it under Mine, your Wallet, or the Market.`);
    setPhase('done'); onToast(`Minted “${name}” · −⟡${price}`); haptic.success(); scrollDown();
  };
  const onSend = () => {
    const text = compose.trim(); if (!text) return; setCompose('');
    if (phase === 'name') { confirmName(text); return; }
    if (phase === 'type') { const h = creatables.find((c) => text.toLowerCase().includes(c.id) || text.toLowerCase().includes(c.noun.toLowerCase())); if (h) { begin(h); return; } }
    else if (phase === 'style' && sel) { const h = sel.styles.find((s) => text.toLowerCase().includes(s.label.toLowerCase())); if (h) { pickStyle(h.label); return; } }
    else if (phase === 'rarity') { const h = RARITIES.find((r) => text.toLowerCase().includes(r.id) || text.toLowerCase().includes(r.label.toLowerCase())); if (h) { pickRarity(h); return; } }
    push('you', text); push('ai', 'Tap one of the options above to keep going.'); scrollDown();
  };

  const placeholder = phase === 'name' ? tr(lang, 'Name it…') : phase === 'confirm' || phase === 'done' ? tr(lang, 'Tap a button above') : tr(lang, 'Pick above, or type…');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 54}>
      <View style={styles.ccTopRow}>
        <Text style={[styles.ccTopTitle, { color: th.text }]}>✦ {sel ? sel.title : tr(lang, 'Create')}{rarity ? ` · ${rarity.label}` : ''}</Text>
        <View style={styles.flex} />
        <Pressable onPress={close} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.xmark, { color: th.text }]}>✕</Text></Pressable>
      </View>

      <ScrollView ref={scRef} onScroll={onScroll} scrollEventThrottle={16} style={styles.flex} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18, gap: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {msgs.map((m) => (
          <View key={m.id} style={{ alignSelf: m.role === 'you' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            <View style={[styles.ccBubble, m.role === 'you' ? { backgroundColor: th.accent } : { backgroundColor: th.surface, borderColor: th.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.ccBubbleTxt, { color: m.role === 'you' ? ctaFg : th.text }]}>{m.text}</Text>
            </View>
          </View>
        ))}

        {/* choice pills — inline, below the message, inside the scroll */}
        {phase === 'type' && (
          <View style={styles.ccPillWrap}>
            {creatables.map((c) => (<Pressable key={c.id} onPress={() => begin(c)} style={[styles.ccPill, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.ccPillTxt, { color: th.text }]}>{c.emoji} {c.title}</Text></Pressable>))}
          </View>
        )}
        {phase === 'style' && sel && (
          <View style={styles.ccPillWrap}>
            {sel.styles.map((s) => (<Pressable key={s.label} onPress={() => pickStyle(s.label)} style={[styles.ccPill, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.ccPillTxt, { color: th.text }]}>{s.emoji} {s.label}</Text></Pressable>))}
          </View>
        )}
        {phase === 'rarity' && (
          <View style={styles.ccPillWrap}>
            {RARITIES.map((r) => (<Pressable key={r.id} onPress={() => pickRarity(r)} style={[styles.ccPill, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.ccPillTxt, { color: th.text }]}>{r.emoji} {r.label} · ⟡{Math.round((sel?.basePrice ?? 0) * r.mult)}</Text></Pressable>))}
          </View>
        )}
        {phase === 'name' && (
          <View style={styles.ccPillWrap}>
            <Pressable onPress={() => confirmName('')} style={[styles.ccPill, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.ccPillTxt, { color: th.muted }]}>🎲 {tr(lang, 'Surprise me')}</Text></Pressable>
          </View>
        )}
        {phase === 'confirm' && (
          <View style={{ gap: 10, marginTop: 2 }}>
            <Pressable onPress={doCreate} style={({ pressed }) => [styles.ccCreate, { backgroundColor: balance < price ? th.surface2 : th.accent }, pressed && { opacity: 0.85 }]}><Text style={[styles.ccCreateTxt, { color: balance < price ? th.muted : ctaFg }]}>{balance < price ? tr(lang, 'Not enough credits') : `${tr(lang, 'Create')} · ⟡${price}`}</Text></Pressable>
            {balance < price
              ? <Pressable onPress={onOpenWallet} style={styles.ccGhost}><Text style={[styles.ccGhostTxt, { color: th.accent }]}>{tr(lang, 'Top up')} →</Text></Pressable>
              : <Pressable onPress={() => { setPhase(sel?.hasRarity ? 'rarity' : 'style'); push('ai', tr(lang, 'Sure — change it.')); scrollDown(); }} style={styles.ccGhost}><Text style={[styles.ccGhostTxt, { color: th.muted }]}>{tr(lang, 'Change')}</Text></Pressable>}
          </View>
        )}
        {phase === 'done' && made && (
          <View style={{ gap: 10, marginTop: 2 }}>
            <View style={[styles.ccResult, { backgroundColor: th.surface, borderColor: th.accent }]}>
              <CreationArt emoji={made.emoji} seed={made.title} rarity={made.rarity} size={48} />
              <View style={styles.flex}>
                <Text style={[styles.ccCardTitle, { color: th.text }]} numberOfLines={1}>{made.title}</Text>
                <Text style={[styles.ccCardSub, { color: th.muted }]}>{made.rarity ? `${made.rarity} · ${(made.editions ?? 0).toLocaleString()} ed · ` : ''}⟡{made.rate}/min</Text>
              </View>
            </View>
            <Pressable onPress={close} style={({ pressed }) => [styles.ccCreate, { backgroundColor: th.accent }, pressed && { opacity: 0.85 }]}><Text style={[styles.ccCreateTxt, { color: ctaFg }]}>{tr(lang, 'Done')}</Text></Pressable>
          </View>
        )}
        {phase === 'done' && madeV && (
          <View style={{ gap: 10, marginTop: 2 }}>
            <View style={[styles.ccResult, { backgroundColor: th.surface, borderColor: th.accent }]}>
              <CreationArt emoji={madeV.emoji} seed={madeV.name} size={48} />
              <View style={styles.flex}>
                <Text style={[styles.ccCardTitle, { color: th.text }]} numberOfLines={1}>{madeV.name}</Text>
                <Text style={[styles.ccCardSub, { color: th.muted }]}>{madeV.sector} {madeV.kind} · {madeV.status}</Text>
              </View>
            </View>
            <Pressable onPress={() => { const id = madeV.id; close(); onOpenVenture?.(id); }} style={({ pressed }) => [styles.ccCreate, { backgroundColor: th.accent }, pressed && { opacity: 0.85 }]}><Text style={[styles.ccCreateTxt, { color: ctaFg }]}>{tr(lang, 'View venture')}</Text></Pressable>
          </View>
        )}
      </ScrollView>

      {/* persistent input box at the bottom */}
      <View style={[styles.ccDock, { borderTopColor: th.border, paddingHorizontal: 16, paddingBottom: insets.bottom + 10 }]}>
        <View style={[styles.ccInputRow, { backgroundColor: th.surface, borderColor: th.border, marginTop: 0 }]}>
          <TextInput value={compose} onChangeText={setCompose} onSubmitEditing={onSend} placeholder={placeholder} placeholderTextColor={th.muted} returnKeyType="send" style={[styles.ccInput, { color: th.text }]} />
          <Pressable onPress={onSend} disabled={!compose.trim()} style={[styles.ccSend, { backgroundColor: compose.trim() ? th.accent : th.surface2 }]}><Text style={[styles.ccSendTxt, { color: compose.trim() ? ctaFg : th.muted }]}>↑</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The Create tab: greeting + input and two sections — New (what you can make) and
 *  Mine (your creations). Picking something opens the guided chat in a sheet. */
function CreatorChat({ th, wide, topPad, bottomPad, onToast, onOpenWallet, onOpenVenture, lang }: { th: ShellTheme; wide: boolean; topPad: number; bottomPad: number; onToast: (m: string) => void; onOpenWallet: () => void; onOpenVenture?: (id: string) => void; lang: Lang }) {
  const pid: ProductId = th.homeId === 'one01' ? 'one' : th.homeId;
  const isOne01 = th.homeId === 'one01';
  const creatables = isOne01 ? CREATABLES_ONE01 : CREATABLES[pid];
  const creations = useOne01PlatformStore((s) => s.creations);
  const ventures = useOne01PlatformStore((s) => s.ventures);
  const collect = useOne01PlatformStore((s) => s.collectEarnings);
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const mineCount = isOne01 ? ventures.length : creations.length;

  const [seg, setSeg] = useState<'new' | 'mine'>('new');
  const [draft, setDraft] = useState('');
  const [gi, setGi] = useState(0);
  const [, setTick] = useState(0);
  const [flow, setFlow] = useState<{ initial: Creatable | null; seed: string } | null>(null);
  const [flowKey, setFlowKey] = useState(0);

  useEffect(() => { const t = setInterval(() => setGi((x) => (x + 1) % CC_GREETINGS.length), 3200); return () => clearInterval(t); }, []);
  useEffect(() => { if (seg !== 'mine' || !creations.length) return; const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, [seg, creations.length]);

  const openFlow = (initial: Creatable | null, seed = '') => { haptic.select(); setFlow({ initial, seed }); setFlowKey((k) => k + 1); };
  const startFromText = () => {
    const text = draft.trim(); if (!text) return; setDraft('');
    const hit = creatables.find((c) => text.toLowerCase().includes(c.id) || text.toLowerCase().includes(c.noun.toLowerCase()));
    openFlow(hit ?? null, hit ? '' : text);
  };

  const colW = wide ? CW : undefined;

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 10, paddingBottom: bottomPad, alignItems: 'center', paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ width: colW ?? '100%', maxWidth: 560, alignItems: 'center' }}>
          <View style={styles.ccGreetWrap}><Text style={[styles.ccGreet, { color: th.text }]}>{tr(lang, CC_GREETINGS[gi])}</Text></View>
          <View style={[styles.ccInputRow, { backgroundColor: th.surface, borderColor: th.border }]}>
            <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={startFromText} placeholder={tr(lang, 'Describe it, or pick below…')} placeholderTextColor={th.muted} returnKeyType="go" style={[styles.ccInput, { color: th.text }]} />
            <Pressable onPress={startFromText} disabled={!draft.trim()} style={[styles.ccSend, { backgroundColor: draft.trim() ? th.accent : th.surface2 }]}><Text style={[styles.ccSendTxt, { color: draft.trim() ? ctaFg : th.muted }]}>↑</Text></Pressable>
          </View>

          {/* two sections: New | Mine */}
          <View style={[styles.ccSeg, { backgroundColor: th.surface2, borderColor: th.border }]}>
            {(['new', 'mine'] as const).map((k) => (
              <Pressable key={k} onPress={() => setSeg(k)} style={[styles.ccSegBtn, seg === k && { backgroundColor: th.accent }]}>
                <Text style={[styles.ccSegTxt, { color: seg === k ? ctaFg : th.muted }]}>{k === 'new' ? tr(lang, 'New') : `${tr(lang, 'Mine')}${mineCount ? ` · ${mineCount}` : ''}`}</Text>
              </Pressable>
            ))}
          </View>

          {seg === 'new' && (
            <View style={styles.ccSugWrap}>
              {creatables.map((c) => (
                <Pressable key={c.id} onPress={() => openFlow(c)} style={({ pressed }) => [styles.ccCard, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                  <View style={[styles.ccCardEmoji, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 22 }}>{c.emoji}</Text></View>
                  <View style={styles.flex}>
                    <Text style={[styles.ccCardTitle, { color: th.text }]}>{c.title}</Text>
                    <Text style={[styles.ccCardSub, { color: th.muted }]}>{c.hasRarity ? tr(lang, 'Rarity · editions') : tr(lang, 'From')} ⟡{c.basePrice}{c.hasRarity ? '+' : ''}</Text>
                  </View>
                  <Text style={[styles.ccCardPlus, { color: th.accent }]}>＋</Text>
                </Pressable>
              ))}
            </View>
          )}

          {seg === 'mine' && isOne01 && (
            <View style={styles.ccSugWrap}>
              {ventures.length === 0 && <Text style={[styles.ccMineEmpty, { color: th.muted }]}>{tr(lang, 'No ventures yet — launch one above.')}</Text>}
              {ventures.map((v) => (
                <Pressable key={v.id} onPress={() => onOpenVenture?.(v.id)} style={({ pressed }) => [styles.ccCard, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                  <CreationArt emoji={v.emoji} seed={v.name} size={46} />
                  <View style={styles.flex}>
                    <Text style={[styles.ccCardTitle, { color: th.text }]} numberOfLines={1}>{v.name}</Text>
                    <Text style={[styles.ccCardSub, { color: th.muted }]} numberOfLines={1}>{v.sector} {v.kind}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.statusChipTxt, { color: th.text }]}>{v.status}</Text></View>
                </Pressable>
              ))}
            </View>
          )}
          {seg === 'mine' && !isOne01 && (
            <View style={styles.ccSugWrap}>
              {creations.length === 0 && <Text style={[styles.ccMineEmpty, { color: th.muted }]}>{tr(lang, 'Nothing yet — make your first creation above.')}</Text>}
              {creations.map((c) => {
                const pending = pendingEarnings(c);
                return (
                  <View key={c.id} style={[styles.ccCard, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <CreationArt emoji={c.emoji} seed={c.title} rarity={c.rarity} size={46} />
                    <View style={styles.flex}>
                      <Text style={[styles.ccCardTitle, { color: th.text }]} numberOfLines={1}>{c.title}</Text>
                      <Text style={[styles.ccCardSub, { color: th.muted }]} numberOfLines={1}>{c.rarity ? `${c.rarity} · ${(c.editions ?? 0).toLocaleString()} ed · ` : ''}⟡{c.collected.toLocaleString()} {tr(lang, 'earned')}</Text>
                    </View>
                    <Pressable onPress={() => { const got = collect(c.id); if (got > 0) { haptic.success(); onToast(`+⟡${got}`); } }} style={[styles.ccCollect, { backgroundColor: pending > 0 ? th.accent : th.surface2 }]}><Text style={[styles.ccCollectTxt, { color: pending > 0 ? ctaFg : th.muted }]}>{tr(lang, 'Collect')} ⟡{pending}</Text></Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <SheetWindow visible={!!flow} wide={wide} th={th} onClose={() => setFlow(null)}>
        {(close, onScroll) => (flow ? <CreateFlowSheet key={flowKey} th={th} pid={pid} surface={th.name} initial={flow.initial} seed={flow.seed} onToast={onToast} onOpenWallet={() => { close(); onOpenWallet(); }} onOpenVenture={onOpenVenture} lang={lang} close={close} onScroll={onScroll} /> : null)}
      </SheetWindow>
    </>
  );
}

/* ─────────────────────────────── venture page (ONE01 project) ─────────────────────────────── */

/** A project page for a venture you spun up on ONE01 — stage ladder, funding, and actions. */
function VentureSheet({ ventureId, th, lang, close, onScroll, onToast, onOpenMarket }: { ventureId: string | null; th: ShellTheme; lang: Lang; close: () => void; onScroll?: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void; onToast: (m: string) => void; onOpenMarket: () => void }) {
  const insets = useSafeAreaInsets();
  const ventures = useOne01PlatformStore((s) => s.ventures);
  const ventureKits = useOne01PlatformStore((s) => s.ventureKits);
  const advance = useOne01PlatformStore((s) => s.advanceVenture);
  const buyKit = useOne01PlatformStore((s) => s.buyVentureKit);
  const debit = useOne01PlatformStore((s) => s.debit);
  const credit = useOne01PlatformStore((s) => s.credit);
  const v = ventures.find((x) => x.id === ventureId);

  if (!v) return <View style={styles.flex} />;
  const ladder = VENTURE_LADDER[v.kind] ?? ['Live'];
  const stageIdx = Math.max(0, ladder.indexOf(v.status));
  const atEnd = stageIdx >= ladder.length - 1;
  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const pct = v.goal > 0 ? Math.min(1, v.raised / v.goal) : (stageIdx + 1) / ladder.length;
  const kindCap = v.kind[0].toUpperCase() + v.kind.slice(1);
  const owned = ventureKits[v.id] ?? [];
  const advanceCost = Math.max(20, Math.round(70 * (stageIdx + 1) * (1 - 0.12 * owned.length)));
  const nextIsFinal = stageIdx + 1 >= ladder.length - 1;
  const exitReward = v.goal > 0 ? Math.round(v.goal * 1.8) : 400;
  const doAdvance = () => {
    if (atEnd) return;
    if (!debit(advanceCost, `${v.name} · ${ladder[stageIdx + 1]} round`)) { haptic.warning(); onToast(tr(lang, 'Not enough credits')); return; }
    advance(v.id); haptic.success();
    if (nextIsFinal) { credit(exitReward, `Exit · ${v.name}`); onToast(`🎉 ${v.name} · +⟡${exitReward.toLocaleString()}`); }
    else onToast(`${v.name} → ${ladder[stageIdx + 1]}`);
  };
  const doBuyKit = (k: (typeof VENTURE_KIT)[number]) => {
    if (owned.includes(k.id)) return;
    if (!debit(k.price, `Kit · ${k.title}`)) { haptic.warning(); onToast(tr(lang, 'Not enough credits')); return; }
    buyKit(v.id, k.id, k.boost); haptic.success(); onToast(v.goal > 0 ? `+⟡${k.boost.toLocaleString()} raised` : `${k.title} ✓`);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.ccTopRow}>
        <Text style={[styles.ccTopTitle, { color: th.text }]}>✦ {kindCap}</Text>
        <View style={styles.flex} />
        <Pressable onPress={close} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={[styles.xmark, { color: th.text }]}>✕</Text></Pressable>
      </View>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 6 }}>
          <CreationArt emoji={v.emoji} seed={v.name} size={88} />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={[styles.vName, { color: th.text }]}>{v.name}</Text>
            <Text style={[styles.ccCardSub, { color: th.muted }]}>{v.sector} {v.kind} · {tr(lang, 'on ONE01')}</Text>
            <View style={[styles.statusChip, { backgroundColor: th.accent, borderColor: th.accent }]}><Text style={[styles.statusChipTxt, { color: ctaFg }]}>{v.status}</Text></View>
          </View>
        </View>

        <Text style={[styles.vSecTitle, { color: th.muted }]}>{tr(lang, 'Stage')}</Text>
        <View style={styles.vStageRow}>
          {ladder.map((st, i) => (
            <View key={st} style={[styles.vStage, i <= stageIdx ? { backgroundColor: th.accent, borderColor: th.accent } : { backgroundColor: th.surface, borderColor: th.border }]}>
              <Text style={[styles.vStageTxt, { color: i <= stageIdx ? ctaFg : th.muted }]}>{st}</Text>
            </View>
          ))}
        </View>

        {v.goal > 0 && (
          <>
            <Text style={[styles.vSecTitle, { color: th.muted }]}>{tr(lang, 'Funding')}</Text>
            <View style={[styles.vBar, { backgroundColor: th.surface2 }]}><View style={[styles.vBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: th.accent }]} /></View>
            <Text style={[styles.ccCardSub, { color: th.muted, marginTop: 8 }]}>⟡{v.raised.toLocaleString()} {tr(lang, 'raised of')} ⟡{v.goal.toLocaleString()} ({Math.round(pct * 100)}%)</Text>
          </>
        )}

        <View style={{ marginTop: 22 }}>
          <Pressable onPress={doAdvance} disabled={atEnd} style={({ pressed }) => [styles.ccCreate, { backgroundColor: atEnd ? th.surface2 : th.accent }, pressed && { opacity: 0.85 }]}>
            <Text style={[styles.ccCreateTxt, { color: atEnd ? th.muted : ctaFg }]}>{atEnd ? `🦄 ${tr(lang, 'Graduated')}` : nextIsFinal ? `${tr(lang, 'Graduate')} · ⟡${advanceCost}` : `${tr(lang, 'Advance to')} ${ladder[stageIdx + 1]} · ⟡${advanceCost}`}</Text>
          </Pressable>
          {atEnd
            ? <Text style={[styles.ccCardSub, { color: th.muted, textAlign: 'center', marginTop: 6 }]}>{tr(lang, 'Live in the home')}</Text>
            : <Text style={[styles.ccCardSub, { color: th.muted, textAlign: 'center', marginTop: 6 }]}>{nextIsFinal ? `${tr(lang, 'Exit pays')} +⟡${exitReward.toLocaleString()}` : owned.length > 0 ? `${owned.length} ${tr(lang, 'kit · cheaper rounds')}` : `${tr(lang, 'Exit pays')} +⟡${exitReward.toLocaleString()}`}</Text>}
        </View>

        {/* kit — buy for this venture: adds funding + cheaper rounds */}
        <Text style={[styles.vSecTitle, { color: th.muted }]}>{tr(lang, 'Kit')}</Text>
        <View style={{ gap: 10 }}>
          {VENTURE_KIT.map((k) => {
            const have = owned.includes(k.id);
            return (
              <Pressable key={k.id} disabled={have} onPress={() => doBuyKit(k)} style={({ pressed }) => [styles.ccCard, { backgroundColor: th.surface, borderColor: have ? th.accent : th.border }, pressed && !have && { opacity: 0.85 }]}>
                <View style={[styles.ccCardEmoji, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 20 }}>{k.emoji}</Text></View>
                <View style={styles.flex}>
                  <Text style={[styles.ccCardTitle, { color: th.text }]}>{k.title}</Text>
                  <Text style={[styles.ccCardSub, { color: th.muted }]}>{v.goal > 0 ? `+⟡${k.boost.toLocaleString()} ${tr(lang, 'raised')}` : tr(lang, 'Helps your venture')}</Text>
                </View>
                {have
                  ? <View style={[styles.statusChip, { backgroundColor: th.surface2, borderColor: th.border }]}><Text style={[styles.statusChipTxt, { color: th.muted }]}>✓ {tr(lang, 'Owned')}</Text></View>
                  : <View style={[styles.getPill, { backgroundColor: th.accent }]}><Text style={[styles.getPillTxt, { color: ctaFg }]}>⟡{k.price}</Text></View>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── fresh creator listings (Creator → Market loop) ─────────────────────────────── */

/** Published creations on sale on the Market — your own listings first, then the community's. */
function FreshMarket({ th, pid, onBuy, onToast, lang, onGoCreate }: { th: ShellTheme; pid: ProductId; onBuy: (price: string, title: string, kind: 'market' | 'create') => boolean; onToast: (m: string) => void; lang: Lang; onGoCreate?: () => void }) {
  const creations = useOne01PlatformStore((s) => s.creations);
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const collect = useOne01PlatformStore((s) => s.collectEarnings);
  const mine = useMemo(() => creations.filter((c) => c.surface === th.name), [creations, th.name]);
  const fresh = FRESH_LISTINGS[pid];
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!mine.length) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [mine.length]);

  const ctaFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const owned = (title: string) => transactions.some((t) => t.label === `Market · ${title}`);

  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIcon}>🧑‍🎨</Text>
        <Text style={[styles.sectionTitle, { color: th.text }]}>{tr(lang, 'Fresh from creators')}</Text>
        <Text style={[styles.sectionCount, { color: th.muted }]}>({mine.length + fresh.length})</Text>
      </View>
      <View style={styles.rowsWrap}>
        {/* your own published creations, now listed on the Market */}
        {mine.map((c) => {
          const pending = pendingEarnings(c);
          return (
            <View key={c.id} style={[styles.projRow, { backgroundColor: th.surface, borderColor: th.accent }]}>
              <CreationArt emoji={c.emoji} seed={c.title} rarity={c.rarity} size={48} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{c.title}</Text>
                  <View style={[styles.youChip, { backgroundColor: th.accent }]}><Text style={[styles.youChipTxt, { color: ctaFg }]}>{tr(lang, 'You')}</Text></View>
                </View>
                <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{tr(lang, 'Listed · live')} · ⟡{c.collected.toLocaleString()} {tr(lang, 'earned')}</Text>
              </View>
              <Pressable onPress={() => { const got = collect(c.id); onToast(got > 0 ? `+⟡${got}` : tr(lang, 'Nothing to collect yet')); }} style={({ pressed }) => [styles.ctaPill, { backgroundColor: pending > 0 ? th.accent : th.surface2 }, pressed && { opacity: 0.8 }]}>
                <Text style={[styles.ctaPillTxt, { color: pending > 0 ? ctaFg : th.muted }]}>{tr(lang, 'Collect')} ⟡{pending}</Text>
              </Pressable>
            </View>
          );
        })}

        {/* community creations you can buy */}
        {fresh.map((f) => {
          const have = owned(f.title);
          return (
            <View key={f.id} style={[styles.projRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <CreationArt emoji={f.emoji} seed={f.title} size={48} />
              <View style={styles.flex}>
                <Text style={[styles.projName, { color: th.text }]} numberOfLines={1}>{f.title}</Text>
                <Text style={[styles.projSub, { color: th.muted }]} numberOfLines={1}>{f.byEmoji} {f.by} · {f.tagline}</Text>
              </View>
              <Pressable disabled={have} onPress={() => onBuy(`⟡${f.price}`, f.title, 'market')} style={({ pressed }) => [styles.ctaPill, { backgroundColor: have ? th.surface2 : th.accent }, pressed && !have && { opacity: 0.8 }]}>
                <Text style={[styles.ctaPillTxt, { color: have ? th.muted : ctaFg }]}>{have ? `✓ ${tr(lang, 'Owned')}` : `${tr(lang, 'Get')} ⟡${f.price}`}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {!mine.length && onGoCreate && (
        <Pressable onPress={onGoCreate} style={({ pressed }) => [styles.freshHint, { borderColor: th.border }, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.freshHintTxt, { color: th.muted }]}>{tr(lang, 'Publish in Creator — your work lists here')} ›</Text>
        </Pressable>
      )}
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
  profileBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  profileBadgeTxt: { fontSize: 10, fontWeight: '800' },
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

  /* desktop hover dropdowns */
  navHover: { position: 'relative', zIndex: 60 },
  navDrop: { position: 'absolute', top: '100%', paddingTop: 10, zIndex: 100 },
  navDropLeft: { left: 0 },
  navDropRight: { right: 0 },
  menuPanel: { width: 258, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  menuBal: { fontSize: 26, fontWeight: '800', marginTop: 10 },
  menuHold: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuBtn: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  menuBtnTxt: { fontSize: 13, fontWeight: '700' },
  menuAcct: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatarSm: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  menuUpgrade: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  upPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  upPillTxt: { fontSize: 11, fontWeight: '800' },
  upBar: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  upBarFill: { height: '100%', borderRadius: 999 },
  menuFoot: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },

  /* horizontal shelf + right-edge fade mask */
  shelf: { position: 'relative' },
  shelfScroll: { overflow: 'visible' },
  shelfFade: { position: 'absolute', top: 0, bottom: 0, right: -18, width: 56 },

  /* concave screen-curve edges */
  curveEdge: { position: 'absolute', top: 0, bottom: 0, width: '15%', maxWidth: 220 },

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

  /* fresh creator listings */
  youChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  youChipTxt: { fontSize: 10.5, fontWeight: '800' },
  freshHint: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  freshHintTxt: { fontSize: 13, fontWeight: '600' },

  /* creator chat (studio) */
  ccMark: { width: 58, height: 58, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ccGreetWrap: { height: 92, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 22 },
  ccGreet: { fontSize: 26, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  ccInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, width: '100%', marginTop: 4 },
  ccInput: { flex: 1, fontSize: 15.5, paddingVertical: 8 },
  ccSend: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ccSendTxt: { fontSize: 18, fontWeight: '800' },
  ccSugLabel: { fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, alignSelf: 'flex-start', marginTop: 26, marginBottom: 12 },
  ccSugWrap: { width: '100%', gap: 10 },
  ccCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12 },
  ccCardEmoji: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ccCardTitle: { fontSize: 15.5, fontWeight: '700' },
  ccCardSub: { fontSize: 12.5, marginTop: 2 },
  ccCardPlus: { fontSize: 20, fontWeight: '700' },
  ccTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  ccTopTitle: { fontSize: 17, fontWeight: '800' },
  ccBubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  ccBubbleTxt: { fontSize: 15, lineHeight: 21 },
  ccResult: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 4 },
  ccDock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  ccPillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ccPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  ccPillTxt: { fontSize: 14, fontWeight: '600' },
  ccNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ccCreate: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ccCreateTxt: { fontSize: 15.5, fontWeight: '800' },
  ccGhost: { alignItems: 'center', paddingVertical: 4 },
  ccGhostTxt: { fontSize: 13.5, fontWeight: '700' },
  statusChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  statusChipTxt: { fontSize: 12.5, fontWeight: '800' },
  vName: { fontSize: 22, fontWeight: '800' },
  vSecTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 12 },
  vStageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vStage: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  vStageTxt: { fontSize: 12.5, fontWeight: '700' },
  vBar: { height: 12, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  vBarFill: { height: '100%', borderRadius: 999 },
  ccSeg: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, padding: 3, marginTop: 24, marginBottom: 14, alignSelf: 'stretch' },
  ccSegBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  ccSegTxt: { fontSize: 13.5, fontWeight: '700' },
  ccMineEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  ccCollect: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  ccCollectTxt: { fontSize: 12.5, fontWeight: '800' },

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
