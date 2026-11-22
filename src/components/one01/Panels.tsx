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
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Modal, Animated, PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  One01Mark, OneMark, WinziMark, MixStarMark, XitMark, UserIcon, WalletIcon, CreateIcon,
} from './brand';
import { type ShellTheme, type MarkId } from '../../data/one01/platform';

const DARK_TILE = '#131317';

function Mark({ mark, size }: { mark: MarkId; size: number }) {
  switch (mark) {
    case 'one': return <OneMark size={size} color="#FFFFFF" eye="#0A0A0A" />;
    case 'winzi': return <WinziMark size={size} />;
    case 'mixstar': return <MixStarMark size={size} />;
    case 'xit': return <XitMark size={size} />;
    case 'one01': default: return <One01Mark size={size} color="#FFFFFF" />;
  }
}

/* ─────────────────────────────── SheetWindow ─────────────────────────────── */

export function SheetWindow({ visible, wide, th, onClose, children }: { visible: boolean; wide: boolean; th: ShellTheme; onClose: () => void; children: (close: () => void) => React.ReactNode }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const prog = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    prog.setValue(0); drag.setValue(0);
    Animated.spring(prog, { toValue: 1, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
  }, [visible, prog, drag]);

  const requestClose = () => Animated.timing(prog, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onClose());

  const sheetTop = insets.top + 54;
  const sheetH = winH - sheetTop;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
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
              {children(requestClose)}
            </Animated.View>
          </View>
        ) : (
          <Animated.View style={[styles.sheet, { top: sheetTop, height: sheetH, backgroundColor: th.bg, transform: [{ translateY: Animated.add(prog.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }), drag) }] }]}>
            <View {...pan.panHandlers} style={styles.drag}><View style={[styles.grab, { backgroundColor: th.border }]} /></View>
            {children(requestClose)}
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

export function ProfilePage({ th, close, onExit, onCreate, onOne01 }: { th: ShellTheme; close: () => void; onExit: () => void; onCreate: () => void; onOne01?: () => void }) {
  const insets = useSafeAreaInsets();
  const stats = [{ v: '128', l: 'Friends' }, { v: '12', l: 'Posts' }, { v: 'LVL 13', l: 'Level' }];
  const actions = [
    onOne01 ? { k: 'one01', label: '← ONE01 home', onPress: onOne01 } : null,
    { k: 'settings', label: 'Settings', onPress: close },
    { k: 'legal', label: 'Legal', onPress: close },
    { k: 'updates', label: 'Feature Updates', onPress: close },
    { k: 'support', label: 'Support', onPress: close },
  ].filter(Boolean) as { k: string; label: string; onPress: () => void }[];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="Profile" onClose={close} right={<Pressable style={[styles.round, { backgroundColor: th.surface, borderColor: th.border }]}><Text style={{ color: th.muted, fontSize: 15 }}>⚙</Text></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* cover + avatar */}
        <LinearGradient colors={[`${th.glow}CC`, th.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />
        <View style={styles.avatarRow}>
          <View style={[styles.bigAvatar, { backgroundColor: DARK_TILE, borderColor: th.bg }]}><UserIcon size={40} color="#fff" /></View>
          <View style={styles.flex} />
          <Pressable style={[styles.editBtn, { backgroundColor: th.accent }]}><Text style={[styles.editTxt, { color: th.accent === '#F9D800' ? '#000' : '#fff' }]}>Edit profile</Text></Pressable>
        </View>
        <View style={styles.pad}>
          <Text style={[styles.pName, { color: th.text }]}>Nobody</Text>
          <Text style={[styles.pHandle, { color: th.muted }]}>@nobody · on ONE01</Text>

          {/* stats */}
          <View style={[styles.statRow, { borderColor: th.border }]}>
            {stats.map((s, i) => (
              <View key={s.l} style={[styles.stat, i < stats.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: th.border }]}>
                <Text style={[styles.statV, { color: th.text }]}>{s.v}</Text>
                <Text style={[styles.statL, { color: th.muted }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.about, { color: th.muted }]}>One ONE01 identity across every app. Your representative shares only what you allow.</Text>

          {/* account actions */}
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
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────── WalletPage ─────────────────────────────── */

export function WalletPage({ th, close }: { th: ShellTheme; close: () => void }) {
  const insets = useSafeAreaInsets();
  const accentFg = th.accent === '#F9D800' ? '#000' : '#fff';
  const holdings: { id: string; mark: MarkId; name: string; amt: string; chg: string; up: boolean }[] = [
    { id: 'one01', mark: 'one01', name: 'ONE01 Credits', amt: '3,500', chg: '+2.4%', up: true },
    { id: 'winzi', mark: 'winzi', name: 'Winzi Tokens', amt: '300', chg: '+8.1%', up: true },
    { id: 'mixstar', mark: 'mixstar', name: 'MixStar', amt: '150', chg: '-1.2%', up: false },
    { id: 'xit', mark: 'xit', name: 'Xit', amt: '42', chg: '+0.3%', up: true },
  ];
  const tx = [
    { k: 't1', label: 'Top up', sub: 'Today · fiat rails', amt: '+500', up: true },
    { k: 't2', label: 'Winzi — Tournament ticket', sub: 'Yesterday', amt: '-50', up: false },
    { k: 't3', label: 'Received · MixStar vote refund', sub: '2 days ago', amt: '+12', up: true },
  ];

  return (
    <View style={styles.flex}>
      <PanelHead th={th} title="Wallet" onClose={close} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* balance card */}
        <LinearGradient colors={[th.accent, `${th.accent}C0`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balCard}>
          <Text style={[styles.balLbl, { color: accentFg, opacity: 0.85 }]}>Total balance</Text>
          <Text style={[styles.balAmt, { color: accentFg }]}>⟡ 3,500</Text>
          <Text style={[styles.balLbl, { color: accentFg, opacity: 0.85 }]}>≈ $3,500 · virtual credits</Text>
        </LinearGradient>

        {/* actions */}
        <View style={styles.walletActions}>
          {['Send', 'Receive', 'Top up', 'Swap'].map((a) => (
            <View key={a} style={styles.walletAction}>
              <View style={[styles.walletActionIcon, { backgroundColor: th.surface, borderColor: th.border }]}>
                <Text style={{ color: th.text, fontSize: 16 }}>{a === 'Send' ? '↑' : a === 'Receive' ? '↓' : a === 'Top up' ? '+' : '⇄'}</Text>
              </View>
              <Text style={[styles.walletActionTxt, { color: th.muted }]}>{a}</Text>
            </View>
          ))}
        </View>

        {/* holdings */}
        <Text style={[styles.secTitle, { color: th.text }]}>Holdings</Text>
        <View style={{ gap: 10 }}>
          {holdings.map((h) => (
            <View key={h.id} style={[styles.holdRow, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={[styles.holdTile, { backgroundColor: DARK_TILE }]}><Mark mark={h.mark} size={24} /></View>
              <View style={styles.flex}>
                <Text style={[styles.holdName, { color: th.text }]}>{h.name}</Text>
                <Text style={[styles.holdChg, { color: h.up ? '#22c55e' : '#ef4444' }]}>{h.chg}</Text>
              </View>
              <Text style={[styles.holdAmt, { color: th.text }]}>⟡ {h.amt}</Text>
            </View>
          ))}
        </View>

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

  /* wallet */
  balCard: { borderRadius: 20, padding: 22, gap: 6, marginTop: 4 },
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
});
