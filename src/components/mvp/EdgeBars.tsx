/**
 * EdgeBars — soft top + bottom gradient bars matching the user-provided
 * SVGs (top_bar_bg.svg / bottom_bar_bg.svg, latest revision).
 *
 * Each bar is a 179 px tall vertical gradient that holds the page colour
 * solid for a portion of the bar at the screen edge, then fades to fully
 * transparent toward the centre. Sits ABOVE all content but BELOW the iOS
 * status bar / home indicator so the surface "tucks under" the system chrome.
 *
 *   Top bar     ────────────────  solid (background)
 *                      ╲
 *                       ╲──────── transparent at ~100%
 *                solid from y=0 to y=37%, then fades to transparent at y=100%
 *
 *   Bottom bar          ╱──────── transparent at top
 *                      ╱
 *               ────────────────  solid from y=44% to y=100% (bottom)
 *
 * Theme-aware: the solid colour tracks `colors.background`, so the bar reads
 * as one continuous surface with the page in both light and dark modes.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../stores/themeStore';

// Match the latest user-provided SVG (179 px tall, was 109).
const BAR_HEIGHT = 179;

// Stop offsets from the SVGs.
// Top SVG:    linear-gradient, solid #F5F4F0 from offset 0.370 → transparent at 1.
// Bottom SVG: linear-gradient (drawn bottom→top), solid from offset 0.439 → transparent at 1.
// We render with start at the top edge and end at the bottom edge of each bar,
// so for the BOTTOM bar we invert the stop position: 1 - 0.439 = 0.561.
const TOP_SOLID_STOP = 0.37;
const BOTTOM_SOLID_STOP = 0.561;

interface EdgeBarsProps {
  /** Hide one or both bars (e.g. on screens where the surface should reach
   *  edge-to-edge). Default: both visible. */
  top?: boolean;
  bottom?: boolean;
  /** Override the top / bottom bar height (default BAR_HEIGHT = 179). Sheets
   *  with a fixed header near the top pass a SHORTER top so the fade doesn't
   *  reach down over the title. */
  topHeight?: number;
  bottomHeight?: number;
  /** Use the SHEET-HEADER top gradient (sheets_top bar_bg.svg): a plain LINEAR
   *  fade — solid at the very top edge → transparent at the bottom, with NO hold
   *  region. The default `false` keeps the page-edge look (hold solid to ~37%,
   *  then fade). Colour still tracks the theme background. */
  topLinear?: boolean;
  /** Optional extra styling on the absolute-positioned container. */
  style?: StyleProp<ViewStyle>;
}

export function EdgeBars({ top = true, bottom = true, topHeight, bottomHeight, topLinear = false, style }: EdgeBarsProps) {
  const { colors } = useThemeStore();
  const solid = colors.background;
  // Same hex, alpha 0. RN-Web's gradient renderer needs explicit rgba endpoints.
  const transparent = withAlpha(solid, 0);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.host, style]}>
      {top && (
        // Two shapes:
        //  • default (page edge): solid at top, HOLDS until ~37%, then fades.
        //  • topLinear (sheet header, sheets_top bar_bg.svg): a plain LINEAR
        //    fade solid → transparent over the whole bar, no hold.
        <LinearGradient
          colors={topLinear ? [solid, transparent] : [solid, solid, transparent]}
          locations={topLinear ? [0, 1] : [0, TOP_SOLID_STOP, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.bar, styles.top, topHeight != null && { height: topHeight }]}
        />
      )}
      {bottom && (
        // Transparent at the top edge, fades down to solid at ~56% (= 1 −
        // 0.439 from the SVG's bottom-anchored gradient), then solid through
        // to the bottom edge.
        <LinearGradient
          colors={[transparent, solid, solid]}
          locations={[0, BOTTOM_SOLID_STOP, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.bar, styles.bottom, bottomHeight != null && { height: bottomHeight }]}
        />
      )}
    </View>
  );
}

/** Convert "#RRGGBB" (or a known 3-letter form) to rgba(R,G,B,alpha). */
function withAlpha(hex: string, alpha: number): string {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  // pointerEvents none so the bars don't block taps. zIndex 15 sits ABOVE
  // chart content (cards: 0, messages overlay: 5) and BELOW interactive
  // controls (broadcast text: 20, chat header: 25, input dock: 30).
  // Result: cards + bubbles fade behind the bars at top/bottom, while
  // the orb / broadcast / X+⋮ / input bar always stay crisp on top.
  host: { zIndex: 15 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
  },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
