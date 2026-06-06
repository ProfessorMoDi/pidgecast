"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COVENANT_REVENUE_FLOOR_EUR } from "@/lib/config";
import { formatEur, formatEurCompact, formatEurDelta, formatPct } from "@/lib/utils";
import type { ForecastWeek } from "@/lib/types";

interface ForecastChartProps {
  weeks: ForecastWeek[];
  height?: number;
  /**
   * Optional realized-revenue series, keyed by weekIndex. We have no actuals
   * in the demo so this is left undefined; the chart stays budget vs
   * weather-adjusted. Wired here so real actuals can drop in later.
   */
  actuals?: Record<number, number>;
}

interface ChartDatum {
  weekIndex: number;
  weekLabel: string;
  budget: number;
  adjusted: number;
  /** Downside gap (budget − adjusted), clamped to >= 0, for the shaded band. */
  gap: number;
  impact: number;
  impactPct: number;
  covenantHeadroom: number;
  actual?: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{d.weekLabel}</div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-px w-3 bg-[var(--chart-3)]" />
            Budget
          </span>
          <span>{formatEur(d.budget)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-px w-3 bg-[var(--chart-1)]" />
            Weather-adjusted
          </span>
          <span>{formatEur(d.adjusted)}</span>
        </div>
        {d.actual !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Actual</span>
            <span>{formatEur(d.actual)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Weather impact</span>
          <span
            className={
              d.impact > 0
                ? "text-[var(--risk-at-risk)]"
                : "text-[var(--risk-healthy)]"
            }
          >
            {formatEurDelta(-d.impact)} ({formatPct(-d.impactPct)})
          </span>
        </div>
        <div className="flex justify-between gap-4 text-[11px] text-muted-foreground">
          <span>Covenant headroom</span>
          <span>{formatEur(d.covenantHeadroom)}</span>
        </div>
      </div>
    </div>
  );
}

export function ForecastChart({ weeks, height = 260, actuals }: ForecastChartProps) {
  const data: ChartDatum[] = weeks.map((w) => {
    const impact = w.baselineRevenue - w.forecastRevenue; // + = revenue lost to weather
    return {
      weekIndex: w.weekIndex,
      weekLabel: w.weekLabel,
      budget: Math.round(w.baselineRevenue),
      adjusted: Math.round(w.forecastRevenue),
      gap: Math.max(0, Math.round(impact)),
      impact: Math.round(impact),
      impactPct:
        w.baselineRevenue > 0 ? impact / w.baselineRevenue : 0,
      covenantHeadroom: Math.round(w.covenantHeadroom),
      actual: actuals?.[w.weekIndex],
    };
  });

  const hasActuals = data.some((d) => d.actual !== undefined);

  // Explicit domain focused on the budget/adjusted lines (and the floor), so
  // the small stacked "gap" band doesn't drag the axis toward zero.
  const lo = Math.min(
    ...data.map((d) => d.adjusted),
    COVENANT_REVENUE_FLOOR_EUR
  );
  const hi = Math.max(...data.map((d) => d.budget), COVENANT_REVENUE_FLOOR_EUR);
  const pad = Math.max(40000, (hi - lo) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
      >
        <defs>
          <linearGradient id="weatherImpactFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--risk-at-risk)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--risk-at-risk)" stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="weekLabel"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
          tickFormatter={(v: string) => v.replace("Week ", "W")}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          tickFormatter={(v) => formatEurCompact(v)}
          tickLine={false}
          axisLine={false}
          width={64}
          domain={[lo - pad, hi + pad]}
          allowDataOverflow
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />

        {/* Subtle, de-emphasized covenant floor reference. */}
        <ReferenceLine
          y={COVENANT_REVENUE_FLOOR_EUR}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.5}
          strokeDasharray="2 4"
          strokeWidth={1}
          ifOverflow="extendDomain"
          label={{
            value: "Covenant floor · revenue needed",
            position: "insideBottomRight",
            fontSize: 9,
            fill: "var(--muted-foreground)",
          }}
        />

        {/* Weather-impact band: invisible base up to the adjusted line, then a
            shaded area filling the gap up to the budget line. */}
        <Area
          type="monotone"
          dataKey="adjusted"
          stackId="band"
          stroke="none"
          fill="transparent"
          fillOpacity={0}
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="gap"
          stackId="band"
          stroke="none"
          fill="url(#weatherImpactFill)"
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />

        {/* Budget (plan) line — pre-weather baseline. */}
        <Line
          type="monotone"
          dataKey="budget"
          stroke="var(--chart-3)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          name="Budget"
          isAnimationActive={false}
        />
        {/* Weather-adjusted line — the main forecast after weather + scenario. */}
        <Line
          type="monotone"
          dataKey="adjusted"
          stroke="var(--chart-1)"
          strokeWidth={2.75}
          dot={{ r: 3, fill: "var(--chart-1)" }}
          activeDot={{ r: 5 }}
          name="Weather-adjusted"
          isAnimationActive={false}
        />
        {hasActuals && (
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--risk-healthy)"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Actual"
            connectNulls
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
