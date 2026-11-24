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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Modal, Animated, PanResponder, Switch, Image, Platform, StatusBar,
  useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import {
  One01Mark, OneMark, WinziMark, MixStarMark, XitMark, SodexMark, UserIcon, CreateIcon,
  DepositIcon, WithdrawIcon, GiftIcon,
} from './brand';
import { type ShellTheme, type MarkId, NETWORK, type Person, RARITY_COLOR, levelFor } from '../../data/one01/platform';
import { useOne01PlatformStore, livePrice, buildNotifs, labelNav, QUESTS, dailyClaimable, nextDailyAmount, dailyRewardFor, nextStreak, rewardsAvailable, DAILY_MAX_DAY, type PlatformTx, type UserCreation, type NotifNav } from '../../stores/one01PlatformStore';
import { tr, type Lang } from '../../data/one01/i18n';
import { supabaseService } from '../../services/supabaseService';

const PROJ_META: Record<string, { name: string; mark: MarkId }> = {
  winzi: { name: 'Winzi', mark: 'winzi' },
  mixstar: { name: 'MixStar', mark: 'mixstar' },
  xit: { name: 'Xit', mark: 'xit' },
  sodex: { name: 'Sodex', mark: 'sodex' },
  one: { name: 'ONE', mark: 'one' },
};

const DARK_TILE = '#131317';

/** Pick a profile photo. On web: a file input, downscaled to a small JPEG data
 *  URI so it survives in persisted storage. On native: the OS image library. */
export function pickAvatar(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          const img = document.createElement('img');
          img.onload = () => {
            const max = 256;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale) || max;
            const h = Math.round(img.height * scale) || max;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(typeof reader.result === 'string' ? reader.result : null);
            ctx.drawImage(img, 0, 0, w, h);
            try { resolve(canvas.toDataURL('image/jpeg', 0.82)); } catch { resolve(typeof reader.result === 'string' ? reader.result : null); }
          };
          img.onerror = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          img.src = reader.result as string;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
  return (async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets || !res.assets[0]) return null;
      return res.assets[0].uri as string;
    } catch { return null; }
  })();
}

function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Post = { id: string; time: string; text: string; chip: string; accent: string; nav?: NotifNav };

/** Turn the wallet's real transactions + published creations into a social feed. */
function buildPosts(transactions: PlatformTx[], creations: UserCreation[], accent: string): Post[] {
  const GOLD = '#F9D800', PURPLE = '#8B5CF6', GREEN = '#22c55e', ONE = '#10B981';
  const raw: (Post & { ts: number })[] = [];
  transactions.forEach((t) => {
    const L = t.label, amt = Math.abs(t.amount);
    // private wallet movements (deposit / withdraw / top up) belong in the wallet, not the social feed
    if (/^(Deposit|Withdraw|Top ?up|Cash ?out)\b/i.test(L)) return;
    let text = L, chip = 'ONE', col = ONE;
    if (L.startsWith('Market · ')) { text = `Picked up ${L.slice(9)} on the Market`; chip = 'Market'; col = accent; }
    else if (L.startsWith('Invested · ')) { text = `Invested in ${L.slice(11)} 📈`; chip = 'Invest'; col = GREEN; }
    else if (L.startsWith('Sold · ')) { text = `Sold my ${L.slice(7)} shares`; chip = 'Invest'; col = GREEN; }
    else if (L.startsWith('Top up')) { text = `Topped up ⟡${amt.toLocaleString()} of credits`; chip = 'Wallet'; col = ONE; }
    else if (L.includes('match won')) { text = `Won a ${L.replace(' match won', '')} match ⚔️ +⟡${amt}`; chip = 'Winzi'; col = GOLD; }
    else if (L.includes('stake back')) { text = `Drew a ${L.split(' ')[0]} match — stake back`; chip = 'Winzi'; col = GOLD; }
    else if (L.includes('match stake')) { text = `Queued a ${L.replace(' match stake', '')} match`; chip = 'Winzi'; col = GOLD; }
    else if (L.includes('bet won')) { text = `Called the winner on ${L.split('·').pop()?.trim() ?? 'a show'} 🎯 +⟡${amt}`; chip = 'MixStar'; col = PURPLE; }
    else if (L.includes('bet · ')) { text = `Placed a bet on ${L.split('· ').pop()?.trim()}`; chip = 'MixStar'; col = PURPLE; }
    else if (L.includes('free vote')) { text = `Voted on ${L.replace(' free vote', '')}`; chip = 'MixStar'; col = PURPLE; }
    else if (L.includes('practice')) { text = `Practised ${L.replace(' practice', '')} 🏓`; chip = 'Winzi'; col = GOLD; }
    else if (L.includes('earnings')) { text = `Collected earnings from ${L.replace(' earnings', '')} 🧱`; chip = 'Creator'; col = accent; }
    else if (L.startsWith('Exit · ')) { text = `Exited ${L.slice(7)} 💸 +⟡${amt.toLocaleString()}`; chip = 'Invest'; col = GREEN; }
    else if (L.startsWith('Launched · ')) { text = `Backed the launch of ${L.slice(11)} 🚀`; chip = 'Invest'; col = GREEN; }
    else if (/ · .+ round$/.test(L)) { const [name, round] = L.split(' · '); text = `Backed ${name} — ${round} 📈`; chip = 'Invest'; col = GREEN; }
    raw.push({ id: t.id, ts: t.ts, time: ago(t.ts), text, chip, accent: col, nav: labelNav(t.label) });
  });
  creations.forEach((c) => raw.push({ id: c.id, ts: c.ts, time: ago(c.ts), text: `Published ${c.title} on ${c.surface} 🧱`, chip: 'Creator', accent: ONE, nav: { kind: 'create' } }));
  return raw.sort((a, b) => b.ts - a.ts).slice(0, 30);
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

export function SheetWindow({ visible, wide, th, onClose, children, dock, tall }: { visible: boolean; wide: boolean; th: ShellTheme; onClose: () => void; children: (close: () => void, onScroll: ScrollHandler) => React.ReactNode; dock?: boolean; tall?: boolean }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const prog = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);

  // sheets open right up to the clock bar (rounded top just below it). The clock-bar
  // background keeps its own colour — the full-screen dim scrim simply extends over it,
  // so the status region darkens with the rest of the page instead of turning solid black.
  const sheetTop = insets.top;
  const sheetH = winH - sheetTop;
  const ty = useRef(new Animated.Value(sheetH)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    prog.setValue(0); ty.setValue(sheetH); scrollY.current = 0;
    Animated.spring(prog, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
    Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 13 }).start();
  }, [visible, prog, ty, sheetH]);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(prog, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(ty, { toValue: sheetH, duration: 220, useNativeDriver: true }).start(() => onClose());
  };
  // Track scroll offset AND use the native over-scroll (pull-down past the top) as a
  // dismiss trigger — on native the UIScrollView keeps the responder for touches that
  // start on empty content, so the PanResponder alone can't catch them; the bounce can.
  const onScroll: ScrollHandler = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    if (y < -82) requestClose();
  };

  // drag down to dismiss. A child ScrollView wins the responder by default, so a plain
  // onMoveShouldSetPanResponder loses the FIRST downward swipe to it. We CAPTURE the
  // gesture — but only once it's a clear downward drag (dy>8, mostly vertical) while the
  // content is at the very top — so taps and upward scrolls still reach the content.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 2 && scrollY.current <= 1,
      onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.5) requestClose();
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(),
    }),
  ).current;

  const scrimOpacity = prog.interpolate({ inputRange: [0, 1], outputRange: [0, dock ? 0.3 : 0.5] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.flex}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: scrimOpacity }]} pointerEvents="none" />
        </Pressable>

        {wide ? (
          dock ? (
            /* a regular docked window — slides in from the right, full height, not a centered popup */
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Animated.View style={[styles.winDock, { backgroundColor: th.bg, borderColor: th.border, paddingTop: insets.top, transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [480, 0] }) }] }]}>
                {children(requestClose, onScroll)}
              </Animated.View>
            </View>
          ) : (
          <View style={styles.winCenter} pointerEvents="box-none">
            <Animated.View style={[styles.window, { backgroundColor: th.bg, borderColor: th.border, opacity: prog, transform: [{ scale: prog.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
              {children(requestClose, onScroll)}
            </Animated.View>
          </View>
          )
        ) : (
          <>
            <StatusBar barStyle="light-content" />
            <Animated.View {...pan.panHandlers} style={[styles.sheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: ty }] }]}>
              <View style={styles.drag}><View style={[styles.grab, { backgroundColor: th.border }]} /></View>
              {children(requestClose, onScroll)}
            </Animated.View>
          </>
        )}
      </View>
    </Modal>
  );
}

function PanelHead({ th, title, onClose, right, back }: { th: ShellTheme; title: string; onClose: () => void; right?: React.ReactNode; back?: () => void }) {
  return (
    <View style={styles.head}>
      <Pressable onPress={back ?? onClose} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Text style={[styles.x, { color: th.text, fontSize: back ? 22 : 17 }]}>{back ? '‹' : '✕'}</Text>
      </Pressable>
      <Text style={[styles.headTitle, { color: th.text }]}>{title}</Text>
      <View style={styles.flex} />
      {right}
    </View>
  );
}

/* ─────────────────────────────── ProfilePage ─────────────────────────────── */

export function ProfilePage({ th, close, onExit, onCreate, onOne01, onSettings, onScroll, lang, initialTab = 'posts', onNavigate, onOpenNetwork }: { th: ShellTheme; close: () => void; onExit: () => void; onCreate: () => void; onOne01?: () => void; onSettings: () => void; onScroll?: ScrollHandler; lang: Lang; initialTab?: 'posts' | 'notifs' | 'about'; onNavigate?: (nav: NotifNav) => void; onOpenNetwork?: () => void }) {
  const insets = useSafeAreaInsets();
  const t = (en: string) => tr(lang, en);
  const [tab, setTab] = useState<'posts' | 'notifs' | 'about'>(initialTab);
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const creations = useOne01PlatformStore((s) => s.creations);
  const avatarUri = useOne01PlatformStore((s) => s.avatarUri);
  const setAvatar = useOne01PlatformStore((s) => s.setAvatar);
  const displayName = useOne01PlatformStore((s) => s.displayName);
  const handle = useOne01PlatformStore((s) => s.handle);
  const changeAvatar = async () => { const uri = await pickAvatar(); if (uri) { haptic.success(); setAvatar(uri); } };
  const nameLabel = displayName?.trim() || 'Nobody';
  const handleLabel = handle?.trim() ? `@${handle.trim()} · on ONE01` : '@nobody · on ONE01';
  const { level, progress } = levelFor(transactions.length);
  const activity = useMemo(() => buildPosts(transactions, creations, th.accent), [transactions, creations, th.accent]);
  const notifs = useMemo(() => buildNotifs(transactions), [transactions]);
  const seedPosts: Post[] = [
    { id: 'p1', time: '2h', text: 'Started a process: renew my driving license 🪪', chip: 'Process', accent: th.accent, nav: { kind: 'home', homeId: 'one' } },
    { id: 'p2', time: '1d', text: 'Reached a provider through ONE — only my city and budget were shared.', chip: 'ONE', accent: '#10B981', nav: { kind: 'home', homeId: 'one' } },
    { id: 'p3', time: '3d', text: 'Queued my first Winzi battle ⚔️ wish me luck', chip: 'Winzi', accent: '#F9D800', nav: { kind: 'home', homeId: 'winzi' } },
  ];
  const go = (nav?: NotifNav) => { if (nav && onNavigate) onNavigate(nav); };
  const posts = activity.length ? activity : seedPosts;
  const stats = [{ v: '128', l: 'Friends' }, { v: `${posts.length}`, l: 'Posts' }, { v: `LVL ${level}`, l: 'Level' }];
  const logout = async () => {
    haptic.tap();
    try { await supabaseService.signOut(); } catch { /* no session / no client */ }
    const st = useOne01PlatformStore.getState();
    st.setProfile({ displayName: null, handle: null, email: null, authMethod: null });
    st.setEntered(false); // back to the sign-in screen (keeps balance & data)
  };
  const actions = [
    onOne01 ? { k: 'one01', label: '← ONE01 home', onPress: onOne01 } : null,
    { k: 'settings', label: 'Settings', onPress: onSettings },
    { k: 'legal', label: 'Legal', onPress: close },
    { k: 'support', label: 'Support', onPress: close },
    { k: 'logout', label: 'Log out', onPress: logout },
  ].filter(Boolean) as { k: string; label: string; onPress: () => void }[];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="" onClose={close} right={<Pressable onPress={onSettings} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></Pressable>} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[`${th.glow}CC`, th.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />
        {/* centred identity: avatar, name, handle, edit */}
        <View style={styles.profileHead}>
          <Pressable onPress={changeAvatar} style={[styles.bigAvatar, { backgroundColor: DARK_TILE, borderColor: th.accent }]}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.bigAvatarImg} /> : <UserIcon size={40} color="#fff" />}
            <View style={[styles.avatarCam, { backgroundColor: th.accent, borderColor: th.bg }]}><Text style={{ fontSize: 12 }}>📷</Text></View>
          </Pressable>
          <Text style={[styles.pName, { color: th.text }]}>{nameLabel}</Text>
          <Text style={[styles.pHandle, { color: th.muted }]}>{handleLabel}</Text>
          <Pressable onPress={changeAvatar} style={({ pressed }) => [styles.editBtn, { backgroundColor: th.accent }, pressed && { opacity: 0.85 }]}><Text style={[styles.editTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>{t('Edit profile')}</Text></Pressable>
        </View>
        <View style={styles.pad}>
          {/* level progress as a slider bar (was a ring around the avatar) */}
          <View style={[styles.levelCard, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={styles.levelRow}>
              <Text style={[styles.levelLvl, { color: th.text }]}>{t('Level')} {level}</Text>
              <View style={styles.flex} />
              <Text style={[styles.levelNext, { color: th.muted }]}>{Math.round(progress * 100)}% → {t('Level')} {level + 1}</Text>
            </View>
            <View style={[styles.levelTrack, { backgroundColor: th.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.levelFill, { width: `${Math.max(3, Math.round(progress * 100))}%`, backgroundColor: th.accent }]} />
            </View>
          </View>
          <View style={[styles.statRow, { borderColor: th.border }]}>
            {stats.map((s, i) => (
              <Pressable key={s.l} disabled={s.l !== 'Friends' || !onOpenNetwork} onPress={onOpenNetwork} style={({ pressed }) => [styles.stat, i < stats.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: th.border }, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.statV, { color: th.text }]}>{s.v}</Text>
                <Text style={[styles.statL, { color: th.muted }]}>{t(s.l)}</Text>
              </Pressable>
            ))}
          </View>

          {/* tabs */}
          <View style={[styles.tabBar, { borderColor: th.border }]}>
            {(['posts', 'notifs', 'about'] as const).map((tk) => (
              <Pressable key={tk} onPress={() => setTab(tk)} style={styles.tabBtn}>
                <Text style={[styles.tabTxt, { color: tk === tab ? th.text : th.muted }]}>{tk === 'posts' ? t('Posts') : tk === 'notifs' ? t('Notifications') : t('About')}</Text>
                {tk === tab ? <View style={[styles.tabUnderline, { backgroundColor: th.text }]} /> : null}
              </Pressable>
            ))}
          </View>

          {tab === 'notifs' && (
            <View style={{ gap: 10, marginTop: 14 }}>
              {notifs.map((n) => (
                <Pressable key={n.id} disabled={!n.nav} onPress={() => go(n.nav)} style={({ pressed }) => [styles.notifRow, { backgroundColor: th.surface, borderColor: th.border, opacity: pressed ? 0.6 : 1 }]}>
                  <View style={[styles.notifTile, { backgroundColor: th.surface2 }]}><Text style={{ fontSize: 19 }}>{n.emoji}</Text></View>
                  <View style={styles.flex}>
                    <Text style={[styles.notifRowTitle, { color: th.text }]} numberOfLines={1}>{n.title}</Text>
                    <Text style={[styles.notifRowBody, { color: th.muted }]} numberOfLines={1}>{n.body}</Text>
                  </View>
                  <Text style={[styles.notifRowTime, { color: th.muted }]}>{ago(n.ts)}</Text>
                  {n.nav ? <Text style={{ color: th.muted, fontSize: 18, marginLeft: 4 }}>›</Text> : null}
                </Pressable>
              ))}
            </View>
          )}

          {tab === 'posts' && (
            <View style={{ gap: 12, marginTop: 14 }}>
              {posts.map((p) => (
                <Pressable key={p.id} disabled={!p.nav} onPress={() => go(p.nav)} style={({ pressed }) => [styles.post, { backgroundColor: th.surface, borderColor: th.border, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={styles.postHead}>
                    <View style={[styles.postAv, { backgroundColor: DARK_TILE }]}><UserIcon size={16} color="#fff" /></View>
                    <Text style={[styles.postName, { color: th.text }]}>Nobody</Text>
                    <Text style={[styles.postTime, { color: th.muted }]}> · {p.time}</Text>
                    <View style={styles.flex} />
                    <View style={[styles.postChip, { borderColor: p.accent }]}><Text style={[styles.postChipTxt, { color: p.accent }]}>{p.chip}</Text></View>
                  </View>
                  <Text style={[styles.postText, { color: th.text }]}>{p.text}</Text>
                  <View style={styles.postFoot}>
                    <Text style={[styles.postAction, { color: th.muted }]}>♡  {3 + (phash(p.id) % 140)}</Text>
                    <Text style={[styles.postAction, { color: th.muted }]}>↩  {phash(`${p.id}c`) % 18}</Text>
                    <Text style={[styles.postAction, { color: th.muted }]}>↗</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {tab === 'about' && (
            <>
              <Text style={[styles.about, { color: th.muted }]}>One ONE01 identity across every app. Your representative shares only what you allow.</Text>
              <View style={{ marginTop: 18, gap: 8 }}>
                <Pressable onPress={onCreate} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <CreateIcon size={18} color={th.text} />
                  <Text style={[styles.actionTxt, { color: th.text }]}>{t('Create')}</Text>
                  <View style={styles.flex} />
                  <Text style={{ color: th.muted }}>›</Text>
                </Pressable>
                {actions.map((a) => (
                  <Pressable key={a.k} onPress={a.onPress} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <Text style={[styles.actionTxt, { color: th.text }]}>{t(a.label)}</Text>
                    <View style={styles.flex} />
                    <Text style={{ color: th.muted }}>›</Text>
                  </Pressable>
                ))}
                <Pressable onPress={onExit} style={[styles.actionRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <Text style={[styles.actionTxt, { color: '#ef4444' }]}>{t('Log out')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── NetworkPage ─────────────────────────────── */

/** Deterministic per-person numbers so a profile reads the same every visit. */
function phash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h ^ id.charCodeAt(i), 16777619)) >>> 0;
  return h;
}
function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`;
}
function personStats(p: Person): { followers: string; following: string; creations: string } {
  const h = phash(p.id);
  return {
    followers: fmtK(180 + (h % 9000)),
    following: fmtK(40 + ((h >> 5) % 600)),
    creations: `${(h >> 11) % 34}`,
  };
}

/** A person's ONE — the mini-profile you reach by tapping someone in the network. */
function PersonDetail({ th, person, lang, onBack }: { th: ShellTheme; person: Person; lang: Lang; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const t = (en: string) => tr(lang, en);
  const follows = useOne01PlatformStore((s) => s.follows);
  const setFollow = useOne01PlatformStore((s) => s.setFollow);
  const followed = follows[person.id] ?? person.followsBack;
  const fg = th.accent === '#F9D800' ? '#000' : '#fff';
  const stats = personStats(person);
  const statCells: { v: string; l: string }[] = [
    { v: stats.followers, l: 'Followers' },
    { v: stats.following, l: 'Following' },
    { v: stats.creations, l: 'Creations' },
  ];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title={person.name} onClose={onBack} back={onBack} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={[styles.personHero, { backgroundColor: `${person.accent}22`, borderColor: person.accent }]}>
            <Text style={{ fontSize: 40 }}>{person.emoji}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={[styles.pName, { color: th.text }]}>{person.name}</Text>
            <Text style={[styles.pHandle, { color: th.muted }]}>{person.handle} · {t('on ONE01')}</Text>
          </View>
          {person.followsYou && (
            <View style={[styles.followsYouChip, { backgroundColor: th.surface2, borderColor: th.border }]}>
              <Text style={[styles.followsYouTxt, { color: th.muted }]}>{t('Follows you')}</Text>
            </View>
          )}
        </View>

        {person.bio ? <Text style={[styles.personBio, { color: th.text }]}>{person.bio}</Text> : null}

        {person.tags && person.tags.length > 0 && (
          <View style={styles.personTags}>
            {person.tags.map((tag) => (
              <View key={tag} style={[styles.personTag, { backgroundColor: th.surface, borderColor: th.border }]}>
                <Text style={[styles.personTagTxt, { color: th.muted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.statRow, { borderColor: th.border }]}>
          {statCells.map((s, i) => (
            <View key={s.l} style={[styles.stat, i < statCells.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: th.border }]}>
              <Text style={[styles.statV, { color: th.text }]}>{s.v}</Text>
              <Text style={[styles.statL, { color: th.muted }]}>{t(s.l)}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => { haptic.select(); setFollow(person.id, !followed); }}
          style={[styles.personCta, followed ? { backgroundColor: th.surface2, borderColor: th.border, borderWidth: StyleSheet.hairlineWidth } : { backgroundColor: th.accent, borderColor: th.accent }]}
        >
          <Text style={[styles.personCtaTxt, { color: followed ? th.text : fg }]}>
            {followed ? t('Following') : person.followsYou ? t('Follow back') : t('Follow')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Rewards — a daily streak + one-off quests that pay virtual credits. The daily
 *  reward escalates with the streak; quests auto-complete from real activity across
 *  the surfaces (play, create, invest, follow, deposit, profile). */
export function RewardsPage({ th, close, onScroll, lang }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler; lang: Lang }) {
  const insets = useSafeAreaInsets();
  const t = (en: string) => tr(lang, en);
  const state = useOne01PlatformStore();
  const claimDaily = state.claimDaily;
  const claimQuest = state.claimQuest;
  const accentFg = th.accent === '#F9D800' ? '#000' : '#fff';

  const claimable = dailyClaimable(state);
  const todayAmt = nextDailyAmount(state);
  const upcomingDay = nextStreak(state);
  const filledDays = state.rewardStreak; // days already claimed

  const onDaily = () => { if (claimDaily() > 0) haptic.success(); else haptic.warning(); };
  const onQuest = (id: string, reward: number) => { if (claimQuest(id, reward)) haptic.success(); };

  const questRows = QUESTS.map((q) => ({ q, done: q.done(state), claimed: state.claimedQuests.includes(q.id) }));
  const doneCount = questRows.filter((r) => r.done).length;

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="" onClose={close} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.rwHeader}>
          <GiftIcon size={26} color={th.text} />
          <View style={styles.flex}>
            <Text style={[styles.rwTitle, { color: th.text }]}>{t('Rewards')}</Text>
            <Text style={[styles.rwSub, { color: th.muted }]}>{t('Earn credits every day — no deposit needed')}</Text>
          </View>
        </View>

        {/* daily streak card */}
        <LinearGradient colors={[`${th.glow}`, th.mode === 'dark' ? '#14151A' : '#20222B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rwCard}>
          <View style={styles.rwCardTop}>
            <Text style={styles.rwStreakTxt}>🔥 {filledDays > 0 ? `${filledDays}-${t('day streak')}` : t('Start your streak')}</Text>
            <View style={styles.flex} />
            <Text style={styles.rwDayLbl}>{t('Day')} {upcomingDay}</Text>
          </View>
          <View style={styles.rwPips}>
            {Array.from({ length: DAILY_MAX_DAY }).map((_, i) => {
              const claimedPip = i < filledDays;
              const nextPip = i === upcomingDay - 1 && claimable;
              return <View key={i} style={[styles.rwPip, claimedPip ? { backgroundColor: '#fff' } : nextPip ? { backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.22)' }]} />;
            })}
          </View>
          <Pressable onPress={onDaily} disabled={!claimable} style={({ pressed }) => [styles.rwClaim, { backgroundColor: claimable ? '#fff' : 'rgba(255,255,255,0.18)' }, pressed && claimable && { opacity: 0.85 }]}>
            <Text style={[styles.rwClaimTxt, { color: claimable ? '#101114' : 'rgba(255,255,255,0.85)' }]}>
              {claimable ? `${t('Claim')}  ⟡${todayAmt}` : `${t('Claimed today')}  ✓`}
            </Text>
          </Pressable>
          {!claimable && <Text style={styles.rwBack}>{t('Come back tomorrow for')} ⟡{dailyRewardFor(filledDays + 1)}</Text>}
        </LinearGradient>

        {/* quests */}
        <View style={styles.rwQuestHead}>
          <Text style={[styles.secTitle, { color: th.text, marginTop: 4 }]}>{t('Quests')}</Text>
          <View style={styles.flex} />
          <Text style={[styles.rwProgress, { color: th.muted }]}>{doneCount}/{QUESTS.length}</Text>
        </View>
        <View style={{ gap: 10 }}>
          {questRows.map(({ q, done, claimed }) => (
            <View key={q.id} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }, claimed && { opacity: 0.6 }]}>
              <View style={[styles.holdTile, { backgroundColor: DARK_TILE }]}><Text style={{ fontSize: 20 }}>{q.emoji}</Text></View>
              <View style={styles.flex}>
                <Text style={[styles.holdName, { color: th.text }]}>{t(q.title)}</Text>
                <Text style={[styles.holdChg, { color: th.muted }]}>{claimed ? t('Claimed') : done ? t('Ready to claim') : t(q.hint)}</Text>
              </View>
              {claimed ? (
                <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 16 }}>✓</Text>
              ) : done ? (
                <Pressable onPress={() => onQuest(q.id, q.reward)} style={({ pressed }) => [styles.rwQuestClaim, { backgroundColor: th.accent }, pressed && { opacity: 0.85 }]}>
                  <Text style={[styles.rwQuestClaimTxt, { color: accentFg }]}>⟡{q.reward}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.rwQuestLocked, { color: th.muted }]}>⟡{q.reward}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Followers / Following lists around your ONE — real follow/unfollow toggles. */
export function NetworkPage({ th, close, onScroll, lang, initialTab = 'followers' }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler; lang: Lang; initialTab?: 'followers' | 'following' }) {
  const insets = useSafeAreaInsets();
  const t = (en: string) => tr(lang, en);
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [selected, setSelected] = useState<Person | null>(null);
  const follows = useOne01PlatformStore((s) => s.follows);
  const setFollow = useOne01PlatformStore((s) => s.setFollow);
  const isFollowing = (p: Person) => follows[p.id] ?? p.followsBack;

  const followers = useMemo(() => NETWORK.filter((p) => p.followsYou), []);
  const following = useMemo(() => NETWORK.filter(isFollowing), [follows]);
  const list = tab === 'followers' ? followers : following;
  const fg = th.accent === '#F9D800' ? '#000' : '#fff';

  if (selected) return <PersonDetail th={th} person={selected} lang={lang} onBack={() => setSelected(null)} />;

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title={t('Network')} onClose={close} />
      <View style={[styles.tabBar, { borderColor: th.border, marginHorizontal: 18 }]}>
        {(['followers', 'following'] as const).map((tk) => (
          <Pressable key={tk} onPress={() => setTab(tk)} style={styles.tabBtn}>
            <Text style={[styles.tabTxt, { color: tk === tab ? th.text : th.muted }]}>
              {tk === 'followers' ? `${followers.length} ${t('Followers')}` : `${following.length} ${t('Following')}`}
            </Text>
            {tk === tab ? <View style={[styles.tabUnderline, { backgroundColor: th.text }]} /> : null}
          </Pressable>
        ))}
      </View>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30, gap: 10 }} showsVerticalScrollIndicator={false}>
        {list.map((p) => {
          const followed = isFollowing(p);
          return (
            <Pressable key={p.id} onPress={() => { haptic.select(); setSelected(p); }} style={({ pressed }) => [styles.personRow, { backgroundColor: th.surface, borderColor: th.border }, pressed && { opacity: 0.75 }]}>
              <View style={[styles.personAv, { backgroundColor: `${p.accent}22` }]}><Text style={{ fontSize: 20 }}>{p.emoji}</Text></View>
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={[styles.personName, { color: th.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.personHandle, { color: th.muted }]} numberOfLines={1}>  {p.handle}</Text>
                </View>
                <Text style={[styles.personMeta, { color: th.muted }]} numberOfLines={1}>{p.meta}</Text>
              </View>
              <Pressable
                onPress={() => { haptic.select(); setFollow(p.id, !followed); }}
                style={[styles.followBtn, followed ? { backgroundColor: th.surface2, borderColor: th.border } : { backgroundColor: th.accent, borderColor: th.accent }]}
              >
                <Text style={[styles.followTxt, { color: followed ? th.muted : fg }]}>
                  {followed ? t('Following') : p.followsYou ? t('Follow back') : t('Follow')}
                </Text>
              </Pressable>
            </Pressable>
          );
        })}
        {list.length === 0 && <Text style={[styles.about, { color: th.muted }]}>{t('No one here yet')}</Text>}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── SettingsPage ─────────────────────────────── */

function Segmented<T extends string>({ th, options, value, onChange }: { th: ShellTheme; options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const fg = th.accent === '#F9D800' ? '#000' : '#fff';
  return (
    <View style={[styles.segment, { backgroundColor: th.surface2, borderColor: th.border }]}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.segmentBtn, on && { backgroundColor: th.accent }]}>
            <Text style={[styles.segmentTxt, { color: on ? fg : th.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsPage({ th, close, onScroll, lang }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler; lang: Lang }) {
  const insets = useSafeAreaInsets();
  const resetDemo = useOne01PlatformStore((s) => s.resetDemo);
  const appearance = useOne01PlatformStore((s) => s.appearance);
  const setAppearance = useOne01PlatformStore((s) => s.setAppearance);
  const setLang = useOne01PlatformStore((s) => s.setLang);
  const t = (en: string) => tr(lang, en);
  const [notif, setNotif] = useState(true);
  const [faceId, setFaceId] = useState(false);
  const [sounds, setSounds] = useState(true);
  const toggles = [
    { k: 'notif', label: 'Notifications', hint: 'Updates from your ONE and apps', v: notif, set: setNotif },
    { k: 'face', label: 'Face ID', hint: 'Unlock the wallet with Face ID', v: faceId, set: setFaceId },
    { k: 'sounds', label: 'Sounds & haptics', hint: 'Taps, confirmations, alerts', v: sounds, set: setSounds },
  ];
  const links = ['Privacy & disclosure', 'Connected accounts', 'Legal', 'Support'];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title={t('Settings')} onClose={close} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.secTitle, { color: th.text }]}>{t('Appearance')}</Text>
        <View style={{ gap: 10 }}>
          <View style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.setLabel, { color: th.text }]}>{t('Appearance')}</Text>
              <Text style={[styles.setHint, { color: th.muted }]}>{t('Light or dark ONE01')}</Text>
            </View>
            <Segmented th={th} value={appearance} onChange={setAppearance} options={[{ v: 'light', label: t('Light') }, { v: 'dark', label: t('Dark') }]} />
          </View>
          <View style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.setLabel, { color: th.text }]}>{t('Language')}</Text>
              <Text style={[styles.setHint, { color: th.muted }]}>{t('Interface language')}</Text>
            </View>
            <Segmented th={th} value={lang} onChange={setLang} options={[{ v: 'en', label: 'EN' }, { v: 'he', label: 'עב' }]} />
          </View>
        </View>

        <Text style={[styles.secTitle, { color: th.text }]}>{t('Preferences')}</Text>
        <View style={{ gap: 10 }}>
          {toggles.map((tg) => (
            <View key={tg.k} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.setLabel, { color: th.text }]}>{t(tg.label)}</Text>
                <Text style={[styles.setHint, { color: th.muted }]}>{t(tg.hint)}</Text>
              </View>
              <Switch value={tg.v} onValueChange={tg.set} trackColor={{ true: th.accent, false: th.border }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        <Text style={[styles.secTitle, { color: th.text }]}>{t('Account')}</Text>
        <View style={{ gap: 10 }}>
          {links.map((l) => (
            <Pressable key={l} onPress={close} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <Text style={[styles.setLabel, { color: th.text }]}>{t(l)}</Text>
              <View style={styles.flex} />
              <Text style={{ color: th.muted }}>›</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => { resetDemo(); close(); }} style={[styles.setRow, { backgroundColor: th.surface, borderColor: th.border, marginTop: 10 }]}>
          <Text style={[styles.setLabel, { color: '#ef4444' }]}>{t('Reset demo')}</Text>
          <View style={styles.flex} />
          <Text style={{ color: th.muted }}>›</Text>
        </Pressable>
        <Text style={[styles.setVer, { color: th.muted }]}>ONE01 · v1.0 · virtual tokens, no crypto yet</Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── WalletPage ─────────────────────────────── */

const DEPOSIT_METHODS = [
  { k: 'card', name: 'Visa •••• 4242', emoji: '💳' },
  { k: 'apple', name: 'Apple Pay', emoji: '🍎' },
  { k: 'bank', name: 'Bank transfer', emoji: '🏦' },
];
const WITHDRAW_METHODS = [
  { k: 'bank', name: 'Bank account', emoji: '🏦' },
  { k: 'card', name: 'Visa •••• 4242', emoji: '💳' },
];

/** Full-sheet amount entry: a $ display (credits are 1:1 with USD), a payment-method
 *  / destination picker, and a numeric keypad. Used for both deposit and withdraw. */
function AmountPad({ th, kind, balance, onClose, onConfirm }: {
  th: ShellTheme; kind: 'deposit' | 'withdraw'; balance: number;
  onClose: () => void; onConfirm: (amount: number, methodName: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [amt, setAmt] = useState('');
  const methods = kind === 'deposit' ? DEPOSIT_METHODS : WITHDRAW_METHODS;
  const [method, setMethod] = useState(methods[0].k);
  const n = parseInt(amt || '0', 10);
  const accentFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const tooMuch = kind === 'withdraw' && n > balance;
  const valid = n > 0 && !tooMuch;
  const press = (d: string) => {
    haptic.select();
    if (d === '⌫') setAmt((a) => a.slice(0, -1));
    else if (amt.length < 7) setAmt((a) => (a === '' && d === '0' ? '' : a + d));
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: th.bg }]}>
      <View style={styles.head}>
        <Pressable onPress={onClose} hitSlop={10} style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.x, { color: th.text }]}>✕</Text>
        </Pressable>
        <Text style={[styles.headTitle, { color: th.text }]}>{kind === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
        <View style={styles.flex} />
      </View>
      <View style={styles.padBody}>
        <View style={styles.amtWrap}>
          <Text style={[styles.amtBig, { color: tooMuch ? '#ef4444' : th.text }]}>${n.toLocaleString()}</Text>
          <Text style={[styles.amtHint, { color: th.muted }]}>{tooMuch ? `Max ⟡${balance.toLocaleString()}` : `⟡ ${n.toLocaleString()} credits · 1 credit = $1`}</Text>
        </View>
        <Text style={[styles.padLabel, { color: th.muted }]}>{kind === 'deposit' ? 'PAY WITH' : 'WITHDRAW TO'}</Text>
        <View style={{ gap: 8 }}>
          {methods.map((m) => {
            const on = method === m.k;
            return (
              <Pressable key={m.k} onPress={() => { haptic.select(); setMethod(m.k); }} style={[styles.payRow, { borderColor: on ? th.accent : th.border, backgroundColor: th.surface }]}>
                <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                <Text style={[styles.payName, { color: th.text }]}>{m.name}</Text>
                <View style={styles.flex} />
                <View style={[styles.radio, { borderColor: on ? th.accent : th.border }]}>{on ? <View style={[styles.radioDot, { backgroundColor: th.accent }]} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.flex} />
        <View style={styles.keypad}>
          {keys.map((k, i) => (
            <Pressable key={i} disabled={k === ''} onPress={() => k && press(k)} style={({ pressed }) => [styles.key, pressed && k !== '' && { backgroundColor: th.surface }]}>
              <Text style={[styles.keyTxt, { color: th.text }]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => { if (valid) onConfirm(n, methods.find((m) => m.k === method)?.name ?? ''); }} disabled={!valid} style={({ pressed }) => [styles.padCta, { backgroundColor: th.accent }, !valid && { opacity: 0.4 }, pressed && valid && { opacity: 0.85 }]}>
          <Text style={[styles.padCtaTxt, { color: accentFg }]}>{kind === 'deposit' ? `Deposit $${n.toLocaleString()}` : `Withdraw $${n.toLocaleString()}`}</Text>
        </Pressable>
        <View style={{ height: insets.bottom + 8 }} />
      </View>
    </View>
  );
}

export function WalletPage({ th, close, onScroll, lang, onRewards }: { th: ShellTheme; close: () => void; onScroll?: ScrollHandler; lang: Lang; onRewards?: () => void }) {
  const insets = useSafeAreaInsets();
  const t = (en: string) => tr(lang, en);
  const balance = useOne01PlatformStore((s) => s.balance);
  const rewardsOn = useOne01PlatformStore(rewardsAvailable);
  const transactions = useOne01PlatformStore((s) => s.transactions);
  const positions = useOne01PlatformStore((s) => s.positions);
  const credit = useOne01PlatformStore((s) => s.credit);
  const debit = useOne01PlatformStore((s) => s.debit);
  const creations = useOne01PlatformStore((s) => s.creations);
  const [section, setSection] = useState<'assets' | 'history'>('assets');
  const [pad, setPad] = useState<null | 'deposit' | 'withdraw'>(null);
  const accentFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const confirmPad = (amount: number, mname: string) => {
    if (pad === 'deposit') { credit(amount, `Deposit · ${mname}`); haptic.success(); }
    else if (debit(amount, `Withdraw · ${mname}`)) haptic.success();
    else haptic.warning();
    setPad(null);
  };
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
      <PanelHead th={th} title="" onClose={close} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* balance card — a calm, credit-card-style surface (not the bright accent) */}
        <LinearGradient colors={['#262933', '#14151A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balCard, { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.balTop}>
            <View>
              <Text style={[styles.balLbl, { color: '#C7CBD6' }]}>{t('Total balance')}</Text>
              <Text style={styles.balAmt}><Text style={{ color: th.accent }}>⟡ </Text><Text style={{ color: '#fff' }}>{balance.toLocaleString()}</Text></Text>
            </View>
            <View style={styles.flex} />
            <View style={styles.balChg}><Text style={[styles.balChgTxt, { color: '#34d399' }]}>▲ 6.2%</Text></View>
          </View>
          <View style={{ marginTop: 6 }}><Sparkline color="#8A8F9C" /></View>
          <Text style={[styles.balLbl, { color: '#9A9FAC', marginTop: 4 }]}>≈ ${balance.toLocaleString()} · {t('virtual credits · 30d')}</Text>
        </LinearGradient>

        {/* two primary actions: deposit + withdraw */}
        <View style={styles.wBtnRow}>
          <Pressable onPress={() => setPad('deposit')} style={({ pressed }) => [styles.wBtn, { backgroundColor: th.accent }, pressed && { opacity: 0.85 }]}>
            <DepositIcon size={18} color={accentFg} />
            <Text style={[styles.wBtnTxt, { color: accentFg }]}>{t('Deposit')}</Text>
          </Pressable>
          <Pressable onPress={() => setPad('withdraw')} style={({ pressed }) => [styles.wBtn, styles.wBtnAlt, { borderColor: th.border }, pressed && { opacity: 0.7 }]}>
            <WithdrawIcon size={18} color={th.text} />
            <Text style={[styles.wBtnTxt, { color: th.text }]}>{t('Withdraw')}</Text>
          </Pressable>
        </View>

        {/* rewards entry — earn credits without a deposit */}
        {onRewards && (
          <Pressable onPress={onRewards} style={({ pressed }) => [styles.rewardsLink, { backgroundColor: th.surface, borderColor: rewardsOn ? th.accent : th.border }, pressed && { opacity: 0.8 }]}>
            <View style={[styles.holdTile, { backgroundColor: DARK_TILE }]}><GiftIcon size={22} color="#fff" /></View>
            <View style={styles.flex}>
              <Text style={[styles.holdName, { color: th.text }]}>{t('Rewards & quests')}</Text>
              <Text style={[styles.holdChg, { color: th.muted }]}>{rewardsOn ? t('A reward is ready to claim') : t('Earn credits every day')}</Text>
            </View>
            {rewardsOn && <View style={[styles.rewardsLinkDot, { backgroundColor: th.accent }]} />}
            <Text style={{ color: th.muted, fontSize: 18 }}>›</Text>
          </Pressable>
        )}

        {/* section chips — like the home categories, for wallet sections */}
        <View style={styles.wTabs}>
          {([['assets', 'Assets'], ['history', 'History']] as const).map(([k, label]) => {
            const on = section === k;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setSection(k); }} style={[styles.wTab, { backgroundColor: on ? (th.mode === 'dark' ? '#2A2A30' : '#E7E9ED') : 'transparent' }]}>
                <Text style={[styles.wTabTxt, { color: on ? th.text : th.muted }]}>{t(label)}</Text>
              </Pressable>
            );
          })}
        </View>

        {section === 'assets' ? (
        <>
        {/* holdings — cash + live-priced project shares */}
        <View style={{ gap: 10, marginTop: 6 }}>
          {holdings.map((h) => (
            <View key={h.id} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.holdTile, { backgroundColor: DARK_TILE }]}><Mark mark={h.mark} size={24} /></View>
              <View style={styles.flex}>
                <Text style={[styles.holdName, { color: th.text }]}>{h.name}</Text>
                <Text style={[styles.holdChg, { color: th.muted }]}>{t(h.sub)}</Text>
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

        {/* creations — what you minted, earning on the Market */}
        {creations.length > 0 && (
          <>
            <Text style={[styles.secTitle, { color: th.text }]}>{t('Creations')}</Text>
            <View style={{ gap: 10 }}>
              {creations.slice(0, 6).map((c) => {
                const hue = phash(c.title) % 360;
                return (
                <View key={c.id} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                  <LinearGradient colors={[`hsl(${hue}, 68%, 46%)`, `hsl(${(hue + 42) % 360}, 66%, 26%)`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.holdTile, c.rarity ? { borderWidth: 2, borderColor: RARITY_COLOR[c.rarity] } : null]}><Text style={{ fontSize: 18 }}>{c.emoji}</Text></LinearGradient>
                  <View style={styles.flex}>
                    <Text style={[styles.holdName, { color: th.text }]} numberOfLines={1}>{c.title}</Text>
                    <Text style={[styles.holdChg, { color: th.muted }]} numberOfLines={1}>{c.rarity ? `${c.rarity} · ` : `${c.surface} · `}⟡{c.rate}/min</Text>
                  </View>
                  <Text style={[styles.holdAmt, { color: '#22c55e' }]}>⟡ {c.collected.toLocaleString()}</Text>
                </View>
                );
              })}
            </View>
          </>
        )}
        </>
        ) : (
        <View style={{ gap: 10, marginTop: 6 }}>
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
        )}
      </ScrollView>
      {pad && <AmountPad th={th} kind={pad} balance={balance} onClose={() => setPad(null)} onConfirm={confirmPad} />}
    </View>
  );
}

/* ══════════════════════════════════ styles ══════════════════════════════════ */

const styles = StyleSheet.create({
  flex: { flex: 1 },

  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', userSelect: 'none' },
  drag: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  grab: { width: 44, height: 5, borderRadius: 3 },
  winCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  window: { width: '100%', maxWidth: 460, height: '82%', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  winDock: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 452, borderLeftWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 17, fontWeight: '600' },
  headTitle: { fontSize: 18, fontWeight: '800' },

  /* profile */
  cover: { height: 110 },
  profileHead: { alignItems: 'center', paddingHorizontal: 18, marginTop: -50 },
  bigAvatarRing: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  bigAvatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  bigAvatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarCam: { position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  editBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 9, marginTop: 14 },
  editTxt: { fontSize: 14, fontWeight: '700' },
  pad: { paddingHorizontal: 18, paddingTop: 6 },
  pName: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  pHandle: { fontSize: 14, marginTop: 3, textAlign: 'center' },
  levelCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  levelLvl: { fontSize: 14, fontWeight: '800' },
  levelNext: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  levelTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  levelFill: { height: 8, borderRadius: 4 },
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

  /* profile notifications tab */
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 11 },
  notifTile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifRowTitle: { fontSize: 14.5, fontWeight: '700' },
  notifRowBody: { fontSize: 12.5, marginTop: 2 },
  notifRowTime: { fontSize: 11.5, fontWeight: '600' },

  /* network */
  row: { flexDirection: 'row', alignItems: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 11 },
  personAv: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 15, fontWeight: '700' },
  personHandle: { fontSize: 12.5 },
  personMeta: { fontSize: 12.5, marginTop: 2 },
  followBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  followTxt: { fontSize: 12.5, fontWeight: '800' },

  /* person detail (their ONE) */
  personHero: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  followsYouChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  followsYouTxt: { fontSize: 11.5, fontWeight: '700' },
  personBio: { fontSize: 15, lineHeight: 21, marginTop: 20, textAlign: 'center' },
  personTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  personTag: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  personTagTxt: { fontSize: 12.5, fontWeight: '700' },
  personCta: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  personCtaTxt: { fontSize: 15, fontWeight: '800' },

  /* wallet */
  balCard: { borderRadius: 20, padding: 22, marginTop: 4 },
  balTop: { flexDirection: 'row', alignItems: 'flex-start' },
  balChg: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  balChgTxt: { fontSize: 12, fontWeight: '800' },
  balLbl: { fontSize: 13, fontWeight: '600' },
  balAmt: { fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  wBtnRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  wBtn: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  wBtnAlt: { borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  wBtnTxt: { fontSize: 15, fontWeight: '800' },
  wTabs: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 2 },
  wTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  wTabTxt: { fontSize: 13.5, fontWeight: '700' },

  /* amount pad (deposit / withdraw) */
  padBody: { flex: 1, paddingHorizontal: 18 },
  amtWrap: { alignItems: 'center', paddingVertical: 20 },
  amtBig: { fontSize: 54, fontWeight: '800', fontVariant: ['tabular-nums'] },
  amtHint: { fontSize: 13, marginTop: 6, fontWeight: '600' },
  padLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  payName: { fontSize: 15, fontWeight: '700' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14 },
  keyTxt: { fontSize: 26, fontWeight: '600' },
  padCta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  padCtaTxt: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  secTitle: { fontSize: 17, fontWeight: '800', marginTop: 26, marginBottom: 12 },
  /* rewards */
  rwHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rwTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  rwSub: { fontSize: 13, marginTop: 1 },
  rwCard: { borderRadius: 20, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  rwCardTop: { flexDirection: 'row', alignItems: 'center' },
  rwStreakTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  rwDayLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '700' },
  rwPips: { flexDirection: 'row', gap: 7, marginTop: 14, marginBottom: 16 },
  rwPip: { flex: 1, height: 8, borderRadius: 4 },
  rwClaim: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  rwClaimTxt: { fontSize: 15.5, fontWeight: '800' },
  rwBack: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  rwQuestHead: { flexDirection: 'row', alignItems: 'center' },
  rwProgress: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  rwQuestClaim: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 },
  rwQuestClaimTxt: { fontSize: 14, fontWeight: '800' },
  rwQuestLocked: { fontSize: 14, fontWeight: '700', opacity: 0.6 },
  rewardsLink: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginTop: 12 },
  rewardsLinkDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
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
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 2 },
  segmentBtn: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999 },
  segmentTxt: { fontSize: 13, fontWeight: '800' },
});
