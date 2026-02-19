/**
 * HomePager – Vertical OS: Discovery (top) | Home NOW (middle) | Timeline (bottom).
 * One fixed orb + OneCenterBg; only content layers scroll. scrollToPage brings a panel into view.
 */

import React, { createContext, useCallback, useContext, useRef, useEffect, useState, useMemo } from 'react';
import { ScrollView, View, useWindowDimensions, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DiscoveryPreviewScreen } from '../screens/DiscoveryPreviewScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProcessesPreviewScreen } from '../screens/ProcessesPreviewScreen';
import { OneCenterBg } from '../components/OneCenterBg';
import { EdgeGradientBars } from '../components/EdgeGradientBars';
import { OrbAgent } from '../components/OrbAgent';
import { useOne } from '../core/OneContext';
import { useThemeStore } from '../stores/themeStore';
import { getHatColor } from '../core/types';
import type { Hat } from '../core/types';

export type HomePagerScrollContextValue = {
  scrollToPage: (index: number) => void;
  registerAgentModalTrigger: (fn: (() => void) | null) => void;
};

const HomePagerScrollContext = createContext<HomePagerScrollContextValue | null>(null);

export function useHomePagerScroll(): HomePagerScrollContextValue | null {
  return useContext(HomePagerScrollContext);
}

const ORB_SIZE = 72;
const ORB_ZONE_TOP_OFFSET = 56;
const ORB_ZONE_HEIGHT = ORB_SIZE + 24;

export function HomePager() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user, agentStatusText } = useOne();
  const scrollRef = useRef<ScrollView>(null);
  const agentModalTriggerRef = useRef<(() => void) | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const scrollToPage = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ y: index * height, animated: true });
    },
    [height]
  );

  const registerAgentModalTrigger = useCallback((fn: (() => void) | null) => {
    agentModalTriggerRef.current = fn;
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const page = Math.round(y / height);
      setCurrentPageIndex(Math.max(0, Math.min(2, page)));
    },
    [height]
  );

  const orbZoneTop = insets.top + ORB_ZONE_TOP_OFFSET;

  const rotatingLines = useMemo(() => {
    if (!user) return [];
    const lines: string[] = ['What are we building today?', 'Momentum is high today — good time to execute'];
    const active = user.processes.filter((p) => p.status === 'active');
    if (active.length > 0) lines.push(`Process active: ${active[0].title}`);
    return lines;
  }, [user]);

  const [labelIndex, setLabelIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % Math.max(1, rotatingLines.length));
    }, 3000);
    return () => clearInterval(id);
  }, [rotatingLines.length]);

  const orbLabelLines = useMemo(() => {
    if (currentPageIndex === 0) return ['Discovery', 'Swipe down to see Discovery'];
    if (currentPageIndex === 2) return ["Timeline", "Swipe up to see what's next"];
    if (agentStatusText) return ['One Agent', agentStatusText];
    return rotatingLines.length ? ['One Agent', rotatingLines[labelIndex]] : ['One Agent'];
  }, [currentPageIndex, agentStatusText, rotatingLines, labelIndex]);

  const primaryHat = (user?.agent?.hats ?? ['base']).filter((h: Hat) => h !== 'base')[0] ?? 'base';
  const orbGlow = getHatColor(primaryHat);

  const orbMode = currentPageIndex === 0 ? 'discovery' : currentPageIndex === 2 ? 'process' : 'home';

  const onOrbPress = useCallback(() => {
    if (currentPageIndex === 0) {
      scrollToPage(0);
    } else if (currentPageIndex === 1) {
      agentModalTriggerRef.current?.();
    } else {
      // Timeline panel – no action or scroll to 2
    }
  }, [currentPageIndex, scrollToPage]);

  const contextValue: HomePagerScrollContextValue = useMemo(
    () => ({ scrollToPage, registerAgentModalTrigger }),
    [scrollToPage, registerAgentModalTrigger]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: height, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [height]);

  return (
    <HomePagerScrollContext.Provider value={contextValue}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <OneCenterBg />
        <EdgeGradientBars />
        <View style={[styles.fixedOrbWrap, { top: orbZoneTop }]} pointerEvents="box-none">
          <OrbAgent
            size={ORB_SIZE}
            state="idle"
            mode={orbMode}
            labelLines={orbLabelLines}
            onPress={currentPageIndex === 1 ? onOrbPress : undefined}
            tappable={currentPageIndex === 1}
            glowColor={orbGlow}
            typingEffect={currentPageIndex === 1}
            showFace
          />
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ height: height * 3 }}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          bounces={true}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          <View style={{ height }}>
            <DiscoveryPreviewScreen />
          </View>
          <View style={{ height }}>
            <HomeScreen />
          </View>
          <View style={{ height }}>
            <ProcessesPreviewScreen />
          </View>
        </ScrollView>
      </View>
    </HomePagerScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  fixedOrbWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ORB_ZONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
