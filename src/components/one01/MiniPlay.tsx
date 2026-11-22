/**
 * MiniPlay — small but genuinely interactive experiences launched from a detail
 * page's Play / Watch button:
 *   • MiniGame — a timed tap-the-target reaction game (score → virtual payout).
 *   • MiniShow — an interactive "live" show: vote for a contestant and watch the
 *     results bars move in real time before the timer runs out.
 * Both are full-screen, themed by the current product, with a ✕ to exit.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../utils/haptics';
import { type ShellTheme, type HomeItem } from '../../data/one01/platform';

export type PlayKind = 'game' | 'show';

export function MiniPlayer({ kind, th, item, onClose }: { kind: PlayKind; th: ShellTheme; item: HomeItem; onClose: () => void }) {
  return kind === 'game' ? <MiniGame th={th} item={item} onClose={onClose} /> : <MiniShow th={th} item={item} onClose={onClose} />;
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
      <Text style={styles.closeTxt}>✕</Text>
    </Pressable>
  );
}

/* ─────────────────────────────── MiniGame ─────────────────────────────── */

function MiniGame({ th, item, onClose }: { th: ShellTheme; item: HomeItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const grad: [string, string] = item.bg ?? [`${th.glow}`, '#0a0a0a'];
  const accent = th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';

  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(15);
  const [pos, setPos] = useState({ x: width / 2 - 36, y: height / 2 - 36 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const topSafe = insets.top + 70;
  const botSafe = insets.bottom + 90;
  const move = () => {
    const x = 24 + Math.random() * Math.max(1, width - 24 - 96);
    const y = topSafe + Math.random() * Math.max(1, height - topSafe - botSafe - 96);
    setPos({ x, y });
  };

  const start = () => {
    haptic.press();
    setScore(0); setTime(15); setPhase('play'); move();
  };

  useEffect(() => {
    if (phase !== 'play') return;
    timer.current = setInterval(() => {
      setTime((t) => t - 1);
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'play' && time <= 0) { setPhase('done'); haptic.success(); }
  }, [time, phase]);

  const hit = () => { haptic.tap(); setScore((s) => s + 1); move(); };

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <CloseBtn onClose={onClose} />
        <View style={styles.flex} />
        {phase === 'play' && (
          <>
            <View style={styles.hud}><Text style={styles.hudTxt}>★ {score}</Text></View>
            <View style={[styles.hud, { marginLeft: 8 }]}><Text style={styles.hudTxt}>⏱ 0:{time < 10 ? `0${time}` : time}</Text></View>
          </>
        )}
      </View>

      {phase === 'play' && (
        <Pressable onPress={hit} style={[styles.target, { left: pos.x, top: pos.y, backgroundColor: accent, shadowColor: accent }]}>
          <Text style={{ fontSize: 34 }}>{item.emoji}</Text>
        </Pressable>
      )}

      {phase !== 'play' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 68 }}>{item.emoji}</Text>
          {phase === 'ready' ? (
            <>
              <Text style={styles.bigTitle}>{item.title}</Text>
              <Text style={styles.sub}>Tap the {item.emoji} as fast as you can — 15 seconds on the clock.</Text>
              <Pressable onPress={start} style={[styles.cta, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Start</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bigTitle}>Time!</Text>
              <Text style={styles.score}>{score}</Text>
              <Text style={styles.sub}>You won ⟡ {score * 2} to your Winzi wallet.</Text>
              <View style={styles.doneRow}>
                <Pressable onPress={start} style={[styles.cta, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Play again</Text></Pressable>
                <Pressable onPress={onClose} style={[styles.ctaGhost, { borderColor: 'rgba(255,255,255,0.3)' }]}><Text style={styles.ctaGhostTxt}>Done</Text></Pressable>
              </View>
            </>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

/* ─────────────────────────────── MiniShow ─────────────────────────────── */

type Contestant = { id: string; emoji: string; name: string; pct: number };

function MiniShow({ th, item, onClose }: { th: ShellTheme; item: HomeItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const grad: [string, string] = item.bg ?? [`${th.glow}`, '#0a0a0a'];
  const accent = th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';

  const [cast, setCast] = useState<Contestant[]>([
    { id: 'a', emoji: '🧑‍🎤', name: 'Remy', pct: 28 },
    { id: 'b', emoji: '👩‍🎤', name: 'Nalee', pct: 34 },
    { id: 'c', emoji: '🧑‍🎨', name: 'Kофi', pct: 21 },
    { id: 'd', emoji: '👨‍🚀', name: 'Vex', pct: 17 },
  ]);
  const [voted, setVoted] = useState<string | null>(null);
  const [time, setTime] = useState(20);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTime((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (time <= 0 && !done) { setDone(true); haptic.success(); }
  }, [time, done]);

  // crowd drifts a little each tick so the bars feel live
  useEffect(() => {
    if (done) return;
    const d = setInterval(() => {
      setCast((prev) => {
        const nudged = prev.map((c) => ({ ...c, pct: Math.max(4, c.pct + (Math.random() * 2 - 1)) }));
        const sum = nudged.reduce((a, c) => a + c.pct, 0);
        return nudged.map((c) => ({ ...c, pct: (c.pct / sum) * 100 }));
      });
    }, 1400);
    return () => clearInterval(d);
  }, [done]);

  const vote = (id: string) => {
    if (voted || done) return;
    haptic.press();
    setVoted(id);
    setCast((prev) => {
      const bumped = prev.map((c) => ({ ...c, pct: c.id === id ? c.pct + 12 : c.pct }));
      const sum = bumped.reduce((a, c) => a + c.pct, 0);
      return bumped.map((c) => ({ ...c, pct: (c.pct / sum) * 100 }));
    });
  };

  const leader = [...cast].sort((a, b) => b.pct - a.pct)[0];

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <CloseBtn onClose={onClose} />
        <View style={styles.flex} />
        <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveTxt}>LIVE · {item.metric}</Text></View>
      </View>

      <View style={styles.showStage}>
        <Text style={{ fontSize: 54 }}>{item.emoji}</Text>
        <Text style={styles.showTitle}>{item.title}</Text>
        <Text style={styles.showSub}>{done ? 'Voting closed' : `Episode 4 · voting closes 0:${time < 10 ? `0${time}` : time}`}</Text>
        <Text style={[styles.showQ, { color: accent }]}>{done ? `${leader.name} is safe tonight` : 'Who survives tonight?'}</Text>
      </View>

      <View style={styles.castWrap}>
        {cast.map((c) => {
          const isVote = voted === c.id;
          const isLead = done && leader.id === c.id;
          return (
            <Pressable key={c.id} onPress={() => vote(c.id)} disabled={!!voted || done} style={[styles.castRow, { borderColor: isVote || isLead ? accent : 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.28)' }]}>
              <View style={styles.castFill}>
                <View style={[styles.fill, { width: `${Math.round(c.pct)}%`, backgroundColor: isVote || isLead ? accent : 'rgba(255,255,255,0.14)' }]} />
              </View>
              <View style={styles.castContent}>
                <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                <Text style={styles.castName}>{c.name}</Text>
                {isVote ? <Text style={[styles.castYou, { color: accent }]}>your vote</Text> : null}
                <View style={styles.flex} />
                <Text style={styles.castPct}>{Math.round(c.pct)}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
        {done ? (
          <Pressable onPress={onClose} style={[styles.cta, styles.full, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Back to MixStar</Text></Pressable>
        ) : (
          <Text style={styles.hint}>{voted ? 'Vote cast — watch the room move.' : 'Tap a contestant to cast your vote.'}</Text>
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
  hudTxt: { color: '#fff', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },

  target: { position: 'absolute', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  bigTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 10 },
  score: { color: '#fff', fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  cta: { borderRadius: 999, paddingHorizontal: 30, paddingVertical: 13, marginTop: 14 },
  full: { alignItems: 'center' },
  ctaTxt: { fontSize: 16, fontWeight: '800' },
  ctaGhost: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13, borderWidth: 1.5, marginTop: 14 },
  ctaGhostTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },

  /* show */
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef2d56', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  showStage: { alignItems: 'center', paddingTop: 20, paddingBottom: 18, gap: 6, paddingHorizontal: 24 },
  showTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  showSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  showQ: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  castWrap: { flex: 1, paddingHorizontal: 20, gap: 12, justifyContent: 'center' },
  castRow: { height: 60, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center' },
  castFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { height: '100%' },
  castContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  castName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  castYou: { fontSize: 12, fontWeight: '700' },
  castPct: { color: '#fff', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { color: 'rgba(255,255,255,0.72)', fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
