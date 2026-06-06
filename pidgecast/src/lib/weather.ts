// Open-Meteo client-side weather fetching + capacity classification.
// No backend: this runs in the browser. Falls back to synthetic weather
// if the API is unreachable.

import {
  CAPACITY_BY_CONDITION,
  WEATHER_THRESHOLDS,
} from "@/lib/config";
import type {
  Opco,
  WeatherBundle,
  WeatherCondition,
  WeatherDay,
  WeatherHour,
} from "@/lib/types";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_min: number[];
  temperature_2m_max: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation: number[];
  wind_speed_10m: number[];
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
}

/**
 * Classify a single day's weather into the most capacity-limiting
 * condition. Order matters only for labelling; capacity is resolved by the
 * lowest-capacity matching condition (frost is the hardest stop).
 */
export function classifyWeather(
  tempMinC: number,
  tempMaxC: number,
  precipitationMm: number,
  windMaxKmh: number
): { condition: WeatherCondition; capacity: number } {
  const matched: WeatherCondition[] = [];

  if (tempMinC <= WEATHER_THRESHOLDS.frostMinTempC) matched.push("frost");
  if (precipitationMm >= WEATHER_THRESHOLDS.rainMm) matched.push("rain");
  if (windMaxKmh >= WEATHER_THRESHOLDS.highWindKmh) matched.push("high-wind");
  if (tempMaxC >= WEATHER_THRESHOLDS.heatMaxTempC) matched.push("heat");
  if (
    tempMinC <= WEATHER_THRESHOLDS.coldMinTempC &&
    tempMinC > WEATHER_THRESHOLDS.frostMinTempC
  ) {
    matched.push("cold");
  }

  if (matched.length === 0) {
    return { condition: "normal", capacity: CAPACITY_BY_CONDITION.normal };
  }

  // Lowest capacity wins; report that condition as the driver.
  let driver: WeatherCondition = matched[0];
  let lowest = CAPACITY_BY_CONDITION[matched[0]];
  for (const c of matched) {
    const cap = CAPACITY_BY_CONDITION[c];
    if (cap < lowest) {
      lowest = cap;
      driver = c;
    }
  }

  return { condition: driver, capacity: lowest };
}

function isWorkday(iso: string): boolean {
  const day = new Date(iso).getDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

function parseDailyResponse(data: OpenMeteoResponse): WeatherDay[] {
  const daily = data.daily;
  if (!daily || !daily.time) return [];

  return daily.time.map((date, i) => {
    const tempMinC = daily.temperature_2m_min[i];
    const tempMaxC = daily.temperature_2m_max[i];
    const precipitationMm = daily.precipitation_sum[i] ?? 0;
    const windMaxKmh = daily.wind_speed_10m_max[i] ?? 0;
    const { condition, capacity } = classifyWeather(
      tempMinC,
      tempMaxC,
      precipitationMm,
      windMaxKmh
    );
    return {
      date,
      tempMinC,
      tempMaxC,
      precipitationMm,
      windMaxKmh,
      condition,
      capacity,
      isWorkday: isWorkday(date),
    };
  });
}

/**
 * Parse the hourly block into a flat series for the trend chart. Open-Meteo
 * returns aligned arrays; we zip them and default missing samples to 0.
 */
function parseHourlyResponse(data: OpenMeteoResponse): WeatherHour[] {
  const hourly = data.hourly;
  if (!hourly || !hourly.time) return [];

  return hourly.time.map((time, i) => ({
    time,
    temperatureC: hourly.temperature_2m[i] ?? 0,
    precipitationMm: hourly.precipitation[i] ?? 0,
    windKmh: hourly.wind_speed_10m[i] ?? 0,
  }));
}

export async function fetchWeather(opco: Opco): Promise<WeatherBundle> {
  const url =
    `${OPEN_METEO_BASE}?latitude=${opco.latitude}&longitude=${opco.longitude}` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,wind_speed_10m_max` +
    `&timezone=auto`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Open-Meteo responded with ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;
  const days = parseDailyResponse(data);
  if (days.length === 0) {
    throw new Error("Open-Meteo returned no daily data");
  }
  return { days, hours: parseHourlyResponse(data) };
}

/**
 * Deterministic-ish synthetic weather used when the live API fails. The
 * opco id seeds the pattern so the two demo opcos differ and frost/rain
 * days appear, making the capacity model visibly meaningful.
 */
export function buildFallbackWeather(opco: Opco): WeatherBundle {
  const seed = opco.id === "gilde" ? 1 : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const patterns: Array<{
    tempMinC: number;
    tempMaxC: number;
    precipitationMm: number;
    windMaxKmh: number;
  }> =
    seed === 0
      ? [
          { tempMinC: 4, tempMaxC: 11, precipitationMm: 0.2, windMaxKmh: 22 },
          { tempMinC: 2, tempMaxC: 9, precipitationMm: 5.4, windMaxKmh: 31 },
          { tempMinC: -2, tempMaxC: 4, precipitationMm: 0.0, windMaxKmh: 18 },
          { tempMinC: 1, tempMaxC: 7, precipitationMm: 3.1, windMaxKmh: 52 },
          { tempMinC: 5, tempMaxC: 13, precipitationMm: 0.0, windMaxKmh: 20 },
          { tempMinC: 6, tempMaxC: 14, precipitationMm: 0.0, windMaxKmh: 16 },
          { tempMinC: 3, tempMaxC: 10, precipitationMm: 1.0, windMaxKmh: 27 },
        ]
      : [
          { tempMinC: 6, tempMaxC: 15, precipitationMm: 0.0, windMaxKmh: 19 },
          { tempMinC: 5, tempMaxC: 12, precipitationMm: 2.6, windMaxKmh: 24 },
          { tempMinC: 2, tempMaxC: 8, precipitationMm: 6.8, windMaxKmh: 38 },
          { tempMinC: -1, tempMaxC: 5, precipitationMm: 0.0, windMaxKmh: 21 },
          { tempMinC: 7, tempMaxC: 16, precipitationMm: 0.0, windMaxKmh: 14 },
          { tempMinC: 8, tempMaxC: 17, precipitationMm: 0.0, windMaxKmh: 12 },
          { tempMinC: 4, tempMaxC: 11, precipitationMm: 0.4, windMaxKmh: 23 },
        ];

  const days: WeatherDay[] = patterns.map((p, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const { condition, capacity } = classifyWeather(
      p.tempMinC,
      p.tempMaxC,
      p.precipitationMm,
      p.windMaxKmh
    );
    return {
      date,
      ...p,
      condition,
      capacity,
      isWorkday: isWorkday(date),
    };
  });

  return { days, hours: synthesizeHourly(today, patterns) };
}

/**
 * Build a plausible 24h-per-day hourly series from the daily fallback
 * patterns: temperature follows a simple diurnal curve between the day's min
 * (pre-dawn) and max (mid-afternoon); precipitation and wind are spread around
 * the day so the trend chart has realistic intra-day movement.
 */
function synthesizeHourly(
  today: Date,
  patterns: Array<{
    tempMinC: number;
    tempMaxC: number;
    precipitationMm: number;
    windMaxKmh: number;
  }>
): WeatherHour[] {
  const hours: WeatherHour[] = [];
  patterns.forEach((p, dayIndex) => {
    for (let h = 0; h < 24; h++) {
      const d = new Date(today);
      d.setDate(today.getDate() + dayIndex);
      d.setHours(h, 0, 0, 0);
      // Diurnal temperature curve: min ~05:00, max ~15:00.
      const phase = Math.cos(((h - 15) / 24) * 2 * Math.PI);
      const mid = (p.tempMinC + p.tempMaxC) / 2;
      const amp = (p.tempMaxC - p.tempMinC) / 2;
      const temperatureC = Number((mid + amp * phase).toFixed(1));
      // Concentrate precipitation in the afternoon; keep daily sum ~constant.
      const rainWeight = h >= 12 && h <= 18 ? 0.1 : 0.02;
      const precipitationMm = Number(
        (p.precipitationMm * rainWeight).toFixed(2)
      );
      const windKmh = Number(
        (p.windMaxKmh * (0.6 + 0.4 * Math.max(0, phase))).toFixed(0)
      );
      hours.push({
        time: `${d.toISOString().slice(0, 13)}:00`,
        temperatureC,
        precipitationMm,
        windKmh,
      });
    }
  });
  return hours;
}

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  frost: "Frost",
  rain: "Heavy rain",
  "high-wind": "High wind",
  heat: "Heat",
  cold: "Cold",
  normal: "Normal",
};
