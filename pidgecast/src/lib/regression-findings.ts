/**
 * Pidgecast — Regression Analysis findings.
 *
 * Real, computed results extracted from the completed Python weather→revenue
 * backtest in `analysis/`. Each datum is annotated with the output file it came
 * from. Where a number was NOT present in any output file, it is marked with a
 * provenance of "user_range" (the user-provided authoritative ranges) and a note.
 *
 * This file is intentionally self-contained: pure data + interfaces, no imports,
 * so any view/chart can consume it.
 *
 * Source files referenced (relative to repo root):
 *   - analysis/output_company2/summary.json
 *   - analysis/output_company2/correlations_weekly.csv
 *   - analysis/output_strategies/all_strategy_results.json
 *   - analysis/output_playbook/weather_rule_playbook.csv
 *   - analysis/output_bruteforce/bruteforce_all.csv
 *   - analysis/output_forecast/forecast_example.csv
 *   - analysis/weather_strategies.py  (model spec / column meanings)
 *   - analysis/revenue_forecast.py    (forecast band methodology)
 */

/** Whether a value is a measured backtest output or an illustrative/stated range. */
export type Provenance = "measured" | "user_range" | "illustrative";

/** Sign/direction of an estimated effect on revenue. */
export type EffectDirection = "positive" | "negative" | "none";

// ---------------------------------------------------------------------------
// 1. META
// ---------------------------------------------------------------------------

export interface SubjectInfo {
  readonly name: string;
  readonly location: string;
  /** Primary subject drives the headline numbers; secondary is the comparison. */
  readonly role: "primary" | "secondary";
}

export interface RegressionMeta {
  readonly subjects: readonly SubjectInfo[];
  /** Period covered by the primary subject's ledger + weather merge. */
  readonly periodStart: string; // ISO date
  readonly periodEnd: string; // ISO date
  /** Deduplicated transaction count (primary subject, Ummels). */
  readonly nTransactions: number;
  /** Total revenue analysed for the primary subject, in EUR. */
  readonly totalRevenueEur: number;
  readonly weeksAnalyzed: number;
  readonly monthsAnalyzed: number;
  readonly dataResolution: readonly ("weekly" | "monthly")[];
  readonly weatherSource: string;
  readonly keyLimitation: string;
  readonly provenance: Provenance;
  readonly sourceFile: string;
}

export const REGRESSION_META: RegressionMeta = {
  // analysis/output_company2/summary.json (company, location, transactions, totals)
  subjects: [
    {
      name: "Dakdekkersbedrijf Peter Ummels",
      location: "Brunssum 6442PB (50.947, 5.972)",
      role: "primary",
    },
    {
      name: "Gilde GB",
      location: "Valkenswaard",
      role: "secondary",
    },
  ],
  periodStart: "2023-01-15", // summary.json date_range
  periodEnd: "2026-06-02", // summary.json date_range
  nTransactions: 9752, // summary.json "transactions"
  totalRevenueEur: 35775926.24, // summary.json "total_revenue_eur"
  weeksAnalyzed: 163, // summary.json "weeks_analyzed"
  monthsAnalyzed: 42, // summary.json "months_analyzed"
  dataResolution: ["weekly", "monthly"],
  weatherSource:
    "Open-Meteo Historical Archive (daily, Europe/Amsterdam timezone)",
  keyLimitation:
    "All financial data is invoice/booking-dated, not work-dated, and there are no labour hours. Invoice timing lags and clusters away from weather-dependent work, blurring day-level weather effects. Causal proof requires actual work/job dates or hours, re-run at daily resolution.",
  provenance: "measured",
  sourceFile: "analysis/output_company2/summary.json",
};

// ---------------------------------------------------------------------------
// 2. HEADLINE MODEL (FE-OLS)
// ---------------------------------------------------------------------------

export interface ModelEffectEstimate {
  /** Point estimate of % revenue change per +1 workable day/week. */
  readonly pointPct: number;
  /** Low/high of the headline reported range (pooled panel ↔ single company). */
  readonly lowPct: number;
  readonly highPct: number;
  readonly pValue: number;
  readonly provenance: Provenance;
  readonly note: string;
}

export interface RegressionModel {
  /** Human-readable FE-OLS specification. */
  readonly specification: string;
  readonly seMethod: string;
  /** Headline workable-day effect (point + range + p). */
  readonly workableDayEffect: ModelEffectEstimate;
  /** R² of the headline single-company FE-OLS (Ummels). */
  readonly r2: number | null;
  readonly r2Provenance: Provenance;
  readonly r2Note: string;
  /** Supporting fits used to bound the reported range. */
  readonly fits: readonly {
    readonly label: string;
    readonly coef: number; // log-revenue coefficient on workable_days
    readonly pctPerUnit: number; // 100 * (exp(coef) - 1)
    readonly pValue: number;
    readonly r2: number | null;
    readonly n: number | null;
    readonly sourceFile: string;
  }[];
}

export const REGRESSION_MODEL: RegressionModel = {
  // analysis/weather_strategies.py line 174: base = "log_rev ~ C(month) + C(year) + t"
  // weather metric appended; S7 pooled adds C(company). HAC SE maxlags=4 (lines 177/286).
  specification:
    "log(revenue) ~ workable_days + C(month) + C(year) + trend(t)  [pooled panel adds C(company)]",
  seMethod: "Newey-West HAC robust standard errors (maxlags = 4)",
  workableDayEffect: {
    // Pooled panel S7: 10.99% (p=0.030); single-company Ummels S1: 13.94% (p=0.043).
    pointPct: 12, // midpoint of the measured 11–14% range
    lowPct: 11.0, // POOLED(2) S7 workable_days pct_per_unit = 10.99
    highPct: 13.9, // Ummels S1 workable_days pct_per_unit = 13.94
    pValue: 0.03, // pooled panel p ≈ 0.0303 (Ummels single-company p ≈ 0.0431)
    provenance: "measured",
    note: "+1 workable day/week ≈ +11–14% revenue. Low bound = pooled 2-company panel (S7), high bound = single-company Ummels FE-OLS (S1). Both significant at p≈0.03–0.04.",
  },
  r2: 0.25, // Ummels S1 workable_days r2 = 0.24996698403571638
  r2Provenance: "measured",
  r2Note:
    "R² of the Ummels single-company FE-OLS with workable_days (all_strategy_results.json S1_ummels). The pooled panel (S7) does not report an R² in the output files.",
  fits: [
    {
      label: "Peter Ummels (Brunssum) — FE-OLS S1",
      coef: 0.13050564948743623,
      pctPerUnit: 13.940437692608976,
      pValue: 0.04312640808010306,
      r2: 0.24996698403571638,
      n: 163,
      sourceFile: "analysis/output_strategies/all_strategy_results.json (S1_ummels)",
    },
    {
      label: "Gilde GB (Valkenswaard) — FE-OLS S1",
      coef: 0.08100796495467347,
      pctPerUnit: 8.437953356619744,
      pValue: 0.20135571931735674,
      r2: 0.17899835228206007,
      n: 172,
      sourceFile: "analysis/output_strategies/all_strategy_results.json (S1_gilde)",
    },
    {
      label: "Pooled 2-company panel — S7",
      coef: 0.10425622523585677,
      pctPerUnit: 10.988479898035685,
      pValue: 0.030317785817294947,
      r2: null,
      n: 335,
      sourceFile: "analysis/output_strategies/all_strategy_results.json (S7_panel)",
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. WEATHER FLAG DEFINITIONS
// ---------------------------------------------------------------------------

export interface WeatherFlagDefinition {
  readonly flag: string;
  readonly rule: string;
}

export const WEATHER_FLAG_DEFINITIONS: readonly WeatherFlagDefinition[] = [
  // analysis/weather_strategies.py day-flag construction (user-provided methodology).
  { flag: "Rain day", rule: "rain ≥ 1 mm" },
  { flag: "Heavy rain", rule: "rain ≥ 5 mm" },
  { flag: "Frost", rule: "min temperature ≤ 0 °C" },
  { flag: "Cold", rule: "mean temperature ≤ 5 °C" },
  { flag: "Heat", rule: "max temperature ≥ 28 °C" },
  { flag: "Windy", rule: "max wind ≥ 40 km/h" },
  { flag: "Storm", rule: "wind gust ≥ 60 km/h" },
  { flag: "Workable", rule: "none of the above flags set" },
];

export const WEATHER_FLAG_DEFINITIONS_PROVENANCE: Provenance = "measured";

// ---------------------------------------------------------------------------
// 4. DRIVER EFFECTS (per regressor)
// ---------------------------------------------------------------------------

export interface DriverEffect {
  readonly driver: string;
  readonly direction: EffectDirection;
  /** Plain-language summary of the estimated effect. */
  readonly effectSummary: string;
  /** Whether it remains significant after seasonality adjustment. */
  readonly significantAfterSeasonAdjust: boolean;
  /** Best measured number to surface (e.g. FE-OLS % per unit, or deseasonalized r). */
  readonly headlineStat: string;
  readonly ummelsNote: string;
  readonly gildeNote: string;
  readonly provenance: Provenance;
  readonly sourceFile: string;
}

export const DRIVER_EFFECTS: readonly DriverEffect[] = [
  {
    driver: "Workable days",
    direction: "positive",
    effectSummary:
      "The one robust positive driver: each extra workable day per week lifts revenue ~11–14%.",
    significantAfterSeasonAdjust: true,
    headlineStat:
      "FE-OLS +13.9%/day (Ummels, p=0.043); pooled panel +11.0%/day (p=0.030)",
    ummelsNote: "Significant in single-company FE-OLS (coef 0.131, p=0.043).",
    gildeNote: "Same sign but weaker alone (+8.4%/day, p=0.20); strong in 2–3 week rolling lag (r=0.22, p=0.004).",
    provenance: "measured",
    sourceFile: "analysis/output_strategies/all_strategy_results.json (S1/S2/S7)",
  },
  {
    driver: "Frost days",
    direction: "negative",
    effectSummary:
      "Strongest negative signal; coldest nights (≤ −1…−2 °C) line up with revenue dips.",
    significantAfterSeasonAdjust: false,
    headlineStat:
      "Weekly Pearson r=−0.230 (p=0.003) raw; deseasonalized r=−0.208 (p=0.006) Gilde, −0.142 (p=0.071) Ummels",
    ummelsNote:
      "Strong raw correlation (r=−0.23) but largely seasonal — fades to r=−0.14 (p=0.07) after deseasonalize/detrend.",
    gildeNote:
      "Robust even after deseasonalize/detrend: r=−0.208 (p=0.006). The clearest cold-weather effect in the study.",
    provenance: "measured",
    sourceFile:
      "analysis/output_company2/correlations_weekly.csv; all_strategy_results.json (S4)",
  },
  {
    driver: "Cold days",
    direction: "negative",
    effectSummary: "Negative, tracks frost; mostly seasonal for Ummels, robust for Gilde.",
    significantAfterSeasonAdjust: false,
    headlineStat:
      "Deseasonalized r=−0.207 (p=0.006) Gilde; r=−0.128 (p=0.102) Ummels",
    ummelsNote: "Raw weekly r=−0.182 (p=0.020); not significant after season adjustment.",
    gildeNote: "Deseasonalized r=−0.207 (p=0.006) — significant alongside frost.",
    provenance: "measured",
    sourceFile:
      "analysis/output_company2/correlations_weekly.csv; all_strategy_results.json (S4)",
  },
  {
    driver: "Rain days",
    direction: "none",
    effectSummary: "No reliable effect once seasonality is removed.",
    significantAfterSeasonAdjust: false,
    headlineStat: "FE-OLS +3.6%/day (p=0.49) Ummels; deseasonalized r≈0.04 (n.s.)",
    ummelsNote: "FE-OLS coef 0.036, p=0.49; deseasonalized r=0.036 (p=0.65).",
    gildeNote: "FE-OLS coef 0.029, p=0.60; deseasonalized r=0.015 (p=0.84).",
    provenance: "measured",
    sourceFile: "analysis/output_strategies/all_strategy_results.json (S1/S4)",
  },
  {
    driver: "Heavy rain days",
    direction: "none",
    effectSummary: "No measurable effect on revenue.",
    significantAfterSeasonAdjust: false,
    headlineStat: "FE-OLS −6.4%/day (p=0.45) Ummels; −1.1%/day (p=0.94) Gilde",
    ummelsNote: "FE-OLS coef −0.066, p=0.45; deseasonalized r=−0.031 (p=0.70).",
    gildeNote: "FE-OLS coef −0.011, p=0.94.",
    provenance: "measured",
    sourceFile: "analysis/output_strategies/all_strategy_results.json (S1/S4)",
  },
  {
    driver: "Heat days",
    direction: "none",
    effectSummary: "No effect on revenue after season adjustment.",
    significantAfterSeasonAdjust: false,
    headlineStat: "FE-OLS −1.1%/day (p=0.90) Ummels; +10.9%/day (p=0.41) Gilde",
    ummelsNote:
      "FE-OLS coef −0.011, p=0.90. Note: negative link to invoice activity proxy (r=−0.178, p=0.023).",
    gildeNote: "FE-OLS coef 0.104, p=0.41; deseasonalized r=0.028 (p=0.72).",
    provenance: "measured",
    sourceFile: "analysis/output_strategies/all_strategy_results.json (S1/S4/S5)",
  },
  {
    driver: "Windy days",
    direction: "none",
    effectSummary: "No reliable effect; noisy, opposite signs across companies.",
    significantAfterSeasonAdjust: false,
    headlineStat: "FE-OLS −88%/day (p=0.15) Ummels; +28%/day (p=0.29) Gilde (very few windy days)",
    ummelsNote: "FE-OLS coef −2.13, p=0.15 — large but driven by rare windy weeks; not significant.",
    gildeNote: "FE-OLS coef +0.25, p=0.29.",
    provenance: "measured",
    sourceFile: "analysis/output_strategies/all_strategy_results.json (S1)",
  },
  {
    driver: "Storm days",
    direction: "none",
    effectSummary:
      "Too rare to estimate a reliable coefficient; no significant correlation.",
    significantAfterSeasonAdjust: false,
    headlineStat: "Weekly raw r=−0.084 (p=0.29) Ummels; not modeled in FE-OLS (sparse)",
    ummelsNote: "Weekly Pearson r=−0.084 (p=0.29). Excluded from FE-OLS driver list (sparse events).",
    gildeNote: "Not separately reported; folded into wind/extreme analyses.",
    provenance: "measured",
    sourceFile: "analysis/output_company2/correlations_weekly.csv",
  },
];

// ---------------------------------------------------------------------------
// 5. CORRELATION BY LAG (weekly, primary subject Ummels)
// ---------------------------------------------------------------------------

export interface CorrelationLagRow {
  readonly feature: string;
  readonly lagWeeks: number;
  readonly n: number;
  readonly pearsonR: number;
  readonly pearsonP: number;
  readonly spearmanR: number;
  readonly spearmanP: number;
}

/**
 * Weekly contemporaneous + lagged correlations for the key features, Ummels.
 * Lags present in the output file are 0/1/2/4 weeks (lag 3 not computed there).
 * Source: analysis/output_company2/correlations_weekly.csv
 */
export const CORRELATION_BY_LAG: readonly CorrelationLagRow[] = [
  // frost_days — strongest contemporaneous negative
  { feature: "frost_days", lagWeeks: 0, n: 163, pearsonR: -0.22991223349235906, pearsonP: 0.0031532635879246464, spearmanR: -0.2126394860363946, spearmanP: 0.006427352854597385 },
  { feature: "frost_days", lagWeeks: 1, n: 162, pearsonR: -0.19383754996554795, pearsonP: 0.013453543086991458, spearmanR: -0.14949788031786673, spearmanP: 0.057597685015168446 },
  { feature: "frost_days", lagWeeks: 2, n: 161, pearsonR: -0.0020235790159687933, pearsonP: 0.9796750535483776, spearmanR: -0.04903616650869181, spearmanP: 0.5367580208193293 },
  { feature: "frost_days", lagWeeks: 4, n: 159, pearsonR: -0.0819699557597296, pearsonP: 0.3043375181239011, spearmanR: -0.05385757974082109, spearmanP: 0.5001527423166822 },
  // workable_days — key positive driver
  { feature: "workable_days", lagWeeks: 0, n: 163, pearsonR: 0.1815424144124252, pearsonP: 0.020381638869060685, spearmanR: 0.18007740095438882, spearmanP: 0.021435879531555957 },
  { feature: "workable_days", lagWeeks: 1, n: 162, pearsonR: 0.04302443885658931, pearsonP: 0.5867008915420141, spearmanR: 0.0681256089792071, spearmanP: 0.38902642209404464 },
  { feature: "workable_days", lagWeeks: 2, n: 161, pearsonR: -0.04906300278871979, pearsonP: 0.5365348906244111, spearmanR: -0.030323611511754174, spearmanP: 0.7025701707310321 },
  { feature: "workable_days", lagWeeks: 4, n: 159, pearsonR: 0.011797195275458857, pearsonP: 0.8826676257716128, spearmanR: -0.011994796993465803, spearmanP: 0.8807167683275924 },
  // cold_days — supporting negative
  { feature: "cold_days", lagWeeks: 0, n: 163, pearsonR: -0.18158027993450113, pearsonP: 0.020354995203750156, spearmanR: -0.15755210639129397, spearmanP: 0.04458245365171746 },
  { feature: "cold_days", lagWeeks: 1, n: 162, pearsonR: -0.09974642466976687, pearsonP: 0.2066302473906419, spearmanR: -0.08290555258908011, spearmanP: 0.29424666496048135 },
  { feature: "cold_days", lagWeeks: 2, n: 161, pearsonR: -0.005639285597679788, pearsonP: 0.9433997189438792, spearmanR: -0.05029181113888326, spearmanP: 0.5263677404188855 },
  { feature: "cold_days", lagWeeks: 4, n: 159, pearsonR: -0.0968646379886333, pearsonP: 0.22450424739862382, spearmanR: -0.12386658375033784, spearmanP: 0.1198100701896675 },
];

export const CORRELATION_BY_LAG_META = {
  subject: "Dakdekkersbedrijf Peter Ummels (Brunssum)",
  resolution: "weekly",
  provenance: "measured" as Provenance,
  note: "Contemporaneous (lag 0) and lagged correlations. The output file computes lags 0/1/2/4 weeks (no lag 3).",
  sourceFile: "analysis/output_company2/correlations_weekly.csv",
};

// ---------------------------------------------------------------------------
// 6. RULE PLAYBOOK (backtested if-weather-then-revenue rules)
// ---------------------------------------------------------------------------

export interface RulePlaybookRow {
  readonly company: string;
  readonly rule: string;
  readonly condition: string;
  readonly nWeeks: number;
  /** Raw revenue gap vs other weeks, %. */
  readonly rawGapPct: number;
  /** Season-adjusted revenue gap, %. */
  readonly seasonAdjGapPct: number;
  readonly pRaw: number;
  readonly pSeasonAdj: number;
  /** Verdict from the backtest ("WATCH" | "no signal"). */
  readonly verdict: string;
  /** No rule survived FDR correction — see BRUTE_FORCE_SUMMARY. */
  readonly survivedFdr: boolean;
}

export const RULE_PLAYBOOK: readonly RulePlaybookRow[] = [
  // analysis/output_playbook/weather_rule_playbook.csv
  { company: "Gilde (Valkenswaard)", rule: "Frost week", condition: "≥2 frost days (min ≤0°C)", nWeeks: 30, rawGapPct: -24.6, seasonAdjGapPct: -15.5, pRaw: 0.0016, pSeasonAdj: 0.0755, verdict: "WATCH", survivedFdr: false },
  { company: "Gilde (Valkenswaard)", rule: "Good week", condition: "≥6 workable days", nWeeks: 25, rawGapPct: 20.8, seasonAdjGapPct: 13.0, pRaw: 0.07, pSeasonAdj: 0.2173, verdict: "no signal", survivedFdr: false },
  { company: "Gilde (Valkenswaard)", rule: "Hard cold week", condition: "≥3 cold days (mean ≤5°C)", nWeeks: 35, rawGapPct: -19.6, seasonAdjGapPct: -10.5, pRaw: 0.0083, pSeasonAdj: 0.2354, verdict: "no signal", survivedFdr: false },
  { company: "Gilde (Valkenswaard)", rule: "Heat week", condition: "≥2 hot days (max ≥28°C)", nWeeks: 15, rawGapPct: 28.5, seasonAdjGapPct: 25.7, pRaw: 0.2924, pSeasonAdj: 0.285, verdict: "no signal", survivedFdr: false },
  { company: "Gilde (Valkenswaard)", rule: "Heavy-rain week", condition: "≥2 heavy-rain days (≥5mm)", nWeeks: 59, rawGapPct: 17.6, seasonAdjGapPct: 6.3, pRaw: 0.5357, pSeasonAdj: 0.579, verdict: "no signal", survivedFdr: false },
  { company: "Gilde (Valkenswaard)", rule: "Wet week", condition: "≥4 rain days (≥1mm)", nWeeks: 69, rawGapPct: 11.1, seasonAdjGapPct: -2.4, pRaw: 0.7358, pSeasonAdj: 0.8415, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Frost week", condition: "≥2 frost days (min ≤0°C)", nWeeks: 30, rawGapPct: -37.0, seasonAdjGapPct: -14.3, pRaw: 0.0059, pSeasonAdj: 0.3561, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Good week", condition: "≥6 workable days", nWeeks: 22, rawGapPct: 4.4, seasonAdjGapPct: 2.1, pRaw: 0.1972, pSeasonAdj: 0.5781, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Hard cold week", condition: "≥3 cold days (mean ≤5°C)", nWeeks: 32, rawGapPct: -28.6, seasonAdjGapPct: -8.4, pRaw: 0.0581, pSeasonAdj: 0.6654, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Heat week", condition: "≥2 hot days (max ≥28°C)", nWeeks: 14, rawGapPct: -16.7, seasonAdjGapPct: -23.9, pRaw: 0.8104, pSeasonAdj: 0.5596, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Heavy-rain week", condition: "≥2 heavy-rain days (≥5mm)", nWeeks: 58, rawGapPct: 0.2, seasonAdjGapPct: -0.3, pRaw: 0.9296, pSeasonAdj: 0.4784, verdict: "no signal", survivedFdr: false },
  { company: "Ummels (Brunssum)", rule: "Wet week", condition: "≥4 rain days (≥1mm)", nWeeks: 63, rawGapPct: 20.1, seasonAdjGapPct: 7.2, pRaw: 0.6738, pSeasonAdj: 0.9769, verdict: "no signal", survivedFdr: false },
];

export const RULE_PLAYBOOK_META = {
  provenance: "measured" as Provenance,
  note: "Raw vs season-adjusted revenue gaps for candidate trading rules. 'WATCH' marks the single rule with a notable raw effect (Gilde frost weeks, −24.6% raw) but it does not survive season adjustment or FDR. No rule survived FDR correction.",
  sourceFile: "analysis/output_playbook/weather_rule_playbook.csv",
};

// ---------------------------------------------------------------------------
// 7. BRUTE-FORCE FDR SUMMARY
// ---------------------------------------------------------------------------

export interface BruteForceSummary {
  readonly totalCombinations: number;
  readonly survivedFdr: number;
  readonly fdrMethod: string;
  /** Smallest BH-adjusted q-value observed across all tests. */
  readonly minQFdr: number;
  /** Smallest raw p-value observed (pre-correction). */
  readonly minRawP: number;
  readonly interpretation: string;
  readonly provenance: Provenance;
  readonly sourceFile: string;
}

export const BRUTE_FORCE_SUMMARY: BruteForceSummary = {
  // analysis/output_bruteforce/bruteforce_all.csv — 1102 lines incl. header = 1101 tests.
  totalCombinations: 1101,
  survivedFdr: 0, // 0 rows with q_fdr < 0.05
  fdrMethod: "Benjamini-Hochberg (BH-FDR)",
  minQFdr: 0.5928630139644606, // smallest q_fdr in the file
  minRawP: 0.0005701924459898644, // smallest raw p (tmin_under_2°C, pooled, lag 0)
  interpretation:
    "Across 1,101 weather-threshold × company × lag combinations, the best raw p-value (~0.0006) becomes q≈0.59 after multiple-comparison correction. Zero combinations survive FDR — there is no bulletproof single-threshold weather→revenue rule at this resolution. Large raw % gaps are mostly seasonal artifacts, not weather causation.",
  provenance: "measured",
  sourceFile: "analysis/output_bruteforce/bruteforce_all.csv",
};

// ---------------------------------------------------------------------------
// 8. FORECAST SCENARIO BANDS (illustrative model output)
// ---------------------------------------------------------------------------

export interface ForecastScenario {
  readonly company: string;
  readonly scenario: "GOOD weather" | "BAD weather";
  readonly workableDays: number;
  readonly expectedRevenueEur: number;
  readonly low80Eur: number;
  readonly high80Eur: number;
  readonly pctPerWorkableDay: number;
  /** True if the forecast week is beyond the fitted time range (extrapolated). */
  readonly extrapolated: boolean;
}

export const FORECAST_SCENARIOS: readonly ForecastScenario[] = [
  // analysis/output_forecast/forecast_example.csv
  { company: "Peter Ummels (Brunssum)", scenario: "GOOD weather", workableDays: 7, expectedRevenueEur: 641547, low80Eur: 109935, high80Eur: 3743851, pctPerWorkableDay: 12.4, extrapolated: true },
  { company: "Peter Ummels (Brunssum)", scenario: "BAD weather", workableDays: 2, expectedRevenueEur: 357360, low80Eur: 61237, high80Eur: 2085435, pctPerWorkableDay: 12.4, extrapolated: true },
  { company: "Gilde GB (Valkenswaard)", scenario: "GOOD weather", workableDays: 7, expectedRevenueEur: 206929, low80Eur: 31518, high80Eur: 1358569, pctPerWorkableDay: 9.3, extrapolated: true },
  { company: "Gilde GB (Valkenswaard)", scenario: "BAD weather", workableDays: 2, expectedRevenueEur: 132903, low80Eur: 20243, high80Eur: 872560, pctPerWorkableDay: 9.3, extrapolated: true },
];

export const FORECAST_SCENARIOS_META = {
  provenance: "illustrative" as Provenance,
  note: "Example scenario forecasts from a weekly log(revenue) ~ C(month) + t + workable_days model. The 80% band is exp(log_pred ± 1.28·resid_sd); because the model is in log space with high weekly variance, the bands are very wide and the example weeks are extrapolated beyond the fitted range. Treat as directional, not precise.",
  sourceFile: "analysis/output_forecast/forecast_example.csv",
};

// ---------------------------------------------------------------------------
// 9. TOP-LEVEL PROVENANCE INDEX (for UI badges)
// ---------------------------------------------------------------------------

export interface SectionProvenance {
  readonly section: string;
  readonly provenance: Provenance;
  readonly sourceFile: string;
}

export const IS_REAL_DATA: readonly SectionProvenance[] = [
  { section: "REGRESSION_META", provenance: "measured", sourceFile: "analysis/output_company2/summary.json" },
  { section: "REGRESSION_MODEL", provenance: "measured", sourceFile: "analysis/output_strategies/all_strategy_results.json" },
  { section: "WEATHER_FLAG_DEFINITIONS", provenance: "measured", sourceFile: "analysis/weather_strategies.py" },
  { section: "DRIVER_EFFECTS", provenance: "measured", sourceFile: "analysis/output_strategies/all_strategy_results.json; analysis/output_company2/correlations_weekly.csv" },
  { section: "CORRELATION_BY_LAG", provenance: "measured", sourceFile: "analysis/output_company2/correlations_weekly.csv" },
  { section: "RULE_PLAYBOOK", provenance: "measured", sourceFile: "analysis/output_playbook/weather_rule_playbook.csv" },
  { section: "BRUTE_FORCE_SUMMARY", provenance: "measured", sourceFile: "analysis/output_bruteforce/bruteforce_all.csv" },
  { section: "FORECAST_SCENARIOS", provenance: "illustrative", sourceFile: "analysis/output_forecast/forecast_example.csv" },
];
