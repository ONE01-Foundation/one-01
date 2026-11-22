/**
 * DetailPage — one App-Store-style detail page used for every tappable home
 * item, adapting by `kind`:
 *   • project — a product (Winzi/MixStar/Xit…): Open, "What's inside" features.
 *   • game    — a Winzi game: Play, game modes + leaderboard.
 *   • show    — a MixStar series: Watch, episodes + contestants.
 *   • process — a ONE process: Continue, steps.
 * Hero (icon + name + CTA), a stat strip, a screenshots gallery, an About
 * paragraph, and a kind-specific section + ratings. Themed by the current shell.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  One01Mark, OneMark, WinziMark, MixStarMark, XitMark, SodexMark, DargWinMark,
} from './brand';
import { PRODUCTS, type ShellTheme, type MarkId, type HomeItem } from '../../data/one01/platform';

export type DetailKind = 'project' | 'game' | 'show' | 'process';

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

export function DetailPage({ th, kind, item, onBack, onPrimary, wide = false, topPad = 0 }: { th: ShellTheme; kind: DetailKind; item: HomeItem; onBack: () => void; onPrimary: () => void; wide?: boolean; topPad?: number }) {
  const insets = useSafeAreaInsets();
  const accent = item.product ? PRODUCTS[item.product].accent : th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';
  const rating = ratingFor(item.id);
  const grad: [string, string] = item.bg ?? [`${th.glow}CC`, th.surface];

  const primaryLabel = kind === 'project' ? (item.cta ?? 'Open') : kind === 'game' ? 'Play' : kind === 'show' ? 'Watch' : 'Continue';
  const developer = kind === 'project' ? `${item.title} · on ONE01` : kind === 'game' ? 'Winzi Studio' : kind === 'show' ? 'MixStar Originals' : 'ONE';

  const stats =
    kind === 'game'
      ? [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: `${item.metric ?? '—'}`, l: 'ONLINE' }, { v: 'Action', l: 'GENRE' }, { v: '4+', l: 'AGE' }]
      : kind === 'show'
      ? [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: `${item.metric ?? '—'}`, l: 'VIEWERS' }, { v: 'S1', l: 'SEASON' }, { v: 'Reality', l: 'GENRE' }]
      : kind === 'process'
      ? [{ v: '3', l: 'STEPS' }, { v: 'Active', l: 'STATUS' }, { v: 'Private', l: 'SHARED' }, { v: 'ONE', l: 'RUNS ON' }]
      : [{ v: rating.toFixed(1), l: 'RATING', stars: true }, { v: '12K', l: 'USERS' }, { v: 'Verified', l: 'STATUS' }, { v: '4+', l: 'AGE' }];

  const about =
    kind === 'game'
      ? `${item.title} is a skill-based game on Winzi. Queue into matches, climb the ranks, and cash out to your wallet — same ONE01 rails as the rest of the ecosystem.`
      : kind === 'show'
      ? `${item.title} is an interactive MixStar season. Follow the contestants, place your calls, and watch the odds move live as each episode airs.`
      : kind === 'process'
      ? `${item.title} is a guided process your ONE runs for you — with milestones, costs, and handoffs, revealing only what you allow.`
      : `${item.title} runs on ONE01, the shared layer. Same wallet, identity, and settlement as every other app. ${item.subtitle ?? ''}`.trim();

  const section: { title: string; rows: { k: string; a: string; b?: string; emoji?: string }[] } =
    kind === 'game'
      ? { title: 'Game modes', rows: [{ k: 'ranked', a: 'Ranked', b: 'Climb the ladder', emoji: '🏆' }, { k: 'duel', a: 'Duel', b: '1v1, real stakes', emoji: '⚔️' }, { k: 'tourney', a: 'Tournament', b: 'Brackets & prize pools', emoji: '🎟️' }] }
      : kind === 'show'
      ? { title: 'Episodes', rows: [{ k: 'e4', a: 'Episode 4 — Immunity', b: '42 min · voting open', emoji: '🔴' }, { k: 'e3', a: 'Episode 3 — The Twist', b: '39 min', emoji: '▶️' }, { k: 'e2', a: 'Episode 2 — Alliances', b: '41 min', emoji: '▶️' }] }
      : kind === 'process'
      ? { title: 'Steps', rows: [{ k: 's1', a: 'Gather details', b: 'Done', emoji: '✅' }, { k: 's2', a: 'Reach the provider', b: 'In progress', emoji: '⏳' }, { k: 's3', a: 'Confirm & pay', b: 'Up next', emoji: '◻️' }] }
      : { title: "What's inside", rows: [{ k: 'profiles', a: 'Profiles & permissions', b: 'Selective disclosure', emoji: '🪪' }, { k: 'market', a: 'Market & settlement', b: 'Buy, sell, wallet', emoji: '🏪' }, { k: 'live', a: 'Live updates', b: 'Same ONE01 identity', emoji: '⚡' }] };

  const leaderboard = kind === 'game' ? [{ r: '1', n: 'ace_27', s: '12,480' }, { r: '2', n: 'nova', s: '11,905' }, { r: '3', n: 'k1ng', s: '10,772' }] : null;

  return (
    <View style={styles.root}>
      {/* pinned header — stays put while the content scrolls */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={onBack} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.chev, { color: th.text }]}>‹</Text>
        </Pressable>
        <View style={styles.flex} />
        <Pressable style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.share, { color: th.muted }]}>↗</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: wide ? 'center' : 'stretch' }} showsVerticalScrollIndicator={false}>
        <View style={wide ? styles.colWide : styles.flex}>
        {/* hero */}
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: kind === 'project' ? DARK_TILE : grad[0] }]}>
            {kind === 'project' ? <Mark mark={item.mark ?? 'one01'} size={56} /> : <Text style={{ fontSize: 52 }}>{item.emoji}</Text>}
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

        {/* gallery */}
        <Text style={[styles.secTitle, { color: th.text }]}>Preview</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
          {[0, 1, 2].map((n) => (
            <LinearGradient key={n} colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shot}>
              <Text style={styles.shotEmoji}>{kind === 'project' ? '' : item.emoji}</Text>
              {kind === 'project' ? <View style={styles.shotMark}><Mark mark={item.mark ?? 'one01'} size={46} /></View> : null}
              <Text style={styles.shotCap}>{kind === 'show' ? `Scene ${n + 1}` : kind === 'game' ? `Match ${n + 1}` : `Screen ${n + 1}`}</Text>
            </LinearGradient>
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
  chev: { fontSize: 28, fontWeight: '400', lineHeight: 30 },
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
  shot: { width: 260, height: 190, borderRadius: 18, overflow: 'hidden', padding: 16, justifyContent: 'flex-end' },
  shotEmoji: { position: 'absolute', top: 30, alignSelf: 'center', fontSize: 72, left: 0, right: 0, textAlign: 'center' },
  shotMark: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center' },
  shotCap: { color: '#fff', fontSize: 13, fontWeight: '700' },

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
