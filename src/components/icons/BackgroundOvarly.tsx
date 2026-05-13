/**
 * Vector from assets/icons/Background-Ovarly.svg — keep circle + gradient line in sync when the asset changes.
 * Stops follow the home / OneScreen oval (theme colors); the file uses two fixed greys.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

export type BackgroundOvarlyProps = {
  gradientId: string;
  backgroundColor: string;
  midColor: string;
  bottomColor: string;
  style?: StyleProp<ViewStyle>;
  /** >1 מגדיל את העיגול ממרכז השכבה (למשל כרטיס One בגלובל) */
  scale?: number;
};

export function BackgroundOvarly({
  gradientId,
  backgroundColor,
  midColor,
  bottomColor,
  style,
  scale = 1,
}: BackgroundOvarlyProps) {
  const svg = (
    <Svg
      viewBox="0 0 375 375"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={[{ width: '100%', height: '100%' }, style]}
    >
      <Defs>
        <SvgLinearGradient
          id={gradientId}
          x1="188"
          y1="27"
          x2="187.5"
          y2="348"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0.45" stopColor={backgroundColor} stopOpacity="0" />
          <Stop offset="0.75" stopColor={midColor} stopOpacity="0.4" />
          <Stop offset="1" stopColor={bottomColor} stopOpacity="0.85" />
        </SvgLinearGradient>
      </Defs>
      <Circle cx="187.5" cy="187.5" r="160.5" fill={`url(#${gradientId})`} />
    </Svg>
  );

  if (scale === 1) {
    return svg;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
      <View style={{ width: '100%', height: '100%', transform: [{ scale }] }} pointerEvents="none">
        {svg}
      </View>
    </View>
  );
}
