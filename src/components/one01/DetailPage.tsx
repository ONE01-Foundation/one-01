/**
 * DetailPage — one App-Store-style detail page used for every tappable home
 * item and Market listing, adapting by `kind`:
 *   • project — a product (Winzi/MixStar/Xit…): Open + an Invest panel that lets
 *     you buy/sell virtual shares of the project at a live, fluctuating price.
 *   • market  — a Market listing: Get (debits credits), "What's included".
 *   • game    — a Winzi game: Play, game modes + leaderboard.
 *   • show    — a MixStar series: Watch, episodes + contestants.
 *   • process — a ONE process: Continue, steps.
 * Hero (icon + name + CTA), a stat strip, a screenshots gallery, an About
 * paragraph, and a kind-specific section + ratings. Themed by the current shell.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  One01Mark, OneMark, WinziMark, MixStarMark, XitMark, SodexMark, DargWinMark,
} from './brand';
import { PRODUCTS, type ShellTheme, type MarkId, type HomeItem } from '../../data/one01/platform';
import { useOne01PlatformStore, livePrice, priceSeries, dayChangePct } from '../../stores/one01PlatformStore';
import { haptic } from '../../utils/haptics';

export type DetailKind = 'project' | 'game' | 'show' | 'process' | 'market';

const DARK_TILE = '#131317';

function Mark({ mark, size }: { mark: MarkId; size: number }) {
  switch (mark) {
    case 'one': return <OneMark size={size} color="#FFFFFF" eye="#0A0A0A" />;
    case 'winzi': return <WinziMark size={size} />;
    case 'mixstar': return <MixStarMark size={size} />;
    case 'xit': return <XitMark size={size} />;
    case 'sodex': return <SodexMark size={size} color="#FFFFFF" />;
    case 'dargwin': return <DargWinMark size={size} />;
    case 'one01': default: return <One01Mark size={size} color="#FFFFFF" />;
  }
}

/* small deterministic rating so a given item is stable */
function ratingFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return 4.3 + (h % 7) / 10; // 4.3–4.9
}

function Stars({ value, color }: { value: number; color: string }) {
  const full = Math.round(value);
  return <Text style={{ color, fontSize: 13, letterSpacing: 1 }}>{'★★★★★'.slice(0, full)}{'☆☆☆☆☆'.slice(0, 5 - full)}</Text>;
}

/* ─────────────────────────── mini price chart ─────────────────────────── */

function MiniChart({ series, color, h = 58 }: { series: number[]; color: string; h?: number }) {
  const w = 320;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - ((v - min) / span) * (h - 10) - 5] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={area} fill={color} opacity={0.15} />
      <Path d={line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/* ─────────────────────────── invest panel (project) ─────────────────────────── */

function InvestPanel({ th, item, accent, onToast }: { th: ShellTheme; item: HomeItem; accent: string; onToast?: (m: string) => void }) {
  const positions = useOne01PlatformStore((s) => s.positions);
  const balance = useOne01PlatformStore((s) => s.balance);
  const invest = useOne01PlatformStore((s) => s.invest);
  const divest = useOne01PlatformStore((s) => s.divest);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2500);
    return () => clearInterval(t);
  }, []);
  const price = livePrice(item.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => priceSeries(item.id), [item.id, tick]);
  const chg = dayChangePct(item.id);
  const up = chg >= 0;
  const chartColor = up ? '#22c55e' : '#ef4444';

  const pos = positions[item.id];
  const shares = pos?.shares ?? 0;
  const value = Math.round(shares * price);
  const plPct = pos && pos.avgCost > 0 ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0;

  const [qty, setQty] = useState(1);
  const cost = qty * price;
  const canSell = shares >= qty;

  const buy = () => {
    if (invest(item.id, qty, price, `Invested · ${item.title}`)) { haptic.success(); onToast?.(`Bought ${qty} ${item.title} · −⟡${cost}`); }
    else { haptic.warning(); onToast?.('Not enough credits'); }
  };
  const sell = () => {
    if (divest(item.id, qty, price, `Sold · ${item.title}`)) { haptic.success(); onToast?.(`Sold ${qty} ${item.title} · +⟡${Math.round(qty * price)}`); }
    else { haptic.warning(); onToast?.('No shares to sell'); }
  };

  return (
    <>
      <View style={styles.secRow}>
        <Text style={[styles.secTitle, { color: th.text, marginTop: 0, paddingHorizontal: 0 }]}>Invest</Text>
        <View style={styles.flex} />
        <View style={styles.liveTag}><View style={styles.liveTagDot} /><Text style={[styles.liveTagTxt, { color: th.muted }]}>LIVE</Text></View>
      </View>
      <View style={[styles.investCard, { backgroundColor: th.surface, borderColor: th.border }]}>
        <View style={styles.investTop}>
          <View>
            <Text style={[styles.price, { color: th.text }]}>⟡ {price.toLocaleString()}</Text>
            <Text style={[styles.priceSub, { color: th.muted }]}>per share</Text>
          </View>
          <View style={styles.flex} />
          <View style={[styles.chgPill, { backgroundColor: up ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)' }]}>
            <Text style={[styles.chgTxt, { color: chartColor }]}>{up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%</Text>
          </View>
        </View>

        <View style={{ marginTop: 10, marginHorizontal: -4 }}><MiniChart series={series} color={chartColor} /></View>

        {/* position */}
        <View style={[styles.posRow, { borderColor: th.border }]}>
          {shares > 0 ? (
            <>
              <View>
                <Text style={[styles.posLbl, { color: th.muted }]}>Your position</Text>
                <Text style={[styles.posVal, { color: th.text }]}>{shares} {shares === 1 ? 'share' : 'shares'} · ⟡{value.toLocaleString()}</Text>
              </View>
              <View style={styles.flex} />
              <Text style={[styles.posPl, { color: plPct >= 0 ? '#22c55e' : '#ef4444' }]}>{plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%</Text>
            </>
          ) : (
            <Text style={[styles.posEmpty, { color: th.muted }]}>You don't hold {item.title} yet — buy a share to start.</Text>
          )}
        </View>

        {/* quantity */}
        <View style={styles.qtyRow}>
          <Pressable onPress={() => { haptic.select(); setQty((q) => Math.max(1, q - 1)); }} style={[styles.stepBtn, { borderColor: th.border }]}><Text style={[styles.stepTxt, { color: th.text }]}>−</Text></Pressable>
          <View style={styles.qtyMid}>
            <Text style={[styles.qtyNum, { color: th.text }]}>{qty}</Text>
            <Text style={[styles.qtyLbl, { color: th.muted }]}>{qty === 1 ? 'share' : 'shares'}</Text>
          </View>
          <Pressable onPress={() => { haptic.select(); setQty((q) => Math.min(99, q + 1)); }} style={[styles.stepBtn, { borderColor: th.border }]}><Text style={[styles.stepTxt, { color: th.text }]}>+</Text></Pressable>
          <View style={styles.flex} />
          <Text style={[styles.balHint, { color: th.muted }]}>Balance ⟡{balance.toLocaleString()}</Text>
        </View>

        {/* buy / sell */}
        <View style={styles.tradeRow}>
          <Pressable onPress={buy} style={({ pressed }) => [styles.tradeBtn, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}>
            <Text style={[styles.tradeTxt, { color: accent === '#F9D800' ? '#000' : '#fff' }]}>Buy · ⟡{cost.toLocaleString()}</Text>
          </Pressable>
          <Pressable onPress={sell} disabled={!canSell} style={({ pressed }) => [styles.tradeBtn, styles.sellBtn, { borderColor: th.border }, !canSell && { opacity: 0.4 }, pressed && canSell && { opacity: 0.7 }]}>
            <Text style={[styles.tradeTxt, { color: th.text }]}>Sell</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

/* ── preview shot — an App-Store-style screenshot that feathers into the page.
 *    On web we mask the tile edges to transparent (top/bottom + sides) so it melts
 *    into the sheet like the hero banner on the App Store, instead of a hard rect. */
function PreviewShot({ grad, emoji, mark }: { grad: [string, string]; emoji?: string; mark?: MarkId }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const node = ref.current as unknown as { style?: Record<string, string> } | null;
      if (node?.style) {
        const vy = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';
        const vx = 'linear-gradient(to right, transparent 0%, #000 9%, #000 91%, transparent 100%)';
        node.style.maskImage = `${vy}, ${vx}`;
        node.style.WebkitMaskImage = `${vy}, ${vx}`;
        node.style.maskComposite = 'intersect';
        node.style.WebkitMaskComposite = 'source-in';
      }
    } catch { /* non-web or no DOM node */ }
  }, []);
  return (
    <View ref={ref} style={styles.shot}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {mark ? <View style={styles.shotMark}><Mark mark={mark} size={50} /></View> : <Text style={styles.shotEmoji}>{emoji}</Text>}
    </View>
  );
}

export function DetailPage({ th, kind, item, onBack, onPrimary, wide = false, topPad = 0, onScroll, onToast }: { th: ShellTheme; kind: DetailKind; item: HomeItem; onBack: () => void; onPrimary: () => void; wide?: boolean; topPad?: number; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; onToast?: (m: string) => void }) {
  const insets = useSafeAreaInsets();
  const accent = item.product ? PRODUCTS[item.product].accent : th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';
  const rating = ratingFor(item.id);
  const grad: [string, string] = item.bg ?? [`${th.glow}CC`, th.surface];
  const priceN = item.priceLabel ? parseInt(item.priceLabel.replace(/[^0-9]/g, ''), 10) || 0 : 0;

  const primaryLabel =
    kind === 'project' ? (item.cta ?? 'Open')
      : kind === 'market' ? (priceN > 0 ? `Get · ⟡${priceN}` : 'Get')
      : kind === 'game' ? 'Play'
      : kind === 'show' ? 'Watch'
      : 'Continue';
  const developer =
    kind === 'project' ? `${item.title} · on ONE01`
      : kind === 'market' ? 'On ONE01 · Market'
      : kind === 'game' ? 'Winzi Studio'
      : kind === 'show' ? 'MixStar Originals'
      : 'ONE';

  const stats =
    kind === 'game'
      ? [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: `${item.metric ?? '—'}`, l: 'ONLINE' }, { v: 'Action', l: 'GENRE' }, { v: '4+', l: 'AGE' }]
      : kind === 'show'
      ? [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: `${item.metric ?? '—'}`, l: 'VIEWERS' }, { v: 'S1', l: 'SEASON' }, { v: 'Reality', l: 'GENRE' }]
      : kind === 'process'
      ? [{ v: '3', l: 'STEPS' }, { v: 'Active', l: 'STATUS' }, { v: 'Private', l: 'SHARED' }, { v: 'ONE', l: 'RUNS ON' }]
      : kind === 'market'
      ? [{ v: priceN > 0 ? `⟡${priceN}` : 'Free', l: 'PRICE' }, { v: 'Market', l: 'TYPE' }, { v: 'Verified', l: 'SELLER' }, { v: rating.toFixed(1), l: 'RATING', stars: true }]
      : [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: '12K', l: 'USERS' }, { v: 'Verified', l: 'STATUS' }, { v: '4+', l: 'AGE' }];

  const about =
    kind === 'game'
      ? `${item.title} is a skill-based game on Winzi. Queue into matches, climb the ranks, and cash out to your wallet — same ONE01 rails as the rest of the ecosystem.`
      : kind === 'show'
      ? `${item.title} is an interactive MixStar season. Follow the contestants, place your calls, and watch the odds move live as each episode airs.`
      : kind === 'process'
      ? `${item.title} is a guided process your ONE runs for you — with milestones, costs, and handoffs, revealing only what you allow.`
      : kind === 'market'
      ? (item.blurb ?? `${item.title} is listed on ONE01 Market. Buy once and it settles to your wallet under the same identity you use across every app.`)
      : `${item.title} runs on ONE01, the shared layer. Same wallet, identity, and settlement as every other app. ${item.subtitle ?? ''}`.trim();

  const section: { title: string; rows: { k: string; a: string; b?: string; emoji?: string }[] } =
    kind === 'game'
      ? { title: 'Game modes', rows: [{ k: 'ranked', a: 'Ranked', b: 'Climb the ladder', emoji: '🏆' }, { k: 'duel', a: 'Duel', b: '1v1, real stakes', emoji: '⚔️' }, { k: 'tourney', a: 'Tournament', b: 'Brackets & prize pools', emoji: '🎟️' }] }
      : kind === 'show'
      ? { title: 'Episodes', rows: [{ k: 'e4', a: 'Episode 4 — Immunity', b: '42 min · voting open', emoji: '🔴' }, { k: 'e3', a: 'Episode 3 — The Twist', b: '39 min', emoji: '▶️' }, { k: 'e2', a: 'Episode 2 — Alliances', b: '41 min', emoji: '▶️' }] }
      : kind === 'process'
      ? { title: 'Steps', rows: [{ k: 's1', a: 'Gather details', b: 'Done', emoji: '✅' }, { k: 's2', a: 'Reach the provider', b: 'In progress', emoji: '⏳' }, { k: 's3', a: 'Confirm & pay', b: 'Up next', emoji: '◻️' }] }
      : kind === 'market'
      ? { title: "What's included", rows: [{ k: 'instant', a: 'Instant delivery', b: 'Straight to your ONE01 wallet', emoji: '⚡' }, { k: 'identity', a: 'Same identity', b: 'Works across every app', emoji: '🪪' }, { k: 'resell', a: 'Resellable', b: 'List it back on Market', emoji: '🏪' }] }
      : { title: "What's inside", rows: [{ k: 'profiles', a: 'Profiles & permissions', b: 'Selective disclosure', emoji: '🪪' }, { k: 'market', a: 'Market & settlement', b: 'Buy, sell, wallet', emoji: '🏪' }, { k: 'live', a: 'Live updates', b: 'Same ONE01 identity', emoji: '⚡' }] };

  const leaderboard = kind === 'game' ? [{ r: '1', n: 'ace_27', s: '12,480' }, { r: '2', n: 'nova', s: '11,905' }, { r: '3', n: 'k1ng', s: '10,772' }] : null;

  return (
    <View style={styles.root}>
      {/* controls — pinned to the screen corners on desktop, a header row on mobile */}
      {wide ? (
        <>
          <Pressable onPress={onBack} hitSlop={10} style={[styles.corner, { top: topPad, left: 24, backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.chev, { color: th.text }]}>‹</Text>
          </Pressable>
          <Pressable style={[styles.corner, { top: topPad, right: 24, backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.share, { color: th.muted }]}>↗</Text>
          </Pressable>
        </>
      ) : (
        <View style={[styles.header, { paddingTop: topPad + 10 }]}>
          <Pressable onPress={onBack} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.xmark, { color: th.text }]}>✕</Text>
          </Pressable>
          <View style={styles.flex} />
          <Pressable style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.share, { color: th.muted }]}>↗</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingTop: wide ? topPad + 52 : 0, paddingBottom: insets.bottom + 40, alignItems: wide ? 'center' : 'stretch' }} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        <View style={wide ? styles.colWide : styles.flex}>
        {/* hero */}
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: kind === 'project' && item.mark ? DARK_TILE : grad[0] }]}>
            {kind === 'project' && item.mark ? <Mark mark={item.mark} size={56} /> : <Text style={{ fontSize: 52 }}>{item.emoji}</Text>}
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.name, { color: th.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.dev, { color: th.muted }]} numberOfLines={1}>{developer}</Text>
            <View style={styles.heroRow}>
              <Pressable onPress={onPrimary} style={[styles.cta, { backgroundColor: accent }]}>
                <Text style={[styles.ctaTxt, { color: accentFg }]}>{primaryLabel}</Text>
              </Pressable>
              <Text style={[styles.inApp, { color: th.muted }]}>In‑app · virtual</Text>
            </View>
          </View>
        </View>

        {/* stat strip */}
        <View style={[styles.stats, { borderColor: th.border }]}>
          {stats.map((s, i) => (
            <View key={s.l} style={[styles.stat, i < stats.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: th.border }]}>
              {s.stars ? <Stars value={rating} color={th.muted} /> : <Text style={[styles.statV, { color: th.text }]} numberOfLines={1}>{s.v}</Text>}
              <Text style={[styles.statL, { color: th.muted }]}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* invest panel (ONE01 projects behave like shares) */}
        {kind === 'project' && (
          <View style={styles.sectionPad}>
            <InvestPanel th={th} item={item} accent={accent} onToast={onToast} />
          </View>
        )}

        {/* gallery — App-Store-style previews that feather into the page */}
        <Text style={[styles.secTitle, { color: th.text }]}>Preview</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}>
          {[0, 1, 2].map((n) => (
            <View key={n} style={styles.shotCol}>
              <PreviewShot grad={grad} emoji={kind === 'project' && item.mark ? undefined : item.emoji} mark={kind === 'project' && item.mark ? item.mark : undefined} />
              <Text style={[styles.shotCap, { color: th.muted }]}>{kind === 'show' ? `Scene ${n + 1}` : kind === 'game' ? `Match ${n + 1}` : kind === 'market' ? `Detail ${n + 1}` : `Screen ${n + 1}`}</Text>
            </View>
          ))}
        </ScrollView>

        {/* about */}
        <Text style={[styles.secTitle, { color: th.text }]}>About</Text>
        <Text style={[styles.about, { color: th.muted }]}>{about}</Text>

        {/* kind section */}
        <Text style={[styles.secTitle, { color: th.text }]}>{section.title}</Text>
        <View style={styles.list}>
          {section.rows.map((r) => (
            <View key={r.k} style={[styles.listRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.listEmoji, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 18 }}>{r.emoji}</Text></View>
              <View style={styles.flex}>
                <Text style={[styles.listA, { color: th.text }]}>{r.a}</Text>
                {r.b ? <Text style={[styles.listB, { color: th.muted }]}>{r.b}</Text> : null}
              </View>
              <Text style={[styles.chev, { color: th.muted, fontSize: 22 }]}>›</Text>
            </View>
          ))}
        </View>

        {/* leaderboard (games) */}
        {leaderboard && (
          <>
            <Text style={[styles.secTitle, { color: th.text }]}>Top players</Text>
            <View style={[styles.board, { backgroundColor: th.surface, borderColor: th.border }]}>
              {leaderboard.map((p, i) => (
                <View key={p.r} style={[styles.boardRow, i < leaderboard.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: th.border }]}>
                  <Text style={[styles.rank, { color: accent }]}>{p.r}</Text>
                  <Text style={[styles.listA, styles.flex, { color: th.text }]}>{p.n}</Text>
                  <Text style={[styles.score, { color: th.muted }]}>{p.s}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ratings */}
        {kind !== 'process' && (
          <>
            <Text style={[styles.secTitle, { color: th.text }]}>Ratings & reviews</Text>
            <View style={[styles.ratings, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View>
                <Text style={[styles.bigRating, { color: th.text }]}>{rating.toFixed(1)}</Text>
                <Text style={[styles.statL, { color: th.muted }]}>out of 5</Text>
              </View>
              <View style={styles.flex}>
                <Stars value={rating} color={accent} />
                <Text style={[styles.listB, { color: th.muted, marginTop: 4 }]}>2,340 ratings</Text>
              </View>
            </View>
          </>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  colWide: { width: 700, maxWidth: '100%' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', zIndex: 5, width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, fontWeight: '400', lineHeight: 30 },
  xmark: { fontSize: 17, fontWeight: '600' },
  share: { fontSize: 18, fontWeight: '700' },

  hero: { flexDirection: 'row', gap: 16, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 },
  icon: { width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  dev: { fontSize: 13.5, marginTop: 3 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  cta: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 9 },
  ctaTxt: { fontSize: 15, fontWeight: '800' },
  inApp: { fontSize: 11.5 },

  stats: { flexDirection: 'row', marginHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  statV: { fontSize: 15, fontWeight: '800' },
  statL: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  secTitle: { fontSize: 19, fontWeight: '800', paddingHorizontal: 18, marginTop: 26, marginBottom: 12 },
  sectionPad: { paddingHorizontal: 18, marginTop: 24 },
  secRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveTagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveTagTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  /* invest card */
  investCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16 },
  investTop: { flexDirection: 'row', alignItems: 'center' },
  price: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  priceSub: { fontSize: 12, marginTop: 1 },
  chgPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chgTxt: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  posRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 12 },
  posLbl: { fontSize: 11.5, fontWeight: '600' },
  posVal: { fontSize: 15, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  posPl: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  posEmpty: { fontSize: 13, lineHeight: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 22, fontWeight: '700' },
  qtyMid: { alignItems: 'center', minWidth: 54 },
  qtyNum: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  qtyLbl: { fontSize: 10.5, fontWeight: '600' },
  balHint: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tradeRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tradeBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sellBtn: { flex: 0.6, borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  tradeTxt: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },

  shotCol: { width: 260 },
  shot: { width: 260, height: 190, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shotEmoji: { fontSize: 78 },
  shotMark: { alignItems: 'center', justifyContent: 'center' },
  shotCap: { fontSize: 12.5, fontWeight: '700', marginTop: 9, paddingLeft: 2 },

  about: { fontSize: 14.5, lineHeight: 21, paddingHorizontal: 18 },

  list: { paddingHorizontal: 18, gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  listEmoji: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listA: { fontSize: 15, fontWeight: '700' },
  listB: { fontSize: 12.5, marginTop: 2 },

  board: { marginHorizontal: 18, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rank: { fontSize: 15, fontWeight: '800', width: 18 },
  score: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  ratings: { flexDirection: 'row', alignItems: 'center', gap: 20, marginHorizontal: 18, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 18 },
  bigRating: { fontSize: 40, fontWeight: '800' },
});
