"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import {
  analyze,
  COMPANY_OPTIONS,
  DEFAULT_STATE,
  FACTORS,
  type AnalysisState,
  type CompanyScope,
  type FactorId,
} from "@/lib/weather-regression/engine";
import { cn, formatEurCompact } from "@/lib/utils";
import {
  Activity,
  CloudRain,
  Crosshair,
  Sigma,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Preset {
  label: string;
  state: Omit<Partial<AnalysisState>, "factors"> & {
    factors?: Partial<Record<FactorId, number>>;
  };
  hint: string;
}

// A deliberately small preset set — adaptable without overwhelming.
const PRESETS: Preset[] = [
  {
    label: "Strongest signal",
    hint: "Pooled, weekly, frost ≤ 2°C — the clearest weather→revenue link.",
    state: { company: "pooled", res: "weekly", season: true, lag: 0, factors: { frost: 2 } },
  },
  {
    label: "Gilde vs frost",
    hint: "Frost is robust for Gilde even after season adjustment.",
    state: { company: "gilde", res: "weekly", season: true, lag: 0, factors: { frost: 0 } },
  },
  {
    label: "Rain red herring",
    hint: "Rain alone shows no reliable effect once seasonality is removed.",
    state: { company: "pooled", res: "weekly", season: true, lag: 0, factors: { rain: 3 } },
  },
  {
    label: "Seasonality trap",
    hint: "Cold looks strong monthly — until you remove the season.",
    state: { company: "pooled", res: "monthly", season: false, lag: 0, factors: { cold: 6 } },
  },
];

function applyPreset(base: AnalysisState, preset: Preset): AnalysisState {
  const { factors: presetFactors = {}, ...rest } = preset.state;
  const next: AnalysisState = {
    ...base,
    ...rest,
    factors: { ...base.factors },
  };
  for (const f of FACTORS) {
    const val = presetFactors[f.id];
    if (val !== undefined) {
      next.factors[f.id] = { on: true, val };
    } else {
      next.factors[f.id] = { ...base.factors[f.id], on: false };
    }
  }
  return next;
}

interface WeatherRegressionLabProps {
  defaultCompany?: CompanyScope;
}

export function WeatherRegressionLab({ defaultCompany }: WeatherRegressionLabProps) {
  const [state, setState] = useState<AnalysisState>(() => ({
    ...DEFAULT_STATE,
    company: defaultCompany ?? DEFAULT_STATE.company,
    factors: { ...DEFAULT_STATE.factors },
  }));

  const result = useMemo(() => analyze(state), [state]);

  const negative = result.r < 0;
  const sigLabel =
    result.significance === "significant"
      ? "Significant (p<0.05)"
      : result.significance === "weak"
        ? "Weak (p<0.10)"
        : "Not significant";

  function setFactor(id: FactorId, patch: Partial<{ on: boolean; val: number }>) {
    setState((s) => ({
      ...s,
      factors: { ...s.factors, [id]: { ...s.factors[id], ...patch } },
    }));
  }

  return (
    <div className="space-y-4">
      {/* Live metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Correlation (Spearman r)"
          value={`${result.r >= 0 ? "+" : ""}${result.r.toFixed(3)}`}
          accent={negative ? "negative" : result.r > 0 ? "positive" : "default"}
          icon={negative ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
          sublabel={`Bad-weather days vs ${state.season ? "season-adj. " : ""}revenue`}
          hint="Spearman rank correlation between the count of bad-weather days per period and period revenue. Recomputed live from the historical daily data."
          footer={<ProvenanceBadge provenance="measured" />}
        />
        <MetricCard
          label="Significance (p-value)"
          value={result.p < 0.001 ? "<0.001" : result.p.toFixed(3)}
          accent={result.significance === "significant" ? "positive" : result.significance === "weak" ? "warning" : "default"}
          icon={<Sigma className="size-4" />}
          sublabel={sigLabel}
          hint="Two-sided Student-t p-value derived from r and the sample size, via the regularized incomplete beta function (matches scipy)."
        />
        <MetricCard
          label="Revenue impact"
          value={`${result.impactPct >= 0 ? "+" : ""}${result.impactPct.toFixed(0)}%`}
          accent={result.impactPct < 0 ? "negative" : "positive"}
          icon={<CloudRain className="size-4" />}
          sublabel={`Bad ${formatEurCompact(result.medianBad)} vs good ${formatEurCompact(result.medianGood)} (median)`}
          hint={`Median revenue of the ${state.split}% most-bad-weather periods vs the ${state.split}% fewest, using raw (non-adjusted) revenue.`}
        />
        <MetricCard
          label="Sample"
          value={`${result.n}`}
          icon={<Activity className="size-4" />}
          sublabel={`${state.res === "weekly" ? "Weeks" : "Months"}${state.lag > 0 ? ` · lag ${state.lag}` : ""}${state.company === "pooled" ? " · pooled" : ""}`}
          hint="Number of period observations entering the correlation after lag and grouping."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Controls */}
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </span>
            <div className="flex flex-col gap-1">
              {COMPANY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, company: c.id }))}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left text-sm font-medium transition-all",
                    state.company === c.id
                      ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)] shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/60"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resolution
            </span>
            <div className="inline-flex w-full rounded-md border bg-muted/40 p-0.5">
              {(["weekly", "monthly"] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, res }))}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-sm font-medium capitalize transition-colors",
                    state.res === res
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="text-sm font-medium">Remove seasonality</span>
            <input
              type="checkbox"
              checked={state.season}
              onChange={(e) => setState((s) => ({ ...s, season: e.target.checked }))}
              className="size-4 accent-[var(--brand)]"
            />
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lag (periods)</span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {state.lag}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={state.lag}
              onChange={(e) => setState((s) => ({ ...s, lag: Number(e.target.value) }))}
              className="w-full accent-[var(--brand)]"
            />
          </div>

          <div className="space-y-2 border-t pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bad-weather factors
            </span>
            {FACTORS.map((f) => {
              const st = state.factors[f.id];
              return (
                <div key={f.id} className="space-y-1">
                  <label className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={st.on}
                        onChange={(e) => setFactor(f.id, { on: e.target.checked })}
                        className="size-3.5 accent-[var(--brand)]"
                      />
                      <span className={cn(!st.on && "text-muted-foreground")}>
                        {f.label}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {st.val}
                      {f.unit}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={st.val}
                    disabled={!st.on}
                    onChange={(e) => setFactor(f.id, { val: Number(e.target.value) })}
                    className="w-full accent-[var(--brand)] disabled:opacity-40"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Scatter + presets */}
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Crosshair className="size-4 text-muted-foreground" />
              Bad-weather days vs {state.season ? "season-adjusted " : ""}revenue
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={p.hint}
                  onClick={() => setState((s) => applyPreset(s, p))}
                  className="rounded-md border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-[var(--brand)]/40 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] hover:shadow-sm"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Bad-weather days"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{
                  value: state.season ? "Bad-weather days (season-adj.)" : "Bad-weather days per period",
                  position: "insideBottom",
                  offset: -8,
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Revenue"
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => formatEurCompact(v)}
              />
              <ZAxis range={[50, 50]} />
              {state.season && (
                <>
                  <ReferenceLine x={0} stroke="var(--border)" />
                  <ReferenceLine y={0} stroke="var(--border)" />
                </>
              )}
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as { x: number; y: number };
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="space-y-0.5 font-mono tabular-nums">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Bad days</span>
                          <span>{pt.x.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Revenue</span>
                          <span>{formatEurCompact(pt.y)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                name="Fitted line"
                data={result.fitLine}
                line={{ stroke: negative ? "var(--risk-at-risk)" : "var(--risk-healthy)", strokeWidth: 2 }}
                lineJointType="linear"
                shape={() => <g />}
                isAnimationActive={false}
              />
              <Scatter
                name="Periods"
                data={result.scatter}
                fill="var(--brand)"
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>

          <p className="border-t pt-3 text-xs text-muted-foreground text-pretty">
            Each point is one {state.res === "weekly" ? "week" : "month"}. Bad day =
            any enabled factor met ({result.enabledFactorSummary}). Spearman r ={" "}
            <span className="font-mono">{result.r.toFixed(3)}</span>, p ={" "}
            <span className="font-mono">
              {result.p < 0.001 ? "<0.001" : result.p.toFixed(3)}
            </span>{" "}
            over {result.n} periods. Revenue is invoice-dated, which blurs
            day-level weather effects.
          </p>
        </div>
      </div>
    </div>
  );
}
