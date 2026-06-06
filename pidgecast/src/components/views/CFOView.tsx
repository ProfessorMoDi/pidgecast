import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { RevenueStreamChart } from "@/components/charts/RevenueStreamChart";
import { WorkableDaysChart } from "@/components/charts/WorkableDaysChart";
import { ForecastTable } from "@/components/finance/ForecastTable";
import { BillingAnomalyTable } from "@/components/finance/BillingAnomalyTable";
import { cn, formatEur, formatEurDelta, formatPct } from "@/lib/utils";
import { SCENARIO_CONFIG, SCENARIOS } from "@/lib/config";
import { Layers, ShieldCheck, TrendingDown, Wallet } from "lucide-react";
import type { DashboardViewModel } from "@/components/views/view-model";

export function CFOView({ model }: { model: DashboardViewModel }) {
  const { summary, weeks, scenarioSummaries, scenario } = model;

  // Weather impact on revenue = budget (baseline) − weather-adjusted forecast.
  const weatherImpactEur = summary.totalRevenueAtRisk;
  const impactPct =
    summary.totalBaselineRevenue > 0
      ? summary.totalForecastRevenue / summary.totalBaselineRevenue - 1
      : 0;

  return (
    <div className="space-y-5">
      <InsightPanel
        tone={weatherImpactEur > 0 ? "warning" : "neutral"}
      >
        Weather is moving{" "}
        <span className="font-semibold">{formatEur(weatherImpactEur)}</span>{" "}
        ({formatPct(impactPct)}) of budgeted revenue out of the 14-week horizon
        as project billing slips with crew capacity.{" "}
        {summary.worstWeek?.weekLabel} carries the largest gap. Recurring revenue
        of {formatEur(summary.totalRecurring)} stays protected; covenant headroom
        holds at {formatEur(summary.minCovenantHeadroom)}.
      </InsightPanel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Weather impact on revenue"
          value={formatEurDelta(-weatherImpactEur)}
          accent={weatherImpactEur > 0 ? "warning" : "positive"}
          icon={<TrendingDown className="size-4" />}
          sublabel={`${formatPct(impactPct)} vs budget`}
          hint="Budgeted (plan) revenue minus the weather-adjusted forecast across the horizon. This is the headline effect of weather on recognized revenue."
        />
        <MetricCard
          label="Budgeted revenue"
          value={formatEur(summary.totalBaselineRevenue)}
          icon={<Wallet className="size-4" />}
          sublabel="Pre-weather plan, 14-week horizon"
          hint="The budget / plan: recurring plus project billing before any weather or scenario adjustment (accrual basis)."
        />
        <MetricCard
          label="Weather-adjusted forecast"
          value={formatEur(summary.totalForecastRevenue)}
          icon={<Layers className="size-4" />}
          sublabel={`Avg capacity ${formatPct(summary.avgWeatherImpact)}`}
          hint="Recognized revenue after weather capacity and the selected scenario are applied to the budget."
        />
        <MetricCard
          label="Covenant headroom"
          value={formatEur(summary.minCovenantHeadroom)}
          accent={summary.minCovenantHeadroom < 0 ? "negative" : "default"}
          icon={<ShieldCheck className="size-4" />}
          sublabel="Lowest week vs revenue floor"
          hint="Secondary reference: weather-adjusted revenue against the configurable demo covenant floor. Not the primary story."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Budget vs weather-adjusted revenue"
          description={`Shaded band is the weather impact — ${formatEur(
            weatherImpactEur
          )} (${formatPct(impactPct)}) moved out of the horizon. Covenant floor shown only as a faint reference.`}
        >
          <ForecastChart weeks={weeks} />
        </SectionCard>
        <SectionCard
          title="Revenue stream split"
          description="Recurring revenue is stable; project billing carries the weather sensitivity."
        >
          <RevenueStreamChart weeks={weeks} />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Weather-adjusted workable days"
          description="Baseline Mon-Fri capacity vs effective capacity after weather."
          className="lg:col-span-2"
        >
          <WorkableDaysChart weeks={weeks} />
        </SectionCard>

        <SectionCard
          title="Scenario comparison"
          description="Total 14-week forecast by scenario."
        >
          <ul className="space-y-2">
            {SCENARIOS.map((s) => {
              const sum = scenarioSummaries[s];
              const active = s === scenario;
              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2",
                    active ? "bg-accent/60 ring-1 ring-border" : "bg-card"
                  )}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {SCENARIO_CONFIG[s].label}
                      {active && (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Headroom {formatEur(sum.minCovenantHeadroom)}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums">
                    {formatEur(sum.totalForecastRevenue)}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground text-pretty">
            Wet downside exceeds dry upside: crews, schedules and pipeline cap
            how much extra revenue dry weather can pull forward.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Weekly forecast"
        description="Each row is traceable. Click to open the audit trail."
      >
        <ForecastTable weeks={weeks} enableAudit />
      </SectionCard>

      <SectionCard
        title="Billing anomaly detector"
        description="Expected recurring and milestone billings that may be late or missing."
      >
        <BillingAnomalyTable anomalies={model.anomalies} />
      </SectionCard>
    </div>
  );
}
