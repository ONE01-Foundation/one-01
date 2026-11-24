/**
 * PongGame — a REAL two-computer Pong match, wagered on virtual credits.
 *
 * One player taps "Create match" and reads out a 4-letter CODE; the other taps
 * "Join" and types it. They connect over Supabase Realtime (see pongNet.ts):
 * the host runs the authoritative physics and streams the ball + score ~25×/sec,
 * the guest streams its paddle back. First to 5 wins; the winner's wallet is
 * credited the pot (loser's stake was debited at the whistle). "Practice vs CPU"
 * works offline so the game is never dead. Still virtual — no crypto.
 *
 * Controls: drag anywhere on the table, or ↑/↓ (or W/S) on a keyboard.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Platform, useWindowDimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../utils/haptics';
import { type ShellTheme, type HomeItem } from '../../data/one01/platform';
import { useOne01PlatformStore } from '../../stores/one01PlatformStore';
import { hostRoom, guestJoin, makeCode, type PongRoom, type Role, type NetState } from '../../services/pongNet';

/* ── logical field: height = 1 unit, width = R units (uniform scale) ── */
const R = 1.6;
const FACE = 0.085;          // paddle centre distance from each wall
const LEFT_CX = FACE;
const RIGHT_CX = R - FACE;
const PAD_W = 0.028;         // paddle thickness
const PAD_H = 0.22;          // paddle length
const BALL_R = 0.022;
const SPEED0 = 0.95;         // serve speed (units/sec)
const SPEEDUP = 1.035;       // per paddle hit
const SPEED_MAX = 1.95;
const PAD_SPEED = 1.6;       // keyboard paddle speed (units/sec)
const CPU_SPEED = 1.15;
const TARGET = 5;
const SERVE_MS = 700;

type Phase = 'menu' | 'hostwait' | 'joinenter' | 'guestwait' | 'countdown' | 'play' | 'over';
type Mode = 'host' | 'guest' | 'cpu';

interface Geo { x: number; y: number; s: number; padW: number; padH: number; ball: number }

export function PongGame({ th, item, onClose }: { th: ShellTheme; item: HomeItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const grad: [string, string] = item.bg ?? ['#1E3A8A', '#0F1F4D'];
  const accent = th.accent;
  const accentFg = accent === '#F9D800' ? '#000' : '#fff';

  const balance = useOne01PlatformStore((s) => s.balance);
  const credit = useOne01PlatformStore((s) => s.credit);
  const debit = useOne01PlatformStore((s) => s.debit);

  const [phase, setPhase] = useState<Phase>('menu');
  const [wager, setWager] = useState(0);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [oppHere, setOppHere] = useState(false);
  const [count, setCount] = useState(3);
  const [sl, setSl] = useState(0);
  const [sr, setSr] = useState(0);
  const [over, setOver] = useState<{ win: boolean; delta: number; aborted?: boolean } | null>(null);
  const [status, setStatus] = useState('');

  /* ── geometry ── */
  const topBar = insets.top + 96;
  const botBar = insets.bottom + 64;
  const availW = width - 24;
  const availH = Math.max(120, height - topBar - botBar);
  const s = Math.max(40, Math.min(availH, availW / R));
  const fieldW = R * s;
  const geo: Geo = {
    x: (width - fieldW) / 2,
    y: topBar + (availH - s) / 2,
    s,
    padW: PAD_W * s,
    padH: PAD_H * s,
    ball: BALL_R * s,
  };
  const geoRef = useRef(geo);
  geoRef.current = geo;

  /* ── physics refs ── */
  const ball = useRef({ x: R / 2, y: 0.5, vx: 0, vy: 0 });
  const padL = useRef(0.5);        // host paddle centre
  const padR = useRef(0.5);        // guest paddle centre
  const padRTarget = useRef(0.5);  // smoothed remote/CPU paddle
  const padLTarget = useRef(0.5);
  const serveUntil = useRef(0);
  const lastLoser = useRef<Role>('guest');
  const keys = useRef({ up: false, down: false });

  const modeRef = useRef<Mode>('cpu');
  const roomRef = useRef<PongRoom | null>(null);
  const netRef = useRef<NetState | null>(null);
  const phaseRef = useRef<Phase>('menu');
  phaseRef.current = phase;
  const wagerRef = useRef(0);
  const stakedRef = useRef(0);
  const settledRef = useRef(false);
  const slRef = useRef(0);
  const srRef = useRef(0);

  /* ── animated render values ── */
  const ballXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lY = useRef(new Animated.Value(0)).current;
  const rY = useRef(new Animated.Value(0)).current;
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef(0);
  const netAcc = useRef(0);

  /* my paddle = left if host/cpu, right if guest */
  const myPad = () => (modeRef.current === 'guest' ? padR : padL);

  const paint = useCallback(() => {
    const g = geoRef.current;
    const b = ball.current;
    ballXY.setValue({ x: g.x + b.x * g.s - g.ball, y: g.y + b.y * g.s - g.ball });
    lY.setValue(g.y + padL.current * g.s - g.padH / 2);
    rY.setValue(g.y + padR.current * g.s - g.padH / 2);
  }, [ballXY, lY, rY]);

  const serve = (toward: Role) => {
    const b = ball.current;
    b.x = R / 2; b.y = 0.5; b.vx = 0; b.vy = 0;
    serveUntil.current = Date.now() + SERVE_MS;
    lastLoser.current = toward;
  };

  const clampPad = (v: number) => Math.max(PAD_H / 2, Math.min(1 - PAD_H / 2, v));

  const finish = useCallback((winnerIsMe: boolean, aborted = false) => {
    if (settledRef.current) return;
    settledRef.current = true;
    let delta = 0;
    if (aborted) {
      if (stakedRef.current > 0) { credit(stakedRef.current, 'Pong — match cancelled, stake back'); }
      delta = 0;
    } else if (winnerIsMe) {
      if (wagerRef.current > 0) { credit(wagerRef.current * 2, 'Pong — match won'); delta = wagerRef.current; }
      else { credit(25, 'Pong — win bonus'); delta = 25; }
    } else {
      delta = wagerRef.current > 0 ? -stakedRef.current : 0;
    }
    haptic[winnerIsMe && !aborted ? 'success' : 'warning']();
    setOver({ win: winnerIsMe, delta, aborted });
    setPhase('over');
  }, [credit]);

  /* ── main loop ── */
  const loop = useCallback((ts: number) => {
    const g = geoRef.current;
    const dt = Math.min(0.034, lastTs.current ? (ts - lastTs.current) / 1000 : 0.016);
    lastTs.current = ts;
    const ph = phaseRef.current;
    const mode = modeRef.current;

    if (ph === 'play' || ph === 'countdown') {
      // my paddle from keyboard (drag handled by PanResponder directly)
      const mv = (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0);
      if (mv !== 0) { const p = myPad(); p.current = clampPad(p.current + mv * PAD_SPEED * dt); }

      if (mode === 'guest') {
        // render authoritative state from host (lerp for smoothness)
        const n = netRef.current;
        if (n) {
          ball.current.x += (n.bx - ball.current.x) * 0.5;
          ball.current.y += (n.by - ball.current.y) * 0.5;
          padL.current += (n.ly - padL.current) * 0.5;
          if (n.sl !== slRef.current) { slRef.current = n.sl; setSl(n.sl); }
          if (n.sr !== srRef.current) { srRef.current = n.sr; setSr(n.sr); }
        }
        // send my paddle up
        netAcc.current += dt;
        if (netAcc.current >= 0.04) { netAcc.current = 0; roomRef.current?.sendPaddle(padR.current); }
      } else {
        // HOST / CPU authoritative physics
        // opponent paddle: CPU tracks ball; guest paddle comes from net (smoothed)
        if (mode === 'cpu') {
          const diff = ball.current.y - padR.current;
          padR.current = clampPad(padR.current + Math.sign(diff) * Math.min(Math.abs(diff), CPU_SPEED * dt));
        } else {
          padR.current += (padRTarget.current - padR.current) * 0.5;
        }

        if (ph === 'play') {
          const b = ball.current;
          if (Date.now() >= serveUntil.current) {
            if (b.vx === 0 && b.vy === 0) {
              const dir = lastLoser.current === 'host' ? -1 : 1; // serve toward the one who was scored on
              b.vx = dir * SPEED0;
              b.vy = (Math.random() - 0.5) * SPEED0 * 0.7;
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            // walls
            if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
            else if (b.y > 1 - BALL_R) { b.y = 1 - BALL_R; b.vy = -Math.abs(b.vy); }
            // left paddle
            if (b.vx < 0 && b.x - BALL_R <= LEFT_CX + PAD_W / 2 && b.x > LEFT_CX) {
              if (Math.abs(b.y - padL.current) <= PAD_H / 2 + BALL_R) {
                b.x = LEFT_CX + PAD_W / 2 + BALL_R;
                b.vx = Math.min(SPEED_MAX, Math.abs(b.vx) * SPEEDUP);
                b.vy += (b.y - padL.current) * 2.2;
              }
            }
            // right paddle
            if (b.vx > 0 && b.x + BALL_R >= RIGHT_CX - PAD_W / 2 && b.x < RIGHT_CX) {
              if (Math.abs(b.y - padR.current) <= PAD_H / 2 + BALL_R) {
                b.x = RIGHT_CX - PAD_W / 2 - BALL_R;
                b.vx = -Math.min(SPEED_MAX, Math.abs(b.vx) * SPEEDUP);
                b.vy += (b.y - padR.current) * 2.2;
              }
            }
            // score
            if (b.x < -0.03) { srRef.current += 1; setSr(srRef.current); onPoint('guest'); }
            else if (b.x > R + 0.03) { slRef.current += 1; setSl(slRef.current); onPoint('host'); }
          }
          // stream state
          netAcc.current += dt;
          if (mode === 'host' && netAcc.current >= 0.04) {
            netAcc.current = 0;
            roomRef.current?.sendState({ bx: b.x, by: b.y, ly: padL.current, ry: padR.current, sl: slRef.current, sr: srRef.current, p: 'play' });
          }
        }
      }
    }

    paint();
    rafRef.current = requestAnimationFrame(loop);
  }, [paint]);

  const onPoint = (scorer: Role) => {
    haptic.tap();
    if (slRef.current >= TARGET || srRef.current >= TARGET) {
      const winner: Role = slRef.current > srRef.current ? 'host' : 'guest';
      const b = ball.current; b.vx = 0; b.vy = 0;
      if (modeRef.current === 'host') {
        roomRef.current?.sendState({ bx: b.x, by: b.y, ly: padL.current, ry: padR.current, sl: slRef.current, sr: srRef.current, p: 'over' });
        roomRef.current?.sendEnd({ winner, sl: slRef.current, sr: srRef.current });
      }
      const meIsHost = modeRef.current !== 'guest';
      finish(meIsHost ? winner === 'host' : winner === 'guest');
    } else {
      serve(scorer); // serve toward whoever was just scored on
    }
  };

  /* start the rAF loop once, tear down on unmount */
  useEffect(() => {
    padL.current = 0.5; padR.current = 0.5; paint();
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); roomRef.current?.leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keyboard (web) */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') { keys.current.up = true; e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { keys.current.down = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') keys.current.up = false;
      else if (k === 'arrowdown' || k === 's') keys.current.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /* drag to move my paddle */
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => dragTo(e.nativeEvent.pageY),
      onPanResponderMove: (e) => dragTo(e.nativeEvent.pageY),
    }),
  ).current;
  const dragTo = (pageY: number) => {
    const g = geoRef.current;
    const uy = (pageY - g.y) / g.s;
    myPad().current = clampPad(uy);
  };

  /* countdown → play */
  const beginCountdown = () => {
    settledRef.current = false;
    slRef.current = 0; srRef.current = 0; setSl(0); setSr(0);
    ball.current = { x: R / 2, y: 0.5, vx: 0, vy: 0 };
    padL.current = 0.5; padR.current = 0.5; paint();
    setCount(3); setPhase('countdown');
  };
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      serve(Math.random() < 0.5 ? 'host' : 'guest');
      setPhase('play');
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count]);

  /* ── networking actions ── */
  const stake = () => {
    wagerRef.current = wager;
    if (wager > 0) stakedRef.current = debit(wager, 'Pong — match stake') ? wager : 0;
    else stakedRef.current = 0;
  };

  const startCpu = () => {
    modeRef.current = 'cpu';
    wagerRef.current = wager; stake();
    beginCountdown();
  };

  const createMatch = async () => {
    const c = makeCode();
    setCode(c); setStatus('Connecting…'); setOppHere(false); setPhase('hostwait');
    const room = await hostRoom(c, {
      onOpponent: (p) => {
        setOppHere(p);
        if (!p && (phaseRef.current === 'play' || phaseRef.current === 'countdown')) finish(false, true);
      },
      onPaddle: (y) => { padRTarget.current = y; },
      onEnd: () => {},
    });
    if (!room) { setStatus('Could not open an online room. Try Practice vs CPU.'); setPhase('menu'); return; }
    roomRef.current = room; modeRef.current = 'host'; setStatus('');
  };

  const startAsHost = () => {
    if (!roomRef.current || !oppHere) return;
    const seed = Math.random();
    wagerRef.current = wager; stake();
    roomRef.current.sendStart({ wager, seed });
    beginCountdown();
  };

  const joinMatch = async () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length < 4) { setStatus('Enter the 4-letter code'); return; }
    setStatus('Connecting…'); setPhase('guestwait'); setCode(c);
    const room = await guestJoin(c, {
      onOpponent: (p) => {
        setOppHere(p);
        if (!p && (phaseRef.current === 'play' || phaseRef.current === 'countdown')) finish(false, true);
      },
      onState: (n) => {
        netRef.current = n;
        if (n.p === 'over' && phaseRef.current !== 'over') {
          slRef.current = n.sl; srRef.current = n.sr; setSl(n.sl); setSr(n.sr);
          finish(n.sl < n.sr); // guest wins if right score higher
        }
      },
      onStart: (cfg) => {
        setWager(cfg.wager); wagerRef.current = cfg.wager;
        if (cfg.wager > 0) stakedRef.current = debit(cfg.wager, 'Pong — match stake') ? cfg.wager : 0;
        else stakedRef.current = 0;
        modeRef.current = 'guest';
        beginCountdown();
      },
      onEnd: (e) => {
        if (phaseRef.current !== 'over') {
          slRef.current = e.sl; srRef.current = e.sr; setSl(e.sl); setSr(e.sr);
          finish(e.winner === 'guest');
        }
      },
    });
    if (!room) { setStatus('No room with that code (or offline). Check the code or try Practice.'); setPhase('joinenter'); return; }
    roomRef.current = room; modeRef.current = 'guest'; setStatus(oppHere ? '' : 'Waiting for host to start…');
  };

  const exit = () => { roomRef.current?.leave(); roomRef.current = null; onClose(); };
  const backToMenu = () => {
    roomRef.current?.leave(); roomRef.current = null; netRef.current = null;
    settledRef.current = false; setOver(null); setOppHere(false); setStatus('');
    setPhase('menu');
  };

  /* ── layout values ── */
  const leftPadLeft = geo.x + LEFT_CX * geo.s - geo.padW / 2;
  const rightPadLeft = geo.x + RIGHT_CX * geo.s - geo.padW / 2;
  const iAmLeft = modeRef.current !== 'guest';
  const showField = phase === 'play' || phase === 'countdown' || phase === 'over';

  const stakeChips = [0, 50, 100, 250];

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      {/* top bar */}
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={exit} hitSlop={12} style={styles.close}><Text style={styles.closeTxt}>✕</Text></Pressable>
        <View style={styles.flex} />
        {showField && (
          <View style={styles.scoreWrap}>
            <Text style={[styles.score, iAmLeft && { color: accent }]}>{sl}</Text>
            <Text style={styles.scoreDash}>:</Text>
            <Text style={[styles.score, !iAmLeft && { color: accent }]}>{sr}</Text>
          </View>
        )}
        <View style={styles.flex} />
        {showField && wagerRef.current > 0 && <View style={styles.pot}><Text style={styles.potTxt}>⟡{wagerRef.current * 2}</Text></View>}
        {showField && wagerRef.current === 0 && <View style={{ width: 38 }} />}
      </View>

      {/* ── the table ── */}
      {showField && (
        <View style={styles.flex} {...pan.panHandlers}>
          {/* net */}
          <View style={[styles.net, { left: geo.x + fieldW / 2 - 1, top: geo.y, height: geo.s }]} />
          {/* frame */}
          <View style={[styles.frame, { left: geo.x, top: geo.y, width: fieldW, height: geo.s }]} />
          {/* paddles */}
          <Animated.View style={[styles.paddle, { left: leftPadLeft, width: geo.padW, height: geo.padH, backgroundColor: iAmLeft ? accent : '#fff', transform: [{ translateY: lY }] }]} />
          <Animated.View style={[styles.paddle, { left: rightPadLeft, width: geo.padW, height: geo.padH, backgroundColor: !iAmLeft ? accent : '#fff', transform: [{ translateY: rY }] }]} />
          {/* ball */}
          <Animated.View style={[styles.ball, { width: geo.ball * 2, height: geo.ball * 2, borderRadius: geo.ball, transform: ballXY.getTranslateTransform() }]} />
          {/* side labels */}
          <Text style={[styles.sideLbl, { left: geo.x + 10, top: geo.y + 8, color: iAmLeft ? accent : 'rgba(255,255,255,0.5)' }]}>{iAmLeft ? 'YOU' : 'OPP'}</Text>
          <Text style={[styles.sideLbl, { left: geo.x + fieldW - 44, top: geo.y + 8, color: !iAmLeft ? accent : 'rgba(255,255,255,0.5)' }]}>{!iAmLeft ? 'YOU' : 'OPP'}</Text>

          {phase === 'countdown' && (
            <View style={styles.countWrap} pointerEvents="none"><Text style={styles.count}>{count > 0 ? count : 'GO'}</Text></View>
          )}
          {phase === 'play' && (
            <Text style={[styles.hint, { bottom: insets.bottom + 18 }]}>Drag the table or use ↑ ↓ / W S</Text>
          )}
        </View>
      )}

      {/* ── menu ── */}
      {phase === 'menu' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 60 }}>🏓</Text>
          <Text style={styles.bigTitle}>Pong · 1-v-1</Text>
          <Text style={styles.sub}>Play a friend on another computer. First to {TARGET} wins the pot — loser pays the stake.</Text>

          <Text style={styles.stakeLbl}>Wager</Text>
          <View style={styles.chipRow}>
            {stakeChips.map((v) => {
              const on = v === wager; const dis = v > balance;
              return (
                <Pressable key={v} disabled={dis} onPress={() => { haptic.select(); setWager(v); }} style={[styles.chip, { borderColor: on ? accent : 'rgba(255,255,255,0.18)', backgroundColor: on ? accent : 'rgba(255,255,255,0.06)' }, dis && { opacity: 0.3 }]}>
                  <Text style={[styles.chipTxt, { color: on ? accentFg : '#fff' }]}>{v === 0 ? 'Free' : `⟡${v}`}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.balLine}>Balance ⟡{balance.toLocaleString()}{wager === 0 ? ' · winner gets ⟡25' : ` · winner gets ⟡${wager * 2}`}</Text>

          <Pressable onPress={createMatch} style={[styles.cta, styles.full, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Create match</Text></Pressable>
          <Pressable onPress={() => { setStatus(''); setPhase('joinenter'); }} style={[styles.ctaGhost, styles.full]}><Text style={styles.ctaGhostTxt}>Join with a code</Text></Pressable>
          <Pressable onPress={startCpu} style={styles.linkBtn}><Text style={styles.linkTxt}>or practice vs CPU →</Text></Pressable>
          {!!status && <Text style={styles.err}>{status}</Text>}
        </View>
      )}

      {/* ── host waiting ── */}
      {phase === 'hostwait' && (
        <View style={styles.center}>
          <Text style={styles.stakeLbl}>Your match code</Text>
          <Text style={[styles.codeBig, { color: accent }]}>{code}</Text>
          <Text style={styles.sub}>Open ONE01 on the other computer → Pong → “Join with a code” and type this.</Text>
          <View style={[styles.oppPill, { borderColor: oppHere ? '#4ade80' : 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.dot, { backgroundColor: oppHere ? '#4ade80' : 'rgba(255,255,255,0.4)' }]} />
            <Text style={styles.oppTxt}>{oppHere ? 'Opponent connected' : (status || 'Waiting for opponent…')}</Text>
          </View>
          <Pressable disabled={!oppHere} onPress={startAsHost} style={[styles.cta, styles.full, { backgroundColor: oppHere ? accent : 'rgba(255,255,255,0.14)' }]}>
            <Text style={[styles.ctaTxt, { color: oppHere ? accentFg : 'rgba(255,255,255,0.5)' }]}>{wager > 0 ? `Start · stake ⟡${wager}` : 'Start match'}</Text>
          </Pressable>
          <Pressable onPress={backToMenu} style={styles.linkBtn}><Text style={styles.linkTxt}>← back</Text></Pressable>
        </View>
      )}

      {/* ── join: enter code ── */}
      {phase === 'joinenter' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🔑</Text>
          <Text style={styles.bigTitle}>Join a match</Text>
          <TextInput
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
            autoCapitalize="characters" autoCorrect={false} placeholder="CODE" placeholderTextColor="rgba(255,255,255,0.3)"
            style={[styles.codeInput, { borderColor: accent }]} maxLength={4}
          />
          <Pressable onPress={joinMatch} style={[styles.cta, styles.full, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>Connect</Text></Pressable>
          <Pressable onPress={backToMenu} style={styles.linkBtn}><Text style={styles.linkTxt}>← back</Text></Pressable>
          {!!status && <Text style={styles.err}>{status}</Text>}
        </View>
      )}

      {/* ── guest waiting for host start ── */}
      {phase === 'guestwait' && (
        <View style={styles.center}>
          <Text style={styles.stakeLbl}>Joined room</Text>
          <Text style={[styles.codeBig, { color: accent }]}>{code}</Text>
          <View style={[styles.oppPill, { borderColor: oppHere ? '#4ade80' : 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.dot, { backgroundColor: oppHere ? '#4ade80' : 'rgba(255,255,255,0.4)' }]} />
            <Text style={styles.oppTxt}>{status || (oppHere ? 'Waiting for host to start…' : 'Connecting…')}</Text>
          </View>
          <Pressable onPress={backToMenu} style={styles.linkBtn}><Text style={styles.linkTxt}>← back</Text></Pressable>
        </View>
      )}

      {/* ── result ── */}
      {phase === 'over' && over && (
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.overCard}>
            <Text style={{ fontSize: 54 }}>{over.aborted ? '🚪' : over.win ? '🏆' : '💥'}</Text>
            <Text style={styles.bigTitle}>{over.aborted ? 'Opponent left' : over.win ? 'You win!' : 'You lose'}</Text>
            <Text style={styles.scoreLine}>{sl} <Text style={{ color: 'rgba(255,255,255,0.5)' }}>–</Text> {sr}</Text>
            <Text style={[styles.deltaTxt, { color: over.delta > 0 ? '#4ade80' : over.delta < 0 ? '#f87171' : 'rgba(255,255,255,0.75)' }]}>
              {over.aborted ? (stakedRef.current > 0 ? 'Stake returned' : 'No stake') : over.delta > 0 ? `+⟡${over.delta} to your wallet` : over.delta < 0 ? `−⟡${-over.delta} lost` : 'Good game'}
            </Text>
            <View style={styles.doneRow}>
              <Pressable onPress={backToMenu} style={[styles.cta, { backgroundColor: accent }]}><Text style={[styles.ctaTxt, { color: accentFg }]}>New match</Text></Pressable>
              <Pressable onPress={exit} style={[styles.ctaGhost, { borderColor: 'rgba(255,255,255,0.3)' }]}><Text style={styles.ctaGhostTxt}>Done</Text></Pressable>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },

  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  score: { color: '#fff', fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'center' },
  scoreDash: { color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: '800' },
  pot: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  potTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

  frame: { position: 'absolute', borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)' },
  net: { position: 'absolute', width: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  paddle: { position: 'absolute', top: 0, borderRadius: 6, shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 6 },
  ball: { position: 'absolute', top: 0, left: 0, backgroundColor: '#fff', shadowColor: '#fff', shadowOpacity: 0.7, shadowRadius: 10, elevation: 6 },
  sideLbl: { position: 'absolute', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  countWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#fff', fontSize: 84, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 12 },
  hint: { position: 'absolute', alignSelf: 'center', color: 'rgba(255,255,255,0.65)', fontSize: 12.5, fontWeight: '700', left: 0, right: 0, textAlign: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 8 },
  bigTitle: { color: '#fff', fontSize: 27, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 2 },
  stakeLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 10 },
  balLine: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },

  codeBig: { fontSize: 52, fontWeight: '900', letterSpacing: 8, marginVertical: 4 },
  codeInput: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 10, textAlign: 'center', borderBottomWidth: 3, paddingVertical: 8, minWidth: 200, marginVertical: 10 },
  oppPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  oppTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },

  cta: { borderRadius: 999, paddingHorizontal: 30, paddingVertical: 14, marginTop: 14, alignItems: 'center' },
  ctaGhost: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', marginTop: 12, alignItems: 'center' },
  full: { alignSelf: 'stretch' },
  ctaTxt: { fontSize: 16, fontWeight: '800' },
  ctaGhostTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 14, padding: 6 },
  linkTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  err: { color: '#fca5a5', fontSize: 13, fontWeight: '700', marginTop: 12, textAlign: 'center' },

  chipRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, minWidth: 62, alignItems: 'center' },
  chipTxt: { fontSize: 14, fontWeight: '800' },

  overCard: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 26, paddingHorizontal: 30, paddingVertical: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  scoreLine: { color: '#fff', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  deltaTxt: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  doneRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
});
