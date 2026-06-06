import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { ProjectMilestoneList } from "@/components/finance/ProjectMilestoneList";
import { WeatherImpactPanel } from "@/components/weather/WeatherImpactPanel";
import { WeatherTrendChart } from "@/components/charts/WeatherTrendChart";
import { formatEur, formatPct } from "@/lib/utils";
import { CONDITION_LABEL } from "@/lib/weather";
import {
  Banknote,
  TriangleAlert,
  HardHat,
  ClipboardCheck,
  CircleDot,
  CloudSun,
} from "lucide-react";
import type { DashboardViewModel } from "@/components/views/view-model";

export function OpcoMDView({ model }: { model: DashboardViewModel }) {
  const { summary, opco, projects, weatherDays, weatherHours, weeks } = model;

  const sortedByAmount = [...projects].sort(
    (a, b) => b.billingAmount - a.billingAmount
  );
  const largest = sortedByAmount[0];
  const weatherExposure = projects
    .filter((p) => p.weatherSensitivity !== "low")
    .reduce((sum, p) => sum + p.billingAmount, 0);

  const frostDays = weatherDays.filter(
    (d) => d.isWorkday && d.condition === "frost"
  );
  const rainDays = weatherDays.filter(
    (d) => d.isWorkday && d.condition === "rain"
  );

  const currentWeek = weeks[0] ?? null;

  const recommendations: { icon: typeof HardHat; text: string }[] = [];
  if (frostDays.length > 0) {
    recommendations.push({
      icon: HardHat,
      text: `Move exterior membrane and adhesive work away from ${frostDays.length} frost-affected day(s). Frost is a hard capacity stop.`,
    });
  }
  if (rainDays.length > 0) {
    recommendations.push({
      icon: HardHat,
      text: `Re-sequence ${rainDays.length} wet day(s) toward covered prep, detailing and material staging.`,
    });
  }
  if (largest) {
    recommendations.push({
      icon: ClipboardCheck,
      text: `Review timing for the largest milestone billing — ${largest.projectName} (${formatEur(
        largest.billingAmount
      )}). It is ${largest.weatherSensitivity} weather-sensitivity.`,
    });
  }
  recommendations.push({
    icon: CircleDot,
    text: "Recurring maintenance revenue remains stable; project billing is the main variance driver this period.",
  });

  return (
    <div className="space-y-5">
      <InsightPanel
        title={`${opco.name} · ${opco.location}`}
        tone={summary.worstRisk === "healthy" ? "neutral" : "warning"}
      >
        Project billing exposure of{" "}
        <span className="font-semibold">{formatEur(weatherExposure)}</span> is
        weather-sensitive this horizon.{" "}
        {largest
          ? `${largest.projectName} is the milestone to manage, with ${formatEur(
              largest.billingAmount
            )} billing on ${largest.weatherSensitivity} weather sensitivity.`
          : ""}
      </InsightPanel>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Opco 14-week forecast"
          value={formatEur(summary.totalForecastRevenue)}
          icon={<Banknote className="size-4" />}
          sublabel={`${formatPct(
            summary.totalForecastRevenue / summary.totalBaselineRevenue - 1
          )} vs baseline`}
          hint="Weather-adjusted recognized revenue for this operating company (accrual basis)."
        />
        <MetricCard
          label="Revenue at risk"
          value={formatEur(summary.totalRevenueAtRisk)}
          accent={summary.totalRevenueAtRisk > 0 ? "warning" : "positive"}
          icon={<TriangleAlert className="size-4" />}
          sublabel="May move out of the horizon"
          hint="Baseline revenue that may shift to later weeks due to weather-driven milestone delays."
        />
        <MetricCard
          label="Weather-sensitive WIP"
          value={formatEur(weatherExposure)}
          icon={<HardHat className="size-4" />}
          sublabel={`${projects.filter((p) => p.weatherSensitivity !== "low").length} of ${projects.length} milestones`}
          hint="Project billing tied to milestones with medium or high weather sensitivity."
        />
      </div>

      <SectionCard
        title="Live weather trend"
        description="Hourly temperature and precipitation over the forecast window, with the frost hard-stop line and daily crew capacity."
        icon={<CloudSun className="size-4 text-muted-foreground" />}
      >
        <WeatherTrendChart hours={weatherHours} days={weatherDays} />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Active milestones"
          description="Sorted by billing value. Weather-sensitive milestones carry the timing risk."
        >
          <ProjectMilestoneList milestones={sortedByAmount} />
        </SectionCard>

        <div className="space-y-5">
          <WeatherImpactPanel
            weatherDays={weatherDays}
            currentWeek={currentWeek}
          />
          <SectionCard
            title="Weather delay signals"
            description="Capacity-limiting days detected in the live forecast window."
            icon={<TriangleAlert className="size-4 text-muted-foreground" />}
          >
            {frostDays.length === 0 && rainDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No frost or heavy-rain delay signals in the current forecast
                window.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...frostDays, ...rainDays].map((d) => (
                  <li
                    key={d.date}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <span className="font-medium">
                      {CONDITION_LABEL[d.condition]}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {d.date} · {Math.round(d.capacity * 100)}% capacity
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Practical recommendations"
        description="Actions to protect milestone billing and recognized revenue timing."
        icon={<ClipboardCheck className="size-4 text-muted-foreground" />}
      >
        <ul className="space-y-3">
          {recommendations.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-sm leading-relaxed text-pretty">
                  {r.text}
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}
