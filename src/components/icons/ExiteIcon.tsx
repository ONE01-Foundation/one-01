/**
 * Vector from assets/icons/exite-icon.svg — keep paths in sync when the asset changes.
 */
import { useId } from 'react';
import Svg, { Path, G, Defs, ClipPath, Mask, Rect } from 'react-native-svg';

const EXITE_X_PATH =
  'M22.9527 26.8306L17.2599 32.5234C16.8262 32.9571 16.3057 33.1739 15.6983 33.1739C15.0912 33.1741 14.5707 32.9573 14.1368 32.5234C13.7029 32.0895 13.4861 31.569 13.4863 30.9619C13.4863 30.3546 13.7031 29.834 14.1368 29.4004L19.8296 23.7076L14.1368 18.0148C13.7031 17.5811 13.4863 17.0606 13.4863 16.4532C13.4861 15.8461 13.7029 15.3256 14.1368 14.8917C14.5707 14.4578 15.0912 14.241 15.6983 14.2412C16.3057 14.2412 16.8262 14.458 17.2599 14.8917L22.9527 20.5845L28.6455 14.8917C29.0792 14.458 29.5997 14.2412 30.207 14.2412C30.8141 14.241 31.3346 14.4578 31.7685 14.8917C32.2024 15.3256 32.4193 15.8461 32.4191 16.4532C32.4191 17.0606 32.2022 17.5811 31.7685 18.0148L26.0757 23.7076L31.7685 29.4004C32.2022 29.834 32.4191 30.3546 32.4191 30.9619C32.4193 31.569 32.2024 32.0895 31.7685 32.5234C31.3346 32.9573 30.8141 33.1741 30.207 33.1739C29.5997 33.1739 29.0792 32.9571 28.6455 32.5234L22.9527 26.8306Z';

export function ExiteIcon({ color = 'rgba(255,255,255,0.45)', size = 22 }: { color?: string; size?: number }) {
  const rid = useId().replace(/:/g, '');
  const clipId = `${rid}_exite_clip`;
  const m0 = `${rid}_exite_m0`;
  const m1 = `${rid}_exite_m1`;

  return (
    <Svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <Defs>
        <ClipPath id={clipId}>
          <Rect width={46} height={46} fill="#ffffff" />
        </ClipPath>
        <Mask id={m0} maskUnits="userSpaceOnUse" x={0} y={0} width={46} height={46} maskType="luminance">
          <Path d="M46 0H0V46H46V0Z" fill="#ffffff" />
        </Mask>
        <Mask id={m1} maskUnits="userSpaceOnUse" x={-6} y={-6} width={58} height={58} maskType="alpha">
          <Path d="M22.9991 -5.28427L-5.28516 23L22.9991 51.2843L51.2834 23L22.9991 -5.28427Z" fill="#000000" />
        </Mask>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <G mask={`url(#${m0})`}>
          <G mask={`url(#${m1})`}>
            <Path d={EXITE_X_PATH} fill={color} />
          </G>
        </G>
      </G>
    </Svg>
  );
}
