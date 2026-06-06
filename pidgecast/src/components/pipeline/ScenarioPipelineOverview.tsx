"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  Scale,
} from "lucide-react";

import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cn,
  formatEur,
  formatEurCompact,
  formatPct,
} from "@/lib/utils";
import type { ForecastWeek, RiskLevel, Scenario } from "@/lib/types";

/** How a scenario bends the pipeline. */
export interface ScenarioLever {
  /** Multiplier applied to the weather capacity loss (>1 amplifies, <1 dampens). */
  capacityLossMultiplier: number;
  /** Fractional adjustment to project billing (e.g. -0.08 = −8%). */
  projectBillingAdjustment: number;
  /** Maximum positive weather impact allowed; upside above this is clipped. */
  upsideCap: number;
}

/** Pre-computed roll-up for a scenario across its forecast weeks. */
export interface ScenarioSummary {
  totalForecastRevenue: number;
  totalWeatherImpact: number;
  minCovenantHeadroom: number;
  worstRisk: RiskLevel;
}

/** Everything needed to render one scenario's overview + drill-down. */
export interface ScenarioPipelineData {
  id: Scenario;
  label: string;
  description: string;
  lever: ScenarioLever;
  weeks: ForecastWeek[];
  summary: ScenarioSummary;
}

export interface ScenarioPipelineOverviewProps {
  scenarios: ScenarioPipelineData[];
  defaultScenario?: Scenario;
  className?: string;
}

function leverRows(lever: ScenarioLever): { label: string; value: string }[] {
  return [
    {
      label: "Capacity-loss multiplier",
      value: `×${lever.capacityLossMultiplier.toFixed(2)}`,
    },
    {
      label: "Project-billing adjustment",
      value: formatPct(lever.projectBillingAdjustment),
    },
    {
      label: "Upside cap",
      value:
        lever.upsideCap > 0 ? `+${(lever.upsideCap * 100).toFixed(1)}%` : "none",
    },
  ];
}

function ScenarioOverviewCard({
  scenario,
  isWorst,
}: {
  scenario: ScenarioPipelineData;
  isWorst: boolean;
}) {
  const { summary } = scenario;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-muted/40 p-4",
        isWorst && "border-[var(--risk-critical)]/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold leading-tight">
            {scenario.label}
          </h4>
          <p className="text-xs leading-snug text-muted-foreground text-pretty">
            {scenario.description}
          </p>
        </div>
        <RiskBadge level={summary.worstRisk} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3">
        <div className="space-y-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            4-week revenue
          </dt>
          <dd className="font-mono text-sm font-semibold tabular-nums">
            {formatEur(summary.totalForecastRevenue)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Weather impact
          </dt>
          <dd
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              summary.totalWeatherImpact < 0
                ? "text-[var(--risk-critical)]"
                : summary.totalWeatherImpact > 0
                  ? "text-[var(--risk-healthy)]"
                  : "text-foreground"
            )}
          >
            {formatPct(summary.totalWeatherImpact)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Min headroom
          </dt>
          <dd
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              summary.minCovenantHeadroom < 0 && "text-[var(--risk-critical)]"
            )}
          >
            {formatEur(summary.minCovenantHeadroom)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Lever
          </dt>
          <dd className="font-mono text-sm font-semibold tabular-nums">
            ×{scenario.lever.capacityLossMultiplier.toFixed(2)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ScenarioWeekTable({ weeks }: { weeks: ForecastWeek[] }) {
  return (
    <Table className="font-mono tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className="font-sans">Week</TableHead>
          <TableHead className="text-right font-sans">Baseline</TableHead>
          <TableHead className="text-right font-sans">Forecast</TableHead>
          <TableHead className="text-right font-sans">Impact</TableHead>
          <TableHead className="text-right font-sans">Headroom</TableHead>
          <TableHead className="text-right font-sans">Risk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {weeks.map((week) => (
          <TableRow key={week.weekIndex}>
            <TableCell className="font-sans font-medium">
              {week.weekLabel}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatEurCompact(week.baselineRevenue)}
            </TableCell>
            <TableCell className="text-right font-semibold">
              {formatEurCompact(week.forecastRevenue)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right",
                week.weatherImpactPct < 0
                  ? "text-[var(--risk-critical)]"
                  : week.weatherImpactPct > 0
                    ? "text-[var(--risk-healthy)]"
                    : "text-muted-foreground"
              )}
            >
              {formatPct(week.weatherImpactPct)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right",
                week.covenantHeadroom < 0 && "text-[var(--risk-critical)]"
              )}
            >
              {formatEurCompact(week.covenantHeadroom)}
            </TableCell>
            <TableCell className="text-right">
              <span className="inline-flex justify-end">
                <RiskBadge level={week.riskLevel} showDot={false} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ScenarioPipelineOverview({
  scenarios,
  defaultScenario,
  className,
}: ScenarioPipelineOverviewProps) {
  const initial =
    defaultScenario && scenarios.some((s) => s.id === defaultScenario)
      ? defaultScenario
      : scenarios[0]?.id;
  const [active, setActive] = useState<Scenario | undefined>(initial);

  if (scenarios.length === 0) return null;

  const base = scenarios.find((s) => s.id === "base");
  const wet = scenarios.find((s) => s.id === "wet-quarter");
  const dry = scenarios.find((s) => s.id === "dry-quarter");

  const worstId = scenarios.reduce((worst, s) =>
    s.summary.totalForecastRevenue < worst.summary.totalForecastRevenue
      ? s
      : worst
  ).id;

  const wetDownside =
    base && wet
      ? base.summary.totalForecastRevenue - wet.summary.totalForecastRevenue
      : null;
  const dryUpside =
    base && dry
      ? dry.summary.totalForecastRevenue - base.summary.totalForecastRevenue
      : null;
  const asymmetry =
    wetDownside !== null && dryUpside !== null && dryUpside > 0
      ? wetDownside / dryUpside
      : null;

  return (
    <SectionCard
      title="Scenario pipeline"
      description="One overview of how each scenario bends the pipeline, then drill into any scenario's weekly detail."
      icon={<Layers className="size-4 text-muted-foreground" />}
      className={className}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioOverviewCard
              key={scenario.id}
              scenario={scenario}
              isWorst={scenario.id === worstId}
            />
          ))}
        </div>

        {wetDownside !== null && dryUpside !== null && (
          <InsightPanel title="Asymmetric exposure" tone="warning">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <ArrowDownRight className="size-4 text-[var(--risk-critical)]" />
                Wet quarter removes{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--risk-critical)]">
                  {formatEur(Math.max(wetDownside, 0))}
                </span>{" "}
                vs base.
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpRight className="size-4 text-[var(--risk-healthy)]" />
                Dry quarter adds only{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--risk-healthy)]">
                  {formatEur(Math.max(dryUpside, 0))}
                </span>
                .
              </span>
              {asymmetry !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Scale className="size-4 text-muted-foreground" />
                  Downside is{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {asymmetry.toFixed(1)}×
                  </span>{" "}
                  the upside — the dry cap is deliberate.
                </span>
              )}
            </div>
          </InsightPanel>
        )}

        <div className="space-y-3 border-t pt-4">
          <Tabs
            value={active}
            onValueChange={(v) => setActive(v as Scenario)}
          >
            <TabsList className="w-full sm:w-fit">
              {scenarios.map((scenario) => (
                <TabsTrigger key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {scenarios.map((scenario) => (
              <TabsContent
                key={scenario.id}
                value={scenario.id}
                className="space-y-4 pt-2"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {leverRows(scenario.lever).map((row) => (
                    <div
                      key={row.label}
                      className="rounded-md border bg-muted/40 px-3 py-2"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  {scenario.description} Recurring revenue stays stable across
                  scenarios; the lever bends only weather-sensitive project
                  billing.
                </p>
                <ScenarioWeekTable weeks={scenario.weeks} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </SectionCard>
  );
}
