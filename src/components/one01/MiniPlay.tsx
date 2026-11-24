/**
 * MiniPlay — small but genuinely interactive experiences launched from a detail
 * page's Play / Watch button, wagered against your virtual-credit balance:
 *   • MiniGame — stake credits on a head-to-head reaction MATCH vs a rival. Beat
 *     their score and you win 2× your stake; lose and the stake is gone.
 *   • MiniShow — BET on which contestant survives. Pick one, choose a stake, and
 *     the odds (from the live room) pay out if your pick is leading at the buzzer.
 * Both are full-screen, themed by the current product, with a ✕ to exit. Still
 * virtual — no crypto.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../utils/haptics';
import { type ShellTheme, type HomeItem } from '../../data/one01/platform';
import { useOne01PlatformStore } from '../../stores/one01PlatformStore';
import { PongGame } from './PongGame';

export type PlayKind = 'game' | 'show';

export function MiniPlayer({ kind, th, item, onClose }: { kind: PlayKind; th: ShellTheme; item: HomeItem; onClose: () => void }) {
  // Pong is a REAL two-computer match (Supabase Realtime) — not the reaction mock.
  if (kind === 'game' && item.id === 'pong') return <PongGame th={th} item={item} onClose={onClose} />;
  return kind === 'game' ? <MiniGame th={th} item={item} onClose={onClose} /> : <MiniShow th={th} item={item} onClose={onClose} />;
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
      <Text style={styles.closeTxt}>✕</Text>
    </Pressable>
  );
}

/** Stake chips shared by the game and the show. */
function StakeChips({ stakes, value, balance, accent, onPick }: { stakes: number[]; value: number; balance: number; accent: string; onPick: (v: number) => void }) {
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';
  return (
    <View style={styles.chipRow}>
      {stakes.map((s) => {
        const on = s === value;
        const disabled = s > balance;
        return (
          <Pressable key={s} disabled={disabled} onPress={() => { haptic.select(); onPick(s); }} style={[styles.chip, { borderColor: on ? accent : 'rgba(255,255,255,0.18)', backgroundColor: on ? accent : 'rgba(255,255,255,0.06)' }, disabled && { opacity: 0.3 }]}>
            <Text style={[styles.chipTxt, { color: on ? accentFg : '#fff' }]}>{s === 0 ? 'Free' : `⟡${s}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────── MiniGame (staked match) ─────────────────────────────── */

type GameOutcome = 'win' | 'lose' | 'tie' | null;

function MiniGame({ th, item, onClose }: { th: ShellTheme; item: HomeItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const grad: [string, string] = item.bg ?? [`${th.glow}`, '#0a0a0a'];
  const accent = th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';

  const balance = useOne01PlatformStore((s) => s.balance);
  const credit = useOne01PlatformStore((s) => s.credit);
  const debit = useOne01PlatformStore((s) => s.debit);

  const [phase, setPhase] = useState<'stake' | 'play' | 'done'>('stake');
  const [stake, setStake] = useState(100);
  const [score, setScore] = useState(0);
  const [opp, setOpp] = useState(0);
  const [time, setTime] = useState(15);
  const [outcome, setOutcome] = useState<GameOutcome>(null);
  const [delta, setDelta] = useState(0);
  const [pos, setPos] = useState({ x: width / 2 - 36, y: height / 2 - 36 });
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const rival = useRef<ReturnType<typeof setInterval> | null>(null);

  const topSafe = insets.top + 108;
  const botSafe = insets.bottom + 96;
  const move = () => {
    const x = 24 + Math.random() * Math.max(1, width - 24 - 96);
    const y = topSafe + Math.random() * Math.max(1, height - topSafe - botSafe - 96);
    setPos({ x, y });
  };

  const start = () => {
    if (stake > 0 && !debit(stake, `${item.title} match stake`)) { haptic.warning(); return; }
    haptic.press();
    setScore(0); setOpp(0); setTime(15); setOutcome(null); setPhase('play'); move();
  };

  // countdown
  useEffect(() => {
    if (phase !== 'play') return;
    clock.current = setInterval(() => setTime((t) => t - 1), 1000);
    return () => { if (clock.current) clearInterval(clock.current); };
  }, [phase]);

  // rival scores on a steady pace (beatable by fast tapping)
  useEffect(() => {
    if (phase !== 'play') return;
    rival.current = setInterval(() => setOpp((o) => o + (Math.random() < 0.82 ? 1 : 2)), 1050);
    return () => { if (rival.current) clearInterval(rival.current); };
  }, [phase]);

  // settle when the clock runs out
  useEffect(() => {
    if (phase !== 'play' || time > 0) return;
    const res: GameOutcome = score > opp ? 'win' : score < opp ? 'lose' : 'tie';
    let d = 0;
    if (res === 'win') { d = stake > 0 ? stake : score; credit(stake > 0 ? stake * 2 : score, stake > 0 ? `${item.title} match won` : `${item.title} practice`); }
    else if (res === 'tie' && stake > 0) { d = 0; credit(stake, `${item.title} match drawn — stake back`); }
    else { d = stake > 0 ? -stake : 0; }
    setDelta(d); setOutcome(res); setPhase('done');
    haptic[res === 'lose' ? 'warning' : 'success']();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, phase]);

  const hit = () => { haptic.tap(); setScore((s) => s + 1); move(); };

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <CloseBtn onClose={onClose} />
        <View style={styles.flex} />
        {phase === 'play' && (
          <>
            <View style={styles.hud}><Text style={styles.hudTxt}>You {score}</Text></View>
            <View style={[styles.hud, { marginLeft: 8 }]}><Text style={styles.hudTxt}>Rival {opp}</Text></View>
            <View style={[styles.hud, { marginLeft: 8 }]}><Text style={styles.hudTxt}>⏱ 0:{time < 10 ? `0${time}` : time}</Text></View>
          </>
        )}
      </View>

      {phase === 'play' && (
        <>
          <View style={[styles.stakeTag, { top: insets.top + 56 }]}><Text style={styles.stakeTagTxt}>{stake > 0 ? `Stake ⟡${stake} · win ⟡${stake * 2}` : 'Free practice'}</Text></View>
          <Pressable onPress={hit} style={[styles.target, { left: pos.x, top: pos.y, backgroundColor: accent, shadowColor: accent }]}>
            <Text style={{ fontSize: 34 }}>{item.emoji}</Text>
          </Pressable>
        </>
      )}

      {phase === 'stake' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>{item.emoji}</Text>
          <Text style={styles.bigTitle}>{item.title} · Match</Text>
          <Text style={styles.sub}>Tap the {item.emoji} faster than your rival for 15 seconds. Beat their score to double your stake.</Text>
          <Text style={styles.stakeLbl}>Your stake</Text>
          <StakeChips stakes={[0, 50, 100, 250]} value={stake} balance={balance} accent={accent} onPick={setStake} />
          <Text style={styles.balLine}>Balance ⟡{balance.toLocaleString()}</Text>
          <Pressable onPress={start} style={[styles.cta, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>{stake > 0 ? `Find match · ⟡${stake}` : 'Practice'}</Text></Pressable>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>{outcome === 'win' ? '🏆' : outcome === 'tie' ? '🤝' : '💥'}</Text>
          <Text style={styles.bigTitle}>{outcome === 'win' ? 'You win!' : outcome === 'tie' ? 'Dead heat' : 'Rival wins'}</Text>
          <Text style={styles.scoreLine}>You {score} <Text style={{ color: 'rgba(255,255,255,0.5)' }}>–</Text> {opp} Rival</Text>
          <Text style={[styles.deltaTxt, { color: delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'rgba(255,255,255,0.75)' }]}>
            {delta > 0 ? `+⟡${delta} to your wallet` : delta < 0 ? `−⟡${-delta} lost` : outcome === 'tie' ? 'Stake returned' : 'Nice run'}
          </Text>
          <View style={styles.doneRow}>
            <Pressable onPress={() => setPhase('stake')} style={[styles.cta, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Play again</Text></Pressable>
            <Pressable onPress={onClose} style={[styles.ctaGhost, { borderColor: 'rgba(255,255,255,0.3)' }]}><Text style={styles.ctaGhostTxt}>Done</Text></Pressable>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

/* ─────────────────────────────── MiniShow (betting) ─────────────────────────────── */

type Contestant = { id: string; emoji: string; name: string; pct: number };

const oddsFor = (pct: number) => Math.min(6, Math.max(1.2, 100 / Math.max(6, pct)));

function MiniShow({ th, item, onClose }: { th: ShellTheme; item: HomeItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const grad: [string, string] = item.bg ?? [`${th.glow}`, '#0a0a0a'];
  const accent = th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';

  const balance = useOne01PlatformStore((s) => s.balance);
  const credit = useOne01PlatformStore((s) => s.credit);
  const debit = useOne01PlatformStore((s) => s.debit);

  const [cast, setCast] = useState<Contestant[]>([
    { id: 'a', emoji: '🧑‍🎤', name: 'Remy', pct: 28 },
    { id: 'b', emoji: '👩‍🎤', name: 'Nalee', pct: 34 },
    { id: 'c', emoji: '🧑‍🎨', name: 'Kofi', pct: 21 },
    { id: 'd', emoji: '👨‍🚀', name: 'Vex', pct: 17 },
  ]);
  const [phase, setPhase] = useState<'bet' | 'live' | 'result'>('bet');
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState(50);
  const [lockedOdds, setLockedOdds] = useState(1);
  const [time, setTime] = useState(20);
  const [win, setWin] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);

  const pickC = cast.find((c) => c.id === pick) ?? null;
  const potential = pickC && stake > 0 ? Math.round(stake * oddsFor(pickC.pct)) : 0;

  const place = () => {
    if (!pick) return;
    if (stake > 0) {
      if (!debit(stake, `${item.title} bet · ${pickC?.name}`)) { haptic.warning(); return; }
      setLockedOdds(oddsFor(pickC!.pct));
    } else {
      credit(5, `${item.title} free vote`);
    }
    haptic.press();
    setTime(20); setPhase('live');
  };

  // countdown while live
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setTime((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // the room drifts each tick so bars feel live
  useEffect(() => {
    if (phase !== 'live') return;
    const d = setInterval(() => {
      setCast((prev) => {
        const nudged = prev.map((c) => ({ ...c, pct: Math.max(4, c.pct + (Math.random() * 3 - 1.5)) }));
        const sum = nudged.reduce((a, c) => a + c.pct, 0);
        return nudged.map((c) => ({ ...c, pct: (c.pct / sum) * 100 }));
      });
    }, 1300);
    return () => clearInterval(d);
  }, [phase]);

  // settle at the buzzer
  useEffect(() => {
    if (phase !== 'live' || time > 0) return;
    const leader = [...cast].sort((a, b) => b.pct - a.pct)[0];
    const won = !!pick && leader.id === pick && stake > 0;
    if (won) { const p = Math.round(stake * lockedOdds); setPayout(p); credit(p, `${item.title} bet won · ${pickC?.name}`); }
    setWin(stake > 0 ? won : null);
    setPhase('result');
    haptic[stake > 0 && !won ? 'warning' : 'success']();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, phase]);

  const leader = [...cast].sort((a, b) => b.pct - a.pct)[0];
  const betting = phase === 'bet';

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <CloseBtn onClose={onClose} />
        <View style={styles.flex} />
        <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveTxt}>LIVE · {item.metric}</Text></View>
      </View>

      <View style={styles.showStage}>
        <Text style={{ fontSize: 48 }}>{item.emoji}</Text>
        <Text style={styles.showTitle}>{item.title}</Text>
        <Text style={styles.showSub}>
          {betting ? 'Place your bet' : phase === 'live' ? `Voting closes 0:${time < 10 ? `0${time}` : time}` : 'Results'}
        </Text>
        <Text style={[styles.showQ, { color: accent }]}>
          {phase === 'result' ? `${leader.name} survives tonight` : 'Who survives tonight?'}
        </Text>
      </View>

      <View style={styles.castWrap}>
        {cast.map((c) => {
          const isPick = pick === c.id;
          const isLead = phase === 'result' && leader.id === c.id;
          const hi = isPick || isLead;
          return (
            <Pressable key={c.id} onPress={() => { if (betting) { haptic.select(); setPick(c.id); } }} disabled={!betting} style={[styles.castRow, { borderColor: hi ? accent : 'rgba(255,255,255,0.12)' }]}>
              <View style={styles.castFill}>
                <View style={[styles.fill, { width: `${Math.round(c.pct)}%`, backgroundColor: hi ? accent : 'rgba(255,255,255,0.14)' }]} />
              </View>
              <View style={styles.castContent}>
                <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                <Text style={styles.castName}>{c.name}</Text>
                {isPick ? <Text style={[styles.castYou, { color: accent }]}>your pick</Text> : null}
                <View style={styles.flex} />
                {betting ? <Text style={styles.castOdds}>{oddsFor(c.pct).toFixed(1)}×</Text> : null}
                <Text style={styles.castPct}>{Math.round(c.pct)}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.showFoot, { paddingBottom: insets.bottom + 18 }]}>
        {phase === 'bet' && (
          <>
            <StakeChips stakes={[0, 25, 50, 100]} value={stake} balance={balance} accent={accent} onPick={setStake} />
            <Pressable onPress={place} disabled={!pick} style={[styles.cta, styles.full, { backgroundColor: pick ? accent : 'rgba(255,255,255,0.14)' }]}>
              <Text style={[styles.ctaTxt, { color: pick ? accentFg : 'rgba(255,255,255,0.5)' }]}>
                {!pick ? 'Pick a contestant' : stake > 0 ? `Bet ⟡${stake} → win ⟡${potential}` : `Free vote · ${pickC?.name}`}
              </Text>
            </Pressable>
          </>
        )}
        {phase === 'live' && (
          <Text style={styles.hint}>{stake > 0 ? `Your bet: ${pickC?.name} · ⟡${stake} → ⟡${Math.round(stake * lockedOdds)}` : `Free vote on ${pickC?.name} — watch the room move.`}</Text>
        )}
        {phase === 'result' && (
          <>
            {win !== null && (
              <Text style={[styles.resultTxt, { color: win ? '#4ade80' : '#f87171' }]}>
                {win ? `Your pick survived — +⟡${payout}` : `${pickC?.name} didn't make it — −⟡${stake}`}
              </Text>
            )}
            <Pressable onPress={onClose} style={[styles.cta, styles.full, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Back to MixStar</Text></Pressable>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hud: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  hudTxt: { color: '#fff', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  stakeTag: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  stakeTagTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },

  target: { position: 'absolute', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 8 },
  bigTitle: { color: '#fff', fontSize: 27, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 2 },
  stakeLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14 },
  balLine: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 10 },
  scoreLine: { color: '#fff', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  deltaTxt: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  cta: { borderRadius: 999, paddingHorizontal: 30, paddingVertical: 14, marginTop: 16 },
  full: { alignItems: 'center', alignSelf: 'stretch' },
  ctaTxt: { fontSize: 16, fontWeight: '800' },
  ctaGhost: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14, borderWidth: 1.5, marginTop: 16 },
  ctaGhostTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },

  chipRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, minWidth: 62, alignItems: 'center' },
  chipTxt: { fontSize: 14, fontWeight: '800' },

  /* show */
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef2d56', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  showStage: { alignItems: 'center', paddingTop: 12, paddingBottom: 14, gap: 5, paddingHorizontal: 24 },
  showTitle: { color: '#fff', fontSize: 23, fontWeight: '800' },
  showSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  showQ: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  castWrap: { flex: 1, paddingHorizontal: 20, gap: 11, justifyContent: 'center' },
  castRow: { height: 58, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  castFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { height: '100%' },
  castContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  castName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  castYou: { fontSize: 12, fontWeight: '700' },
  castOdds: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '800', marginRight: 10, fontVariant: ['tabular-nums'] },
  castPct: { color: '#fff', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  showFoot: { paddingHorizontal: 20, paddingTop: 6, gap: 10 },
  hint: { color: 'rgba(255,255,255,0.78)', fontSize: 14, textAlign: 'center', fontWeight: '700', paddingBottom: 8 },
  resultTxt: { fontSize: 15, textAlign: 'center', fontWeight: '800' },
});
