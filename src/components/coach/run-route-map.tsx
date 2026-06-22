import type { RunRoutePoint } from "@/components/coach/types";

/**
 * Dependency-free route renderer: normalizes GPS points to an SVG polyline (keeps aspect ratio).
 * Shows the run's shape with start (teal) and end (orange) markers. No map tiles / API keys.
 */
export function RunRouteMap({ points, className }: { points: RunRoutePoint[] | null | undefined; className?: string }) {
  if (!points || points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const size = 100;
  const pad = 8;
  const span = Math.max(1e-6, maxLat - minLat, maxLng - minLng);
  // Center the smaller axis within the square viewBox.
  const offsetX = (span - (maxLng - minLng)) / 2;
  const offsetY = (span - (maxLat - minLat)) / 2;

  const project = (p: RunRoutePoint): [number, number] => {
    const x = pad + (p.lng - minLng + offsetX) / span * (size - 2 * pad);
    const y = pad + (maxLat - p.lat + offsetY) / span * (size - 2 * pad);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  };

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${project(p).join(" ")}`).join(" ");
  const start = project(points[0]);
  const end = project(points[points.length - 1]);

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Run route">
      <rect x="0" y="0" width="100" height="100" rx="8" className="fill-gray-50" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={start[0]} cy={start[1]} r="3.2" fill="var(--primary)" />
      <circle cx={end[0]} cy={end[1]} r="3.2" fill="var(--accent)" />
    </svg>
  );
}
