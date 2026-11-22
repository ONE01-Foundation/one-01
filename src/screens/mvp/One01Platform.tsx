/**
 * One01Platform — an Expo port of the ONE Platform. ONE01 and every product
 * (ONE / Winzi / MixStar) share ONE home skeleton:
 *   • Top bar  — wallet (one side) + profile avatar with badges (the other).
 *   • Content  — a Featured / News banner, category pills, then a section
 *                (Projects for ONE01 · Games for Winzi · Shows for MixStar) of
 *                artwork cards / project rows.
 *   • Bottom bar — shop (Market) · centered product mark (Home) · + (Create).
 * Background is the product's canvas with a per-product glow at the top.
 *
 * ONE01's home lists the Projects (products); tapping one runs that product's
 * onboarding then opens its home shell. Back to ONE01 / exit live in the profile
 * menu. Reached from Settings → "ONE01 Platform" (homeMode 'platform').
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import {
  One01Mark,
  OneMark,
  WinziMark,
  MixStarMark,
  XitMark,
  SodexMark,
  WalletIcon,
  UserIcon,
} from '../../components/one01/brand';
import { ProductOnboarding } from '../../components/one01/ProductOnboarding';
import { onboardingFor } from '../../data/one01/onboarding';
import {
  PRODUCTS,
  ECOSYSTEM_APPS,
  FEATURED_SLIDES,
  MARKET,
  CREATOR,
  HOME,
  type ProductId,
  type MarkId,
  type HomeItem,
  type EcosystemApp,
} from '../../data/one01/platform';

type HomeId = 'one01' | ProductId;
type Tab = 'home' | 'market' | 'create';

const GLOWS: Record<HomeId, string> = { one01: '#6366F1', one: '#6B7280', winzi: '#3B5BDB', mixstar: '#8B5CF6' };

interface ShellTheme {
  homeId: HomeId;
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

function Mark({ mark, size, accent, eye }: { mark: MarkId; size: number; accent: string; eye?: string }) {
  switch (mark) {
    case 'one': return <OneMark size={size} color={accent} eye={eye ?? '#000'} />;
    case 'winzi': return <WinziMark size={size} />;
    case 'mixstar': return <MixStarMark size={size} />;
    case 'xit': return <XitMark size={size} />;
    case 'sodex': return <SodexMark size={size} color="#FFFFFF" />;
    case 'one01': default: return <One01Mark size={size} color={accent} />;
  }
}

const DARK_TILE = '#131317';

/* ══════════════════════════════════ root ══════════════════════════════════ */

export function One01Platform({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [entered, setEntered] = useState(false);
  const [homeId, setHomeId] = useState<HomeId>('one01');
  const [tab, setTab] = useState<Tab>('home');
  const [onboardFor, setOnboardFor] = useState<ProductId | null>(null);
  const [onboarded, setOnboarded] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<null | 'wallet' | 'profile'>(null);
  const [externalApp, setExternalApp] = useState<EcosystemApp | null>(null);

  const enterProduct = (id: ProductId) => {
    setOnboarded((prev) => new Set(prev).add(id));
    setOnboardFor(null);
    setHomeId(id);
    setTab('home');
  };

  const openProduct = (id: ProductId) => {
    haptic.select();
    if (onboarded.has(id)) { setHomeId(id); setTab('home'); }
    else setOnboardFor(id);
  };

  const openItem = (item: HomeItem) => {
    if (item.product) openProduct(item.product);
    else {
      const app = ECOSYSTEM_APPS.find((a) => a.id === item.id);
      if (app) setExternalApp(app);
    }
  };

  if (!entered) {
    return <ProductOnboarding config={onboardingFor('one01')} onFinish={() => setEntered(true)} />;
  }
  if (onboardFor) {
    return <ProductOnboarding config={onboardingFor(onboardFor)} onFinish={() => enterProduct(onboardFor)} />;
  }

  const th = shellTheme(homeId);

  return (
    <View style={[styles.flex, { backgroundColor: th.bg, paddingTop: insets.top }]}>
      <TopGlow th={th} w={width} h={Math.round(height * 0.5)} />
      <TopBar th={th} onWallet={() => setSheet('wallet')} onProfile={() => setSheet('profile')} />

      <View style={styles.flex}>
        {tab === 'home' && <HomeContent th={th} onOpenItem={openItem} bottomInset={insets.bottom} />}
        {tab === 'market' && <SurfaceView th={th} kind="market" bottomInset={insets.bottom} />}
        {tab === 'create' && <SurfaceView th={th} kind="create" bottomInset={insets.bottom} />}
      </View>

      <BottomBar th={th} tab={tab} setTab={setTab} bottomInset={insets.bottom} />

      <AccountSheet
        visible={sheet === 'profile'}
        th={th}
        onClose={() => setSheet(null)}
        onOne01={() => { haptic.select(); setHomeId('one01'); setTab('home'); setSheet(null); }}
        onExit={onExit}
      />
      <WalletSheet visible={sheet === 'wallet'} th={th} onClose={() => setSheet(null)} />
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

/* ─────────────────────────────── top bar ─────────────────────────────── */

function TopBar({ th, onWallet, onProfile }: { th: ShellTheme; onWallet: () => void; onProfile: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onWallet} style={styles.walletBtn} hitSlop={8}>
        <WalletIcon size={24} color={th.text} />
        <Text style={[styles.walletAmt, { color: th.text }]}>$3,500</Text>
      </Pressable>

      <Pressable onPress={onProfile} style={styles.profileBtn} hitSlop={8}>
        <View style={[styles.avatar, { borderColor: th.accent, backgroundColor: th.surface2 }]}>
          <UserIcon size={22} color={th.muted} />
        </View>
        <View style={[styles.avBadge, { backgroundColor: th.accent }]}>
          <Text style={[styles.avBadgeTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>4</Text>
        </View>
        <View style={[styles.avCount, { backgroundColor: th.accent }]}>
          <Text style={[styles.avCountTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>13</Text>
        </View>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────── home content ─────────────────────────────── */

function HomeContent({ th, onOpenItem, bottomInset }: { th: ShellTheme; onOpenItem: (i: HomeItem) => void; bottomInset: number }) {
  const home = HOME[th.homeId];
  const slides = th.homeId === 'one01' ? FEATURED_SLIDES.one : FEATURED_SLIDES[th.homeId];
  const { width } = useWindowDimensions();
  const bw = Math.min(width, 600) - 36;
  const [cat, setCat] = useState('all');

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset + 120 }} showsVerticalScrollIndicator={false}>
      {/* featured / news banner */}
      <ScrollView
        horizontal
        pagingEnabled
        snapToInterval={bw + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
      >
        {slides.map((s, i) => {
          const colors: [string, string] = th.mode === 'dark' ? [`${th.glow}CC`, th.surface] : ['#EDEFF3', '#DCE1E8'];
          return (
            <LinearGradient key={i} colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { width: bw }]}>
              <Text style={styles.bannerLabel}>{s.badge}</Text>
              <Text style={[styles.bannerTitle, { color: th.text }]} numberOfLines={2}>{s.title}</Text>
              <Text style={[styles.bannerSub, { color: th.muted }]} numberOfLines={1}>{s.subtitle}</Text>
            </LinearGradient>
          );
        })}
      </ScrollView>

      {/* categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 16 }}>
        {home.categories.map((c) => {
          const on = c.id === cat;
          return (
            <Pressable
              key={c.id}
              onPress={() => { haptic.select(); setCat(c.id); }}
              style={[styles.pill, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : th.surface, borderColor: on ? 'transparent' : th.border }]}
            >
              {c.emoji ? <Text style={{ fontSize: 14 }}>{c.emoji}</Text> : null}
              <Text style={[styles.pillTxt, { color: on ? th.text : th.muted }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* section header */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIcon}>{home.sectionIcon}</Text>
        <Text style={[styles.sectionTitle, { color: th.text }]}>{home.sectionTitle}</Text>
        {home.sectionCount != null && <Text style={[styles.sectionCount, { color: th.muted }]}>({home.sectionCount})</Text>}
        <Text style={[styles.sectionArrow, { color: th.muted }]}>›</Text>
      </View>

      {/* items */}
      {home.layout === 'rows' ? (
        <View style={{ gap: 12 }}>
          {home.items.map((it) => (
            <Pressable key={it.id} onPress={() => onOpenItem(it)} style={({ pressed }) => [styles.projRow, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.85 }]}>
              <View style={[styles.projTile, { backgroundColor: DARK_TILE }]}>
                <Mark mark={it.mark ?? 'one01'} size={34} accent="#10B981" eye={DARK_TILE} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.projName, { color: th.text }]}>{it.title}</Text>
                <Text style={[styles.projSub, { color: th.muted }]}>{it.subtitle}</Text>
              </View>
              <View style={styles.projChip}>
                <Text style={styles.projChipTxt}>✦</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
          {home.items.map((it) => (
            <LinearGradient key={it.id} colors={it.bg ?? ['#333', '#111']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.artCard}>
              {it.live && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveTxt}>{it.metric}</Text>
                </View>
              )}
              <Text style={styles.artEmoji}>{it.emoji}</Text>
              <View style={styles.artFooter}>
                <Text style={styles.artTitle}>{it.title}</Text>
                {!it.live && it.metric ? (
                  <View style={styles.artMetric}>
                    <View style={styles.artDot} />
                    <Text style={styles.artMetricTxt}>{it.metric}</Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

/* ─────────────────────────────── market / create ─────────────────────────────── */

function SurfaceView({ th, kind, bottomInset }: { th: ShellTheme; kind: 'market' | 'create'; bottomInset: number }) {
  const pid: ProductId = th.homeId === 'one01' ? 'one' : th.homeId;
  const s = kind === 'market' ? MARKET[pid] : CREATOR[pid];
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset + 120, gap: 12 }} showsVerticalScrollIndicator={false}>
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
    </ScrollView>
  );
}

/* ─────────────────────────────── bottom bar ─────────────────────────────── */

function BottomBar({ th, tab, setTab, bottomInset }: { th: ShellTheme; tab: Tab; setTab: (t: Tab) => void; bottomInset: number }) {
  return (
    <View style={[styles.bottomBar, { backgroundColor: th.surface, borderTopColor: th.border, paddingBottom: Math.max(bottomInset, 10) }]}>
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('market'); }}>
        <Text style={[styles.navGlyph, { opacity: tab === 'market' ? 1 : 0.6 }]}>🛍️</Text>
      </Pressable>
      <Pressable style={styles.navCenterWrap} onPress={() => { haptic.select(); setTab('home'); }}>
        <View style={styles.navCenter}>
          <Mark mark={th.mark} size={34} accent={th.homeId === 'one01' ? th.text : th.accent} eye={th.bg} />
        </View>
      </Pressable>
      <Pressable style={styles.navBtn} onPress={() => { haptic.select(); setTab('create'); }}>
        <View style={[styles.plusBox, { borderColor: th.border, backgroundColor: th.surface2 }]}>
          <Text style={[styles.plusTxt, { color: tab === 'create' ? th.accent : th.muted }]}>+</Text>
        </View>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────── sheets ─────────────────────────────── */

function AccountSheet({ visible, th, onClose, onOne01, onExit }: { visible: boolean; th: ShellTheme; onClose: () => void; onOne01: () => void; onExit: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.menu, { backgroundColor: th.surface, borderColor: th.border }]} onPress={() => {}}>
          <View style={[styles.avatarLg, { backgroundColor: th.surface2, borderColor: th.accent }]}><UserIcon size={28} color={th.muted} /></View>
          <Text style={[styles.menuName, { color: th.text }]}>Your ONE01 account</Text>
          <Text style={[styles.menuSub, { color: th.muted }]}>Signed in · $3,500 · one identity</Text>
          {th.homeId !== 'one01' && (
            <Pressable onPress={onOne01} style={[styles.menuItem, { borderColor: th.border }]}>
              <Text style={[styles.menuItemTxt, { color: th.text }]}>← ONE01 home</Text>
            </Pressable>
          )}
          <Pressable onPress={onExit} style={[styles.menuItem, { borderColor: th.border }]}>
            <Text style={[styles.menuItemTxt, { color: th.text }]}>Exit platform</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WalletSheet({ visible, th, onClose }: { visible: boolean; th: ShellTheme; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.menu, { backgroundColor: th.surface, borderColor: th.border }]} onPress={() => {}}>
          <View style={[styles.walletCard, { backgroundColor: th.accent }]}>
            <Text style={[styles.walletCardLbl, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>Balance</Text>
            <Text style={[styles.walletCardAmt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>$3,500</Text>
          </View>
          <View style={styles.walletRow}>
            <View style={[styles.menuItem, styles.flex, { borderColor: th.border }]}><Text style={[styles.menuItemTxt, { color: th.text, textAlign: 'center' }]}>Deposit</Text></View>
            <View style={[styles.menuItem, styles.flex, { borderColor: th.border }]}><Text style={[styles.menuItemTxt, { color: th.text, textAlign: 'center' }]}>Withdraw</Text></View>
          </View>
          <Text style={[styles.menuSub, { color: th.muted }]}>Virtual balance · same identity across every app</Text>
        </Pressable>
      </Pressable>
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
                <Mark mark={app.mark} size={34} accent="#10B981" eye={DARK_TILE} />
              </View>
              <Text style={[styles.menuName, { color: '#fff' }]}>{app.name}</Text>
              <Text style={[styles.menuSub, { color: 'rgba(255,255,255,0.6)' }]}>{app.tagline} · {app.domain}</Text>
              <Pressable onPress={onClose} style={[styles.menuItem, { borderColor: app.accent }]}>
                <Text style={[styles.menuItemTxt, { color: app.accent, textAlign: 'center' }]}>Got it</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ══════════════════════════════════ styles ══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0 },

  /* top bar */
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  walletBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletAmt: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  profileBtn: { width: 52, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avBadge: { position: 'absolute', top: -2, right: 0, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  avBadgeTxt: { fontSize: 11, fontWeight: '800' },
  avCount: { marginTop: 2, minWidth: 22, borderRadius: 7, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 1 },
  avCountTxt: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },

  /* banner */
  banner: { height: 232, borderRadius: 22, padding: 20, marginRight: 12, justifyContent: 'flex-end' },
  bannerLabel: { fontSize: 13, fontWeight: '700', color: '#10B981', marginBottom: 8 },
  bannerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 26 },
  bannerSub: { fontSize: 14, marginTop: 6 },

  /* categories */
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  pillTxt: { fontSize: 14, fontWeight: '600' },

  /* section */
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 14 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  sectionCount: { fontSize: 15, fontWeight: '600' },
  sectionArrow: { fontSize: 20, fontWeight: '600', marginLeft: 2 },

  /* project rows */
  projRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 12 },
  projTile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  projName: { fontSize: 17, fontWeight: '700' },
  projSub: { fontSize: 13.5, marginTop: 3 },
  projChip: { width: 34, height: 28, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  projChipTxt: { fontSize: 14, color: '#06281d', fontWeight: '800' },

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

  /* bottom bar */
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 20 },
  navBtn: { flex: 1, alignItems: 'center' },
  navGlyph: { fontSize: 24 },
  plusBox: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { fontSize: 24, fontWeight: '400', lineHeight: 26 },
  navCenterWrap: { flex: 1, alignItems: 'center' },
  navCenter: { alignItems: 'center', justifyContent: 'center', marginTop: -6 },

  /* sheets */
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  menu: { width: '100%', maxWidth: 360, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22, gap: 10, alignItems: 'stretch' },
  avatarLg: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  menuName: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  menuSub: { fontSize: 13, textAlign: 'center' },
  menuItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, marginTop: 2 },
  menuItemTxt: { fontSize: 15, fontWeight: '700' },
  walletCard: { borderRadius: 18, padding: 20, gap: 4 },
  walletCardLbl: { fontSize: 13, fontWeight: '600' },
  walletCardAmt: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  walletRow: { flexDirection: 'row', gap: 10 },
});
