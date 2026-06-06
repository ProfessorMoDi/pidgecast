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
import { formatEur, formatEurCompact } from "@/lib/utils";
import type { ForecastWeek } from "@/lib/types";

interface RevenueStreamChartProps {
  weeks: ForecastWeek[];
  height?: number;
}

interface StreamDatum {
  weekLabel: string;
  recurring: number;
  projectBilling: number;
}

function StreamTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: StreamDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const total = d.recurring + d.projectBilling;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm bg-[var(--stream-recurring)]" />
            Recurring
          </span>
          <span>{formatEur(d.recurring)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm bg-[var(--stream-project)]" />
            Project billing
          </span>
          <span>{formatEur(d.projectBilling)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Total</span>
          <span>{formatEur(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function RevenueStreamChart({
  weeks,
  height = 260,
}: RevenueStreamChartProps) {
  const data: StreamDatum[] = weeks.map((w) => ({
    weekLabel: w.weekLabel,
    recurring: Math.round(w.recurringRevenue),
    projectBilling: Math.round(w.projectBillingRevenue),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
          tickFormatter={(v) => formatEurCompact(v)}
          tickLine={false}
          axisLine={false}
          width={64}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<StreamTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) =>
            value === "recurring" ? "Recurring (stable)" : "Project billing (weather-sensitive)"
          }
        />
        <Bar
          dataKey="recurring"
          stackId="rev"
          fill="var(--stream-recurring)"
          radius={[0, 0, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="projectBilling"
          stackId="rev"
          fill="var(--stream-project)"
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
