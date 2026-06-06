// Small, transparent ordinary-least-squares helper for Pidgecast.
//
// Used by the Regression Analysis view to fit a simple univariate model of
// project-billing revenue against effective workable days. Kept deliberately
// explicit (no external stats dependency) so the maths is auditable and can
// later be swapped for a real, multi-regressor fit over historical data.

export interface RegressionPoint {
  x: number;
  y: number;
}

export interface RegressionResult {
  /** Slope of the fitted line (change in y per unit x). */
  slope: number;
  /** Intercept of the fitted line. */
  intercept: number;
  /** Coefficient of determination (0-1). */
  r2: number;
  /** Pearson correlation coefficient (-1..1). */
  r: number;
  /** Number of observations used. */
  n: number;
  meanX: number;
  meanY: number;
}

/**
 * Fit y = slope * x + intercept by ordinary least squares.
 * Returns a zeroed-but-valid result for degenerate inputs (n < 2 or no
 * variance in x) so callers never have to special-case NaN.
 */
export function linearRegression(points: RegressionPoint[]): RegressionResult {
  const n = points.length;

  if (n === 0) {
    return { slope: 0, intercept: 0, r2: 0, r: 0, n: 0, meanX: 0, meanY: 0 };
  }

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  if (n < 2) {
    return { slope: 0, intercept: meanY, r2: 0, r: 0, n, meanX, meanY };
  }

  let sxx = 0; // sum of squared x deviations
  let syy = 0; // sum of squared y deviations
  let sxy = 0; // sum of x*y deviations
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  if (sxx === 0) {
    return { slope: 0, intercept: meanY, r2: 0, r: 0, n, meanX, meanY };
  }

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  const r = Math.sqrt(Math.max(0, Math.min(1, r2))) * Math.sign(slope);

  return { slope, intercept, r2, r, n, meanX, meanY };
}

/** Predict y for a given x from a fitted model. */
export function predict(model: RegressionResult, x: number): number {
  return model.slope * x + model.intercept;
}

/**
 * Two endpoints of the fitted line spanning the supplied x range, suitable
 * for rendering a straight regression line on a scatter chart.
 */
export function regressionLine(
  model: RegressionResult,
  xs: number[]
): RegressionPoint[] {
  if (xs.length === 0) return [];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return [
    { x: minX, y: predict(model, minX) },
    { x: maxX, y: predict(model, maxX) },
  ];
}

/**
 * t-statistic for the slope coefficient, derived from r and n. Returned for
 * illustrative significance display only; a real fit would compute robust
 * standard errors over historical data.
 */
export function tStatistic(model: RegressionResult): number {
  if (model.n <= 2) return 0;
  if (model.r2 >= 1) return Infinity;
  return (
    model.r * Math.sqrt((model.n - 2) / (1 - model.r2))
  );
}
