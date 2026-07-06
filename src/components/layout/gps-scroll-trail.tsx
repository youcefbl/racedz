"use client";

import { useEffect, useRef } from "react";

// A vertical "GPS route" pinned to the reading edge that draws itself as you scroll, with
// a runner marker riding the leading edge — a themed reading-progress indicator that
// reflects state (how far through the page you are), not decoration for its own sake.
// On-brand for a running platform ("earned energy in the edges").
//
// Design notes:
// - Generated in 1:1 pixel coordinates (viewBox == the SVG's own size) so the stroke
//   fill's length and the marker's getPointAtLength() share one coordinate system and the
//   dot sits exactly on the end of the filled route at every width.
// - The route is a smooth curve (Catmull-Rom → cubic béziers) through an organic
//   multi-harmonic wander, SEEDED by the page path so every page gets its own route while
//   staying stable across resizes/re-renders.
// - Horizontal swing is capped to the page's edge padding at each breakpoint, so it never
//   crosses into content on full-width (max-w-7xl) pages.
// - Vertically inset to start below the top bar and finish above the bottom bar / footer.
// - Reduced motion: static faint route, no drawing, no marker. RTL-safe via `start-0`.

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small deterministic PRNG so a given seed always yields the same route.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through the points, emitted as cubic béziers → one flowing curve.
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function GpsScrollTrail({ seed = "default" }: { seed?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const baseRef = useRef<SVGPathElement>(null);
  const progRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const svg = svgRef.current;
    const base = baseRef.current;
    const prog = progRef.current;
    const marker = markerRef.current;
    if (!svg || !base || !prog) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let len = 0;

    // Route "shape" params are fixed per page (seeded once); build() only rescales them to
    // the current rail size, so resizing never re-randomises the route.
    const rng = mulberry32(hashString(seed));
    const shape = {
      split: 0.45 + rng() * 0.35, // how much of the swing goes to the slow vs fast wave
      wl1: 150 + rng() * 200, // slow wavelength (px)
      wl2: 70 + rng() * 90, // fast wavelength (px)
      ph1: rng() * Math.PI * 2,
      ph2: rng() * Math.PI * 2,
      dir: rng() < 0.5 ? -1 : 1 // start leaning left or right
    };

    const build = () => {
      const w = svg.clientWidth || 32;
      const h = svg.clientHeight || 100;
      // Cap the swing to the page's edge padding at this breakpoint (≈16/24/32px), so the
      // route stays in the gutter on both narrow (blog) and full-width (max-w-7xl) pages.
      const vw = window.innerWidth;
      const reach = vw < 640 ? 14 : vw < 1024 ? 22 : 30;
      const cx = reach * 0.5;
      const amp = reach * 0.42;
      const a1 = amp * shape.split;
      const a2 = amp - a1;

      const xAt = (y: number) =>
        cx +
        shape.dir *
          (a1 * Math.sin((y / shape.wl1) * Math.PI * 2 + shape.ph1) +
            a2 * Math.sin((y / shape.wl2) * Math.PI * 2 + shape.ph2));

      // Span the visible band exactly: y = 0 (just below the top bar) → y = h (just above
      // the bottom bar). No overhang, so the route's start/end match the rail, and the
      // clipped line, the fill, and the marker all cover the same range.
      const step = 44;
      const pts: Array<[number, number]> = [];
      for (let y = 0; y < h; y += step) pts.push([xAt(y), y]);
      pts.push([xAt(h), h]);
      const d = smoothPath(pts);

      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      base.setAttribute("d", d);
      prog.setAttribute("d", d);
      len = base.getTotalLength();
      prog.style.strokeDasharray = String(len);
    };

    const render = () => {
      rafRef.current = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      prog.style.strokeDashoffset = String(len * (1 - p));
      if (marker) {
        // The marker is absolutely positioned inside the same box as the SVG, and the
        // viewBox is 1:1 with pixels, so the path point maps straight to the marker's
        // offset — no viewport rect math (adding it double-counts the container inset).
        const pt = base.getPointAtLength(len * p);
        marker.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)`;
        marker.style.opacity = p > 0.004 ? "1" : "0";
      }
    };

    build();

    if (reduce) {
      prog.style.strokeDashoffset = "0";
      prog.style.opacity = "0.3";
      if (marker) marker.style.display = "none";
      return;
    }

    render();
    const onScroll = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(render);
    };
    const onResize = () => {
      build();
      render();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [seed]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed start-0 z-[1] w-8 sm:w-10 lg:w-12"
      // Start below the sticky top bar, finish above the mobile bottom nav / footer.
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 4.75rem)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)"
      }}
    >
      <svg ref={svgRef} className="h-full w-full" fill="none" preserveAspectRatio="none">
        <path
          ref={baseRef}
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.16 }}
        />
        <path
          ref={progRef}
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.85 }}
        />
      </svg>
      <div ref={markerRef} className="absolute left-0 top-0" style={{ opacity: 0 }}>
        <span
          className="gps-trail-ping absolute inset-0 -m-1.5 block rounded-full"
          style={{ background: "var(--accent)" }}
        />
        <span
          className="relative block h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
        />
      </div>
    </div>
  );
}
