import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { WeatherDayCard } from "@/components/weather/WeatherDayCard";
import { WeatherTrendChart } from "@/components/charts/WeatherTrendChart";
import { ProjectMilestoneList } from "@/components/finance/ProjectMilestoneList";
import { formatDays, formatDateShort } from "@/lib/utils";
import { CalendarClock, CloudSun, Workflow } from "lucide-react";
import type { DashboardViewModel } from "@/components/views/view-model";

export function ProjectLeadView({ model }: { model: DashboardViewModel }) {
  const { weatherDays, weatherHours, projects, weeks } = model;

  const workdays = weatherDays.filter((d) => d.isWorkday);
  const effectiveThisWeek = weeks[0]?.effectiveWorkableDays ?? 0;
  const baselineThisWeek = weeks[0]?.baselineWorkableDays ?? 5;

  const fullDays = workdays.filter((d) => d.capacity >= 1).length;
  const stopDays = workdays.filter((d) => d.capacity === 0).length;

  // Next milestone by date.
  const nextMilestone = [...projects].sort(
    (a, b) =>
      new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime()
  )[0];

  return (
    <div className="space-y-5">
      <InsightPanel title="Crew read" tone={stopDays > 0 ? "warning" : "neutral"}>
        This week has{" "}
        <span className="font-semibold">{formatDays(effectiveThisWeek)}</span> of
        effective workable capacity against a {formatDays(baselineThisWeek)}{" "}
        baseline. {fullDays} full day(s), {stopDays} hard-stop day(s). Plan
        weather-sensitive work into the full-capacity days.
      </InsightPanel>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Effective workable days"
          value={formatDays(effectiveThisWeek)}
          accent={effectiveThisWeek < baselineThisWeek ? "warning" : "positive"}
          icon={<CloudSun className="size-4" />}
          sublabel={`Baseline ${formatDays(baselineThisWeek)}`}
          hint="Sum of daily executable capacity across this week's workdays."
        />
        <MetricCard
          label="Full-capacity days"
          value={`${fullDays}`}
          icon={<CalendarClock className="size-4" />}
          sublabel={`${stopDays} hard-stop day(s)`}
          hint="Days at 100% capacity. Frost days are hard stops at 0%."
        />
        <MetricCard
          label="Next milestone"
          value={nextMilestone ? formatDateShort(nextMilestone.expectedDate) : "—"}
          icon={<Workflow className="size-4" />}
          sublabel={nextMilestone?.milestone ?? "No upcoming milestone"}
          hint="The nearest billing milestone for this operating company."
        />
      </div>

      <SectionCard
        title="Live weather trend"
        description="Hourly temperature and precipitation over the forecast window, with the frost hard-stop line and daily crew capacity. Renders on live or fallback weather."
        icon={<CloudSun className="size-4 text-muted-foreground" />}
      >
        <WeatherTrendChart hours={weatherHours} days={weatherDays} />
      </SectionCard>

      <SectionCard
        title="Daily crew capacity"
        description="Live daily weather translated into executable capacity. Frost is a hard stop; rain, wind, heat and cold reduce capacity."
        icon={<CloudSun className="size-4 text-muted-foreground" />}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {weatherDays.map((d) => (
            <WeatherDayCard key={d.date} day={d} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Project progress"
        description="Active projects for this operating company and how far each has progressed."
      >
        <ProjectMilestoneList milestones={projects} />
      </SectionCard>
    </div>
  );
}
