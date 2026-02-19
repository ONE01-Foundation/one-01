/**
 * DiscoveryPreview – Top of vertical OS. Swipe down to see Discovery (layer comes to you).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../stores/themeStore';
import { useHomePagerScroll } from '../navigation/HomePager';

const DISCOVERY_PANEL_INDEX = 0;
const CONTENT_TOP = 56 + 72 + 24 + 16;

export function DiscoveryPreviewScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const pagerScroll = useHomePagerScroll();

  const onSeeDiscovery = () => {
    pagerScroll?.scrollToPage(DISCOVERY_PANEL_INDEX);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, minHeight: height }]}>
      <View style={[styles.content, { paddingTop: insets.top + CONTENT_TOP }]}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Swipe down to see Discovery</Text>
        <TouchableOpacity
          style={[styles.enterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onSeeDiscovery}
        >
          <Text style={[styles.enterBtnText, { color: colors.primary }]}>See Discovery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 24 },
  hint: { fontSize: 14, marginBottom: 24 },
  enterBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1 },
  enterBtnText: { fontSize: 16, fontWeight: '600' },
});
