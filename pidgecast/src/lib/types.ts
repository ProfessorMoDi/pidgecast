// Core domain types for Pidgecast.
// Weather-aware accrual revenue forecasting for roofing operators.

export type Role =
  | "pe-board"
  | "cfo"
  | "opco-md"
  | "project-lead"
  | "regression";

export type Scenario = "base" | "wet-quarter" | "dry-quarter";

export type RiskLevel = "healthy" | "watch" | "at-risk" | "critical";

export type WeatherCondition =
  | "frost"
  | "rain"
  | "high-wind"
  | "heat"
  | "cold"
  | "normal";

export interface Opco {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  accountingSystem: string;
  dataStatus: string;
}

/**
 * A single day of weather, either fetched live from Open-Meteo or
 * synthesized as fallback. `capacity` is the executable fraction of a
 * normal workable day (0.0 - 1.0).
 */
export interface WeatherDay {
  date: string; // ISO date (YYYY-MM-DD)
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  windMaxKmh: number;
  condition: WeatherCondition;
  capacity: number;
  isWorkday: boolean;
}

/**
 * A single hourly observation/forecast point, retained from Open-Meteo (or
 * synthesized in fallback) so the weather trend chart can show intra-day
 * temperature and precipitation movement over the forecast window.
 */
export interface WeatherHour {
  time: string; // ISO datetime (YYYY-MM-DDTHH:mm)
  temperatureC: number;
  precipitationMm: number;
  windKmh: number;
}

/**
 * The weather layer's output bundle: daily aggregates (used by the forecast
 * engine and day cards) plus the retained hourly series (used by charts).
 */
export interface WeatherBundle {
  days: WeatherDay[];
  hours: WeatherHour[];
}

export type AnomalyStatus = "on-track" | "watch" | "missing" | "escalate";

export interface BillingAnomaly {
  id: string;
  opcoId: string;
  label: string;
  expectedAmount: number;
  expectedDate: string;
  status: AnomalyStatus;
  recommendedAction: string;
}

export type MilestoneStatus = "scheduled" | "in-progress" | "at-risk" | "delayed";

export interface ProjectMilestone {
  id: string;
  opcoId: string;
  projectName: string;
  milestone: string;
  billingAmount: number;
  expectedDate: string;
  weatherSensitivity: "low" | "medium" | "high";
  status: MilestoneStatus;
  progress: number; // 0 - 100
  weekIndex: number; // which forecast week the milestone bills in
}

/**
 * A revenue split for a forecast week. Recurring revenue is stable;
 * project billing is weather-sensitive.
 */
export interface RevenueStream {
  recurring: number;
  projectBilling: number;
}

/**
 * A raw (pre-computed) forecast week as stored in demo data. The forecast
 * engine consumes this together with weather and a scenario to produce a
 * computed ForecastWeek.
 */
export interface ForecastWeekInput {
  weekIndex: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  baselineWorkableDays: number;
  baseline: RevenueStream;
}

export interface AuditTrailStep {
  label: string;
  value: string;
  detail?: string;
}

/**
 * A fully computed forecast week, produced by the forecast engine.
 */
export interface ForecastWeek {
  weekIndex: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  scenario: Scenario;

  baselineWorkableDays: number;
  effectiveWorkableDays: number;
  weatherImpactPct: number; // negative = capacity loss

  recurringRevenue: number;
  projectBillingRevenue: number;
  forecastRevenue: number;
  baselineRevenue: number; // recurring + project billing before weather/scenario

  covenantHeadroom: number;
  riskLevel: RiskLevel;

  auditTrail: AuditTrailStep[];
}

export interface WeatherState {
  days: WeatherDay[];
  hours: WeatherHour[];
  isLoading: boolean;
  isFallback: boolean;
  error: string | null;
  lastUpdated: string | null;
}
