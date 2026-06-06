"use client";

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatDays, formatEurCompact, formatEur } from "@/lib/utils";
import type { RegressionPoint } from "@/lib/regression";

export interface RegressionScatterPoint extends RegressionPoint {
  label: string;
  scenario: string;
}

interface RegressionScatterChartProps {
  points: RegressionScatterPoint[];
  fitLine: RegressionPoint[];
  height?: number;
}

interface ScatterTooltipPayload {
  payload: RegressionScatterPoint;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ScatterTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (!p?.label) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">
        {p.label}
        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
          {p.scenario}
        </span>
      </div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Workable days</span>
          <span>{formatDays(p.x)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Project billing</span>
          <span>{formatEur(p.y)}</span>
        </div>
      </div>
    </div>
  );
}

export function RegressionScatterChart({
  points,
  fitLine,
  height = 300,
}: RegressionScatterChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Effective workable days"
          domain={["dataMin - 0.3", "dataMax + 0.3"]}
          tickFormatter={(v: number) => `${v.toFixed(1)}d`}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          label={{
            value: "Effective workable days",
            position: "insideBottom",
            offset: -8,
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Project billing"
          tickFormatter={(v: number) => formatEurCompact(v)}
          tickLine={false}
          axisLine={false}
          width={64}
          domain={["dataMin - 50000", "dataMax + 50000"]}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          content={<ScatterTooltip />}
          cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
        <Scatter
          name="Fitted line (OLS)"
          data={fitLine}
          line={{ stroke: "var(--chart-5)", strokeWidth: 2 }}
          lineJointType="linear"
          shape={() => <g />}
          legendType="line"
          isAnimationActive={false}
        />
        <Scatter
          name="Week observations"
          data={points}
          fill="var(--chart-1)"
          fillOpacity={0.8}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
