import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDays, formatPct } from "@/lib/utils";
import { CONDITION_LABEL } from "@/lib/weather";
import { CloudSun, ArrowRight } from "lucide-react";
import type { ForecastWeek, WeatherCondition, WeatherDay } from "@/lib/types";

interface WeatherImpactPanelProps {
  weatherDays: WeatherDay[];
  currentWeek: ForecastWeek | null;
}

export function WeatherImpactPanel({
  weatherDays,
  currentWeek,
}: WeatherImpactPanelProps) {
  const workdays = weatherDays.filter((d) => d.isWorkday);
  const conditionCounts = workdays.reduce<Record<string, number>>((acc, d) => {
    if (d.condition !== "normal") {
      acc[d.condition] = (acc[d.condition] ?? 0) + 1;
    }
    return acc;
  }, {});

  const limitingConditions = Object.entries(conditionCounts).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <Card className="py-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CloudSun className="size-4 text-muted-foreground" />
          Weather → capacity → revenue
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border bg-muted/50 px-2 py-1 font-medium">
            Live weather
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="rounded-md border bg-muted/50 px-2 py-1 font-medium">
            Crew capacity
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="rounded-md border bg-muted/50 px-2 py-1 font-medium">
            Milestone timing
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="rounded-md border bg-muted/50 px-2 py-1 font-medium">
            Revenue at risk
          </span>
        </div>

        {currentWeek && (
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Baseline days"
              value={formatDays(currentWeek.baselineWorkableDays)}
            />
            <Stat
              label="Effective days"
              value={formatDays(currentWeek.effectiveWorkableDays)}
              accent={
                currentWeek.effectiveWorkableDays <
                currentWeek.baselineWorkableDays
                  ? "warning"
                  : "default"
              }
            />
            <Stat
              label="Capacity impact"
              value={formatPct(currentWeek.weatherImpactPct)}
              accent={currentWeek.weatherImpactPct < 0 ? "warning" : "default"}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Limiting conditions this week
          </div>
          {limitingConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No capacity-limiting weather detected in the live forecast
              window. Full workable capacity.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {limitingConditions.map(([condition, count]) => (
                <span
                  key={condition}
                  className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                >
                  {CONDITION_LABEL[condition as WeatherCondition]} ·{" "}
                  <span className="font-mono tabular-nums">{count}d</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground text-pretty">
          Weather does not reduce roofing demand. It reduces executable
          capacity. Lost capacity pushes milestone billing, which moves
          recognized revenue between weeks. Frost is treated as a hard stop.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "warning";
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          accent === "warning"
            ? "text-[var(--risk-at-risk)]"
            : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}
