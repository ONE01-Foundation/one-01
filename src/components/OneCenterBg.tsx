/**
 * OneCenterBg – Second layer after background. Soft gradient circle from one-center-bg.svg.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const VIEWBOX_WIDTH = 295;
const VIEWBOX_HEIGHT = 536;

export function OneCenterBg() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={styles.svg}
      >
        <Defs>
          <LinearGradient
            id="oneCenterGradient"
            x1="147"
            y1="127"
            x2="147"
            y2="409"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0.219" stopColor="#F1F1F3" stopOpacity="0" />
            <Stop offset="1" stopColor="#F1F1F3" />
          </LinearGradient>
        </Defs>
        <Circle cx="147" cy="268" r="141" fill="url(#oneCenterGradient)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});
