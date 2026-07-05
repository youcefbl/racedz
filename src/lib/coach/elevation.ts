import "server-only";

import type { RunRoutePoint } from "@/components/coach/types";
import { smoothedElevationGainM } from "@/lib/coach/run-stats";

// GPS altitude on a phone (no barometer) is far too noisy to measure climb — it swings tens of
// metres at a fixed spot, so summing it inflates elevation gain many times over (a flat coastal
// 5 km reads ~180 m instead of ~15 m). The accurate fix, like Strava, is to snap each point to a
// Digital Elevation Model (DEM) of the real terrain.
//
// By default we use the free Open-Meteo elevation API (no key, batched, reliable). Only the run's
// coordinates are sent — no user identity. To self-host or swap providers, set ELEVATION_API_URL
// to an endpoint accepting POST { locations: [{ latitude, longitude }] } and returning
// { results: [{ elevation }] } (OpenTopoData / open-elevation shape). Set ELEVATION_DISABLE=1 to
// turn correction off entirely and fall back to smoothing raw GPS altitudes.
const CUSTOM_DEM_URL = process.env.ELEVATION_API_URL?.trim();
const DEM_DISABLED = process.env.ELEVATION_DISABLE === "1";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation";
// DEM APIs cap coordinates per request and we don't need per-metre resolution for gain, so
// sample the route down to this many points before querying.
const DEM_MAX_POINTS = 100;
const DEM_TIMEOUT_MS = 4000;

export type RunElevation = {
  gainM: number;
  // Route with terrain-corrected altitudes when a DEM was available, otherwise the input route.
  route: RunRoutePoint[];
  source: "dem" | "gps";
};

// Resolve a run's elevation gain (and a corrected route) from its GPS track. Best-effort: any DEM
// failure falls back to the smoothed raw-GPS gain so a run never fails to save over elevation.
export async function resolveRunElevation(route: RunRoutePoint[]): Promise<RunElevation> {
  if (route.length < 2) return { gainM: 0, route, source: "gps" };

  if (!DEM_DISABLED) {
    try {
      const corrected = await correctAltitudes(route);
      if (corrected) return { gainM: smoothedElevationGainM(corrected), route: corrected, source: "dem" };
    } catch {
      // fall through to GPS smoothing
    }
  }

  return { gainM: smoothedElevationGainM(route), route, source: "gps" };
}

async function correctAltitudes(route: RunRoutePoint[]): Promise<RunRoutePoint[] | null> {
  const sampleIndices = evenSampleIndices(route.length, DEM_MAX_POINTS);
  const lats = sampleIndices.map((i) => route[i].lat);
  const lngs = sampleIndices.map((i) => route[i].lng);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEM_TIMEOUT_MS);
  let elevations: number[] | null;
  try {
    elevations = CUSTOM_DEM_URL
      ? await fetchCustomDem(CUSTOM_DEM_URL, lats, lngs, controller.signal)
      : await fetchOpenMeteo(lats, lngs, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
  if (!elevations || elevations.length !== sampleIndices.length || elevations.some((e) => !Number.isFinite(e))) {
    return null;
  }

  // Map every full-route point to its nearest sampled elevation. At <=50 m sample spacing this
  // is plenty precise for a gain figure while keeping the DEM request small.
  return route.map((point, index) => {
    let nearest = 0;
    let best = Infinity;
    for (let s = 0; s < sampleIndices.length; s += 1) {
      const distance = Math.abs(sampleIndices[s] - index);
      if (distance < best) {
        best = distance;
        nearest = s;
      }
    }
    return { ...point, ele: Math.round(elevations[nearest]) };
  });
}

async function fetchOpenMeteo(lats: number[], lngs: number[], signal: AbortSignal): Promise<number[] | null> {
  const url = `${OPEN_METEO_URL}?latitude=${lats.join(",")}&longitude=${lngs.join(",")}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const json = (await response.json()) as { elevation?: Array<number | null> };
  return Array.isArray(json.elevation) ? json.elevation.map((e) => (typeof e === "number" ? e : Number.NaN)) : null;
}

async function fetchCustomDem(url: string, lats: number[], lngs: number[], signal: AbortSignal): Promise<number[] | null> {
  const locations = lats.map((latitude, i) => ({ latitude, longitude: lngs[i] }));
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locations }),
    signal
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { results?: Array<{ elevation?: number | null }> };
  return Array.isArray(json.results) ? json.results.map((r) => (typeof r?.elevation === "number" ? r.elevation : Number.NaN)) : null;
}

// Evenly spaced indices across [0, length-1], always including the first and last point.
function evenSampleIndices(length: number, max: number): number[] {
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (max - 1);
  const indices: number[] = [];
  for (let i = 0; i < max; i += 1) indices.push(Math.round(i * step));
  return Array.from(new Set(indices));
}
