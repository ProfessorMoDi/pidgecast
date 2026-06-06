"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDays } from "@/lib/utils";
import type { ForecastWeek } from "@/lib/types";

interface WorkableDaysChartProps {
  weeks: ForecastWeek[];
  height?: number;
}

interface DaysDatum {
  weekLabel: string;
  baseline: number;
  effective: number;
}

function DaysTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: DaysDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const lost = d.baseline - d.effective;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Baseline</span>
          <span>{formatDays(d.baseline)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Effective</span>
          <span>{formatDays(d.effective)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Capacity lost</span>
          <span>{formatDays(lost)}</span>
        </div>
      </div>
    </div>
  );
}

export function WorkableDaysChart({
  weeks,
  height = 260,
}: WorkableDaysChartProps) {
  const data: DaysDatum[] = weeks.map((w) => ({
    weekLabel: w.weekLabel,
    baseline: Number(w.baselineWorkableDays.toFixed(2)),
    effective: Number(w.effectiveWorkableDays.toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        barGap={4}
      >
        <XAxis
          dataKey="weekLabel"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={6}
          tickFormatter={(v: string) => v.replace("Week ", "W")}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          domain={[0, 5]}
          tickFormatter={(v) => `${v}d`}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<DaysTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) =>
            value === "baseline" ? "Baseline workable days" : "Weather-adjusted"
          }
        />
        <Bar
          dataKey="baseline"
          fill="var(--chart-3)"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="effective"
          fill="var(--chart-1)"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
