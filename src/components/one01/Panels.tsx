/**
 * Panels — the Profile and Wallet surfaces, plus the SheetWindow wrapper that
 * presents them as a bottom sheet on phones (slide up, drag the handle to close,
 * fading scrim) and a centered window on desktop (fade + scale). Both close
 * through a managed exit animation.
 *   • ProfilePage — a social-network style profile (cover, avatar, stats, about,
 *     account actions).
 *   • WalletPage — a crypto-wallet style balance (card, actions, holdings,
 *     activity) — all virtual, no real crypto.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Modal, Animated, PanResponder, Switch,
  useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import {
  One01Mark, OneMark, WinziMark, MixStarMark, XitMark, SodexMark, UserIcon, CreateIcon,
} from './brand';
import { type ShellTheme, type MarkId } from '../../data/one01/platform';
import { useOne01PlatformStore, livePrice } from '../../stores/one01PlatformStore';

const PROJ_META: Record<string, { name: string; mark: MarkId }> = {
  winzi: { name: 'Winzi', mark: 'winzi' },
  mixstar: { name: 'MixStar', mark: 'mixstar' },
  xit: { name: 'Xit', mark: 'xit' },
  sodex: { name: 'Sodex', mark: 'sodex' },
  one: { name: 'ONE', mark: 'one' },
};

const DARK_TILE = '#131317';

function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Mini area sparkline from a fixed mock series (trending up). */
function Sparkline({ color, w = 300, h = 46 }: { color: string; w?: number; h?: number }) {
  const data = [8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min)) * (h - 8) - 4] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={area} fill={color} opacity={0.18} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function Mark({ mark, size }: { mark: MarkId; size: number }) {
  switch (mark) {
    case 'one': return <OneMark size={size} color="#FFFFFF" eye="#0A0A0A" />;
    case 'winzi': return <WinziMark size={size} />;
    case 'mixstar': return <MixStarMark size={size} />;
    case 'xit': return <XitMark size={size} />;
    case 'sodex': return <SodexMark size={size} color="#FFFFFF" />;
    case 'one01': default: return <One01Mark size={size} color="#FFFFFF" />;
  }
}

/* ─────────────────────────────── SheetWindow ─────────────────────────────── */

export function SheetWindow({ visible, wide, th, onClose, children }: { visible: boolean; wide: boolean; th: ShellTheme; onClose: () => void; children: (close: () => void, onScroll: ScrollHandler) => React.ReactNode }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const prog = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);

  useEffect(() => {
    if (!visible) return;
    prog.setValue(0); drag.setValue(0); scrollY.current = 0;
    Animated.spring(prog, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
  }, [visible, prog, drag]);

  const requestClose = () => Animated.timing(prog, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onClose());
  const onScroll: ScrollHandler = (e) => { scrollY.current = e.nativeEvent.contentOffset.y; };

  const sheetTop = insets.top + 54;
  const sheetH = winH - sheetTop;

  // drag down to dismiss from anywhere on the sheet — once the content is scrolled to the top
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5 && scrollY.current <= 2,
      onPanResponderMove: (_, g) => { if (g.dy > 0) drag.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) requestClose();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const scrimOpacity = prog.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.flex}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: scrimOpacity }]} pointerEvents="none" />
        </Pressable>

        {wide ? (
          <View style={styles.winCenter} pointerEvents="box-none">
            <Animated.View style={[styles.window, { backgroundColor: th.bg, borderColor: th.border, opacity: prog, transform: [{ scale: prog.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
              {children(requestClose, onScroll)}
            </Animated.View>
          </View>
        ) : (
          <Animated.View {...pan.panHandlers} style={[styles.sheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: Animated.add(prog.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }), drag) }] }]}>
            <View style={styles.drag}><View style={[styles.grab, { backgroundColor: th.border }]} /></View>
            {children(requestClose, onScroll)}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

function PanelHead({ th, title, onClose, right }: { th: ShellTheme; title: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <Pressable onPress={onClose} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Text style={[styles.x, { color: th.text }]}>✕</Text>
      </Pressable>
      <Text style={[styles.headTitle, { color: th.text }]}>{title}</Text>
      <View style={styles.flex} />
      {right}
    </View>
  );
}

/* ─────────────────────────────── ProfilePage ─────────────────────────────── */

export function ProfilePage({ th, close, onExit, onCreate, onOne01, onSettings, onScroll }: { th: ShellTheme; close: () => void; onExit: () => void; onCreate: () => void; onOne01?: () => void; onSettings: () => void; onScroll?: ScrollHandler }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'posts' | 'about'>('posts');
  const stats = [{ v: '128', l: 'Friends' }, { v: '12', l: 'Posts' }, { v: 'LVL 13', l: 'Level' }];
  const posts = [
    { id: 'p1', time: '2h', text: 'Started a process: renew my driving license 🪪', chip: 'Process', accent: th.accent },
    { id: 'p2', time: '1d', text: 'Reached a provider through ONE — only my city and budget were shared.', chip: 'ONE', accent: '#10B981' },
    { id: 'p3', time: '3d', text: 'Queued my first Winzi battle ⚔️ wish me luck', chip: 'Winzi', accent: '#F9D800' },
  ];
  const actions = [
    onOne01 ? { k: 'one01', label: '← ONE01 home', onPress: onOne01 } : null,
    { k: 'settings', label: 'Settings', onPress: onSettings },
    { k: 'legal', label: 'Legal', onPress: close },
    { k: 'support', label: 'Support', onPress: close },
  ].filter(Boolean) as { k: string; label: string; onPress: () => void }[];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="Profile" onClose={close} right={<Pressable onPress={onSettings} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></Pressable>} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[`${th.glow}CC`, th.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />
        <View style={styles.avatarRow}>
          <View style={[styles.bigAvatar, { backgroundColor: DARK_TILE, borderColor: th.bg }]}><UserIcon size={40} color="#fff" /></View>
          <View style={styles.flex} />
          <Pressable style={[styles.editBtn, { backgroundColor: th.accent }]}><Text style={[styles.editTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>Edit profile</Text></Pressable>
        </View>
        <View style={styles.pad}>
          <Text style={[styles.pName, { color: th.text }]}>Nobody</Text>
          <Text style={[styles.pHandle, { color: th.muted }]}>@nobody · on ONE01</Text>
          <View style={[styles.statRow, { borderColor: th.border }]}>
            {stats.map((s, i) => (
              <View key={s.l} style={[styles.stat, i < stats.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: th.border }]}>
                <Text style={[styles.statV, { color: th.text }]}>{s.v}</Text>
                <Text style={[styles.statL, { color: th.muted }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* tabs */}
          <View style={[styles.tabBar, { borderColor: th.border }]}>
            {(['posts', 'about'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
                <Text style={[styles.tabTxt, { color: t === tab ? th.text : th.muted }]}>{t === 'posts' ? 'Posts' : 'About'}</Text>
                {t === tab ? <View style={[styles.tabUnderline, { backgroundColor: th.text }]} /> : null}
              </Pressable>
            ))}
          </View>

          {tab === 'posts' ? (
            <View style={{ gap: 12, marginTop: 14 }}>
              {posts.map((p) => (
                <View key={p.id} style={[styles.post, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <View style={styles.postHead}>
                    <View style={[styles.postAv, { backgroundColor: DARK_TILE }]}><UserIcon size={16} color="#fff" /></View>
                    <Text style={[styles.postName, { color: th.text }]}>Nobody</Text>
                    <Text style={[styles.postTime, { color: th.muted }]}> · {p.time}</Text>
                    <View style={styles.flex} />
                    <View style={[styles.postChip, { borderColor: p.accent }]}><Text style={[styles.postChipTxt, { color: p.accent }]}>{p.chip}</Text></View>
                  </View>
                  <Text style={[styles.postText, { color: th.text }]}>{p.text}</Text>
                  <View style={styles.postFoot}>
                    <Text style={[styles.postAction, { color: th.muted }]}>♡  24</Text>
                    <Text style={[styles.postAction, { color: th.muted }]}>↩  3</Text>
                    <Text style={[styles.postAction, { color: th.muted }]}>↗</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <>
              <Text style={[styles.about, { color: th.muted }]}>One ONE01 identity across every app. Your representative shares only what you allow.</Text>
              <View style={{ marginTop: 18, gap: 8 }}>
                <Pressable onPress={onCreate} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <CreateIcon size={18} color={th.text} />
                  <Text style={[styles.actionTxt, { color: th.text }]}>Create</Text>
                  <View style={styles.flex} />
                  <Text style={{ color: th.muted }}>›</Text>
                </Pressable>
                {actions.map((a) => (
                  <Pressable key={a.k} onPress={a.onPress} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <Text style={[styles.actionTxt, { color: th.text }]}>{a.label}</Text>
                    <View style={styles.flex} />
                    <Text style={{ color: th.muted }}>›</Text>
                  </Pressable>
                ))}
                <Pressable onPress={onExit} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <Text style={[styles.actionTxt, { color: '#ef4444' }]}>Log out</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── SettingsPage ─────────────────────────────── */

export function SettingsPage({ th, close, onScroll }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler }) {
  const insets = useSafeAreaInsets();
  const resetDemo = useOne01PlatformStore((s) => s.resetDemo);
  const [notif, setNotif] = useState(true);
  const [faceId, setFaceId] = useState(false);
  const [sounds, setSounds] = useState(true);
  const toggles = [
    { k: 'notif', label: 'Notifications', hint: 'Updates from your ONE and apps', v: notif, set: setNotif },
    { k: 'face', label: 'Face ID', hint: 'Unlock the wallet with Face ID', v: faceId, set: setFaceId },
    { k: 'sounds', label: 'Sounds & haptics', hint: 'Taps, confirmations, alerts', v: sounds, set: setSounds },
  ];
  const links = ['Language', 'Privacy & disclosure', 'Connected accounts', 'Legal', 'Support'];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="Settings" onClose={close} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.secTitle, { color: th.text }]}>Preferences</Text>
        <View style={{ gap: 10 }}>
          {toggles.map((t) => (
            <View key={t.k} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.setLabel, { color: th.text }]}>{t.label}</Text>
                <Text style={[styles.setHint, { color: th.muted }]}>{t.hint}</Text>
              </View>
              <Switch value={t.v} onValueChange={t.set} trackColor={{ true: th.accent, false: th.border }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        <Text style={[styles.secTitle, { color: th.text }]}>Account</Text>
        <View style={{ gap: 10 }}>
          {links.map((l) => (
            <Pressable key={l} onPress={close} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <Text style={[styles.setLabel, { color: th.text }]}>{l}</Text>
              <View style={styles.flex} />
              <Text style={{ color: th.muted }}>›</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => { resetDemo(); close(); }} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border, marginTop: 10 }]}>
          <Text style={[styles.setLabel, { color: '#ef4444' }]}>Reset demo</Text>
          <View style={styles.flex} />
          <Text style={{ color: th.muted }}>›</Text>
        </Pressable>
        <Text style={[styles.setVer, { color: th.muted }]}>ONE01 · v1.0 · virtual tokens, no crypto yet</Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── WalletPage ─────────────────────────────── */

export function WalletPage({ th, close, onScroll }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler }) {
  const insets = useSafeAreaInsets();
  const balance = useOne01PlatformStore((s) => s.balance);
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const positions = useOne01PlatformStore((s) => s.positions);
  const credit = useOne01PlatformStore((s) => s.credit);
  const [topped, setTopped] = useState(false);
  const accentFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const topUp = () => { haptic.success(); credit(1000, 'Top up · virtual rails'); setTopped(true); setTimeout(() => setTopped(false), 1600); };
  // Holdings = your cash credits + real share positions in projects (live-priced)
  const holdings: { id: string; mark: MarkId; name: string; amt: string; sub: string; pl: number | null }[] = [
    { id: 'one01', mark: 'one01', name: 'ONE01 Credits', amt: balance.toLocaleString(), sub: 'Cash balance', pl: null },
    ...Object.entries(positions).map(([id, p]) => {
      const price = livePrice(id);
      const meta = PROJ_META[id] ?? { name: id, mark: 'one01' as MarkId };
      const pl = p.avgCost > 0 ? ((price - p.avgCost) / p.avgCost) * 100 : 0;
      return { id, mark: meta.mark, name: meta.name, amt: Math.round(p.shares * price).toLocaleString(), sub: `${p.shares} ${p.shares === 1 ? 'share' : 'shares'} · ⟡${price}`, pl };
    }),
  ];
  const liveTx = transactions.map((t) => ({ k: t.id, label: t.label, sub: ago(t.ts), amt: `${t.amount > 0 ? '+' : ''}${t.amount}`, up: t.amount > 0 }));
  const mockTx = [
    { k: 't1', label: 'Top up', sub: 'Today · fiat rails', amt: '+500', up: true },
    { k: 't2', label: 'Winzi — Tournament ticket', sub: 'Yesterday', amt: '-50', up: false },
    { k: 't3', label: 'Received · MixStar vote refund', sub: '2 days ago', amt: '+12', up: true },
  ];
  const tx = liveTx.length ? liveTx : mockTx;

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="Wallet" onClose={close} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* balance card */}
        <LinearGradient colors={[th.accent, `${th.accent}C0`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balCard}>
          <View style={styles.balTop}>
            <View>
              <Text style={[styles.balLbl, { color: accentFg, opacity: 0.85 }]}>Total balance</Text>
              <Text style={[styles.balAmt, { color: accentFg }]}>⟡ {balance.toLocaleString()}</Text>
            </View>
            <View style={styles.flex} />
            <View style={styles.balChg}><Text style={[styles.balChgTxt, { color: accentFg }]}>▲ 6.2%</Text></View>
          </View>
          <View style={{ marginTop: 6 }}><Sparkline color={accentFg} /></View>
          <Text style={[styles.balLbl, { color: accentFg, opacity: 0.85, marginTop: 4 }]}>≈ ${balance.toLocaleString()} · virtual credits · 30d</Text>
        </LinearGradient>

        {/* actions — Top up adds virtual credits */}
        <View style={styles.walletActions}>
          {([
            { a: 'Send', icon: '↑' },
            { a: 'Receive', icon: '↓' },
            { a: 'Top up', icon: '+' },
            { a: 'Swap', icon: '⇄' },
          ] as const).map(({ a, icon }) => {
            const isTop = a === 'Top up';
            const label = isTop && topped ? '+⟡1,000' : a;
            return (
              <Pressable key={a} onPress={isTop ? topUp : undefined} style={({ pressed }) => [styles.walletAction, pressed && isTop && { opacity: 0.7 }]}>
                <View style={[styles.walletActionIcon, { backgroundColor: isTop && topped ? th.accent : th.surface, borderColor: isTop && topped ? th.accent : th.border }]}>
                  <Text style={{ color: isTop && topped ? accentFg : th.text, fontSize: 16 }}>{icon}</Text>
                </View>
                <Text style={[styles.walletActionTxt, { color: isTop && topped ? th.accent : th.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* holdings — cash + live-priced project shares */}
        <Text style={[styles.secTitle, { color: th.text }]}>Holdings</Text>
        <View style={{ gap: 10 }}>
          {holdings.map((h) => (
            <View key={h.id} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.holdTile, { backgroundColor: DARK_TILE }]}><Mark mark={h.mark} size={24} /></View>
              <View style={styles.flex}>
                <Text style={[styles.holdName, { color: th.text }]}>{h.name}</Text>
                <Text style={[styles.holdChg, { color: th.muted }]}>{h.sub}</Text>
              </View>
              <View style={styles.holdEnd}>
                <Text style={[styles.holdAmt, { color: th.text }]}>⟡ {h.amt}</Text>
                {h.pl !== null ? <Text style={[styles.holdPl, { color: h.pl >= 0 ? '#22c55e' : '#ef4444' }]}>{h.pl >= 0 ? '+' : ''}{h.pl.toFixed(1)}%</Text> : null}
              </View>
            </View>
          ))}
        </View>
        {holdings.length === 1 && (
          <Text style={[styles.holdHint, { color: th.muted }]}>Invest in a project from its page to build positions.</Text>
        )}

        {/* activity */}
        <Text style={[styles.secTitle, { color: th.text }]}>Activity</Text>
        <View style={{ gap: 10 }}>
          {tx.map((t) => (
            <View key={t.k} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.holdTile, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 16, color: t.up ? '#22c55e' : '#ef4444' }}>{t.up ? '↓' : '↑'}</Text></View>
              <View style={styles.flex}>
                <Text style={[styles.holdName, { color: th.text }]} numberOfLines={1}>{t.label}</Text>
                <Text style={[styles.holdChg, { color: th.muted }]}>{t.sub}</Text>
              </View>
              <Text style={[styles.holdAmt, { color: t.up ? '#22c55e' : th.text }]}>{t.amt}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════ styles ══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  drag: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  grab: { width: 44, height: 5, borderRadius: 3 },
  winCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  window: { width: '100%', maxWidth: 460, height: '82%', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 17, fontWeight: '600' },
  headTitle: { fontSize: 18, fontWeight: '800' },

  /* profile */
  cover: { height: 120 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, marginTop: -40 },
  bigAvatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  editBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9, marginBottom: 6 },
  editTxt: { fontSize: 14, fontWeight: '700' },
  pad: { paddingHorizontal: 18, paddingTop: 12 },
  pName: { fontSize: 22, fontWeight: '800' },
  pHandle: { fontSize: 14, marginTop: 2 },
  statRow: { flexDirection: 'row', marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statV: { fontSize: 16, fontWeight: '800' },
  statL: { fontSize: 11, fontWeight: '600' },
  about: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 15 },
  actionTxt: { fontSize: 15, fontWeight: '700' },

  /* profile tabs + feed */
  tabBar: { flexDirection: 'row', marginTop: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabTxt: { fontSize: 15, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: -StyleSheet.hairlineWidth, height: 2.5, width: 54, borderRadius: 2 },
  post: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAv: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  postName: { fontSize: 14, fontWeight: '700' },
  postTime: { fontSize: 13 },
  postChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  postChipTxt: { fontSize: 11, fontWeight: '800' },
  postText: { fontSize: 14.5, lineHeight: 20 },
  postFoot: { flexDirection: 'row', gap: 20 },
  postAction: { fontSize: 13, fontWeight: '600' },

  /* wallet */
  balCard: { borderRadius: 20, padding: 22, marginTop: 4 },
  balTop: { flexDirection: 'row', alignItems: 'flex-start' },
  balChg: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  balChgTxt: { fontSize: 12, fontWeight: '800' },
  balLbl: { fontSize: 13, fontWeight: '600' },
  balAmt: { fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  walletActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 18 },
  walletAction: { alignItems: 'center', gap: 7 },
  walletActionIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  walletActionTxt: { fontSize: 12, fontWeight: '600' },
  secTitle: { fontSize: 17, fontWeight: '800', marginTop: 26, marginBottom: 12 },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  holdTile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  holdName: { fontSize: 15, fontWeight: '700' },
  holdChg: { fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  holdAmt: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  holdEnd: { alignItems: 'flex-end' },
  holdPl: { fontSize: 12, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  holdHint: { fontSize: 12.5, marginTop: 10, lineHeight: 18 },

  /* settings */
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
  setLabel: { fontSize: 15, fontWeight: '700' },
  setHint: { fontSize: 12.5, marginTop: 2 },
  setVer: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
