/**
 * AgentBroadcast – One short rotating line. Hat-based. Updates ~5s. Live intelligence feel.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { getBroadcastMessagesForHats } from '../core/broadcastMessages';

const ROTATE_MS = 5000;

export function AgentBroadcast() {
  const { colors } = useThemeStore();
  const { user } = useOne();
  const messages = useMemo(() => {
    if (!user) return [];
    const hats = user.agent?.hats ?? ['base'];
    return getBroadcastMessagesForHats(hats);
  }, [user?.agent?.hats, user]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [messages.length]);

  const line = messages.length ? messages[index] : '';

  if (!line) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.line, { color: colors.textSecondary }]} numberOfLines={2}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  line: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
