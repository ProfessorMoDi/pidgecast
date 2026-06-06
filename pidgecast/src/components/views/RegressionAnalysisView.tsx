import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { WeatherRegressionLab } from "@/components/views/WeatherRegressionLab";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { opcoToCompany } from "@/lib/weather-regression/engine";
import {
  BRUTE_FORCE_SUMMARY,
  CORRELATION_BY_LAG,
  CORRELATION_BY_LAG_META,
  DRIVER_EFFECTS,
  REGRESSION_META,
  REGRESSION_MODEL,
  RULE_PLAYBOOK,
  RULE_PLAYBOOK_META,
  type EffectDirection,
} from "@/lib/regression-findings";
import { cn, formatEurCompact } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CloudRain,
  Crosshair,
  Database,
  Minus,
  Sigma,
  TrendingUp,
} from "lucide-react";
import type { DashboardViewModel } from "@/components/views/view-model";

const DIRECTION_META: Record<
  EffectDirection,
  { className: string; icon: typeof ArrowUpRight; label: string }
> = {
  positive: { className: "text-[var(--risk-healthy)]", icon: ArrowUpRight, label: "Positive" },
  negative: { className: "text-[var(--risk-at-risk)]", icon: ArrowDownRight, label: "Negative" },
  none: { className: "text-muted-foreground", icon: Minus, label: "No signal" },
};

function periodLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function RegressionAnalysisView({
  model,
  onContinue,
}: {
  model: DashboardViewModel;
  onContinue?: () => void;
}) {
  const effect = REGRESSION_MODEL.workableDayEffect;
  const defaultCompany = opcoToCompany(model.opco.id);

  return (
    <div className="space-y-5">
      {/* Provenance / dataset header */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <Database className="size-5" />
          </span>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Real weather → revenue backtest</span>
              <ProvenanceBadge provenance="measured" />
            </div>
            <p className="text-xs text-muted-foreground text-pretty">
              {periodLabel(REGRESSION_META.periodStart)} –{" "}
              {periodLabel(REGRESSION_META.periodEnd)} ·{" "}
              {REGRESSION_META.nTransactions.toLocaleString("en-GB")} transactions ·{" "}
              {formatEurCompact(REGRESSION_META.totalRevenueEur)} analysed ·{" "}
              {REGRESSION_META.weatherSource}
            </p>
          </div>
        </div>
      </div>

      <InsightPanel title="Model read" tone="neutral">
        Each additional workable day per week is associated with{" "}
        <span className="font-semibold">+{effect.pointPct.toFixed(0)}% revenue</span>{" "}
        (range {effect.lowPct.toFixed(1)}–{effect.highPct.toFixed(1)}%, p≈
        {effect.pValue.toFixed(2)}) — the one robust positive driver. Frost and cold
        are the strongest negatives. Of{" "}
        <span className="font-semibold">
          {BRUTE_FORCE_SUMMARY.totalCombinations.toLocaleString("en-GB")}
        </span>{" "}
        brute-force weather rules tested,{" "}
        <span className="font-semibold">{BRUTE_FORCE_SUMMARY.survivedFdr}</span> survive
        multiple-comparison correction: large raw gaps are mostly seasonal, not weather
        causation.
      </InsightPanel>

      {/* HERO: interactive real-data analysis */}
      <SectionCard
        title="Interactive weather → revenue analysis"
        description="Adjust the company, resolution, weather thresholds, seasonality and lag — every control recomputes the Spearman correlation, significance and revenue impact live, directly from the historical daily ledger + weather data."
        icon={<Crosshair className="size-4 text-muted-foreground" />}
        action={<ProvenanceBadge provenance="measured" />}
      >
        <WeatherRegressionLab defaultCompany={defaultCompany} />
      </SectionCard>

      {/* Measured backtest summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Workable-day effect"
          value={`+${effect.pointPct.toFixed(0)}%`}
          accent="positive"
          icon={<TrendingUp className="size-4" />}
          sublabel={`Range ${effect.lowPct.toFixed(1)}–${effect.highPct.toFixed(1)}% · p≈${effect.pValue.toFixed(2)}`}
          hint={effect.note}
          footer={<ProvenanceBadge provenance={effect.provenance} />}
        />
        <MetricCard
          label="Model fit (R²)"
          value={REGRESSION_MODEL.r2?.toFixed(2) ?? "—"}
          icon={<Sigma className="size-4" />}
          sublabel="Ummels single-company FE-OLS"
          hint={REGRESSION_MODEL.r2Note}
          footer={<ProvenanceBadge provenance={REGRESSION_MODEL.r2Provenance} />}
        />
        <MetricCard
          label="Sample size"
          value={`${REGRESSION_META.weeksAnalyzed}`}
          icon={<Activity className="size-4" />}
          sublabel="Weeks analysed (pooled n=335)"
          hint="Weekly observations in the merged ledger + weather panel. The pooled 2-company FE-OLS uses 335 company-weeks."
          footer={<ProvenanceBadge provenance="measured" />}
        />
        <MetricCard
          label="Rules surviving FDR"
          value={`${BRUTE_FORCE_SUMMARY.survivedFdr} / ${BRUTE_FORCE_SUMMARY.totalCombinations.toLocaleString("en-GB")}`}
          accent="warning"
          icon={<CloudRain className="size-4" />}
          sublabel={BRUTE_FORCE_SUMMARY.fdrMethod}
          hint={BRUTE_FORCE_SUMMARY.interpretation}
          footer={<ProvenanceBadge provenance={BRUTE_FORCE_SUMMARY.provenance} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Measured FE-OLS fits"
          description="log(revenue) on workable days, by subject."
          action={<ProvenanceBadge provenance="measured" />}
        >
          <ul className="space-y-2">
            {REGRESSION_MODEL.fits.map((f) => {
              const sig = f.pValue < 0.05;
              return (
                <li key={f.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        f.pctPerUnit >= 0
                          ? "text-[var(--risk-healthy)]"
                          : "text-[var(--risk-at-risk)]"
                      )}
                    >
                      {f.pctPerUnit >= 0 ? "+" : ""}
                      {f.pctPerUnit.toFixed(1)}%/day
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    <span className={cn(sig && "text-foreground")}>
                      p={f.pValue.toFixed(3)}
                      {sig ? " ✓" : ""}
                    </span>
                    {f.r2 !== null && <span>R²={f.r2.toFixed(2)}</span>}
                    {f.n !== null && <span>n={f.n}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground text-pretty">
            {REGRESSION_MODEL.seMethod}.
          </p>
        </SectionCard>

        <SectionCard
          title="Weekly correlation by lag"
          description={`Contemporaneous and lagged correlation for ${CORRELATION_BY_LAG_META.subject}.`}
          action={<ProvenanceBadge provenance={CORRELATION_BY_LAG_META.provenance} />}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Lag (wk)</TableHead>
                  <TableHead className="text-right">Spearman r</TableHead>
                  <TableHead className="text-right">p</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CORRELATION_BY_LAG.map((c) => {
                  const sig = c.spearmanP < 0.05;
                  return (
                    <TableRow key={`${c.feature}-${c.lagWeeks}`}>
                      <TableCell className="font-mono text-xs">{c.feature}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {c.lagWeeks}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums",
                          c.spearmanR < 0
                            ? "text-[var(--risk-at-risk)]"
                            : "text-[var(--risk-healthy)]"
                        )}
                      >
                        {c.spearmanR >= 0 ? "+" : ""}
                        {c.spearmanR.toFixed(3)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums",
                          sig ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {c.spearmanP.toFixed(3)}
                        {sig ? " ✓" : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Weather driver effects"
        description="Per-regressor estimates after seasonality adjustment. Workable days is the only robust positive driver; frost/cold the clearest negatives."
        action={<ProvenanceBadge provenance="measured" />}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Headline estimate</TableHead>
                <TableHead className="text-right">Survives season-adj.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DRIVER_EFFECTS.map((d) => {
                const dm = DIRECTION_META[d.direction];
                const Icon = dm.icon;
                return (
                  <TableRow key={d.driver}>
                    <TableCell className="font-medium">{d.driver}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          dm.className
                        )}
                      >
                        <Icon className="size-3.5" />
                        {dm.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-pretty">
                      {d.headlineStat}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.significantAfterSeasonAdjust ? (
                        <span className="rounded-md border border-[var(--risk-healthy)]/30 bg-[var(--risk-healthy)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--risk-healthy)]">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          No
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard
        title="Weather rule playbook (backtested)"
        description={RULE_PLAYBOOK_META.note}
        action={<ProvenanceBadge provenance={RULE_PLAYBOOK_META.provenance} />}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead className="text-right">Weeks</TableHead>
                <TableHead className="text-right">Raw gap</TableHead>
                <TableHead className="text-right">Season-adj.</TableHead>
                <TableHead className="text-right">Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RULE_PLAYBOOK.map((r, i) => {
                const watch = r.verdict.toUpperCase() === "WATCH";
                return (
                  <TableRow key={`${r.company}-${r.rule}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.company}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.rule}
                      <span className="ml-1 hidden text-xs font-normal text-muted-foreground sm:inline">
                        · {r.condition}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.nWeeks}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        r.rawGapPct < 0
                          ? "text-[var(--risk-at-risk)]"
                          : "text-[var(--risk-healthy)]"
                      )}
                    >
                      {r.rawGapPct >= 0 ? "+" : ""}
                      {r.rawGapPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {r.seasonAdjGapPct >= 0 ? "+" : ""}
                      {r.seasonAdjGapPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                          watch
                            ? "border-[var(--risk-watch)]/40 bg-[var(--risk-watch)]/12 text-[var(--risk-watch)]"
                            : "border-border bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {r.verdict}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground text-pretty">
        <span className="font-medium text-foreground">Methodology.</span>{" "}
        {REGRESSION_MODEL.specification}. {REGRESSION_MODEL.seMethod}.{" "}
        <span className="font-medium text-foreground">Key limitation:</span>{" "}
        {REGRESSION_META.keyLimitation}
      </div>

      {onContinue && (
        <div className="flex justify-center border-t pt-6">
          <Button size="lg" onClick={onContinue}>
            Continue to forecast →
          </Button>
        </div>
      )}
    </div>
  );
}
