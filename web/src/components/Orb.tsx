/**
 * Orb — the ONE face. A dark circle with two "cut-out" eyes, matching the
 * mobile app's agent head. Eyes can drift via `look` (−1 up … 1 down) and
 * `gaze` (−1 left … 1 right) so the product surfaces can make it feel alive.
 */
export function Orb({
  size = 84,
  faceColor = "#0A0A0A",
  eyeColor = "#F5F4F0",
  look = 0,
  gaze = 0,
  eyeR = 8,
  alive = false,
  className,
}: {
  size?: number;
  faceColor?: string;
  eyeColor?: string;
  look?: number;
  gaze?: number;
  /** Eye radius in the 100×100 viewBox (default 8). Bigger reads friendlier. */
  eyeR?: number;
  /** When true the eyes blink on a slow cadence (feels alive). */
  alive?: boolean;
  className?: string;
}) {
  // Eye geometry in a 100×100 viewBox.
  const cy = 45 + look * 6;
  const cx = 16 + gaze * 5;
  const eyeClass = alive ? "orb-eye" : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill={faceColor} />
      <circle className={eyeClass} cx={34 + cx - 16} cy={cy} r={eyeR} fill={eyeColor} />
      <circle className={eyeClass} cx={66 + cx - 16} cy={cy} r={eyeR} fill={eyeColor} />
    </svg>
  );
}
