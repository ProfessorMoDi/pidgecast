// Configurable demo assumptions for Pidgecast.
// These are intentionally simple and easy to replace with real,
// per-opco or covenant-document-driven values later.

import type { Role, Scenario, RiskLevel } from "@/lib/types";

/**
 * Demo covenant revenue floor. Covenant headroom is calculated as
 * `forecastRevenue - COVENANT_REVENUE_FLOOR_EUR`. This is a deliberately
 * simple proxy, not a leverage-ratio covenant.
 */
export const COVENANT_REVENUE_FLOOR_EUR = 1_250_000;

/**
 * Thresholds used to classify a day's weather into a capacity-limiting
 * condition. Tunable per climate/region later.
 */
export const WEATHER_THRESHOLDS = {
  frostMinTempC: -1,
  rainMm: 2,
  heatMaxTempC: 30,
  coldMinTempC: 3,
  highWindKmh: 45,
} as const;

/**
 * Executable capacity per condition, expressed as a fraction of a normal
 * workable day. If multiple conditions apply, the lowest capacity wins.
 * Frost is the strongest stop signal.
 */
export const CAPACITY_BY_CONDITION = {
  frost: 0.0,
  rain: 0.5, // heavy rain
  "high-wind": 0.4,
  heat: 0.7,
  cold: 0.8,
  normal: 1.0,
} as const;

/**
 * Share of project-billing revenue that is exposed to weather capacity.
 * The remainder is considered already secured / not weather-dependent in
 * the forecast horizon.
 */
export const PROJECT_BILLING_WEATHER_EXPOSURE = 0.85;

/**
 * Recurring revenue is only lightly weather-sensitive (e.g. a frost week
 * can still delay a handful of small service visits). This caps that
 * sensitivity so recurring revenue stays mostly stable.
 */
export const RECURRING_WEATHER_EXPOSURE = 0.1;

/**
 * Scenario tuning. Wet downside is intentionally larger than dry upside:
 * crews, schedules and pipeline cap how much extra work dry weather buys.
 */
export const SCENARIO_CONFIG: Record<
  Scenario,
  {
    label: string;
    description: string;
    /** Multiplier applied to weather-driven capacity loss. >1 amplifies loss. */
    capacityLossMultiplier: number;
    /** Direct adjustment to project billing revenue (after weather). */
    projectBillingAdjustment: number;
    /** Hard cap on positive project-billing upside vs baseline. */
    upsideCap: number;
  }
> = {
  base: {
    label: "Base",
    description: "Most likely current forecast using live weather.",
    capacityLossMultiplier: 1.0,
    projectBillingAdjustment: 0,
    upsideCap: 0.04,
  },
  "wet-quarter": {
    label: "Wet Quarter",
    description:
      "Sustained wet conditions reduce workable days and push milestone billing.",
    capacityLossMultiplier: 1.6,
    projectBillingAdjustment: -0.22,
    upsideCap: 0.0,
  },
  "dry-quarter": {
    label: "Dry Quarter",
    description:
      "Favourable conditions improve execution, but upside is capped by crew and pipeline limits.",
    capacityLossMultiplier: 0.5,
    projectBillingAdjustment: 0.03,
    upsideCap: 0.06,
  },
};

export const ROLE_CONFIG: Record<
  Role,
  { label: string; tagline: string; question: string }
> = {
  "pe-board": {
    label: "PE Board",
    tagline: "Portfolio risk & covenant exposure",
    question: "Under the downside case, are we safe?",
  },
  cfo: {
    label: "CFO",
    tagline: "Revenue forecast & variance analysis",
    question: "What changed, why did it change, and what should I check?",
  },
  "opco-md": {
    label: "Opco MD",
    tagline: "Operating company execution",
    question: "Which project or milestone needs management attention?",
  },
  "project-lead": {
    label: "Project Lead",
    tagline: "Daily crew capacity",
    question: "What can my crew realistically do this week?",
  },
  regression: {
    label: "Regression",
    tagline: "Weather → revenue model fit",
    question: "How well does weather explain the revenue movement?",
  },
};

export const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; description: string }
> = {
  healthy: { label: "Healthy", description: "Comfortable covenant headroom." },
  watch: { label: "Watch", description: "Headroom narrowing; monitor weekly." },
  "at-risk": {
    label: "At Risk",
    description: "Weather and timing pressure forecast revenue.",
  },
  critical: {
    label: "Critical",
    description: "Forecast revenue approaching or below the covenant floor.",
  },
};

export const SCENARIOS: Scenario[] = ["base", "wet-quarter", "dry-quarter"];
export const ROLES: Role[] = [
  "regression",
  "pe-board",
  "cfo",
  "opco-md",
  "project-lead",
];

/** Working days assumed per forecast week (Mon-Fri). */
export const WORKDAYS_PER_WEEK = 5;
