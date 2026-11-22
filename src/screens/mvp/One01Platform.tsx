/**
 * One01Platform — an Expo (mobile + web) port of the ONE Platform
 * (`Main/one/apps/web`). ONE01 is the shared layer; ONE / Winzi / MixStar are
 * apps on it. Two surfaces:
 *   • Hub   — the ONE01 ecosystem: brand header, intro, and a grid of apps
 *             (Winzi, MixStar, Xit, Sodex, Market, Creator). Tap one to open it.
 *   • Shell — a per-product themed app (own canvas + accent): featured slides,
 *             category filters, and tabs Home / Market / Wallet / Creator /
 *             Profile driven by the product's nav, with a product bottom nav.
 *
 * Self-contained (internal routing + local state). English/LTR to mirror the
 * web source. Reached from Settings → "ONE01 Platform" (homeMode 'platform');
 * the consumer ONE app and the ONE01 Studio factory are untouched.
 */
import React, { useMemo, useState } from 'react';
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
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeColors } from '../../utils/theme';
import { haptic } from '../../utils/haptics';
import {
  One01Mark,
  One01Wordmark,
  OneMark,
  WinziMark,
  MixStarMark,
  XitMark,
  SodexMark,
  CategoryIcon,
} from '../../components/one01/brand';
import {
  PRODUCTS,
  PRODUCT_ORDER,
  ECOSYSTEM_APPS,
  FEATURED_SLIDES,
  CATEGORY_FILTERS,
  MARKET,
  CREATOR,
  HUB,
  type ProductId,
  type MarkId,
  type CategoryId,
  type EcosystemApp,
  type ProductTheme,
  type NavItem,
} from '../../data/one01/platform';

/* Dark tile used for brand marks designed on black (Winzi, Xit, Sodex, MixStar). */
const DARK_TILE = '#131317';

/* ─────────────────────────────── mark resolver ─────────────────────────────── */

function Mark({ mark, size, color, eye }: { mark: MarkId; size: number; color?: string; eye?: string }) {
  switch (mark) {
    case 'one':
      return <OneMark size={size} color={color ?? '#10B981'} eye={eye ?? '#0A0C0B'} />;
    case 'winzi':
      return <WinziMark size={size} />;
    case 'mixstar':
      return <MixStarMark size={size} />;
    case 'xit':
      return <XitMark size={size} />;
    case 'sodex':
      return <SodexMark size={size} color={color ?? '#FFFFFF'} />;
    case 'one01':
    default:
      return <One01Mark size={size} color={color ?? '#FFFFFF'} />;
  }
}

/* ══════════════════════════════════ root ══════════════════════════════════ */

type Tab = NavItem['tab'];

export function One01Platform({ onExit }: { onExit: () => void }) {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [productId, setProductId] = useState<ProductId | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [externalApp, setExternalApp] = useState<EcosystemApp | null>(null);

  const openApp = (app: EcosystemApp) => {
    haptic.press();
    if (app.product) {
      setProductId(app.product);
      setTab('home');
    } else {
      setExternalApp(app);
    }
  };

  const openProduct = (id: ProductId) => {
    haptic.select();
    setProductId(id);
    setTab('home');
  };

  if (productId) {
    return (
      <>
        <ProductShell
          product={PRODUCTS[productId]}
          tab={tab}
          setTab={setTab}
          onBack={() => {
            haptic.select();
            setProductId(null);
          }}
          onSwitchProduct={openProduct}
          insets={insets}
        />
        <ExternalModal app={externalApp} onClose={() => setExternalApp(null)} />
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Hub colors={colors} onOpenApp={openApp} onOpenProduct={openProduct} onExit={onExit} bottomInset={insets.bottom} />
      <ExternalModal app={externalApp} onClose={() => setExternalApp(null)} />
    </View>
  );
}

/* ═══════════════════════════════════ hub ═══════════════════════════════════ */

function Hub({
  colors,
  onOpenApp,
  onOpenProduct,
  onExit,
  bottomInset,
}: {
  colors: ThemeColors;
  onOpenApp: (app: EcosystemApp) => void;
  onOpenProduct: (id: ProductId) => void;
  onExit: () => void;
  bottomInset: number;
}) {
  const dark = colors.background === '#121212';
  const tileText = '#F4F5F7';

  return (
    <>
      {/* top bar */}
      <View style={[styles.hubBar, { borderBottomColor: colors.border }]}>
        <View style={styles.row}>
          <One01Wordmark height={26} color={colors.text} />
        </View>
        <View style={styles.rowGap}>
          <View style={[styles.walletPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.walletGlyph, { color: '#10B981' }]}>◎</Text>
            <Text style={[styles.walletAmt, { color: colors.text }]}>2,480</Text>
          </View>
          <Pressable onPress={onExit} hitSlop={10} style={[styles.exitBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.exitTxt, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: 18, paddingBottom: bottomInset + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* hero */}
        <Text style={[styles.hubKicker, { color: '#10B981' }]}>ONE01 · THE SHARED LAYER</Text>
        <Text style={[styles.hubTitle, { color: colors.text }]}>{HUB.tagline}</Text>
        <Text style={[styles.hubIntro, { color: colors.textSecondary }]}>{HUB.intro}</Text>

        <View style={styles.statRow}>
          {HUB.stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLbl, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* product switcher strip */}
        <Text style={[styles.sectionLbl, { color: colors.textSecondary }]}>Products on ONE01</Text>
        <View style={styles.switchRow}>
          {PRODUCT_ORDER.map((id) => {
            const p = PRODUCTS[id];
            return (
              <Pressable
                key={id}
                onPress={() => onOpenProduct(id)}
                style={({ pressed }) => [
                  styles.switchChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.switchMark, { backgroundColor: DARK_TILE }]}>
                  <Mark mark={p.mark} size={22} color={p.mark === 'one' ? p.accent : undefined} eye={DARK_TILE} />
                </View>
                <Text style={[styles.switchName, { color: colors.text }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ecosystem grid */}
        <Text style={[styles.sectionLbl, { color: colors.textSecondary, marginTop: 22 }]}>Featured apps</Text>
        <View style={styles.grid}>
          {ECOSYSTEM_APPS.map((app) => (
            <Pressable
              key={app.id}
              onPress={() => onOpenApp(app)}
              style={({ pressed }) => [
                styles.appCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View
                style={[
                  styles.appTile,
                  { backgroundColor: app.tile === 'accent' ? app.accent : DARK_TILE },
                ]}
              >
                <Mark
                  mark={app.mark}
                  size={30}
                  color={app.tile === 'accent' ? '#FFFFFF' : app.mark === 'one01' ? '#FFFFFF' : undefined}
                  eye={DARK_TILE}
                />
              </View>
              <View style={styles.appBody}>
                <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>{app.name}</Text>
                <Text style={[styles.appTag, { color: colors.textSecondary }]} numberOfLines={1}>{app.tagline}</Text>
                <Text style={[styles.appDomain, { color: colors.textSecondary }]} numberOfLines={1}>{app.domain}</Text>
              </View>
              <View style={[styles.appCta, { borderColor: app.accent }]}>
                <Text style={[styles.appCtaTxt, { color: app.accent }]}>{app.cta}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.footnote, { color: colors.textSecondary }]}>
          Same wallet, identity, and settlement rails across every app. Virtual balances — no crypto yet.
        </Text>
      </ScrollView>
    </>
  );
}

/* ═════════════════════════════════ product shell ═════════════════════════════════ */

function ProductShell({
  product,
  tab,
  setTab,
  onBack,
  onSwitchProduct,
  insets,
}: {
  product: ProductTheme;
  tab: Tab;
  setTab: (t: Tab) => void;
  onBack: () => void;
  onSwitchProduct: (id: ProductId) => void;
  insets: { top: number; bottom: number };
}) {
  const c = product.canvas;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* header */}
      <View style={[styles.shellHead, { borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Text style={[styles.backChevron, { color: c.text }]}>‹</Text>
        </Pressable>
        <View style={[styles.headMark, { backgroundColor: DARK_TILE }]}>
          <Mark mark={product.mark} size={22} color={product.mark === 'one' ? product.accent : undefined} eye={DARK_TILE} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.headName, { color: c.text }]}>{product.name}</Text>
          <Text style={[styles.headRail, { color: c.muted }]}>on ONE01</Text>
        </View>
        <View style={[styles.walletPill, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.walletGlyph, { color: product.accent }]}>◎</Text>
          <Text style={[styles.walletAmt, { color: c.text }]}>{tab === 'wallet' ? '2,480' : '480'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'home' && <HomeTab product={product} onSwitchProduct={onSwitchProduct} setTab={setTab} />}
        {tab === 'market' && <SurfaceTab product={product} kind="market" />}
        {tab === 'creator' && <SurfaceTab product={product} kind="creator" />}
        {tab === 'wallet' && <WalletTab product={product} />}
        {tab === 'profile' && <ProfileTab product={product} onBack={onBack} />}
      </ScrollView>

      {/* bottom nav */}
      <BottomNav product={product} tab={tab} setTab={setTab} bottomInset={insets.bottom} />
    </View>
  );
}

/* ───────────────── home tab ───────────────── */

function HomeTab({
  product,
  onSwitchProduct,
  setTab,
}: {
  product: ProductTheme;
  onSwitchProduct: (id: ProductId) => void;
  setTab: (t: Tab) => void;
}) {
  const c = product.canvas;
  const { width } = useWindowDimensions();
  const slideW = Math.min(width, 640) - 36;
  const [cat, setCat] = useState<CategoryId>('all');
  const slides = FEATURED_SLIDES[product.id];
  const market = MARKET[product.id];

  const pillars = useMemo(
    () => (cat === 'all' ? market.pillars : market.pillars.filter((p) => p.category === cat)),
    [cat, market],
  );

  return (
    <View style={{ paddingTop: 14 }}>
      {/* featured slides */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideW + 12}
        contentContainerStyle={{ paddingHorizontal: 18 }}
      >
        {slides.map((s, i) => (
          <View
            key={i}
            style={[
              styles.slide,
              { width: slideW, backgroundColor: c.surface, borderColor: c.border, marginRight: 12 },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: product.accent }]}>
              <Text style={[styles.badgeTxt, { color: product.accentFg }]}>{s.badge}</Text>
            </View>
            <Text style={[styles.slideTitle, { color: c.text }]}>{s.title}</Text>
            <Text style={[styles.slideSub, { color: c.muted }]} numberOfLines={3}>{s.subtitle}</Text>
            <View style={[styles.slideCta, { backgroundColor: product.accent }]}>
              <Text style={[styles.slideCtaTxt, { color: product.accentFg }]}>{s.ctaLabel}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingTop: 18 }}
      >
        {CATEGORY_FILTERS.map((f) => {
          const on = f.id === cat;
          return (
            <Pressable
              key={f.id}
              onPress={() => { haptic.select(); setCat(f.id); }}
              style={[
                styles.pill,
                { borderColor: on ? product.accent : c.border, backgroundColor: on ? product.accent : c.surface },
              ]}
            >
              <CategoryIcon id={f.id} size={15} color={on ? product.accentFg : c.muted} />
              <Text style={[styles.pillTxt, { color: on ? product.accentFg : c.text }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* market preview */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>{market.headline}</Text>
        <Pressable onPress={() => setTab('market')}><Text style={[styles.seeAll, { color: product.accent }]}>See all →</Text></Pressable>
      </View>
      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        {pillars.map((p) => (
          <View key={p.id} style={[styles.listing, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.listingEmoji, { backgroundColor: c.surface2 }]}>
              <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.listingTitle, { color: c.text }]}>{p.title}</Text>
              <Text style={[styles.listingTag, { color: c.muted }]} numberOfLines={1}>{p.tagline}</Text>
            </View>
            <View style={[styles.price, { backgroundColor: c.surface2 }]}>
              <Text style={[styles.priceTxt, { color: c.text }]}>{p.price}</Text>
            </View>
          </View>
        ))}
        {pillars.length === 0 && (
          <Text style={[styles.empty, { color: c.muted }]}>Nothing in this category yet.</Text>
        )}
      </View>

      {/* cross-sell other products */}
      <Text style={[styles.sectionTitle, { color: c.text, paddingHorizontal: 18, marginTop: 22 }]}>More on ONE01</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 10, paddingTop: 10 }}>
        {PRODUCT_ORDER.filter((id) => id !== product.id).map((id) => {
          const o = PRODUCTS[id];
          return (
            <Pressable key={id} onPress={() => onSwitchProduct(id)} style={[styles.crossCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.crossMark, { backgroundColor: DARK_TILE }]}>
                <Mark mark={o.mark} size={26} color={o.mark === 'one' ? o.accent : undefined} eye={DARK_TILE} />
              </View>
              <Text style={[styles.crossName, { color: c.text }]}>{o.name}</Text>
              <Text style={[styles.crossTag, { color: c.muted }]} numberOfLines={2}>{o.tagline}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ───────────────── market / creator surface ───────────────── */

function SurfaceTab({ product, kind }: { product: ProductTheme; kind: 'market' | 'creator' }) {
  const c = product.canvas;
  const s = kind === 'market' ? MARKET[product.id] : CREATOR[product.id];

  return (
    <View style={{ padding: 18, gap: 14 }}>
      <Text style={[styles.surfaceHead, { color: c.text }]}>{s.headline}</Text>
      <Text style={[styles.surfaceSub, { color: c.muted }]}>{s.subtitle}</Text>
      <View style={[styles.structure, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.structureTxt, { color: c.muted }]}>{s.structureLine}</Text>
      </View>
      <View style={{ gap: 10 }}>
        {s.pillars.map((p) => (
          <View key={p.id} style={[styles.pillar, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.pillarTop}>
              <View style={[styles.listingEmoji, { backgroundColor: c.surface2 }]}>
                <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.listingTitle, { color: c.text }]}>{p.title}</Text>
                <Text style={[styles.listingTag, { color: c.muted }]}>{p.tagline}</Text>
              </View>
              <View style={[styles.price, { backgroundColor: product.accent }]}>
                <Text style={[styles.priceTxt, { color: product.accentFg }]}>{p.price}</Text>
              </View>
            </View>
            <Text style={[styles.pillarDetail, { color: c.muted }]}>{p.detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────── wallet ───────────────── */

function WalletTab({ product }: { product: ProductTheme }) {
  const c = product.canvas;
  const f = product.features;
  const methods = [
    f.fiat && { k: 'fiat', label: 'Fiat rails', hint: 'Cards & bank corridors' },
    f.crypto && { k: 'crypto', label: 'Crypto', hint: 'On-chain top-up' },
    { k: 'credits', label: 'Credits', hint: 'In-ecosystem balance' },
  ].filter(Boolean) as { k: string; label: string; hint: string }[];

  return (
    <View style={{ padding: 18, gap: 16 }}>
      <View style={[styles.walletCard, { backgroundColor: product.accent }]}>
        <Text style={[styles.walletCardLbl, { color: product.accentFg, opacity: 0.8 }]}>{product.name} balance</Text>
        <Text style={[styles.walletCardAmt, { color: product.accentFg }]}>◎ 2,480</Text>
        <Text style={[styles.walletCardLbl, { color: product.accentFg, opacity: 0.8 }]}>Same ONE01 identity · virtual balance</Text>
      </View>
      <View style={styles.walletBtnRow}>
        <View style={[styles.walletBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.walletBtnTxt, { color: c.text }]}>Deposit</Text>
        </View>
        <View style={[styles.walletBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.walletBtnTxt, { color: c.text }]}>Withdraw</Text>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: c.text }]}>Payment methods</Text>
      {methods.map((m) => (
        <View key={m.k} style={[styles.listing, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.flex}>
            <Text style={[styles.listingTitle, { color: c.text }]}>{m.label}</Text>
            <Text style={[styles.listingTag, { color: c.muted }]}>{m.hint}</Text>
          </View>
          <Text style={[styles.priceTxt, { color: c.muted }]}>›</Text>
        </View>
      ))}
    </View>
  );
}

/* ───────────────── profile ───────────────── */

function ProfileTab({ product, onBack }: { product: ProductTheme; onBack: () => void }) {
  const c = product.canvas;
  const f = product.features;
  const flags = Object.entries(f).filter(([, v]) => v).map(([k]) => k);

  return (
    <View style={{ padding: 18, gap: 16 }}>
      <View style={[styles.profileHero, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.profileAv, { backgroundColor: DARK_TILE }]}>
          <One01Mark size={34} color="#FFFFFF" />
        </View>
        <Text style={[styles.profileName, { color: c.text }]}>Your ONE01 account</Text>
        <Text style={[styles.profileSub, { color: c.muted }]}>One identity across {product.name} and every app on ONE01.</Text>
      </View>
      <View style={[styles.structure, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.sectionTitle, { color: c.text, marginBottom: 8 }]}>{product.name} features</Text>
        <View style={styles.flagWrap}>
          {flags.map((fl) => (
            <View key={fl} style={[styles.flag, { borderColor: product.accent }]}>
              <Text style={[styles.flagTxt, { color: product.accent }]}>{fl}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable onPress={onBack} style={[styles.walletBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.walletBtnTxt, { color: c.text }]}>← Back to ONE01 hub</Text>
      </Pressable>
    </View>
  );
}

/* ───────────────── bottom nav ───────────────── */

function BottomNav({ product, tab, setTab, bottomInset }: { product: ProductTheme; tab: Tab; setTab: (t: Tab) => void; bottomInset: number }) {
  const c = product.canvas;
  return (
    <View style={[styles.nav, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(bottomInset, 10) }]}>
      {product.nav.map((item, i) => {
        const active = item.tab === tab;
        if (item.isCenter) {
          return (
            <Pressable key={i} onPress={() => { haptic.select(); setTab(item.tab); }} style={styles.navCenterWrap}>
              <View style={[styles.navCenter, { backgroundColor: product.accent }]}>
                <Mark mark={product.mark} size={26} color={product.mark === 'one' ? '#0A0C0B' : undefined} eye={product.accent} />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={i} onPress={() => { haptic.select(); setTab(item.tab); }} style={styles.navItem}>
            <Text style={[styles.navIcon, { color: active ? product.accent : c.muted, opacity: active ? 1 : 0.9 }]}>{item.icon}</Text>
            <Text style={[styles.navLabel, { color: active ? product.accent : c.muted }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────────────── external app modal ───────────────── */

function ExternalModal({ app, onClose }: { app: EcosystemApp | null; onClose: () => void }) {
  const { colors } = useThemeStore();
  return (
    <Modal visible={!!app} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
          {app && (
            <>
              <View style={[styles.appTile, { backgroundColor: app.tile === 'accent' ? app.accent : DARK_TILE, alignSelf: 'center' }]}>
                <Mark mark={app.mark} size={34} color={app.tile === 'accent' ? '#FFFFFF' : undefined} eye={DARK_TILE} />
              </View>
              <Text style={[styles.modalName, { color: colors.text }]}>{app.name}</Text>
              <Text style={[styles.modalTag, { color: colors.textSecondary }]}>{app.tagline}</Text>
              <Text style={[styles.modalDomain, { color: app.accent }]}>{app.domain}</Text>
              <Text style={[styles.modalNote, { color: colors.textSecondary }]}>
                An external ONE01 app — opens at {app.domain} with the same ONE01 account.
              </Text>
              <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: colors.text }]}>
                <Text style={[styles.modalBtnTxt, { color: colors.background }]}>Got it</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ═══════════════════════════════════ styles ═══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* hub bar */
  hubBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  walletPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  walletGlyph: { fontSize: 14, fontWeight: '700' },
  walletAmt: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  exitBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  exitTxt: { fontSize: 15, fontWeight: '600' },

  /* hub body */
  hubKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  hubTitle: { fontSize: 28, fontWeight: '800', lineHeight: 33, letterSpacing: -0.5 },
  hubIntro: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stat: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11, marginTop: 3, textAlign: 'center' },

  sectionLbl: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 24, marginBottom: 12 },
  switchRow: { flexDirection: 'row', gap: 10 },
  switchChip: { flex: 1, alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 16 },
  switchMark: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  switchName: { fontSize: 14, fontWeight: '700' },

  grid: { gap: 12 },
  appCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14 },
  appTile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  appBody: { flex: 1, minWidth: 0 },
  appName: { fontSize: 16, fontWeight: '700' },
  appTag: { fontSize: 13, marginTop: 2 },
  appDomain: { fontSize: 12, marginTop: 4, opacity: 0.8 },
  appCta: { borderWidth: 1.4, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 7 },
  appCtaTxt: { fontSize: 13, fontWeight: '700' },

  footnote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },

  /* shell header */
  shellHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 30, fontWeight: '300', lineHeight: 32 },
  headMark: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headName: { fontSize: 17, fontWeight: '800' },
  headRail: { fontSize: 11, marginTop: 1 },

  /* slides */
  slide: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, minHeight: 170, justifyContent: 'flex-start' },
  badge: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 12 },
  badgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  slideTitle: { fontSize: 19, fontWeight: '800', lineHeight: 24 },
  slideSub: { fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  slideCta: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  slideCtaTxt: { fontSize: 13, fontWeight: '700' },

  /* pills */
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  pillTxt: { fontSize: 13, fontWeight: '600' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '700' },

  listing: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  listingEmoji: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listingTitle: { fontSize: 15, fontWeight: '700' },
  listingTag: { fontSize: 12.5, marginTop: 2 },
  price: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  priceTxt: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  crossCard: { width: 150, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 8 },
  crossMark: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  crossName: { fontSize: 15, fontWeight: '800' },
  crossTag: { fontSize: 12, lineHeight: 16 },

  /* surface tab */
  surfaceHead: { fontSize: 22, fontWeight: '800' },
  surfaceSub: { fontSize: 14, lineHeight: 20 },
  structure: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  structureTxt: { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  pillar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  pillarTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillarDetail: { fontSize: 13, lineHeight: 19 },

  /* wallet */
  walletCard: { borderRadius: 20, padding: 22, gap: 6 },
  walletCardLbl: { fontSize: 13, fontWeight: '600' },
  walletCardAmt: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  walletBtnRow: { flexDirection: 'row', gap: 10 },
  walletBtn: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  walletBtnTxt: { fontSize: 15, fontWeight: '700' },

  /* profile */
  profileHero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 22, alignItems: 'center', gap: 10 },
  profileAv: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 18, fontWeight: '800' },
  profileSub: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  flagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  flagTxt: { fontSize: 12.5, fontWeight: '700' },

  /* bottom nav */
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 8 },
  navItem: { alignItems: 'center', gap: 3, flex: 1 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, fontWeight: '600' },
  navCenterWrap: { flex: 1, alignItems: 'center' },
  navCenter: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: -18, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },

  /* external modal */
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 360, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 24, alignItems: 'center', gap: 8 },
  modalName: { fontSize: 19, fontWeight: '800', marginTop: 6 },
  modalTag: { fontSize: 13.5 },
  modalDomain: { fontSize: 13, fontWeight: '700' },
  modalNote: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  modalBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 11, marginTop: 10 },
  modalBtnTxt: { fontSize: 14, fontWeight: '700' },
});
