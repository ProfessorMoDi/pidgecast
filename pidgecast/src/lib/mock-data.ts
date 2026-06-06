// Small, believable demo data for Pidgecast.
// Structured so a real ledger export / project system can replace it later.

import type {
  Opco,
  ForecastWeekInput,
  ProjectMilestone,
  BillingAnomaly,
} from "@/lib/types";

export const OPCOS: Opco[] = [
  {
    id: "peter-ummels",
    name: "Dakdekkersbedrijf Peter Ummels",
    location: "Brunssum",
    latitude: 50.946,
    longitude: 5.97,
    accountingSystem: "Demo ledger export",
    dataStatus: "Real transaction data available",
  },
  {
    id: "gilde",
    name: "Gilde",
    location: "Valkenswaard",
    latitude: 51.35,
    longitude: 5.459,
    accountingSystem: "Demo ledger export",
    dataStatus: "Real transaction data available",
  },
];

export function getOpco(id: string): Opco {
  return OPCOS.find((o) => o.id === id) ?? OPCOS[0];
}

/**
 * Baseline (budget/plan) revenue per week, as [recurring, projectBilling] in
 * EUR. Recurring is the stable maintenance/service base; project billing is
 * the milestone revenue the weather model moves around.
 *
 * Calibrated against the demo covenant floor (COVENANT_REVENUE_FLOOR_EUR):
 * under the BASE scenario every week sits above the floor (positive headroom),
 * while the WET-QUARTER scenario pushes the lower weeks below it. Ummels runs
 * ~€1.35–1.51M/week; Gilde is deliberately tighter at ~€1.27–1.39M/week.
 */
const WEEKLY_BASELINES: Record<string, ReadonlyArray<[number, number]>> = {
  "peter-ummels": [
    [335_000, 1_180_000],
    [330_000, 1_170_000],
    [340_000, 1_285_000],
    [336_000, 1_208_000],
    [331_000, 1_175_000],
    [341_000, 1_284_000],
    [338_000, 1_235_000],
    [332_000, 1_182_000],
    [340_000, 1_270_000],
    [335_000, 1_205_000],
    [330_000, 1_172_000],
    [342_000, 1_288_000],
    [337_000, 1_228_000],
    [333_000, 1_185_000],
  ],
  gilde: [
    [250_000, 1_232_000],
    [246_000, 1_235_000],
    [256_000, 1_322_000],
    [251_000, 1_250_000],
    [247_000, 1_233_000],
    [257_000, 1_325_000],
    [251_000, 1_275_000],
    [247_000, 1_238_000],
    [255_000, 1_315_000],
    [251_000, 1_252_000],
    [245_000, 1_235_000],
    [257_000, 1_322_000],
    [251_000, 1_272_000],
    [248_000, 1_240_000],
  ],
};

function buildForecastWeeks(
  baselines: ReadonlyArray<[number, number]>
): ForecastWeekInput[] {
  return baselines.map(([recurring, projectBilling], i) => ({
    weekIndex: i,
    weekLabel: `Week ${i + 1}`,
    startDate: weekStart(i),
    endDate: weekEnd(i),
    baselineWorkableDays: 5,
    baseline: { recurring, projectBilling },
  }));
}

const FORECAST_WEEKS: Record<string, ForecastWeekInput[]> = {
  "peter-ummels": buildForecastWeeks(WEEKLY_BASELINES["peter-ummels"]),
  gilde: buildForecastWeeks(WEEKLY_BASELINES["gilde"]),
};

export function getForecastWeeks(opcoId: string): ForecastWeekInput[] {
  return FORECAST_WEEKS[opcoId] ?? FORECAST_WEEKS["peter-ummels"];
}

const PROJECTS: Record<string, ProjectMilestone[]> = {
  "peter-ummels": [
    {
      id: "pu-proj-1",
      opcoId: "peter-ummels",
      projectName: "Logistiek centrum Sittard",
      milestone: "Membrane installation – phase 2",
      billingAmount: 320_000,
      expectedDate: weekStart(2),
      weatherSensitivity: "high",
      status: "at-risk",
      progress: 58,
      weekIndex: 2,
    },
    {
      id: "pu-proj-2",
      opcoId: "peter-ummels",
      projectName: "Woningcorporatie Heerlen",
      milestone: "Insulation + detailing",
      billingAmount: 145_000,
      expectedDate: weekStart(1),
      weatherSensitivity: "medium",
      status: "in-progress",
      progress: 72,
      weekIndex: 1,
    },
    {
      id: "pu-proj-3",
      opcoId: "peter-ummels",
      projectName: "Retail dak Geleen",
      milestone: "Tear-off & deck repair",
      billingAmount: 96_000,
      expectedDate: weekStart(0),
      weatherSensitivity: "high",
      status: "in-progress",
      progress: 40,
      weekIndex: 0,
    },
  ],
  gilde: [
    {
      id: "gd-proj-1",
      opcoId: "gilde",
      projectName: "Distributiehal Eindhoven",
      milestone: "Bitumen top layer",
      billingAmount: 260_000,
      expectedDate: weekStart(2),
      weatherSensitivity: "high",
      status: "at-risk",
      progress: 51,
      weekIndex: 2,
    },
    {
      id: "gd-proj-2",
      opcoId: "gilde",
      projectName: "School Valkenswaard",
      milestone: "Green roof substrate",
      billingAmount: 120_000,
      expectedDate: weekStart(1),
      weatherSensitivity: "medium",
      status: "in-progress",
      progress: 64,
      weekIndex: 1,
    },
    {
      id: "gd-proj-3",
      opcoId: "gilde",
      projectName: "Bedrijfspand Waalre",
      milestone: "Edge detailing & flashing",
      billingAmount: 88_000,
      expectedDate: weekStart(3),
      weatherSensitivity: "low",
      status: "scheduled",
      progress: 12,
      weekIndex: 3,
    },
  ],
};

export function getProjects(opcoId: string): ProjectMilestone[] {
  return PROJECTS[opcoId] ?? PROJECTS["peter-ummels"];
}

const ANOMALIES: Record<string, BillingAnomaly[]> = {
  "peter-ummels": [
    {
      id: "pu-anom-1",
      opcoId: "peter-ummels",
      label: "Monthly maintenance billing",
      expectedAmount: 48_000,
      expectedDate: weekStart(0),
      status: "on-track",
      recommendedAction: "No action. Recurring pattern matches prior 6 months.",
    },
    {
      id: "pu-anom-2",
      opcoId: "peter-ummels",
      label: "Housing association service contract",
      expectedAmount: 31_500,
      expectedDate: weekStart(1),
      status: "watch",
      recommendedAction:
        "Expected invoice 4 days later than usual. Confirm with finance before week close.",
    },
    {
      id: "pu-anom-3",
      opcoId: "peter-ummels",
      label: "Retail roof milestone invoice",
      expectedAmount: 320_000,
      expectedDate: weekStart(2),
      status: "escalate",
      recommendedAction:
        "Milestone billing depends on phase-2 membrane completion, currently weather-delayed. Escalate to project lead.",
    },
  ],
  gilde: [
    {
      id: "gd-anom-1",
      opcoId: "gilde",
      label: "Monthly maintenance billing",
      expectedAmount: 36_000,
      expectedDate: weekStart(0),
      status: "on-track",
      recommendedAction: "No action. Recurring pattern stable.",
    },
    {
      id: "gd-anom-2",
      opcoId: "gilde",
      label: "Housing association service contract",
      expectedAmount: 27_000,
      expectedDate: weekStart(1),
      status: "missing",
      recommendedAction:
        "Expected recurring billing not yet raised. Verify contract status and re-issue.",
    },
    {
      id: "gd-anom-3",
      opcoId: "gilde",
      label: "Retail roof milestone invoice",
      expectedAmount: 260_000,
      expectedDate: weekStart(2),
      status: "escalate",
      recommendedAction:
        "Bitumen top-layer milestone is weather-sensitive and trending late. Escalate timing review.",
    },
  ],
};

export function getAnomalies(opcoId: string): BillingAnomaly[] {
  return ANOMALIES[opcoId] ?? ANOMALIES["peter-ummels"];
}

// --- Date helpers -----------------------------------------------------------
// Anchor the 14-week horizon to the current Monday so demo dates always look
// current. These produce ISO date strings (YYYY-MM-DD).

function mondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekStart(weekIndex: number): string {
  const m = mondayOfCurrentWeek();
  m.setDate(m.getDate() + weekIndex * 7);
  return toIso(m);
}

function weekEnd(weekIndex: number): string {
  const m = mondayOfCurrentWeek();
  m.setDate(m.getDate() + weekIndex * 7 + 4); // Friday
  return toIso(m);
}
