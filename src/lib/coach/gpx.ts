import type { RunRoutePoint } from "@/components/coach/types";

// GPX (GPS Exchange Format) import/export. Lets runners take their data out (export any run as a
// .gpx) and bring runs recorded elsewhere in (a watch, another app). Closes the long-standing
// `RunnerRunSource.IMPORTED` stub. Stored route points use `t` = epoch milliseconds, matching the
// live recorder and the splits math in run-stats.ts.

export class GpxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxError";
  }
}

export type ParsedGpx = {
  route: RunRoutePoint[];
  distanceKm: number;
  durationSeconds: number;
  startedAt: Date;
  name: string | null;
};

const EARTH_RADIUS_KM = 6371;

// Great-circle distance between two lat/lng points, in kilometres.
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs);
  return match ? match[1] : null;
}

function childText(inner: string | undefined, tag: string): string | null {
  if (!inner) return null;
  const match = new RegExp(`<${tag}[^>]*>\\s*([^<]+?)\\s*</${tag}>`, "i").exec(inner);
  return match ? match[1] : null;
}

// Parse a GPX document into a route plus derived distance/duration. Reads track points (<trkpt>);
// requires at least two points with valid timestamps so a run's pace can be computed. Deliberately
// regex-based (no XML dependency): GPX track points are flat and well-structured, and we only need
// lat/lon/ele/time.
export function parseGpx(xml: string): ParsedGpx {
  if (!xml || !/<gpx[\s>]/i.test(xml)) {
    throw new GpxError("This file does not look like a GPX file.");
  }

  const name = childText(xml, "name")?.slice(0, 120) ?? null;

  const route: RunRoutePoint[] = [];
  const trkptRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let match: RegExpExecArray | null;
  while ((match = trkptRe.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const inner = match[2];
    const lat = Number.parseFloat(attr(attrs, "lat") ?? "");
    const lng = Number.parseFloat(attr(attrs, "lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    const eleRaw = childText(inner, "ele");
    const ele = eleRaw !== null && Number.isFinite(Number.parseFloat(eleRaw)) ? Number.parseFloat(eleRaw) : null;

    const timeRaw = childText(inner, "time");
    const t = timeRaw ? Date.parse(timeRaw) : NaN;

    route.push({ lat, lng, ele, t: Number.isFinite(t) ? t : null });
  }

  if (route.length < 2) {
    throw new GpxError("The GPX file has no usable track (need at least two track points).");
  }

  // Distance: sum of consecutive great-circle hops.
  let distanceKm = 0;
  for (let i = 1; i < route.length; i += 1) {
    distanceKm += haversineKm(route[i - 1]!, route[i]!);
  }
  if (distanceKm < 0.1) {
    throw new GpxError("The GPX track is too short to import as a run.");
  }

  // Duration: elapsed time between the first and last timed points.
  const timed = route.filter((point) => typeof point.t === "number");
  if (timed.length < 2) {
    throw new GpxError("The GPX track has no timestamps, so a run time can't be computed.");
  }
  const startTs = timed[0]!.t as number;
  const endTs = timed[timed.length - 1]!.t as number;
  const durationSeconds = Math.round((endTs - startTs) / 1000);
  if (durationSeconds < 60) {
    throw new GpxError("The GPX run is shorter than a minute — it can't be imported.");
  }
  if (durationSeconds > 172800) {
    throw new GpxError("The GPX run is longer than 48 hours, which looks wrong.");
  }

  const startedAt = new Date(startTs);
  if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new GpxError("The GPX start time is invalid.");
  }

  return {
    route,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationSeconds,
    startedAt,
    name
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build a GPX 1.1 document from a stored run: one track, one segment, a <trkpt> per route point
// with elevation and timestamp when available.
export function buildGpx(run: {
  name: string | null;
  startedAt: Date | string;
  route: RunRoutePoint[];
}): string {
  const name = escapeXml(run.name?.trim() || "ZidRun run");
  const startedIso = (run.startedAt instanceof Date ? run.startedAt : new Date(run.startedAt)).toISOString();

  const points = run.route
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => {
      const ele = typeof point.ele === "number" ? `\n        <ele>${point.ele.toFixed(1)}</ele>` : "";
      const time = typeof point.t === "number" ? `\n        <time>${new Date(point.t).toISOString()}</time>` : "";
      return `      <trkpt lat="${point.lat}" lon="${point.lng}">${ele}${time}\n      </trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ZidRun" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${startedIso}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}
