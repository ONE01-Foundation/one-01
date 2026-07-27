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
  closed = false,
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
  /** When true the eyes close to slits — ONE is concentrating / working. */
  closed?: boolean;
  className?: string;
}) {
  // Eye geometry in a 100×100 viewBox.
  const cy = 45 + look * 6;
  const cx = 16 + gaze * 5;
  const eyeClass = alive ? "orb-eye" : undefined;
  const lx = 34 + cx - 16;
  const rx = 66 + cx - 16;
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
      {closed ? (
        <>
          {/* Closed eyes — thin rounded slits. */}
          <rect x={lx - eyeR} y={cy - eyeR * 0.28} width={eyeR * 2} height={eyeR * 0.56} rx={eyeR * 0.28} fill={eyeColor} />
          <rect x={rx - eyeR} y={cy - eyeR * 0.28} width={eyeR * 2} height={eyeR * 0.56} rx={eyeR * 0.28} fill={eyeColor} />
        </>
      ) : (
        <>
          <circle className={eyeClass} cx={lx} cy={cy} r={eyeR} fill={eyeColor} />
          <circle className={eyeClass} cx={rx} cy={cy} r={eyeR} fill={eyeColor} />
        </>
      )}
    </svg>
  );
}
