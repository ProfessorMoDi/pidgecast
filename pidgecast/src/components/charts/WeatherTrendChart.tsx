"use client";

import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WEATHER_THRESHOLDS } from "@/lib/config";
import { CONDITION_LABEL } from "@/lib/weather";
import { formatWeekday } from "@/lib/utils";
import type { WeatherDay, WeatherHour } from "@/lib/types";

interface WeatherTrendChartProps {
  hours: WeatherHour[];
  days: WeatherDay[];
  height?: number;
}

interface HourDatum {
  time: string;
  temp: number;
  precip: number;
}

interface DayDatum {
  date: string;
  weekday: string;
  capacityPct: number;
  condition: WeatherDay["condition"];
  isWorkday: boolean;
}

function capacityColor(pct: number): string {
  if (pct === 0) return "var(--risk-critical)";
  if (pct < 60) return "var(--risk-at-risk)";
  if (pct < 100) return "var(--risk-watch)";
  return "var(--risk-healthy)";
}

/** Build hourly data from daily aggregates when no hourly series is present. */
function deriveHoursFromDays(days: WeatherDay[]): HourDatum[] {
  const out: HourDatum[] = [];
  for (const d of days) {
    for (let h = 0; h < 24; h += 3) {
      const phase = Math.cos(((h - 15) / 24) * 2 * Math.PI);
      const mid = (d.tempMinC + d.tempMaxC) / 2;
      const amp = (d.tempMaxC - d.tempMinC) / 2;
      out.push({
        time: `${d.date}T${String(h).padStart(2, "0")}:00`,
        temp: Number((mid + amp * phase).toFixed(1)),
        precip: h >= 12 && h <= 18 ? Number((d.precipitationMm * 0.15).toFixed(2)) : 0,
      });
    }
  }
  return out;
}

function HourTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HourDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const dt = new Date(d.time);
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">
        {dt.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Temperature</span>
          <span>{d.temp.toFixed(1)}°C</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Precipitation</span>
          <span>{d.precip.toFixed(1)} mm</span>
        </div>
      </div>
    </div>
  );
}

function DayTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DayDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">
        {new Date(d.date).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </div>
      <div className="space-y-0.5 font-mono tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Capacity</span>
          <span>{d.capacityPct}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Condition</span>
          <span>{CONDITION_LABEL[d.condition]}</span>
        </div>
      </div>
    </div>
  );
}

export function WeatherTrendChart({
  hours,
  days,
  height = 220,
}: WeatherTrendChartProps) {
  const hourData: HourDatum[] =
    hours.length > 0
      ? hours.map((h) => ({
          time: h.time,
          temp: Number(h.temperatureC.toFixed(1)),
          precip: Number(h.precipitationMm.toFixed(2)),
        }))
      : deriveHoursFromDays(days);

  // Label one tick per day, anchored at noon where possible.
  const noonTicks = hourData
    .filter((h) => h.time.slice(11, 13) === "12")
    .map((h) => h.time);

  const dayData: DayDatum[] = days.map((d) => ({
    date: d.date,
    weekday: formatWeekday(d.date),
    capacityPct: Math.round(d.capacity * 100),
    condition: d.condition,
    isWorkday: d.isWorkday,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Temperature &amp; precipitation</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-px w-3 bg-[var(--chart-1)]" />
              Temp °C
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-[var(--chart-2)]" />
              Rain mm
            </span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={hourData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="time"
              ticks={noonTicks.length > 0 ? noonTicks : undefined}
              tickFormatter={(v: string) => formatWeekday(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              yAxisId="temp"
              tickFormatter={(v: number) => `${v}°`}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              yAxisId="precip"
              orientation="right"
              tickFormatter={(v: number) => `${v}`}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              content={<HourTooltip />}
              cursor={{ stroke: "var(--border)" }}
            />
            <ReferenceLine
              yAxisId="temp"
              y={WEATHER_THRESHOLDS.frostMinTempC}
              stroke="var(--risk-critical)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: "Frost — hard stop",
                position: "insideBottomLeft",
                fontSize: 10,
                fill: "var(--risk-critical)",
              }}
            />
            <Bar
              yAxisId="precip"
              dataKey="precip"
              fill="var(--chart-2)"
              fillOpacity={0.5}
              maxBarSize={6}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Daily crew capacity
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={dayData}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="weekday"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip content={<DayTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="capacityPct" radius={[3, 3, 0, 0]} maxBarSize={36}>
              {dayData.map((d) => (
                <Cell
                  key={d.date}
                  fill={capacityColor(d.capacityPct)}
                  fillOpacity={d.isWorkday ? 0.9 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
