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
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../../components/one01/brand';
import { ProductOnboarding } from '../../components/one01/ProductOnboarding';
import { DetailPage, type DetailKind } from '../../components/one01/DetailPage';
import { onboardingFor } from '../../data/one01/onboarding';
import {
  PRODUCTS,
  ECOSYSTEM_APPS,
  FEATURED_SLIDES,
  MARKET,
  CREATOR,
  HOME,
  SWITCHER_APPS,
  type ProductId,
  type MarkId,
  type HomeItem,
  type EcosystemApp,
  type ShellTheme,
} from '../../data/one01/platform';

type HomeId = 'one01' | ProductId;
type Tab = 'home' | 'market' | 'create';

const GLOWS: Record<HomeId, string> = { one01: '#6366F1', one: '#6B7280', winzi: '#3B5BDB', mixstar: '#8B5CF6' };
const DARK_TILE = '#131317';
const CW = 700; // desktop content column
const WIDE_AT = 900;

function shellTheme(homeId: HomeId): ShellTheme {
  if (homeId === 'one01') {
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

/* ══════════════════════════════════ root ══════════════════════════════════ */

export function One01Platform({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_AT;

  const [entered, setEntered] = useState(false);
  const [homeId, setHomeId] = useState<HomeId>('one01');
  const [tab, setTab] = useState<Tab>('home');
  const [onboardFor, setOnboardFor] = useState<ProductId | null>(null);
  const [onboarded, setOnboarded] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<null | 'wallet' | 'profile' | 'switch'>(null);
  const [externalApp, setExternalApp] = useState<EcosystemApp | null>(null);
  const [detail, setDetail] = useState<{ kind: DetailKind; item: HomeItem } | null>(null);

  const enterProduct = (id: ProductId) => {
    setOnboarded((prev) => new Set(prev).add(id));
    setOnboardFor(null); setHomeId(id); setTab('home');
  };
  const openProduct = (id: ProductId) => {
    haptic.select();
    if (onboarded.has(id)) { setHomeId(id); setTab('home'); } else setOnboardFor(id);
  };
  const openDetail = (kind: DetailKind, item: HomeItem) => { haptic.select(); setDetail({ kind, item }); };
  const detailPrimary = () => {
    if (!detail) return;
    const it = detail.item;
    if (detail.kind === 'project') {
      setDetail(null);
      if (it.product) openProduct(it.product);
      else { const app = ECOSYSTEM_APPS.find((a) => a.id === it.id); if (app) setExternalApp(app); }
    } else {
      haptic.success(); // demo: Play / Watch / Continue
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

  const th = shellTheme(homeId);
  const topPad = wide ? 96 : 104;
  const bottomPad = (wide ? 40 : 104) + insets.bottom;

  return (
    <View style={[styles.flex, { backgroundColor: th.bg, paddingTop: insets.top }]}>
      <TopGlow th={th} w={width} h={Math.round(height * 0.5)} />

      <View style={styles.flex}>
        {tab === 'home' && <HomeContent th={th} wide={wide} topPad={topPad} bottomPad={bottomPad} onOpen={openDetail} />}
        {tab === 'market' && <SurfaceView th={th} wide={wide} kind="market" topPad={topPad} bottomPad={bottomPad} />}
        {tab === 'create' && <SurfaceView th={th} wide={wide} kind="create" topPad={topPad} bottomPad={bottomPad} />}
      </View>

      {/* bottom bar sits below the detail overlay */}
      {!wide && <MobileBottomBar th={th} tab={tab} setTab={setTab} onSwitch={() => setSheet('switch')} bottomInset={insets.bottom} />}

      {/* detail opens as a card sheet (mobile) / centered card (desktop); the top bar stays above it */}
      {detail && (
        <DetailOverlay th={th} wide={wide} kind={detail.kind} item={detail.item} topInset={insets.top} onBack={() => setDetail(null)} onPrimary={detailPrimary} />
      )}

      {wide ? (
        <DesktopNav th={th} tab={tab} setTab={setTab} onWallet={() => setSheet('wallet')} onProfile={() => setSheet('profile')} onSwitch={() => setSheet('switch')} />
      ) : (
        <MobileTopBar th={th} onWallet={() => setSheet('wallet')} onProfile={() => setSheet('profile')} />
      )}

      <ProfileMenu
        visible={sheet === 'profile'} th={th} wide={wide} topInset={insets.top}
        onClose={() => setSheet(null)}
        onOne01={() => { haptic.select(); setHomeId('one01'); setTab('home'); setSheet(null); }}
        onCreate={() => { setTab('create'); setSheet(null); }}
        onExit={onExit}
      />
      <WalletSheet visible={sheet === 'wallet'} th={th} onClose={() => setSheet(null)} />
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

function MicroBanner({ th }: { th: ShellTheme }) {
  return <Text style={[styles.micro, { color: th.muted }]}>20% up users in {th.name}</Text>;
}

function WalletChip({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.walletBtn} hitSlop={8}>
      <WalletIcon size={24} color={th.text} />
      <Text style={[styles.walletAmt, { color: th.text }]}>$3,500</Text>
    </Pressable>
  );
}

function ProfileBtn({ th, onPress }: { th: ShellTheme; onPress: () => void }) {
  const badgeFg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <Pressable onPress={onPress} style={styles.profileBtn} hitSlop={8}>
      <View style={[styles.avatar, { borderColor: th.accent, backgroundColor: th.surface2 }]}>
        <UserIcon size={22} color={th.muted} />
      </View>
      <View style={[styles.avBadge, { backgroundColor: th.accent }]}><Text style={[styles.avBadgeTxt, { color: badgeFg }]}>4</Text></View>
      <View style={[styles.avCount, { backgroundColor: th.accent }]}><Text style={[styles.avCountTxt, { color: badgeFg }]}>13</Text></View>
    </Pressable>
  );
}

function MobileTopBar({ th, onWallet, onProfile }: { th: ShellTheme; onWallet: () => void; onProfile: () => void }) {
  return (
    <LinearGradient colors={[th.bg, `${th.bg}00`]} style={styles.topBar} pointerEvents="box-none">
      <MicroBanner th={th} />
      <View style={styles.topRow}>
        <WalletChip th={th} onPress={onWallet} />
        <ProfileBtn th={th} onPress={onProfile} />
      </View>
    </LinearGradient>
  );
}

function MobileBottomBar({ th, tab, setTab, onSwitch, bottomInset }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onSwitch: () => void; bottomInset: number }) {
  return (
    <LinearGradient colors={[`${th.bg}00`, th.bg]} style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 12) }]} pointerEvents="box-none">
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
          <Mark mark={th.mark} size={46} accent={th.homeId === 'one01' ? th.text : th.accent} eye={th.bg} />
        </View>
      </Pressable>
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('create'); }}>
        <CreateIcon size={26} color={tab === 'create' ? th.accent : th.muted} />
      </Pressable>
    </LinearGradient>
  );
}

/* ─────────────────────────────── desktop nav ─────────────────────────────── */

function DesktopNav({ th, tab, setTab, onWallet, onProfile, onSwitch }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; onWallet: () => void; onProfile: () => void; onSwitch: () => void }) {
  const links: { k: Tab; label: string }[] = [
    { k: 'home', label: 'Home' },
    { k: 'market', label: 'Market' },
    { k: 'create', label: 'Creator' },
  ];
  return (
    <LinearGradient colors={[th.bg, `${th.bg}00`]} style={styles.desktopNav} pointerEvents="box-none">
      <MicroBanner th={th} />
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
        <View style={{ width: 20 }} />
        <ProfileBtn th={th} onPress={onProfile} />
      </View>
    </LinearGradient>
  );
}

/* ─────────────────────────────── home content ─────────────────────────────── */

function HomeContent({ th, wide, topPad, bottomPad, onOpen }: { th: ShellTheme; wide: boolean; topPad: number; bottomPad: number; onOpen: (kind: DetailKind, item: HomeItem) => void }) {
  const home = HOME[th.homeId];
  const slides = th.homeId === 'one01' ? FEATURED_SLIDES.one : FEATURED_SLIDES[th.homeId];
  const { width } = useWindowDimensions();
  const colW = wide ? CW : Math.min(width, 600) - 36;
  const [cat, setCat] = useState('all');
  const cardKind: DetailKind = th.homeId === 'winzi' ? 'game' : th.homeId === 'mixstar' ? 'show' : th.homeId === 'one' ? 'process' : 'game';

  return (
    <ScrollView contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width: colW }}>
        {/* featured / news banner */}
        <ScrollView horizontal pagingEnabled snapToInterval={colW + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} style={{ overflow: 'visible' }}>
          {slides.map((s, i) => {
            const colors: [string, string] = th.mode === 'dark' ? [`${th.glow}CC`, th.surface] : ['#EDEFF3', '#DCE1E8'];
            return (
              <LinearGradient key={i} colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { width: colW }]}>
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
            );
          })}
        </ScrollView>

        {/* categories */}
        <View style={styles.catRow}>
          {wide && <View style={[styles.catIcon, { backgroundColor: th.surface }]}><SearchIcon size={16} color={th.muted} /></View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={styles.flex}>
            {home.categories.map((c) => {
              const on = c.id === cat;
              return (
                <Pressable key={c.id} onPress={() => { haptic.select(); setCat(c.id); }} style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : th.surface, borderColor: on ? 'transparent' : th.border }]}>
                  {c.emoji ? <Text style={{ fontSize: 14 }}>{c.emoji}</Text> : null}
                  <Text style={[styles.pillTxt, { color: on ? th.text : th.muted }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {wide && <View style={[styles.catIcon, { backgroundColor: th.surface }]}><FilterIcon size={16} color={th.muted} /></View>}
        </View>

        {/* section header */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionIcon}>{home.sectionIcon}</Text>
          <Text style={[styles.sectionTitle, { color: th.text }]}>{home.sectionTitle}</Text>
          {home.sectionCount != null && <Text style={[styles.sectionCount, { color: th.muted }]}>({home.sectionCount})</Text>}
          <View style={styles.flex} />
          <Text style={[styles.sectionArrow, { color: th.muted }]}>›</Text>
        </View>

        {/* items */}
        {home.layout === 'rows' ? (
          <View style={[styles.rowsWrap, wide && styles.rowsWrapWide]}>
            {home.items.map((it) => (
              <Pressable key={it.id} onPress={() => onOpen('project', it)} style={({ pressed }) => [styles.projRow, wide && styles.projRowWide, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
                <View style={[styles.projTile, { backgroundColor: DARK_TILE }]}>
                  <Mark mark={it.mark ?? 'one01'} size={34} accent={markAccent(it.mark ?? 'one01')} eye={DARK_TILE} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.projName, { color: th.text }]}>{it.title}</Text>
                  <Text style={[styles.projSub, { color: th.muted }]}>{it.subtitle}</Text>
                </View>
                <View style={[styles.ctaPill, { backgroundColor: th.mode === 'dark' ? th.surface2 : '#0E1116' }]}>
                  <Text style={[styles.ctaPillTxt, { color: th.mode === 'dark' ? th.text : '#fff' }]}>{it.cta ?? 'Open'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }} style={{ overflow: 'visible' }}>
            {home.items.map((it) => (
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
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────── market / create ─────────────────────────────── */

function SurfaceView({ th, wide, kind, topPad, bottomPad }: { th: ShellTheme; wide: boolean; kind: 'market' | 'create'; topPad: number; bottomPad: number }) {
  const pid: ProductId = th.homeId === 'one01' ? 'one' : th.homeId;
  const s = kind === 'market' ? MARKET[pid] : CREATOR[pid];
  const colW = wide ? CW : undefined;
  return (
    <ScrollView contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: wide ? 0 : 18, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width: colW, gap: 12 }}>
        <Text style={[styles.surfaceHead, { color: th.text }]}>{s.headline}</Text>
        <Text style={[styles.surfaceSub, { color: th.muted }]}>{s.subtitle}</Text>
        {s.pillars.map((p) => (
          <View key={p.id} style={[styles.pillar, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={styles.pillarTop}>
              <View style={[styles.pillarEmoji, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 20 }}>{p.emoji}</Text></View>
              <View style={styles.flex}>
                <Text style={[styles.projName, { color: th.text }]}>{p.title}</Text>
                <Text style={[styles.projSub, { color: th.muted }]}>{p.tagline}</Text>
              </View>
              <View style={[styles.price, { backgroundColor: th.accent }]}><Text style={[styles.priceTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>{p.price}</Text></View>
            </View>
            <Text style={[styles.pillarDetail, { color: th.muted }]}>{p.detail}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.switchRoot}>
        <Pressable style={styles.flex} onPress={onClose} />
        <View style={styles.switchSheet}>
          <View style={styles.switchGrab} />
          <Pressable onPress={() => onPick('one01')} style={styles.switchTop}>
            <View style={[styles.appTile, styles.appTileBig, { backgroundColor: '#fff', borderColor: current === 'one01' ? '#fff' : 'transparent' }]}><One01Mark size={38} color="#111318" /></View>
            <Text style={styles.appLabel}>One01</Text>
          </Pressable>
          <View style={styles.switchGrid}>
            {SWITCHER_APPS.map((a) => (
              <Pressable key={a.id} onPress={() => onPick(a.id)} style={styles.switchItem}>
                <View style={[styles.appTile, { backgroundColor: DARK_TILE, borderColor: current === a.id ? a.mark === 'winzi' ? '#F9D800' : '#8B5CF6' : 'transparent' }]}>
                  <Mark mark={a.mark} size={32} accent={markAccent(a.mark)} eye={DARK_TILE} />
                </View>
                <Text style={styles.appLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.switchClose} hitSlop={12}><Text style={styles.switchCloseTxt}>✕</Text></Pressable>
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

function DetailOverlay({ th, wide, kind, item, topInset, onBack, onPrimary }: { th: ShellTheme; wide: boolean; kind: DetailKind; item: HomeItem; topInset: number; onBack: () => void; onPrimary: () => void }) {
  const { height: winH } = useWindowDimensions();
  const sheetTop = topInset + 74;
  const sheetH = winH - sheetTop;
  const ty = useRef(new Animated.Value(sheetH)).current;

  useEffect(() => {
    if (wide) return;
    Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 13 }).start();
  }, [wide, ty]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.8) Animated.timing(ty, { toValue: sheetH, duration: 200, useNativeDriver: true }).start(() => onBack());
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // desktop: a regular full page (nav bar stays above it), not a popup card
  if (wide) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, paddingTop: topInset }]}>
        <DetailPage th={th} wide kind={kind} item={item} topPad={56} onBack={onBack} onPrimary={onPrimary} />
      </View>
    );
  }

  // mobile: a sheet that rises from the bottom and can be dragged down to close
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onBack} />
      <Animated.View style={[styles.detailSheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers} style={styles.detailDrag}>
          <View style={[styles.detailGrab, { backgroundColor: th.border }]} />
        </View>
        <DetailPage th={th} kind={kind} item={item} onBack={onBack} onPrimary={onPrimary} />
      </Animated.View>
    </View>
  );
}

/* ══════════════════════════════════ styles ══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0 },

  micro: { fontSize: 11, textAlign: 'center', paddingTop: 10 },

  /* mobile top bar */
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14 },
  walletBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletAmt: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  profileBtn: { width: 52, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avBadge: { position: 'absolute', top: -2, right: 0, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  avBadgeTxt: { fontSize: 11, fontWeight: '800' },
  avCount: { marginTop: 2, minWidth: 22, borderRadius: 7, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 1 },
  avCountTxt: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },

  /* mobile bottom bar */
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 22, paddingHorizontal: 24 },
  navBtn: { flex: 1, alignItems: 'center' },
  navCenterWrap: { flex: 1, alignItems: 'center' },
  navCenter: { alignItems: 'center', justifyContent: 'center', marginTop: -14 },

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

  /* categories */
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  catIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  pillTxt: { fontSize: 14, fontWeight: '600' },

  /* section */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 14 },
  sectionIcon: { fontSize: 18 },
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

  /* artwork cards */
  artCard: { width: 168, height: 196, borderRadius: 18, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
  artEmoji: { fontSize: 54, textAlign: 'center', marginTop: 16 },
  artFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  artTitle: { fontSize: 16, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.3 },
  artMetric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  artDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  artMetricTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },

  /* surface view */
  surfaceHead: { fontSize: 22, fontWeight: '800' },
  surfaceSub: { fontSize: 14, lineHeight: 20 },
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
  switchSheet: { backgroundColor: '#17181D', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' },
  switchGrab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 18 },
  switchTop: { alignItems: 'center', gap: 8, marginBottom: 22 },
  switchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: 320 },
  switchItem: { width: 86, alignItems: 'center', gap: 8 },
  appTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  appTileBig: { width: 72, height: 72, borderRadius: 20 },
  appLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  switchClose: { marginTop: 26, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  switchCloseTxt: { fontSize: 20, color: 'rgba(255,255,255,0.6)' },
});
