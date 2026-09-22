/**
 * BroadcastRing — a story-style segmented progress ring drawn AROUND the Orb.
 *
 * One arc segment per broadcast line. Segments up to (and including) the current
 * line read bright; the rest sit dim — so ONE's rotating "story" of broadcasts
 * has a visible position + progress, exactly like tapping through Instagram/
 * WhatsApp stories.
 *
 * Rendered as an absolutely-positioned overlay slightly larger than the Orb, so
 * it never touches the face. Pointer-events pass through to whatever handles the
 * tap-to-advance underneath.
 */

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { StyleSheet } from 'react-native';

interface Props {
  /** Outer diameter of the ring (should be a touch larger than the Orb). */
  size: number;
  /** Total broadcast lines → number of segments. */
  count: number;
  /** Current line index (0-based). Segments 0..index read bright. */
  index: number;
  /** Bright (reached) segment colour. */
  color: string;
  /** Dim (upcoming) segment colour. */
  dimColor: string;
  strokeWidth?: number;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180; // 0° = top, clockwise
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function BroadcastRing({ size, count, index, color, dimColor, strokeWidth = 3 }: Props) {
  const n = Math.max(1, count);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - strokeWidth / 2 - 0.5;

  // Single broadcast → a plain full ring (no segment gaps to draw).
  if (n === 1) {
    return (
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }

  const seg = 360 / n;
  const gap = Math.min(9, seg * 0.28); // degrees of empty space between segments
  const segments: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const start = i * seg + gap / 2;
    const end = (i + 1) * seg - gap / 2;
    const reached = i <= index;
    segments.push(
      <Path
        key={i}
        d={arc(cx, cy, r, start, end)}
        stroke={reached ? color : dimColor}
        strokeWidth={reached ? strokeWidth : strokeWidth * 0.7}
        strokeLinecap="round"
        fill="none"
      />,
    );
  }

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      {segments}
    </Svg>
  );
}
