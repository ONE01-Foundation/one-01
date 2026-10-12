/**
 * useSharedReplyNotifications — keeps ALL communication flowing through ONE.
 *
 * For every process the user SHARED (has a shareCode), subscribe in the
 * background to its shared thread. When the OTHER side (role 'human') posts,
 * ONE surfaces it: a unit notification + an unread bump — so the user hears
 * about a provider's reply inside ONE, without opening the thread.
 *
 * Realtime INSERT events only fire for messages posted AFTER we subscribe, so
 * reconnecting never replays old messages as fresh notifications.
 */
import { useEffect } from 'react';
import { useMvpStore } from '../stores/mvpStore';
import { getSharedUnitByCode, subscribeSharedMessages } from '../services/cloudShared';

export function useSharedReplyNotifications(): void {
  // Re-subscribe only when the set of shared processes changes (id:code pairs).
  const sharedKey = useMvpStore((s) =>
    s.units
      .filter((u) => u.shareCode)
      .map((u) => `${u.id}:${u.shareCode}`)
      .sort()
      .join('|'),
  );

  useEffect(() => {
    if (!sharedKey) return;
    const pairs = sharedKey.split('|').map((p) => {
      const idx = p.lastIndexOf(':');
      return { unitId: p.slice(0, idx), code: p.slice(idx + 1) };
    });

    let alive = true;
    const unsubs: Array<() => void> = [];

    for (const { unitId, code } of pairs) {
      (async () => {
        const uid = (await getSharedUnitByCode(code))?.id;
        if (!alive || !uid) return;
        const off = subscribeSharedMessages(uid, (m) => {
          const store = useMvpStore.getState();
          const cur = store.units.find((u) => u.id === unitId);
          if (!cur) return;
          // Only the OTHER side's messages are "news". My role is 'one' when I
          // shared this process, 'human' when I joined someone else's — notify
          // on the opposite role, so BOTH sides hear about replies.
          const myRole = cur.sharedRole ?? 'one';
          if (m.role === myRole) return;
          store.pushUnitNotification({
            unitId,
            text: `${m.author}: ${m.text}`,
            emoji: '💬',
            kind: 'update',
          });
          store.updateUnit(unitId, {
            unreadUpdates: (cur.unreadUpdates ?? 0) + 1,
            lastUpdatedAt: new Date().toISOString(),
          });
        });
        if (alive) unsubs.push(off);
        else off();
      })();
    }

    return () => {
      alive = false;
      unsubs.forEach((f) => f());
    };
  }, [sharedKey]);
}
