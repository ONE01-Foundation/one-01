/**
 * SharedThread — the common conversation of a shared Unit, shown the same on
 * BOTH sides: the owner (posts as role 'one' — ONE representing them) and the
 * joined provider (posts as role 'human'). Polls the live thread and posts via
 * the cloudShared RPCs. Pure thread + reply row; the caller frames it (header,
 * sheet, overlay).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../utils/theme';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import {
  getSharedMessages,
  postSharedMessage,
  getSharedUnitByCode,
  subscribeSharedMessages,
  type SharedMessage,
} from '../../services/cloudShared';

export function SharedThread({
  code,
  unitId,
  myName,
  role,
  active = true,
  colors,
  lang,
}: {
  code: string;
  /** The shared unit's uuid, when the caller has it (else resolved from code) —
   *  used for the realtime filter. */
  unitId?: string;
  myName: string;
  role: 'one' | 'human';
  /** Subscribe/poll only while the view is actually on screen. */
  active?: boolean;
  colors: ThemeColors;
  lang: 'en' | 'he';
}) {
  const he = lang === 'he';
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [text, setText] = useState('');

  // Merge in messages by id (so realtime + poll + our own posts never dupe),
  // kept in chronological order.
  const upsert = useCallback((incoming: SharedMessage[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  // LIVE: initial load → subscribe to realtime inserts → a slow fallback poll in
  // case the socket drops. All comms flow through the shared thread, instantly.
  useEffect(() => {
    if (!active || !code) return;
    let alive = true;
    let unsub = () => {};
    (async () => {
      const initial = await getSharedMessages(code);
      if (!alive) return;
      setMessages(initial);
      const uid = unitId ?? (await getSharedUnitByCode(code))?.id;
      if (!alive || !uid) return;
      unsub = subscribeSharedMessages(uid, (m) => { if (alive) upsert([m]); });
    })();
    const poll = setInterval(async () => {
      const m = await getSharedMessages(code);
      if (alive) upsert(m);
    }, 15000);
    return () => { alive = false; clearInterval(poll); unsub(); };
  }, [active, code, unitId, upsert]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    haptic.select();
    setText('');
    const posted = await postSharedMessage(code, myName || (he ? 'אני' : 'Me'), role, t);
    if (posted) upsert([posted]);
  }, [text, code, myName, role, he, upsert]);

  return (
    <View style={styles.wrap}>
      <View style={styles.thread}>
        {messages.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }, rtlText(lang)]}>
            {he ? 'אין הודעות עדיין.' : 'No messages yet.'}
          </Text>
        ) : messages.map((m) => {
          const mine = m.author === myName && m.role === role;
          return (
            <View
              key={m.id}
              style={[
                styles.msg,
                mine ? styles.msgMine : styles.msgTheirs,
                { backgroundColor: mine ? colors.text : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.author, { color: mine ? colors.background : colors.textSecondary }]}>
                {m.role === 'one' ? `${m.author} · ONE` : m.author}
              </Text>
              <Text style={[styles.text, { color: mine ? colors.background : colors.text }]}>{m.text}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.replyRow, rtlRow(lang)]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={he ? 'כתוב הודעה…' : 'Write a message…'}
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={send}
          style={[styles.reply, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }, rtlText(lang)]}
        />
        <Pressable onPress={send} style={[styles.sendBtn, { backgroundColor: colors.text }]} accessibilityRole="button">
          <Text style={[styles.sendText, { color: colors.background }]}>{he ? 'שלח' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  thread: { gap: 8 },
  empty: { fontSize: 14, lineHeight: 20 },
  msg: { maxWidth: '85%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  msgMine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  msgTheirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  author: { fontSize: 11, fontWeight: '700' },
  text: { fontSize: 14.5, lineHeight: 20 },
  replyRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  reply: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  sendBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 15, fontWeight: '700' },
});
