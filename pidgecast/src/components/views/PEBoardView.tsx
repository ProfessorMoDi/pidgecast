import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { CovenantHeadroomCard } from "@/components/finance/CovenantHeadroomCard";
import { ForecastChart } from "@/components/charts/ForecastChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OPCOS } from "@/lib/mock-data";
import { COVENANT_REVENUE_FLOOR_EUR } from "@/lib/config";
import { formatEur, formatEurDelta, formatPct } from "@/lib/utils";
import { ShieldAlert, TrendingDown, Layers, CloudRain } from "lucide-react";
import type { DashboardViewModel } from "@/components/views/view-model";

export function PEBoardView({ model }: { model: DashboardViewModel }) {
  const { summary, weeks, scenarioSummaries } = model;
  const base = scenarioSummaries["base"];
  const wet = scenarioSummaries["wet-quarter"];

  // Weather impact on revenue (budget − weather-adjusted). The hero reads the
  // BASE case explicitly so it stays meaningful regardless of the selected
  // scenario; the downside card reads the wet-quarter case.
  const baseImpact = base.totalRevenueAtRisk;
  const baseImpactPct =
    base.totalBaselineRevenue > 0
      ? base.totalForecastRevenue / base.totalBaselineRevenue - 1
      : 0;
  const wetImpact = wet.totalRevenueAtRisk;

  const worstWeek = wet.worstWeek;

  return (
    <div className="space-y-5">
      <InsightPanel
        title="Board read"
        tone={wet.minCovenantHeadroom < 0 ? "critical" : "warning"}
      >
        Weather is moving{" "}
        <span className="font-semibold">{formatEur(baseImpact)}</span>{" "}
        ({formatPct(baseImpactPct)}) of budgeted revenue out of the horizon
        today, rising to{" "}
        <span className="font-semibold">{formatEur(wetImpact)}</span> under the
        wet-quarter downside
        {worstWeek ? ` (worst in ${worstWeek.weekLabel})` : ""}. Recurring
        revenue is protected; project billing carries the swing. Covenant
        headroom remains a supporting check at {formatEur(wet.minCovenantHeadroom)}.
      </InsightPanel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Weather impact on revenue"
          value={formatEurDelta(-baseImpact)}
          accent={baseImpact > 0 ? "warning" : "positive"}
          icon={<CloudRain className="size-4" />}
          sublabel={`${formatPct(baseImpactPct)} vs budget · base case`}
          hint="Budgeted (plan) revenue minus the weather-adjusted forecast. The primary read: how much recognized revenue weather is shifting out of the horizon."
        />
        <MetricCard
          label="Wet-quarter downside"
          value={formatEurDelta(-wetImpact)}
          accent="warning"
          icon={<TrendingDown className="size-4" />}
          sublabel={`Revenue moved · ${formatPct(wet.avgWeatherImpact)} avg capacity`}
          hint="Weather impact on revenue under sustained wet conditions. Wet downside is intentionally larger than dry upside."
        />
        <MetricCard
          label="Portfolio forecast"
          value={formatEur(summary.totalForecastRevenue)}
          icon={<Layers className="size-4" />}
          sublabel={`vs budget ${formatEur(summary.totalBaselineRevenue)}`}
          hint="Total weather-adjusted recognized revenue across the 14-week horizon (accrual basis)."
        />
        <CovenantHeadroomCard summary={summary} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Budget vs weather-adjusted revenue"
          description="Shaded band is the weather impact on revenue. Covenant floor shown only as a faint reference line."
          className="lg:col-span-2"
        >
          <ForecastChart weeks={weeks} />
        </SectionCard>

        {wet.minCovenantHeadroom < 0 ? (
          <Alert variant="destructive" className="self-start">
            <ShieldAlert className="size-4" />
            <AlertTitle>Covenant breach under wet downside</AlertTitle>
            <AlertDescription>
              Under the wet-quarter scenario, forecast revenue falls below the{" "}
              {formatEur(COVENANT_REVENUE_FLOOR_EUR)} floor in{" "}
              {worstWeek?.weekLabel}. Recommend an early conversation with the
              lender and a milestone re-sequencing review.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="self-start border-[var(--risk-watch)]/40">
            <ShieldAlert className="size-4" />
            <AlertTitle>Headroom maintained, monitor weather</AlertTitle>
            <AlertDescription>
              The downside case stays above the covenant floor, but headroom
              narrows to {formatEur(wet.minCovenantHeadroom)}. Project billing
              timing is the variable to watch.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <SectionCard
        title="Operating company risk"
        description="Selected company shown in detail. Switch companies in the control bar to compare."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operating company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">14-week forecast</TableHead>
              <TableHead className="text-right">Wet downside headroom</TableHead>
              <TableHead className="text-right">Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {OPCOS.map((o) => {
              const isCurrent = o.id === model.opco.id;
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.name}
                    {isCurrent && (
                      <span className="ml-2 rounded border px-1.5 py-px text-[10px] uppercase text-muted-foreground">
                        Selected
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.location}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {isCurrent
                      ? formatEur(summary.totalForecastRevenue)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {isCurrent ? formatEur(wet.minCovenantHeadroom) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCurrent ? (
                      <RiskBadge level={wet.worstRisk} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Select to view
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
