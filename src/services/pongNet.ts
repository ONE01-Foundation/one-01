/**
 * pongNet — real-time transport for a two-computer Pong match.
 *
 * Uses Supabase Realtime BROADCAST (no table, no RLS, anon-safe) as a thin
 * message relay between exactly two players who share a short room CODE:
 *   • HOST  (creator, left paddle)  — runs the authoritative physics and
 *     broadcasts the ball + its paddle + the score ~25×/sec.
 *   • GUEST (joiner, right paddle)  — sends its paddle up and renders whatever
 *     the host sends.
 * Presence tells each side when the opponent arrives or leaves. Everything
 * degrades safely: if Supabase isn't reachable the factory returns null and the
 * UI falls back to practice-vs-CPU.
 *
 * Pure transport — no React, no game logic here. Same project/anon key the rest
 * of the app already uses (src/services/supabaseService.ts).
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';

function client(): SupabaseClient | null {
  let c = supabaseService.getClient();
  if (!c) {
    supabaseService.initialize();
    c = supabaseService.getClient();
  }
  return c;
}

export type Role = 'host' | 'guest';

/** Authoritative snapshot the host broadcasts (normalised units — see PongGame). */
export interface NetState {
  bx: number; by: number; // ball centre
  ly: number; ry: number; // paddle centres
  sl: number; sr: number; // scores (left/host, right/guest)
  p: 'serve' | 'play' | 'over';
}

export interface StartCfg { wager: number; seed: number }
export interface EndMsg { winner: Role; sl: number; sr: number }

export interface PongHandlers {
  /** Opponent joined (true) or left (false). */
  onOpponent?: (present: boolean) => void;
  /** GUEST: a fresh authoritative frame from the host. */
  onState?: (s: NetState) => void;
  /** HOST: the guest's latest paddle centre. */
  onPaddle?: (y: number) => void;
  /** GUEST: host pressed start — stake + serve seed. */
  onStart?: (cfg: StartCfg) => void;
  /** GUEST: host declared the match over. */
  onEnd?: (e: EndMsg) => void;
}

export interface PongRoom {
  code: string;
  role: Role;
  sendState: (s: NetState) => void;
  sendPaddle: (y: number) => void;
  sendStart: (cfg: StartCfg) => void;
  sendEnd: (e: EndMsg) => void;
  leave: () => void;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
export function makeCode(len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

async function connect(code: string, role: Role, h: PongHandlers): Promise<PongRoom | null> {
  const c = client();
  if (!c) return null;
  const topic = `pong:${code.toUpperCase()}`;
  const me = `${role}-${Math.random().toString(36).slice(2, 8)}`;

  const channel: RealtimeChannel = c.channel(topic, {
    config: { broadcast: { self: false, ack: false }, presence: { key: me } },
  });

  channel.on('broadcast', { event: 'state' }, ({ payload }) => h.onState?.(payload as NetState));
  channel.on('broadcast', { event: 'paddle' }, ({ payload }) => h.onPaddle?.((payload as { y: number }).y));
  channel.on('broadcast', { event: 'start' }, ({ payload }) => h.onStart?.(payload as StartCfg));
  channel.on('broadcast', { event: 'end' }, ({ payload }) => h.onEnd?.(payload as EndMsg));

  // presence: opponent is anyone in the room who isn't me
  const others = () => {
    const state = channel.presenceState();
    return Object.keys(state).filter((k) => k !== me).length;
  };
  channel.on('presence', { event: 'sync' }, () => h.onOpponent?.(others() > 0));
  channel.on('presence', { event: 'join' }, () => h.onOpponent?.(others() > 0));
  channel.on('presence', { event: 'leave' }, () => h.onOpponent?.(others() > 0));

  const ok = await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done(false), 8000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ role, at: Date.now() }).catch(() => {});
        clearTimeout(timer);
        done(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        done(false);
      }
    });
  });

  if (!ok) {
    try { await c.removeChannel(channel); } catch { /* ignore */ }
    return null;
  }

  const send = (event: string, payload: unknown) => {
    channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  };

  return {
    code: code.toUpperCase(),
    role,
    sendState: (s) => send('state', s),
    sendPaddle: (y) => send('paddle', { y }),
    sendStart: (cfg) => send('start', cfg),
    sendEnd: (e) => send('end', e),
    leave: () => { try { c.removeChannel(channel); } catch { /* ignore */ } },
  };
}

/** Create a room and wait for a guest. `code` from makeCode(). */
export function hostRoom(code: string, h: PongHandlers): Promise<PongRoom | null> {
  return connect(code, 'host', h);
}

/** Join an existing room by its code. */
export function guestJoin(code: string, h: PongHandlers): Promise<PongRoom | null> {
  return connect(code, 'guest', h);
}
