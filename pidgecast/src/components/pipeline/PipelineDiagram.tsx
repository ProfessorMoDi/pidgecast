import {
  ArrowDown,
  ArrowRight,
  Banknote,
  CalendarDays,
  CloudRain,
  ListFilter,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { SectionCard } from "@/components/dashboard/SectionCard";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import {
  cn,
  formatDays,
  formatEur,
  formatPct,
} from "@/lib/utils";
import type { ForecastWeek, WeatherDay } from "@/lib/types";

export interface PipelineDiagramProps {
  /** The currently selected forecast week, used to surface live stage values. */
  currentWeek?: ForecastWeek;
  /** Daily weather rows backing the current window, used for stages 1–2. */
  weatherDays?: WeatherDay[];
  /** The demo covenant revenue floor, used to explain stage 7. */
  covenantFloor?: number;
  className?: string;
}

interface StageDef {
  id: string;
  step: number;
  icon: LucideIcon;
  title: string;
  what: string;
  why: string;
}

const STAGES: StageDef[] = [
  {
    id: "weather",
    step: 1,
    icon: CloudRain,
    title: "Live weather",
    what: "Pull daily temp, precipitation and wind from Open-Meteo.",
    why: "Grounds the forecast in real conditions, not assumptions.",
  },
  {
    id: "classify",
    step: 2,
    icon: ListFilter,
    title: "Classify days",
    what: "Tag each day vs thresholds; map to executable capacity.",
    why: "Frost stops work entirely; wind and rain cut it sharply.",
  },
  {
    id: "capacity",
    step: 3,
    icon: CalendarDays,
    title: "Effective workable days",
    what: "Sum daily capacity across Mon–Fri into weekly days.",
    why: "Demand is unchanged — only executable capacity moves.",
  },
  {
    id: "impact",
    step: 4,
    icon: TrendingDown,
    title: "Weather impact",
    what: "Effective ÷ baseline − 1 gives the capacity delta.",
    why: "Quantifies how much output the weather displaces.",
  },
  {
    id: "scenario",
    step: 5,
    icon: SlidersHorizontal,
    title: "Scenario lever",
    what: "Apply scenario: recurring stable, project billing exposed.",
    why: "Wet amplifies loss; dry upside is intentionally capped.",
  },
  {
    id: "revenue",
    step: 6,
    icon: Banknote,
    title: "Forecast revenue",
    what: "Recurring + weather-adjusted project billing (accrual).",
    why: "Restates timing of revenue, not the size of the book.",
  },
  {
    id: "covenant",
    step: 7,
    icon: ShieldCheck,
    title: "Covenant headroom",
    what: "Forecast revenue − revenue floor, then assign risk.",
    why: "Turns weather into a board-level liquidity signal.",
  },
];

function StageLiveValue({
  stageId,
  currentWeek,
  weatherDays,
  covenantFloor,
}: {
  stageId: string;
  currentWeek?: ForecastWeek;
  weatherDays?: WeatherDay[];
  covenantFloor?: number;
}): ReactNode {
  switch (stageId) {
    case "weather": {
      if (!weatherDays || weatherDays.length === 0) return null;
      return (
        <LiveStat
          label={`${weatherDays.length} days`}
          value="Open-Meteo"
        />
      );
    }
    case "classify": {
      if (!weatherDays || weatherDays.length === 0) return null;
      const constrained = weatherDays.filter(
        (d) => d.isWorkday && d.capacity < 1
      ).length;
      return (
        <LiveStat
          label="constrained workdays"
          value={`${constrained}`}
          tone={constrained > 0 ? "negative" : "neutral"}
        />
      );
    }
    case "capacity": {
      if (!currentWeek) return null;
      return (
        <LiveStat
          label="effective vs baseline"
          value={`${formatDays(currentWeek.effectiveWorkableDays)} / ${formatDays(
            currentWeek.baselineWorkableDays
          )}`}
          tone={
            currentWeek.effectiveWorkableDays < currentWeek.baselineWorkableDays
              ? "negative"
              : "neutral"
          }
        />
      );
    }
    case "impact": {
      if (!currentWeek) return null;
      return (
        <LiveStat
          label="capacity delta"
          value={formatPct(currentWeek.weatherImpactPct)}
          tone={currentWeek.weatherImpactPct < 0 ? "negative" : "positive"}
        />
      );
    }
    case "scenario": {
      if (!currentWeek) return null;
      return (
        <LiveStat
          label="project billing"
          value={formatEur(currentWeek.projectBillingRevenue)}
        />
      );
    }
    case "revenue": {
      if (!currentWeek) return null;
      return (
        <LiveStat
          label="forecast revenue"
          value={formatEur(currentWeek.forecastRevenue)}
        />
      );
    }
    case "covenant": {
      if (!currentWeek) return null;
      return (
        <div className="flex flex-col gap-1.5">
          <LiveStat
            label={
              covenantFloor !== undefined
                ? `vs floor ${formatEur(covenantFloor)}`
                : "headroom"
            }
            value={formatEur(currentWeek.covenantHeadroom)}
            tone={currentWeek.covenantHeadroom < 0 ? "negative" : "positive"}
          />
          <RiskBadge level={currentWeek.riskLevel} />
        </div>
      );
    }
    default:
      return null;
  }
}

function LiveStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums tracking-tight",
          tone === "negative" && "text-[var(--risk-critical)]",
          tone === "positive" && "text-[var(--risk-healthy)]"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Connector() {
  return (
    <div
      className="flex shrink-0 items-center justify-center text-muted-foreground/50 lg:px-0.5"
      aria-hidden="true"
    >
      <ArrowDown className="size-4 lg:hidden" />
      <ArrowRight className="hidden size-4 lg:block" />
    </div>
  );
}

export function PipelineDiagram({
  currentWeek,
  weatherDays,
  covenantFloor,
  className,
}: PipelineDiagramProps) {
  const hasLive = Boolean(currentWeek) || Boolean(weatherDays?.length);

  return (
    <SectionCard
      title="How the forecast is produced"
      description="Weather does not reduce roofing demand. It reduces executable capacity — and capacity changes revenue timing."
      icon={<SlidersHorizontal className="size-4 text-muted-foreground" />}
      className={className}
    >
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-stretch">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className="flex items-stretch gap-2 lg:flex-1 lg:flex-col"
            >
              {index > 0 && <Connector />}
              <div className="flex flex-1 flex-col gap-2.5 rounded-lg border bg-muted/40 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground/70">
                    {String(stage.step).padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold leading-tight">
                    {stage.title}
                  </h4>
                  <p className="text-xs leading-snug text-muted-foreground text-pretty">
                    {stage.what}
                  </p>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground/80 text-pretty">
                  {stage.why}
                </p>
                {hasLive && (
                  <div className="mt-auto border-t pt-2">
                    <StageLiveValue
                      stageId={stage.id}
                      currentWeek={currentWeek}
                      weatherDays={weatherDays}
                      covenantFloor={covenantFloor}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
