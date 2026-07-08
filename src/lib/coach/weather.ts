import "server-only";

import { ALGERIA_WILAYAS, type AlgeriaWilaya } from "@/lib/algeria";
import type { RunRoutePoint } from "@/components/coach/types";

// Weather is a free, key-less enrichment via Open-Meteo. It is strictly best-effort: every fetch
// is time-boxed and any failure resolves to `null` so a slow or down forecast provider can never
// block a run save or a coach reply. Disable entirely with COACH_WEATHER_ENABLED=false.
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 4000;
// Open-Meteo's forecast endpoint serves recent history via past_days (max 92). Runs are logged
// right after completion, so a short lookback covers every realistic case while keeping the payload
// small. Anything older silently gets no weather rather than a second (archive) round-trip.
const MAX_PAST_DAYS = 14;

export type RunWeather = {
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  label: string;
  // Where the reading was taken from, so the coach can hedge ("near your usual area") when it is
  // a wilaya centroid rather than the exact GPS start point.
  source: "gps" | "wilaya";
};

export type ForecastConditions = {
  label: string;
  currentTemperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  todayHighC: number | null;
  todayLowC: number | null;
  precipitationChancePct: number | null;
  source: "gps" | "wilaya";
};

export type Coordinates = { lat: number; lng: number; source: "gps" | "wilaya" };

export function isCoachWeatherEnabled(): boolean {
  return process.env.COACH_WEATHER_ENABLED?.trim().toLowerCase() !== "false";
}

// Condensed WMO weather-interpretation codes → a short, coach-friendly label. Buckets keep the
// surface small (the model does not need "light vs dense drizzle"); the raw code is passed too.
function weatherCodeLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return "unknown";
  if (code === 0) return "clear";
  if (code <= 2) return "mostly clear";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}

function round(value: number | null | undefined, decimals = 0): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Approximate centroid (wilaya capital) for each of Algeria's 58 wilayas, so a manual run or a
// forecast can still be located when there is no GPS track. Coordinates are deliberately coarse —
// they anchor weather to the right region, not a precise point.
const WILAYA_COORDINATES: Record<AlgeriaWilaya, [number, number]> = {
  Adrar: [27.87, -0.29],
  Chlef: [36.17, 1.33],
  Laghouat: [33.8, 2.88],
  "Oum El Bouaghi": [35.88, 7.11],
  Batna: [35.55, 6.17],
  Bejaia: [36.75, 5.06],
  Biskra: [34.85, 5.73],
  Bechar: [31.62, -2.22],
  Blida: [36.47, 2.83],
  Bouira: [36.38, 3.9],
  Tamanrasset: [22.79, 5.53],
  Tebessa: [35.4, 8.12],
  Tlemcen: [34.88, -1.32],
  Tiaret: [35.37, 1.32],
  "Tizi Ouzou": [36.72, 4.05],
  Alger: [36.75, 3.06],
  Djelfa: [34.67, 3.26],
  Jijel: [36.82, 5.77],
  Setif: [36.19, 5.41],
  Saida: [34.83, 0.15],
  Skikda: [36.88, 6.91],
  "Sidi Bel Abbes": [35.19, -0.63],
  Annaba: [36.9, 7.77],
  Guelma: [36.46, 7.43],
  Constantine: [36.36, 6.61],
  Medea: [36.26, 2.75],
  Mostaganem: [35.93, 0.09],
  "M'Sila": [35.7, 4.54],
  Mascara: [35.4, 0.14],
  Ouargla: [31.95, 5.33],
  Oran: [35.7, -0.63],
  "El Bayadh": [33.68, 1.02],
  Illizi: [26.48, 8.47],
  "Bordj Bou Arreridj": [36.07, 4.76],
  Boumerdes: [36.77, 3.48],
  "El Tarf": [36.77, 8.31],
  Tindouf: [27.67, -8.15],
  Tissemsilt: [35.61, 1.81],
  "El Oued": [33.37, 6.87],
  Khenchela: [35.44, 7.14],
  "Souk Ahras": [36.29, 7.95],
  Tipaza: [36.59, 2.45],
  Mila: [36.45, 6.26],
  "Ain Defla": [36.26, 1.97],
  Naama: [33.27, -0.31],
  "Ain Temouchent": [35.3, -1.14],
  Ghardaia: [32.49, 3.67],
  Relizane: [35.74, 0.56],
  Timimoun: [29.26, 0.24],
  "Bordj Badji Mokhtar": [21.33, 0.95],
  "Ouled Djellal": [34.42, 5.06],
  "Beni Abbes": [30.13, -2.17],
  "In Salah": [27.19, 2.48],
  "In Guezzam": [19.57, 5.77],
  Touggourt: [33.1, 6.06],
  Djanet: [24.55, 9.48],
  "El M'Ghair": [33.95, 5.92],
  "El Meniaa": [30.58, 2.88]
};

function wilayaCoordinates(wilaya: string | null | undefined): [number, number] | null {
  if (!wilaya) return null;
  const match = (ALGERIA_WILAYAS as readonly string[]).find(
    (name) => name.toLowerCase() === wilaya.trim().toLowerCase()
  );
  return match ? WILAYA_COORDINATES[match as AlgeriaWilaya] : null;
}

// First GPS fix of a run's track — the most accurate "where this run happened" signal we have.
function routeStart(route: RunRoutePoint[] | null | undefined): { lat: number; lng: number } | null {
  if (!route?.length) return null;
  const first = route.find((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  return first ? { lat: first.lat, lng: first.lng } : null;
}

// Resolve the best coordinates for a runner: their GPS start point when available, otherwise the
// centroid of their wilaya. Used for both run weather and the forecast shown during planning.
export function resolveCoordinates(input: {
  route?: RunRoutePoint[] | null;
  wilaya?: string | null;
}): Coordinates | null {
  const start = routeStart(input.route);
  if (start) return { lat: start.lat, lng: start.lng, source: "gps" };
  const centroid = wilayaCoordinates(input.wilaya);
  return centroid ? { lat: centroid[0], lng: centroid[1], source: "wilaya" } : null;
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Whole days between a run's start and now, so we can size the past_days window (and bail out for
// runs too old for the forecast endpoint's history).
function daysAgo(at: Date): number {
  const ms = Date.now() - at.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

type HourlyBlock = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  apparent_temperature?: Array<number | null>;
  precipitation?: Array<number | null>;
  weather_code?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
};

// Index of the hourly sample closest to the run's start time. We request the hourly series in GMT,
// so the timestamps are UTC; an offset-less string is forced to UTC (appended "Z") so parsing is
// independent of the server's own timezone.
function nearestHourIndex(times: string[], at: Date): number {
  const target = at.getTime();
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i += 1) {
    const raw = times[i];
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`;
    const delta = Math.abs(new Date(iso).getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}

// Historical conditions at the time and place a run happened. Best-effort: returns null when
// weather is disabled, coordinates are missing, the run is older than the history window, or the
// provider is slow/unreachable.
export async function fetchRunWeather(input: {
  coordinates: Coordinates;
  at: Date;
}): Promise<RunWeather | null> {
  if (!isCoachWeatherEnabled()) return null;
  const elapsedDays = daysAgo(input.at);
  if (elapsedDays > MAX_PAST_DAYS) return null;

  const pastDays = Math.min(MAX_PAST_DAYS, Math.max(1, elapsedDays + 1));
  const params = new URLSearchParams({
    latitude: input.coordinates.lat.toFixed(4),
    longitude: input.coordinates.lng.toFixed(4),
    hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    past_days: String(pastDays),
    forecast_days: "1",
    // UTC timestamps so nearest-hour matching against the run's absolute start time is exact
    // regardless of the server's own timezone.
    timezone: "GMT",
    wind_speed_unit: "kmh"
  });

  const data = await fetchJson(`${FORECAST_ENDPOINT}?${params.toString()}`);
  const hourly = data?.hourly as HourlyBlock | undefined;
  if (!hourly?.time?.length) return null;

  const index = nearestHourIndex(hourly.time, input.at);
  const code = hourly.weather_code?.[index] ?? null;
  return {
    temperatureC: round(hourly.temperature_2m?.[index], 1),
    apparentTemperatureC: round(hourly.apparent_temperature?.[index], 1),
    humidityPct: round(hourly.relative_humidity_2m?.[index]),
    windKph: round(hourly.wind_speed_10m?.[index]),
    precipitationMm: round(hourly.precipitation?.[index], 1),
    weatherCode: code,
    label: weatherCodeLabel(code),
    source: input.coordinates.source
  };
}

type CurrentBlock = {
  temperature_2m?: number | null;
  relative_humidity_2m?: number | null;
  apparent_temperature?: number | null;
  weather_code?: number | null;
  wind_speed_10m?: number | null;
};

type DailyBlock = {
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
};

// Current conditions plus today's high/low and rain chance for a location — the signal the coach
// needs to make daily advice weather-aware ("it's 38°C, move the tempo to early morning").
export async function fetchForecastConditions(coordinates: Coordinates): Promise<ForecastConditions | null> {
  if (!isCoachWeatherEnabled()) return null;

  const params = new URLSearchParams({
    latitude: coordinates.lat.toFixed(4),
    longitude: coordinates.lng.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: "auto",
    wind_speed_unit: "kmh"
  });

  const data = await fetchJson(`${FORECAST_ENDPOINT}?${params.toString()}`);
  if (!data) return null;
  const current = data.current as CurrentBlock | undefined;
  const daily = data.daily as DailyBlock | undefined;
  if (!current && !daily) return null;

  const code = current?.weather_code ?? null;
  return {
    label: weatherCodeLabel(code),
    currentTemperatureC: round(current?.temperature_2m, 1),
    apparentTemperatureC: round(current?.apparent_temperature, 1),
    humidityPct: round(current?.relative_humidity_2m),
    windKph: round(current?.wind_speed_10m),
    todayHighC: round(daily?.temperature_2m_max?.[0], 1),
    todayLowC: round(daily?.temperature_2m_min?.[0], 1),
    precipitationChancePct: round(daily?.precipitation_probability_max?.[0]),
    source: coordinates.source
  };
}
