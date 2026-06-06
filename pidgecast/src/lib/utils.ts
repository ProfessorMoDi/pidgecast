import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const eurFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurCompactFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format a euro amount with no decimals, e.g. €1.430.000. */
export function formatEur(value: number): string {
  return eurFormatter.format(value);
}

/** Compact euro formatting, e.g. €1,4 mln. Useful for axis ticks. */
export function formatEurCompact(value: number): string {
  return eurCompactFormatter.format(value);
}

/** Format a signed euro delta, e.g. +€42.000 / -€180.000. */
export function formatEurDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${eurFormatter.format(Math.abs(value))}`;
}

/** Format a fraction (-0.12) as a signed percentage (-12.0%). */
export function formatPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/** Format a raw number of days, e.g. 3.4 d. */
export function formatDays(value: number): string {
  return `${value.toFixed(1)} d`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatWeekday(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
