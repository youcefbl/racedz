import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type RaceDZLogoProps = {
  className?: string;
  showWordmark?: boolean;
  animated?: boolean;
};

export function RaceDZLogo({ className, showWordmark = true, animated = false }: RaceDZLogoProps) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2", className)} aria-label="RaceDZ home">
      <RaceDZMark className="size-9 shrink-0" animated={animated} />
      {showWordmark ? (
        <span className="text-xl font-black tracking-tight text-[var(--text-strong)]">
          Race<span style={{ color: "var(--primary)" }}>DZ</span>
        </span>
      ) : null}
    </Link>
  );
}

const CHEVRONS = [
  { d: "M7 11 L16 20 L7 29", stroke: "var(--primary)", o: 0.35 },
  { d: "M15 11 L24 20 L15 29", stroke: "var(--primary)", o: 0.7 },
  { d: "M23 11 L32 20 L23 29", stroke: "var(--accent)", o: 1 }
];

/**
 * RaceDZ "Velocity" mark: three forward chevrons accelerating into the brand accent.
 * Colors use theme tokens (--primary / --accent), so it adapts to light, dark, and race modes.
 * When `animated`, the chevrons brighten in sequence (forward-flow), respecting reduced-motion.
 */
export function RaceDZMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="RaceDZ" fill="none">
      <g className={animated ? "rz-chevrons" : undefined} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        {CHEVRONS.map((chevron) => (
          <path
            key={chevron.d}
            d={chevron.d}
            stroke={chevron.stroke}
            opacity={chevron.o}
            style={animated ? ({ "--rz-o": chevron.o } as CSSProperties) : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
