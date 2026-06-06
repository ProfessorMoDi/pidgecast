// Seasonalized ("climatology") weather source.
//
// The live Open-Meteo forecast only covers ~14 days. The forecast engine,
// however, reasons over the full 14-week horizon. Beyond the live window we
// have no weather signal, so this module synthesizes the weather you would
// *expect* for a given time of year, derived from real 2023-2026 historical
// daily data (see `@/data/weather-daily.json`).
//
// Approach: build a per-opco climatology bucketed by ISO week-of-year
// (1..53). A target calendar day maps to its week-of-year, and we look up the
// averaged tmin / tmax / rain / wind for that bucket across all observed
// years. Days are then classified with the exact same `classifyWeather`
// thresholds/capacity model used for live weather, so the two sources are
// directly comparable.
//
// Pure, deterministic, no network, no side effects.

import weatherDailyRaw from "@/data/weather-daily.json";
import { classifyWeather } from "@/lib/weather";
import type { WeatherDay } from "@/lib/types";

/** A single historical daily record as stored in `weather-daily.json`. */
interface DailyRecord {
  d: string; // YYYY-MM-DD
  rev: number;
  rain: number;
  snow: number;
  tmin: number;
  tmean: number;
  tmax: number;
  wind: number;
  gust: number;
}

interface OpcoDataset {
  name: string;
  records: DailyRecord[];
}

interface WeatherDailyDataset {
  ummels: OpcoDataset;
  gilde: OpcoDataset;
}

type DatasetKey = keyof WeatherDailyDataset;

const weatherDaily = weatherDailyRaw as unknown as WeatherDailyDataset;

/**
 * Provenance string for UI labelling. The seasonal source is derived from
 * real historical Open-Meteo weather + ledger data, not a forecast.
 */
export const SEASONAL_PROVENANCE =
  "Seasonal averages derived from 2023-2026 historical Open-Meteo + ledger data";

/**
 * Map app opco ids to dataset keys. The app uses `peter-ummels` / `gilde`
 * while the dataset is keyed `ummels` / `gilde`. Unknown ids fall back to
 * `ummels` so the function is always total.
 */
function resolveDatasetKey(opcoId: string): DatasetKey {
  const normalized = opcoId.trim().toLowerCase();
  if (normalized === "gilde") return "gilde";
  // "peter-ummels", "ummels", and any unknown id resolve to ummels.
  return "ummels";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a `YYYY-MM-DD` string into a UTC-midnight timestamp. Operating in UTC
 * throughout avoids timezone off-by-one errors when adding days or deriving
 * week numbers.
 */
function parseUtcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Format a UTC date back to `YYYY-MM-DD`. */
function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add `days` calendar days to a UTC date, returning a new Date. */
function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** True for Monday-Friday (UTC). */
function isUtcWorkday(date: Date): boolean {
  const day = date.getUTCDay(); // 0 = Sun .. 6 = Sat
  return day >= 1 && day <= 5;
}

/**
 * ISO 8601 week-of-year (1..53). Week 1 is the week containing the first
 * Thursday of the year; weeks start on Monday.
 */
function isoWeekOfYear(date: Date): number {
  // Copy to a UTC date at the start of the day.
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Shift to the Thursday of the current ISO week (Mon=0..Sun=6).
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  // Thursday of week 1 is the first Thursday of the ISO year.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3
  );
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}

/** Averaged seasonal weather for one week-of-year bucket. */
interface SeasonalBucket {
  week: number;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  windMaxKmh: number;
  sampleCount: number;
}

interface BucketAccumulator {
  tmin: number;
  tmax: number;
  rain: number;
  wind: number;
  count: number;
}

/**
 * Build (and memoize) the week-of-year climatology for a dataset key. Returns
 * a map from ISO week (1..53) to its averaged weather across all years.
 */
const climatologyCache = new Map<DatasetKey, Map<number, SeasonalBucket>>();

function buildClimatology(key: DatasetKey): Map<number, SeasonalBucket> {
  const cached = climatologyCache.get(key);
  if (cached) return cached;

  const accumulators = new Map<number, BucketAccumulator>();
  for (const record of weatherDaily[key].records) {
    const week = isoWeekOfYear(parseUtcDate(record.d));
    const acc = accumulators.get(week) ?? {
      tmin: 0,
      tmax: 0,
      rain: 0,
      wind: 0,
      count: 0,
    };
    acc.tmin += record.tmin;
    acc.tmax += record.tmax;
    acc.rain += record.rain;
    acc.wind += record.wind;
    acc.count += 1;
    accumulators.set(week, acc);
  }

  const buckets = new Map<number, SeasonalBucket>();
  for (const [week, acc] of accumulators) {
    buckets.set(week, {
      week,
      tempMinC: acc.tmin / acc.count,
      tempMaxC: acc.tmax / acc.count,
      precipitationMm: acc.rain / acc.count,
      windMaxKmh: acc.wind / acc.count,
      sampleCount: acc.count,
    });
  }

  climatologyCache.set(key, buckets);
  return buckets;
}

/**
 * Resolve the seasonal bucket for a week-of-year, falling back to the nearest
 * populated week when the exact bucket is missing (e.g. a sparse week 53 in a
 * leap/long year). Weeks are searched outward by distance over the 1..53 range.
 */
function lookupBucket(
  buckets: Map<number, SeasonalBucket>,
  week: number
): SeasonalBucket | null {
  const exact = buckets.get(week);
  if (exact) return exact;

  for (let distance = 1; distance <= 53; distance++) {
    const lower = buckets.get(week - distance);
    if (lower) return lower;
    const upper = buckets.get(week + distance);
    if (upper) return upper;
  }
  return null;
}

/**
 * Build a daily `WeatherDay[]` for the full horizon using seasonal averages.
 *
 * @param opcoId    App opco id (`peter-ummels` | `gilde`); other ids fall back to ummels.
 * @param startDate ISO date (`YYYY-MM-DD`) of the first day; expected to be a Monday.
 * @param weeks     Number of weeks to cover (e.g. 14). Produces `weeks * 7` days.
 */
export function buildSeasonalWeather(
  opcoId: string,
  startDate: string,
  weeks: number
): WeatherDay[] {
  const key = resolveDatasetKey(opcoId);
  const buckets = buildClimatology(key);
  const start = parseUtcDate(startDate);
  const totalDays = Math.max(0, Math.trunc(weeks)) * 7;

  const days: WeatherDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addUtcDays(start, i);
    const week = isoWeekOfYear(date);
    const bucket = lookupBucket(buckets, week);

    const tempMinC = bucket ? bucket.tempMinC : 0;
    const tempMaxC = bucket ? bucket.tempMaxC : 0;
    const precipitationMm = bucket ? bucket.precipitationMm : 0;
    const windMaxKmh = bucket ? bucket.windMaxKmh : 0;

    const { condition, capacity } = classifyWeather(
      tempMinC,
      tempMaxC,
      precipitationMm,
      windMaxKmh
    );

    days.push({
      date: formatUtcDate(date),
      tempMinC,
      tempMaxC,
      precipitationMm,
      windMaxKmh,
      condition,
      capacity,
      isWorkday: isUtcWorkday(date),
    });
  }

  return days;
}

/**
 * Per-week expected effective workable days: for each week of the horizon,
 * sum the daily `capacity` over its Mon-Fri days. A perfectly clear week
 * yields 5.0; weather-limited weeks yield less. Useful for charts/labels.
 *
 * @returns An array of length `weeks`, one entry per week in order.
 */
export function getSeasonalWeeklyWorkableDays(
  opcoId: string,
  startDate: string,
  weeks: number
): number[] {
  const days = buildSeasonalWeather(opcoId, startDate, weeks);
  const weekCount = Math.max(0, Math.trunc(weeks));
  const result: number[] = [];

  for (let w = 0; w < weekCount; w++) {
    let workable = 0;
    for (let d = 0; d < 7; d++) {
      const day = days[w * 7 + d];
      if (day && day.isWorkday) {
        workable += day.capacity;
      }
    }
    result.push(workable);
  }

  return result;
}
