import Link from "next/link";
import { cn } from "@/lib/utils";
import { ZIDRUN_LOGO_SVG, ZIDRUN_MARK_SVG } from "./zidrun-logo-svg";

type ZidRunLogoProps = {
  className?: string;
  showWordmark?: boolean;
  /** kept for backwards-compat with previous callers; no longer used */
  animated?: boolean;
};

/**
 * ZidRun brand logo. Renders the official vectorized artwork.
 * - The wordmark ("idRun") inherits `currentColor`, so it flips to white in
 *   dark/race themes (driven by `--text-strong` via the `.zid-logo` class).
 * - The Z blades use `--zid-green` / `--zid-orange` CSS vars, recolored to neon
 *   in race mode (see globals.css), with a subtle glow.
 */
export function ZidRunLogo({ className, showWordmark = true }: ZidRunLogoProps) {
  return (
    <Link
      href="/"
      className={cn("zid-logo group inline-flex items-center", className)}
      aria-label="ZidRun home"
    >
      {showWordmark ? (
        <span
          className="zid-logo-mark zid-logo-full"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ZIDRUN_LOGO_SVG }}
        />
      ) : (
        <span
          className="zid-logo-mark zid-logo-icon"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ZIDRUN_MARK_SVG }}
        />
      )}
    </Link>
  );
}

/** Icon-only ZidRun mark (the Z). */
export function ZidRunMark({ className }: { className?: string; animated?: boolean }) {
  return (
    <span
      className={cn("zid-logo zid-logo-mark zid-logo-icon", className)}
      aria-label="ZidRun"
      role="img"
      dangerouslySetInnerHTML={{ __html: ZIDRUN_MARK_SVG }}
    />
  );
}
