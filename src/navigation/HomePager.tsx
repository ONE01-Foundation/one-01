/**
 * HomePager – Vertical OS: Discovery (top) | Home NOW (middle) | Timeline (bottom).
 * One tap to full Discovery / Process from previews.
 */

import React, { useRef, useEffect } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { DiscoveryPreviewScreen } from '../screens/DiscoveryPreviewScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProcessesPreviewScreen } from '../screens/ProcessesPreviewScreen';

export function HomePager() {
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Start on middle page (Home). ScrollView doesn't support initial contentOffset on first render reliably on all platforms;
    // scrollTo is called after mount.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: height, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [height]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ height: height * 3 }}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      bounces={true}
      decelerationRate="fast"
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
  );
}
