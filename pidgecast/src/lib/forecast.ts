// Transparent forecast model for Pidgecast.
// Chain: revenue stream split -> weather capacity -> scenario adjustment
//        -> forecast revenue -> covenant headroom -> risk level.
//
// Deliberately simple and explainable. Every output feeds the audit trail.

import {
  COVENANT_REVENUE_FLOOR_EUR,
  PROJECT_BILLING_WEATHER_EXPOSURE,
  RECURRING_WEATHER_EXPOSURE,
  SCENARIO_CONFIG,
  WORKDAYS_PER_WEEK,
} from "@/lib/config";
import {
  formatDays,
  formatEur,
  formatPct,
} from "@/lib/utils";
import type {
  AuditTrailStep,
  ForecastWeek,
  ForecastWeekInput,
  RiskLevel,
  Scenario,
  WeatherDay,
} from "@/lib/types";

/**
 * Sum capacity across the workdays that fall within a week window. Capacity
 * is already 0-1 per day, so the sum is "effective workable days".
 */
export function calculateEffectiveWorkableDays(
  weatherDays: WeatherDay[],
  startDate: string,
  endDate: string,
  baselineWorkableDays: number
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  const inWindow = weatherDays.filter((d) => {
    const t = new Date(d.date).getTime();
    return t >= start && t <= end && d.isWorkday;
  });

  // Open-Meteo only returns ~7 forecast days, so later weeks have no live
  // coverage. For those, fall back to the baseline (no weather signal yet).
  if (inWindow.length === 0) {
    return baselineWorkableDays;
  }

  const covered = inWindow.reduce((sum, d) => sum + d.capacity, 0);
  const uncoveredDays = Math.max(0, baselineWorkableDays - inWindow.length);

  // Uncovered workdays in this week are assumed normal (capacity 1).
  return covered + uncoveredDays;
}

/**
 * Weather impact as a fraction. Negative = capacity loss vs baseline.
 */
export function calculateWeatherImpact(
  effectiveDays: number,
  baselineDays: number
): number {
  if (baselineDays <= 0) return 0;
  return effectiveDays / baselineDays - 1;
}

export interface ScenarioRevenueInput {
  recurringBaseline: number;
  projectBillingBaseline: number;
  weatherImpact: number; // fraction, typically <= 0
  scenario: Scenario;
}

export interface ScenarioRevenueResult {
  recurringRevenue: number;
  projectBillingRevenue: number;
  effectiveWeatherImpact: number; // after scenario amplification
}

/**
 * Apply weather + scenario to the revenue split. Recurring is only lightly
 * exposed; project billing carries the weather sensitivity. Dry upside is
 * capped harder than wet downside.
 */
export function calculateScenarioAdjustedRevenue(
  input: ScenarioRevenueInput
): ScenarioRevenueResult {
  const cfg = SCENARIO_CONFIG[input.scenario];

  // Amplify only the downside portion of weather impact by the scenario
  // multiplier; positive (better-than-baseline) impact is left as-is.
  const amplified =
    input.weatherImpact < 0
      ? input.weatherImpact * cfg.capacityLossMultiplier
      : input.weatherImpact;

  // Recurring revenue barely moves.
  const recurringFactor = 1 + amplified * RECURRING_WEATHER_EXPOSURE;
  const recurringRevenue = input.recurringBaseline * recurringFactor;

  // Project billing carries most of the weather sensitivity plus the
  // scenario's direct adjustment.
  let projectFactor =
    1 + amplified * PROJECT_BILLING_WEATHER_EXPOSURE + cfg.projectBillingAdjustment;

  // Cap upside: project billing cannot exceed baseline by more than the cap.
  const upsideCeiling = 1 + cfg.upsideCap;
  if (projectFactor > upsideCeiling) projectFactor = upsideCeiling;
  if (projectFactor < 0) projectFactor = 0;

  const projectBillingRevenue = input.projectBillingBaseline * projectFactor;

  return {
    recurringRevenue,
    projectBillingRevenue,
    effectiveWeatherImpact: amplified,
  };
}

export function calculateCovenantHeadroom(forecastRevenue: number): number {
  return forecastRevenue - COVENANT_REVENUE_FLOOR_EUR;
}

/**
 * Risk blends covenant headroom (relative to the floor) with weather
 * pressure on capacity.
 */
export function calculateRiskLevel(
  headroom: number,
  weatherImpact: number
): RiskLevel {
  const headroomRatio = headroom / COVENANT_REVENUE_FLOOR_EUR;

  if (headroom < 0) return "critical";
  if (headroomRatio < 0.05 || weatherImpact <= -0.3) return "at-risk";
  if (headroomRatio < 0.12 || weatherImpact <= -0.15) return "watch";
  return "healthy";
}

export interface ComputeWeekParams {
  input: ForecastWeekInput;
  weatherDays: WeatherDay[];
  scenario: Scenario;
}

/**
 * Compute a single forecast week end-to-end, including the audit trail.
 */
export function computeForecastWeek({
  input,
  weatherDays,
  scenario,
}: ComputeWeekParams): ForecastWeek {
  const baselineWorkableDays = input.baselineWorkableDays || WORKDAYS_PER_WEEK;

  const effectiveWorkableDays = calculateEffectiveWorkableDays(
    weatherDays,
    input.startDate,
    input.endDate,
    baselineWorkableDays
  );

  const rawWeatherImpact = calculateWeatherImpact(
    effectiveWorkableDays,
    baselineWorkableDays
  );

  const scenarioResult = calculateScenarioAdjustedRevenue({
    recurringBaseline: input.baseline.recurring,
    projectBillingBaseline: input.baseline.projectBilling,
    weatherImpact: rawWeatherImpact,
    scenario,
  });

  const recurringRevenue = scenarioResult.recurringRevenue;
  const projectBillingRevenue = scenarioResult.projectBillingRevenue;
  const forecastRevenue = recurringRevenue + projectBillingRevenue;
  const baselineRevenue =
    input.baseline.recurring + input.baseline.projectBilling;

  const covenantHeadroom = calculateCovenantHeadroom(forecastRevenue);
  const riskLevel = calculateRiskLevel(
    covenantHeadroom,
    scenarioResult.effectiveWeatherImpact
  );

  const auditTrail = buildAuditTrail({
    input,
    baselineWorkableDays,
    effectiveWorkableDays,
    weatherImpact: scenarioResult.effectiveWeatherImpact,
    scenario,
    recurringRevenue,
    projectBillingRevenue,
    forecastRevenue,
    covenantHeadroom,
    riskLevel,
  });

  return {
    weekIndex: input.weekIndex,
    weekLabel: input.weekLabel,
    startDate: input.startDate,
    endDate: input.endDate,
    scenario,
    baselineWorkableDays,
    effectiveWorkableDays,
    weatherImpactPct: scenarioResult.effectiveWeatherImpact,
    recurringRevenue,
    projectBillingRevenue,
    forecastRevenue,
    baselineRevenue,
    covenantHeadroom,
    riskLevel,
    auditTrail,
  };
}

interface AuditParams {
  input: ForecastWeekInput;
  baselineWorkableDays: number;
  effectiveWorkableDays: number;
  weatherImpact: number;
  scenario: Scenario;
  recurringRevenue: number;
  projectBillingRevenue: number;
  forecastRevenue: number;
  covenantHeadroom: number;
  riskLevel: RiskLevel;
}

export function buildAuditTrail(p: AuditParams): AuditTrailStep[] {
  const cfg = SCENARIO_CONFIG[p.scenario];
  return [
    {
      label: "1. Starting recurring revenue",
      value: formatEur(p.input.baseline.recurring),
      detail: "Maintenance, service agreements and small repairs. Low weather sensitivity.",
    },
    {
      label: "2. Starting project billing revenue",
      value: formatEur(p.input.baseline.projectBilling),
      detail: "Milestone-based project revenue. Weather-sensitive because execution drives billing.",
    },
    {
      label: "3. Baseline workable days",
      value: formatDays(p.baselineWorkableDays),
      detail: "Normal Mon-Fri working capacity for the week.",
    },
    {
      label: "4. Weather-adjusted workable days",
      value: formatDays(p.effectiveWorkableDays),
      detail: "Sum of daily executable capacity (frost = hard stop, rain/wind/heat reduce capacity).",
    },
    {
      label: "5. Weather impact on capacity",
      value: formatPct(p.weatherImpact),
      detail: `Scenario "${cfg.label}" applies a ${cfg.capacityLossMultiplier}× multiplier to capacity loss.`,
    },
    {
      label: "6. Scenario adjustment",
      value: formatPct(cfg.projectBillingAdjustment),
      detail: cfg.description,
    },
    {
      label: "7. Forecast revenue",
      value: formatEur(p.forecastRevenue),
      detail: `Recurring ${formatEur(p.recurringRevenue)} + project billing ${formatEur(
        p.projectBillingRevenue
      )} (accrual basis).`,
    },
    {
      label: "8. Covenant headroom",
      value: formatEur(p.covenantHeadroom),
      detail: `Forecast revenue minus the configurable demo covenant floor of ${formatEur(
        COVENANT_REVENUE_FLOOR_EUR
      )}.`,
    },
    {
      label: "9. Risk status",
      value: p.riskLevel.replace("-", " ").toUpperCase(),
      detail: "Blends covenant headroom with weather pressure on capacity.",
    },
  ];
}

// --- Aggregations -----------------------------------------------------------

export function computeForecastWeeks(
  inputs: ForecastWeekInput[],
  weatherDays: WeatherDay[],
  scenario: Scenario
): ForecastWeek[] {
  return inputs.map((input) =>
    computeForecastWeek({ input, weatherDays, scenario })
  );
}

export interface ForecastSummary {
  totalForecastRevenue: number;
  totalRecurring: number;
  totalProjectBilling: number;
  totalBaselineRevenue: number;
  totalRevenueAtRisk: number; // baseline - forecast (positive = downside)
  minCovenantHeadroom: number;
  worstRisk: RiskLevel;
  worstWeek: ForecastWeek | null;
  avgWeatherImpact: number;
}

const RISK_ORDER: RiskLevel[] = ["healthy", "watch", "at-risk", "critical"];

export function summariseForecast(weeks: ForecastWeek[]): ForecastSummary {
  if (weeks.length === 0) {
    return {
      totalForecastRevenue: 0,
      totalRecurring: 0,
      totalProjectBilling: 0,
      totalBaselineRevenue: 0,
      totalRevenueAtRisk: 0,
      minCovenantHeadroom: 0,
      worstRisk: "healthy",
      worstWeek: null,
      avgWeatherImpact: 0,
    };
  }

  let totalForecastRevenue = 0;
  let totalRecurring = 0;
  let totalProjectBilling = 0;
  let totalBaselineRevenue = 0;
  let minCovenantHeadroom = Infinity;
  let worstRisk: RiskLevel = "healthy";
  let worstWeek: ForecastWeek | null = null;
  let impactSum = 0;

  for (const w of weeks) {
    totalForecastRevenue += w.forecastRevenue;
    totalRecurring += w.recurringRevenue;
    totalProjectBilling += w.projectBillingRevenue;
    totalBaselineRevenue += w.baselineRevenue;
    impactSum += w.weatherImpactPct;
    if (w.covenantHeadroom < minCovenantHeadroom) {
      minCovenantHeadroom = w.covenantHeadroom;
    }
    if (RISK_ORDER.indexOf(w.riskLevel) > RISK_ORDER.indexOf(worstRisk)) {
      worstRisk = w.riskLevel;
      worstWeek = w;
    }
  }

  // If everything is healthy, surface the lowest-headroom week as "worst".
  if (!worstWeek) {
    worstWeek = weeks.reduce((a, b) =>
      b.covenantHeadroom < a.covenantHeadroom ? b : a
    );
  }

  return {
    totalForecastRevenue,
    totalRecurring,
    totalProjectBilling,
    totalBaselineRevenue,
    totalRevenueAtRisk: Math.max(0, totalBaselineRevenue - totalForecastRevenue),
    minCovenantHeadroom,
    worstRisk,
    worstWeek,
    avgWeatherImpact: impactSum / weeks.length,
  };
}
